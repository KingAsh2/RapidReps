"""Convenience features: recent trainers, streaks, recurring sessions,
go-live/go-offline, favorites & favorite availability.
Extracted from server.py (Iteration 88 — P3 final slice)."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId

from deps import db, get_current_user
from models import SessionStatus

router = APIRouter(prefix="/api")


# ============================================================================
# CONVENIENCE FEATURES
# ============================================================================

# --- 1. Recent Trainers (for Quick Book) ---
@router.get("/trainee/recent-trainers")
async def get_recent_trainers(current_user: dict = Depends(get_current_user)):
    """Get trainee's most recent trainers (last 3 unique) for Quick Book."""
    user_id = str(current_user['_id'])
    pipeline = [
        {'$match': {'traineeId': user_id, 'status': {'$in': [SessionStatus.COMPLETED, SessionStatus.CONFIRMED]}}},
        {'$sort': {'sessionDateTimeStart': -1}},
        {'$group': {
            '_id': '$trainerId',
            'lastSessionDate': {'$first': '$sessionDateTimeStart'},
            'sessionCount': {'$sum': 1},
            'lastSessionType': {'$first': '$locationType'},
            'lastDuration': {'$first': '$durationMinutes'},
        }},
        {'$sort': {'lastSessionDate': -1}},
        {'$limit': 3},
    ]
    recent = await db.sessions.aggregate(pipeline).to_list(3)

    trainer_ids = [r['_id'] for r in recent if r['_id']]
    trainers_map = {}
    if trainer_ids:
        trainers = await db.users.find(
            {'_id': {'$in': [ObjectId(tid) for tid in trainer_ids if ObjectId.is_valid(tid)]}},
            {'fullName': 1, 'profilePhoto': 1, 'rates': 1, 'isAvailable': 1, 'averageRating': 1}
        ).to_list(10)
        trainers_map = {str(t['_id']): t for t in trainers}

    results = []
    for r in recent:
        trainer = trainers_map.get(r['_id'], {})
        results.append({
            'trainerId': r['_id'],
            'trainerName': trainer.get('fullName', 'Trainer'),
            'trainerPhoto': trainer.get('profilePhoto'),
            'averageRating': trainer.get('averageRating', 0),
            'isAvailable': trainer.get('isAvailable', False),
            'sessionCount': r['sessionCount'],
            'lastSessionDate': r['lastSessionDate'].isoformat() if r.get('lastSessionDate') else None,
            'lastSessionType': r.get('lastSessionType', 'outdoor'),
            'lastDuration': r.get('lastDuration', 60),
            'rates': trainer.get('rates', {}),
        })
    return {'recentTrainers': results}


# --- 2. Trainee Streak ---
@router.get("/trainee/streak")
async def get_trainee_streak(current_user: dict = Depends(get_current_user)):
    """Calculate trainee's training streak (consecutive weeks with at least 1 completed session)."""
    user_id = str(current_user['_id'])
    now = datetime.utcnow()

    # Get all completed sessions sorted by date
    sessions = await db.sessions.find(
        {'traineeId': user_id, 'status': SessionStatus.COMPLETED},
        {'sessionDateTimeStart': 1}
    ).sort('sessionDateTimeStart', -1).to_list(500)

    if not sessions:
        return {'currentStreak': 0, 'longestStreak': 0, 'totalSessions': 0, 'thisWeekSessions': 0}

    # Calculate weeks with sessions
    from collections import defaultdict
    week_sessions = defaultdict(int)
    for s in sessions:
        dt = s['sessionDateTimeStart']
        # ISO week number
        week_key = dt.isocalendar()[:2]  # (year, week)
        week_sessions[week_key] += 1

    # Current week
    current_week = now.isocalendar()[:2]
    this_week_count = week_sessions.get(current_week, 0)

    # Calculate consecutive weeks streak (going backwards from current/last active week)
    sorted_weeks = sorted(week_sessions.keys(), reverse=True)
    if not sorted_weeks:
        return {'currentStreak': 0, 'longestStreak': 0, 'totalSessions': len(sessions), 'thisWeekSessions': this_week_count}

    current_streak = 0
    check_week = current_week

    # Allow current week to count even if incomplete
    for i in range(52):  # Max 1 year
        year, week = check_week
        if (year, week) in week_sessions:
            current_streak += 1
        else:
            break
        # Go to previous week
        from datetime import date
        d = date.fromisocalendar(year, week, 1) - timedelta(days=7)
        check_week = d.isocalendar()[:2]

    # Calculate longest streak
    longest_streak = 0
    streak = 0
    all_weeks = sorted(week_sessions.keys())
    for i, wk in enumerate(all_weeks):
        if i == 0:
            streak = 1
        else:
            prev = all_weeks[i - 1]
            prev_date = date.fromisocalendar(prev[0], prev[1], 1)
            curr_date = date.fromisocalendar(wk[0], wk[1], 1)
            if (curr_date - prev_date).days <= 7:
                streak += 1
            else:
                streak = 1
        longest_streak = max(longest_streak, streak)

    return {
        'currentStreak': current_streak,
        'longestStreak': longest_streak,
        'totalSessions': len(sessions),
        'thisWeekSessions': this_week_count,
    }


# --- 3. Recurring Sessions ---
class RecurringSessionCreate(BaseModel):
    trainerId: str
    locationType: str = "outdoor"
    durationMinutes: int = 60
    dayOfWeek: int  # 0=Monday, 6=Sunday
    timeSlot: str  # "06:00", "07:00", etc
    recurrenceType: str = "weekly"  # "weekly" or "biweekly"
    numberOfSessions: int = 4  # How many sessions to create
    locationNameOrAddress: Optional[str] = None
    traineeLatitude: Optional[float] = None
    traineeLongitude: Optional[float] = None

@router.post("/sessions/recurring")
async def create_recurring_sessions(
    req: RecurringSessionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create multiple future sessions on a recurring schedule. Each is paid individually."""
    user_id = str(current_user['_id'])

    # Get trainer info for pricing
    trainer = await db.users.find_one({'_id': ObjectId(req.trainerId)})
    if not trainer:
        raise HTTPException(404, "Trainer not found")

    rates = trainer.get('rates', {})
    type_key = 'outdoor' if req.locationType == 'outdoor' else ('virtual' if req.locationType == 'virtual' else 'atHome')
    trainer_rate_cents = rates.get(type_key, 5000)  # Default $50/hr
    base_price = int(trainer_rate_cents / 0.80)
    service_fee = PricingRules.SERVICE_FEE_CENTS
    total_price = base_price + service_fee
    trainer_earnings = trainer_rate_cents

    # Calculate session dates
    now = datetime.utcnow()
    hour, minute = map(int, req.timeSlot.split(':'))
    days_ahead = (req.dayOfWeek - now.weekday()) % 7
    if days_ahead == 0 and now.hour >= hour:
        days_ahead = 7
    first_date = (now + timedelta(days=days_ahead)).replace(hour=hour, minute=minute, second=0, microsecond=0)

    interval = 7 if req.recurrenceType == 'weekly' else 14
    created_sessions = []

    for i in range(req.numberOfSessions):
        session_start = first_date + timedelta(days=i * interval)
        session_end = session_start + timedelta(minutes=req.durationMinutes)

        session_doc = {
            'traineeId': user_id,
            'trainerId': req.trainerId,
            'locationType': req.locationType,
            'durationMinutes': req.durationMinutes,
            'sessionDateTimeStart': session_start,
            'sessionDateTimeEnd': session_end,
            'status': SessionStatus.REQUESTED,
            'finalSessionPriceCents': total_price,
            'trainerEarningsCents': trainer_earnings,
            'platformFeeCents': base_price - trainer_earnings,
            'serviceFeeCents': service_fee,
            'locationNameOrAddress': req.locationNameOrAddress,
            'traineeLatitude': req.traineeLatitude,
            'traineeLongitude': req.traineeLongitude,
            'isRecurring': True,
            'recurrenceType': req.recurrenceType,
            'createdAt': datetime.utcnow(),
        }
        result = await db.sessions.insert_one(session_doc)
        created_sessions.append({
            'id': str(result.inserted_id),
            'date': session_start.isoformat(),
        })

    # Notify trainer
    asyncio.create_task(create_and_send_notification(
        req.trainerId,
        "Recurring Session Request!",
        f"{current_user.get('fullName', 'A trainee')} wants to book {req.numberOfSessions} {req.recurrenceType} sessions.",
        "session_request",
        {"screen": "trainer/sessions"}
    ))

    return {
        'success': True,
        'sessionsCreated': len(created_sessions),
        'sessions': created_sessions,
        'message': f"Created {len(created_sessions)} {req.recurrenceType} sessions",
    }


# --- 4. Trainer "Available Now" / Go Live ---
@router.post("/trainer/go-live")
async def trainer_go_live(current_user: dict = Depends(get_current_user)):
    """Toggle trainer as 'Available Now' and notify nearby trainees."""
    user_id = str(current_user['_id'])
    trainer_name = current_user.get('fullName', 'A trainer')

    await db.users.update_one(
        {'_id': current_user['_id']},
        {'$set': {
            'isAvailable': True,
            'isLiveNow': True,
            'liveStartedAt': datetime.utcnow(),
        }}
    )

    # Find nearby trainees who have bookmarked/trained with this trainer
    past_trainees = await db.sessions.aggregate([
        {'$match': {'trainerId': user_id, 'status': SessionStatus.COMPLETED}},
        {'$group': {'_id': '$traineeId'}},
    ]).to_list(100)

    notified = 0
    for entry in past_trainees:
        tid = entry['_id']
        asyncio.create_task(create_and_send_notification(
            tid,
            f"{trainer_name} is Available Now!",
            f"Your trainer {trainer_name} just went live. Book a session now!",
            "trainer_live",
            {"trainerId": user_id, "screen": "trainee/home"}
        ))
        notified += 1

    return {'success': True, 'isLive': True, 'notifiedTrainees': notified}


@router.post("/trainer/go-offline")
async def trainer_go_offline(current_user: dict = Depends(get_current_user)):
    """Set trainer as offline / not available now."""
    await db.users.update_one(
        {'_id': current_user['_id']},
        {'$set': {'isLiveNow': False, 'liveStartedAt': None}}
    )
    return {'success': True, 'isLive': False}


# --- 5. Favorite Trainer Availability ---
@router.post("/trainee/toggle-favorite/{trainer_id}")
async def toggle_favorite_trainer(trainer_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle a trainer as favorite/saved."""
    user_doc = await db.users.find_one({'_id': current_user['_id']}, {'savedTrainers': 1})
    saved = user_doc.get('savedTrainers', []) if user_doc else []
    if trainer_id in saved:
        saved.remove(trainer_id)
        is_fav = False
    else:
        saved.append(trainer_id)
        is_fav = True
    await db.users.update_one(
        {'_id': current_user['_id']},
        {'$set': {'savedTrainers': saved}}
    )
    return {'success': True, 'isFavorite': is_fav, 'savedTrainers': saved}


@router.get("/trainee/saved-trainers")
async def get_saved_trainers(current_user: dict = Depends(get_current_user)):
    """Get full details of all saved/favorited trainers."""
    user_doc = await db.users.find_one({'_id': current_user['_id']}, {'savedTrainers': 1})
    saved_ids = user_doc.get('savedTrainers', []) if user_doc else []

    if not saved_ids:
        return {'savedTrainers': []}

    # Fetch trainer profiles with full details
    trainers = await db.users.find(
        {'_id': {'$in': [ObjectId(tid) for tid in saved_ids if ObjectId.is_valid(tid)]}},
        {
            'fullName': 1, 'profilePhoto': 1, 'email': 1, 'phone': 1,
            'averageRating': 1, 'totalSessionsCompleted': 1, 'isVerified': 1,
            'trainingStyles': 1, 'ratePerMinuteCents': 1, 'bio': 1,
            'latitude': 1, 'longitude': 1, 'city': 1, 'state': 1
        }
    ).to_list(100)

    results = []
    for t in trainers:
        results.append({
            'id': str(t['_id']),
            'name': t.get('fullName', 'Trainer'),
            'profilePhoto': t.get('profilePhoto'),
            'email': t.get('email'),
            'rating': t.get('averageRating', 0),
            'totalSessions': t.get('totalSessionsCompleted', 0),
            'isVerified': t.get('isVerified', False),
            'trainingStyles': t.get('trainingStyles', []),
            'ratePerMinuteCents': t.get('ratePerMinuteCents', 0),
            'bio': t.get('bio', ''),
            'city': t.get('city'),
            'state': t.get('state'),
        })

    return {'savedTrainers': results}


@router.get("/trainee/favorite-availability")
async def get_favorite_trainer_availability(current_user: dict = Depends(get_current_user)):
    """Get availability windows for trainee's favorited trainers."""
    user_id = str(current_user['_id'])

    # Get user's saved/favorite trainers
    user_doc = await db.users.find_one({'_id': current_user['_id']}, {'savedTrainers': 1})
    saved_ids = user_doc.get('savedTrainers', []) if user_doc else []

    if not saved_ids:
        return {'trainers': []}

    trainers = await db.users.find(
        {'_id': {'$in': [ObjectId(tid) for tid in saved_ids if ObjectId.is_valid(tid)]}},
        {'fullName': 1, 'profilePhoto': 1, 'availability': 1, 'isAvailable': 1, 'isLiveNow': 1, 'averageRating': 1, 'rates': 1}
    ).to_list(20)

    results = []
    for t in trainers:
        availability = t.get('availability', {})
        days_available = []
        for day_name, slots in availability.items():
            if slots:
                days_available.append({'day': day_name, 'slots': slots})

        results.append({
            'trainerId': str(t['_id']),
            'trainerName': t.get('fullName', 'Trainer'),
            'trainerPhoto': t.get('profilePhoto'),
            'averageRating': t.get('averageRating', 0),
            'isAvailable': t.get('isAvailable', False),
            'isLiveNow': t.get('isLiveNow', False),
            'availability': days_available,
            'rates': t.get('rates', {}),
        })
    return {'trainers': results}
