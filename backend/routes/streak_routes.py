"""Streak, achievement, badge, and leaderboard routes for trainers and trainees."""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import asyncio
import logging

from deps import db, get_current_user, serialize_doc
from models import (
    SessionStatus, UserRole,
    BadgeType, TraineeBadgeType, BadgeProgress,
    TrainerAchievements, TraineeAchievements,
)

router = APIRouter(prefix="/api")


# ============================================================================
# TRAINER ACHIEVEMENTS & BADGES SYSTEM
# ============================================================================

async def calculate_badge_progress(trainer_id: str) -> TrainerAchievements:
    """Calculate all badge progress for a trainer"""
    completed_sessions = await db.sessions.find(
        {'trainerId': trainer_id, 'status': SessionStatus.COMPLETED},
        {'_id': 1, 'sessionDateTimeStart': 1, 'sessionDateTimeEnd': 1, 'traineeId': 1}
    ).to_list(1000)

    achievement_doc = await db.trainer_achievements.find_one({'trainerId': trainer_id})
    if not achievement_doc:
        achievement_doc = {
            'trainerId': trainer_id, 'discountSessionsRemaining': 0,
            'currentStreak': 0, 'streakWeeks': 0, 'lastStreakReset': None, 'unlockedBadges': []
        }

    ratings = await db.ratings.find({'trainerId': trainer_id}).to_list(1000)
    five_star_count = len([r for r in ratings if r['rating'] == 5])

    total_completed = len(completed_sessions)
    badges = []

    # 1. Milestone Master Badge - 25 total sessions
    badges.append(BadgeProgress(
        badgeType=BadgeType.MILESTONE_MASTER, badgeName="Milestone Master",
        description="Complete 25 total sessions", isUnlocked=total_completed >= 25,
        progress=min(total_completed, 25), target=25,
        reward="5% service fee on next 5 sessions",
        unlockedAt=achievement_doc.get('milestone_master_unlocked_at')
    ))

    # 2. Weekend Warrior Badge - 10 weekend sessions
    weekend_sessions = [s for s in completed_sessions
                       if s.get('sessionDateTimeStart') and datetime.fromisoformat(str(s['sessionDateTimeStart'])).weekday() >= 5]
    badges.append(BadgeProgress(
        badgeType=BadgeType.WEEKEND_WARRIOR, badgeName="Weekend Warrior",
        description="Complete 10 sessions on Saturday or Sunday",
        isUnlocked=len(weekend_sessions) >= 10, progress=min(len(weekend_sessions), 10), target=10,
        unlockedAt=achievement_doc.get('weekend_warrior_unlocked_at')
    ))

    # 3. Streak Star Badge - 10 sessions/week for 3 consecutive weeks
    streak_progress = achievement_doc.get('streakWeeks', 0)
    badges.append(BadgeProgress(
        badgeType=BadgeType.STREAK_STAR, badgeName="Streak Star",
        description="Complete 10 sessions per week for 3 consecutive weeks",
        isUnlocked=streak_progress >= 3, progress=min(streak_progress, 3), target=3,
        unlockedAt=achievement_doc.get('streak_star_unlocked_at')
    ))

    # 4. Early Bird Badge - 10 sessions before noon
    early_sessions = [s for s in completed_sessions
                     if s.get('sessionDateTimeStart') and datetime.fromisoformat(str(s['sessionDateTimeStart'])).hour < 12]
    badges.append(BadgeProgress(
        badgeType=BadgeType.EARLY_BIRD, badgeName="Early Bird",
        description="Complete 10 sessions before 11:59 AM",
        isUnlocked=len(early_sessions) >= 10, progress=min(len(early_sessions), 10), target=10,
        unlockedAt=achievement_doc.get('early_bird_unlocked_at')
    ))

    # 5. Night Owl Badge - 10 sessions after 6 PM
    night_sessions = [s for s in completed_sessions
                     if s.get('sessionDateTimeStart') and datetime.fromisoformat(str(s['sessionDateTimeStart'])).hour >= 18]
    badges.append(BadgeProgress(
        badgeType=BadgeType.NIGHT_OWL, badgeName="Night Owl",
        description="Complete 10 sessions at or after 6:00 PM",
        isUnlocked=len(night_sessions) >= 10, progress=min(len(night_sessions), 10), target=10,
        unlockedAt=achievement_doc.get('night_owl_unlocked_at')
    ))

    # 6. Top Trainer of the Month Badge
    top_trainer_unlocked = achievement_doc.get('top_trainer_unlocked_at') is not None
    badges.append(BadgeProgress(
        badgeType=BadgeType.TOP_TRAINER, badgeName="Top Trainer of the Month",
        description="Rank #1 in total completed sessions for the month",
        isUnlocked=top_trainer_unlocked, progress=1 if top_trainer_unlocked else 0, target=1,
        reward="Monthly recognition",
        unlockedAt=achievement_doc.get('top_trainer_unlocked_at')
    ))

    # 7. New Client Champ Badge - 10 unique first-time clients
    unique_clients = set()
    for session in completed_sessions:
        trainee_id = session['traineeId']
        client_sessions = [s for s in completed_sessions if s['traineeId'] == trainee_id]
        if len(client_sessions) > 0 and client_sessions[0]['_id'] == session['_id']:
            unique_clients.add(trainee_id)
    badges.append(BadgeProgress(
        badgeType=BadgeType.NEW_CLIENT_CHAMP, badgeName="New Client Champ",
        description="Complete sessions with 10 unique first-time clients",
        isUnlocked=len(unique_clients) >= 10, progress=min(len(unique_clients), 10), target=10,
        unlockedAt=achievement_doc.get('new_client_champ_unlocked_at')
    ))

    # 8. Flexibility Guru Badge - 10 sessions across 3 time blocks
    time_blocks = set()
    for session in completed_sessions:
        if not session.get('sessionDateTimeStart'):
            continue
        hour = datetime.fromisoformat(str(session['sessionDateTimeStart'])).hour
        if hour < 12: time_blocks.add('morning')
        elif hour < 18: time_blocks.add('afternoon')
        else: time_blocks.add('evening')
    flexibility_sessions = len(completed_sessions) if len(time_blocks) >= 3 else 0
    badges.append(BadgeProgress(
        badgeType=BadgeType.FLEXIBILITY_GURU, badgeName="Flexibility Guru",
        description="Complete 10 sessions across morning, afternoon, and evening",
        isUnlocked=flexibility_sessions >= 10, progress=min(flexibility_sessions, 10), target=10,
        unlockedAt=achievement_doc.get('flexibility_guru_unlocked_at')
    ))

    # 9. Feedback Favorite Badge - 10 five-star ratings
    badges.append(BadgeProgress(
        badgeType=BadgeType.FEEDBACK_FAVORITE, badgeName="Feedback Favorite",
        description="Receive 10 client ratings of 5 stars",
        isUnlocked=five_star_count >= 10, progress=min(five_star_count, 10), target=10,
        unlockedAt=achievement_doc.get('feedback_favorite_unlocked_at')
    ))

    # 10. Double Duty Badge - 2 back-to-back sessions (within 15 min)
    double_duty_found = False
    valid_sessions = [s for s in completed_sessions if s.get('sessionDateTimeStart') and s.get('sessionDateTimeEnd')]
    sorted_sessions = sorted(valid_sessions, key=lambda s: s['sessionDateTimeStart'])
    for i in range(len(sorted_sessions) - 1):
        end_time = sorted_sessions[i]['sessionDateTimeEnd']
        next_start = sorted_sessions[i + 1]['sessionDateTimeStart']
        if isinstance(end_time, str): end_time = datetime.fromisoformat(end_time)
        if isinstance(next_start, str): next_start = datetime.fromisoformat(next_start)
        time_diff = (next_start - end_time).total_seconds() / 60
        if time_diff <= 15:
            double_duty_found = True
            break
    badges.append(BadgeProgress(
        badgeType=BadgeType.DOUBLE_DUTY, badgeName="Double Duty",
        description="Complete 2 back-to-back sessions within 15 minutes",
        isUnlocked=double_duty_found, progress=1 if double_duty_found else 0, target=1,
        unlockedAt=achievement_doc.get('double_duty_unlocked_at')
    ))

    return TrainerAchievements(
        trainerId=trainer_id, badges=badges, totalCompletedSessions=total_completed,
        discountSessionsRemaining=achievement_doc.get('discountSessionsRemaining', 0),
        currentStreak=achievement_doc.get('currentStreak', 0),
        streakWeeks=achievement_doc.get('streakWeeks', 0),
        lastStreakReset=achievement_doc.get('lastStreakReset')
    )

async def check_and_unlock_badges(trainer_id: str):
    """Check if any new badges should be unlocked and update DB"""
    achievements = await calculate_badge_progress(trainer_id)
    achievement_doc = await db.trainer_achievements.find_one({'trainerId': trainer_id})

    if not achievement_doc:
        achievement_doc = {'trainerId': trainer_id, 'discountSessionsRemaining': 0, 'unlockedBadges': []}
        await db.trainer_achievements.insert_one(achievement_doc)

    newly_unlocked = []
    for badge in achievements.badges:
        badge_key = f"{badge.badgeType}_unlocked_at"
        if badge.isUnlocked and badge_key not in achievement_doc:
            await db.trainer_achievements.update_one(
                {'trainerId': trainer_id},
                {'$set': {badge_key: datetime.utcnow()}}
            )
            newly_unlocked.append(badge.badgeType)
            if badge.badgeType == BadgeType.MILESTONE_MASTER:
                await db.trainer_achievements.update_one(
                    {'trainerId': trainer_id},
                    {'$set': {'discountSessionsRemaining': 5}}
                )
    return newly_unlocked

@router.get("/trainer/achievements")
async def get_trainer_achievements(current_user: dict = Depends(get_current_user)):
    """Get achievements and badge progress for current trainer"""
    if UserRole.TRAINER not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Trainer access required")
    trainer_profile = await db.trainer_profiles.find_one({'userId': str(current_user['_id'])})
    if not trainer_profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    achievements = await calculate_badge_progress(str(current_user['_id']))
    return {
        'trainerId': str(trainer_profile['_id']),
        'badges': [badge.dict() for badge in achievements.badges],
        'totalCompletedSessions': achievements.totalCompletedSessions,
        'discountSessionsRemaining': achievements.discountSessionsRemaining,
        'currentStreak': achievements.currentStreak,
        'streakWeeks': achievements.streakWeeks
    }

@router.post("/trainer/check-badges")
async def check_badges(current_user: dict = Depends(get_current_user)):
    """Manually trigger badge check (for testing)"""
    if UserRole.TRAINER not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Trainer access required")
    trainer_profile = await db.trainer_profiles.find_one({'userId': str(current_user['_id'])})
    if not trainer_profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    newly_unlocked = await check_and_unlock_badges(str(current_user['_id']))

    if newly_unlocked:
        try:
            from routes.feed import auto_create_feed_post
            user_name = current_user.get('fullName', 'A trainer')
            for badge_type in newly_unlocked:
                asyncio.create_task(auto_create_feed_post(
                    "badge_unlock", str(current_user['_id']), user_name,
                    f"{user_name} just unlocked the {badge_type.replace('_', ' ').title()} badge!",
                    {"badgeType": badge_type}
                ))
        except Exception:
            pass

    return {
        'newlyUnlocked': newly_unlocked,
        'message': f"Unlocked {len(newly_unlocked)} new badge(s)" if newly_unlocked else "No new badges"
    }


# ============================================================================
# STREAKS / CONSISTENCY POINTS SYSTEM
# ============================================================================

async def calculate_user_streak(user_id: str, role: str) -> dict:
    """Calculate streak data for a user (trainer or trainee)."""
    field = 'trainerId' if role == 'trainer' else 'traineeId'

    completed_sessions = await db.sessions.find(
        {field: user_id, 'status': SessionStatus.COMPLETED},
        {'sessionDateTimeStart': 1, 'durationMinutes': 1, 'sessionStartedAt': 1, 'sessionEndedAt': 1}
    ).sort('sessionDateTimeStart', 1).to_list(1000)

    if not completed_sessions:
        return {
            'currentStreak': 0, 'longestStreak': 0, 'totalWeeksActive': 0,
            'consistencyPoints': 0, 'totalSessions': 0, 'totalMinutes': 0,
            'streakLevel': 'none', 'nextMilestone': 2,
        }

    weeks = defaultdict(int)
    total_minutes = 0

    for s in completed_sessions:
        dt = s.get('sessionDateTimeStart')
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt)
        if dt:
            week_key = dt.isocalendar()[:2]
            weeks[week_key] += 1

        started = s.get('sessionStartedAt')
        ended = s.get('sessionEndedAt')
        if started and ended:
            if isinstance(started, str): started = datetime.fromisoformat(started)
            if isinstance(ended, str): ended = datetime.fromisoformat(ended)
            total_minutes += int((ended - started).total_seconds() / 60)
        else:
            total_minutes += s.get('durationMinutes', 0)

    sorted_weeks = sorted(weeks.keys())

    now = datetime.utcnow()
    current_iso = now.isocalendar()[:2]
    last_week_iso = (now - timedelta(days=7)).isocalendar()[:2]

    if current_iso not in weeks and last_week_iso not in weeks:
        current_streak = 0
    else:
        current_streak = 0
        check_week = sorted_weeks[-1]
        for i in range(len(sorted_weeks) - 1, -1, -1):
            if sorted_weeks[i] == check_week:
                current_streak += 1
                year, wk = check_week
                prev_date = datetime.strptime(f'{year}-W{wk:02d}-1', '%Y-W%W-%w') - timedelta(days=7)
                check_week = prev_date.isocalendar()[:2]
            else:
                break

    longest_streak = 0
    temp_streak = 1
    for i in range(1, len(sorted_weeks)):
        prev_year, prev_wk = sorted_weeks[i - 1]
        curr_year, curr_wk = sorted_weeks[i]
        prev_date = datetime.strptime(f'{prev_year}-W{prev_wk:02d}-1', '%Y-W%W-%w')
        next_expected = (prev_date + timedelta(days=7)).isocalendar()[:2]
        if (curr_year, curr_wk) == next_expected:
            temp_streak += 1
        else:
            longest_streak = max(longest_streak, temp_streak)
            temp_streak = 1
    longest_streak = max(longest_streak, temp_streak)

    total_sessions = len(completed_sessions)
    consistency_points = total_sessions * 10 + current_streak * 25 + total_minutes // 10

    if current_streak >= 12: streak_level = 'legend'
    elif current_streak >= 8: streak_level = 'blazing'
    elif current_streak >= 4: streak_level = 'fire'
    elif current_streak >= 2: streak_level = 'warming'
    else: streak_level = 'none'

    milestones = [2, 4, 8, 12, 26, 52]
    next_milestone = 2
    for m in milestones:
        if current_streak < m:
            next_milestone = m
            break

    return {
        'currentStreak': current_streak, 'longestStreak': longest_streak,
        'totalWeeksActive': len(sorted_weeks), 'consistencyPoints': consistency_points,
        'totalSessions': total_sessions, 'totalMinutes': total_minutes,
        'streakLevel': streak_level, 'nextMilestone': next_milestone,
    }


@router.get("/streaks/me")
async def get_my_streaks(current_user: dict = Depends(get_current_user)):
    """Get streak and consistency points for the current user"""
    user_id = str(current_user['_id'])
    roles = current_user.get('roles', [])
    role = 'trainer' if UserRole.TRAINER in roles else 'trainee'
    streak_data = await calculate_user_streak(user_id, role)
    streak_data['userId'] = user_id
    streak_data['role'] = role
    return streak_data


@router.get("/leaderboard/weekly")
async def get_weekly_leaderboard(limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Get weekly leaderboard ranked by consistency points."""
    all_users = await db.users.find(
        {'isAdmin': {'$ne': True}},
        {'fullName': 1, 'roles': 1, 'profilePhoto': 1}
    ).to_list(500)

    leaderboard = []
    for user in all_users:
        uid = str(user['_id'])
        roles = user.get('roles', [])
        role = 'trainer' if UserRole.TRAINER in roles else 'trainee'
        try:
            streak_data = await calculate_user_streak(uid, role)
        except Exception:
            continue
        if streak_data['totalSessions'] == 0:
            continue

        avatar = None
        if role == 'trainer':
            tp = await db.trainer_profiles.find_one({'userId': uid}, {'avatarUrl': 1})
            avatar = tp.get('avatarUrl') if tp else None
        else:
            tp = await db.trainee_profiles.find_one({'userId': uid}, {'profilePhoto': 1})
            avatar = tp.get('profilePhoto') if tp else None

        leaderboard.append({
            'userId': uid, 'fullName': user.get('fullName', 'Unknown'), 'role': role,
            'avatar': avatar, 'currentStreak': streak_data['currentStreak'],
            'longestStreak': streak_data['longestStreak'],
            'consistencyPoints': streak_data['consistencyPoints'],
            'totalSessions': streak_data['totalSessions'],
            'totalMinutes': streak_data['totalMinutes'],
            'streakLevel': streak_data['streakLevel'],
        })

    leaderboard.sort(key=lambda x: x['consistencyPoints'], reverse=True)
    leaderboard = leaderboard[:limit]
    for i, entry in enumerate(leaderboard):
        entry['rank'] = i + 1

    current_user_id = str(current_user['_id'])
    my_rank = None
    my_entry = None
    for entry in leaderboard:
        if entry['userId'] == current_user_id:
            my_rank = entry['rank']
            my_entry = entry
            break

    if my_rank is None:
        roles = current_user.get('roles', [])
        my_role = 'trainer' if UserRole.TRAINER in roles else 'trainee'
        try:
            my_streak = await calculate_user_streak(current_user_id, my_role)
            if my_streak['totalSessions'] > 0:
                higher_count = sum(1 for e in leaderboard if e['consistencyPoints'] > my_streak['consistencyPoints'])
                my_rank = higher_count + 1
                my_entry = {
                    'userId': current_user_id, 'fullName': current_user.get('fullName', 'Unknown'),
                    'role': my_role, 'currentStreak': my_streak['currentStreak'],
                    'consistencyPoints': my_streak['consistencyPoints'],
                    'totalSessions': my_streak['totalSessions'],
                    'totalMinutes': my_streak['totalMinutes'],
                    'streakLevel': my_streak['streakLevel'], 'rank': my_rank,
                }
        except Exception:
            pass

    return {
        'leaderboard': leaderboard, 'myRank': my_rank,
        'myEntry': my_entry, 'totalParticipants': len(leaderboard),
    }


# ============================================================================
# TRAINEE ACHIEVEMENTS & BADGES
# ============================================================================

async def calculate_trainee_badge_progress(trainee_id: str) -> TraineeAchievements:
    """Calculate all badge progress for a trainee"""
    completed_sessions = await db.sessions.find(
        {'traineeId': trainee_id, 'status': SessionStatus.COMPLETED},
        {'_id': 0, 'sessionDateTimeStart': 1, 'trainerId': 1}
    ).to_list(1000)

    achievement_doc = await db.trainee_achievements.find_one({'traineeId': trainee_id})
    if not achievement_doc:
        achievement_doc = {
            'traineeId': trainee_id, 'discountSessionsRemaining': 0,
            'currentStreak': 0, 'streekWeeks': 0, 'lastStreakReset': None,
            'unlockedBadges': [], 'trainAgainCount': 0
        }

    feedback_count_from_db = await db.ratings.count_documents({'traineeId': trainee_id})
    total_completed = len(completed_sessions)
    badges = []

    # 1. Commitment Badge - 10 completed sessions
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.COMMITMENT, badgeName="Commitment Badge",
        description="Complete 10 training sessions",
        isUnlocked=total_completed >= 10, progress=min(total_completed, 10), target=10,
        unlockedAt=achievement_doc.get('commitment_unlocked_at')
    ))

    # 2. Consistency Champ - 2+ sessions/week for 3 consecutive weeks
    streak_progress = achievement_doc.get('streakWeeks', 0)
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.CONSISTENCY_CHAMP, badgeName="Consistency Champ",
        description="Complete 2+ sessions per week for 3 consecutive weeks",
        isUnlocked=streak_progress >= 3, progress=min(streak_progress, 3), target=3,
        unlockedAt=achievement_doc.get('consistency_champ_unlocked_at')
    ))

    # 3. Weekend Grinder - 5 weekend sessions
    weekend_sessions = [s for s in completed_sessions
                       if s.get('sessionDateTimeStart') and datetime.fromisoformat(str(s['sessionDateTimeStart'])).weekday() >= 5]
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.WEEKEND_GRINDER, badgeName="Weekend Grinder",
        description="Complete 5 sessions on Saturday or Sunday",
        isUnlocked=len(weekend_sessions) >= 5, progress=min(len(weekend_sessions), 5), target=5,
        unlockedAt=achievement_doc.get('weekend_grinder_unlocked_at')
    ))

    # 4. Early Riser - 5 sessions before noon
    early_sessions = [s for s in completed_sessions
                     if s.get('sessionDateTimeStart') and datetime.fromisoformat(str(s['sessionDateTimeStart'])).hour < 12]
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.EARLY_RISER, badgeName="Early Riser",
        description="Complete 5 sessions before 11:59 AM",
        isUnlocked=len(early_sessions) >= 5, progress=min(len(early_sessions), 5), target=5,
        unlockedAt=achievement_doc.get('early_riser_unlocked_at')
    ))

    # 5. Night Hustler - 5 sessions after 6 PM
    night_sessions = [s for s in completed_sessions
                     if s.get('sessionDateTimeStart') and datetime.fromisoformat(str(s['sessionDateTimeStart'])).hour >= 18]
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.NIGHT_HUSTLER, badgeName="Night Hustler",
        description="Complete 5 sessions at or after 6:00 PM",
        isUnlocked=len(night_sessions) >= 5, progress=min(len(night_sessions), 5), target=5,
        unlockedAt=achievement_doc.get('night_hustler_unlocked_at')
    ))

    # 6. Loyalty Lock - 20 lifetime sessions
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.LOYALTY_LOCK, badgeName="Loyalty Lock",
        description="Complete 20 lifetime sessions",
        isUnlocked=total_completed >= 20, progress=min(total_completed, 20), target=20,
        reward="1 reduced service fee session",
        unlockedAt=achievement_doc.get('loyalty_lock_unlocked_at')
    ))

    # 7. Trainer Favorite - 5 "Would Train Again" confirmations
    train_again_count = achievement_doc.get('trainAgainCount', 0)
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.TRAINER_FAVORITE, badgeName="Trainer Favorite",
        description="Get 5 'Would Train Again' confirmations from trainers",
        isUnlocked=train_again_count >= 5, progress=min(train_again_count, 5), target=5,
        unlockedAt=achievement_doc.get('trainer_favorite_unlocked_at')
    ))

    # 8. Explorer - Sessions with 5 unique trainers
    unique_trainers = set(s['trainerId'] for s in completed_sessions)
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.EXPLORER, badgeName="Explorer",
        description="Train with 5 different trainers",
        isUnlocked=len(unique_trainers) >= 5, progress=min(len(unique_trainers), 5), target=5,
        unlockedAt=achievement_doc.get('explorer_unlocked_at')
    ))

    # 9. Feedback Hero - 10 completed session reviews
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.FEEDBACK_HERO, badgeName="Feedback Hero",
        description="Write 10 session reviews",
        isUnlocked=feedback_count_from_db >= 10, progress=min(feedback_count_from_db, 10), target=10,
        unlockedAt=achievement_doc.get('feedback_hero_unlocked_at')
    ))

    # 10. All-In - 3 sessions in a single calendar week
    all_in_found = False
    week_counts = defaultdict(int)
    for session in completed_sessions:
        if not session.get('sessionDateTimeStart'):
            continue
        start_date = datetime.fromisoformat(str(session['sessionDateTimeStart']))
        week_key = f"{start_date.year}-W{start_date.isocalendar()[1]}"
        week_counts[week_key] += 1
        if week_counts[week_key] >= 3:
            all_in_found = True
            break
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.ALL_IN, badgeName="All-In",
        description="Complete 3 sessions in a single calendar week",
        isUnlocked=all_in_found, progress=1 if all_in_found else 0, target=1,
        unlockedAt=achievement_doc.get('all_in_unlocked_at')
    ))

    # 11. Streak Star - Maintain a 4-week streak
    streak_data = await calculate_user_streak(trainee_id, 'trainee')
    longest_streak = streak_data.get('longestStreak', 0)
    badges.append(BadgeProgress(
        badgeType=BadgeType.STREAK_STAR, badgeName="Streak Star",
        description="Maintain a 4-week consecutive training streak",
        isUnlocked=longest_streak >= 4, progress=min(longest_streak, 4), target=4,
        reward="Streak badge on your profile",
        unlockedAt=achievement_doc.get('streak_star_unlocked_at')
    ))

    # 12. Duration Master - Accumulate 500 total training minutes
    total_minutes = streak_data.get('totalMinutes', 0)
    badges.append(BadgeProgress(
        badgeType="duration_master", badgeName="Duration Master",
        description="Accumulate 500 total training minutes",
        isUnlocked=total_minutes >= 500, progress=min(total_minutes, 500), target=500,
        reward="Endurance recognition badge",
        unlockedAt=achievement_doc.get('duration_master_unlocked_at')
    ))

    return TraineeAchievements(
        traineeId=trainee_id, badges=badges, totalCompletedSessions=total_completed,
        discountSessionsRemaining=achievement_doc.get('discountSessionsRemaining', 0),
        currentStreak=achievement_doc.get('currentStreak', 0),
        streakWeeks=achievement_doc.get('streakWeeks', 0),
        lastStreakReset=achievement_doc.get('lastStreakReset')
    )

async def check_and_unlock_trainee_badges(trainee_id: str):
    """Check if any new trainee badges should be unlocked and update DB"""
    achievements = await calculate_trainee_badge_progress(trainee_id)
    achievement_doc = await db.trainee_achievements.find_one({'traineeId': trainee_id})

    if not achievement_doc:
        achievement_doc = {
            'traineeId': trainee_id, 'discountSessionsRemaining': 0,
            'unlockedBadges': [], 'trainAgainCount': 0
        }
        await db.trainee_achievements.insert_one(achievement_doc)

    newly_unlocked = []
    for badge in achievements.badges:
        badge_key = f"{badge.badgeType}_unlocked_at"
        if badge.isUnlocked and badge_key not in achievement_doc:
            await db.trainee_achievements.update_one(
                {'traineeId': trainee_id},
                {'$set': {badge_key: datetime.utcnow()}}
            )
            newly_unlocked.append(badge.badgeType)
            if badge.badgeType == TraineeBadgeType.LOYALTY_LOCK:
                await db.trainee_achievements.update_one(
                    {'traineeId': trainee_id},
                    {'$set': {'discountSessionsRemaining': 1}}
                )
    return newly_unlocked

@router.get("/trainee/achievements")
async def get_trainee_achievements(current_user: dict = Depends(get_current_user)):
    """Get achievements and badge progress for current trainee"""
    if UserRole.TRAINEE not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Trainee access required")
    trainee_id = str(current_user['_id'])
    achievements = await calculate_trainee_badge_progress(trainee_id)
    return {
        'traineeId': trainee_id,
        'badges': [badge.dict() for badge in achievements.badges],
        'totalCompletedSessions': achievements.totalCompletedSessions,
        'discountSessionsRemaining': achievements.discountSessionsRemaining,
        'currentStreak': achievements.currentStreak,
        'streakWeeks': achievements.streakWeeks
    }

@router.post("/trainee/check-badges")
async def check_trainee_badges(current_user: dict = Depends(get_current_user)):
    """Manually trigger trainee badge check (for testing)"""
    if UserRole.TRAINEE not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Trainee access required")
    trainee_id = str(current_user['_id'])
    newly_unlocked = await check_and_unlock_trainee_badges(trainee_id)
    return {
        'newlyUnlocked': newly_unlocked,
        'message': f"Unlocked {len(newly_unlocked)} new badge(s)" if newly_unlocked else "No new badges"
    }
