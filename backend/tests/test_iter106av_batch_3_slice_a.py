"""
test_iter106av_batch_3_slice_a.py — Slice A of Batch 3.

Covers:
  - G8  gps-checkin rejects when accuracy > 100m
  - G8  gps-checkin uses (distance + accuracy) for radius check
  - G21 send_push_notification deletes token after 2 DeviceNotRegistered strikes
  - G27 gps-update rejects strictly-older client_timestamp with 409
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock, MagicMock

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


async def _insert_confirmed_session(db, trainer_id: str, trainee_id: str, **overrides):
    now = datetime.utcnow()
    doc = {
        "createdAt": now, "updatedAt": now,
        "trainerId": trainer_id, "traineeId": trainee_id,
        "status": "confirmed",
        "sessionType": "outdoor",
        "durationMinutes": 30,
        "finalSessionPriceCents": 5000,
        "locationLatitude": 37.7749,
        "locationLongitude": -122.4194,
        "gpsCheckinRadiusMiles": 0.5,  # tight radius for accuracy math
    }
    doc.update(overrides)
    res = await db.sessions.insert_one(doc)
    return str(res.inserted_id)


async def _cleanup(sids):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    for sid in sids:
        await db.sessions.delete_one({"_id": ObjectId(sid)})
        await db.session_gps_tracks.delete_many({"sessionId": sid})
    client.close()


# ─────────────────────────────────────────────────────────────
# G8: gps-checkin GPS-accuracy handling
# ─────────────────────────────────────────────────────────────
def test_gps_checkin_rejects_noisy_accuracy(http_client, tokens, user_ids):
    seeded = []

    async def _seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        sid = await _insert_confirmed_session(db, user_ids["trainer"], user_ids["trainee"])
        seeded.append(sid)
        client.close()
        return sid

    sid = _run(_seed())
    r = http_client.post(
        f"/api/sessions/{sid}/gps-checkin",
        headers=_auth(tokens["trainer"]),
        json={"latitude": 37.7749, "longitude": -122.4194, "accuracy": 250.0},
    )
    _run(_cleanup(seeded))
    assert r.status_code == 400
    assert "GPS signal" in r.json()["detail"]


def test_gps_checkin_accepts_within_radius_with_good_accuracy(http_client, tokens, user_ids):
    seeded = []

    async def _seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        sid = await _insert_confirmed_session(db, user_ids["trainer"], user_ids["trainee"])
        seeded.append(sid)
        client.close()
        return sid

    sid = _run(_seed())
    # ~0 miles distance, ±20m accuracy — well within 0.5 mile radius
    r = http_client.post(
        f"/api/sessions/{sid}/gps-checkin",
        headers=_auth(tokens["trainer"]),
        json={"latitude": 37.7749, "longitude": -122.4194, "accuracy": 20.0},
    )
    _run(_cleanup(seeded))
    assert r.status_code == 200
    body = r.json()
    assert body["withinRadius"] is True


def test_gps_checkin_no_accuracy_still_works(http_client, tokens, user_ids):
    """Backwards compat: pre-Batch-3 clients omit accuracy — must still work."""
    seeded = []

    async def _seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        sid = await _insert_confirmed_session(db, user_ids["trainer"], user_ids["trainee"])
        seeded.append(sid)
        client.close()
        return sid

    sid = _run(_seed())
    r = http_client.post(
        f"/api/sessions/{sid}/gps-checkin",
        headers=_auth(tokens["trainer"]),
        json={"latitude": 37.7749, "longitude": -122.4194},
    )
    _run(_cleanup(seeded))
    assert r.status_code == 200


# ─────────────────────────────────────────────────────────────
# G27: gps-update replay protection via client_timestamp
# ─────────────────────────────────────────────────────────────
def test_gps_update_rejects_stale_client_timestamp(http_client, tokens, user_ids):
    seeded = []

    async def _seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        sid = await _insert_confirmed_session(
            db, user_ids["trainer"], user_ids["trainee"],
            status="en_route",
        )
        seeded.append(sid)
        client.close()
        return sid

    sid = _run(_seed())

    # First ping — newer timestamp.
    newer = (datetime.utcnow()).isoformat()
    r1 = http_client.post(
        f"/api/sessions/{sid}/gps-update",
        headers=_auth(tokens["trainer"]),
        params={
            "latitude": 37.7749, "longitude": -122.4194,
            "accuracy": 10, "client_timestamp": newer,
        },
    )
    assert r1.status_code == 200, r1.text

    # Second ping — older client_timestamp → 409.
    older = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
    r2 = http_client.post(
        f"/api/sessions/{sid}/gps-update",
        headers=_auth(tokens["trainer"]),
        params={
            "latitude": 37.7749, "longitude": -122.4194,
            "accuracy": 10, "client_timestamp": older,
        },
    )
    _run(_cleanup(seeded))
    assert r2.status_code == 409
    assert "Stale" in r2.json()["detail"]


def test_gps_update_without_client_timestamp_still_works(http_client, tokens, user_ids):
    """Legacy clients pre-G27 don't send client_timestamp — must remain accepted."""
    seeded = []

    async def _seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        sid = await _insert_confirmed_session(
            db, user_ids["trainer"], user_ids["trainee"],
            status="en_route",
        )
        seeded.append(sid)
        client.close()
        return sid

    sid = _run(_seed())
    r = http_client.post(
        f"/api/sessions/{sid}/gps-update",
        headers=_auth(tokens["trainer"]),
        params={"latitude": 37.7749, "longitude": -122.4194, "accuracy": 10},
    )
    _run(_cleanup(seeded))
    assert r.status_code == 200


# ─────────────────────────────────────────────────────────────
# G21: push token cleanup on DeviceNotRegistered
# ─────────────────────────────────────────────────────────────
def test_push_token_deleted_after_two_dead_strikes(user_ids):
    """Simulates two DeviceNotRegistered replies from Expo and verifies delete."""
    import aiohttp
    from deps import send_push_notification

    fake_token = f"ExpoTokenTest-{uuid.uuid4().hex[:12]}"
    user_id = user_ids["trainer"]

    async def _seed():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        # Clean any previous test data.
        await db.push_tokens.delete_many({"token": fake_token})
        await db.push_tokens.insert_one({
            "userId": user_id, "token": fake_token, "deadStrikes": 0,
        })
        client.close()

    async def _check_row():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        row = await db.push_tokens.find_one({"token": fake_token})
        client.close()
        return row

    _run(_seed())

    # Build a fake aiohttp.ClientSession that returns a DeviceNotRegistered ticket.
    class FakeResp:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def json(self):
            return {"data": [{
                "status": "error",
                "details": {"error": "DeviceNotRegistered"},
            }]}

    class FakeClientSession:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        def post(self, *a, **kw): return FakeResp()

    with patch.object(aiohttp, "ClientSession", FakeClientSession):
        # Strike 1 — expect deadStrikes = 1, still present.
        _run(send_push_notification(user_id, "test", "body"))
        row = _run(_check_row())
        assert row is not None and row.get("deadStrikes") == 1

        # Strike 2 — expect deletion.
        _run(send_push_notification(user_id, "test", "body"))
        row = _run(_check_row())
        assert row is None
