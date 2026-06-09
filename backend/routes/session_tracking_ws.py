"""
session_tracking_ws.py — iter106h.

WebSocket-based live position streaming for the EnRouteMap. Replaces the
8-second polling fallback with sub-second push updates between the trainer
and trainee while a session is en-route or in progress.

Architecture:
  • One "room" per session_id; clients connect to /api/ws/sessions/{id}/track
    with `?token=<jwt>` for auth.
  • When a party POSTs to the existing /api/sessions/{id}/gps-update endpoint
    the route ALSO broadcasts the new position to the room so the other party
    sees it in real-time.
  • Connection survives the standard EnRouteMap lifetime; the frontend falls
    back to the polling endpoint when the socket is closed.

Auth: re-uses the same JWT decoder used by every other route (jwt.decode with
the SECRET_KEY); we only allow the trainee or trainer who owns the session.
"""
from __future__ import annotations
import asyncio
import json
import logging
from typing import Dict, Set
from bson import ObjectId
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
import jwt
import os
from deps import db, decode_token

logger = logging.getLogger(__name__)
router = APIRouter()

# session_id → set of live WebSocket connections
_rooms: Dict[str, Set[WebSocket]] = {}
_rooms_lock = asyncio.Lock()


async def _join(session_id: str, ws: WebSocket) -> None:
    async with _rooms_lock:
        _rooms.setdefault(session_id, set()).add(ws)


async def _leave(session_id: str, ws: WebSocket) -> None:
    async with _rooms_lock:
        peers = _rooms.get(session_id)
        if not peers:
            return
        peers.discard(ws)
        if not peers:
            _rooms.pop(session_id, None)


async def broadcast_position(session_id: str, payload: dict) -> None:
    """Fan-out the new position to every connected client of this session.

    Called by the existing POST /sessions/{id}/gps-update handler after it
    writes to the DB — so non-WS clients (polling) still see the update on
    their next poll and WS clients see it immediately.
    """
    peers = list(_rooms.get(session_id, set()))
    if not peers:
        return
    msg = json.dumps({'type': 'position', **payload})
    dead: list[WebSocket] = []
    for ws in peers:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        await _leave(session_id, ws)


@router.websocket("/ws/sessions/{session_id}/track")
async def session_track_ws(websocket: WebSocket, session_id: str):
    # 1. Auth — JWT in the `token` query param
    token = websocket.query_params.get('token')
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    try:
        payload = decode_token(token)
        user_id = payload.get('user_id') or payload.get('sub')
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 2. Confirm the user is actually a party on this session
    try:
        session_doc = await db.sessions.find_one({'_id': ObjectId(session_id)})
    except Exception:
        session_doc = None
    if not session_doc:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    if user_id not in (session_doc.get('trainerId'), session_doc.get('traineeId')):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 3. Accept + join the room
    await websocket.accept()
    await _join(session_id, websocket)
    try:
        # The protocol is one-way (server pushes positions). We still consume
        # any inbound messages so the socket stays alive and disconnect events
        # propagate promptly.
        while True:
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
            except Exception:
                break
    finally:
        await _leave(session_id, websocket)
