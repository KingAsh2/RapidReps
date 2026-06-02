from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, UploadFile, File, Query, Response, Form, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
from bson import ObjectId
import stripe
import re
import html
import asyncio
import aiohttp
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from email_service import (
    send_password_reset_email, send_welcome_email, send_session_booked_email,
    send_payment_receipt_email, send_weekly_digest_email, send_streak_warning_email,
    send_payout_notification_email,
)

# Import shared models and deps (canonical source)
from models import *
from deps import (
    db, security, get_current_user, serialize_doc, sanitize_text,
    hash_password, verify_password, create_access_token, decode_token,
    calculate_distance, generate_safety_pin, calculate_travel_fee,
    get_session_minimum_price, get_cancellation_fee, calculate_trainer_tier,
    check_trainer_can_go_live, calculate_session_payout, calculate_travel_fee_split,
    calculate_cancellation_fee_detail, calculate_time_based_cancellation_penalty,
    get_minimum_price, calculate_session_pricing,
    send_push_notification, send_push_to_many,
    VALID_PERSONALITY_TAGS, EXPO_PUSH_URL,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Rate limiter — use X-Forwarded-For behind proxy/ingress
def get_real_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

limiter = Limiter(key_func=get_real_ip)

# Stripe configuration
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')

# Create the main app
from storage import init_storage, put_object, get_object, generate_upload_path, MIME_TYPES


app = FastAPI(title="RapidReps API")

# Rate limiter setup
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Root-level health check endpoints (for Kubernetes health checks)
@app.get("/")
async def app_root():
    return {"message": "RapidReps API", "status": "healthy"}

@app.get("/health")
async def app_health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/download/workflow-guide")
async def download_workflow_guide():
    return FileResponse("/app/backend/static/RapidReps_Workflow_Guide.pdf", filename="RapidReps_Workflow_Guide.pdf", media_type="application/pdf")


@app.get("/api/privacy/policy")
async def privacy_policy():
    """Public privacy policy URL (Meta App Review requires this to be reachable)."""
    return FileResponse("/app/backend/static/privacy-policy.html", media_type="text/html")


@app.get("/api/privacy/data-deletion-status")
async def data_deletion_status(code: str = ""):
    """Public landing page that Meta links to after a user requests data deletion."""
    html = f"""<!doctype html><html><head><meta charset='utf-8'><title>RapidReps — Data Deletion</title>
<style>body{{font-family:-apple-system,system-ui,sans-serif;background:#0A0E1A;color:#fff;padding:40px;line-height:1.6}}
.box{{max-width:600px;margin:auto;background:#141929;padding:32px;border-radius:14px;border:1px solid rgba(255,255,255,0.1)}}
h1{{color:#FF7F00;margin-top:0}} code{{background:rgba(255,127,0,0.12);padding:2px 8px;border-radius:6px;color:#FF7F00}}</style></head>
<body><div class='box'><h1>Data Deletion Confirmed</h1>
<p>Your Instagram connection has been removed from RapidReps. All cached media references and
your encrypted access token have been deleted from our servers.</p>
<p>Confirmation code: <code>{code or 'N/A'}</code></p>
<p>If you have any questions, contact <a href='mailto:privacy@rapidreps.app' style='color:#FF7F00'>privacy@rapidreps.app</a>.</p>
</div></body></html>"""
    from fastapi.responses import HTMLResponse
    return HTMLResponse(html)


# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# NOTE: Models moved to models.py, helpers moved to deps.py
import random
import string

# Import extracted route modules
from routes.auth_routes import router as auth_router
from routes.session_routes import router as session_router
from routes.admin_routes import router as admin_router
from routes.profile_routes import router as profile_router
from routes.streak_routes import router as streak_router
from routes.payment_routes import router as payment_router
from routes.social_auth_routes import router as social_auth_router
from routes.messaging_routes import router as messaging_router
from routes.notification_routes import router as notification_router
from routes.location_routes import router as location_router
from routes.matching_routes import router as matching_router


# Auth routes extracted to routes/auth_routes.py

# ============================================================================
# SAFETY / MODERATION ROUTES
# ============================================================================

@api_router.post("/safety/report")
async def report_user(report: ReportCreate, current_user: dict = Depends(get_current_user)):
    """Create a safety report about a user/content."""
    report_doc = report.dict()
    report_doc['reporterUserId'] = str(current_user['_id'])
    report_doc['createdAt'] = datetime.utcnow()
    await db.reports.insert_one(report_doc)
    return {'success': True}

@api_router.post("/safety/block/{blocked_user_id}")
async def block_user(blocked_user_id: str, current_user: dict = Depends(get_current_user)):
    """Block a user (prevents future interactions)."""
    blocker_id = str(current_user['_id'])
    existing = await db.blocks.find_one({'blockerUserId': blocker_id, 'blockedUserId': blocked_user_id})
    if not existing:
        await db.blocks.insert_one({
            'blockerUserId': blocker_id,
            'blockedUserId': blocked_user_id,
            'createdAt': datetime.utcnow(),
        })
    return {'success': True}

@api_router.delete("/safety/block/{blocked_user_id}")
async def unblock_user(blocked_user_id: str, current_user: dict = Depends(get_current_user)):
    blocker_id = str(current_user['_id'])
    await db.blocks.delete_one({'blockerUserId': blocker_id, 'blockedUserId': blocked_user_id})
    return {'success': True}

@api_router.get("/safety/blocks", response_model=BlockResponse)
async def get_blocks(current_user: dict = Depends(get_current_user)):
    blocker_id = str(current_user['_id'])
    cursor = db.blocks.find({'blockerUserId': blocker_id})
    blocked = []
    async for doc in cursor:
        blocked.append(doc['blockedUserId'])
    return BlockResponse(blockedUserIds=blocked)

# ============================================================================
# REFERRAL SYSTEM ROUTES
# ============================================================================

@api_router.get("/referral/my-code")
async def get_my_referral_code(current_user: dict = Depends(get_current_user)):
    """Get the current user's referral code, generating one if not present."""
    user_id = str(current_user['_id'])
    referral_code = current_user.get('referralCode')
    
    if not referral_code:
        referral_code = f"RR-{''.join(random.choices(string.ascii_uppercase + string.digits, k=6))}"
        while await db.users.find_one({'referralCode': referral_code}):
            referral_code = f"RR-{''.join(random.choices(string.ascii_uppercase + string.digits, k=6))}"
        await db.users.update_one(
            {'_id': current_user['_id']},
            {'$set': {'referralCode': referral_code, 'referralCredits': current_user.get('referralCredits', 0)}}
        )
    
    return {"referralCode": referral_code}

@api_router.get("/referral/stats")
async def get_referral_stats(current_user: dict = Depends(get_current_user)):
    """Get referral stats for the current user."""
    user_id = str(current_user['_id'])
    referral_code = current_user.get('referralCode', '')
    available_credits = current_user.get('referralCredits', 0)
    
    # Ensure referral code exists
    if not referral_code:
        code_resp = await get_my_referral_code(current_user)
        referral_code = code_resp['referralCode']
    
    # Get referrals where this user is the referrer
    referrals_as_referrer = []
    cursor = db.referrals.find({'referrerId': user_id})
    async for ref in cursor:
        referred_user = await db.users.find_one({'_id': ObjectId(ref['referredUserId'])}, {'_id': 0, 'fullName': 1, 'email': 1})
        referrals_as_referrer.append({
            'referredName': referred_user.get('fullName', 'Unknown') if referred_user else 'Unknown',
            'status': ref['status'],
            'creditCents': ref['creditCents'],
            'createdAt': ref['createdAt'].isoformat() if ref.get('createdAt') else None,
            'activatedAt': ref['activatedAt'].isoformat() if ref.get('activatedAt') else None,
        })
    
    # Also check if this user was referred (for their own credit status)
    my_referral = await db.referrals.find_one({'referredUserId': user_id})
    was_referred = my_referral is not None
    referral_activated = my_referral['status'] == 'activated' if my_referral else False
    
    total = len(referrals_as_referrer)
    activated = sum(1 for r in referrals_as_referrer if r['status'] == 'activated')
    pending = total - activated
    total_earned = activated * REFERRAL_CREDIT_CENTS
    
    return ReferralStats(
        referralCode=referral_code,
        totalReferrals=total,
        activatedReferrals=activated,
        pendingReferrals=pending,
        totalCreditsEarned=total_earned,
        availableCredits=available_credits,
        maxReferrals=MAX_REFERRALS_PER_USER,
        referralsRemaining=max(0, MAX_REFERRALS_PER_USER - total),
        referralHistory=referrals_as_referrer,
    )

@api_router.get("/referral/validate/{code}")
async def validate_referral_code(code: str):
    """Validate a referral code before signup (public endpoint)."""
    clean_code = code.strip().upper()
    referrer = await db.users.find_one({'referralCode': clean_code}, {'_id': 1, 'fullName': 1, 'referralCode': 1})
    if not referrer:
        return {"valid": False, "message": "Invalid referral code"}
    
    # Check if referrer has reached max
    count = await db.referrals.count_documents({
        'referrerId': str(referrer['_id']),
        'status': {'$in': ['pending', 'activated']}
    })
    if count >= MAX_REFERRALS_PER_USER:
        return {"valid": False, "message": "This referral code has reached its maximum uses"}
    
    return {"valid": True, "referrerName": referrer['fullName']}

@api_router.get("/referral/credits")
async def get_referral_credits(current_user: dict = Depends(get_current_user)):
    """Get available referral credits for session discount."""
    return {"availableCredits": current_user.get('referralCredits', 0)}


# ── Invite Tracking (powers funnel analytics for empty-state share CTA) ──
class InviteTrackBody(BaseModel):
    channel: str  # 'sms' | 'email' | 'share'
    audience: Optional[str] = None  # 'trainer' | 'trainee' — who the inviter was searching for
    targetQuery: Optional[str] = None  # opaque — may be a phone, email or name


@api_router.post("/referral/track-invite")
async def track_invite(body: InviteTrackBody, current_user: dict = Depends(get_current_user)):
    """Log an outbound invite so we can analyse channel performance.
    Mask phone/email PII before persistence — store only the type & last 4 chars."""
    channel = (body.channel or '').lower().strip()
    if channel not in ('sms', 'email', 'share'):
        raise HTTPException(400, "channel must be one of: sms, email, share")

    masked_target = None
    if body.targetQuery:
        q = body.targetQuery.strip()
        if '@' in q:
            masked_target = f"email:***{q[-6:]}" if len(q) > 6 else "email:***"
        elif sum(c.isdigit() for c in q) >= 6:
            digits = ''.join(c for c in q if c.isdigit())
            masked_target = f"phone:***{digits[-4:]}" if len(digits) >= 4 else "phone:***"
        else:
            masked_target = "name:***"

    invite_doc = {
        '_id': str(uuid.uuid4()),
        'inviterId': str(current_user['_id']),
        'inviterRoles': current_user.get('roles', []),
        'referralCode': current_user.get('referralCode'),
        'channel': channel,
        'audience': body.audience,
        'maskedTarget': masked_target,
        'createdAt': datetime.utcnow(),
    }
    await db.referral_invites.insert_one(invite_doc)
    return {'success': True, 'channel': channel}


@api_router.get("/referral/invite-stats")
async def get_invite_stats(current_user: dict = Depends(get_current_user)):
    """Aggregate invite count per channel for the current user."""
    pipeline = [
        {'$match': {'inviterId': str(current_user['_id'])}},
        {'$group': {'_id': '$channel', 'count': {'$sum': 1}}},
    ]
    by_channel = {row['_id']: row['count'] async for row in db.referral_invites.aggregate(pipeline)}
    total = sum(by_channel.values())
    return {
        'total': total,
        'byChannel': {
            'sms': by_channel.get('sms', 0),
            'email': by_channel.get('email', 0),
            'share': by_channel.get('share', 0),
        },
    }


# ── A/B EXPERIMENTS ──
class ExperimentEventBody(BaseModel):
    experimentKey: str  # e.g. "google_cta_copy"
    variant: str        # e.g. "control" | "fast"
    event: str          # "impression" | "click" | "conversion"
    deviceId: Optional[str] = None  # anon device id (hashed client-side)


@api_router.post("/experiments/event")
async def log_experiment_event(body: ExperimentEventBody):
    """Log A/B experiment events. No auth — happens pre-login on signup screens."""
    if body.event not in ("impression", "click", "conversion"):
        raise HTTPException(400, "event must be: impression | click | conversion")
    doc = {
        "_id": str(uuid.uuid4()),
        "experimentKey": body.experimentKey,
        "variant": body.variant,
        "event": body.event,
        "deviceId": body.deviceId,
        "createdAt": datetime.utcnow(),
    }
    await db.experiment_events.insert_one(doc)
    return {"ok": True}


@api_router.get("/experiments/{experiment_key}/results")
async def get_experiment_results(experiment_key: str, current_user: dict = Depends(get_current_user)):
    """Admin-only: variant performance breakdown."""
    if "admin" not in (current_user.get("roles") or []):
        raise HTTPException(403, "Admin only")
    pipeline = [
        {"$match": {"experimentKey": experiment_key}},
        {"$group": {"_id": {"variant": "$variant", "event": "$event"}, "count": {"$sum": 1}}},
    ]
    results: dict = {}
    async for row in db.experiment_events.aggregate(pipeline):
        v = row["_id"]["variant"]
        e = row["_id"]["event"]
        results.setdefault(v, {"impression": 0, "click": 0, "conversion": 0})[e] = row["count"]
    # Add CTR per variant
    for v in results.values():
        imp = v.get("impression", 0)
        v["ctr"] = round(v.get("click", 0) / imp, 4) if imp > 0 else 0.0
    return {"experimentKey": experiment_key, "variants": results}


# ============================================================================
# Chat/messaging routes extracted to routes/messaging_routes.py
# ============================================================================


# Profile routes extracted to routes/profile_routes.py

# Session routes extracted to routes/session_routes.py

# ============================================================================
# VIRTUAL SESSION ROUTES
# ============================================================================

@api_router.post("/virtual-sessions/request", response_model=VirtualSessionMatchResponse)
async def request_virtual_session(
    request: VirtualSessionRequest, 
    current_user: dict = Depends(get_current_user)
):
    """
    Request a virtual training session - finds and matches with an available trainer
    For MVP: Uses mock payment and simple matching logic
    """
    # Find available virtual trainers (only fields needed for matching + response)
    available_trainers = await db.trainer_profiles.find(
        {'isAvailable': True, 'isVirtualTrainingAvailable': True, 'offersVirtual': True},
        {'_id': 0, 'userId': 1, 'averageRating': 1, 'totalSessionsCompleted': 1, 'zoomMeetingLink': 1, 'bio': 1}
    ).to_list(100)
    
    if not available_trainers:
        raise HTTPException(
            status_code=404, 
            detail="No virtual trainers available at the moment. Please try again later."
        )
    
    # Sort by rating and total sessions (prioritize experienced, highly-rated trainers)
    available_trainers.sort(
        key=lambda t: (t.get('averageRating', 0), t.get('totalSessionsCompleted', 0)), 
        reverse=True
    )
    
    # Select the best available trainer
    selected_trainer = available_trainers[0]
    trainer_user = await db.users.find_one({'_id': ObjectId(selected_trainer['userId'])})
    
    if not trainer_user:
        raise HTTPException(status_code=404, detail="Trainer user not found")
    
    # Calculate pricing (fixed $18 for 30 min virtual session for MVP)
    base_price = 1800  # $18.00 in cents
    platform_fee = int(base_price * 0.10)  # 10% platform fee
    trainer_earnings = base_price - platform_fee
    
    # Create session starting immediately
    session_start = datetime.utcnow()
    session_end = session_start + timedelta(minutes=request.durationMinutes)
    
    # Mock payment processing (for MVP)
    payment_status = "completed"  # Mock successful payment
    
    session_doc = {
        'traineeId': request.traineeId,
        'trainerId': selected_trainer['userId'],
        'status': SessionStatus.CONFIRMED,  # Auto-confirm for virtual sessions
        'sessionDateTimeStart': session_start,
        'sessionDateTimeEnd': session_end,
        'durationMinutes': request.durationMinutes,
        'basePricePerMinuteCents': 60,  # $0.60/min for $18/30min
        'baseSessionPriceCents': base_price,
        'discountType': None,
        'discountAmountCents': 0,
        'finalSessionPriceCents': base_price,
        'platformFeePercent': 10,
        'platformFeeCents': platform_fee,
        'trainerEarningsCents': trainer_earnings,
        'locationType': 'virtual',
        'locationNameOrAddress': 'Zoom Video Call',
        'notes': sanitize_text(request.notes),
        'paymentIntentId': f'mock_payment_{uuid.uuid4().hex[:16]}',
        'paymentStatus': payment_status,
        'isVirtualSession': True,
        'zoomMeetingLink': selected_trainer.get('zoomMeetingLink', 'https://zoom.us/j/placeholder'),
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    
    result = await db.sessions.insert_one(session_doc)
    session_id = str(result.inserted_id)
    
    # Return match response
    return VirtualSessionMatchResponse(
        sessionId=session_id,
        trainerId=selected_trainer['userId'],
        trainerName=trainer_user.get('fullName', 'Trainer'),
        trainerBio=selected_trainer.get('bio'),
        trainerRating=selected_trainer.get('averageRating', 0.0),
        sessionDateTimeStart=session_start,
        sessionDateTimeEnd=session_end,
        durationMinutes=request.durationMinutes,
        finalSessionPriceCents=base_price,
        zoomMeetingLink=selected_trainer.get('zoomMeetingLink', 'https://zoom.us/j/placeholder'),
        status=SessionStatus.CONFIRMED
    )


# Rating, Earnings, Zelle, Receipt, and Payout routes extracted to routes/payment_routes.py



# Streak, Achievement, Badge, and Leaderboard routes extracted to routes/streak_routes.py


# ============================================================================
# Location, GPS tracking, en-route/start-session, nearby-trainers routes
# extracted to routes/location_routes.py (Iteration 86)
# ============================================================================



# Payment, Membership, and Boost routes extracted to routes/payment_routes.py

# ============================================================================

# Admin routes extracted to routes/admin_routes.py

# ============================================================================
# Push notification + notification preference routes extracted to
# routes/notification_routes.py
# ============================================================================

from deps import create_and_send_notification  # used by other inline routes below



# Password routes extracted to routes/auth_routes.py

# ============================================================================
# WEEKLY DIGEST ENDPOINT
# ============================================================================

@api_router.get("/weekly-digest")
async def get_weekly_digest(current_user: dict = Depends(get_current_user)):
    """Get the current user's weekly training summary. Also sends email if SendGrid configured."""
    user_id = str(current_user['_id'])
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)

    # Sessions this week
    sessions_this_week = await db.sessions.count_documents({
        'traineeId': user_id,
        'status': SessionStatus.COMPLETED,
        'sessionDateTimeEnd': {'$gte': week_ago}
    })

    # Total minutes this week
    pipeline = [
        {'$match': {
            'traineeId': user_id,
            'status': SessionStatus.COMPLETED,
            'sessionDateTimeEnd': {'$gte': week_ago}
        }},
        {'$group': {'_id': None, 'total': {'$sum': '$durationMinutes'}}}
    ]
    agg = await db.sessions.aggregate(pipeline).to_list(1)
    total_minutes = agg[0]['total'] if agg else 0

    # Streak info
    streak_data = {}
    try:
        # Inline streak computation for digest
        all_sessions = await db.sessions.find({
            'traineeId': user_id,
            'status': SessionStatus.COMPLETED
        }).sort('sessionDateTimeEnd', -1).to_list(100)
        streak_data = {'currentStreak': 0, 'streakLevel': 'none', 'consistencyPoints': 0}
        if all_sessions:
            # Simple streak: count consecutive weeks
            weeks_set = set()
            for s in all_sessions:
                end = s.get('sessionDateTimeEnd') or s.get('sessionDateTimeStart')
                if end:
                    weeks_set.add(end.isocalendar()[1])
            current_week = now.isocalendar()[1]
            streak = 0
            for w in range(current_week, current_week - 52, -1):
                if w in weeks_set:
                    streak += 1
                else:
                    break
            streak_data['currentStreak'] = streak
    except:
        pass

    # Leaderboard rank
    lb = await db.sessions.aggregate([
        {'$match': {'status': SessionStatus.COMPLETED, 'sessionDateTimeEnd': {'$gte': week_ago}}},
        {'$group': {'_id': '$traineeId', 'minutes': {'$sum': '$durationMinutes'}}},
        {'$sort': {'minutes': -1}}
    ]).to_list(100)
    rank = None
    for i, entry in enumerate(lb):
        if entry['_id'] == user_id:
            rank = i + 1
            break

    digest = {
        'sessionsThisWeek': sessions_this_week,
        'totalMinutes': total_minutes,
        'currentStreak': streak_data.get('currentStreak', 0),
        'streakLevel': streak_data.get('streakLevel', 'none'),
        'leaderboardRank': rank,
        'weekStart': week_ago.isoformat(),
        'weekEnd': now.isoformat(),
    }

    # Attempt to send email digest
    send_weekly_digest_email(
        current_user['email'],
        current_user.get('fullName', 'Athlete'),
        sessions_this_week,
        total_minutes,
        streak_data.get('currentStreak', 0),
        streak_data.get('streakLevel', 'none'),
        rank,
    )

    return digest


# ============================================================================
# ROOT ROUTES
# ============================================================================

@api_router.get("/")
async def root():
    return {"message": "RapidReps API - Uber for Personal Training"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}


@api_router.get("/downloads/user-manual")
async def download_user_manual():
    import os
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs", "RapidReps_User_Manual_v2.pdf")
    if not os.path.exists(path):
        # Fallback to old location
        path = os.path.join(os.path.dirname(__file__), "RapidReps_User_Manual.pdf")
    return FileResponse(path, media_type="application/pdf", filename="RapidReps_User_Manual_v2.pdf")

@api_router.get("/downloads/testing-checklist")
async def download_testing_checklist():
    import os
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs", "RapidReps_Testing_Checklist.pdf")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Checklist PDF not found")
    return FileResponse(path, media_type="application/pdf", filename="RapidReps_Testing_Checklist.pdf")


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    from deps import client as db_client
    db_client.close()

# ============================================================================
# BACKGROUND NOTIFICATION SCHEDULER
# ============================================================================

async def notification_scheduler():
    """Background task: checks every 5 minutes for timed notifications."""
    while True:
        try:
            now = datetime.utcnow()

            # 1. Session Reminders — sessions starting in next 55-65 min (1 hour)
            reminder_1h_start = now + timedelta(minutes=55)
            reminder_1h_end = now + timedelta(minutes=65)
            upcoming_1h = await db.sessions.find({
                'status': SessionStatus.CONFIRMED,
                'sessionDateTimeStart': {'$gte': reminder_1h_start, '$lte': reminder_1h_end},
                '_reminder1hSent': {'$ne': True}
            }).to_list(50)

            for s in upcoming_1h:
                sid = str(s['_id'])
                asyncio.create_task(create_and_send_notification(
                    s['traineeId'],
                    "Session in 1 Hour",
                    "Your training session starts in about 1 hour. Time to get ready!",
                    "session_reminder",
                    {"sessionId": sid, "screen": "trainee/sessions"}
                ))
                asyncio.create_task(create_and_send_notification(
                    s['trainerId'],
                    "Session in 1 Hour",
                    "You have a training session in about 1 hour!",
                    "session_reminder",
                    {"sessionId": sid, "screen": "trainer/sessions"}
                ))
                await db.sessions.update_one({'_id': s['_id']}, {'$set': {'_reminder1hSent': True}})

            # 1b. Session Reminders — sessions starting in next 10-20 min (15 min)
            reminder_start = now + timedelta(minutes=10)
            reminder_end = now + timedelta(minutes=20)
            upcoming = await db.sessions.find({
                'status': SessionStatus.CONFIRMED,
                'sessionDateTimeStart': {'$gte': reminder_start, '$lte': reminder_end},
                '_reminderSent': {'$ne': True}
            }).to_list(50)

            for s in upcoming:
                sid = str(s['_id'])
                asyncio.create_task(create_and_send_notification(
                    s['traineeId'],
                    "Session Starting Soon",
                    "Your training session starts in about 30 minutes. Get ready!",
                    "session_reminder",
                    {"sessionId": sid, "screen": "trainee/sessions"}
                ))
                asyncio.create_task(create_and_send_notification(
                    s['trainerId'],
                    "Session Starting Soon",
                    "You have a training session in about 30 minutes!",
                    "session_reminder",
                    {"sessionId": sid, "screen": "trainer/sessions"}
                ))
                await db.sessions.update_one({'_id': s['_id']}, {'$set': {'_reminderSent': True}})

            # 2. Streak Reminders — users with last session 6 days ago
            six_days_ago = now - timedelta(days=6)
            seven_days_ago = now - timedelta(days=7)
            at_risk = await db.sessions.aggregate([
                {'$match': {'status': SessionStatus.COMPLETED}},
                {'$group': {'_id': '$traineeId', 'lastSession': {'$max': '$sessionDateTimeEnd'}}},
                {'$match': {'lastSession': {'$gte': seven_days_ago, '$lte': six_days_ago}}}
            ]).to_list(50)

            for entry in at_risk:
                uid = entry['_id']
                today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                existing = await db.notifications.find_one({
                    'userId': uid,
                    'type': 'streak_warning',
                    'createdAt': {'$gte': today_start}
                })
                if not existing:
                    asyncio.create_task(create_and_send_notification(
                        uid,
                        "Don't Lose Your Streak!",
                        "You haven't trained in 6 days. Book a session to keep your streak alive!",
                        "streak_warning",
                        {"screen": "trainee/home"}
                    ))

            # 3. Boost Expiring — boosts expiring in next 24 hours
            expiry_window = now + timedelta(hours=24)
            expiring = await db.boosts.find({
                'isActive': True,
                'endDate': {'$lte': expiry_window, '$gte': now},
                '_expirySent': {'$ne': True}
            }).to_list(50)

            for b in expiring:
                asyncio.create_task(create_and_send_notification(
                    b['trainerId'],
                    "Boost Expiring Soon",
                    f"Your {b.get('boostType', 'visibility')} boost expires in less than 24 hours. Renew to stay visible!",
                    "boost_expiring",
                    {"screen": "trainer/boosts"}
                ))
                await db.boosts.update_one({'_id': b['_id']}, {'$set': {'_expirySent': True}})

            # 4. SMART: Progressive wave expansion for stale requests
            # If a request has been searching for 2+ minutes with no match,
            # expand to next wave of trainers
            stale_cutoff = now - timedelta(minutes=2)
            stale_requests = await db.virtual_requests.find({
                'status': 'searching',
                'createdAt': {'$lte': stale_cutoff},
                '_waveExpanded': {'$ne': True},
            }).to_list(20)

            for req in stale_requests:
                current_wave = req.get('currentWave', 1)
                if current_wave < 3:
                    new_wave = current_wave + 1
                    notified, wave_data = await run_matching_engine(
                        trainee_id=req['traineeId'],
                        trainee_name=req.get('traineeName', 'A Trainee'),
                        trainee_lat=req.get('traineeLat'),
                        trainee_lon=req.get('traineeLon'),
                        session_type=req.get('sessionType', 'virtual'),
                        rejected_trainers=req.get('rejectedTrainers', []) + req.get('notifiedTrainers', []),
                        request_id=str(req['_id']),
                        wave_number=new_wave,
                    )
                    if notified:
                        await db.virtual_requests.update_one(
                            {'_id': req['_id']},
                            {
                                '$set': {'currentWave': new_wave},
                                '$addToSet': {'notifiedTrainers': {'$each': notified}},
                            }
                        )
                else:
                    await db.virtual_requests.update_one(
                        {'_id': req['_id']},
                        {'$set': {'_waveExpanded': True}}
                    )

            # 5. SMART: Missed acceptance tracking
            # Requests older than 3 min where notified trainers haven't responded
            missed_cutoff = now - timedelta(minutes=3)
            missed_requests = await db.virtual_requests.find({
                'status': 'searching',
                'createdAt': {'$lte': missed_cutoff},
                '_missedNotifSent': {'$ne': True},
            }).to_list(20)

            for req in missed_requests:
                notified_trainers = req.get('notifiedTrainers', [])
                rejected_trainers = req.get('rejectedTrainers', [])
                # Trainers who were notified but didn't accept or reject
                non_responders = [t for t in notified_trainers if t not in rejected_trainers]
                for tid in non_responders:
                    asyncio.create_task(create_and_send_notification(
                        tid,
                        "Session Still Available",
                        f"{req.get('traineeName', 'A trainee')} is still waiting for a trainer. Accept now!",
                        "missed_acceptance",
                        {"screen": "trainer/virtual-request", "requestId": str(req['_id'])}
                    ))
                await db.virtual_requests.update_one(
                    {'_id': req['_id']},
                    {'$set': {'_missedNotifSent': True}}
                )

            # 6. SMART: Late warning for in-person sessions
            # Sessions confirmed but trainer hasn't checked in within 10 min of start
            late_window_start = now - timedelta(minutes=10)
            late_window_end = now
            late_sessions = await db.sessions.find({
                'status': SessionStatus.CONFIRMED,
                'sessionType': {'$ne': 'virtual'},
                'sessionDateTimeStart': {'$gte': late_window_start, '$lte': late_window_end},
                'trainerGpsConfirmed': {'$ne': True},
                '_lateWarningSent': {'$ne': True},
            }).to_list(20)

            for s in late_sessions:
                sid = str(s['_id'])
                asyncio.create_task(create_and_send_notification(
                    s['trainerId'],
                    "Running Late?",
                    "Your session has started. Please confirm your arrival or update the trainee.",
                    "late_warning",
                    {"sessionId": sid, "screen": "trainer/sessions"}
                ))
                asyncio.create_task(create_and_send_notification(
                    s['traineeId'],
                    "Trainer Update",
                    "Your trainer may be running slightly late. We've sent them a reminder.",
                    "late_warning",
                    {"sessionId": sid, "screen": "trainee/sessions"}
                ))
                await db.sessions.update_one({'_id': s['_id']}, {'$set': {'_lateWarningSent': True}})

            # 7. AUTO NO-SHOW DETECTION
            # Sessions past start time + 10 min where neither party has started
            noshow_cutoff = now - timedelta(minutes=10)
            noshow_candidates = await db.sessions.find({
                'status': {'$in': [SessionStatus.CONFIRMED, SessionStatus.EN_ROUTE]},
                'sessionType': {'$ne': 'virtual'},
                'sessionDateTimeStart': {'$lte': noshow_cutoff},
                '_noShowAutoChecked': {'$ne': True},
            }).to_list(20)

            for s in noshow_candidates:
                sid = str(s['_id'])
                trainer_gps_confirmed = s.get('trainerGpsConfirmed', False)

                if not trainer_gps_confirmed:
                    # Trainer never confirmed arrival — flag as potential trainer no-show
                    asyncio.create_task(create_and_send_notification(
                        s['traineeId'],
                        "Session Delayed",
                        "Your trainer has not arrived. You can mark this as a no-show if they don't appear soon.",
                        "late_warning",
                        {"sessionId": sid, "screen": "trainee/sessions", "action": "mark_no_show"}
                    ))
                    asyncio.create_task(create_and_send_notification(
                        s['trainerId'],
                        "Session Start Overdue",
                        "You haven't confirmed arrival for your session. Please update your trainee or you may receive a no-show strike.",
                        "late_warning",
                        {"sessionId": sid, "screen": "trainer/sessions"}
                    ))

                await db.sessions.update_one(
                    {'_id': s['_id']},
                    {'$set': {'_noShowAutoChecked': True}}
                )

            # 8. VIRTUAL SESSION AUTO-END (grace period)
            # Auto-end virtual sessions that have been running beyond max duration + grace
            max_virtual_duration = PricingRules.VIRTUAL_MAX_DURATION_MIN + PricingRules.VIRTUAL_GRACE_PERIOD_MIN
            virtual_cutoff = now - timedelta(minutes=max_virtual_duration)
            stale_virtual = await db.sessions.find({
                'status': SessionStatus.IN_PROGRESS,
                'sessionType': 'virtual',
                'sessionActualStart': {'$lte': virtual_cutoff},
                '_autoEnded': {'$ne': True},
            }).to_list(20)

            for s in stale_virtual:
                sid = str(s['_id'])
                await db.sessions.update_one(
                    {'_id': s['_id']},
                    {'$set': {
                        'status': SessionStatus.COMPLETED,
                        'sessionEndedAt': now,
                        '_autoEnded': True,
                        'updatedAt': now,
                    }}
                )
                asyncio.create_task(create_and_send_notification(
                    s['traineeId'],
                    "Session Auto-Ended",
                    "Your virtual session has ended after reaching the maximum duration.",
                    "session_ended",
                    {"sessionId": sid}
                ))

            # 9. FRAUD DETECTION — Trolling (3+ fake virtual requests per hour)
            one_hour_ago = now - timedelta(hours=1)
            troll_pipeline = [
                {'$match': {'createdAt': {'$gte': one_hour_ago}, 'status': {'$in': ['cancelled', 'exhausted']}}},
                {'$group': {'_id': '$traineeId', 'count': {'$sum': 1}}},
                {'$match': {'count': {'$gte': PricingRules.MAX_FAKE_REQUESTS_PER_HOUR}}},
            ]
            trolls = await db.virtual_requests.aggregate(troll_pipeline).to_list(20)
            for t in trolls:
                uid = t['_id']
                already_flagged = await db.users.find_one({'_id': ObjectId(uid), 'fraudFlagged': True})
                if not already_flagged:
                    await db.users.update_one(
                        {'_id': ObjectId(uid)},
                        {'$set': {
                            'fraudFlagged': True,
                            'fraudReason': f'{t["count"]}+ cancelled requests in 1 hour',
                            'fraudFlaggedAt': now,
                        }}
                    )

            # 10. FRAUD DETECTION — High cancellation rate trainers
            cancel_pipeline = [
                {'$match': {'status': {'$in': [SessionStatus.COMPLETED, SessionStatus.CANCELLED, SessionStatus.NO_SHOW]}}},
                {'$group': {
                    '_id': '$trainerId',
                    'total': {'$sum': 1},
                    'cancelled': {'$sum': {'$cond': [{'$eq': ['$cancelledBy', 'trainer']}, 1, 0]}},
                    'noShows': {'$sum': {'$cond': [{'$eq': ['$noShowParty', 'trainer']}, 1, 0]}},
                }},
                {'$match': {'total': {'$gte': 5}}},  # Only trainers with 5+ sessions
            ]
            cancel_stats = await db.sessions.aggregate(cancel_pipeline).to_list(100)
            for stat in cancel_stats:
                bad_rate = (stat['cancelled'] + stat['noShows']) / max(stat['total'], 1)
                if bad_rate >= PricingRules.HIGH_CANCEL_RATE_THRESHOLD:
                    tid = stat['_id']
                    if tid:
                        await db.users.update_one(
                            {'_id': ObjectId(tid)},
                            {'$set': {
                                'highCancelRate': True,
                                'cancelRate': round(bad_rate, 2),
                                'accountUnderReview': True,
                                'reviewReason': f'High cancellation/no-show rate: {round(bad_rate*100)}%',
                            }}
                        )

        except Exception as e:
            logging.getLogger(__name__).error(f"Notification scheduler error: {e}")

        await asyncio.sleep(300)  # Run every 5 minutes


# ============================================================================
# Smart matching engine + virtual/instant session routes extracted to
# routes/matching_routes.py (Iteration 87)
# ============================================================================

# ============================================================================
# CONVENIENCE FEATURES
# ============================================================================

# --- 1. Recent Trainers (for Quick Book) ---
@api_router.get("/trainee/recent-trainers")
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
@api_router.get("/trainee/streak")
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

@api_router.post("/sessions/recurring")
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
@api_router.post("/trainer/go-live")
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


@api_router.post("/trainer/go-offline")
async def trainer_go_offline(current_user: dict = Depends(get_current_user)):
    """Set trainer as offline / not available now."""
    await db.users.update_one(
        {'_id': current_user['_id']},
        {'$set': {'isLiveNow': False, 'liveStartedAt': None}}
    )
    return {'success': True, 'isLive': False}


# --- 5. Favorite Trainer Availability ---
@api_router.post("/trainee/toggle-favorite/{trainer_id}")
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


@api_router.get("/trainee/saved-trainers")
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


@api_router.get("/trainee/favorite-availability")
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


# Include the router in the main app - MUST be after all route definitions
app.include_router(api_router)
app.include_router(auth_router)
app.include_router(session_router)
app.include_router(admin_router)
app.include_router(profile_router)
app.include_router(streak_router)
app.include_router(payment_router)
app.include_router(social_auth_router)
app.include_router(messaging_router)
app.include_router(notification_router)
app.include_router(location_router)
app.include_router(matching_router)

# Instagram (Tinder-style profile linking)
from routes.instagram_routes import router as instagram_router
app.include_router(instagram_router)
from routes.matching import router as matching_router
from routes.trainer_tools import router as trainer_tools_router
from routes.feed import router as feed_router
from routes.group_sessions import router as group_sessions_router
from routes.progress import router as progress_router

app.include_router(matching_router)
app.include_router(trainer_tools_router)
app.include_router(feed_router)
app.include_router(group_sessions_router)
app.include_router(progress_router)

from routes.safety_check import router as safety_check_router
app.include_router(safety_check_router)

from routes.subscription_routes import router as subscription_router
app.include_router(subscription_router)

from routes.gps_checkin_routes import router as gps_checkin_router
app.include_router(gps_checkin_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def start_notification_scheduler():
    asyncio.create_task(notification_scheduler())
    # Initialize object storage
    try:
        init_storage()
        logging.info("Object storage connected")
    except Exception as e:
        logging.warning(f"Object storage init deferred: {e}")
    # Seed default Zelle settings if not present
    existing = await db.app_settings.find_one({"key": "zelle_config"})
    if not existing:
        await db.app_settings.insert_one({
            "key": "zelle_config",
            "zelleEmail": "ashtonbundy1@gmail.com",
            "zellePhone": "240-281-0462",
            "updatedAt": datetime.utcnow(),
        })

    # Idempotent admin seed — ensures admin@rapidreps.com always exists for ops + testing.
    # If the user gets deleted (e.g. dev DB wipe), this restores it on next server boot.
    # Password is admin123 (also documented in /app/memory/test_credentials.md).
    try:
        from deps import hash_password
        existing_admin = await db.users.find_one({"email": "admin@rapidreps.com"})
        if not existing_admin:
            await db.users.insert_one({
                "email": "admin@rapidreps.com",
                "phone": "+15550000000",
                "fullName": "RapidReps Admin",
                "passwordHash": hash_password("admin123"),
                "roles": ["admin"],
                "isAdmin": True,
                "isActive": True,
                "createdAt": datetime.utcnow(),
            })
            logging.info("Admin user seeded (admin@rapidreps.com)")
    except Exception as e:
        logging.warning(f"Admin seed skipped: {e}")
