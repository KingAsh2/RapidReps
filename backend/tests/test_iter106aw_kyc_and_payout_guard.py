"""
test_iter106aw_kyc_and_payout_guard.py — iter106aw.

Covers Option-B KYC (self-attestation + admin manual review) and its
payout gate.
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timedelta

import httpx
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

API_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://highlight-vibe-bugs.preview.emergentagent.com"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "rapidreps")


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    return r.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


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
    async def _resolve():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        trainer = await db.users.find_one({"email": "test_trainer_iter25@test.com"})
        trainee = await db.users.find_one({"email": "test_trainee_iter25@test.com"})
        client.close()
        return {"trainer": str(trainer["_id"]), "trainee": str(trainee["_id"])}
    return _run(_resolve())


async def _reset_kyc(trainer_id):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await db.trainer_profiles.update_one(
        {"userId": trainer_id},
        {"$unset": {
            "kycStatus": "", "kycDocumentUrl": "", "kycSelfieUrl": "",
            "kycFullLegalName": "", "kycSubmittedAt": "",
            "kycReviewedAt": "", "kycReviewedBy": "", "kycNotes": "",
        }},
        upsert=True,
    )
    client.close()


# ─────────────────────────────────────────────────────────────
# Submit / status / approve / reject flow
# ─────────────────────────────────────────────────────────────
def test_trainee_cannot_submit_kyc(http_client, tokens):
    r = http_client.post(
        "/api/trainer/kyc/submit",
        headers=_auth(tokens["trainee"]),
        json={"documentUrl": "https://example.com/id.jpg", "fullLegalName": "Test User"},
    )
    assert r.status_code == 403


def test_kyc_full_flow_submit_then_approve(http_client, tokens, user_ids):
    _run(_reset_kyc(user_ids["trainer"]))

    # Status before submit → not_submitted
    r = http_client.get("/api/trainer/kyc/status", headers=_auth(tokens["trainer"]))
    assert r.status_code == 200
    assert r.json()["status"] == "not_submitted"

    # Submit
    r = http_client.post(
        "/api/trainer/kyc/submit",
        headers=_auth(tokens["trainer"]),
        json={
            "documentUrl": "/api/files/verification/test-id.jpg",
            "selfieUrl": "/api/files/verification/test-selfie.jpg",
            "fullLegalName": "Test Trainer",
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "submitted"

    # Trainer sees submitted
    r = http_client.get("/api/trainer/kyc/status", headers=_auth(tokens["trainer"]))
    assert r.json()["status"] == "submitted"
    assert r.json()["fullLegalName"] == "Test Trainer"

    # Admin sees it in queue
    r = http_client.get("/api/admin/kyc/queue", headers=_auth(tokens["admin"]))
    assert r.status_code == 200
    items = r.json()["items"]
    assert any(i["trainerId"] == user_ids["trainer"] for i in items)

    # Non-admin blocked
    r = http_client.get("/api/admin/kyc/queue", headers=_auth(tokens["trainer"]))
    assert r.status_code in (401, 403)

    # Approve
    r = http_client.post(
        f"/api/admin/kyc/{user_ids['trainer']}/approve",
        headers=_auth(tokens["admin"]),
        json={"notes": "Looks good"},
    )
    assert r.status_code == 200

    # Trainer sees approved
    r = http_client.get("/api/trainer/kyc/status", headers=_auth(tokens["trainer"]))
    assert r.json()["status"] == "approved"


def test_kyc_reject_requires_notes(http_client, tokens, user_ids):
    _run(_reset_kyc(user_ids["trainer"]))
    http_client.post(
        "/api/trainer/kyc/submit",
        headers=_auth(tokens["trainer"]),
        json={"documentUrl": "/api/files/test.jpg", "fullLegalName": "Test Trainer"},
    )
    # Reject with no notes → 400
    r = http_client.post(
        f"/api/admin/kyc/{user_ids['trainer']}/reject",
        headers=_auth(tokens["admin"]),
        json={"notes": ""},
    )
    assert r.status_code == 400

    # Reject with notes → 200
    r = http_client.post(
        f"/api/admin/kyc/{user_ids['trainer']}/reject",
        headers=_auth(tokens["admin"]),
        json={"notes": "Photo too blurry"},
    )
    assert r.status_code == 200

    r = http_client.get("/api/trainer/kyc/status", headers=_auth(tokens["trainer"]))
    assert r.json()["status"] == "rejected"
    assert r.json()["notes"] == "Photo too blurry"


def test_kyc_reject_bad_trainer_id(http_client, tokens):
    r = http_client.post(
        "/api/admin/kyc/not-an-oid/reject",
        headers=_auth(tokens["admin"]),
        json={"notes": "x"},
    )
    assert r.status_code == 400


# ─────────────────────────────────────────────────────────────
# Payout guard
# ─────────────────────────────────────────────────────────────
def test_payout_blocked_when_kyc_not_approved(http_client, tokens, user_ids):
    """/api/admin/payouts/mark-paid must refuse when trainer.kycStatus != 'approved'."""
    _run(_reset_kyc(user_ids["trainer"]))  # kycStatus effectively missing

    # Seed a completed session for this trainer.
    seeded = []

    async def _seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        res = await db.sessions.insert_one({
            "trainerId": user_ids["trainer"],
            "traineeId": user_ids["trainee"],
            "status": "completed",
            "trainerEarningsCents": 4000,
            "createdAt": datetime.utcnow(),
        })
        seeded.append(str(res.inserted_id))
        client.close()

    async def _cleanup():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        for sid in seeded:
            await db.sessions.delete_one({"_id": ObjectId(sid)})
        client.close()

    _run(_seed())
    r = http_client.post(
        "/api/admin/payouts/mark-paid",
        headers=_auth(tokens["admin"]),
        json={"sessionIds": seeded, "note": "Test"},
    )
    _run(_cleanup())
    assert r.status_code == 403
    assert "KYC" in r.json()["detail"]


def test_payout_allowed_when_kyc_approved(http_client, tokens, user_ids):
    """Once KYC is approved the same mark-paid call succeeds."""
    _run(_reset_kyc(user_ids["trainer"]))

    # Submit + approve.
    http_client.post(
        "/api/trainer/kyc/submit",
        headers=_auth(tokens["trainer"]),
        json={"documentUrl": "/api/files/test.jpg", "fullLegalName": "Test Trainer"},
    )
    http_client.post(
        f"/api/admin/kyc/{user_ids['trainer']}/approve",
        headers=_auth(tokens["admin"]),
        json={"notes": "ok"},
    )

    seeded = []

    async def _seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        res = await db.sessions.insert_one({
            "trainerId": user_ids["trainer"],
            "traineeId": user_ids["trainee"],
            "status": "completed",
            "trainerEarningsCents": 4000,
            "createdAt": datetime.utcnow(),
        })
        seeded.append(str(res.inserted_id))
        client.close()

    async def _cleanup():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        for sid in seeded:
            await db.sessions.delete_one({"_id": ObjectId(sid)})
        client.close()

    _run(_seed())
    r = http_client.post(
        "/api/admin/payouts/mark-paid",
        headers=_auth(tokens["admin"]),
        json={"sessionIds": seeded, "note": "Test"},
    )
    _run(_cleanup())
    assert r.status_code == 200, r.text
