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
    trainer_visibility_filter,
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
from routes.kyc_routes import router as kyc_router
from routes.matching_routes import router as engine_router
from routes.convenience_routes import router as convenience_router
from routes.negotiation_routes import router as negotiation_router
from routes.corporate_routes import router as corporate_router


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
        {'isAvailable': True, 'isVirtualTrainingAvailable': True, 'offersVirtual': True,
         **trainer_visibility_filter()},
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
# Convenience features extracted to routes/convenience_routes.py (Iteration 88)
# ============================================================================



# Include the router in the main app - MUST be after all route definitions
app.include_router(api_router)
app.include_router(auth_router)
app.include_router(session_router)
app.include_router(negotiation_router, prefix="/api")
app.include_router(corporate_router, prefix="/api")
app.include_router(admin_router)
app.include_router(profile_router)
app.include_router(streak_router)
app.include_router(payment_router)
app.include_router(social_auth_router)
app.include_router(messaging_router)
app.include_router(notification_router)
app.include_router(location_router)
app.include_router(kyc_router)
app.include_router(engine_router)
app.include_router(convenience_router)

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

# iter106h: live position WebSocket — mounted under /api with no /api prefix
# on the route itself (the route file already declares /ws/...). Sub-second
# push updates between trainee + trainer en route to a session.
from routes.session_tracking_ws import router as session_tracking_ws_router
app.include_router(session_tracking_ws_router, prefix='/api')

from routes.gps_checkin_routes import router as gps_checkin_router
app.include_router(gps_checkin_router)

from routes.legal_routes import router as legal_router
app.include_router(legal_router)

from routes.dispute_routes import router as dispute_router
app.include_router(dispute_router)

# iter106an — Critical Batch 1: Stripe webhook + edge-case audit endpoints
from routes.webhook_routes import router as webhook_router
app.include_router(webhook_router)

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
    # iter106an — Critical Batch 1 edge-case scheduler (auto no-show,
    # auto-decline, orphan-payment reconcile). Single shared loop; each job
    # is idempotent and audit-logged. Loop interval is env-configurable
    # (EDGE_CASE_LOOP_INTERVAL_SEC, default 60s).
    from edge_case_scheduler import edge_case_scheduler_loop
    asyncio.create_task(edge_case_scheduler_loop())
    # Initialize object storage
    try:
        init_storage()
        logging.info("Object storage connected")
    except Exception as e:
        logging.warning(f"Object storage init deferred: {e}")
    # iter92: Zelle removed (was here, replaced with tier-based Stripe flow).

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
