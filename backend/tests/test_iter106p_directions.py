"""iter106p — Regression test for Directions/ETA enrichment of the live
GPS broadcast frame.

Skipped automatically if no GOOGLE_MAPS_API_KEY is configured (so the
suite doesn't fail in environments where the integration is intentionally
off — the broadcast still works without it, just without the polyline).
"""
import asyncio
import json
import os

import pytest
import requests
import websockets
from bson import ObjectId
from pymongo import MongoClient

API = "http://localhost:8001"
WS = "ws://localhost:8001"
TRAINEE = ("test_trainee_iter25@test.com", "Test123!")
TRAINER = ("test_trainer_iter25@test.com", "Test123!")


def _login(email, pw):
    r = requests.post(f"{API}/api/auth/login", json={"email": email, "password": pw}, timeout=10)
    r.raise_for_status()
    return r.json()["access_token"], r.json()["user"]["id"]


@pytest.fixture(scope="module")
def ctx():
    if not os.environ.get("GOOGLE_MAPS_API_KEY"):
        pytest.skip("GOOGLE_MAPS_API_KEY not set — directions enrichment off.")
    trainee_tok, trainee_id = _login(*TRAINEE)
    trainer_tok, trainer_id = _login(*TRAINER)
    m = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = m[os.environ.get("DB_NAME", "rapidreps")]
    doc = db.sessions.find_one({"trainerId": trainer_id, "traineeId": trainee_id})
    sid = str(doc["_id"]) if doc else None
    if not sid:
        res = db.sessions.insert_one({"trainerId": trainer_id, "traineeId": trainee_id, "status": "en_route"})
        sid = str(res.inserted_id)
    # Patch coords so the Directions call has both endpoints.
    db.sessions.update_one(
        {"_id": ObjectId(sid)},
        {"$set": {
            "traineeLatitude": 37.7849, "traineeLongitude": -122.4094,
            "trainerLatitude": 37.7649, "trainerLongitude": -122.4294,
        }},
    )
    return {"trainee_tok": trainee_tok, "trainer_tok": trainer_tok, "sid": sid}


def test_broadcast_includes_route_and_eta(ctx):
    """Trainer POSTs gps-update → trainee receives frame with polyline + eta."""
    async def _run():
        url = f"{WS}/api/ws/sessions/{ctx['sid']}/track?token={ctx['trainee_tok']}"
        async with websockets.connect(url, open_timeout=10) as ws:
            r = requests.post(
                f"{API}/api/sessions/{ctx['sid']}/gps-update"
                f"?latitude=37.7700&longitude=-122.4200&accuracy=10",
                headers={"Authorization": f"Bearer {ctx['trainer_tok']}"}, timeout=15,
            )
            assert r.status_code == 200
            msg = await asyncio.wait_for(ws.recv(), timeout=10)
            data = json.loads(msg)
            assert data["type"] == "position"
            assert data["role"] == "trainer"
            assert isinstance(data.get("etaSeconds"), int)
            assert data["etaSeconds"] > 0
            assert isinstance(data.get("distanceMeters"), int)
            assert data["distanceMeters"] > 0
            assert isinstance(data.get("routePolyline"), str)
            assert len(data["routePolyline"]) > 20  # ~30 waypoints minimum
    asyncio.run(_run())
