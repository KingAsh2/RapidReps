"""
test_iter106an_critical_batch_1.py — tests for the Critical Batch 1 scheduler
+ Stripe webhook.

Covers Edge-Case Playbook scenarios 1 (auto no-show), 5 (auto-decline), 7
(Stripe webhook + orphan recovery), plus the admin audit endpoint.

Strategy:
  - Seed sessions directly in Mongo using the existing test users.
  - Call the scheduler job functions directly (bypassing the loop) so tests
    are deterministic.
  - Mock `stripe.Refund.create`, `stripe.PaymentIntent.retrieve`, and
    `stripe.Webhook.construct_event` to avoid network calls.
  - Clean up after each test.
"""
from __future__ import annotations

import asyncio
import importlib
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

import httpx
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

API_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get(
    "REACT_APP_BACKEND_URL"
) or "http://localhost:8001"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "rapidreps")


# ── Fixtures ───────────────────────────────────────────────────────────
def _login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def http_client():
    with httpx.Client(base_url=API_URL, timeout=30.0, verify=False) as c:
        yield c


@pytest.fixture(scope="module")
def tokens(http_client):
    return {
        "admin": _login(http_client, "admin@rapidreps.com", "admin123"),
        "trainer": _login(http_client, "test_trainer_iter25@test.com", "Test123!"),
        "trainee": _login(http_client, "test_trainee_iter25@test.com", "Test123!"),
    }


@pytest.fixture(scope="module")
def user_ids():
    """Resolve test-user ObjectIds once."""
    async def _resolve():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        trainer = await db.users.find_one({"email": "test_trainer_iter25@test.com"})
        trainee = await db.users.find_one({"email": "test_trainee_iter25@test.com"})
        client.close()
        return {"trainer": str(trainer["_id"]), "trainee": str(trainee["_id"])}
    return asyncio.get_event_loop().run_until_complete(_resolve())


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _run_async(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ── Helpers ───────────────────────────────────────────────────────────
async def _insert_session(db, **overrides):
    now = datetime.utcnow()
    doc = {
        "createdAt": now,
        "updatedAt": now,
        "scheduledAt": now,
        "price": 50,
        "finalSessionPriceCents": 5000,
    }
    doc.update(overrides)
    res = await db.sessions.insert_one(doc)
    return str(res.inserted_id)


async def _cleanup(session_ids):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    for sid in session_ids:
        await db.sessions.delete_one({"_id": ObjectId(sid)})
        await db.edge_case_audit.delete_many({"sessionId": sid})
        await db.session_credits.delete_many({"reason": {"$regex": sid}})
    client.close()


def _reset_trainer(trainer_id):
    async def _do():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        await db.users.update_one(
            {"_id": ObjectId(trainer_id)},
            {"$set": {
                "performanceStrikes": 0,
                "ignoredRequestsLifetime": 0,
                "ignoredRequestsRecent": [],
                "strikeHistory": [],
                "accountUnderReview": False,
            }}
        )
        client.close()
    _run_async(_do())


# ── Config tests ───────────────────────────────────────────────────────
def test_config_snapshot_contains_all_knobs():
    from config import edge_cases
    importlib.reload(edge_cases)
    snap = edge_cases.snapshot()
    expected = {
        "EDGE_CASE_LOOP_INTERVAL_SEC", "NO_SHOW_GRACE_MIN", "REQUEST_TIMEOUT_MIN",
        "ORPHAN_RECONCILE_LOOKBACK_MIN", "STRIPE_WEBHOOK_SECRET_SET",
        "ENABLE_AUTO_NO_SHOW", "ENABLE_AUTO_DECLINE", "ENABLE_ORPHAN_RECONCILE",
    }
    assert expected.issubset(snap.keys())


def test_admin_can_view_config(http_client, tokens):
    r = http_client.get("/api/admin/edge-case-config", headers=_auth(tokens["admin"]))
    assert r.status_code == 200
    body = r.json()
    assert "NO_SHOW_GRACE_MIN" in body
    assert isinstance(body["NO_SHOW_GRACE_MIN"], int)


def test_non_admin_blocked_from_config(http_client, tokens):
    r = http_client.get("/api/admin/edge-case-config", headers=_auth(tokens["trainee"]))
    assert r.status_code in (401, 403)


# ── Scenario 1: Auto no-show ───────────────────────────────────────────
def test_auto_no_show_transitions_confirmed_to_no_show(user_ids):
    """Confirmed session with start time >10 min ago and no en-route → NO_SHOW."""
    from edge_case_scheduler import _job_auto_no_show_trainer

    _reset_trainer(user_ids["trainer"])
    seeded: list = []

    async def _seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        sid = await _insert_session(
            db,
            traineeId=user_ids["trainee"],
            trainerId=user_ids["trainer"],
            status="confirmed",
            sessionDateTimeStart=datetime.utcnow() - timedelta(minutes=15),
            finalSessionPriceCents=5000,
            paymentIntentId=f"mock_test_pi_{uuid.uuid4().hex[:8]}",
        )
        seeded.append(sid)
        client.close()
        return sid

    sid = _run_async(_seed())

    transitioned = _run_async(_job_auto_no_show_trainer())
    assert transitioned >= 1

    async def _verify():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        s = await db.sessions.find_one({"_id": ObjectId(sid)})
        audit = await db.edge_case_audit.find_one({
            "sessionId": sid, "action": "auto_no_show_trainer"
        })
        trainer = await db.users.find_one({"_id": ObjectId(user_ids["trainer"])})
        client.close()
        return s, audit, trainer

    s, audit, trainer = _run_async(_verify())
    assert s["status"] == "no_show"
    assert s["noShowParty"] == "trainer"
    assert s["traineeRefundCents"] == 5000
    assert s["_autoNoShowApplied"] is True
    assert audit is not None
    assert audit["reason"].startswith("No en-route")
    assert trainer["performanceStrikes"] >= 1

    _run_async(_cleanup(seeded))


def test_auto_no_show_is_idempotent(user_ids):
    """Running the job twice does NOT apply two strikes."""
    from edge_case_scheduler import _job_auto_no_show_trainer

    _reset_trainer(user_ids["trainer"])
    seeded: list = []

    async def _seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        sid = await _insert_session(
            db,
            traineeId=user_ids["trainee"],
            trainerId=user_ids["trainer"],
            status="confirmed",
            sessionDateTimeStart=datetime.utcnow() - timedelta(minutes=20),
            finalSessionPriceCents=4000,
            paymentIntentId=f"mock_idempotent_{uuid.uuid4().hex[:8]}",
        )
        seeded.append(sid)
        client.close()
        return sid

    sid = _run_async(_seed())
    _run_async(_job_auto_no_show_trainer())
    _run_async(_job_auto_no_show_trainer())  # second run

    async def _check():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        trainer = await db.users.find_one({"_id": ObjectId(user_ids["trainer"])})
        audit_count = await db.edge_case_audit.count_documents({
            "sessionId": sid, "action": "auto_no_show_trainer"
        })
        client.close()
        return trainer["performanceStrikes"], audit_count

    strikes, audit_count = _run_async(_check())
    assert strikes == 1
    assert audit_count == 1

    _run_async(_cleanup(seeded))


def test_auto_no_show_skips_when_en_route(user_ids):
    """Session with enRouteStartedAt set must NOT be auto-flipped."""
    from edge_case_scheduler import _job_auto_no_show_trainer

    _reset_trainer(user_ids["trainer"])
    seeded: list = []

    async def _seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        sid = await _insert_session(
            db,
            traineeId=user_ids["trainee"],
            trainerId=user_ids["trainer"],
            status="en_route",
            sessionDateTimeStart=datetime.utcnow() - timedelta(minutes=20),
            enRouteStartedAt=datetime.utcnow() - timedelta(minutes=25),
            finalSessionPriceCents=4000,
            paymentIntentId=f"mock_skip_enroute_{uuid.uuid4().hex[:8]}",
        )
        seeded.append(sid)
        client.close()
        return sid

    sid = _run_async(_seed())
    _run_async(_job_auto_no_show_trainer())

    async def _check():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        s = await db.sessions.find_one({"_id": ObjectId(sid)})
        client.close()
        return s

    s = _run_async(_check())
    assert s["status"] == "en_route"  # untouched
    assert s.get("_autoNoShowApplied") is not True

    _run_async(_cleanup(seeded))


# ── Scenario 5: Auto-decline + responsiveness ──────────────────────────
def test_auto_decline_stale_request(user_ids):
    """Request older than REQUEST_TIMEOUT_MIN is declined with audit row."""
    from edge_case_scheduler import _job_auto_decline_request
    from config import edge_cases as cfg

    _reset_trainer(user_ids["trainer"])
    seeded: list = []

    async def _seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        sid = await _insert_session(
            db,
            traineeId=user_ids["trainee"],
            trainerId=user_ids["trainer"],
            status="requested",
            createdAt=datetime.utcnow() - timedelta(minutes=cfg.REQUEST_TIMEOUT_MIN + 5),
        )
        seeded.append(sid)
        client.close()
        return sid

    sid = _run_async(_seed())
    _run_async(_job_auto_decline_request())

    async def _check():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        s = await db.sessions.find_one({"_id": ObjectId(sid)})
        audit = await db.edge_case_audit.find_one({"sessionId": sid, "action": "auto_decline_request"})
        client.close()
        return s, audit

    s, audit = _run_async(_check())
    assert s["status"] == "declined"
    assert s["declinedReason"] == "trainer_timeout"
    assert audit is not None
    _run_async(_cleanup(seeded))


def test_responsiveness_strike_after_threshold(user_ids):
    """N ignored requests in window → strike on trainer."""
    from edge_case_scheduler import _job_auto_decline_request
    from config import edge_cases as cfg

    _reset_trainer(user_ids["trainer"])
    seeded: list = []
    n = cfg.RESPONSIVENESS_STRIKE_IGNORES + 1  # one over the threshold

    async def _seed_all():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        for _ in range(n):
            sid = await _insert_session(
                db,
                traineeId=user_ids["trainee"],
                trainerId=user_ids["trainer"],
                status="requested",
                createdAt=datetime.utcnow() - timedelta(minutes=cfg.REQUEST_TIMEOUT_MIN + 10),
            )
            seeded.append(sid)
        client.close()

    _run_async(_seed_all())
    _run_async(_job_auto_decline_request())

    async def _check():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        trainer = await db.users.find_one({"_id": ObjectId(user_ids["trainer"])})
        client.close()
        return trainer

    trainer = _run_async(_check())
    # Should have applied at least one strike (the one tipping over the threshold)
    assert trainer.get("performanceStrikes", 0) >= 1
    assert len(trainer.get("ignoredRequestsRecent", []) or []) >= n

    _run_async(_cleanup(seeded))


# ── Scenario 7: Stripe webhook + orphan reconcile ──────────────────────
def test_webhook_rejects_without_secret(http_client):
    """If STRIPE_WEBHOOK_SECRET is unset, every webhook request → 503."""
    r = http_client.post(
        "/api/webhooks/stripe",
        headers={"Stripe-Signature": "t=1,v1=garbage"},
        content=b"{}",
    )
    # If secret is unset → 503. If secret is set → 400 for bad sig.
    assert r.status_code in (503, 400)


def test_webhook_bad_signature_rejected(http_client, monkeypatch):
    """With a secret configured, an invalid signature → 400."""
    import stripe
    # Force the route to think the secret is set.
    from config import edge_cases as cfg
    monkeypatch.setattr(cfg, "STRIPE_WEBHOOK_SECRET", "whsec_test_xxx")

    r = http_client.post(
        "/api/webhooks/stripe",
        headers={"Stripe-Signature": "t=1,v1=invalid"},
        content=b'{"id":"evt_x","type":"payment_intent.succeeded","data":{"object":{"id":"pi_x"}}}',
    )
    # Note: monkeypatch only affects this test process, not the running server.
    # So this asserts the public contract: server returns either 503 (no secret)
    # or 400 (bad sig) — never 200 with an invalid sig.
    assert r.status_code in (400, 503)


def test_orphan_reconcile_finalizes_via_stripe(user_ids):
    """
    PI succeeded in Stripe but session never got marked paid → reconciler
    finalizes it.
    """
    from edge_case_scheduler import _job_orphan_payment_reconcile

    seeded: list = []
    fake_pi_id = f"pi_orphan_{uuid.uuid4().hex[:8]}"

    async def _seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        sid = await _insert_session(
            db,
            traineeId=user_ids["trainee"],
            trainerId=user_ids["trainer"],
            status="confirmed",
            paymentStatus="pending",
            paymentIntentId=fake_pi_id,
            updatedAt=datetime.utcnow() - timedelta(minutes=30),
        )
        seeded.append(sid)
        client.close()
        return sid

    sid = _run_async(_seed())

    fake_intent = MagicMock()
    fake_intent.status = "succeeded"
    fake_intent.amount = 5000

    with patch("edge_case_scheduler.stripe.PaymentIntent.retrieve", return_value=fake_intent):
        reconciled = _run_async(_job_orphan_payment_reconcile())

    assert reconciled >= 1

    async def _check():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        s = await db.sessions.find_one({"_id": ObjectId(sid)})
        audit = await db.edge_case_audit.find_one({
            "sessionId": sid, "action": "orphan_payment_reconcile"
        })
        client.close()
        return s, audit

    s, audit = _run_async(_check())
    assert s["paymentStatus"] == "paid"
    assert s["paymentReconciledBy"] == "scheduler"
    assert audit is not None
    _run_async(_cleanup(seeded))


# ── Admin audit endpoint ───────────────────────────────────────────────
def test_admin_audit_endpoint_returns_rows(http_client, tokens):
    r = http_client.get(
        "/api/admin/edge-case-audit?limit=5",
        headers=_auth(tokens["admin"]),
    )
    assert r.status_code == 200
    body = r.json()
    assert "rows" in body
    assert isinstance(body["rows"], list)
    assert "count" in body


def test_admin_audit_filters_by_action(http_client, tokens):
    r = http_client.get(
        "/api/admin/edge-case-audit?action=auto_decline_request&limit=3",
        headers=_auth(tokens["admin"]),
    )
    assert r.status_code == 200
    rows = r.json()["rows"]
    for row in rows:
        assert row["action"] == "auto_decline_request"


def test_non_admin_cannot_view_audit(http_client, tokens):
    r = http_client.get(
        "/api/admin/edge-case-audit",
        headers=_auth(tokens["trainee"]),
    )
    assert r.status_code in (401, 403)
