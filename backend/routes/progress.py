"""Phase 7: User progress tracking (auto-calculated + trainer-submitted)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId

from routes import db, get_current_user, serialize_doc

router = APIRouter(prefix="/api/progress", tags=["progress"])

# Calorie estimates per minute by session type
CALORIES_PER_MINUTE = {"outdoor": 8, "in_home": 7, "virtual": 6}


@router.get("/{user_id}")
async def get_user_progress(user_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get comprehensive fitness progress for a user.
    Auto-calculated from session data + any trainer-submitted metrics.
    """
    # Auto-calculate from completed sessions
    pipeline = [
        {"$match": {
            "$or": [{"traineeId": user_id}, {"trainerId": user_id}],
            "status": "completed",
        }},
        {"$group": {
            "_id": None,
            "totalSessions": {"$sum": 1},
            "totalMinutes": {"$sum": {"$ifNull": ["$durationMinutes", 30]}},
            "sessionTypes": {"$push": "$sessionType"},
            "dates": {"$push": "$sessionDateTimeStart"},
        }},
    ]
    agg = await db.sessions.aggregate(pipeline).to_list(1)

    if agg:
        stats = agg[0]
        total_sessions = stats["totalSessions"]
        total_minutes = stats["totalMinutes"]

        # Estimate calories
        types = stats.get("sessionTypes", [])
        calories = sum(CALORIES_PER_MINUTE.get(t, 7) * 30 for t in types)  # assume 30-min avg

        # Calculate consistency score
        dates = [d for d in stats.get("dates", []) if d]
        weeks_set = set()
        for d in dates:
            if isinstance(d, datetime):
                weeks_set.add(d.isocalendar()[:2])
        streak_weeks = len(weeks_set)
        consistency_score = (total_sessions * 10) + (streak_weeks * 25) + (total_minutes // 10)
    else:
        total_sessions = 0
        total_minutes = 0
        calories = 0
        streak_weeks = 0
        consistency_score = 0

    # Get streak info
    streak_doc = await db.streaks.find_one({"userId": user_id})
    current_streak = streak_doc.get("currentStreak", 0) if streak_doc else 0
    longest_streak = streak_doc.get("longestStreak", 0) if streak_doc else 0

    # Streak level
    if current_streak >= 12:
        streak_level = "Legend"
    elif current_streak >= 8:
        streak_level = "Blazing"
    elif current_streak >= 4:
        streak_level = "Fire"
    elif current_streak >= 2:
        streak_level = "Warming"
    else:
        streak_level = "None"

    # Get trainer-submitted progress (if any)
    trainer_progress = await db.client_progress.find({"traineeId": user_id}).to_list(10)
    body_metrics = []
    for tp in trainer_progress:
        entry = serialize_doc(tp)
        entry.pop("history", None)  # Don't send full history in summary
        body_metrics.append(entry)

    # Get badges
    badges = await db.badges.find({"userId": user_id}).to_list(50)
    badge_list = [serialize_doc(b) for b in badges]

    return {
        "userId": user_id,
        "totalSessions": total_sessions,
        "totalMinutesTrained": total_minutes,
        "estimatedCaloriesBurned": calories,
        "consistencyScore": consistency_score,
        "currentStreak": current_streak,
        "longestStreak": longest_streak,
        "streakLevel": streak_level,
        "streakWeeks": streak_weeks,
        "bodyMetrics": body_metrics,
        "badges": badge_list,
    }


@router.get("/{user_id}/history")
async def get_workout_history(user_id: str, limit: int = 30, current_user: dict = Depends(get_current_user)):
    """Get recent workout history."""
    sessions = await db.sessions.find(
        {"$or": [{"traineeId": user_id}, {"trainerId": user_id}], "status": "completed"},
        {"_id": 1, "sessionType": 1, "durationMinutes": 1, "sessionDateTimeStart": 1, "trainerName": 1, "traineeName": 1}
    ).sort("sessionDateTimeStart", -1).limit(limit).to_list(limit)

    return [serialize_doc(s) for s in sessions]
