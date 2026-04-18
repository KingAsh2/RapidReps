"""Subscription routes: Monthly plans with auto-scheduling and 80/20 split."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import random

from deps import db, get_current_user, serialize_doc, send_push_notification
from models import PricingRules, SessionStatus, SessionType

router = APIRouter(prefix="/api")


# ============================================================================
# MODELS
# ============================================================================

class SubscriptionCreate(BaseModel):
    trainerId: str
    sessionsPerWeek: int  # 1-7
    preferredDays: List[str] = []  # ["monday", "wednesday", "friday"]
    preferredTimeSlot: str = "morning"  # morning, afternoon, evening
    sessionType: str = SessionType.OUTDOOR
    durationMinutes: int = 60
    locationNameOrAddress: Optional[str] = None
    notes: Optional[str] = None


class SubscriptionUpdate(BaseModel):
    sessionsPerWeek: Optional[int] = None
    preferredDays: Optional[List[str]] = None
    preferredTimeSlot: Optional[str] = None
    sessionType: Optional[str] = None
    durationMinutes: Optional[int] = None
    status: Optional[str] = None


# ============================================================================
# SUBSCRIPTION ENDPOINTS
# ============================================================================

@router.post("/subscriptions")
async def create_subscription(sub: SubscriptionCreate, current_user: dict = Depends(get_current_user)):
    """Trainee creates a subscription with a trainer. Trainer sets their price, platform takes 20%."""
    trainee_id = str(current_user['_id'])

    if sub.sessionsPerWeek < 1 or sub.sessionsPerWeek > 7:
        raise HTTPException(400, "Sessions per week must be between 1 and 7")

    # Get trainer profile for pricing
    trainer_profile = await db.trainer_profiles.find_one({'userId': sub.trainerId})
    if not trainer_profile:
        raise HTTPException(404, "Trainer not found")

    # Trainer's per-session rate (cents)
    trainer_rate_cents = trainer_profile.get('sessionRateCents', 5000)  # default $50
    platform_fee_cents = int(trainer_rate_cents * PricingRules.PLATFORM_REVENUE_PERCENT / 100)
    total_per_session_cents = trainer_rate_cents + platform_fee_cents
    weekly_total_cents = total_per_session_cents * sub.sessionsPerWeek
    monthly_estimate_cents = weekly_total_cents * 4

    # Check for existing active subscription with same trainer
    existing = await db.subscriptions.find_one({
        'traineeId': trainee_id,
        'trainerId': sub.trainerId,
        'status': {'$in': ['active', 'pending']}
    })
    if existing:
        raise HTTPException(400, "You already have an active subscription with this trainer")

    subscription_doc = {
        'traineeId': trainee_id,
        'trainerId': sub.trainerId,
        'sessionsPerWeek': sub.sessionsPerWeek,
        'preferredDays': sub.preferredDays,
        'preferredTimeSlot': sub.preferredTimeSlot,
        'sessionType': sub.sessionType,
        'durationMinutes': sub.durationMinutes,
        'locationNameOrAddress': sub.locationNameOrAddress,
        'notes': sub.notes,
        'trainerRateCents': trainer_rate_cents,
        'platformFeeCents': platform_fee_cents,
        'totalPerSessionCents': total_per_session_cents,
        'weeklyTotalCents': weekly_total_cents,
        'monthlyEstimateCents': monthly_estimate_cents,
        'platformFeePercent': PricingRules.PLATFORM_REVENUE_PERCENT,
        'status': 'pending',  # pending -> active -> paused -> cancelled
        'autoScheduleEnabled': True,
        'sessionsCompleted': 0,
        'sessionsScheduled': 0,
        'currentWeekSessions': 0,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow(),
    }

    result = await db.subscriptions.insert_one(subscription_doc)

    # Notify trainer
    await send_push_notification(
        sub.trainerId,
        "New Subscription Request",
        f"A trainee wants {sub.sessionsPerWeek}x/week sessions with you!",
        {'type': 'subscription_request', 'subscriptionId': str(result.inserted_id)}
    )

    subscription_doc.pop('_id', None)
    return {
        "success": True,
        "subscriptionId": str(result.inserted_id),
        "pricing": {
            "trainerRatePerSession": trainer_rate_cents,
            "platformFeePerSession": platform_fee_cents,
            "totalPerSession": total_per_session_cents,
            "weeklyTotal": weekly_total_cents,
            "monthlyEstimate": monthly_estimate_cents,
        },
        **subscription_doc
    }


@router.get("/subscriptions")
async def get_my_subscriptions(current_user: dict = Depends(get_current_user)):
    """Get all subscriptions for the current user (trainee or trainer)."""
    user_id = str(current_user['_id'])

    subs = await db.subscriptions.find({
        '$or': [{'traineeId': user_id}, {'trainerId': user_id}]
    }).sort('createdAt', -1).to_list(None)

    results = []
    for s in subs:
        s_id = str(s.pop('_id'))
        # Get the other party's info
        other_id = s['trainerId'] if s['traineeId'] == user_id else s['traineeId']
        other_user = await db.users.find_one({'_id': ObjectId(other_id)}, {'fullName': 1, 'email': 1, 'profilePhoto': 1})
        s['id'] = s_id
        s['otherParty'] = {
            'id': other_id,
            'fullName': other_user.get('fullName', '') if other_user else '',
            'profilePhoto': other_user.get('profilePhoto', '') if other_user else '',
        }
        s['role'] = 'trainee' if s['traineeId'] == user_id else 'trainer'
        results.append(s)

    return results


@router.get("/subscriptions/{subscription_id}")
async def get_subscription(subscription_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific subscription details."""
    user_id = str(current_user['_id'])
    sub = await db.subscriptions.find_one({'_id': ObjectId(subscription_id)})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if sub['traineeId'] != user_id and sub['trainerId'] != user_id:
        raise HTTPException(403, "Not authorized")

    sub['id'] = str(sub.pop('_id'))
    return sub


@router.put("/subscriptions/{subscription_id}/accept")
async def trainer_accept_subscription(subscription_id: str, current_user: dict = Depends(get_current_user)):
    """Trainer accepts a subscription request, activating auto-scheduling."""
    user_id = str(current_user['_id'])
    sub = await db.subscriptions.find_one({'_id': ObjectId(subscription_id)})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if sub['trainerId'] != user_id:
        raise HTTPException(403, "Only the trainer can accept")
    if sub['status'] != 'pending':
        raise HTTPException(400, f"Cannot accept subscription in '{sub['status']}' status")

    await db.subscriptions.update_one(
        {'_id': ObjectId(subscription_id)},
        {'$set': {'status': 'active', 'activatedAt': datetime.utcnow(), 'updatedAt': datetime.utcnow()}}
    )

    # Auto-schedule first week
    await auto_schedule_week(subscription_id)

    await send_push_notification(
        sub['traineeId'],
        "Subscription Activated!",
        "Your trainer accepted your subscription. Sessions are being scheduled.",
        {'type': 'subscription_activated', 'subscriptionId': subscription_id}
    )

    return {"success": True, "message": "Subscription activated and first week scheduled"}


@router.put("/subscriptions/{subscription_id}/decline")
async def trainer_decline_subscription(subscription_id: str, current_user: dict = Depends(get_current_user)):
    """Trainer declines a subscription request."""
    user_id = str(current_user['_id'])
    sub = await db.subscriptions.find_one({'_id': ObjectId(subscription_id)})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if sub['trainerId'] != user_id:
        raise HTTPException(403, "Only the trainer can decline")

    await db.subscriptions.update_one(
        {'_id': ObjectId(subscription_id)},
        {'$set': {'status': 'declined', 'updatedAt': datetime.utcnow()}}
    )

    await send_push_notification(
        sub['traineeId'],
        "Subscription Declined",
        "Your trainer was unable to accept your subscription request.",
        {'type': 'subscription_declined', 'subscriptionId': subscription_id}
    )

    return {"success": True, "message": "Subscription declined"}


@router.put("/subscriptions/{subscription_id}/pause")
async def pause_subscription(subscription_id: str, current_user: dict = Depends(get_current_user)):
    """Trainee or trainer pauses a subscription (no new sessions scheduled)."""
    user_id = str(current_user['_id'])
    sub = await db.subscriptions.find_one({'_id': ObjectId(subscription_id)})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if sub['traineeId'] != user_id and sub['trainerId'] != user_id:
        raise HTTPException(403, "Not authorized")
    if sub['status'] != 'active':
        raise HTTPException(400, "Can only pause active subscriptions")

    await db.subscriptions.update_one(
        {'_id': ObjectId(subscription_id)},
        {'$set': {'status': 'paused', 'pausedAt': datetime.utcnow(), 'updatedAt': datetime.utcnow()}}
    )

    return {"success": True, "message": "Subscription paused"}


@router.put("/subscriptions/{subscription_id}/resume")
async def resume_subscription(subscription_id: str, current_user: dict = Depends(get_current_user)):
    """Resume a paused subscription."""
    user_id = str(current_user['_id'])
    sub = await db.subscriptions.find_one({'_id': ObjectId(subscription_id)})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if sub['traineeId'] != user_id and sub['trainerId'] != user_id:
        raise HTTPException(403, "Not authorized")
    if sub['status'] != 'paused':
        raise HTTPException(400, "Can only resume paused subscriptions")

    await db.subscriptions.update_one(
        {'_id': ObjectId(subscription_id)},
        {'$set': {'status': 'active', 'updatedAt': datetime.utcnow()}}
    )

    await auto_schedule_week(subscription_id)
    return {"success": True, "message": "Subscription resumed and sessions scheduled"}


@router.put("/subscriptions/{subscription_id}/cancel")
async def cancel_subscription(subscription_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a subscription permanently."""
    user_id = str(current_user['_id'])
    sub = await db.subscriptions.find_one({'_id': ObjectId(subscription_id)})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if sub['traineeId'] != user_id and sub['trainerId'] != user_id:
        raise HTTPException(403, "Not authorized")

    await db.subscriptions.update_one(
        {'_id': ObjectId(subscription_id)},
        {'$set': {'status': 'cancelled', 'cancelledAt': datetime.utcnow(), 'updatedAt': datetime.utcnow()}}
    )

    # Cancel any future scheduled sessions from this subscription
    await db.sessions.update_many(
        {'subscriptionId': subscription_id, 'status': SessionStatus.CONFIRMED, 'sessionDateTimeStart': {'$gt': datetime.utcnow()}},
        {'$set': {'status': SessionStatus.CANCELLED, 'cancellationReason': 'Subscription cancelled'}}
    )

    return {"success": True, "message": "Subscription cancelled"}


@router.post("/subscriptions/{subscription_id}/schedule-week")
async def trigger_schedule_week(subscription_id: str, current_user: dict = Depends(get_current_user)):
    """Manually trigger scheduling for next week."""
    user_id = str(current_user['_id'])
    sub = await db.subscriptions.find_one({'_id': ObjectId(subscription_id)})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if sub['trainerId'] != user_id:
        raise HTTPException(403, "Only trainer can trigger scheduling")
    if sub['status'] != 'active':
        raise HTTPException(400, "Subscription must be active")

    scheduled = await auto_schedule_week(subscription_id)
    return {"success": True, "sessionsScheduled": scheduled}


# ============================================================================
# AUTO-SCHEDULING LOGIC
# ============================================================================

TIME_SLOTS = {
    'morning': (8, 11),
    'afternoon': (12, 16),
    'evening': (17, 20),
}

DAY_MAP = {
    'monday': 0, 'tuesday': 1, 'wednesday': 2,
    'thursday': 3, 'friday': 4, 'saturday': 5, 'sunday': 6
}


async def auto_schedule_week(subscription_id: str) -> int:
    """Auto-schedule sessions for the upcoming week based on subscription preferences."""
    sub = await db.subscriptions.find_one({'_id': ObjectId(subscription_id)})
    if not sub or sub['status'] != 'active':
        return 0

    trainer_id = sub['trainerId']
    trainee_id = sub['traineeId']
    sessions_needed = sub['sessionsPerWeek']
    preferred_days = sub.get('preferredDays', [])
    time_slot = sub.get('preferredTimeSlot', 'morning')
    duration = sub.get('durationMinutes', 60)

    # Get next Monday as start of scheduling window
    today = datetime.utcnow()
    days_until_monday = (7 - today.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    next_monday = today.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=days_until_monday)

    # Get trainer's existing sessions for the week to avoid conflicts
    week_end = next_monday + timedelta(days=7)
    existing_sessions = await db.sessions.find({
        'trainerId': trainer_id,
        'status': {'$in': [SessionStatus.CONFIRMED, SessionStatus.REQUESTED]},
        'sessionDateTimeStart': {'$gte': next_monday, '$lt': week_end}
    }).to_list(None)

    booked_times = set()
    for s in existing_sessions:
        start = s['sessionDateTimeStart']
        booked_times.add((start.weekday(), start.hour))

    # Determine which days to schedule
    target_days = []
    if preferred_days:
        for day_name in preferred_days:
            if day_name.lower() in DAY_MAP:
                target_days.append(DAY_MAP[day_name.lower()])
    
    # If not enough preferred days, fill with available days
    all_days = list(range(7))
    random.shuffle(all_days)
    while len(target_days) < sessions_needed:
        for d in all_days:
            if d not in target_days:
                target_days.append(d)
                if len(target_days) >= sessions_needed:
                    break

    target_days = target_days[:sessions_needed]

    # Get time range for preferred slot
    start_hour, end_hour = TIME_SLOTS.get(time_slot, (8, 20))

    sessions_created = 0
    for day_offset in target_days:
        session_date = next_monday + timedelta(days=day_offset)

        # Find available hour in the time slot
        scheduled = False
        for hour in range(start_hour, end_hour):
            if (day_offset, hour) not in booked_times:
                session_start = session_date.replace(hour=hour, minute=0, second=0)

                # Create the session
                session_doc = {
                    'traineeId': trainee_id,
                    'trainerId': trainer_id,
                    'subscriptionId': subscription_id,
                    'status': SessionStatus.CONFIRMED,
                    'sessionDateTimeStart': session_start,
                    'sessionDateTimeEnd': session_start + timedelta(minutes=duration),
                    'durationMinutes': duration,
                    'sessionType': sub.get('sessionType', SessionType.OUTDOOR),
                    'locationType': sub.get('sessionType', 'outdoor'),
                    'locationNameOrAddress': sub.get('locationNameOrAddress', ''),
                    'baseSessionPriceCents': sub['trainerRateCents'],
                    'platformFeeCents': sub['platformFeeCents'],
                    'platformFeePercent': PricingRules.PLATFORM_REVENUE_PERCENT,
                    'trainerEarningsCents': sub['trainerRateCents'],
                    'finalSessionPriceCents': sub['totalPerSessionCents'],
                    'isSubscriptionSession': True,
                    'gpsCheckinRequired': True,
                    'gpsCheckinRadiusMiles': 5,  # default, trainer can change
                    'createdAt': datetime.utcnow(),
                }

                await db.sessions.insert_one(session_doc)
                booked_times.add((day_offset, hour))
                sessions_created += 1
                scheduled = True
                break

        if not scheduled:
            # All slots taken in preferred time, try any hour
            for hour in range(6, 21):
                if (day_offset, hour) not in booked_times:
                    session_start = session_date.replace(hour=hour, minute=0, second=0)
                    session_doc = {
                        'traineeId': trainee_id,
                        'trainerId': trainer_id,
                        'subscriptionId': subscription_id,
                        'status': SessionStatus.CONFIRMED,
                        'sessionDateTimeStart': session_start,
                        'sessionDateTimeEnd': session_start + timedelta(minutes=duration),
                        'durationMinutes': duration,
                        'sessionType': sub.get('sessionType', SessionType.OUTDOOR),
                        'locationType': sub.get('sessionType', 'outdoor'),
                        'locationNameOrAddress': sub.get('locationNameOrAddress', ''),
                        'baseSessionPriceCents': sub['trainerRateCents'],
                        'platformFeeCents': sub['platformFeeCents'],
                        'platformFeePercent': PricingRules.PLATFORM_REVENUE_PERCENT,
                        'trainerEarningsCents': sub['trainerRateCents'],
                        'finalSessionPriceCents': sub['totalPerSessionCents'],
                        'isSubscriptionSession': True,
                        'gpsCheckinRequired': True,
                        'gpsCheckinRadiusMiles': 5,
                        'createdAt': datetime.utcnow(),
                    }
                    await db.sessions.insert_one(session_doc)
                    booked_times.add((day_offset, hour))
                    sessions_created += 1
                    break

    # Update subscription stats
    await db.subscriptions.update_one(
        {'_id': ObjectId(subscription_id)},
        {'$inc': {'sessionsScheduled': sessions_created}, '$set': {'lastScheduledAt': datetime.utcnow(), 'updatedAt': datetime.utcnow()}}
    )

    return sessions_created
