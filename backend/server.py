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
# CHAT / MESSAGING ROUTES
# ============================================================================

@api_router.post("/messages", response_model=MessageResponse)
async def send_message(message_data: MessageCreate, current_user: dict = Depends(get_current_user)):
    """Send a message to another user"""
    sender_id = str(current_user['_id'])
    receiver_id = message_data.receiverId
    
    # Check if conversation exists
    conversation = await db.conversations.find_one({
        'participants': {'$all': [sender_id, receiver_id]}
    })
    
    # Create conversation if it doesn't exist
    if not conversation:
        conversation_doc = {
            '_id': str(uuid.uuid4()),
            'participants': [sender_id, receiver_id],
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }
        await db.conversations.insert_one(conversation_doc)
        conversation = conversation_doc
    
    # Create message
    message_doc = {
        '_id': str(uuid.uuid4()),
        'conversationId': str(conversation['_id']),
        'senderId': sender_id,
        'receiverId': receiver_id,
        'content': sanitize_text(message_data.content),
        'isRead': False,
        'createdAt': datetime.utcnow()
    }
    
    await db.messages.insert_one(message_doc)
    
    # Update conversation's last message time
    await db.conversations.update_one(
        {'_id': conversation['_id']},
        {'$set': {'updatedAt': datetime.utcnow()}}
    )
    
    # Push: Notify receiver of new message
    sender_name = current_user.get('fullName', 'Someone')
    preview = (message_doc['content'] or '')[:50]
    asyncio.create_task(create_and_send_notification(
        receiver_id,
        f"New message from {sender_name}",
        preview,
        "new_message",
        {"conversationId": str(conversation['_id']), "senderId": sender_id, "screen": "messages/chat"}
    ))

    return MessageResponse(
        id=str(message_doc['_id']),
        conversationId=str(message_doc['conversationId']),
        senderId=message_doc['senderId'],
        receiverId=message_doc['receiverId'],
        content=message_doc['content'],
        isRead=message_doc['isRead'],
        createdAt=message_doc['createdAt']
    )

@api_router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(current_user: dict = Depends(get_current_user)):
    """Get all conversations for the current user - optimized with batch queries"""
    user_id = str(current_user['_id'])
    
    # Find all conversations where user is a participant
    conversations_list = await db.conversations.find({'participants': user_id}).sort('updatedAt', -1).to_list(100)
    
    if not conversations_list:
        return []
    
    # Collect all unique participant IDs and conversation IDs
    all_participant_ids = set()
    conversation_ids = []
    for conv in conversations_list:
        all_participant_ids.update(conv['participants'])
        conversation_ids.append(str(conv['_id']))
    
    # Batch fetch all users
    users_cursor = db.users.find({'_id': {'$in': [ObjectId(pid) for pid in all_participant_ids]}})
    users_list = await users_cursor.to_list(len(all_participant_ids))
    users_map = {str(u['_id']): u for u in users_list}
    
    # Batch fetch all profiles (trainer and trainee)
    trainer_profiles = await db.trainer_profiles.find({'userId': {'$in': list(all_participant_ids)}}).to_list(len(all_participant_ids))
    trainee_profiles = await db.trainee_profiles.find({'userId': {'$in': list(all_participant_ids)}}).to_list(len(all_participant_ids))
    
    profiles_map = {}
    for p in trainer_profiles:
        profiles_map[p['userId']] = p
    for p in trainee_profiles:
        if p['userId'] not in profiles_map:
            profiles_map[p['userId']] = p
    
    # OPTIMIZATION: Batch fetch last messages for all conversations using aggregation
    last_messages_pipeline = [
        {'$match': {'conversationId': {'$in': conversation_ids}}},
        {'$sort': {'createdAt': -1}},
        {'$group': {
            '_id': '$conversationId',
            'lastMessage': {'$first': '$$ROOT'}
        }}
    ]
    last_messages_cursor = db.messages.aggregate(last_messages_pipeline)
    last_messages_list = await last_messages_cursor.to_list(len(conversation_ids))
    last_messages_map = {lm['_id']: lm['lastMessage'] for lm in last_messages_list}
    
    # OPTIMIZATION: Batch fetch unread counts for all conversations using aggregation
    unread_counts_pipeline = [
        {'$match': {
            'conversationId': {'$in': conversation_ids},
            'receiverId': user_id,
            'isRead': False
        }},
        {'$group': {
            '_id': '$conversationId',
            'count': {'$sum': 1}
        }}
    ]
    unread_counts_cursor = db.messages.aggregate(unread_counts_pipeline)
    unread_counts_list = await unread_counts_cursor.to_list(len(conversation_ids))
    unread_counts_map = {uc['_id']: uc['count'] for uc in unread_counts_list}
    
    # Build conversations response
    conversations = []
    for conv in conversations_list:
        participant_details = []
        for participant_id in conv['participants']:
            user = users_map.get(participant_id)
            if user:
                profile = profiles_map.get(participant_id)
                participant_details.append({
                    'id': participant_id,
                    'fullName': user.get('fullName', 'Unknown'),
                    'avatarUrl': profile.get('avatarUrl') or profile.get('profilePhoto') if profile else None,
                    'roles': user.get('roles', [])
                })
        
        # Get last message from batch-fetched map
        conv_id_str = str(conv['_id'])
        last_message_doc = last_messages_map.get(conv_id_str)
        
        last_message = None
        if last_message_doc:
            last_message = {
                'content': last_message_doc['content'],
                'createdAt': last_message_doc['createdAt'].isoformat(),
                'senderId': last_message_doc['senderId']
            }
        
        # Get unread count from batch-fetched map
        unread_count = unread_counts_map.get(conv_id_str, 0)
        
        conversations.append(ConversationResponse(
            id=conv_id_str,
            participants=conv['participants'],
            participantDetails=participant_details,
            lastMessage=last_message,
            unreadCount=unread_count,
            updatedAt=conv['updatedAt']
        ))
    
    return conversations


@api_router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(conversation_id: str, current_user: dict = Depends(get_current_user)):
    """Get all messages in a conversation"""
    user_id = str(current_user['_id'])
    
    # Verify user is part of the conversation
    conversation = await db.conversations.find_one({'_id': conversation_id})
    if not conversation or user_id not in conversation['participants']:
        raise HTTPException(status_code=403, detail="Not authorized to view this conversation")
    
    # Get messages with limit for performance
    cursor = db.messages.find({'conversationId': conversation_id}).sort('createdAt', 1).limit(500)
    
    messages = []
    async for msg in cursor:
        messages.append(MessageResponse(
            id=str(msg['_id']),
            conversationId=msg['conversationId'],
            senderId=msg['senderId'],
            receiverId=msg['receiverId'],
            content=msg['content'],
            isRead=msg.get('isRead', False),
            createdAt=msg['createdAt']
        ))
    
    # Mark messages as read
    await db.messages.update_many(
        {'conversationId': conversation_id, 'receiverId': user_id, 'isRead': False},
        {'$set': {'isRead': True}}
    )
    
    return messages

@api_router.post("/conversations")
async def get_or_create_conversation(receiver_id: str, current_user: dict = Depends(get_current_user)):
    """Get or create a conversation with another user"""
    sender_id = str(current_user['_id'])
    
    # Check if conversation exists
    conversation = await db.conversations.find_one({
        'participants': {'$all': [sender_id, receiver_id]}
    })
    
    if conversation:
        return {'conversationId': str(conversation['_id'])}
    
    # Create new conversation
    conversation_doc = {
        '_id': str(uuid.uuid4()),
        'participants': [sender_id, receiver_id],
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    await db.conversations.insert_one(conversation_doc)
    
    return {'conversationId': str(conversation_doc['_id'])}


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
# LOCATION & AVAILABILITY ENDPOINTS (Uber-style)
# ============================================================================

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

class AvailabilityUpdate(BaseModel):
    isAvailable: bool
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class NearbyTrainerResponse(BaseModel):
    id: str
    trainerId: str
    fullName: str
    avatarUrl: Optional[str] = None
    latitude: float
    longitude: float
    isAvailable: bool
    lastLocationUpdate: Optional[datetime] = None
    distanceMiles: float
    etaMinutes: int
    averageRating: float = 0.0
    ratePerMinuteCents: int = 100
    trainingStyles: List[str] = []
    sessionDurationsOffered: List[int] = []

def calculate_distance_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates using Haversine formula"""
    from math import radians, sin, cos, sqrt, atan2
    
    R = 3959  # Earth's radius in miles
    
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)
    
    a = sin(delta_lat/2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return R * c

def estimate_eta_minutes(distance_miles: float) -> int:
    """Estimate ETA based on distance - assumes average urban driving speed"""
    # Average speed: 20 mph in urban areas (accounting for traffic, stops)
    # Plus 3 minutes for getting ready/to car
    if distance_miles < 0.5:
        return 5  # Walking distance
    
    driving_time = (distance_miles / 20) * 60  # Convert to minutes
    buffer_time = 3  # Getting ready time
    
    return max(5, int(driving_time + buffer_time))

@api_router.put("/trainer/location")
async def update_trainer_location(
    location: LocationUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update trainer's current location (call every 30-60 seconds when available)"""
    if UserRole.TRAINER not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Trainer access required")
    
    user_id = str(current_user['_id'])
    
    # Update trainer profile with new location
    result = await db.trainer_profiles.update_one(
        {'userId': user_id},
        {
            '$set': {
                'latitude': location.latitude,
                'longitude': location.longitude,
                'lastLocationUpdate': datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    return {"success": True, "message": "Location updated"}

@api_router.put("/trainer/availability")
async def update_trainer_availability(
    update: AvailabilityUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Toggle trainer availability status"""
    if UserRole.TRAINER not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Trainer access required")
    
    user_id = str(current_user['_id'])
    
    update_data = {
        'isAvailable': update.isAvailable,
        'lastAvailabilityChange': datetime.utcnow()
    }
    
    # If going available and location provided, update that too
    if update.isAvailable and update.latitude and update.longitude:
        update_data['latitude'] = update.latitude
        update_data['longitude'] = update.longitude
        update_data['lastLocationUpdate'] = datetime.utcnow()
    
    result = await db.trainer_profiles.update_one(
        {'userId': user_id},
        {'$set': update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    return {
        "success": True, 
        "isAvailable": update.isAvailable,
        "message": "You are now available for sessions" if update.isAvailable else "You are now offline"
    }

@api_router.get("/trainer/my-location-status")
async def get_trainer_location_status(current_user: dict = Depends(get_current_user)):
    """Get current trainer's location and availability status"""
    if UserRole.TRAINER not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Trainer access required")
    
    user_id = str(current_user['_id'])
    
    profile = await db.trainer_profiles.find_one({'userId': user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    return {
        "isAvailable": profile.get('isAvailable', False),
        "latitude": profile.get('latitude'),
        "longitude": profile.get('longitude'),
        "lastLocationUpdate": profile.get('lastLocationUpdate'),
        "lastAvailabilityChange": profile.get('lastAvailabilityChange')
    }

# ─────────────────────────────────────────────────────────────
# GPS SESSION TRACKING — Real-time en-route & active tracking
# ─────────────────────────────────────────────────────────────

class GPSUpdate(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None  # meters
    sessionId: str

@api_router.post("/sessions/{session_id}/gps-update")
async def session_gps_update(session_id: str, latitude: float, longitude: float, accuracy: float = 0, current_user: dict = Depends(get_current_user)):
    """
    Real-time GPS update during a session.
    Called every 5s (en_route) or 15s (in_progress).
    Triggers alerts for distance violations and stale movement.
    """
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(400, "Invalid session ID")

    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(404, "Session not found")

    user_id = str(current_user['_id'])
    is_trainer = session.get('trainerId') == user_id
    is_trainee = session.get('traineeId') == user_id
    if not is_trainer and not is_trainee:
        raise HTTPException(403, "Not a participant of this session")

    role = "trainer" if is_trainer else "trainee"
    now = datetime.utcnow()
    alerts = []

    # Low GPS accuracy warning
    if accuracy and accuracy > 50:
        alerts.append({
            "type": "low_accuracy",
            "message": "Weak GPS signal — confirm location manually",
            "accuracy": accuracy,
        })

    # Store the GPS point
    gps_doc = {
        "sessionId": session_id,
        "userId": user_id,
        "role": role,
        "latitude": latitude,
        "longitude": longitude,
        "accuracy": accuracy,
        "timestamp": now,
    }
    await db.session_gps_tracks.insert_one(gps_doc)

    # GPS SPOOF DETECTION: Check for impossible location jumps
    prev_gps = await db.session_gps_tracks.find_one(
        {"sessionId": session_id, "userId": user_id, "timestamp": {"$lt": now}},
        sort=[("timestamp", -1)]
    )
    if prev_gps:
        jump_dist = calculate_distance(latitude, longitude, prev_gps['latitude'], prev_gps['longitude'])
        time_diff = (now - prev_gps['timestamp']).total_seconds()
        if time_diff < 30 and jump_dist > PricingRules.GPS_SPOOF_JUMP_MILES:
            alerts.append({
                "type": "spoof_warning",
                "message": "Unusual location change detected. GPS may be inaccurate.",
                "jumpMiles": round(jump_dist, 2),
            })
            # Flag the user for review
            await db.users.update_one(
                {'_id': current_user['_id']},
                {'$set': {
                    'gpsSpoofWarning': True,
                    'gpsSpoofAt': now,
                    'gpsSpoofSessionId': session_id,
                }}
            )

    # Check distance between parties if both have recent GPS
    other_role = "trainee" if is_trainer else "trainer"
    other_id = session.get('traineeId') if is_trainer else session.get('trainerId')
    other_gps = await db.session_gps_tracks.find_one(
        {"sessionId": session_id, "role": other_role},
        sort=[("timestamp", -1)]
    )

    if other_gps:
        dist = calculate_distance(latitude, longitude, other_gps['latitude'], other_gps['longitude'])

        # In active session: warn if distance increases > 0.5 miles
        if session.get('status') in (SessionStatus.IN_PROGRESS, SessionStatus.CONFIRMED) and dist > 0.5:
            alerts.append({
                "type": "distance_warning",
                "message": f"You are {dist:.2f} miles from the other party. Session may be at risk.",
                "distanceMiles": round(dist, 3),
            })

        # Both at different addresses at session start
        if session.get('status') == SessionStatus.EN_ROUTE and dist > 0.25:
            alerts.append({
                "type": "address_mismatch",
                "message": "You and the other party appear to be at different locations.",
                "distanceMiles": round(dist, 3),
            })

    # Trainer not moving for 2 minutes while en route
    if role == "trainer" and session.get('status') == SessionStatus.EN_ROUTE:
        two_min_ago = now - timedelta(minutes=2)
        prev_gps = await db.session_gps_tracks.find_one(
            {"sessionId": session_id, "role": "trainer", "timestamp": {"$lte": two_min_ago}},
            sort=[("timestamp", -1)]
        )
        if prev_gps:
            moved = calculate_distance(latitude, longitude, prev_gps['latitude'], prev_gps['longitude'])
            if moved < 0.01:  # ~50 feet
                alerts.append({
                    "type": "stale_movement",
                    "message": "You appear to be stationary. Are you on the way?",
                })

    return {
        "success": True,
        "alerts": alerts,
        "role": role,
        "sessionStatus": session.get('status'),
    }


@api_router.get("/sessions/{session_id}/gps-track")
async def get_session_gps_track(session_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get live GPS positions for both parties in a session.
    Only active during en_route, in_progress, or confirmed status.
    """
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(400, "Invalid session ID")

    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(404, "Session not found")

    user_id = str(current_user['_id'])
    if session.get('trainerId') != user_id and session.get('traineeId') != user_id:
        raise HTTPException(403, "Not a participant")

    # Privacy: only return tracking data during active sessions
    active_statuses = [SessionStatus.EN_ROUTE, SessionStatus.IN_PROGRESS, SessionStatus.CONFIRMED]
    if session.get('status') not in active_statuses:
        return {"tracking": False, "message": "GPS tracking is not active for this session."}

    # Get latest position for each party
    trainer_gps = await db.session_gps_tracks.find_one(
        {"sessionId": session_id, "role": "trainer"},
        sort=[("timestamp", -1)],
        projection={"_id": 0, "latitude": 1, "longitude": 1, "timestamp": 1, "accuracy": 1},
    )
    trainee_gps = await db.session_gps_tracks.find_one(
        {"sessionId": session_id, "role": "trainee"},
        sort=[("timestamp", -1)],
        projection={"_id": 0, "latitude": 1, "longitude": 1, "timestamp": 1, "accuracy": 1},
    )

    distance = None
    if trainer_gps and trainee_gps:
        distance = round(calculate_distance(
            trainer_gps['latitude'], trainer_gps['longitude'],
            trainee_gps['latitude'], trainee_gps['longitude']
        ), 3)

    # Convert timestamps to ISO strings
    if trainer_gps and 'timestamp' in trainer_gps:
        trainer_gps['timestamp'] = trainer_gps['timestamp'].isoformat()
    if trainee_gps and 'timestamp' in trainee_gps:
        trainee_gps['timestamp'] = trainee_gps['timestamp'].isoformat()

    return {
        "tracking": True,
        "sessionStatus": session.get('status'),
        "trainer": trainer_gps,
        "trainee": trainee_gps,
        "distanceMiles": distance,
    }


@api_router.post("/sessions/{session_id}/start-en-route")
async def start_en_route(session_id: str, current_user: dict = Depends(get_current_user)):
    """Trainer marks session as en_route — enables GPS tracking."""
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(400, "Invalid session ID")

    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(404, "Session not found")

    if session.get('trainerId') != str(current_user['_id']):
        raise HTTPException(403, "Only the trainer can start en-route")

    if session.get('status') not in (SessionStatus.CONFIRMED, 'accepted'):
        raise HTTPException(400, f"Session must be confirmed to start en-route. Current: {session.get('status')}")

    await db.sessions.update_one(
        {'_id': oid},
        {'$set': {'status': SessionStatus.EN_ROUTE, 'enRouteStartedAt': datetime.utcnow(), 'updatedAt': datetime.utcnow()}}
    )

    await create_and_send_notification(
        session['traineeId'],
        "Trainer On The Way!",
        "Your trainer is heading to you now. Track their arrival in the app.",
        "session_reminder",
        {"sessionId": session_id, "screen": "trainee/sessions"}
    )

    return {"success": True, "status": SessionStatus.EN_ROUTE, "message": "You are now en route. GPS tracking activated."}


@api_router.post("/sessions/{session_id}/start-session")
async def start_session_in_progress(session_id: str, current_user: dict = Depends(get_current_user)):
    """Mark session as in_progress — switches GPS to 15s interval."""
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(400, "Invalid session ID")

    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(404, "Session not found")

    trainer_id = str(current_user['_id'])
    trainee_id = session.get('traineeId')
    if session.get('trainerId') != trainer_id and trainee_id != trainer_id:
        raise HTTPException(403, "Not authorized")

    valid_statuses = [SessionStatus.CONFIRMED, SessionStatus.EN_ROUTE, 'accepted']
    if session.get('status') not in valid_statuses:
        raise HTTPException(400, f"Cannot start session with status: {session.get('status')}")

    await db.sessions.update_one(
        {'_id': oid},
        {'$set': {
            'status': SessionStatus.IN_PROGRESS,
            'sessionActualStart': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
        }}
    )

    await create_and_send_notification(
        session['traineeId'],
        "Session Started!",
        "Your training session is now in progress.",
        "session_started",
        {"sessionId": session_id}
    )

    return {"success": True, "status": SessionStatus.IN_PROGRESS, "message": "Session is now in progress."}



@api_router.get("/trainers/nearby")
async def get_nearby_trainers(
    latitude: float,
    longitude: float,
    radius_miles: float = 25,
    current_user: dict = Depends(get_current_user)
):
    """Get all available trainers near a location with distance and ETA"""
    
    # Get all available trainers with valid locations
    trainers = await db.trainer_profiles.find({
        'isAvailable': True,
        'latitude': {'$exists': True, '$ne': None},
        'longitude': {'$exists': True, '$ne': None}
    }).to_list(100)
    
    # First pass: filter trainers within radius
    nearby_trainers_data = []
    trainer_user_ids = []
    
    for trainer in trainers:
        trainer_lat = trainer.get('latitude')
        trainer_lng = trainer.get('longitude')
        
        if trainer_lat is None or trainer_lng is None:
            continue
        
        # Calculate distance
        distance = calculate_distance_miles(latitude, longitude, trainer_lat, trainer_lng)
        
        # Filter by radius
        if distance > radius_miles:
            continue
        
        nearby_trainers_data.append({
            'trainer': trainer,
            'distance': distance
        })
        trainer_user_ids.append(ObjectId(trainer['userId']))
    
    # OPTIMIZATION: Batch fetch all user details in a single query
    users_map = {}
    if trainer_user_ids:
        users_cursor = db.users.find({'_id': {'$in': trainer_user_ids}}, {'fullName': 1})
        users_list = await users_cursor.to_list(len(trainer_user_ids))
        users_map = {str(u['_id']): u.get('fullName', 'Trainer') for u in users_list}

    # Batch fetch active boosts and memberships
    now = datetime.utcnow()
    boosted_ids = set()
    active_boosts = await db.boosts.find({
        'isActive': True,
        'endDate': {'$gte': now},
        'trainerId': {'$in': [t['trainer']['userId'] for t in nearby_trainers_data]},
    }).to_list(200)
    for b in active_boosts:
        boosted_ids.add(b.get('trainerId'))

    member_ids = set()
    trainer_id_strings = [t['trainer']['userId'] for t in nearby_trainers_data]
    active_memberships = await db.memberships.find({
        'userId': {'$in': trainer_id_strings},
        'status': MembershipStatus.ACTIVE,
    }).to_list(200)
    for m in active_memberships:
        member_ids.add(m.get('userId'))
    
    # Build response with user names from map
    nearby_trainers = []
    for item in nearby_trainers_data:
        trainer = item['trainer']
        distance = item['distance']
        
        # Get trainer's user name from batch-fetched map
        full_name = users_map.get(trainer['userId'], 'Trainer')
        
        # Calculate ETA
        eta = estimate_eta_minutes(distance)
        
        tid = trainer['userId']
        is_boosted = tid in boosted_ids
        is_member = tid in member_ids

        # Track impression for boosted trainers
        if is_boosted:
            await db.boost_analytics.update_one(
                {'trainerId': tid, 'date': now.strftime('%Y-%m-%d')},
                {'$inc': {'impressions': 1}},
                upsert=True,
            )

        nearby_trainers.append({
            'id': str(trainer['_id']),
            'trainerId': trainer['userId'],
            'fullName': full_name,
            'avatarUrl': trainer.get('avatarUrl'),
            'latitude': trainer.get('latitude'),
            'longitude': trainer.get('longitude'),
            'isAvailable': True,
            'isBoosted': is_boosted,
            'isMember': is_member,
            'lastLocationUpdate': trainer.get('lastLocationUpdate'),
            'distanceMiles': round(distance, 1),
            'etaMinutes': eta,
            'averageRating': trainer.get('averageRating', 0.0),
            'ratePerMinuteCents': trainer.get('ratePerMinuteCents', 100),
            'trainingStyles': trainer.get('trainingStyles', []),
            'sessionDurationsOffered': trainer.get('sessionDurationsOffered', [30, 45, 60]),
            'bio': trainer.get('bio', ''),
            'experienceYears': trainer.get('experienceYears', 0),
            'totalSessionsCompleted': trainer.get('totalSessionsCompleted', 0)
        })
    
    # Sort by distance
    nearby_trainers.sort(key=lambda x: x['distanceMiles'])
    
    return {
        "trainers": nearby_trainers,
        "count": len(nearby_trainers),
        "searchLocation": {"latitude": latitude, "longitude": longitude},
        "radiusMiles": radius_miles
    }



# Payment, Membership, and Boost routes extracted to routes/payment_routes.py

# ============================================================================

# Admin routes extracted to routes/admin_routes.py

# ============================================================================
# PUSH NOTIFICATION ENDPOINTS
# ============================================================================

class PushTokenRegister(BaseModel):
    token: str
    deviceId: Optional[str] = None

@api_router.post("/push-tokens/register")
async def register_push_token(data: PushTokenRegister, current_user: dict = Depends(get_current_user)):
    """Register a push notification token for the current user"""
    user_id = str(current_user['_id'])
    # Upsert: one token per device per user
    await db.push_tokens.update_one(
        {'userId': user_id, 'token': data.token},
        {'$set': {
            'userId': user_id,
            'token': data.token,
            'deviceId': data.deviceId,
            'updatedAt': datetime.utcnow()
        }},
        upsert=True
    )
    return {"success": True, "message": "Push token registered"}

@api_router.delete("/push-tokens/unregister")
async def unregister_push_token(data: PushTokenRegister, current_user: dict = Depends(get_current_user)):
    """Unregister a push notification token (e.g., on logout)"""
    user_id = str(current_user['_id'])
    await db.push_tokens.delete_one({'userId': user_id, 'token': data.token})
    return {"success": True, "message": "Push token unregistered"}

@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    """Get notification history for the current user"""
    user_id = str(current_user['_id'])
    notifications = await db.notifications.find(
        {'userId': user_id},
        {'_id': 0}
    ).sort('createdAt', -1).to_list(50)
    return {"notifications": notifications}

@api_router.post("/notifications/mark-read")
async def mark_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    user_id = str(current_user['_id'])
    await db.notifications.update_many(
        {'userId': user_id, 'read': False},
        {'$set': {'read': True}}
    )
    return {"success": True}

# create_and_send_notification now imported from deps.py
from deps import create_and_send_notification

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
    # Smart matching engine notification types
    virtual_request: bool = True
    virtual_matched: bool = True
    virtual_taken: bool = True
    missed_acceptance: bool = True
    late_warning: bool = True
    session_started: bool = True

@api_router.get("/notification-preferences")
async def get_notification_preferences(current_user: dict = Depends(get_current_user)):
    """Get user's notification preferences"""
    user_id = str(current_user['_id'])
    prefs = await db.notification_preferences.find_one({'userId': user_id}, {'_id': 0})
    if not prefs:
        # Return defaults
        return {k: True for k in ['pushEnabled'] + NOTIFICATION_TYPES}
    prefs.pop('userId', None)
    return prefs

@api_router.put("/notification-preferences")
async def update_notification_preferences(
    prefs: NotificationPreferences,
    current_user: dict = Depends(get_current_user)
):
    """Update user's notification preferences"""
    user_id = str(current_user['_id'])
    prefs_dict = prefs.dict()
    prefs_dict['userId'] = user_id
    prefs_dict['updatedAt'] = datetime.utcnow()
    await db.notification_preferences.update_one(
        {'userId': user_id},
        {'$set': prefs_dict},
        upsert=True
    )
    return {"success": True, "message": "Notification preferences updated"}



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


# ─── UBER-STYLE MATCHING ENGINE ───────────────────────────────────────

# Speed assumptions for ETA (miles per minute)
AVG_DRIVING_MPM = 0.5  # ~30 mph

def score_trainer(trainer_profile: dict, trainee_lat: float = None, trainee_lon: float = None, session_type: str = "virtual") -> dict:
    """Score a trainer for matching. Returns dict with score breakdown and ETA."""
    t_lat = trainer_profile.get("latitude")
    t_lon = trainer_profile.get("longitude")
    
    # --- ETA ---
    distance_miles = 0.0
    eta_minutes = 0.0
    if session_type != "virtual" and trainee_lat and trainee_lon and t_lat and t_lon:
        distance_miles = calculate_distance(trainee_lat, trainee_lon, t_lat, t_lon)
        eta_minutes = distance_miles / AVG_DRIVING_MPM if AVG_DRIVING_MPM > 0 else 999
    
    # ETA score: 1.0 at 0 min, 0.0 at 20+ min (for in-person)
    if session_type == "virtual":
        eta_score = 1.0  # distance irrelevant for virtual
    else:
        eta_score = max(0, 1.0 - (eta_minutes / 20.0))
    
    # --- Rating score: 0-1 ---
    avg_rating = trainer_profile.get("averageRating", 0)
    total_reviews = trainer_profile.get("totalReviews", 0)
    rating_score = (avg_rating / 5.0) if avg_rating > 0 else 0.3  # default for new trainers
    
    # --- Price score: lower = better (normalize against a $100 max) ---
    if session_type == "virtual":
        rate = trainer_profile.get("virtualRateCents", 3000)
    else:
        rate = trainer_profile.get("sessionRateCents", 5000)
    price_score = max(0, 1.0 - (rate / 15000))  # $150 = 0 score
    
    # --- Boost bonus ---
    boost_score = 1.0 if trainer_profile.get("boostActive") else 0.0
    
    # --- Responsiveness (acceptance history) ---
    acceptance_rate = trainer_profile.get("acceptanceRate", 0.7)
    responsiveness_score = min(acceptance_rate, 1.0)
    
    # --- Profile completeness ---
    has_bio = 1 if trainer_profile.get("bio") else 0
    has_photo = 1 if trainer_profile.get("profilePhoto") else 0
    has_certs = 1 if trainer_profile.get("isVerified") else 0
    completeness_score = (has_bio + has_photo + has_certs) / 3.0
    
    # --- Weighted total ---
    total = (
        eta_score * 0.40 +
        rating_score * 0.25 +
        price_score * 0.15 +
        boost_score * 0.10 +
        responsiveness_score * 0.05 +
        completeness_score * 0.05
    )
    
    return {
        "userId": trainer_profile.get("userId"),
        "score": round(total, 4),
        "eta_minutes": round(eta_minutes, 1),
        "distance_miles": round(distance_miles, 1),
        "rating": avg_rating,
        "rateCents": rate,
        "boosted": bool(trainer_profile.get("boostActive")),
    }


def get_wave_trainers(scored: list, wave_max_eta: float, session_type: str, limit: int = 3) -> list:
    """Filter scored trainers by ETA wave and return top N by score."""
    if session_type == "virtual":
        # Virtual: all trainers qualify, just sort by score
        return sorted(scored, key=lambda x: -x["score"])[:limit]
    wave = [t for t in scored if t["eta_minutes"] <= wave_max_eta]
    return sorted(wave, key=lambda x: -x["score"])[:limit]


async def run_matching_engine(
    trainee_id: str,
    trainee_name: str,
    trainee_lat: float = None,
    trainee_lon: float = None,
    session_type: str = "virtual",
    rejected_trainers: list = None,
    request_id: str = None,
    wave_number: int = 1,
):
    """
    Smart Matching Engine — scores, filters by wave/ETA, and sends
    intelligent push notifications ONLY to qualified trainers.

    Wave logic (in-person):
      Wave 1: ETA ≤ 5 min, top 3 by score
      Wave 2: ETA ≤ 10 min, top 3 by score
      Wave 3: ETA ≤ 15 min, top 5 by score
    Virtual: all eligible, top 5 by score.

    Scoring weights: ETA 40%, Rating 25%, Price 15%, Boost 10%,
    Responsiveness 5%, Completeness 5%.

    Members get priority matching bonus (+0.15 score).

    Returns (notified_ids, wave_data).
    """
    rejected = rejected_trainers or []

    # Check if trainee has active membership for priority matching
    trainee_membership = await db.memberships.find_one({
        'userId': trainee_id,
        'status': MembershipStatus.ACTIVE,
    })
    is_member = trainee_membership is not None

    # Build query — only available, qualified trainers
    query = {"isAvailable": True, "userId": {"$nin": rejected}}
    if session_type == "virtual":
        query["offersVirtual"] = True
    else:
        query["offersInPerson"] = True

    eligible = await db.trainer_profiles.find(query).to_list(100)

    # Fetch user data for profile photos
    if eligible:
        user_ids = [ObjectId(p["userId"]) for p in eligible if p.get("userId")]
        users_map = {}
        async for u in db.users.find({"_id": {"$in": user_ids}}, {"_id": 1, "profilePhoto": 1}):
            users_map[str(u["_id"])] = u
        for p in eligible:
            uid = p.get("userId")
            if uid in users_map:
                p["profilePhoto"] = users_map[uid].get("profilePhoto")

    # Check active boosts for each trainer
    now = datetime.utcnow()
    boosted_trainer_ids = set()
    active_boosts = await db.boosts.find({
        'isActive': True,
        'endDate': {'$gte': now},
    }).to_list(200)
    for b in active_boosts:
        boosted_trainer_ids.add(b.get('trainerId'))

    for p in eligible:
        p['boostActive'] = p.get('userId') in boosted_trainer_ids

    # Score all eligible trainers
    scored = [score_trainer(p, trainee_lat, trainee_lon, session_type) for p in eligible]

    # HARD ETA CAP: No trainer outside 15 min ETA can be matched (in-person only)
    MAX_ETA_MINUTES = 15
    if session_type != "virtual":
        scored = [t for t in scored if t["eta_minutes"] <= MAX_ETA_MINUTES]

    # Member priority: boost top scores for members
    if is_member:
        for t in scored:
            t['score'] = min(1.0, t['score'] + PricingRules.MEMBERSHIP_MATCHING_PRIORITY_BONUS)
            t['memberPriority'] = True

    # Filter out trainers with score below minimum threshold (quality gate)
    MIN_SCORE = 0.15
    scored = [t for t in scored if t["score"] >= MIN_SCORE]

    # Wave-based notification — ETA tiers for in-person
    if session_type == "virtual":
        top = get_wave_trainers(scored, 999, "virtual", limit=5)
    else:
        # Wave 1: ETA ≤ 5 min
        top = get_wave_trainers(scored, 5, session_type, limit=3)
        if len(top) < 2:
            # Wave 2: ETA ≤ 10 min
            top = get_wave_trainers(scored, 10, session_type, limit=3)
        if len(top) < 1:
            # Wave 3: ETA ≤ 15 min
            top = get_wave_trainers(scored, 15, session_type, limit=5)

    # Notify only the qualified top trainers
    notified = []
    wave_data = []
    for t in top:
        tid = t["userId"]
        try:
            session_label = "Virtual Live" if session_type == "virtual" else "In-Person"
            eta_text = ""
            if session_type != "virtual" and t["eta_minutes"] > 0:
                eta_text = f" (ETA: {int(t['eta_minutes'])} min)"

            await create_and_send_notification(
                tid,
                f"{session_label} Session Request",
                f"{trainee_name} needs a {session_label} trainer now!{eta_text} Accept quickly — first-accept wins.",
                "virtual_request",
                {
                    "screen": "trainer/virtual-request",
                    "requestId": request_id,
                    "sessionType": session_type,
                    "traineeId": trainee_id,
                    "waveNumber": wave_number,
                }
            )
            notified.append(tid)
            t["notifiedAt"] = datetime.utcnow().isoformat()
            wave_data.append(t)
        except Exception:
            pass

    return notified, wave_data


@api_router.post("/virtual/request")
async def create_virtual_request(current_user: dict = Depends(get_current_user)):
    """Trainee requests a virtual session — Uber-style wave matching"""
    if "trainee" not in current_user.get("roles", []):
        raise HTTPException(400, "Only trainees can request virtual sessions")

    # Check for existing active request
    existing = await db.virtual_requests.find_one({
        "traineeId": str(current_user["_id"]),
        "status": {"$in": ["searching", "matched"]}
    })
    if existing:
        return {
            "requestId": str(existing["_id"]),
            "status": existing["status"],
            "matchedTrainerId": existing.get("matchedTrainerId"),
        }

    # Get trainee location
    trainee_profile = await db.trainee_profiles.find_one(
        {"userId": str(current_user["_id"])},
        {"latitude": 1, "longitude": 1}
    )
    trainee_lat = trainee_profile.get("latitude") if trainee_profile else None
    trainee_lon = trainee_profile.get("longitude") if trainee_profile else None

    request_doc = {
        "traineeId": str(current_user["_id"]),
        "traineeName": current_user.get("fullName", "A Trainee"),
        "sessionType": "virtual",
        "status": "searching",
        "currentWave": 1,
        "matchedTrainerId": None,
        "matchedTrainerName": None,
        "notifiedTrainers": [],
        "rejectedTrainers": [],
        "waveScores": [],
        "traineeLat": trainee_lat,
        "traineeLon": trainee_lon,
        "createdAt": datetime.utcnow(),
    }
    result = await db.virtual_requests.insert_one(request_doc)
    request_id = str(result.inserted_id)

    notified, wave_data = await run_matching_engine(
        trainee_id=str(current_user["_id"]),
        trainee_name=current_user.get("fullName", "A Trainee"),
        trainee_lat=trainee_lat,
        trainee_lon=trainee_lon,
        session_type="virtual",
        request_id=request_id,
    )

    await db.virtual_requests.update_one(
        {"_id": result.inserted_id},
        {"$set": {"notifiedTrainers": notified, "waveScores": wave_data}}
    )

    return {"requestId": request_id, "status": "searching", "trainersNotified": len(notified)}


@api_router.post("/instant/request")
async def create_instant_inperson_request(current_user: dict = Depends(get_current_user)):
    """Trainee requests an instant in-person session — wave-based matching"""
    if "trainee" not in current_user.get("roles", []):
        raise HTTPException(400, "Only trainees can request sessions")

    existing = await db.virtual_requests.find_one({
        "traineeId": str(current_user["_id"]),
        "sessionType": "in_person",
        "status": {"$in": ["searching", "matched"]}
    })
    if existing:
        return {
            "requestId": str(existing["_id"]),
            "status": existing["status"],
            "matchedTrainerId": existing.get("matchedTrainerId"),
        }

    trainee_profile = await db.trainee_profiles.find_one(
        {"userId": str(current_user["_id"])},
        {"latitude": 1, "longitude": 1}
    )
    trainee_lat = trainee_profile.get("latitude") if trainee_profile else None
    trainee_lon = trainee_profile.get("longitude") if trainee_profile else None

    if not trainee_lat or not trainee_lon:
        raise HTTPException(400, "Location required for in-person instant booking. Please update your profile.")

    request_doc = {
        "traineeId": str(current_user["_id"]),
        "traineeName": current_user.get("fullName", "A Trainee"),
        "sessionType": "in_person",
        "status": "searching",
        "currentWave": 1,
        "matchedTrainerId": None,
        "matchedTrainerName": None,
        "notifiedTrainers": [],
        "rejectedTrainers": [],
        "waveScores": [],
        "traineeLat": trainee_lat,
        "traineeLon": trainee_lon,
        "createdAt": datetime.utcnow(),
    }
    result = await db.virtual_requests.insert_one(request_doc)
    request_id = str(result.inserted_id)

    notified, wave_data = await run_matching_engine(
        trainee_id=str(current_user["_id"]),
        trainee_name=current_user.get("fullName", "A Trainee"),
        trainee_lat=trainee_lat,
        trainee_lon=trainee_lon,
        session_type="in_person",
        request_id=request_id,
    )

    await db.virtual_requests.update_one(
        {"_id": result.inserted_id},
        {"$set": {"notifiedTrainers": notified, "waveScores": wave_data}}
    )

    fallback = None
    if len(notified) == 0:
        fallback = "no_trainers_nearby"

    return {
        "requestId": request_id,
        "status": "searching",
        "trainersNotified": len(notified),
        "fallback": fallback,
    }


@api_router.get("/virtual/request/{request_id}")
async def get_virtual_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Check the status of a virtual request"""
    try:
        req = await db.virtual_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(404, "Request not found")
    if not req:
        raise HTTPException(404, "Request not found")

    uid = str(current_user["_id"])
    if uid != req["traineeId"] and uid not in req.get("notifiedTrainers", []):
        raise HTTPException(403, "Not authorized")

    result = {
        "requestId": str(req["_id"]),
        "status": req["status"],
        "traineeId": req["traineeId"],
        "traineeName": req.get("traineeName"),
        "matchedTrainerId": req.get("matchedTrainerId"),
        "matchedTrainerName": req.get("matchedTrainerName"),
        "createdAt": req["createdAt"].isoformat(),
    }

    # If matched, include trainer profile data
    if req.get("matchedTrainerId"):
        trainer_user = await db.users.find_one({"_id": ObjectId(req["matchedTrainerId"])}, {"_id": 0, "password": 0})
        trainer_profile = await db.trainer_profiles.find_one({"userId": req["matchedTrainerId"]}, {"_id": 0})
        if trainer_user:
            result["trainerDetails"] = {
                "fullName": trainer_user.get("fullName", ""),
                "profilePhoto": trainer_user.get("profilePhoto"),
                "bio": trainer_profile.get("bio", "") if trainer_profile else "",
                "averageRating": trainer_profile.get("averageRating", 0) if trainer_profile else 0,
                "totalReviews": trainer_profile.get("totalReviews", 0) if trainer_profile else 0,
                "virtualRateCents": trainer_profile.get("virtualRateCents", 3000) if trainer_profile else 3000,
                "tier": calculate_trainer_tier(
                    trainer_profile.get("totalReviews", 0) if trainer_profile else 0,
                    trainer_profile.get("averageRating", 0) if trainer_profile else 0,
                    False
                ),
            }
    return result


@api_router.get("/virtual/pending")
async def get_pending_virtual_requests(current_user: dict = Depends(get_current_user)):
    """Get pending virtual requests for a trainer"""
    if "trainer" not in current_user.get("roles", []):
        raise HTTPException(400, "Only trainers can view pending requests")

    uid = str(current_user["_id"])
    requests = await db.virtual_requests.find({
        "status": "searching",
        "notifiedTrainers": uid,
        "rejectedTrainers": {"$ne": uid},
    }).sort("createdAt", -1).to_list(10)

    return [{
        "requestId": str(r["_id"]),
        "traineeName": r.get("traineeName", "A Trainee"),
        "createdAt": r["createdAt"].isoformat(),
    } for r in requests]


@api_router.post("/virtual/accept/{request_id}")
async def accept_virtual_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """
    Trainer accepts a session — first-come-first-served, atomic.
    Uses find_one_and_update to prevent double-acceptance race conditions.
    """
    if "trainer" not in current_user.get("roles", []):
        raise HTTPException(400, "Only trainers can accept requests")

    # Verification gate: trainer must be admin-verified
    trainer_profile = await db.trainer_profiles.find_one({'userId': str(current_user['_id'])})
    if not trainer_profile or trainer_profile.get('verificationStatus') != 'verified':
        raise HTTPException(403, "Your account must be verified by an admin before you can accept sessions. Please complete your verification process.")

    try:
        oid = ObjectId(request_id)
    except Exception:
        raise HTTPException(404, "Invalid request ID")

    trainer_id = str(current_user["_id"])
    trainer_name = current_user.get("fullName", "A Trainer")

    # Atomic update — ONLY succeeds if status is still 'searching'
    # This prevents double-acceptance race conditions
    result = await db.virtual_requests.find_one_and_update(
        {"_id": oid, "status": "searching"},
        {"$set": {
            "status": "matched",
            "matchedTrainerId": trainer_id,
            "matchedTrainerName": trainer_name,
            "matchedAt": datetime.utcnow(),
        }},
        return_document=True,
    )

    if not result:
        # Another trainer already accepted — race condition blocked
        return {"success": False, "message": "Another trainer has already accepted this session request."}

    session_type = result.get("sessionType", "virtual")
    session_label = "virtual" if session_type == "virtual" else "in-person"

    # Notify the trainee — include sound trigger for boxing-bell
    await create_and_send_notification(
        result["traineeId"],
        "Trainer Found!",
        f"{trainer_name} has accepted your {session_label} session request!",
        "virtual_matched",
        {
            "screen": "trainee/virtual-confirm",
            "requestId": request_id,
            "trainerId": trainer_id,
            "trainerName": trainer_name,
            "playSound": "boxing_bell",
        }
    )

    # Notify all OTHER notified trainers that this request is taken
    for tid in result.get("notifiedTrainers", []):
        if tid != trainer_id:
            await create_and_send_notification(
                tid,
                "Session Taken",
                f"Another trainer accepted this {session_label} session.",
                "virtual_taken",
                {"requestId": request_id}
            )

    return {"success": True, "message": "You have been matched with the trainee!"}


@api_router.post("/virtual/reject/{request_id}")
async def reject_virtual_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Trainer rejects a virtual session request"""
    try:
        oid = ObjectId(request_id)
    except Exception:
        raise HTTPException(404, "Invalid request ID")

    await db.virtual_requests.update_one(
        {"_id": oid},
        {"$addToSet": {"rejectedTrainers": str(current_user["_id"])}}
    )
    return {"success": True}


@api_router.post("/virtual/trainee-confirm/{request_id}")
async def trainee_confirm_match(request_id: str, current_user: dict = Depends(get_current_user)):
    """Trainee confirms the matched trainer — proceed to payment"""
    try:
        req = await db.virtual_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(404, "Request not found")
    if not req or req["traineeId"] != str(current_user["_id"]):
        raise HTTPException(403, "Not authorized")
    if req["status"] != "matched":
        raise HTTPException(400, "Request is not in matched state")

    await db.virtual_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "confirmed", "confirmedAt": datetime.utcnow()}}
    )
    return {"success": True, "trainerId": req["matchedTrainerId"]}


@api_router.post("/virtual/find-another/{request_id}")
async def trainee_find_another(request_id: str, current_user: dict = Depends(get_current_user)):
    """
    Trainee rejects matched trainer and re-enters the queue.
    - Previously matched trainer is excluded for 10 minutes (cooldown)
    - New wave of scoring runs with same rules
    - If all waves exhausted → returns exhausted=true with fallback message
    """
    try:
        req = await db.virtual_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(404, "Request not found")
    if not req or req["traineeId"] != str(current_user["_id"]):
        raise HTTPException(403, "Not authorized")

    old_trainer = req.get("matchedTrainerId")
    rejected_list = req.get("rejectedTrainers", [])
    if old_trainer and old_trainer not in rejected_list:
        rejected_list.append(old_trainer)

    # Store cooldown timestamp for rejected trainer (10-minute exclusion)
    cooldown_map = req.get("rejectedCooldowns", {})
    if old_trainer:
        cooldown_map[old_trainer] = datetime.utcnow().isoformat()

    await db.virtual_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "status": "searching",
            "matchedTrainerId": None,
            "matchedTrainerName": None,
            "rejectedTrainers": rejected_list,
            "rejectedCooldowns": cooldown_map,
        }}
    )

    # Re-run matching engine with rejected list
    session_type = req.get("sessionType", "virtual")
    t_lat = req.get("traineeLat")
    t_lon = req.get("traineeLon")
    current_wave = req.get("currentWave", 1)

    notified, wave_data = await run_matching_engine(
        trainee_id=str(current_user["_id"]),
        trainee_name=current_user.get("fullName", "A Trainee"),
        trainee_lat=t_lat,
        trainee_lon=t_lon,
        session_type=session_type,
        rejected_trainers=rejected_list,
        request_id=request_id,
        wave_number=current_wave,
    )

    # Check if all waves are exhausted (no trainers found after Wave 3)
    exhausted = len(notified) == 0 and current_wave >= 3

    await db.virtual_requests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$addToSet": {"notifiedTrainers": {"$each": notified}},
            "$set": {"waveScores": wave_data},
        }
    )

    if exhausted:
        await db.virtual_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"status": "exhausted"}}
        )
        return {
            "success": True,
            "status": "exhausted",
            "exhausted": True,
            "message": "All available trainers have been contacted. Please try again later or adjust your preferences.",
        }

    return {"success": True, "status": "searching", "exhausted": False, "trainersNotified": len(notified)}


@api_router.post("/virtual/cancel/{request_id}")
async def cancel_virtual_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a virtual session request"""
    try:
        req = await db.virtual_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(404, "Request not found")
    if not req or req["traineeId"] != str(current_user["_id"]):
        raise HTTPException(403, "Not authorized")

    await db.virtual_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "cancelled"}}
    )
    return {"success": True}

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
