"""Notification & push-token routes. Extracted from server.py (Iteration 85)."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from bson import ObjectId

from deps import db, get_current_user

router = APIRouter(prefix="/api")


class PushTokenRegister(BaseModel):
    token: str
    deviceId: Optional[str] = None


@router.post("/push-tokens/register")
async def register_push_token(data: PushTokenRegister, current_user: dict = Depends(get_current_user)):
    """Register a push notification token for the current user (one row per token per user)."""
    user_id = str(current_user['_id'])
    await db.push_tokens.update_one(
        {'userId': user_id, 'token': data.token},
        {'$set': {
            'userId': user_id,
            'token': data.token,
            'deviceId': data.deviceId,
            'updatedAt': datetime.utcnow(),
        }},
        upsert=True,
    )
    return {"success": True, "message": "Push token registered"}


@router.delete("/push-tokens/unregister")
async def unregister_push_token(data: PushTokenRegister, current_user: dict = Depends(get_current_user)):
    """Unregister a push notification token (logout flow)."""
    user_id = str(current_user['_id'])
    await db.push_tokens.delete_one({'userId': user_id, 'token': data.token})
    return {"success": True, "message": "Push token unregistered"}


@router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    """Get notification history. Injects a deep-link for virtual session requests."""
    user_id = str(current_user['_id'])
    notifications_raw = await db.notifications.find(
        {'userId': user_id}
    ).sort('createdAt', -1).to_list(50)
    notifications = []
    for n in notifications_raw:
        n_id = str(n.pop('_id'))
        n['id'] = n_id
        if n.get('type') == 'virtual_session_request':
            metadata = n.get('metadata') or {}
            trainee_id = metadata.get('traineeId') or n.get('senderUserId')
            if trainee_id:
                n['deepLink'] = f"/trainer/trainee-detail?traineeId={trainee_id}&showAcceptCTA=true"
        notifications.append(n)
    return {"notifications": notifications}


@router.post("/notifications/mark-read")
async def mark_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark every unread notification for the current user as read."""
    user_id = str(current_user['_id'])
    await db.notifications.update_many(
        {'userId': user_id, 'read': False},
        {'$set': {'read': True}},
    )
    return {"success": True}


@router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a single notification (swipe-to-delete)."""
    user_id = str(current_user['_id'])
    try:
        oid = ObjectId(notification_id)
    except Exception:
        raise HTTPException(400, "Invalid notification id")
    result = await db.notifications.delete_one({'_id': oid, 'userId': user_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Notification not found")
    return {"success": True}


# Default notification preference categories
NOTIFICATION_TYPES = [
    'session_requested', 'session_accepted', 'session_declined',
    'session_ended', 'session_reminder', 'rate_reminder',
    'payment_released', 'new_message', 'streak_warning', 'boost_expiring',
    # Smart matching engine notification types
    'virtual_request', 'virtual_matched', 'virtual_taken',
    'missed_acceptance', 'late_warning', 'session_started',
]


class NotificationPreferences(BaseModel):
    pushEnabled: bool = True
    session_requested: bool = True
    session_accepted: bool = True
    session_declined: bool = True
    session_ended: bool = True
    session_reminder: bool = True
    rate_reminder: bool = True
    payment_released: bool = True
    new_message: bool = True
    streak_warning: bool = True
    boost_expiring: bool = True
    virtual_request: bool = True
    virtual_matched: bool = True
    virtual_taken: bool = True
    missed_acceptance: bool = True
    late_warning: bool = True
    session_started: bool = True


@router.get("/notification-preferences")
async def get_notification_preferences(current_user: dict = Depends(get_current_user)):
    """Return the user's notification preference doc (or defaults if none stored yet)."""
    user_id = str(current_user['_id'])
    prefs = await db.notification_preferences.find_one({'userId': user_id}, {'_id': 0})
    if not prefs:
        return {k: True for k in ['pushEnabled'] + NOTIFICATION_TYPES}
    prefs.pop('userId', None)
    return prefs


@router.put("/notification-preferences")
async def update_notification_preferences(
    prefs: NotificationPreferences,
    current_user: dict = Depends(get_current_user),
):
    """Upsert the user's notification preferences."""
    user_id = str(current_user['_id'])
    prefs_dict = prefs.dict()
    prefs_dict['userId'] = user_id
    prefs_dict['updatedAt'] = datetime.utcnow()
    await db.notification_preferences.update_one(
        {'userId': user_id},
        {'$set': prefs_dict},
        upsert=True,
    )
    return {"success": True, "message": "Notification preferences updated"}
