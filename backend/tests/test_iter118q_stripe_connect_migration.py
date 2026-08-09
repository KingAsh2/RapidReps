"""
iter118q — Backend tests for the Zelle → Stripe Connect Express cutover.

Covers:
  * Fee split math in services.stripe_connect_service.compute_platform_and_trainer_split
  * GET /api/trainer/connect/status new response shape (not_connected)
  * POST /api/trainer/connect/account-link — Stripe live-account "temporarily
    restricted" error is treated as PASS (per test-brief) since the endpoint
    is forwarding a legitimate Stripe error, not a code bug.
  * GET /api/admin/trainers/connect-status admin listing shape + ordering
  * POST /api/trainer/request-payout (legacy) returns HTTP 410
  * mark_session_eligible_for_release: sets trainerEligibleAt ~ now+24h,
    trainerGrossCents = 80% * price, transferState='pending'
  * release_due_transfers: with no stripeConnectAccountId, sets
    transferState='awaiting-onboarding' + transferBlockReason
  * Migration script scripts/migrate_zelle_to_connect is idempotent
  * Webhook _handle_account_updated / _handle_payout_paid direct-call mirroring
"""
from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from datetime import datetime, timedelta

import pytest
import requests
from bson import ObjectId

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://highlight-vibe-bugs.preview.emergentagent.com").rstrip("/")

# Make backend/ importable for direct-service tests.
sys.path.insert(0, "/app/backend")

ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api, email, password):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        pytest.skip(f"login failed for {email}: {r.status_code} {r.text[:200]}")
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def trainer_token(api):
    return _login(api, TRAINER_EMAIL, TRAINER_PASSWORD)


@pytest.fixture(scope="module")
def admin_token(api):
    return _login(api, ADMIN_EMAIL, ADMIN_PASSWORD)


def _fresh_db():
    """Return the motor db bound to the shared event loop used by all tests."""
    from motor.motor_asyncio import AsyncIOMotorClient
    loop = _shared_loop()
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"), io_loop=loop)
    return client[os.environ.get("DB_NAME", "rapidreps")]


_LOOP = None
def _shared_loop():
    global _LOOP
    if _LOOP is None or _LOOP.is_closed():
        _LOOP = asyncio.new_event_loop()
        asyncio.set_event_loop(_LOOP)
        # Rebind deps.db to this loop so webhook handlers using deps.db work.
        import deps
        from motor.motor_asyncio import AsyncIOMotorClient
        _c = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"), io_loop=_LOOP)
        deps.db = _c[os.environ.get("DB_NAME", "rapidreps")]
    return _LOOP


def _arun(coro):
    return _shared_loop().run_until_complete(coro)


@pytest.fixture
def db():
    # Sync helper for the two API tests that only need it for setup/restore;
    # each of those tests calls asyncio.run itself so they need a per-run client.
    return None


# ---------------------------------------------------------------------------
# 1) Fee split math
# ---------------------------------------------------------------------------

class TestSplitMath:
    def test_split_50_dollar_session(self):
        from services.stripe_connect_service import compute_platform_and_trainer_split
        s = compute_platform_and_trainer_split(5000, 299)
        assert s["traineePaysCents"] == 5299
        assert s["platformCutCents"] == 1299  # $10 (20%) + $2.99
        assert s["trainerGrossCents"] == 4000

    def test_split_75_dollar_session(self):
        from services.stripe_connect_service import compute_platform_and_trainer_split
        s = compute_platform_and_trainer_split(7500, 299)
        assert s["traineePaysCents"] == 7799
        assert s["platformCutCents"] == 1799  # $15 + $2.99
        assert s["trainerGrossCents"] == 6000

    def test_split_free_session(self):
        from services.stripe_connect_service import compute_platform_and_trainer_split
        s = compute_platform_and_trainer_split(0, 0)
        assert s["traineePaysCents"] == 0
        assert s["platformCutCents"] == 0
        assert s["trainerGrossCents"] == 0


# ---------------------------------------------------------------------------
# 2) GET /api/trainer/connect/status shape (not_connected)
# ---------------------------------------------------------------------------

class TestConnectStatusEndpoint:
    def test_status_shape_for_trainer(self, api, trainer_token, db):
        # Ensure the trainer has no stripeConnectAccountId to test not_connected path.
        # (We don't clobber if they already have one; we just accept either shape.)
        r = api.get(
            f"{BASE_URL}/api/trainer/connect/status",
            headers={"Authorization": f"Bearer {trainer_token}"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Required new-shape keys
        for k in ("connectStatus", "payoutsEnabled", "detailsSubmitted",
                  "chargesEnabled", "requirementsDue", "availableCents",
                  "pendingCents", "payouts"):
            assert k in data, f"missing key {k} in response: {data}"
        # Types
        assert isinstance(data["requirementsDue"], list)
        assert isinstance(data["payouts"], list)
        # Must NOT return old Zelle shape
        assert data.get("paymentMethod") != "zelle"
        assert "connected" not in data or isinstance(data.get("connected"), (bool, type(None)))
        # If not connected, connectStatus should be 'not_connected'
        if not data["payoutsEnabled"] and not data["detailsSubmitted"]:
            assert data["connectStatus"] in ("not_connected", "onboarding", "requirements_due", "restricted")

    def test_status_not_connected_when_no_profile(self, api, trainer_token, db):
        """Force the not_connected path by removing stripeConnectAccountId."""
        async def prep():
            db = _fresh_db()
            # Look up trainer userId via /api/auth/me
            r = api.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {trainer_token}"})
            uid = r.json().get("_id") or r.json().get("id")
            # Save existing value then unset
            prof = await db.trainer_profiles.find_one({"userId": uid})
            saved = prof.get("stripeConnectAccountId") if prof else None
            if prof:
                await db.trainer_profiles.update_one(
                    {"userId": uid}, {"$unset": {"stripeConnectAccountId": ""}}
                )
            return uid, saved

        async def restore(uid, saved):
            db = _fresh_db()
            if saved:
                await db.trainer_profiles.update_one(
                    {"userId": uid}, {"$set": {"stripeConnectAccountId": saved}}
                )

        uid, saved = _arun(prep())
        try:
            r = api.get(
                f"{BASE_URL}/api/trainer/connect/status",
                headers={"Authorization": f"Bearer {trainer_token}"},
            )
            assert r.status_code == 200
            data = r.json()
            assert data["connectStatus"] == "not_connected"
            assert data["payoutsEnabled"] is False
            assert data["availableCents"] == 0
            assert data["pendingCents"] == 0
            assert data["payouts"] == []
        finally:
            _arun(restore(uid, saved))


# ---------------------------------------------------------------------------
# 3) POST /api/trainer/connect/account-link — Stripe restrictions accepted.
# ---------------------------------------------------------------------------

class TestAccountLink:
    def test_account_link_creates_or_forwards_restriction(self, api, trainer_token):
        r = api.post(
            f"{BASE_URL}/api/trainer/connect/account-link",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={},
        )
        # 200 = happy path
        if r.status_code == 200:
            data = r.json()
            assert "url" in data and data["url"].startswith("http")
            assert "accountId" in data and data["accountId"].startswith("acct_")
            return
        # 400 forwarding Stripe restriction is acceptable per the test brief.
        assert r.status_code == 400, f"unexpected status {r.status_code}: {r.text[:400]}"
        body = r.text.lower()
        assert ("stripe error" in body and "restrict" in body) or "temporarily restricted" in body, \
            f"400 returned but not the expected Stripe-restriction error: {r.text[:400]}"


# ---------------------------------------------------------------------------
# 4) Admin dashboard endpoint
# ---------------------------------------------------------------------------

class TestAdminConnectStatus:
    def test_admin_list_shape_and_ordering(self, api, admin_token):
        r = api.get(
            f"{BASE_URL}/api/admin/trainers/connect-status",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "trainers" in data and "count" in data
        assert isinstance(data["trainers"], list)
        assert data["count"] == len(data["trainers"])
        if data["trainers"]:
            row = data["trainers"][0]
            for k in ("trainerId", "trainerName", "connectStatus",
                      "payoutsEnabled", "requirementsDue"):
                assert k in row, f"missing {k} in trainer row: {row}"
            # Ordering: 'connected' should come after non-connected statuses.
            priority = {"requirements_due": 0, "restricted": 1, "onboarding": 2,
                        "not_connected": 3, "connected": 4}
            seen = [priority.get(t.get("connectStatus"), 5) for t in data["trainers"]]
            assert seen == sorted(seen), f"trainers not sorted needs-attention first: {seen[:20]}"


# ---------------------------------------------------------------------------
# 5) Legacy request-payout returns 410
# ---------------------------------------------------------------------------

class TestLegacyRequestPayout:
    def test_returns_410_gone(self, api, trainer_token):
        r = api.post(
            f"{BASE_URL}/api/trainer/request-payout",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={"paymentMethod": "zelle", "paymentHandle": "test@example.com"},
        )
        assert r.status_code == 410, f"expected 410, got {r.status_code}: {r.text[:200]}"
        detail = (r.json().get("detail") or "").lower()
        assert "stripe" in detail or "connect" in detail


# ---------------------------------------------------------------------------
# 6) mark_session_eligible_for_release  (direct service test)
# ---------------------------------------------------------------------------

class TestMarkEligible:
    def test_sets_eligibility_and_gross(self, db):
        from services.stripe_connect_service import mark_session_eligible_for_release

        async def run():
            db = _fresh_db()
            sid = ObjectId()
            doc = {
                "_id": sid,
                "trainerId": "TEST_trainer_iter118q",
                "traineeId": "TEST_trainee_iter118q",
                "finalSessionPriceCents": 5000,
                "status": "completed",
            }
            await db.sessions.insert_one(doc)
            try:
                before = datetime.utcnow()
                await mark_session_eligible_for_release(db, str(sid))
                after = datetime.utcnow()
                fresh = await db.sessions.find_one({"_id": sid})
                assert fresh["trainerGrossCents"] == 4000  # 80% of $50
                assert fresh["transferState"] == "pending"
                eligible = fresh["trainerEligibleAt"]
                # Should be ~24h in the future
                delta = eligible - before
                assert timedelta(hours=23, minutes=55) <= delta <= timedelta(hours=24, minutes=5), \
                    f"trainerEligibleAt not ~now+24h: {delta}"
                # Second call should be no-op (doesn't reset the clock)
                await mark_session_eligible_for_release(db, str(sid))
                fresh2 = await db.sessions.find_one({"_id": sid})
                assert fresh2["trainerEligibleAt"] == eligible
            finally:
                await db.sessions.delete_one({"_id": sid})

        _arun(run())


# ---------------------------------------------------------------------------
# 7) release_due_transfers awaiting-onboarding path
# ---------------------------------------------------------------------------

class TestReleaseDueTransfers:
    def test_awaiting_onboarding_when_no_connect_account(self, db):
        from services.stripe_connect_service import release_due_transfers

        async def run():
            db = _fresh_db()
            trainer_uid = "TEST_release_trainer_iter118q"
            sid = ObjectId()
            past = datetime.utcnow() - timedelta(hours=1)
            # Ensure trainer profile has NO stripeConnectAccountId + payoutsEnabled=false
            await db.trainer_profiles.update_one(
                {"userId": trainer_uid},
                {"$set": {"userId": trainer_uid, "payoutsEnabled": False},
                 "$unset": {"stripeConnectAccountId": ""}},
                upsert=True,
            )
            await db.sessions.insert_one({
                "_id": sid,
                "trainerId": trainer_uid,
                "traineeId": "TEST_trainee_iter118q",
                "trainerEligibleAt": past,
                "trainerGrossCents": 4000,
                "transferState": "pending",
                "status": "completed",
            })
            try:
                released = await release_due_transfers(db)
                # Doesn't matter if other rows released in the DB; check ours specifically
                fresh = await db.sessions.find_one({"_id": sid})
                assert fresh["transferState"] == "awaiting-onboarding", fresh
                assert fresh.get("transferBlockReason") == "trainer-not-connected"
                assert not fresh.get("transferId")
                assert isinstance(released, int)
            finally:
                await db.sessions.delete_one({"_id": sid})
                await db.trainer_profiles.delete_one({"userId": trainer_uid})

        _arun(run())


# ---------------------------------------------------------------------------
# 8) Migration script idempotency
# ---------------------------------------------------------------------------

class TestMigrationIdempotent:
    def test_second_run_is_noop(self):
        # First run — presumed already done, but run once to normalize.
        cmd = [sys.executable, "-m", "scripts.migrate_zelle_to_connect"]
        r1 = subprocess.run(cmd, cwd="/app/backend", capture_output=True, text=True, timeout=90)
        assert r1.returncode == 0, f"first run failed: {r1.stderr[:400]}"
        r2 = subprocess.run(cmd, cwd="/app/backend", capture_output=True, text=True, timeout=90)
        assert r2.returncode == 0, f"second run failed: {r2.stderr[:400]}"
        out2 = r2.stdout
        # Second run: void = 0 and zelle-clear = 0 (no more pending or zelle rows)
        # flag_res will be 0 modified because values already set (Mongo modified_count
        # only counts real changes).
        assert "Voided payout_requests rows:  0" in out2, out2
        assert "Cleared Zelle handles:         0" in out2, out2
        assert "Trainers flagged to onboard:   0" in out2, out2


# ---------------------------------------------------------------------------
# 9) Webhook handlers (direct-call)
# ---------------------------------------------------------------------------

class TestWebhookHandlers:
    def test_account_updated_mirrors_state(self, db):
        from routes.webhook_routes import _handle_account_updated

        async def run():
            db = _fresh_db()
            trainer_uid = "TEST_webhook_trainer_iter118q"
            acct = "acct_TEST_iter118q_dummy"
            await db.trainer_profiles.update_one(
                {"userId": trainer_uid},
                {"$set": {"userId": trainer_uid, "stripeConnectAccountId": acct}},
                upsert=True,
            )
            try:
                event = {
                    "id": "evt_test_iter118q_1",
                    "type": "account.updated",
                    "data": {"object": {
                        "id": acct,
                        "payouts_enabled": True,
                        "details_submitted": True,
                        "charges_enabled": True,
                        "requirements": {"currently_due": [], "past_due": []},
                    }},
                }
                await _handle_account_updated(event)
                fresh = await db.trainer_profiles.find_one({"userId": trainer_uid})
                assert fresh["payoutsEnabled"] is True
                assert fresh["detailsSubmitted"] is True
                assert fresh["chargesEnabled"] is True
                assert fresh["connectStatus"] == "connected"
                assert fresh["requirementsDue"] == []
            finally:
                await db.trainer_profiles.delete_one({"userId": trainer_uid})

        _arun(run())

    def test_payout_paid_upserts_row(self, db):
        from routes.webhook_routes import _handle_payout_paid

        async def run():
            db = _fresh_db()
            acct = "acct_TEST_iter118q_dummy2"
            payout_id = "po_TEST_iter118q_1"
            event = {
                "id": "evt_test_iter118q_2",
                "type": "payout.paid",
                "account": acct,
                "data": {"object": {
                    "id": payout_id,
                    "amount": 4000,
                    "currency": "usd",
                    "arrival_date": 1700000000,
                }},
            }
            try:
                await _handle_payout_paid(event)
                row = await db.trainer_payouts.find_one({"stripePayoutId": payout_id})
                assert row is not None
                assert row["status"] == "paid"
                assert row["amountCents"] == 4000
                assert row["stripeConnectAccountId"] == acct
            finally:
                await db.trainer_payouts.delete_one({"stripePayoutId": payout_id})

        _arun(run())
