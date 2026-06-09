"""
iter106h — Regression test for the live session tracking WebSocket.

Covers:
  1. Authorised participant can open ws://.../api/ws/sessions/{id}/track?token=...
  2. POST /api/sessions/{id}/gps-update fans out to connected WS peers.
  3. Junk token closes with 1008 / HTTP 403.
  4. Non-participant (e.g. admin) is rejected.

Run with:  pytest /app/backend/tests/test_iter106h_ws_tracking.py -v
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


def _find_session(trainer_id: str, trainee_id: str) -> str:
    m = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = m[os.environ.get("DB_NAME", "rapidreps")]
    doc = db.sessions.find_one({"trainerId": trainer_id, "traineeId": trainee_id})
    if doc:
        return str(doc["_id"])
    # fallback: create a tracking-eligible stub
    res = db.sessions.insert_one({
        "trainerId": trainer_id, "traineeId": trainee_id,
        "status": "en_route", "sessionType": "outdoor",
    })
    return str(res.inserted_id)


@pytest.fixture(scope="module")
def ctx():
    trainee_tok, trainee_id = _login(*TRAINEE)
    trainer_tok, trainer_id = _login(*TRAINER)
    sid = _find_session(trainer_id, trainee_id)
    return {
        "trainee_tok": trainee_tok, "trainer_tok": trainer_tok,
        "trainee_id": trainee_id, "trainer_id": trainer_id,
        "sid": sid,
    }


def test_ws_connect_and_broadcast(ctx):
    """Trainee connects → trainer POSTs gps-update → trainee receives broadcast frame."""
    async def _run():
        url = f"{WS_API}/api/ws/sessions/{ctx['sid']}/track?token={ctx['trainee_tok']}"
        async with websockets.connect(url, open_timeout=10) as ws:
            r = requests.post(
                f"{API}/api/sessions/{ctx['sid']}/gps-update"
                f"?latitude=37.7700&longitude=-122.4100&accuracy=10",
                headers={"Authorization": f"Bearer {ctx['trainer_tok']}"}, timeout=10,
            )
            assert r.status_code == 200, r.text
            msg = await asyncio.wait_for(ws.recv(), timeout=5)
            data = json.loads(msg)
            assert data.get("type") == "position"
            assert data.get("role") == "trainer"
            assert abs(data["latitude"] - 37.77) < 0.001
            assert abs(data["longitude"] - (-122.41)) < 0.001
    asyncio.run(_run())


def test_ws_rejects_invalid_token(ctx):
    async def _run():
        url = f"{WS_API}/api/ws/sessions/{ctx['sid']}/track?token=garbage"
        with pytest.raises(Exception):
            async with websockets.connect(url, open_timeout=5):
                pass
    asyncio.run(_run())


def test_ws_rejects_missing_token(ctx):
    async def _run():
        url = f"{WS_API}/api/ws/sessions/{ctx['sid']}/track"
        with pytest.raises(Exception):
            async with websockets.connect(url, open_timeout=5):
                pass
    asyncio.run(_run())


def test_ws_rejects_non_participant(ctx):
    """Admin is not on the session → handshake closed."""
    try:
        admin_tok, _ = _login(*ADMIN)
    except Exception:
        pytest.skip("admin account not available")

    async def _run():
        url = f"{WS_API}/api/ws/sessions/{ctx['sid']}/track?token={admin_tok}"
        with pytest.raises(Exception):
            async with websockets.connect(url, open_timeout=5):
                pass
    asyncio.run(_run())
