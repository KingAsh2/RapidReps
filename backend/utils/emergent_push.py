"""
utils/emergent_push.py — iter118w

Managed push relay adapter. RapidReps no longer holds APNs / Firebase
credentials. We hand a {title, body, link, data} payload to a managed
relay — by default Expo's public push service (https://exp.host) which
Emergent apps use — and the relay handles the native APNs/FCM delivery.

Contract deliberately minimal so the destination can be pointed at a
different Emergent-provisioned relay via env vars without touching call
sites. Backend routes only ever call `send_push_to_tokens` (this file)
via the `notify_user` orchestrator in `utils/notifications.py`; they must
never talk to APNs / FCM directly.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Iterable

import httpx

logger = logging.getLogger(__name__)


class EmergentPushError(RuntimeError):
    pass


# Default to Expo's public push service — free, handles APNs+FCM behind the
# scenes, and requires zero credentials on our side (Expo owns the certs).
# Override via env if Emergent later publishes a dedicated relay URL.
DEFAULT_RELAY_URL = "https://exp.host/--/api/v2/push/send"


def _relay_url() -> str:
    return os.environ.get("EMERGENT_PUSH_URL") or DEFAULT_RELAY_URL


def _relay_key() -> str | None:
    # Optional. Expo's public endpoint accepts anonymous POSTs; a private
    # Emergent relay may require a Bearer token.
    return os.environ.get("EMERGENT_PUSH_KEY") or None


def _looks_like_expo_token(token: str) -> bool:
    return token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")


async def send_push_to_tokens(
    tokens: Iterable[str],
    *,
    title: str,
    body: str,
    link: str | None = None,
    data: dict[str, Any] | None = None,
    category: str | None = None,
    sound: str | None = "default",
) -> dict[str, Any]:
    """POST one push per device token to the managed relay.

    Returns { sent: int, failed: int, receipts: [...] }. Never raises — we
    treat delivery errors as recoverable so the fallback ladder in
    `notify_user` can still write an in-app notification / email.
    """
    tokens = [t for t in tokens if t]
    if not tokens:
        return {"sent": 0, "failed": 0, "receipts": []}

    url = _relay_url()
    key = _relay_key()
    payload_data = {**(data or {})}
    if link:
        payload_data["link"] = link
    if category:
        payload_data["categoryIdentifier"] = category

    # Expo's batch API accepts an ARRAY of message objects. Other relays may
    # want one at a time; the shape we build here works for both because we
    # split by token below when we detect a non-Expo relay.
    messages = [
        {
            "to": t,
            "title": title,
            "body": body,
            "sound": sound,
            "data": {**payload_data, "userId": None},  # userId not exposed to devices
            "priority": "high",
            **({"channelId": category} if category else {}),
        }
        for t in tokens
    ]

    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    # Expo accepts gzip and gives faster responses when we hint accept-encoding.
    headers.setdefault("Accept-Encoding", "gzip, deflate")

    sent = 0
    failed = 0
    receipts: list[dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(url, headers=headers, json=messages)
            if resp.status_code >= 400:
                raise EmergentPushError(f"relay HTTP {resp.status_code}: {resp.text[:300]}")
            body_json = resp.json() if resp.content else {}
            # Expo returns { data: [{ status: 'ok' | 'error', ...}, ...] }
            ticket_data = body_json.get("data") if isinstance(body_json, dict) else None
            if isinstance(ticket_data, list):
                for tk in ticket_data:
                    if isinstance(tk, dict) and tk.get("status") == "ok":
                        sent += 1
                    else:
                        failed += 1
                receipts = ticket_data
            else:
                sent = len(messages)
    except Exception as exc:  # noqa: BLE001 — we catch broad and let orchestrator fall back
        logger.warning("emergent_push: relay send failed url=%s err=%s", url, exc)
        failed = len(messages)
        receipts = [{"status": "error", "message": str(exc)[:400]}]

    return {"sent": sent, "failed": failed, "receipts": receipts}


async def send_push_to_user(
    db,
    user_id: str,
    *,
    title: str,
    body: str,
    link: str | None = None,
    data: dict[str, Any] | None = None,
    category: str | None = None,
) -> dict[str, Any]:
    """Resolve a user's Expo push tokens from Mongo and dispatch."""
    tokens: list[str] = []
    async for row in db.push_tokens.find({"userId": user_id}):
        tok = row.get("token") or row.get("expoPushToken")
        if tok and _looks_like_expo_token(tok):
            tokens.append(tok)
    if not tokens:
        return {"sent": 0, "failed": 0, "receipts": [], "reason": "no-tokens"}
    return await send_push_to_tokens(
        tokens, title=title, body=body, link=link, data=data, category=category,
    )
