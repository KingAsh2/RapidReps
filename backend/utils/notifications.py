"""
utils/notifications.py — iter118w

Notification orchestrator. Every route/service in the app calls this one
function — `notify_user` — and never talks to APNs / FCM / Expo directly.

Fallback ladder (per user product decision, iter118w):
  1. Try the managed push relay (Expo / Emergent).
  2. If the push relay is unavailable OR the user has no registered device
     tokens, write a durable in-app notification row so the user still
     sees the message in-app.
  3. For booking-category messages, ALSO enqueue an email digest so a
     trainee/trainer with push off never misses a session change.
     (Uses the existing email_service; if unavailable, silent no-op.)

Notification categories mirror the trainee/trainer preferences screen
(`notification-preferences.tsx`): bookings, chat, promos, streaks, safety.
`safety` is always considered opt-in-required-non-optional — SOS bypasses
category preference muting.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Iterable

from .emergent_push import send_push_to_user

logger = logging.getLogger(__name__)

CATEGORIES = ("bookings", "chat", "promos", "streaks", "safety", "system")


async def _write_in_app_notification(db, user_id: str, category: str, title: str, body: str,
                                     link: str | None, data: dict[str, Any] | None,
                                     push_error: str | None) -> None:
    try:
        await db.notifications.insert_one({
            "userId": user_id,
            "category": category,
            "title": title,
            "body": body,
            "message": body,
            "link": link,
            "data": data or {},
            "read": False,
            "isRead": False,
            "pushError": push_error,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        })
    except Exception:
        logger.exception("notifications: in-app write failed user=%s", user_id)


async def notify_user(
    db,
    user_id: str,
    *,
    category: str,
    title: str,
    body: str,
    link: str | None = None,
    data: dict[str, Any] | None = None,
    email_fallback: bool | None = None,
) -> dict[str, Any]:
    """Deliver a notification to a single user through the fallback ladder.

    `link` should be an app-internal deep link like `/trainee/session-detail?sessionId=X`.
    """
    if category not in CATEGORIES:
        logger.warning("notify_user: unknown category=%s falling back to 'system'", category)
        category = "system"

    payload_data = {**(data or {}), "category": category}
    if link:
        payload_data["link"] = link

    # 1) Push via managed relay.
    push_result = await send_push_to_user(
        db, user_id, title=title, body=body, link=link, data=payload_data, category=category,
    )
    push_ok = push_result.get("sent", 0) > 0 and push_result.get("failed", 0) == 0

    # 2) Always write an in-app row so the user has a durable record — mirrors
    # HonestPays behaviour. The in-app tab is the "second inbox" so users who
    # dismiss push banners still see the message. Cheap Mongo insert.
    await _write_in_app_notification(
        db, user_id, category, title, body, link, payload_data,
        push_error=None if push_ok else str(push_result.get("receipts") or push_result.get("reason") or "unknown")[:300],
    )

    # 3) Email digest for booking-critical events when push fails, so a
    # session cancellation / confirmation is never a dead-end silent event.
    should_email = email_fallback if email_fallback is not None else (
        category == "bookings" and not push_ok
    )
    if should_email:
        try:
            # Lazy import — email_service may not be present in every env.
            from email_service import send_transactional_email  # type: ignore
            user = await db.users.find_one({"_id": _oid(user_id)})
            if user and user.get("email"):
                await send_transactional_email(
                    to_email=user["email"],
                    subject=title,
                    plain_body=body + (f"\n\nOpen: {link}" if link else ""),
                )
        except Exception:
            logger.info("notifications: email fallback skipped (email_service unavailable or errored)")

    return {"push": push_result, "inAppWritten": True}


async def notify_users(
    db, user_ids: Iterable[str], **kwargs: Any,
) -> dict[str, Any]:
    """Fan-out notify_user across a list of user ids (admins, followers, etc.)."""
    sent = 0
    for uid in user_ids:
        try:
            await notify_user(db, str(uid), **kwargs)
            sent += 1
        except Exception:
            logger.exception("notify_users: single delivery failed user=%s", uid)
    return {"sent": sent, "total": sum(1 for _ in user_ids) if not sent else sent}


async def notify_admins(db, **kwargs: Any) -> dict[str, Any]:
    """Deliver a notification to every admin user. Used e.g. for new-signup pings."""
    ids: list[str] = []
    async for u in db.users.find({"roles": "admin"}, {"_id": 1}):
        ids.append(str(u["_id"]))
    return await notify_users(db, ids, **kwargs)


def _oid(value: Any):
    from bson import ObjectId
    try:
        return ObjectId(value) if not isinstance(value, ObjectId) else value
    except Exception:
        return value
