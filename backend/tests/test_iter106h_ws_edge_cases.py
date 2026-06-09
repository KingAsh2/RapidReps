"""
iter106h — Edge-case coverage for the live session tracking WebSocket.

Complements test_iter106h_ws_tracking.py with:
  1. Bogus session_id ObjectId → handshake closed (1008/403).
  2. Reverse direction: trainer opens WS, trainee POSTs → trainer receives frame role:'trainee'.
  3. Two concurrent WS clients (trainer + trainee) BOTH receive the broadcast
     when a third actor (one of them) POSTs gps-update.
  4. Polling fallback /api/sessions/{id}/gps-track still returns the latest position.

Run:  pytest /app/backend/tests/test_iter106h_ws_edge_cases.py -v
"""
from __future__ import annotations
import asyncio
import json
import os
from typing import Tuple

import pytest
import requests
import websockets
from pymongo import MongoClient
from bson import ObjectId

API = "http://localhost:8001"
WS_API = "ws://localhost:8001"

TRAINEE = ("test_trainee_iter25@test.com", "Test123!")
TRAINER = ("test_trainer_iter25@test.com", "Test123!")
ADMIN = ("admin@rapidreps.com", "admin123")


def _login(email: str, pw: str) -> Tuple[str, str]:
    r = requests.post(f"{API}/api/auth/login", json={"email": email, "password": pw}, timeout=10)
    r.raise_for_status()
    body = r.json()
    return body["access_token"], body["user"]["id"]


def _find_or_create_session(trainer_id: str, trainee_id: str) -> str:
    m = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = m[os.environ.get("DB_NAME", "rapidreps")]
    doc = db.sessions.find_one({"trainerId": trainer_id, "traineeId": trainee_id})
    if doc:
        # Ensure it's tracking-eligible so the polling fallback returns positions
        if doc.get("status") not in ("en_route", "in_progress", "confirmed"):
            db.sessions.update_one({"_id": doc["_id"]}, {"$set": {"status": "en_route"}})
        return str(doc["_id"])
    res = db.sessions.insert_one({
        "trainerId": trainer_id, "traineeId": trainee_id,
        "status": "en_route", "sessionType": "outdoor",
    })
    return str(res.inserted_id)


@pytest.fixture(scope="module")
def ctx():
    trainee_tok, trainee_id = _login(*TRAINEE)
    trainer_tok, trainer_id = _login(*TRAINER)
    sid = _find_or_create_session(trainer_id, trainee_id)
    # Force session to en_route so /gps-track returns positions instead of {"tracking": False}
    m = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = m[os.environ.get("DB_NAME", "rapidreps")]
    db.sessions.update_one({"_id": ObjectId(sid)}, {"$set": {"status": "en_route"}})
    return {
        "trainee_tok": trainee_tok, "trainer_tok": trainer_tok,
        "trainee_id": trainee_id, "trainer_id": trainer_id,
        "sid": sid,
    }


# -----------------------------------------------------------------------------
# 1. Bogus session_id ObjectId → handshake closed.
# -----------------------------------------------------------------------------
def test_ws_rejects_bogus_session_id_format(ctx):
    """A session_id that isn't a valid 24-char ObjectId hex string is rejected."""
    async def _run():
        url = f"{WS_API}/api/ws/sessions/not-an-objectid/track?token={ctx['trainee_tok']}"
        with pytest.raises(Exception):
            async with websockets.connect(url, open_timeout=5) as ws:
                # If we managed to connect, server should close very quickly
                await asyncio.wait_for(ws.recv(), timeout=2)
    asyncio.run(_run())


def test_ws_rejects_valid_but_unknown_session_id(ctx):
    """A well-formed ObjectId that doesn't exist in the sessions collection is rejected."""
    bogus_oid = "5f1d7d6c5f1d7d6c5f1d7d6c"  # well-formed, almost certainly non-existent
    async def _run():
        url = f"{WS_API}/api/ws/sessions/{bogus_oid}/track?token={ctx['trainee_tok']}"
        with pytest.raises(Exception):
            async with websockets.connect(url, open_timeout=5) as ws:
                await asyncio.wait_for(ws.recv(), timeout=2)
    asyncio.run(_run())


# -----------------------------------------------------------------------------
# 2. Reverse direction: trainer WS receives broadcast when trainee POSTs.
# -----------------------------------------------------------------------------
def test_reverse_direction_trainer_ws_trainee_posts(ctx):
    """Trainer opens WS, trainee POSTs gps-update → trainer receives role:'trainee' frame."""
    async def _run():
        url = f"{WS_API}/api/ws/sessions/{ctx['sid']}/track?token={ctx['trainer_tok']}"
        async with websockets.connect(url, open_timeout=10) as ws:
            # Give the room registration a moment
            await asyncio.sleep(0.2)
            r = requests.post(
                f"{API}/api/sessions/{ctx['sid']}/gps-update"
                f"?latitude=40.7128&longitude=-74.0060&accuracy=8",
                headers={"Authorization": f"Bearer {ctx['trainee_tok']}"}, timeout=10,
            )
            assert r.status_code == 200, r.text
            msg = await asyncio.wait_for(ws.recv(), timeout=5)
            data = json.loads(msg)
            assert data.get("type") == "position"
            assert data.get("role") == "trainee", f"expected role=trainee, got {data}"
            assert data.get("userId") == ctx["trainee_id"]
            assert abs(data["latitude"] - 40.7128) < 0.001
            assert abs(data["longitude"] - (-74.0060)) < 0.001
            assert "timestamp" in data
    asyncio.run(_run())


# -----------------------------------------------------------------------------
# 3. Two concurrent clients both receive the broadcast.
# -----------------------------------------------------------------------------
def test_two_concurrent_clients_both_receive_broadcast(ctx):
    """Trainer AND trainee each open a WS. When trainer POSTs gps-update, both
    sockets should receive the broadcast frame within 5 s."""
    async def _run():
        url_trainee = f"{WS_API}/api/ws/sessions/{ctx['sid']}/track?token={ctx['trainee_tok']}"
        url_trainer = f"{WS_API}/api/ws/sessions/{ctx['sid']}/track?token={ctx['trainer_tok']}"
        async with websockets.connect(url_trainee, open_timeout=10) as ws_tee, \
                   websockets.connect(url_trainer, open_timeout=10) as ws_ter:
            await asyncio.sleep(0.3)  # let both join the room
            r = requests.post(
                f"{API}/api/sessions/{ctx['sid']}/gps-update"
                f"?latitude=34.0522&longitude=-118.2437&accuracy=12",
                headers={"Authorization": f"Bearer {ctx['trainer_tok']}"}, timeout=10,
            )
            assert r.status_code == 200, r.text

            msgs = await asyncio.gather(
                asyncio.wait_for(ws_tee.recv(), timeout=5),
                asyncio.wait_for(ws_ter.recv(), timeout=5),
            )
            for raw in msgs:
                d = json.loads(raw)
                assert d.get("type") == "position"
                assert d.get("role") == "trainer"
                assert abs(d["latitude"] - 34.0522) < 0.001
                assert abs(d["longitude"] - (-118.2437)) < 0.001
                assert d.get("userId") == ctx["trainer_id"]
    asyncio.run(_run())


# -----------------------------------------------------------------------------
# 4. Polling fallback /api/sessions/{id}/gps-track still returns the latest position.
# -----------------------------------------------------------------------------
def test_polling_fallback_returns_latest_position(ctx):
    """After a gps-update is POSTed, GET /gps-track must return the newest lat/lng
    for the role that posted — so non-WS clients keep working."""
    # POST a fresh, distinctive position
    lat, lng, acc = 47.6062, -122.3321, 7
    r = requests.post(
        f"{API}/api/sessions/{ctx['sid']}/gps-update"
        f"?latitude={lat}&longitude={lng}&accuracy={acc}",
        headers={"Authorization": f"Bearer {ctx['trainer_tok']}"}, timeout=10,
    )
    assert r.status_code == 200, r.text

    # Give the DB a beat
    import time as _t
    _t.sleep(0.3)

    # Either party may read; use trainee to confirm cross-party visibility.
    g = requests.get(
        f"{API}/api/sessions/{ctx['sid']}/gps-track",
        headers={"Authorization": f"Bearer {ctx['trainee_tok']}"}, timeout=10,
    )
    assert g.status_code == 200, g.text
    body = g.json()
    # If session is en_route, polling endpoint returns trainer/trainee dicts.
    assert body.get("tracking") is not False, f"tracking unexpectedly disabled: {body}"
    trainer_pos = body.get("trainer") or body.get("trainerPosition")
    assert trainer_pos is not None, f"trainer position missing in {body}"
    assert abs(trainer_pos["latitude"] - lat) < 0.001
    assert abs(trainer_pos["longitude"] - lng) < 0.001
