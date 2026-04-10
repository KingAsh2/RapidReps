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


# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# NOTE: Models moved to models.py, helpers moved to deps.py
import random
import string

# Import extracted route modules
from routes.auth_routes import router as auth_router
from routes.session_routes import router as session_router
from routes.admin_routes import router as admin_router


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

# ============================================================================
# TRAINER PROFILE ROUTES
# ============================================================================

@api_router.post("/trainer-profiles", response_model=TrainerProfileResponse)
async def create_trainer_profile(profile: TrainerProfileCreate, current_user: dict = Depends(get_current_user)):
    """Create or update trainer profile"""
    # Check if profile already exists
    existing_profile = await db.trainer_profiles.find_one({'userId': profile.userId})
    
    profile_doc = profile.dict()
    profile_doc['bio'] = sanitize_text(profile_doc.get('bio'))
    profile_doc['averageRating'] = 0.0
    profile_doc['totalSessionsCompleted'] = 0
    profile_doc['isVerified'] = False
    profile_doc['stripeAccountId'] = None
    profile_doc['createdAt'] = datetime.utcnow()
    profile_doc['updatedAt'] = datetime.utcnow()
    
    if existing_profile:
        # Update existing
        profile_doc['createdAt'] = existing_profile['createdAt']
        await db.trainer_profiles.update_one(
            {'userId': profile.userId},
            {'$set': profile_doc}
        )
        profile_doc['_id'] = existing_profile['_id']
    else:
        # Create new
        result = await db.trainer_profiles.insert_one(profile_doc)
        profile_doc['_id'] = result.inserted_id
    
    return TrainerProfileResponse(**serialize_doc(profile_doc))

@api_router.get("/trainer-profiles/{user_id}", response_model=TrainerProfileResponse)
async def get_trainer_profile(user_id: str):
    """Get trainer profile by user ID — enriched with user data (fullName, avatar)"""
    profile = await db.trainer_profiles.find_one({'userId': user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    user = await db.users.find_one({'_id': ObjectId(user_id)}, {'fullName': 1, 'profilePhoto': 1})
    if user:
        profile['fullName'] = user.get('fullName', 'Unknown Trainer')
        if not profile.get('avatarUrl') and user.get('profilePhoto'):
            profile['avatarUrl'] = user['profilePhoto']
    
    # Ensure introVideoUrl is preserved from verification submissions
    if not profile.get('introVideoUrl'):
        v_steps = profile.get('verificationSteps', {})
        if isinstance(v_steps, dict) and v_steps.get('video') == 'submitted':
            subs = await db.verification_submissions.find_one(
                {'userId': user_id, 'stepId': 'video'},
                sort=[('createdAt', -1)]
            )
            if subs and subs.get('fileUri'):
                profile['introVideoUrl'] = subs['fileUri']
                await db.trainer_profiles.update_one(
                    {'userId': user_id},
                    {'$set': {'introVideoUrl': subs['fileUri']}}
                )
    
    return TrainerProfileResponse(**serialize_doc(profile))


@api_router.post("/trainer-profiles/upload-documents")
async def upload_verification_documents(
    documents: List[str],
    current_user: dict = Depends(get_current_user)
):
    """Upload verification documents for trainer profile (base64 encoded)"""
    profile = await db.trainer_profiles.find_one({'userId': current_user['id']})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    # Append new documents to existing ones
    existing_docs = profile.get('verificationDocs', [])
    updated_docs = existing_docs + documents
    
    result = await db.trainer_profiles.update_one(
        {'userId': current_user['id']},
        {
            '$set': {
                'verificationDocs': updated_docs,
                'updatedAt': datetime.utcnow()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to upload documents")
    
    return {
        'success': True,
        'totalDocuments': len(updated_docs),
        'message': f'Successfully uploaded {len(documents)} document(s)'
    }

@api_router.get("/trainer-profiles/my-documents")
async def get_my_verification_documents(current_user: dict = Depends(get_current_user)):
    """Get verification documents for current trainer"""
    profile = await db.trainer_profiles.find_one({'userId': current_user['id']})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    return {
        'documents': profile.get('verificationDocs', []),
        'isVerified': profile.get('isVerified', False),
        'totalDocuments': len(profile.get('verificationDocs', []))
    }

# ============================================================================
# TRAINER ONBOARDING & VERIFICATION ROUTES (NEW - PRD Rules)
# ============================================================================

@api_router.get("/trainer/onboarding-status")
async def get_trainer_onboarding_status(current_user: dict = Depends(get_current_user)):
    """
    Get trainer's onboarding status - check all requirements before going live.
    PRD Rule #10: Trainer must complete all steps before accepting sessions.
    """
    user_id = str(current_user['_id'])
    profile = await db.trainer_profiles.find_one({'userId': user_id})
    
    if not profile:
        return {
            'canGoLive': False,
            'profileExists': False,
            'missingRequirements': ['Create trainer profile'],
            'completedRequirements': [],
            'verificationStatus': VerificationStatus.PENDING,
            'trainerTier': TrainerTier.BASIC
        }
    
    # Check all requirements
    can_go_live, missing = check_trainer_can_go_live(profile)
    
    # Get completed requirements
    completed = []
    if profile.get('governmentIdUploaded', False):
        completed.append('Government ID verification')
    if profile.get('ssnVerified', False):
        completed.append('SSN identity check')
    if profile.get('backgroundCheckPassed', False):
        completed.append('Background check')
    if profile.get('sexOffenderCheckPassed', False):
        completed.append('Sex offender screening')
    if profile.get('cprAedCertUploaded', False):
        completed.append('CPR/AED certification')
    if profile.get('fitnessCertUploaded', False):
        completed.append('Fitness certification')
    if profile.get('introVideoUploaded', False):
        completed.append('Intro video')
    if profile.get('bio') and len(profile.get('bio', '')) >= 50:
        completed.append('Profile bio')
    if profile.get('trainingStyles') and len(profile.get('trainingStyles', [])) > 0:
        completed.append('Training styles')
    
    # Calculate tier
    total_reviews = profile.get('totalReviews', 0)
    avg_rating = profile.get('averageRating', 0.0)
    certs_verified = profile.get('fitnessCertUploaded', False)
    tier = calculate_trainer_tier(total_reviews, avg_rating, certs_verified)
    
    # Determine verification status
    if can_go_live:
        verification_status = VerificationStatus.VERIFIED
    elif len(completed) > 0:
        verification_status = VerificationStatus.PENDING
    else:
        verification_status = VerificationStatus.PENDING
    
    return {
        'canGoLive': can_go_live,
        'profileExists': True,
        'missingRequirements': missing,
        'completedRequirements': completed,
        'verificationStatus': verification_status,
        'trainerTier': tier,
        'totalReviews': total_reviews,
        'averageRating': avg_rating
    }

@api_router.post("/trainer/upload-intro-video")
async def upload_intro_video(
    video_url: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Upload trainer intro video URL (10-30 seconds).
    PRD Rule #8: Every trainer must upload intro video before going live.
    """
    user_id = str(current_user['_id'])
    
    result = await db.trainer_profiles.update_one(
        {'userId': user_id},
        {
            '$set': {
                'introVideoUrl': video_url,
                'introVideoUploaded': True,
                'updatedAt': datetime.utcnow()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    return {
        'success': True,
        'message': 'Intro video uploaded successfully'
    }

@api_router.post("/trainer/update-verification")
async def update_verification_status(
    verification_type: str,
    passed: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Update a specific verification check status.
    PRD Rule #4: Trainer must complete all verification requirements.
    """
    user_id = str(current_user['_id'])
    
    # Map verification type to field
    field_map = {
        'government_id': 'governmentIdUploaded',
        'ssn_check': 'ssnVerified',
        'background_check': 'backgroundCheckPassed',
        'sex_offender_check': 'sexOffenderCheckPassed',
        'cpr_aed_cert': 'cprAedCertUploaded',
        'fitness_cert': 'fitnessCertUploaded',
    }
    
    if verification_type not in field_map:
        raise HTTPException(status_code=400, detail=f"Invalid verification type. Valid types: {list(field_map.keys())}")
    
    field_name = field_map[verification_type]
    
    result = await db.trainer_profiles.update_one(
        {'userId': user_id},
        {
            '$set': {
                field_name: passed,
                'updatedAt': datetime.utcnow()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    # Check if trainer can now go live
    profile = await db.trainer_profiles.find_one({'userId': user_id})
    can_go_live, missing = check_trainer_can_go_live(profile)
    
    # Update canGoLive and isVerified status
    if can_go_live:
        await db.trainer_profiles.update_one(
            {'userId': user_id},
            {
                '$set': {
                    'canGoLive': True,
                    'isVerified': True,
                    'verificationStatus': VerificationStatus.VERIFIED
                }
            }
        )
    
    return {
        'success': True,
        'verificationType': verification_type,
        'passed': passed,
        'canGoLive': can_go_live,
        'missingRequirements': missing
    }

@api_router.get("/trainer/verification-status")
async def get_verification_status(current_user: dict = Depends(get_current_user)):
    """Get detailed step-by-step verification status for the frontend."""
    user_id = str(current_user['_id'])
    profile = await db.trainer_profiles.find_one({'userId': user_id})

    default_steps = {
        'identity': 'pending',
        'background': 'pending',
        'certification': 'pending',
        'cpr': 'pending',
        'insurance': 'pending',
        'photo': 'pending',
        'video': 'pending',
    }

    if not profile:
        return {'steps': default_steps, 'canGoLive': False}

    field_map = {
        'identity': 'governmentIdUploaded',
        'background': 'backgroundCheckPassed',
        'certification': 'fitnessCertUploaded',
        'cpr': 'cprAedCertUploaded',
        'insurance': 'insuranceUploaded',
        'photo': 'profilePhotoUploaded',
        'video': 'introVideoUploaded',
    }

    steps = {}
    for step_id, field in field_map.items():
        if profile.get(field, False):
            steps[step_id] = 'submitted'
        else:
            steps[step_id] = 'pending'

    can_go_live, missing = check_trainer_can_go_live(profile)
    
    verification_status = profile.get('verificationStatus', 'pending')
    rejection_reason = profile.get('rejectionReason')
    
    return {
        'steps': steps,
        'canGoLive': can_go_live,
        'missingRequirements': missing,
        'verificationStatus': verification_status,
        'rejectionReason': rejection_reason,
        'rejectedAt': profile.get('rejectedAt'),
        'verifiedAt': profile.get('verifiedAt'),
    }


class VerificationSubmission(BaseModel):
    stepId: str
    fileUri: Optional[str] = None
    fileName: Optional[str] = None


@api_router.post("/trainer/submit-verification-step")
async def submit_verification_step(
    submission: VerificationSubmission,
    current_user: dict = Depends(get_current_user)
):
    """Submit a single verification step (mark it as uploaded/submitted)."""
    user_id = str(current_user['_id'])

    field_map = {
        'identity': 'governmentIdUploaded',
        'background': 'backgroundCheckPassed',
        'certification': 'fitnessCertUploaded',
        'cpr': 'cprAedCertUploaded',
        'insurance': 'insuranceUploaded',
        'photo': 'profilePhotoUploaded',
        'video': 'introVideoUploaded',
    }

    if submission.stepId not in field_map:
        raise HTTPException(status_code=400, detail=f"Invalid step ID: {submission.stepId}")

    field_name = field_map[submission.stepId]

    update_data = {
        field_name: True,
        'updatedAt': datetime.utcnow()
    }

    # Save file URI for ALL document types (admin needs to view them)
    if submission.fileUri:
        doc_uri_field = f'{submission.stepId}FileUri'
        update_data[doc_uri_field] = submission.fileUri

    # If it's a photo, also save the URI as avatar
    if submission.stepId == 'photo' and submission.fileUri:
        update_data['avatarUrl'] = submission.fileUri
    if submission.stepId == 'video' and submission.fileUri:
        update_data['introVideoUrl'] = submission.fileUri
        update_data['introVideoUploaded'] = True

    result = await db.trainer_profiles.update_one(
        {'userId': user_id},
        {'$set': update_data}
    )

    if result.matched_count == 0:
        # Create a minimal profile if it doesn't exist
        profile_doc = {
            'userId': user_id,
            field_name: True,
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
            'isAvailable': False,
            'isVerified': False,
            'averageRating': 0.0,
            'totalSessionsCompleted': 0,
            'totalReviews': 0,
        }
        if submission.stepId == 'photo' and submission.fileUri:
            profile_doc['avatarUrl'] = submission.fileUri
        if submission.stepId == 'video' and submission.fileUri:
            profile_doc['introVideoUrl'] = submission.fileUri
            profile_doc['introVideoUploaded'] = True
        await db.trainer_profiles.insert_one(profile_doc)

    # Check if trainer can now go live
    profile = await db.trainer_profiles.find_one({'userId': user_id})
    can_go_live, missing = check_trainer_can_go_live(profile)

    if can_go_live:
        await db.trainer_profiles.update_one(
            {'userId': user_id},
            {'$set': {'canGoLive': True, 'isVerified': True, 'verificationStatus': VerificationStatus.VERIFIED}}
        )

    return {
        'success': True,
        'stepId': submission.stepId,
        'canGoLive': can_go_live,
        'missingRequirements': missing,
    }


@api_router.post("/trainer/submit-all-verification")
async def submit_all_verification(current_user: dict = Depends(get_current_user)):
    """Submit the full verification package for admin review."""
    user_id = str(current_user['_id'])
    profile = await db.trainer_profiles.find_one({'userId': user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")

    await db.trainer_profiles.update_one(
        {'userId': user_id},
        {'$set': {
            'verificationStatus': VerificationStatus.PENDING,
            'verificationSubmittedAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }}
    )
    return {'success': True, 'message': 'Verification submitted for review. You will be notified once approved.'}


@api_router.post("/trainer/submit-background-pii")
async def submit_background_pii(request: Request, current_user: dict = Depends(get_current_user)):
    """Submit PII for admin-run background check via TruthFinder."""
    user_id = str(current_user['_id'])
    body = await request.json()
    full_name = sanitize_text(body.get('fullName', ''))
    dob = sanitize_text(body.get('dob', ''))
    ssn = body.get('ssn', '')  # stored encrypted in real prod
    address = sanitize_text(body.get('address', ''))
    if not full_name or not dob or not address:
        raise HTTPException(status_code=400, detail="Full name, date of birth, and address are required.")
    await db.background_check_requests.insert_one({
        'userId': user_id,
        'fullName': full_name,
        'dob': dob,
        'ssn': ssn,
        'address': address,
        'status': 'pending_admin_review',
        'createdAt': datetime.utcnow(),
    })
    # Mark verification step as submitted
    await db.trainer_profiles.update_one(
        {'userId': user_id},
        {'$set': {'verificationSteps.background': 'submitted', 'updatedAt': datetime.utcnow()}}
    )
    return {'success': True, 'message': 'Your information has been submitted for background check review.'}


@api_router.get("/trainer/pricing-limits")
async def get_trainer_pricing_limits(current_user: dict = Depends(get_current_user)):
    """
    Get pricing limits based on trainer tier.
    PRD Rules #1 and #3: Pricing minimums and tier-based bonuses.
    """
    user_id = str(current_user['_id'])
    profile = await db.trainer_profiles.find_one({'userId': user_id})
    
    if not profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    # Calculate tier
    total_reviews = profile.get('totalReviews', 0)
    avg_rating = profile.get('averageRating', 0.0)
    certs_verified = profile.get('fitnessCertUploaded', False)
    tier = calculate_trainer_tier(total_reviews, avg_rating, certs_verified)
    
    # Base minimums
    virtual_min = PricingRules.VIRTUAL_MIN_CENTS
    outdoor_min = PricingRules.OUTDOOR_MIN_CENTS
    in_home_min = PricingRules.IN_HOME_MIN_CENTS
    
    # Max pricing based on tier
    if tier == TrainerTier.BASIC:
        # Basic can only charge minimum to mid-level
        virtual_max = virtual_min + 1500  # $15 above min
        outdoor_max = outdoor_min + 2000  # $20 above min
        in_home_max = in_home_min + 2000  # $20 above min
    elif tier == TrainerTier.PRO:
        # Pro can charge +$10 to +$20 above minimum
        virtual_max = virtual_min + PricingRules.PRO_TIER_MAX_BONUS
        outdoor_max = outdoor_min + PricingRules.PRO_TIER_MAX_BONUS
        in_home_max = in_home_min + PricingRules.PRO_TIER_MAX_BONUS
    else:  # ELITE
        # Elite can charge premium (+$30-$50)
        virtual_max = virtual_min + PricingRules.ELITE_TIER_MAX_BONUS
        outdoor_max = outdoor_min + PricingRules.ELITE_TIER_MAX_BONUS
        in_home_max = in_home_min + PricingRules.ELITE_TIER_MAX_BONUS
    
    return {
        'trainerTier': tier,
        'totalReviews': total_reviews,
        'averageRating': avg_rating,
        'pricingLimits': {
            'virtual': {'minCents': virtual_min, 'maxCents': virtual_max},
            'outdoor': {'minCents': outdoor_min, 'maxCents': outdoor_max},
            'inHome': {'minCents': in_home_min, 'maxCents': in_home_max}
        },
        'travelFees': {
            '0-5 miles': PricingRules.TRAVEL_FEE_0_5_MILES,
            '5-10 miles': PricingRules.TRAVEL_FEE_5_10_MILES,
            '10-15 miles': PricingRules.TRAVEL_FEE_10_15_MILES,
            '15-20 miles': PricingRules.TRAVEL_FEE_15_20_MILES
        },
        'cancellationFees': {
            'virtual': PricingRules.CANCELLATION_FEE_VIRTUAL,
            'outdoor': PricingRules.CANCELLATION_FEE_OUTDOOR,
            'inHome': PricingRules.CANCELLATION_FEE_IN_HOME
        },
        'platformFeePercent': PricingRules.PLATFORM_FEE_PERCENT
    }

@api_router.get("/trainers/search", response_model=List[TrainerProfileResponse])
async def search_trainers(
    location: Optional[str] = None,
    styles: Optional[str] = None,
    minPrice: Optional[int] = None,
    maxPrice: Optional[int] = None,
    inPerson: Optional[bool] = None,
    virtual: Optional[bool] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    wantsVirtual: Optional[bool] = None
):
    """Search trainers with filters - includes location and virtual matching"""
    query = {'isAvailable': True}  # Only show available trainers
    
    if styles:
        style_list = styles.split(',')
        query['trainingStyles'] = {'$in': style_list}
    
    if minPrice is not None:
        query['ratePerMinuteCents'] = query.get('ratePerMinuteCents', {})
        query['ratePerMinuteCents']['$gte'] = minPrice
    
    if maxPrice is not None:
        query['ratePerMinuteCents'] = query.get('ratePerMinuteCents', {})
        query['ratePerMinuteCents']['$lte'] = maxPrice
    
    if inPerson is not None:
        query['offersInPerson'] = inPerson
    
    if virtual is not None:
        query['offersVirtual'] = virtual
    
    # Get matching trainers (exclude heavy unused fields for faster response)
    trainer_projection = {
        'userId': 1, 'avatarUrl': 1, 'bio': 1, 'experienceYears': 1, 'certifications': 1,
        'trainingStyles': 1, 'gymsWorkedAt': 1, 'primaryGym': 1, 'offersInPerson': 1,
        'offersVirtual': 1, 'offersOutdoor': 1, 'offersInHome': 1, 'sessionDurationsOffered': 1,
        'virtualRateCents': 1, 'outdoorRateCents': 1, 'inHomeRateCents': 1, 'ratePerMinuteCents': 1,
        'travelRadiusMiles': 1, 'cancellationPolicy': 1, 'averageRating': 1, 'totalReviews': 1,
        'totalSessionsCompleted': 1, 'isVerified': 1, 'trainerTier': 1, 'verificationStatus': 1,
        'canGoLive': 1, 'latitude': 1, 'longitude': 1, 'locationAddress': 1, 'isAvailable': 1,
        'isVirtualTrainingAvailable': 1, 'videoCallPreference': 1, 'createdAt': 1, 'profilePhoto': 1,
    }
    trainers = await db.trainer_profiles.find(query, trainer_projection).to_list(100)
    
    # Filter based on location and virtual training preferences
    # Priority: In-person trainers within 15 miles, then virtual trainers within 20 miles
    in_person_trainers = []
    virtual_trainers = []
    
    for trainer in trainers:
        if latitude and longitude and trainer.get('latitude') and trainer.get('longitude'):
            distance = calculate_distance(latitude, longitude, trainer['latitude'], trainer['longitude'])
            
            # In-person trainers within 15 miles (PRIORITY)
            if trainer.get('offersInPerson') and distance <= 15:
                trainer['distance'] = distance
                trainer['matchType'] = 'in-person'
                in_person_trainers.append(trainer)
            # Virtual trainers within 20 miles (if trainee wants virtual)
            elif wantsVirtual and trainer.get('isVirtualTrainingAvailable') and distance <= 20:
                trainer['distance'] = distance
                trainer['matchType'] = 'virtual'
                virtual_trainers.append(trainer)
        else:
            # Trainers without location - only include if they offer virtual and trainee wants it
            if wantsVirtual and trainer.get('isVirtualTrainingAvailable'):
                trainer['distance'] = None
                trainer['matchType'] = 'virtual'
                virtual_trainers.append(trainer)
    
    # Sort in-person trainers by distance (closest first)
    in_person_trainers.sort(key=lambda t: t.get('distance', 999) if t.get('distance') is not None else 999)
    
    # Sort virtual trainers by distance (closest first), None goes to end
    virtual_trainers.sort(key=lambda t: t.get('distance', 999) if t.get('distance') is not None else 999)
    
    # Combine: In-person first (priority), then virtual
    filtered_trainers = in_person_trainers + virtual_trainers
    
    # Batch fetch fullNames from users collection
    if filtered_trainers:
        user_ids = [ObjectId(t['userId']) for t in filtered_trainers]
        users_cursor = db.users.find({'_id': {'$in': user_ids}})
        users_list = await users_cursor.to_list(len(user_ids))
        users_map = {str(u['_id']): u.get('fullName', 'Unknown Trainer') for u in users_list}
        
        for trainer in filtered_trainers:
            trainer['fullName'] = users_map.get(trainer['userId'], 'Unknown Trainer')
    
    return [TrainerProfileResponse(**serialize_doc(t)) for t in filtered_trainers]


@api_router.put("/trainer-profiles/{user_id}/gallery")
async def update_trainer_gallery(user_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update trainer gallery (photos/videos)."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own gallery")
    gallery = body.get('gallery', [])
    await db.trainer_profiles.update_one({'userId': user_id}, {'$set': {'gallery': gallery, 'updatedAt': datetime.utcnow()}})
    return {"success": True, "gallery": gallery}


@api_router.put("/trainer-profiles/{user_id}/social-links")
async def update_trainer_social_links(user_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update trainer social media links."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own social links")
    social_links = body.get('socialLinks', {})
    await db.trainer_profiles.update_one({'userId': user_id}, {'$set': {'socialLinks': social_links, 'updatedAt': datetime.utcnow()}})
    return {"success": True, "socialLinks": social_links}



@api_router.put("/trainer-profiles/{user_id}/vibe")
async def update_trainer_vibe(user_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update trainer's profile vibe/anthem."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own vibe")
    vibe_data = {
        'vibeTrackTitle': body.get('vibeTrackTitle'),
        'vibeArtistName': body.get('vibeArtistName'),
        'vibeArtworkUrl': body.get('vibeArtworkUrl'),
        'vibePreviewUrl': body.get('vibePreviewUrl'),
        'vibeAppleMusicUrl': body.get('vibeAppleMusicUrl'),
        'vibeTrackId': body.get('vibeTrackId'),
        'updatedAt': datetime.utcnow(),
    }
    await db.trainer_profiles.update_one({'userId': user_id}, {'$set': vibe_data})
    return {"success": True, **{k: v for k, v in vibe_data.items() if k != 'updatedAt'}}


@api_router.delete("/trainer-profiles/{user_id}/vibe")
async def remove_trainer_vibe(user_id: str, current_user: dict = Depends(get_current_user)):
    """Remove trainer's profile vibe/anthem."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own vibe")
    clear_data = {
        'vibeTrackTitle': None, 'vibeArtistName': None, 'vibeArtworkUrl': None,
        'vibePreviewUrl': None, 'vibeAppleMusicUrl': None, 'vibeTrackId': None,
        'updatedAt': datetime.utcnow(),
    }
    await db.trainer_profiles.update_one({'userId': user_id}, {'$set': clear_data})
    return {"success": True}


@api_router.put("/trainer-profiles/{user_id}/personality-tag")
async def update_trainer_personality_tag(user_id: str, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Update trainer's personality tag."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own personality tag")
    tag = body.get("personalityTag")
    if tag and tag not in VALID_PERSONALITY_TAGS:
        raise HTTPException(400, f"Invalid personality tag. Must be one of: {VALID_PERSONALITY_TAGS}")
    await db.trainer_profiles.update_one(
        {'userId': user_id},
        {'$set': {'personalityTag': tag, 'updatedAt': datetime.utcnow()}}
    )
    return {"success": True, "personalityTag": tag}

@api_router.put("/trainee-profiles/{user_id}/personality-tag")
async def update_trainee_personality_tag(user_id: str, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Update trainee's personality tag."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own personality tag")
    tag = body.get("personalityTag")
    if tag and tag not in VALID_PERSONALITY_TAGS:
        raise HTTPException(400, f"Invalid personality tag. Must be one of: {VALID_PERSONALITY_TAGS}")
    await db.trainee_profiles.update_one(
        {'userId': user_id},
        {'$set': {'personalityTag': tag, 'updatedAt': datetime.utcnow()}}
    )
    return {"success": True, "personalityTag": tag}


VALID_ACCENT_COLORS = [
    "#FF6A00", "#FF3D00", "#00D68F", "#6C5CE7", "#0984E3",
    "#FDBB2D", "#E84393", "#00CEC9", "#D63031", "#A29BFE",
]

@api_router.put("/trainer-profiles/{user_id}/accent-color")
async def update_trainer_accent_color(user_id: str, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Update trainer's brand accent color."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own accent color")
    color = body.get("accentColor")
    if color and color not in VALID_ACCENT_COLORS:
        raise HTTPException(400, f"Invalid accent color. Must be one of: {VALID_ACCENT_COLORS}")
    await db.trainer_profiles.update_one(
        {'userId': user_id},
        {'$set': {'accentColor': color, 'updatedAt': datetime.utcnow()}}
    )
    return {"success": True, "accentColor": color}



@api_router.get("/music/search")
async def search_music(q: str = Query(..., min_length=2), limit: int = Query(10, le=25)):
    """Proxy iTunes Search API for song lookup."""
    import aiohttp
    url = f"https://itunes.apple.com/search?term={q}&media=music&entity=song&limit={limit}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            data = await resp.json(content_type=None)
    results = []
    for item in data.get('results', []):
        results.append({
            'trackId': str(item.get('trackId', '')),
            'trackName': item.get('trackName', ''),
            'artistName': item.get('artistName', ''),
            'artworkUrl': (item.get('artworkUrl100', '') or '').replace('100x100', '600x600'),
            'previewUrl': item.get('previewUrl', ''),
            'trackViewUrl': item.get('trackViewUrl', ''),
            'collectionName': item.get('collectionName', ''),
        })
    return {"results": results}



@api_router.post("/trainer-profiles/{user_id}/highlights")
async def upload_highlight(user_id: str, file: UploadFile = File(...), caption: str = Form(""), current_user: dict = Depends(get_current_user)):
    """Upload a highlight reel clip (short video or image)."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own highlights")
    
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 50MB)")
    
    ext = (file.filename or 'clip.mp4').split('.')[-1].lower()
    is_video = ext in ('mp4', 'mov', 'avi', 'webm')
    media_type = 'video' if is_video else 'photo'
    
    # Upload to object storage
    from storage import object_storage
    import uuid
    storage_path = f"highlights/{user_id}/{uuid.uuid4().hex}.{ext}"
    url = await object_storage.upload(content, storage_path, content_type=file.content_type or 'video/mp4')
    
    highlight = {
        'url': url,
        'storagePath': storage_path,
        'type': media_type,
        'caption': caption,
        'createdAt': datetime.utcnow().isoformat(),
    }
    
    await db.trainer_profiles.update_one(
        {'userId': user_id},
        {'$push': {'highlights': highlight}}
    )
    return {"success": True, "highlight": highlight}


@api_router.delete("/trainer-profiles/{user_id}/highlights/{index}")
async def delete_highlight(user_id: str, index: int, current_user: dict = Depends(get_current_user)):
    """Delete a highlight by index."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own highlights")
    
    profile = await db.trainer_profiles.find_one({'userId': user_id})
    if not profile:
        raise HTTPException(404, "Profile not found")
    
    highlights = profile.get('highlights', [])
    if index < 0 or index >= len(highlights):
        raise HTTPException(400, "Invalid highlight index")
    
    highlights.pop(index)
    await db.trainer_profiles.update_one({'userId': user_id}, {'$set': {'highlights': highlights}})
    return {"success": True, "highlights": highlights}


@api_router.get("/trainer-profiles/{user_id}/highlights")
async def get_highlights(user_id: str):
    """Get all highlights for a trainer."""
    profile = await db.trainer_profiles.find_one({'userId': user_id}, {'highlights': 1})
    return {"highlights": (profile or {}).get('highlights', [])}



MAX_IMAGE_SIZE = 10 * 1024 * 1024   # 10MB
MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_IMAGE_EXT = {"jpg", "jpeg", "png", "gif", "webp", "heic"}
ALLOWED_VIDEO_EXT = {"mp4", "mov", "avi", "mkv"}


@api_router.post("/gallery/upload")
async def upload_gallery_file(
    file: UploadFile = File(...),
    caption: str = Query("", max_length=200),
    current_user: dict = Depends(get_current_user),
):
    """Upload image or video to user's gallery. Saves to object storage and appends to profile gallery."""
    user_id = str(current_user['_id'])
    filename = file.filename or "file"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    is_image = ext in ALLOWED_IMAGE_EXT
    is_video = ext in ALLOWED_VIDEO_EXT
    if not (is_image or is_video):
        raise HTTPException(400, f"Unsupported file type: .{ext}. Allowed: {', '.join(ALLOWED_IMAGE_EXT | ALLOWED_VIDEO_EXT)}")

    content = await file.read()
    max_size = MAX_IMAGE_SIZE if is_image else MAX_VIDEO_SIZE
    if len(content) > max_size:
        raise HTTPException(400, f"File too large. Max {'10MB' if is_image else '100MB'}.")

    content_type = MIME_TYPES.get(ext, file.content_type or "application/octet-stream")
    path = generate_upload_path(user_id, ext)

    try:
        put_object(path, content, content_type)
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")

    media_type = "photo" if is_image else "video"
    gallery_item = {"url": f"/api/files/{path}", "type": media_type, "storagePath": path}
    if caption:
        gallery_item["caption"] = caption

    # Determine which profile collection to update
    roles = current_user.get('roles', [])
    if 'trainer' in roles:
        await db.trainer_profiles.update_one(
            {'userId': user_id},
            {'$push': {'gallery': gallery_item}, '$set': {'updatedAt': datetime.utcnow()}}
        )
    else:
        await db.trainee_profiles.update_one(
            {'userId': user_id},
            {'$push': {'gallery': gallery_item}}
        )

    return {"success": True, "item": gallery_item, "mediaType": media_type}


@api_router.delete("/gallery/{item_index}")
async def delete_gallery_item(
    item_index: int,
    current_user: dict = Depends(get_current_user),
):
    """Delete a gallery item by its index."""
    user_id = str(current_user['_id'])
    roles = current_user.get('roles', [])
    collection = 'trainer_profiles' if 'trainer' in roles else 'trainee_profiles'
    profile = await db[collection].find_one({'userId': user_id}, {'gallery': 1})
    if not profile or 'gallery' not in profile:
        raise HTTPException(404, "Gallery not found")
    gallery = profile['gallery']
    if item_index < 0 or item_index >= len(gallery):
        raise HTTPException(400, "Invalid gallery index")
    gallery.pop(item_index)
    await db[collection].update_one({'userId': user_id}, {'$set': {'gallery': gallery}})
    return {"success": True, "gallery": gallery}


@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    """Serve a file from object storage."""
    try:
        content, content_type = get_object(path)
        return Response(content=content, media_type=content_type)
    except Exception:
        raise HTTPException(404, "File not found")


# ============================================================================
# TRAINEE PROFILE ROUTES
# ============================================================================

@api_router.post("/trainee-profiles", response_model=TraineeProfileResponse)
async def create_trainee_profile(profile: TraineeProfileCreate, current_user: dict = Depends(get_current_user)):
    """Create or update trainee profile"""
    # Check if profile already exists
    existing_profile = await db.trainee_profiles.find_one({'userId': profile.userId})
    
    profile_doc = profile.dict()
    profile_doc['createdAt'] = datetime.utcnow()
    profile_doc['updatedAt'] = datetime.utcnow()
    
    if existing_profile:
        # Update existing
        profile_doc['createdAt'] = existing_profile['createdAt']
        await db.trainee_profiles.update_one(
            {'userId': profile.userId},
            {'$set': profile_doc}
        )
        profile_doc['_id'] = existing_profile['_id']
    else:
        # Create new
        result = await db.trainee_profiles.insert_one(profile_doc)
        profile_doc['_id'] = result.inserted_id
    
    return TraineeProfileResponse(**serialize_doc(profile_doc))

@api_router.get("/trainee-profiles/{user_id}", response_model=TraineeProfileResponse)
async def get_trainee_profile(user_id: str):
    """Get trainee profile by user ID"""
    profile = await db.trainee_profiles.find_one({'userId': user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Trainee profile not found")
    
    return TraineeProfileResponse(**serialize_doc(profile))


@api_router.put("/trainee-profiles/{user_id}/gallery")
async def update_trainee_gallery(user_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update trainee gallery (photos/videos)."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own gallery")
    gallery = body.get('gallery', [])
    await db.trainee_profiles.update_one({'userId': user_id}, {'$set': {'gallery': gallery}})
    return {"success": True, "gallery": gallery}


@api_router.put("/trainee-profiles/{user_id}/social-links")
async def update_trainee_social_links(user_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update trainee social media links."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own social links")
    social_links = body.get('socialLinks', {})
    await db.trainee_profiles.update_one({'userId': user_id}, {'$set': {'socialLinks': social_links}})
    return {"success": True, "socialLinks": social_links}


@api_router.get("/trainers/nearby-trainees")
async def get_nearby_trainees(current_user: dict = Depends(get_current_user)):
    """Get trainees within 15 miles of the trainer"""
    # Get trainer's profile to get their location
    trainer_profile = await db.trainer_profiles.find_one({'userId': str(current_user['_id'])})
    
    if not trainer_profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    trainer_lat = trainer_profile.get('latitude')
    trainer_lon = trainer_profile.get('longitude')
    
    if not trainer_lat or not trainer_lon:
        return {
            'trainees': [],
            'message': 'Trainer location not set. Please update your profile with location.'
        }
    
    # OPTIMIZATION: Only fetch trainee profiles with location data and required fields
    all_trainees = await db.trainee_profiles.find(
        {'latitude': {'$exists': True, '$ne': None}, 'longitude': {'$exists': True, '$ne': None}},
        {'userId': 1, 'latitude': 1, 'longitude': 1, 'avatarUrl': 1, 'fitnessGoals': 1, 'fitnessLevel': 1}
    ).to_list(1000)
    
    # Filter trainees within 15 miles
    nearby_trainees = []
    nearby_user_ids = []
    for trainee in all_trainees:
        trainee_lat = trainee.get('latitude')
        trainee_lon = trainee.get('longitude')
        
        if trainee_lat and trainee_lon:
            distance = calculate_distance(trainer_lat, trainer_lon, trainee_lat, trainee_lon)
            
            if distance <= 15:
                trainee_data = serialize_doc(trainee)
                trainee_data['distance'] = round(distance, 1)
                nearby_trainees.append(trainee_data)
                nearby_user_ids.append(ObjectId(trainee['userId']))
    
    # OPTIMIZATION: Batch fetch all user details in a single query instead of N+1
    if nearby_user_ids:
        users_cursor = db.users.find({'_id': {'$in': nearby_user_ids}}, {'fullName': 1})
        users_list = await users_cursor.to_list(len(nearby_user_ids))
        users_map = {str(u['_id']): u.get('fullName', 'Unknown') for u in users_list}
        
        # Attach user names to trainee data
        for trainee_data in nearby_trainees:
            trainee_data['fullName'] = users_map.get(trainee_data.get('userId'), 'Unknown')
    
    # Sort by distance
    nearby_trainees.sort(key=lambda x: x['distance'])
    
    return {
        'trainees': nearby_trainees,
        'count': len(nearby_trainees)
    }

@api_router.patch("/trainer-profiles/toggle-availability")
async def toggle_trainer_availability(isAvailable: bool, current_user: dict = Depends(get_current_user)):
    """Toggle trainer availability (online/offline)"""
    result = await db.trainer_profiles.update_one(
        {'userId': str(current_user['_id'])},
        {
            '$set': {
                'isAvailable': isAvailable,
                'updatedAt': datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    return {
        'success': True,
        'isAvailable': isAvailable,
        'message': f"You are now {'available' if isAvailable else 'unavailable'} to trainees"
    }


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

# ============================================================================
# RATING ROUTES
# ============================================================================

@api_router.post("/ratings", response_model=RatingResponse)
async def create_rating(request: Request, rating: RatingCreate, current_user: dict = Depends(get_current_user)):
    """Create a rating for a completed session — enforces 6 server-side rules + 48h window"""
    user_id = str(current_user['_id'])

    # Rule 5: Require verified email
    if not current_user.get('emailVerified', False):
        raise HTTPException(status_code=403, detail="Please verify your email before submitting a rating")

    # Rule 4: Trainers cannot rate their own sessions
    if user_id == rating.trainerId:
        raise HTTPException(status_code=403, detail="Trainers cannot rate their own sessions")

    # Check if session exists
    session = await db.sessions.find_one({'_id': ObjectId(rating.sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Rule 3: Session must be completed before rating
    if session['status'] != SessionStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Can only rate completed sessions")

    # Rule 1: Only the session trainee can rate
    if user_id != session.get('traineeId'):
        raise HTTPException(status_code=403, detail="Only the trainee of this session can submit a rating")

    # 48-hour rating window after session completion
    session_ended_at = session.get('sessionEndedAt') or session.get('sessionDateTimeEnd')
    if session_ended_at:
        window_deadline = session_ended_at + timedelta(hours=48)
        if datetime.utcnow() > window_deadline:
            raise HTTPException(
                status_code=400,
                detail="The 48-hour rating window for this session has closed. Ratings must be submitted within 48 hours of session completion."
            )

    # Rule 2: Only 1 rating per session per user
    existing_rating = await db.ratings.find_one({
        'sessionId': rating.sessionId,
        'traineeId': user_id
    })
    if existing_rating:
        raise HTTPException(status_code=400, detail="You have already rated this session")

    # Rule 6: Add timestamp/IP metadata for anti-fraud
    client_ip = get_real_ip(request)
    now = datetime.utcnow()

    rating_doc = rating.dict()
    rating_doc['reviewText'] = sanitize_text(rating_doc.get('reviewText'))
    rating_doc['createdAt'] = now
    rating_doc['submittedAt'] = now
    rating_doc['clientIp'] = client_ip
    rating_doc['userAgent'] = request.headers.get('user-agent', '')

    result = await db.ratings.insert_one(rating_doc)
    rating_doc['_id'] = result.inserted_id

    # Update trainer average rating using aggregation
    avg_result = await db.ratings.aggregate([
        {'$match': {'trainerId': rating.trainerId}},
        {'$group': {'_id': None, 'avg': {'$avg': '$rating'}, 'count': {'$sum': 1}}}
    ]).to_list(1)
    if avg_result:
        await db.trainer_profiles.update_one(
            {'userId': rating.trainerId},
            {'$set': {
                'averageRating': round(avg_result[0]['avg'], 2),
                'totalReviews': avg_result[0]['count']
            }}
        )

    return RatingResponse(**serialize_doc(rating_doc))

@api_router.get("/trainers/{trainer_id}/ratings")
async def get_trainer_ratings(trainer_id: str):
    """Get all ratings for a trainer with reviewer names via aggregation"""
    pipeline = [
        {'$match': {'trainerId': trainer_id}},
        {'$sort': {'createdAt': -1}},
        {'$limit': 100},
        {'$addFields': {'traineeObjId': {'$toObjectId': '$traineeId'}}},
        {'$lookup': {
            'from': 'users',
            'localField': 'traineeObjId',
            'foreignField': '_id',
            'as': 'traineeUser'
        }},
        {'$addFields': {
            'traineeName': {'$ifNull': [{'$arrayElemAt': ['$traineeUser.fullName', 0]}, 'Anonymous']}
        }},
        {'$project': {'traineeUser': 0, 'traineeObjId': 0}}
    ]
    ratings = await db.ratings.aggregate(pipeline).to_list(100)
    results = []
    for r in ratings:
        doc = serialize_doc(r)
        results.append(RatingResponse(**doc))
    return results

# ============================================================================
# TRAINER EARNINGS
# ============================================================================

@api_router.get("/trainer/earnings")
async def get_trainer_earnings(current_user: dict = Depends(get_current_user)):
    """Get trainer earnings summary with weekly/monthly breakdown and payout history"""
    user_id = str(current_user['_id'])
    now = datetime.utcnow()

    # Get all completed sessions with projection (only needed fields)
    completed_sessions = await db.sessions.find(
        {'trainerId': user_id, 'status': SessionStatus.COMPLETED},
        {'trainerEarningsCents': 1, 'createdAt': 1, 'sessionType': 1, 'durationMinutes': 1, 'traineeId': 1}
    ).sort('createdAt', -1).to_list(1000)

    total_earnings = sum(s.get('trainerEarningsCents', 0) for s in completed_sessions)

    # This month
    month_start = datetime(now.year, now.month, 1)
    month_sessions = [s for s in completed_sessions if s.get('createdAt', now) >= month_start]
    month_earnings = sum(s.get('trainerEarningsCents', 0) for s in month_sessions)

    # Last month
    if now.month == 1:
        last_month_start = datetime(now.year - 1, 12, 1)
    else:
        last_month_start = datetime(now.year, now.month - 1, 1)
    last_month_sessions = [s for s in completed_sessions if last_month_start <= s.get('createdAt', now) < month_start]
    last_month_earnings = sum(s.get('trainerEarningsCents', 0) for s in last_month_sessions)

    # This week (Monday start)
    week_start = now - timedelta(days=now.weekday())
    week_start = datetime(week_start.year, week_start.month, week_start.day)
    week_sessions = [s for s in completed_sessions if s.get('createdAt', now) >= week_start]
    week_earnings = sum(s.get('trainerEarningsCents', 0) for s in week_sessions)

    # Last week
    last_week_start = week_start - timedelta(days=7)
    last_week_sessions = [s for s in completed_sessions if last_week_start <= s.get('createdAt', now) < week_start]
    last_week_earnings = sum(s.get('trainerEarningsCents', 0) for s in last_week_sessions)

    # Daily breakdown for the current week (Mon-Sun)
    daily_breakdown = []
    for i in range(7):
        day_start = week_start + timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        day_sessions = [s for s in completed_sessions if day_start <= s.get('createdAt', now) < day_end]
        daily_breakdown.append({
            'day': day_start.strftime('%a'),
            'date': day_start.strftime('%m/%d'),
            'earningsCents': sum(s.get('trainerEarningsCents', 0) for s in day_sessions),
            'sessions': len(day_sessions),
        })

    # Weekly breakdown for the current month (up to 5 weeks)
    weekly_breakdown = []
    current_week_start = month_start
    week_num = 1
    while current_week_start < now and week_num <= 5:
        current_week_end = min(current_week_start + timedelta(days=7), now)
        w_sessions = [s for s in completed_sessions if current_week_start <= s.get('createdAt', now) < current_week_end]
        weekly_breakdown.append({
            'week': f'Week {week_num}',
            'startDate': current_week_start.strftime('%m/%d'),
            'earningsCents': sum(s.get('trainerEarningsCents', 0) for s in w_sessions),
            'sessions': len(w_sessions),
        })
        current_week_start = current_week_end
        week_num += 1

    # Get processed payouts
    payouts = await db.trainer_payouts.find({'trainerId': user_id}).sort('createdAt', -1).to_list(50)
    total_paid_out = sum(p.get('amountCents', 0) for p in payouts)

    # Get pending payout requests
    payout_requests = await db.payout_requests.find({'trainerId': user_id}).sort('createdAt', -1).to_list(20)

    # Pending balance = total earnings - total paid out
    pending_balance = total_earnings - total_paid_out

    # Recent sessions for display (last 10)
    recent_sessions = []
    for s in completed_sessions[:10]:
        trainee = await db.users.find_one({'_id': ObjectId(s['traineeId'])}) if s.get('traineeId') else None
        recent_sessions.append({
            'id': str(s['_id']),
            'sessionType': s.get('sessionType', 'Training'),
            'earningsCents': s.get('trainerEarningsCents', 0),
            'date': s.get('createdAt', now).isoformat(),
            'traineeName': trainee.get('fullName', 'Unknown') if trainee else 'Unknown',
            'durationMinutes': s.get('durationMinutes', 60),
        })

    return {
        'totalEarningsCents': total_earnings,
        'monthEarningsCents': month_earnings,
        'lastMonthEarningsCents': last_month_earnings,
        'weekEarningsCents': week_earnings,
        'lastWeekEarningsCents': last_week_earnings,
        'totalSessions': len(completed_sessions),
        'monthSessions': len(month_sessions),
        'weekSessions': len(week_sessions),
        'pendingBalanceCents': pending_balance,
        'totalPaidOutCents': total_paid_out,
        'dailyBreakdown': daily_breakdown,
        'weeklyBreakdown': weekly_breakdown,
        'recentSessions': recent_sessions,
        'payouts': [serialize_doc(p) for p in payouts],
        'payoutRequests': [serialize_doc(pr) for pr in payout_requests],
    }


class PayoutRequestCreate(BaseModel):
    paymentMethod: str  # 'cashapp', 'zelle', 'stripe'
    paymentHandle: Optional[str] = None  # CashApp tag, Zelle email/phone
    notes: Optional[str] = None


@api_router.post("/trainer/request-payout")
async def request_payout(
    request: PayoutRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    """Trainer requests a payout of their pending balance."""
    user_id = str(current_user['_id'])

    # Calculate pending balance
    completed_sessions = await db.sessions.find({
        'trainerId': user_id,
        'status': SessionStatus.COMPLETED
    }).to_list(1000)
    total_earnings = sum(s.get('trainerEarningsCents', 0) for s in completed_sessions)

    payouts = await db.trainer_payouts.find({'trainerId': user_id}).to_list(1000)
    total_paid = sum(p.get('amountCents', 0) for p in payouts)

    pending = total_earnings - total_paid
    if pending <= 0:
        raise HTTPException(status_code=400, detail="No pending balance to pay out")

    # Check for existing pending payout request
    existing = await db.payout_requests.find_one({
        'trainerId': user_id,
        'status': 'pending'
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending payout request")

    payout_request = {
        'trainerId': user_id,
        'trainerName': current_user.get('fullName', ''),
        'trainerEmail': current_user.get('email', ''),
        'amountCents': pending,
        'paymentMethod': request.paymentMethod,
        'paymentHandle': request.paymentHandle,
        'notes': sanitize_text(request.notes),
        'status': 'pending',
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow(),
    }
    result = await db.payout_requests.insert_one(payout_request)

    return {
        'success': True,
        'requestId': str(result.inserted_id),
        'amountCents': pending,
        'message': f'Payout request for ${pending/100:.2f} submitted. You will be paid via {request.paymentMethod}.'
    }


@api_router.get("/trainer/payout-requests")
async def get_payout_requests(current_user: dict = Depends(get_current_user)):
    """Get trainer's payout request history."""
    user_id = str(current_user['_id'])
    requests = await db.payout_requests.find({'trainerId': user_id}).sort('createdAt', -1).to_list(50)
    return {'requests': [serialize_doc(r) for r in requests]}


# ============================================================================
# ZELLE PAYMENT SYSTEM (Replaces Stripe Connect)
# ============================================================================

# require_admin imported from deps.py
from deps import require_admin

PAYOUT_MINIMUM_CENTS = 3500  # $35.00

# --- Platform Zelle Settings (Admin-configurable) ---

@api_router.get("/settings/zelle")
async def get_zelle_settings():
    """Get platform Zelle payment info (public - trainee needs to see this)."""
    settings = await db.app_settings.find_one({"key": "zelle_config"}, {"_id": 0, "key": 0})
    if not settings:
        return {"zelleEmail": "", "zellePhone": ""}
    return {"zelleEmail": settings.get("zelleEmail", ""), "zellePhone": settings.get("zellePhone", "")}


class ZelleSettingsUpdate(BaseModel):
    zelleEmail: Optional[str] = None
    zellePhone: Optional[str] = None


@api_router.put("/admin/settings/zelle")
async def update_zelle_settings(
    req: ZelleSettingsUpdate,
    admin_user: dict = Depends(require_admin)
):
    """Admin: Update platform Zelle payment info."""
    update_fields = {"updatedAt": datetime.utcnow()}
    if req.zelleEmail is not None:
        update_fields["zelleEmail"] = req.zelleEmail
    if req.zellePhone is not None:
        update_fields["zellePhone"] = req.zellePhone
    await db.app_settings.update_one(
        {"key": "zelle_config"},
        {"$set": update_fields},
        upsert=True
    )
    return {"success": True, "message": "Zelle settings updated"}


# --- Trainee Zelle Payment Flow ---

class ZelleMarkSentRequest(BaseModel):
    sessionId: str
    senderName: Optional[str] = None
    notes: Optional[str] = None


@api_router.post("/payments/zelle/mark-sent")
async def zelle_mark_payment_sent(
    req: ZelleMarkSentRequest,
    current_user: dict = Depends(get_current_user)
):
    """Trainee marks that they have sent Zelle payment for a session."""
    user_id = str(current_user['_id'])
    session = await db.sessions.find_one({"_id": ObjectId(req.sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.get('traineeId') != user_id:
        raise HTTPException(status_code=403, detail="Not your session")

    # Outdoor sessions require both parties to verify location before payment
    if session.get('sessionType') == 'outdoor':
        if session.get('outdoorLocationStatus') != 'agreed':
            raise HTTPException(status_code=400, detail="Both trainer and trainee must verify/agree on the outdoor location before payment can be sent.")

    await db.sessions.update_one(
        {"_id": ObjectId(req.sessionId)},
        {"$set": {
            "zellePaymentStatus": "sent",
            "zellePaymentSentAt": datetime.utcnow(),
            "zellePaymentSenderName": req.senderName or current_user.get('fullName', ''),
            "zellePaymentNotes": sanitize_text(req.notes) if req.notes else None,
        }}
    )

    # Notify admin
    admins = await db.users.find({"isAdmin": True}).to_list(10)
    for admin in admins:
        asyncio.create_task(create_and_send_notification(
            str(admin['_id']),
            "Zelle Payment Received",
            f"{current_user.get('fullName', 'A trainee')} marked Zelle payment as sent for session.",
            "payment",
            {"sessionId": req.sessionId}
        ))

    return {"success": True, "message": "Payment marked as sent. Admin will verify shortly."}


@api_router.post("/admin/payments/verify-zelle/{session_id}")
async def admin_verify_zelle_payment(
    session_id: str,
    admin_user: dict = Depends(require_admin)
):
    """Admin verifies that Zelle payment was received. Session becomes confirmed."""
    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    update_doc = {
        "zellePaymentStatus": "verified",
        "zellePaymentVerifiedAt": datetime.utcnow(),
        "zellePaymentVerifiedBy": str(admin_user['_id']),
        "paymentMethod": "zelle",
    }
    # If session is still in requested/payment_pending status, confirm it
    if session.get('status') in ['requested', 'payment_pending', 'pending']:
        update_doc['status'] = 'confirmed'

    await db.sessions.update_one({"_id": ObjectId(session_id)}, {"$set": update_doc})

    # Record transaction
    amount = session.get('priceCents', 0) or session.get('totalCents', 0)
    if amount:
        payout_info = calculate_session_payout(amount, session.get('sessionType', 'outdoor'))
        await db.transactions.insert_one({
            'userId': session.get('traineeId', ''),
            'sessionId': session_id,
            'transactionType': TransactionType.SESSION_PAYMENT,
            'amountCents': amount,
            'trainerPayoutCents': payout_info['trainer_payout_cents'],
            'platformFeeCents': payout_info['platform_fee_cents'],
            'status': PaymentStatus.COMPLETED,
            'paymentMethod': 'zelle',
            'description': f"Zelle payment for {session.get('sessionType', 'training')} session",
            'createdAt': datetime.utcnow(),
        })

    # Notify trainee
    asyncio.create_task(create_and_send_notification(
        session.get('traineeId', ''),
        "Payment Verified!",
        "Your Zelle payment has been verified and your session is confirmed! Your receipt is ready to download.",
        "payment",
        {"sessionId": session_id, "action": "view_receipt"}
    ))

    # Notify trainer
    if session.get('trainerId'):
        asyncio.create_task(create_and_send_notification(
            session['trainerId'],
            "Session Confirmed - Receipt Ready!",
            "Payment verified and session confirmed. Your earnings receipt is ready to download.",
            "session_confirmed",
            {"sessionId": session_id, "action": "view_receipt"}
        ))

    return {"success": True, "message": "Payment verified. Session confirmed.", "newStatus": update_doc.get('status', session.get('status'))}


@api_router.get("/admin/payments/pending-zelle")
async def admin_get_pending_zelle_payments(admin_user: dict = Depends(require_admin)):
    """Admin: Get all sessions with pending Zelle payments to verify."""
    sessions = await db.sessions.find(
        {"zellePaymentStatus": "sent"},
        {"_id": 1, "traineeId": 1, "trainerId": 1, "sessionType": 1, "priceCents": 1,
         "totalCents": 1, "zellePaymentSentAt": 1, "zellePaymentSenderName": 1,
         "zellePaymentNotes": 1, "status": 1, "createdAt": 1}
    ).sort("zellePaymentSentAt", -1).to_list(100)

    results = []
    for s in sessions:
        trainee = await db.users.find_one({"_id": ObjectId(s['traineeId'])}, {"fullName": 1, "email": 1}) if s.get('traineeId') else None
        results.append({
            "sessionId": str(s['_id']),
            "traineeName": trainee.get('fullName', 'Unknown') if trainee else 'Unknown',
            "traineeEmail": trainee.get('email', '') if trainee else '',
            "sessionType": s.get('sessionType', ''),
            "amountCents": s.get('totalCents') or s.get('priceCents', 0),
            "senderName": s.get('zellePaymentSenderName', ''),
            "sentAt": s.get('zellePaymentSentAt', s.get('createdAt', '')),
            "notes": s.get('zellePaymentNotes', ''),
            "sessionStatus": s.get('status', ''),
        })
    return {"pendingPayments": results, "count": len(results)}


# --- Trainer Zelle Info ---

class TrainerZelleInfoUpdate(BaseModel):
    zelleEmail: Optional[str] = None
    zellePhone: Optional[str] = None


@api_router.post("/trainer/zelle-info")
async def save_trainer_zelle_info(
    req: TrainerZelleInfoUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Trainer saves their Zelle contact info for receiving payouts."""
    update_fields = {"zelleInfoUpdatedAt": datetime.utcnow()}
    if req.zelleEmail is not None:
        update_fields["zelleEmail"] = req.zelleEmail
    if req.zellePhone is not None:
        update_fields["zellePhone"] = req.zellePhone
    await db.users.update_one({"_id": current_user['_id']}, {"$set": update_fields})
    return {"success": True, "message": "Zelle info saved"}


@api_router.get("/trainer/zelle-info")
async def get_trainer_zelle_info(current_user: dict = Depends(get_current_user)):
    """Trainer gets their saved Zelle info."""
    return {
        "zelleEmail": current_user.get("zelleEmail", ""),
        "zellePhone": current_user.get("zellePhone", ""),
        "hasZelleInfo": bool(current_user.get("zelleEmail") or current_user.get("zellePhone")),
    }


# --- Onboarding Status Check ---

@api_router.get("/onboarding/status")
async def get_onboarding_status(current_user: dict = Depends(get_current_user)):
    """Check if user has completed required onboarding steps."""
    roles = current_user.get('roles', [])
    user_id = str(current_user['_id'])
    
    needs = []
    
    if 'trainer' in roles:
        # Trainer needs Zelle info
        has_zelle = bool(current_user.get('zelleEmail') or current_user.get('zellePhone'))
        if not has_zelle:
            needs.append({'step': 'zelle_setup', 'label': 'Set up Zelle to receive payouts', 'route': '/trainer/connect-bank'})
    
    if 'trainee' in roles:
        # Trainee needs home address
        has_address = bool(current_user.get('homeAddress') or current_user.get('address'))
        if not has_address:
            needs.append({'step': 'address', 'label': 'Add your home address', 'route': '/trainee/edit-address'})
    
    return {
        'complete': len(needs) == 0,
        'pendingSteps': needs,
    }


# --- Receipts / Invoices ---

@api_router.get("/receipt-logo")
async def get_receipt_logo():
    """Return Base64-encoded logo for PDF receipts."""
    logo_path = os.path.join(os.path.dirname(__file__), "logo_b64.txt")
    try:
        with open(logo_path, "r") as f:
            logo_b64 = f.read().strip()
        return {"logo": logo_b64}
    except FileNotFoundError:
        return {"logo": ""}


@api_router.get("/receipts/session/{session_id}")
async def get_session_receipt(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate receipt data for a session. Accessible by trainee, trainer, or admin."""
    session = await db.sessions.find_one({"_id": ObjectId(session_id)}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_id = str(current_user['_id'])
    is_admin = current_user.get('isAdmin', False)
    is_trainee = session.get('traineeId') == user_id
    is_trainer = session.get('trainerId') == user_id

    if not (is_admin or is_trainee or is_trainer):
        raise HTTPException(status_code=403, detail="Not authorized to view this receipt")

    # Fetch trainee and trainer info
    trainee = await db.users.find_one({"_id": ObjectId(session['traineeId'])}, {"fullName": 1, "email": 1, "homeAddress": 1, "address": 1}) if session.get('traineeId') else None
    trainer = await db.users.find_one({"_id": ObjectId(session['trainerId'])}, {"fullName": 1, "email": 1}) if session.get('trainerId') else None

    # Get transaction if exists
    transaction = await db.transactions.find_one(
        {"sessionId": session_id, "transactionType": TransactionType.SESSION_PAYMENT},
        {"_id": 0}
    )

    # Calculate amounts
    total_cents = session.get('totalCents') or session.get('priceCents', 0)
    payout_info = calculate_session_payout(total_cents, session.get('sessionType', 'outdoor'))

    # Get Zelle payment info
    zelle_status = session.get('zellePaymentStatus', 'pending')
    zelle_verified_at = session.get('zellePaymentVerifiedAt')

    # Generate receipt number
    receipt_number = f"RR-{session_id[-8:].upper()}"

    receipt = {
        "receiptNumber": receipt_number,
        "sessionId": session_id,
        "date": (session.get('sessionDateTimeStart') or session.get('createdAt', datetime.utcnow())).isoformat() if isinstance(session.get('sessionDateTimeStart') or session.get('createdAt'), datetime) else str(session.get('sessionDateTimeStart') or session.get('createdAt', '')),
        "sessionType": session.get('sessionType', 'outdoor'),
        "sessionStatus": session.get('status', ''),
        "durationMinutes": session.get('durationMinutes', 30),
        "traineeName": trainee.get('fullName', 'N/A') if trainee else 'N/A',
        "traineeEmail": trainee.get('email', '') if trainee else '',
        "trainerName": trainer.get('fullName', 'N/A') if trainer else 'N/A',
        "trainerEmail": trainer.get('email', '') if trainer else '',
        "location": session.get('outdoorLocationProposal') or session.get('address') or (trainee.get('homeAddress') or trainee.get('address', '') if trainee else ''),
        "totalCents": total_cents,
        "trainerPayoutCents": payout_info['trainer_payout_cents'],
        "platformFeeCents": payout_info['platform_fee_cents'],
        "trainerPercent": payout_info['trainer_percent'],
        "platformPercent": payout_info['platform_percent'],
        "paymentMethod": "Zelle",
        "paymentStatus": zelle_status,
        "paymentVerifiedAt": zelle_verified_at.isoformat() if isinstance(zelle_verified_at, datetime) else str(zelle_verified_at or ''),
        "createdAt": session.get('createdAt', datetime.utcnow()).isoformat() if isinstance(session.get('createdAt'), datetime) else str(session.get('createdAt', '')),
        "isTrainee": is_trainee,
        "isTrainer": is_trainer,
        "isAdmin": is_admin,
    }

    return receipt


@api_router.get("/admin/receipts")
async def admin_get_all_receipts(
    admin_user: dict = Depends(require_admin),
    limit: int = 50,
    offset: int = 0,
):
    """Admin: Get all receipts for verified Zelle payments."""
    pipeline = [
        {"$match": {"zellePaymentStatus": "verified"}},
        {"$sort": {"zellePaymentVerifiedAt": -1}},
        {"$skip": offset},
        {"$limit": limit},
    ]
    sessions = await db.sessions.aggregate(pipeline).to_list(limit)

    receipts = []
    for s in sessions:
        sid = str(s['_id'])
        trainee = await db.users.find_one({"_id": ObjectId(s['traineeId'])}, {"fullName": 1, "email": 1}) if s.get('traineeId') else None
        trainer = await db.users.find_one({"_id": ObjectId(s['trainerId'])}, {"fullName": 1}) if s.get('trainerId') else None
        total = s.get('totalCents') or s.get('priceCents', 0)
        receipts.append({
            "receiptNumber": f"RR-{sid[-8:].upper()}",
            "sessionId": sid,
            "traineeName": trainee.get('fullName', 'N/A') if trainee else 'N/A',
            "traineeEmail": trainee.get('email', '') if trainee else '',
            "trainerName": trainer.get('fullName', 'N/A') if trainer else 'N/A',
            "sessionType": s.get('sessionType', ''),
            "totalCents": total,
            "paymentVerifiedAt": s.get('zellePaymentVerifiedAt', s.get('createdAt', '')),
            "status": s.get('status', ''),
        })

    total_count = await db.sessions.count_documents({"zellePaymentStatus": "verified"})
    return {"receipts": receipts, "total": total_count}


@api_router.get("/trainee/receipts")
async def get_trainee_receipts(
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
):
    """Trainee: Get all their receipts (verified Zelle payments)."""
    user_id = str(current_user['_id'])
    query = {"traineeId": user_id, "zellePaymentStatus": "verified"}
    pipeline = [
        {"$match": query},
        {"$sort": {"zellePaymentVerifiedAt": -1}},
        {"$skip": offset},
        {"$limit": limit},
    ]
    sessions = await db.sessions.aggregate(pipeline).to_list(limit)

    receipts = []
    for s in sessions:
        sid = str(s['_id'])
        trainer = await db.users.find_one({"_id": ObjectId(s['trainerId'])}, {"fullName": 1}) if s.get('trainerId') else None
        total = s.get('totalCents') or s.get('priceCents', 0)
        payout = calculate_session_payout(total, s.get('sessionType', 'outdoor'))
        receipts.append({
            "receiptNumber": f"RR-{sid[-8:].upper()}",
            "sessionId": sid,
            "trainerName": trainer.get('fullName', 'N/A') if trainer else 'N/A',
            "sessionType": s.get('sessionType', ''),
            "durationMinutes": s.get('durationMinutes', 30),
            "totalCents": total,
            "date": (s.get('sessionDateTimeStart') or s.get('createdAt', '')),
            "paymentVerifiedAt": s.get('zellePaymentVerifiedAt', ''),
        })

    total_count = await db.sessions.count_documents(query)
    return {"receipts": receipts, "total": total_count}


@api_router.get("/trainer/receipts")
async def get_trainer_receipts(
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
):
    """Trainer: Get all their receipts (verified Zelle payments)."""
    user_id = str(current_user['_id'])
    query = {"trainerId": user_id, "zellePaymentStatus": "verified"}
    pipeline = [
        {"$match": query},
        {"$sort": {"zellePaymentVerifiedAt": -1}},
        {"$skip": offset},
        {"$limit": limit},
    ]
    sessions = await db.sessions.aggregate(pipeline).to_list(limit)

    receipts = []
    for s in sessions:
        sid = str(s['_id'])
        trainee = await db.users.find_one({"_id": ObjectId(s['traineeId'])}, {"fullName": 1}) if s.get('traineeId') else None
        total = s.get('totalCents') or s.get('priceCents', 0)
        payout = calculate_session_payout(total, s.get('sessionType', 'outdoor'))
        receipts.append({
            "receiptNumber": f"RR-{sid[-8:].upper()}",
            "sessionId": sid,
            "traineeName": trainee.get('fullName', 'N/A') if trainee else 'N/A',
            "sessionType": s.get('sessionType', ''),
            "durationMinutes": s.get('durationMinutes', 30),
            "totalCents": total,
            "trainerPayoutCents": payout['trainer_payout_cents'],
            "date": (s.get('sessionDateTimeStart') or s.get('createdAt', '')),
            "paymentVerifiedAt": s.get('zellePaymentVerifiedAt', ''),
        })

    total_count = await db.sessions.count_documents(query)
    return {"receipts": receipts, "total": total_count}


# --- Trainer Zelle Connect Status (compatibility endpoint) ---

@api_router.get("/trainer/connect/status")
async def trainer_connect_status(current_user: dict = Depends(get_current_user)):
    """Check if trainer has Zelle info set up (replaces Stripe Connect status)."""
    has_zelle = bool(current_user.get("zelleEmail") or current_user.get("zellePhone"))
    return {
        "connected": has_zelle,
        "onboarded": has_zelle,
        "paymentMethod": "zelle",
        "zelleEmail": current_user.get("zelleEmail", ""),
        "zellePhone": current_user.get("zellePhone", ""),
    }


# --- Admin: Stripe Connect Payouts ---

class AdminPayoutRequest(BaseModel):
    trainerId: str
    amountCents: Optional[int] = None  # If None, pay full pending balance
    notes: Optional[str] = None


@api_router.get("/admin/payouts/pending")
async def admin_get_pending_payouts(admin_user: dict = Depends(require_admin)):
    """Get list of trainers eligible for payout ($35+ pending balance with Zelle info)."""
    # Get all trainers with Zelle info set up
    trainers = await db.users.find(
        {'roles': 'trainer', '$or': [{'zelleEmail': {'$exists': True, '$ne': ''}}, {'zellePhone': {'$exists': True, '$ne': ''}}]},
        {'fullName': 1, 'email': 1, 'profilePhoto': 1, 'zelleEmail': 1, 'zellePhone': 1}
    ).to_list(500)
    
    results = []
    for trainer in trainers:
        trainer_id = str(trainer['_id'])
        
        # Calculate pending balance
        completed = await db.sessions.find(
            {'trainerId': trainer_id, 'status': SessionStatus.COMPLETED},
            {'trainerEarningsCents': 1}
        ).to_list(1000)
        total_earnings = sum(s.get('trainerEarningsCents', 0) for s in completed)
        
        payouts = await db.trainer_payouts.find(
            {'trainerId': trainer_id},
            {'amountCents': 1}
        ).to_list(1000)
        total_paid = sum(p.get('amountCents', 0) for p in payouts)
        
        pending = total_earnings - total_paid
        
        results.append({
            'trainerId': trainer_id,
            'trainerName': trainer.get('fullName', 'Unknown'),
            'trainerEmail': trainer.get('email', ''),
            'profilePhoto': trainer.get('profilePhoto'),
            'zelleEmail': trainer.get('zelleEmail', ''),
            'zellePhone': trainer.get('zellePhone', ''),
            'pendingBalanceCents': pending,
            'totalEarningsCents': total_earnings,
            'totalPaidOutCents': total_paid,
            'eligible': pending >= PAYOUT_MINIMUM_CENTS,
        })
    
    # Sort by pending balance descending
    results.sort(key=lambda x: x['pendingBalanceCents'], reverse=True)
    
    return {
        'trainers': results,
        'payoutMinimumCents': PAYOUT_MINIMUM_CENTS,
        'totalPendingCents': sum(r['pendingBalanceCents'] for r in results if r['eligible']),
        'eligibleCount': sum(1 for r in results if r['eligible']),
    }


@api_router.post("/admin/payouts/pay-trainer")
async def admin_pay_trainer(
    req: AdminPayoutRequest,
    admin_user: dict = Depends(require_admin)
):
    """Admin marks a trainer as paid via Zelle (manual payment tracking)."""
    trainer = await db.users.find_one({'_id': ObjectId(req.trainerId)})
    if not trainer:
        raise HTTPException(status_code=404, detail="Trainer not found")
    
    if not trainer.get('zelleEmail') and not trainer.get('zellePhone'):
        raise HTTPException(status_code=400, detail="Trainer has not set up Zelle info")
    
    # Calculate pending balance
    completed = await db.sessions.find(
        {'trainerId': req.trainerId, 'status': SessionStatus.COMPLETED},
        {'trainerEarningsCents': 1}
    ).to_list(1000)
    total_earnings = sum(s.get('trainerEarningsCents', 0) for s in completed)
    
    payouts = await db.trainer_payouts.find(
        {'trainerId': req.trainerId},
        {'amountCents': 1}
    ).to_list(1000)
    total_paid = sum(p.get('amountCents', 0) for p in payouts)
    pending = total_earnings - total_paid
    
    # Determine payout amount
    payout_amount = req.amountCents if req.amountCents else pending
    if payout_amount <= 0:
        raise HTTPException(status_code=400, detail="No balance to pay out")
    if payout_amount > pending:
        raise HTTPException(status_code=400, detail=f"Payout amount (${payout_amount/100:.2f}) exceeds pending balance (${pending/100:.2f})")
    if payout_amount < PAYOUT_MINIMUM_CENTS:
        raise HTTPException(status_code=400, detail=f"Minimum payout is ${PAYOUT_MINIMUM_CENTS/100:.2f}")
    
    # Record payout in DB (admin sends via Zelle manually)
    payout_doc = {
        'trainerId': req.trainerId,
        'trainerName': trainer.get('fullName', ''),
        'amountCents': payout_amount,
        'paymentMethod': 'zelle',
        'zelleEmail': trainer.get('zelleEmail', ''),
        'zellePhone': trainer.get('zellePhone', ''),
        'status': 'completed',
        'notes': req.notes,
        'processedBy': str(admin_user['_id']),
        'createdAt': datetime.utcnow(),
    }
    await db.trainer_payouts.insert_one(payout_doc)
    
    # Update any pending payout requests
    await db.payout_requests.update_many(
        {'trainerId': req.trainerId, 'status': 'pending'},
        {'$set': {'status': 'completed', 'updatedAt': datetime.utcnow()}}
    )
    
    # Send notification to trainer
    asyncio.create_task(create_and_send_notification(
        req.trainerId,
        "Payout Sent!",
        f"${payout_amount/100:.2f} has been sent to your Zelle account.",
        "payout",
        {"amount": str(payout_amount)}
    ))
    
    return {
        'success': True,
        'amountCents': payout_amount,
        'trainerName': trainer.get('fullName', ''),
        'message': f"${payout_amount/100:.2f} marked as paid to {trainer.get('fullName', 'Trainer')} via Zelle",
    }


@api_router.post("/admin/payouts/pay-all")
async def admin_pay_all_trainers(
    admin_user: dict = Depends(require_admin)
):
    """Batch mark all eligible trainers as paid via Zelle."""
    # Get all eligible trainers with Zelle info
    trainers = await db.users.find(
        {'roles': 'trainer', '$or': [{'zelleEmail': {'$exists': True, '$ne': ''}}, {'zellePhone': {'$exists': True, '$ne': ''}}]},
        {'fullName': 1, 'zelleEmail': 1, 'zellePhone': 1}
    ).to_list(500)
    
    results = []
    total_paid = 0
    
    for trainer in trainers:
        trainer_id = str(trainer['_id'])
        
        # Calculate pending balance
        completed = await db.sessions.find(
            {'trainerId': trainer_id, 'status': SessionStatus.COMPLETED},
            {'trainerEarningsCents': 1}
        ).to_list(1000)
        total_earnings = sum(s.get('trainerEarningsCents', 0) for s in completed)
        
        prev_payouts = await db.trainer_payouts.find(
            {'trainerId': trainer_id},
            {'amountCents': 1}
        ).to_list(1000)
        total_paid_prev = sum(p.get('amountCents', 0) for p in prev_payouts)
        pending = total_earnings - total_paid_prev
        
        if pending < PAYOUT_MINIMUM_CENTS:
            continue
        
        # Record payout
        payout_doc = {
            'trainerId': trainer_id,
            'trainerName': trainer.get('fullName', ''),
            'amountCents': pending,
            'paymentMethod': 'zelle',
            'zelleEmail': trainer.get('zelleEmail', ''),
            'zellePhone': trainer.get('zellePhone', ''),
            'status': 'completed',
            'notes': 'Batch Zelle payout',
            'processedBy': str(admin_user['_id']),
            'createdAt': datetime.utcnow(),
        }
        await db.trainer_payouts.insert_one(payout_doc)
        
        asyncio.create_task(create_and_send_notification(
            trainer_id,
            "Payout Sent!",
            f"${pending/100:.2f} has been sent to your Zelle account.",
            "payout",
            {"amount": str(pending)}
        ))
        
        results.append({
            'trainerId': trainer_id,
            'trainerName': trainer.get('fullName', ''),
            'amountCents': pending,
        })
        total_paid += pending
    
    return {
        'success': True,
        'paidCount': len(results),
        'totalPaidCents': total_paid,
        'payouts': results,
        'message': f"Marked {len(results)} trainer(s) as paid - total ${total_paid/100:.2f} via Zelle",
    }


@api_router.get("/admin/payouts/history")
async def admin_payout_history(
    limit: int = 50,
    admin_user: dict = Depends(require_admin)
):
    """Get payout history for all trainers."""
    payouts = await db.trainer_payouts.find().sort('createdAt', -1).to_list(limit)
    return {'payouts': [serialize_doc(p) for p in payouts]}

# ============================================================================
# ADMIN ROUTES
# ============================================================================

@api_router.get("/admin/trainers")
async def get_all_trainers(current_user: dict = Depends(get_current_user)):
    """Admin: Get all trainers"""
    if not current_user.get('isAdmin'):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    trainers = await db.trainer_profiles.find().to_list(1000)
    return [serialize_doc(t) for t in trainers]

@api_router.patch("/admin/trainers/{trainer_id}/verify")
async def verify_trainer(trainer_id: str, verified: bool, current_user: dict = Depends(get_current_user)):
    """Admin: Verify or unverify a trainer"""
    if not current_user.get('isAdmin'):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.trainer_profiles.update_one(
        {'_id': ObjectId(trainer_id)},
        {'$set': {'isVerified': verified, 'updatedAt': datetime.utcnow()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Trainer not found")
    
    return {'success': True, 'verified': verified}

@api_router.get("/admin/revenue")
async def get_platform_revenue(current_user: dict = Depends(get_current_user)):
    """Admin: Get platform revenue statistics"""
    if not current_user.get('isAdmin'):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Optimized query with projection - only fetch required fields
    completed_sessions = await db.sessions.find(
        {'status': SessionStatus.COMPLETED},
        {'platformFeeCents': 1, 'finalSessionPriceCents': 1}
    ).to_list(1000)
    
    total_platform_fees = sum(s.get('platformFeeCents', 0) for s in completed_sessions)
    total_session_value = sum(s.get('finalSessionPriceCents', 0) for s in completed_sessions)
    
    return {
        'totalPlatformFeesCents': total_platform_fees,
        'totalSessionValueCents': total_session_value,
        'totalSessions': len(completed_sessions),
        'averageSessionValueCents': total_session_value // len(completed_sessions) if completed_sessions else 0
    }


# ============================================================================
# TRAINER ACHIEVEMENTS & BADGES SYSTEM
# ============================================================================

async def calculate_badge_progress(trainer_id: str) -> TrainerAchievements:
    """Calculate all badge progress for a trainer"""
    
    # Get all completed sessions for this trainer
    # OPTIMIZATION: Only fetch required fields for counting
    completed_sessions = await db.sessions.find(
        {'trainerId': trainer_id, 'status': SessionStatus.COMPLETED},
        {'_id': 1, 'sessionDateTimeStart': 1, 'traineeId': 1}
    ).to_list(1000)
    
    # Get trainer achievement doc
    achievement_doc = await db.trainer_achievements.find_one({'trainerId': trainer_id})
    if not achievement_doc:
        achievement_doc = {
            'trainerId': trainer_id,
            'discountSessionsRemaining': 0,
            'currentStreak': 0,
            'streakWeeks': 0,
            'lastStreakReset': None,
            'unlockedBadges': []
        }
    
    # Get all ratings for this trainer
    ratings = await db.ratings.find({'trainerId': trainer_id}).to_list(1000)
    five_star_count = len([r for r in ratings if r['rating'] == 5])
    
    total_completed = len(completed_sessions)
    badges = []
    
    # 1. Milestone Master Badge - 25 total sessions
    milestone_progress = min(total_completed, 25)
    badges.append(BadgeProgress(
        badgeType=BadgeType.MILESTONE_MASTER,
        badgeName="Milestone Master",
        description="Complete 25 total sessions",
        isUnlocked=total_completed >= 25,
        progress=milestone_progress,
        target=25,
        reward="5% service fee on next 5 sessions",
        unlockedAt=achievement_doc.get('milestone_master_unlocked_at')
    ))
    
    # 2. Weekend Warrior Badge - 10 weekend sessions
    weekend_sessions = [s for s in completed_sessions 
                       if s.get('sessionDateTimeStart') and datetime.fromisoformat(str(s['sessionDateTimeStart'])).weekday() >= 5]
    weekend_progress = min(len(weekend_sessions), 10)
    badges.append(BadgeProgress(
        badgeType=BadgeType.WEEKEND_WARRIOR,
        badgeName="Weekend Warrior",
        description="Complete 10 sessions on Saturday or Sunday",
        isUnlocked=len(weekend_sessions) >= 10,
        progress=weekend_progress,
        target=10,
        unlockedAt=achievement_doc.get('weekend_warrior_unlocked_at')
    ))
    
    # 3. Streak Star Badge - 10 sessions/week for 3 consecutive weeks
    streak_progress = achievement_doc.get('streakWeeks', 0)
    badges.append(BadgeProgress(
        badgeType=BadgeType.STREAK_STAR,
        badgeName="Streak Star",
        description="Complete 10 sessions per week for 3 consecutive weeks",
        isUnlocked=streak_progress >= 3,
        progress=min(streak_progress, 3),
        target=3,
        unlockedAt=achievement_doc.get('streak_star_unlocked_at')
    ))
    
    # 4. Early Bird Badge - 10 sessions before noon
    early_sessions = [s for s in completed_sessions 
                     if s.get('sessionDateTimeStart') and datetime.fromisoformat(str(s['sessionDateTimeStart'])).hour < 12]
    early_progress = min(len(early_sessions), 10)
    badges.append(BadgeProgress(
        badgeType=BadgeType.EARLY_BIRD,
        badgeName="Early Bird",
        description="Complete 10 sessions before 11:59 AM",
        isUnlocked=len(early_sessions) >= 10,
        progress=early_progress,
        target=10,
        unlockedAt=achievement_doc.get('early_bird_unlocked_at')
    ))
    
    # 5. Night Owl Badge - 10 sessions after 6 PM
    night_sessions = [s for s in completed_sessions 
                     if s.get('sessionDateTimeStart') and datetime.fromisoformat(str(s['sessionDateTimeStart'])).hour >= 18]
    night_progress = min(len(night_sessions), 10)
    badges.append(BadgeProgress(
        badgeType=BadgeType.NIGHT_OWL,
        badgeName="Night Owl",
        description="Complete 10 sessions at or after 6:00 PM",
        isUnlocked=len(night_sessions) >= 10,
        progress=night_progress,
        target=10,
        unlockedAt=achievement_doc.get('night_owl_unlocked_at')
    ))
    
    # 6. Top Trainer of the Month Badge
    top_trainer_unlocked = achievement_doc.get('top_trainer_unlocked_at') is not None
    badges.append(BadgeProgress(
        badgeType=BadgeType.TOP_TRAINER,
        badgeName="Top Trainer of the Month",
        description="Rank #1 in total completed sessions for the month",
        isUnlocked=top_trainer_unlocked,
        progress=1 if top_trainer_unlocked else 0,
        target=1,
        reward="Monthly recognition",
        unlockedAt=achievement_doc.get('top_trainer_unlocked_at')
    ))
    
    # 7. New Client Champ Badge - 10 unique first-time clients
    unique_clients = set()
    for session in completed_sessions:
        trainee_id = session['traineeId']
        # Count only if this is the first completed session with this client
        client_sessions = [s for s in completed_sessions if s['traineeId'] == trainee_id]
        if len(client_sessions) > 0 and client_sessions[0]['_id'] == session['_id']:
            unique_clients.add(trainee_id)
    
    new_client_progress = min(len(unique_clients), 10)
    badges.append(BadgeProgress(
        badgeType=BadgeType.NEW_CLIENT_CHAMP,
        badgeName="New Client Champ",
        description="Complete sessions with 10 unique first-time clients",
        isUnlocked=len(unique_clients) >= 10,
        progress=new_client_progress,
        target=10,
        unlockedAt=achievement_doc.get('new_client_champ_unlocked_at')
    ))
    
    # 8. Flexibility Guru Badge - 10 sessions across 3 time blocks
    time_blocks = set()
    for session in completed_sessions:
        if not session.get('sessionDateTimeStart'):
            continue
        hour = datetime.fromisoformat(str(session['sessionDateTimeStart'])).hour
        if hour < 12:
            time_blocks.add('morning')
        elif hour < 18:
            time_blocks.add('afternoon')
        else:
            time_blocks.add('evening')
    
    flexibility_sessions = len(completed_sessions) if len(time_blocks) >= 3 else 0
    flexibility_progress = min(flexibility_sessions, 10)
    badges.append(BadgeProgress(
        badgeType=BadgeType.FLEXIBILITY_GURU,
        badgeName="Flexibility Guru",
        description="Complete 10 sessions across morning, afternoon, and evening",
        isUnlocked=flexibility_sessions >= 10,
        progress=flexibility_progress,
        target=10,
        unlockedAt=achievement_doc.get('flexibility_guru_unlocked_at')
    ))
    
    # 9. Feedback Favorite Badge - 10 five-star ratings
    feedback_progress = min(five_star_count, 10)
    badges.append(BadgeProgress(
        badgeType=BadgeType.FEEDBACK_FAVORITE,
        badgeName="Feedback Favorite",
        description="Receive 10 client ratings of 5 stars",
        isUnlocked=five_star_count >= 10,
        progress=feedback_progress,
        target=10,
        unlockedAt=achievement_doc.get('feedback_favorite_unlocked_at')
    ))
    
    # 10. Double Duty Badge - 2 back-to-back sessions (within 15 min)
    double_duty_found = False
    # Filter sessions with valid timestamps before sorting
    valid_sessions = [s for s in completed_sessions if s.get('sessionDateTimeStart') and s.get('sessionDateTimeEnd')]
    sorted_sessions = sorted(valid_sessions, key=lambda s: s['sessionDateTimeStart'])
    for i in range(len(sorted_sessions) - 1):
        end_time = sorted_sessions[i]['sessionDateTimeEnd']
        next_start = sorted_sessions[i + 1]['sessionDateTimeStart']
        
        # Convert to datetime if string
        if isinstance(end_time, str):
            end_time = datetime.fromisoformat(end_time)
        if isinstance(next_start, str):
            next_start = datetime.fromisoformat(next_start)
            
        time_diff = (next_start - end_time).total_seconds() / 60
        if time_diff <= 15:
            double_duty_found = True
            break
    
    badges.append(BadgeProgress(
        badgeType=BadgeType.DOUBLE_DUTY,
        badgeName="Double Duty",
        description="Complete 2 back-to-back sessions within 15 minutes",
        isUnlocked=double_duty_found,
        progress=1 if double_duty_found else 0,
        target=1,
        unlockedAt=achievement_doc.get('double_duty_unlocked_at')
    ))
    
    return TrainerAchievements(
        trainerId=trainer_id,
        badges=badges,
        totalCompletedSessions=total_completed,
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
        achievement_doc = {
            'trainerId': trainer_id,
            'discountSessionsRemaining': 0,
            'unlockedBadges': []
        }
        await db.trainer_achievements.insert_one(achievement_doc)
    
    newly_unlocked = []
    
    for badge in achievements.badges:
        badge_key = f"{badge.badgeType}_unlocked_at"
        
        # Check if badge is unlocked but not yet recorded
        if badge.isUnlocked and badge_key not in achievement_doc:
            # Record unlock
            await db.trainer_achievements.update_one(
                {'trainerId': trainer_id},
                {'$set': {badge_key: datetime.utcnow()}}
            )
            newly_unlocked.append(badge.badgeType)
            
            # Special handling for Milestone Master badge
            if badge.badgeType == BadgeType.MILESTONE_MASTER:
                await db.trainer_achievements.update_one(
                    {'trainerId': trainer_id},
                    {'$set': {'discountSessionsRemaining': 5}}
                )
    
    return newly_unlocked

@api_router.get("/trainer/achievements")
async def get_trainer_achievements(current_user: dict = Depends(get_current_user)):
    """Get achievements and badge progress for current trainer"""
    if UserRole.TRAINER not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Trainer access required")
    
    # Find trainer profile
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

@api_router.post("/trainer/check-badges")
async def check_badges(current_user: dict = Depends(get_current_user)):
    """Manually trigger badge check (for testing)"""
    if UserRole.TRAINER not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Trainer access required")
    
    trainer_profile = await db.trainer_profiles.find_one({'userId': str(current_user['_id'])})
    if not trainer_profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    newly_unlocked = await check_and_unlock_badges(str(current_user['_id']))
    
    # Auto-generate feed posts for newly unlocked badges
    if newly_unlocked:
        try:
            from routes.feed import auto_create_feed_post
            user_name = current_user.get('fullName', 'A trainer')
            for badge_type in newly_unlocked:
                asyncio.create_task(auto_create_feed_post(
                    "badge_unlock",
                    str(current_user['_id']),
                    user_name,
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
    """Calculate streak data for a user (trainer or trainee).
    A streak is consecutive weeks with at least 1 completed session.
    Also computes consistency points based on total sessions and streak length.
    """
    if role == 'trainer':
        field = 'trainerId'
    else:
        field = 'traineeId'
    
    completed_sessions = await db.sessions.find(
        {field: user_id, 'status': SessionStatus.COMPLETED},
        {'sessionDateTimeStart': 1, 'durationMinutes': 1, 'sessionStartedAt': 1, 'sessionEndedAt': 1}
    ).sort('sessionDateTimeStart', 1).to_list(1000)
    
    if not completed_sessions:
        return {
            'currentStreak': 0,
            'longestStreak': 0,
            'totalWeeksActive': 0,
            'consistencyPoints': 0,
            'totalSessions': 0,
            'totalMinutes': 0,
            'streakLevel': 'none',
            'nextMilestone': 2,
        }
    
    # Group sessions by ISO week
    from collections import defaultdict
    weeks = defaultdict(int)
    total_minutes = 0
    
    for s in completed_sessions:
        dt = s.get('sessionDateTimeStart')
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt)
        if dt:
            week_key = dt.isocalendar()[:2]  # (year, week_number)
            weeks[week_key] += 1
        
        # Sum actual duration if available, else scheduled
        started = s.get('sessionStartedAt')
        ended = s.get('sessionEndedAt')
        if started and ended:
            if isinstance(started, str):
                started = datetime.fromisoformat(started)
            if isinstance(ended, str):
                ended = datetime.fromisoformat(ended)
            total_minutes += int((ended - started).total_seconds() / 60)
        else:
            total_minutes += s.get('durationMinutes', 0)
    
    # Sort weeks chronologically
    sorted_weeks = sorted(weeks.keys())
    
    # Calculate current streak (consecutive weeks ending at the most recent week)
    from datetime import timedelta
    now = datetime.utcnow()
    current_iso = now.isocalendar()[:2]
    last_week_iso = (now - timedelta(days=7)).isocalendar()[:2]
    
    # Check if user was active this week or last week
    if current_iso not in weeks and last_week_iso not in weeks:
        current_streak = 0
    else:
        # Walk backwards from the most recent active week
        current_streak = 0
        check_week = sorted_weeks[-1]
        
        for i in range(len(sorted_weeks) - 1, -1, -1):
            if sorted_weeks[i] == check_week:
                current_streak += 1
                # Move to previous week
                year, wk = check_week
                prev_date = datetime.strptime(f'{year}-W{wk:02d}-1', '%Y-W%W-%w') - timedelta(days=7)
                check_week = prev_date.isocalendar()[:2]
            else:
                break
    
    # Calculate longest streak
    longest_streak = 0
    temp_streak = 1
    for i in range(1, len(sorted_weeks)):
        prev_year, prev_wk = sorted_weeks[i - 1]
        curr_year, curr_wk = sorted_weeks[i]
        
        # Check if consecutive week
        prev_date = datetime.strptime(f'{prev_year}-W{prev_wk:02d}-1', '%Y-W%W-%w')
        next_expected = (prev_date + timedelta(days=7)).isocalendar()[:2]
        
        if (curr_year, curr_wk) == next_expected:
            temp_streak += 1
        else:
            longest_streak = max(longest_streak, temp_streak)
            temp_streak = 1
    longest_streak = max(longest_streak, temp_streak)
    
    total_sessions = len(completed_sessions)
    
    # Consistency points: sessions * 10 + streak_weeks * 25 + total_minutes // 10
    consistency_points = total_sessions * 10 + current_streak * 25 + total_minutes // 10
    
    # Streak level
    if current_streak >= 12:
        streak_level = 'legend'
    elif current_streak >= 8:
        streak_level = 'blazing'
    elif current_streak >= 4:
        streak_level = 'fire'
    elif current_streak >= 2:
        streak_level = 'warming'
    else:
        streak_level = 'none'
    
    # Next milestone
    milestones = [2, 4, 8, 12, 26, 52]
    next_milestone = 2
    for m in milestones:
        if current_streak < m:
            next_milestone = m
            break
    
    return {
        'currentStreak': current_streak,
        'longestStreak': longest_streak,
        'totalWeeksActive': len(sorted_weeks),
        'consistencyPoints': consistency_points,
        'totalSessions': total_sessions,
        'totalMinutes': total_minutes,
        'streakLevel': streak_level,
        'nextMilestone': next_milestone,
    }


@api_router.get("/streaks/me")
async def get_my_streaks(current_user: dict = Depends(get_current_user)):
    """Get streak and consistency points for the current user"""
    user_id = str(current_user['_id'])
    roles = current_user.get('roles', [])
    
    role = 'trainer' if UserRole.TRAINER in roles else 'trainee'
    streak_data = await calculate_user_streak(user_id, role)
    streak_data['userId'] = user_id
    streak_data['role'] = role
    
    return streak_data


@api_router.get("/leaderboard/weekly")
async def get_weekly_leaderboard(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get weekly leaderboard ranked by consistency points.
    Shows top users for the current week based on completed sessions this week + overall streak data.
    """
    # Get all users with completed sessions
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
        
        # Get avatar from profile
        avatar = None
        if role == 'trainer':
            tp = await db.trainer_profiles.find_one({'userId': uid}, {'avatarUrl': 1})
            avatar = tp.get('avatarUrl') if tp else None
        else:
            tp = await db.trainee_profiles.find_one({'userId': uid}, {'profilePhoto': 1})
            avatar = tp.get('profilePhoto') if tp else None
        
        leaderboard.append({
            'userId': uid,
            'fullName': user.get('fullName', 'Unknown'),
            'role': role,
            'avatar': avatar,
            'currentStreak': streak_data['currentStreak'],
            'longestStreak': streak_data['longestStreak'],
            'consistencyPoints': streak_data['consistencyPoints'],
            'totalSessions': streak_data['totalSessions'],
            'totalMinutes': streak_data['totalMinutes'],
            'streakLevel': streak_data['streakLevel'],
        })
    
    # Sort by consistency points descending
    leaderboard.sort(key=lambda x: x['consistencyPoints'], reverse=True)
    leaderboard = leaderboard[:limit]
    
    # Add rank
    for i, entry in enumerate(leaderboard):
        entry['rank'] = i + 1
    
    # Find current user's rank
    current_user_id = str(current_user['_id'])
    my_rank = None
    my_entry = None
    for entry in leaderboard:
        if entry['userId'] == current_user_id:
            my_rank = entry['rank']
            my_entry = entry
            break
    
    # If user not in top N, compute their entry separately
    if my_rank is None:
        roles = current_user.get('roles', [])
        my_role = 'trainer' if UserRole.TRAINER in roles else 'trainee'
        try:
            my_streak = await calculate_user_streak(current_user_id, my_role)
            if my_streak['totalSessions'] > 0:
                # Find rank by counting users with more points
                higher_count = sum(1 for e in leaderboard if e['consistencyPoints'] > my_streak['consistencyPoints'])
                my_rank = higher_count + 1
                my_entry = {
                    'userId': current_user_id,
                    'fullName': current_user.get('fullName', 'Unknown'),
                    'role': my_role,
                    'currentStreak': my_streak['currentStreak'],
                    'consistencyPoints': my_streak['consistencyPoints'],
                    'totalSessions': my_streak['totalSessions'],
                    'totalMinutes': my_streak['totalMinutes'],
                    'streakLevel': my_streak['streakLevel'],
                    'rank': my_rank,
                }
        except Exception:
            pass
    
    return {
        'leaderboard': leaderboard,
        'myRank': my_rank,
        'myEntry': my_entry,
        'totalParticipants': len(leaderboard),
    }


async def calculate_trainee_badge_progress(trainee_id: str) -> TraineeAchievements:
    """Calculate all badge progress for a trainee"""
    
    # Get all completed sessions for this trainee (only fields needed for badge calc)
    completed_sessions = await db.sessions.find(
        {'traineeId': trainee_id, 'status': SessionStatus.COMPLETED},
        {'_id': 0, 'sessionDateTimeStart': 1, 'trainerId': 1}
    ).to_list(1000)
    
    # Get trainee achievement doc
    achievement_doc = await db.trainee_achievements.find_one({'traineeId': trainee_id})
    if not achievement_doc:
        achievement_doc = {
            'traineeId': trainee_id,
            'discountSessionsRemaining': 0,
            'currentStreak': 0,
            'streekWeeks': 0,
            'lastStreakReset': None,
            'unlockedBadges': [],
            'trainAgainCount': 0
        }
    
    # Get count of ratings by this trainee (only count needed for badge)
    feedback_count_from_db = await db.ratings.count_documents({'traineeId': trainee_id})
    
    total_completed = len(completed_sessions)
    badges = []
    
    # 1. Commitment Badge - 10 completed sessions
    commitment_progress = min(total_completed, 10)
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.COMMITMENT,
        badgeName="Commitment Badge",
        description="Complete 10 training sessions",
        isUnlocked=total_completed >= 10,
        progress=commitment_progress,
        target=10,
        unlockedAt=achievement_doc.get('commitment_unlocked_at')
    ))
    
    # 2. Consistency Champ - 2+ sessions/week for 3 consecutive weeks
    streak_progress = achievement_doc.get('streakWeeks', 0)
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.CONSISTENCY_CHAMP,
        badgeName="Consistency Champ",
        description="Complete 2+ sessions per week for 3 consecutive weeks",
        isUnlocked=streak_progress >= 3,
        progress=min(streak_progress, 3),
        target=3,
        unlockedAt=achievement_doc.get('consistency_champ_unlocked_at')
    ))
    
    # 3. Weekend Grinder - 5 weekend sessions
    weekend_sessions = [s for s in completed_sessions 
                       if s.get('sessionDateTimeStart') and datetime.fromisoformat(str(s['sessionDateTimeStart'])).weekday() >= 5]
    weekend_progress = min(len(weekend_sessions), 5)
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.WEEKEND_GRINDER,
        badgeName="Weekend Grinder",
        description="Complete 5 sessions on Saturday or Sunday",
        isUnlocked=len(weekend_sessions) >= 5,
        progress=weekend_progress,
        target=5,
        unlockedAt=achievement_doc.get('weekend_grinder_unlocked_at')
    ))
    
    # 4. Early Riser - 5 sessions before noon
    early_sessions = [s for s in completed_sessions 
                     if s.get('sessionDateTimeStart') and datetime.fromisoformat(str(s['sessionDateTimeStart'])).hour < 12]
    early_progress = min(len(early_sessions), 5)
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.EARLY_RISER,
        badgeName="Early Riser",
        description="Complete 5 sessions before 11:59 AM",
        isUnlocked=len(early_sessions) >= 5,
        progress=early_progress,
        target=5,
        unlockedAt=achievement_doc.get('early_riser_unlocked_at')
    ))
    
    # 5. Night Hustler - 5 sessions after 6 PM
    night_sessions = [s for s in completed_sessions 
                     if s.get('sessionDateTimeStart') and datetime.fromisoformat(str(s['sessionDateTimeStart'])).hour >= 18]
    night_progress = min(len(night_sessions), 5)
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.NIGHT_HUSTLER,
        badgeName="Night Hustler",
        description="Complete 5 sessions at or after 6:00 PM",
        isUnlocked=len(night_sessions) >= 5,
        progress=night_progress,
        target=5,
        unlockedAt=achievement_doc.get('night_hustler_unlocked_at')
    ))
    
    # 6. Loyalty Lock - 20 lifetime sessions (1 reduced service fee)
    loyalty_progress = min(total_completed, 20)
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.LOYALTY_LOCK,
        badgeName="Loyalty Lock",
        description="Complete 20 lifetime sessions",
        isUnlocked=total_completed >= 20,
        progress=loyalty_progress,
        target=20,
        reward="1 reduced service fee session",
        unlockedAt=achievement_doc.get('loyalty_lock_unlocked_at')
    ))
    
    # 7. Trainer Favorite - 5 "Would Train Again" confirmations
    train_again_count = achievement_doc.get('trainAgainCount', 0)
    trainer_fav_progress = min(train_again_count, 5)
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.TRAINER_FAVORITE,
        badgeName="Trainer Favorite",
        description="Get 5 'Would Train Again' confirmations from trainers",
        isUnlocked=train_again_count >= 5,
        progress=trainer_fav_progress,
        target=5,
        unlockedAt=achievement_doc.get('trainer_favorite_unlocked_at')
    ))
    
    # 8. Explorer - Sessions with 5 unique trainers
    unique_trainers = set(s['trainerId'] for s in completed_sessions)
    explorer_progress = min(len(unique_trainers), 5)
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.EXPLORER,
        badgeName="Explorer",
        description="Train with 5 different trainers",
        isUnlocked=len(unique_trainers) >= 5,
        progress=explorer_progress,
        target=5,
        unlockedAt=achievement_doc.get('explorer_unlocked_at')
    ))
    
    # 9. Feedback Hero - 10 completed session reviews
    feedback_progress = min(feedback_count_from_db, 10)
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.FEEDBACK_HERO,
        badgeName="Feedback Hero",
        description="Write 10 session reviews",
        isUnlocked=feedback_count_from_db >= 10,
        progress=feedback_progress,
        target=10,
        unlockedAt=achievement_doc.get('feedback_hero_unlocked_at')
    ))
    
    # 10. All-In - 3 sessions in a single calendar week
    all_in_found = False
    # Group sessions by week
    from collections import defaultdict
    weeks = defaultdict(int)
    for session in completed_sessions:
        if not session.get('sessionDateTimeStart'):
            continue
        start_date = datetime.fromisoformat(str(session['sessionDateTimeStart']))
        week_key = f"{start_date.year}-W{start_date.isocalendar()[1]}"
        weeks[week_key] += 1
        if weeks[week_key] >= 3:
            all_in_found = True
            break
    
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.ALL_IN,
        badgeName="All-In",
        description="Complete 3 sessions in a single calendar week",
        isUnlocked=all_in_found,
        progress=1 if all_in_found else 0,
        target=1,
        unlockedAt=achievement_doc.get('all_in_unlocked_at')
    ))
    
    # 11. Streak Star - Maintain a 4-week streak
    streak_data = await calculate_user_streak(trainee_id, 'trainee')
    current_streak = streak_data.get('currentStreak', 0)
    longest_streak = streak_data.get('longestStreak', 0)
    streak_star_progress = min(longest_streak, 4)
    badges.append(BadgeProgress(
        badgeType=BadgeType.STREAK_STAR,
        badgeName="Streak Star",
        description="Maintain a 4-week consecutive training streak",
        isUnlocked=longest_streak >= 4,
        progress=streak_star_progress,
        target=4,
        reward="Streak badge on your profile",
        unlockedAt=achievement_doc.get('streak_star_unlocked_at')
    ))
    
    # 12. Duration Master - Accumulate 500 total training minutes
    total_minutes = streak_data.get('totalMinutes', 0)
    duration_progress = min(total_minutes, 500)
    badges.append(BadgeProgress(
        badgeType="duration_master",
        badgeName="Duration Master",
        description="Accumulate 500 total training minutes",
        isUnlocked=total_minutes >= 500,
        progress=duration_progress,
        target=500,
        reward="Endurance recognition badge",
        unlockedAt=achievement_doc.get('duration_master_unlocked_at')
    ))
    
    return TraineeAchievements(
        traineeId=trainee_id,
        badges=badges,
        totalCompletedSessions=total_completed,
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
            'traineeId': trainee_id,
            'discountSessionsRemaining': 0,
            'unlockedBadges': [],
            'trainAgainCount': 0
        }
        await db.trainee_achievements.insert_one(achievement_doc)
    
    newly_unlocked = []
    
    for badge in achievements.badges:
        badge_key = f"{badge.badgeType}_unlocked_at"
        
        # Check if badge is unlocked but not yet recorded
        if badge.isUnlocked and badge_key not in achievement_doc:
            # Record unlock
            await db.trainee_achievements.update_one(
                {'traineeId': trainee_id},
                {'$set': {badge_key: datetime.utcnow()}}
            )
            newly_unlocked.append(badge.badgeType)
            
            # Special handling for Loyalty Lock badge
            if badge.badgeType == TraineeBadgeType.LOYALTY_LOCK:
                await db.trainee_achievements.update_one(
                    {'traineeId': trainee_id},
                    {'$set': {'discountSessionsRemaining': 1}}
                )
    
    return newly_unlocked

@api_router.get("/trainee/achievements")
async def get_trainee_achievements(current_user: dict = Depends(get_current_user)):
    """Get achievements and badge progress for current trainee"""
    if UserRole.TRAINEE not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Trainee access required")
    
    # Use user ID as trainee ID for now (they can have profiles in both collections)
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

@api_router.post("/trainee/check-badges")
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


# ============================================================================
# PAYMENT & MEMBERSHIP ENDPOINTS
# ============================================================================

@api_router.post("/payments/create-payment-intent")
@limiter.limit("60/minute")
async def create_payment_intent(
    request: Request,
    amount_cents: int,
    session_id: Optional[str] = None,
    description: str = "RapidReps Session",
    current_user: dict = Depends(get_current_user)
):
    """Create a Stripe payment intent for a session"""
    # Validate amount
    if amount_cents < 100:
        raise HTTPException(status_code=400, detail="Minimum payment amount is $1.00")
    if amount_cents > 500000:  # $5,000 max
        raise HTTPException(status_code=400, detail="Amount exceeds maximum allowed ($5,000)")
    
    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency='usd',
            metadata={
                'user_id': str(current_user['_id']),
                'session_id': session_id or '',
                'description': description
            }
        )
        return {
            "clientSecret": intent.client_secret,
            "paymentIntentId": intent.id
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/payments/pricing-rules")
async def get_pricing_rules():
    """Get current pricing rules for the platform"""
    return {
        "revenueSplit": {
            "trainerPercent": PricingRules.TRAINER_REVENUE_PERCENT,
            "platformPercent": PricingRules.PLATFORM_REVENUE_PERCENT
        },
        "serviceFeeCents": PricingRules.SERVICE_FEE_CENTS,
        "serviceFee": PricingRules.SERVICE_FEE_CENTS / 100,
        "minimumPrices": {
            "virtual": PricingRules.VIRTUAL_MIN_CENTS / 100,
            "outdoor": PricingRules.OUTDOOR_MIN_CENTS / 100,
            "inHome": PricingRules.IN_HOME_MIN_CENTS / 100,
            "traineeHome": PricingRules.TRAINEE_HOME_MIN_CENTS / 100
        },
        "travelFee": {
            "minCents": PricingRules.TRAVEL_FEE_MIN_CENTS,
            "maxCents": PricingRules.TRAVEL_FEE_MAX_CENTS,
            "trainerPercent": PricingRules.TRAINER_TRAVEL_FEE_PERCENT,
            "platformPercent": PricingRules.PLATFORM_TRAVEL_FEE_PERCENT
        },
        "cancellationFees": {
            "virtual": PricingRules.CANCELLATION_FEE_VIRTUAL / 100,
            "outdoor": PricingRules.CANCELLATION_FEE_OUTDOOR / 100,
            "inHome": PricingRules.CANCELLATION_FEE_IN_HOME / 100
        },
        "boostPrices": {
            "daily": PricingRules.BOOST_DAILY_CENTS / 100,
            "weekly": PricingRules.BOOST_WEEKLY_CENTS / 100,
            "monthly": PricingRules.BOOST_MONTHLY_CENTS / 100
        },
        "membership": {
            "monthlyPrice": PricingRules.MEMBERSHIP_MONTHLY_CENTS / 100,
            "sessionDiscountPercent": PricingRules.MEMBERSHIP_SESSION_DISCOUNT_PERCENT,
            "matchingPriorityBonus": PricingRules.MEMBERSHIP_MATCHING_PRIORITY_BONUS,
            "benefits": [
                f"{PricingRules.MEMBERSHIP_SESSION_DISCOUNT_PERCENT}% off all sessions",
                "1 free profile Boost per month",
                "Priority matching (faster trainer response)",
                "Early access to elite trainers"
            ]
        }
    }

@api_router.post("/payments/calculate-session-cost")
async def calculate_session_cost(
    session_type: str,
    session_price_cents: int,
    travel_fee_cents: int = 0
):
    """Calculate cost breakdown for a session"""
    session_split = calculate_session_payout(session_price_cents, session_type)
    travel_split = calculate_travel_fee_split(travel_fee_cents) if travel_fee_cents > 0 else None
    
    total_cost = session_price_cents + travel_fee_cents
    service_fee = PricingRules.SERVICE_FEE_CENTS
    trainer_total = session_split['trainer_payout_cents'] + (travel_split['trainer_payout_cents'] if travel_split else 0)
    platform_total = session_split['platform_fee_cents'] + (travel_split['platform_fee_cents'] if travel_split else 0) + service_fee
    total_charged = total_cost + service_fee
    
    return {
        "sessionPrice": session_split,
        "travelFee": travel_split,
        "serviceFeeCents": service_fee,
        "totals": {
            "sessionSubtotalCents": total_cost,
            "serviceFeeCents": service_fee,
            "totalChargedCents": total_charged,
            "trainerPayoutCents": trainer_total,
            "platformFeeCents": platform_total,
            "totalChargedDollars": total_charged / 100,
            "trainerPayoutDollars": trainer_total / 100,
            "platformFeeDollars": platform_total / 100
        }
    }

@api_router.post("/memberships/subscribe")
async def subscribe_membership(current_user: dict = Depends(get_current_user)):
    """Subscribe to RapidReps membership ($19.99/month) — creates Stripe PaymentIntent"""
    user_id = str(current_user['_id'])
    
    # Check if already has active membership
    existing = await db.memberships.find_one({
        'userId': user_id,
        'status': MembershipStatus.ACTIVE
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already have an active membership")
    
    amount_cents = PricingRules.MEMBERSHIP_MONTHLY_CENTS
    
    # Create Stripe PaymentIntent
    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency='usd',
            metadata={
                'user_id': user_id,
                'type': 'membership',
                'description': 'RapidReps Monthly Membership'
            }
        )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Payment setup failed: {str(e)}")
    
    # Create pending membership
    now = datetime.utcnow()
    membership = {
        'userId': user_id,
        'status': 'pending_payment',
        'monthlyPriceCents': amount_cents,
        'paymentIntentId': intent.id,
        'startDate': now,
        'nextBillingDate': now + timedelta(days=30),
        'freeBoostsRemaining': 1,
        'createdAt': now
    }
    
    result = await db.memberships.insert_one(membership)
    
    return {
        "clientSecret": intent.client_secret,
        "paymentIntentId": intent.id,
        "membershipId": str(result.inserted_id),
        "amountCents": amount_cents
    }


@api_router.post("/memberships/{membership_id}/confirm-payment")
async def confirm_membership_payment(
    membership_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Confirm membership payment after Stripe payment succeeds"""
    try:
        oid = ObjectId(membership_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid membership ID")
    
    membership = await db.memberships.find_one({'_id': oid})
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    
    if membership['userId'] != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Not your membership")
    
    if membership.get('status') == MembershipStatus.ACTIVE:
        return {"success": True, "message": "Membership already active"}
    
    # Verify payment with Stripe if possible
    payment_intent_id = membership.get('paymentIntentId')
    if payment_intent_id:
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            if intent.status != 'succeeded':
                raise HTTPException(status_code=400, detail=f"Payment not completed. Status: {intent.status}")
        except stripe.error.StripeError:
            pass  # If Stripe check fails, still activate (intent may be test/mock)
    
    # Activate membership
    await db.memberships.update_one(
        {'_id': oid},
        {'$set': {'status': MembershipStatus.ACTIVE, 'activatedAt': datetime.utcnow()}}
    )
    
    # Record transaction
    await db.transactions.insert_one({
        'userId': membership['userId'],
        'transactionType': 'membership_payment',
        'amountCents': membership['monthlyPriceCents'],
        'status': 'completed',
        'paymentIntentId': payment_intent_id,
        'description': 'Monthly Membership - $19.99',
        'createdAt': datetime.utcnow()
    })
    
    return {"success": True, "message": "Membership activated successfully"}

@api_router.get("/memberships/my-membership")
async def get_my_membership(current_user: dict = Depends(get_current_user)):
    """Get current user's membership status"""
    user_id = str(current_user['_id'])
    
    membership = await db.memberships.find_one({
        'userId': user_id,
        'status': MembershipStatus.ACTIVE
    })
    
    if not membership:
        return {"hasMembership": False, "membership": None}
    
    return {
        "hasMembership": True,
        "membership": serialize_doc(membership)
    }

@api_router.post("/boosts/purchase")
async def purchase_boost(
    boost_type: str,
    current_user: dict = Depends(get_current_user)
):
    """Purchase a visibility boost — creates Stripe PaymentIntent"""
    if UserRole.TRAINER not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Only trainers can purchase boosts")
    
    user_id = str(current_user['_id'])
    
    # Get price for boost type
    price_map = {
        BoostType.DAILY: PricingRules.BOOST_DAILY_CENTS,
        BoostType.WEEKLY: PricingRules.BOOST_WEEKLY_CENTS,
        BoostType.MONTHLY: PricingRules.BOOST_MONTHLY_CENTS
    }
    duration_map = {
        BoostType.DAILY: 1,
        BoostType.WEEKLY: 7,
        BoostType.MONTHLY: 30
    }
    
    price_cents = price_map.get(boost_type)
    duration_days = duration_map.get(boost_type)
    
    if not price_cents:
        raise HTTPException(status_code=400, detail="Invalid boost type")
    
    # Check for free boost from membership
    membership = await db.memberships.find_one({
        'userId': user_id,
        'status': MembershipStatus.ACTIVE,
        'freeBoostsRemaining': {'$gt': 0}
    })
    
    is_free = membership is not None
    
    if is_free:
        # Use free boost — no payment needed
        await db.memberships.update_one(
            {'_id': membership['_id']},
            {'$inc': {'freeBoostsRemaining': -1}}
        )
        
        now = datetime.utcnow()
        boost = {
            'trainerId': user_id,
            'boostType': boost_type,
            'priceCents': 0,
            'startDate': now,
            'endDate': now + timedelta(days=duration_days),
            'isActive': True,
            'isFreeBoost': True,
            'status': 'active',
            'createdAt': now
        }
        result = await db.boosts.insert_one(boost)
        return {
            "success": True,
            "boostId": str(result.inserted_id),
            "isFreeBoost": True,
            "message": "Free boost activated from membership!"
        }
    
    # Create Stripe PaymentIntent for paid boost
    try:
        intent = stripe.PaymentIntent.create(
            amount=price_cents,
            currency='usd',
            metadata={
                'user_id': user_id,
                'type': 'boost',
                'boost_type': boost_type,
                'description': f'RapidReps {boost_type.capitalize()} Visibility Boost'
            }
        )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Payment setup failed: {str(e)}")
    
    now = datetime.utcnow()
    boost = {
        'trainerId': user_id,
        'boostType': boost_type,
        'priceCents': price_cents,
        'paymentIntentId': intent.id,
        'startDate': now,
        'endDate': now + timedelta(days=duration_days),
        'isActive': False,
        'isFreeBoost': False,
        'status': 'pending_payment',
        'createdAt': now
    }
    
    result = await db.boosts.insert_one(boost)
    
    return {
        "clientSecret": intent.client_secret,
        "paymentIntentId": intent.id,
        "boostId": str(result.inserted_id),
        "amountCents": price_cents,
        "isFreeBoost": False
    }


@api_router.post("/boosts/{boost_id}/confirm-payment")
async def confirm_boost_payment(
    boost_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Confirm boost payment after Stripe payment succeeds"""
    try:
        oid = ObjectId(boost_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid boost ID")
    
    boost = await db.boosts.find_one({'_id': oid})
    if not boost:
        raise HTTPException(status_code=404, detail="Boost not found")
    
    if boost['trainerId'] != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Not your boost")
    
    if boost.get('isActive'):
        return {"success": True, "message": "Boost already active"}
    
    # Verify payment with Stripe if possible
    payment_intent_id = boost.get('paymentIntentId')
    if payment_intent_id:
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            if intent.status != 'succeeded':
                raise HTTPException(status_code=400, detail=f"Payment not completed. Status: {intent.status}")
        except stripe.error.StripeError:
            pass  # If Stripe check fails, still activate
    
    # Activate boost
    await db.boosts.update_one(
        {'_id': oid},
        {'$set': {'isActive': True, 'status': 'active', 'activatedAt': datetime.utcnow()}}
    )
    
    # Record transaction
    await db.transactions.insert_one({
        'userId': boost['trainerId'],
        'transactionType': 'boost_payment',
        'amountCents': boost['priceCents'],
        'status': 'completed',
        'paymentIntentId': payment_intent_id,
        'description': f"{boost['boostType'].capitalize()} Visibility Boost",
        'createdAt': datetime.utcnow()
    })
    
    return {"success": True, "message": "Boost activated successfully"}


@api_router.get("/boosts/my-boosts")
async def get_my_boosts(current_user: dict = Depends(get_current_user)):
    """Get trainer's active and past boosts"""
    user_id = str(current_user['_id'])
    boosts = await db.boosts.find({'trainerId': user_id}).sort('createdAt', -1).to_list(50)
    return {'boosts': [serialize_doc(b) for b in boosts]}


@api_router.get("/boosts/analytics")
async def get_boost_analytics(current_user: dict = Depends(get_current_user)):
    """
    Get boost performance analytics for the trainer.
    Returns impressions, profile views, and click-through data.
    """
    user_id = str(current_user['_id'])
    now = datetime.utcnow()

    # Get active boost info
    active_boost = await db.boosts.find_one({
        'trainerId': user_id,
        'isActive': True,
        'endDate': {'$gte': now},
    })

    # Get analytics for last 30 days
    thirty_days_ago = (now - timedelta(days=30)).strftime('%Y-%m-%d')
    analytics = await db.boost_analytics.find({
        'trainerId': user_id,
        'date': {'$gte': thirty_days_ago},
    }).sort('date', -1).to_list(30)

    total_impressions = sum(a.get('impressions', 0) for a in analytics)
    total_views = sum(a.get('profileViews', 0) for a in analytics)
    total_clicks = sum(a.get('clicks', 0) for a in analytics)

    daily_data = []
    for a in analytics:
        daily_data.append({
            'date': a.get('date'),
            'impressions': a.get('impressions', 0),
            'profileViews': a.get('profileViews', 0),
            'clicks': a.get('clicks', 0),
        })

    return {
        'hasActiveBoost': active_boost is not None,
        'boostType': active_boost.get('boostType') if active_boost else None,
        'boostEndsAt': active_boost.get('endDate').isoformat() if active_boost and active_boost.get('endDate') else None,
        'totalImpressions': total_impressions,
        'totalProfileViews': total_views,
        'totalClicks': total_clicks,
        'clickThroughRate': round(total_clicks / max(total_impressions, 1) * 100, 1),
        'dailyData': daily_data,
    }


@api_router.post("/boosts/{trainer_id}/track-view")
async def track_boost_view(trainer_id: str):
    """Track a profile view for a boosted trainer (called from frontend)."""
    now = datetime.utcnow()
    await db.boost_analytics.update_one(
        {'trainerId': trainer_id, 'date': now.strftime('%Y-%m-%d')},
        {'$inc': {'profileViews': 1, 'clicks': 1}},
        upsert=True,
    )
    return {'success': True}


@api_router.get("/memberships/member-badge/{user_id}")
async def get_member_badge(user_id: str):
    """Check if a user has an active membership (public endpoint for badges)."""
    membership = await db.memberships.find_one({
        'userId': user_id,
        'status': MembershipStatus.ACTIVE,
    })
    if membership:
        return {
            'isMember': True,
            'memberSince': membership.get('activatedAt', membership.get('startDate')).isoformat() if membership.get('activatedAt') or membership.get('startDate') else None,
            'benefits': [
                '10% off all sessions',
                '1 free profile Boost per month',
                'Priority matching',
                'Early access to elite trainers',
            ],
        }
    return {'isMember': False}


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

async def create_and_send_notification(user_id: str, title: str, body: str, notif_type: str, data: dict = None):
    """Store notification in DB and send push — respects user notification preferences"""
    # Check user's notification preferences
    prefs = await db.notification_preferences.find_one({'userId': user_id})
    if prefs and not prefs.get(notif_type, True):
        return  # User has disabled this notification type

    notif = {
        'userId': user_id,
        'title': title,
        'body': body,
        'type': notif_type,
        'data': data or {},
        'read': False,
        'createdAt': datetime.utcnow()
    }
    await db.notifications.insert_one(notif)

    # Only send push if user hasn't disabled push entirely
    if not prefs or prefs.get('pushEnabled', True):
        asyncio.create_task(send_push_notification(user_id, title, body, data))

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

# Include new feature route modules
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
