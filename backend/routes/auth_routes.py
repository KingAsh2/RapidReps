"""Auth routes: signup, login, me, delete, change-password, forgot-password, reset-password"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import uuid
import bcrypt
import logging
import random
import string

from deps import (
    db, security, get_current_user, serialize_doc, sanitize_text,
    hash_password, verify_password, create_access_token, decode_token,
    VALID_PERSONALITY_TAGS, limiter,
)
from models import (
    UserSignUp, UserLogin, UserResponse, TokenResponse,
    UserRole, REFERRAL_CREDIT_CENTS, MAX_REFERRALS_PER_USER,
)
from email_service import send_password_reset_email, send_welcome_email

router = APIRouter(prefix="/api")

# ============================================================================
# AUTH ROUTES
# ============================================================================

@router.post("/auth/signup", response_model=TokenResponse)
@limiter.limit("30/minute")
async def signup(request: Request, user_data: UserSignUp):
    """Register a new user"""
    # Validate password length (skip for social auth)
    if not user_data.isSocialAuth and (not user_data.password or len(user_data.password) < 6):
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Check if user already exists
    existing_user = await db.users.find_one({'email': user_data.email})
    if existing_user:
        # If social auth user, update their roles and phone instead of rejecting
        if user_data.isSocialAuth:
            update_fields = {
                'roles': user_data.roles,
                'phone': user_data.phone,
                'fullName': sanitize_text(user_data.fullName) or existing_user.get('fullName', ''),
                'updatedAt': datetime.utcnow(),
            }
            await db.users.update_one({'_id': existing_user['_id']}, {'$set': update_fields})
            existing_user.update(update_fields)
            user_id = str(existing_user['_id'])
            access_token = create_access_token(user_id, user_data.email)
            return {
                'access_token': access_token,
                'user': UserResponse(
                    id=user_id,
                    fullName=update_fields['fullName'],
                    email=user_data.email,
                    phone=user_data.phone,
                    roles=user_data.roles,
                    isAdmin=existing_user.get('isAdmin', False),
                    createdAt=existing_user.get('createdAt', datetime.utcnow()),
                ).dict(),
            }
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password (None for social auth users)
    hashed_password = hash_password(user_data.password) if user_data.password else None
    
    # Generate unique referral code for this user
    referral_code = f"RR-{''.join(random.choices(string.ascii_uppercase + string.digits, k=6))}"
    while await db.users.find_one({'referralCode': referral_code}):
        referral_code = f"RR-{''.join(random.choices(string.ascii_uppercase + string.digits, k=6))}"
    
    # Create user document
    user_doc = {
        'fullName': sanitize_text(user_data.fullName),
        'email': user_data.email,
        'phone': user_data.phone,
        'passwordHash': hashed_password,
        'roles': user_data.roles,
        'isAdmin': False,
        'emailVerified': True,  # Default true until email verification flow is implemented
        'referralCode': referral_code,
        'referralCredits': 0,  # cents
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    # Process referral code if provided
    if user_data.referralCode:
        referrer = await db.users.find_one({'referralCode': user_data.referralCode.strip().upper()})
        if referrer:
            # Check referrer hasn't exceeded max referrals
            referrer_count = await db.referrals.count_documents({
                'referrerId': str(referrer['_id']),
                'status': {'$in': ['pending', 'activated']}
            })
            if referrer_count < MAX_REFERRALS_PER_USER:
                await db.referrals.insert_one({
                    'referrerId': str(referrer['_id']),
                    'referredUserId': user_id,
                    'referralCode': user_data.referralCode.strip().upper(),
                    'status': 'pending',  # becomes 'activated' after first session booking
                    'creditCents': REFERRAL_CREDIT_CENTS,
                    'createdAt': datetime.utcnow(),
                    'activatedAt': None,
                })
    
    # Send welcome email (no-op without SendGrid key)
    send_welcome_email(user_data.email, user_data.fullName)

    # Create access token
    access_token = create_access_token(user_id, user_data.email)
    
    # Return user and token
    user_response = UserResponse(
        id=user_id,
        fullName=user_data.fullName,
        email=user_data.email,
        phone=user_data.phone,
        roles=user_data.roles,
        isAdmin=False,
        createdAt=user_doc['createdAt']
    )
    
    return TokenResponse(access_token=access_token, user=user_response)

@router.post("/auth/login", response_model=TokenResponse)
@limiter.limit("60/minute")
async def login(request: Request, credentials: UserLogin):
    """Login user"""
    import logging
    logging.info(f"LOGIN ATTEMPT: email='{credentials.email}' from={request.client.host if request.client else 'unknown'}")
    
    # Find user
    user = await db.users.find_one({'email': credentials.email})
    if not user:
        logging.warning(f"LOGIN FAIL: No user found for email='{credentials.email}'")
        all_users = await db.users.find({}, {'email': 1, '_id': 0}).to_list(10)
        logging.warning(f"LOGIN FAIL: Existing users: {[u['email'] for u in all_users]}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(credentials.password, user['passwordHash']):
        logging.warning(f"LOGIN FAIL: Wrong password for email='{credentials.email}'")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = str(user['_id'])
    
    # Create access token
    access_token = create_access_token(user_id, user['email'])
    
    # Return user and token
    user_response = UserResponse(
        id=user_id,
        fullName=user['fullName'],
        email=user['email'],
        phone=user['phone'],
        roles=user['roles'],
        isAdmin=user.get('isAdmin', False),
        createdAt=user['createdAt']
    )
    
    logging.info(f"LOGIN SUCCESS: email='{credentials.email}' roles={user['roles']} isAdmin={user.get('isAdmin', False)}")
    return TokenResponse(access_token=access_token, user=user_response)

@router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    # iter98d (Task 3): mirror trainer logic — trainees also need their
    # profile photo synced into /auth/me so the bottom-nav Profile tab
    # icon shows their actual thumbnail instead of falling back to initials.
    avatar_url = current_user.get('avatarUrl')
    profile_photo = current_user.get('profilePhoto')
    roles = current_user.get('roles') or []
    if not avatar_url and 'trainer' in roles:
        tp = await db.trainer_profiles.find_one(
            {'userId': str(current_user['_id'])},
            {'avatarUrl': 1, 'profilePhoto': 1}
        )
        if tp:
            avatar_url = tp.get('avatarUrl') or tp.get('profilePhoto')
            if not profile_photo:
                profile_photo = tp.get('profilePhoto') or tp.get('avatarUrl')
    if not avatar_url and 'trainee' in roles:
        tp = await db.trainee_profiles.find_one(
            {'userId': str(current_user['_id'])},
            {'avatarUrl': 1, 'profilePhoto': 1}
        )
        if tp:
            avatar_url = tp.get('avatarUrl') or tp.get('profilePhoto')
            if not profile_photo:
                profile_photo = tp.get('profilePhoto') or tp.get('avatarUrl')
    return UserResponse(
        id=str(current_user['_id']),
        fullName=current_user['fullName'],
        email=current_user['email'],
        phone=current_user['phone'],
        roles=current_user['roles'],
        isAdmin=current_user.get('isAdmin', False),
        createdAt=current_user['createdAt'],
        profilePhoto=profile_photo,
        avatarUrl=avatar_url,
        # iter98c: surface legal vs display name for own-profile editor
        legalName=current_user.get('legalName') or current_user['fullName'],
        displayName=current_user.get('displayName') or current_user['fullName'],
    )


# iter98c: free-form display name editing (#A. every user can rename themselves any time).
# - Trainers: legalName is preserved on first edit (snapshot of the original verified name).
#   Public-facing fullName + displayName get the new value. Admin can still see legalName.
# - Trainees: no legal-name concept; both fullName + displayName update.
# - Every rename writes a row to db.name_change_audit for admin audit log.
class UpdateMeRequest(BaseModel):
    displayName: Optional[str] = None
    phone: Optional[str] = None


@router.put("/auth/me")
async def update_me(payload: UpdateMeRequest, current_user: dict = Depends(get_current_user)):
    """Update current user's display name (free-form, audit-logged) and/or phone."""
    updates: dict = {}
    audit_entry: Optional[dict] = None

    if payload.displayName is not None:
        new_name = payload.displayName.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="Display name cannot be empty")
        if len(new_name) > 80:
            raise HTTPException(status_code=400, detail="Display name must be 80 characters or less")
        old_name = current_user.get('fullName', '')
        if new_name != old_name:
            # Preserve original legal name for trainers if not already snapshotted
            is_trainer = 'trainer' in (current_user.get('roles') or [])
            if is_trainer and not current_user.get('legalName'):
                updates['legalName'] = old_name
            updates['fullName'] = new_name
            updates['displayName'] = new_name
            audit_entry = {
                'userId': str(current_user['_id']),
                'email': current_user.get('email', ''),
                'roles': current_user.get('roles', []),
                'oldName': old_name,
                'newName': new_name,
                'legalNamePreserved': updates.get('legalName'),
                'changedAt': datetime.utcnow(),
            }

    if payload.phone is not None:
        phone = payload.phone.strip()
        if phone:
            updates['phone'] = phone

    if not updates:
        # No-op (idempotent) — still 200 to keep client UX simple
        return {'success': True, 'noop': True}

    updates['updatedAt'] = datetime.utcnow()
    await db.users.update_one({'_id': current_user['_id']}, {'$set': updates})

    if audit_entry:
        await db.name_change_audit.insert_one(audit_entry)
        # Mirror the new displayName into trainer_profiles / trainee_profiles so cards refresh
        await db.trainer_profiles.update_one(
            {'userId': str(current_user['_id'])},
            {'$set': {'fullName': updates['fullName'], 'updatedAt': datetime.utcnow()}},
        )
        await db.trainee_profiles.update_one(
            {'userId': str(current_user['_id'])},
            {'$set': {'fullName': updates['fullName'], 'updatedAt': datetime.utcnow()}},
        )

    return {'success': True, 'updates': {k: v for k, v in updates.items() if k != 'updatedAt'}}


@router.delete("/auth/me")
async def delete_me(current_user: dict = Depends(get_current_user)):
    """Delete the current user's account (Google Play requirement)."""
    user_id = str(current_user['_id'])

    # Delete related docs (best-effort)
    await db.trainer_profiles.delete_many({'userId': user_id})
    await db.trainee_profiles.delete_many({'userId': user_id})
    await db.sessions.delete_many({'$or': [{'traineeId': user_id}, {'trainerId': user_id}]})
    await db.ratings.delete_many({'$or': [{'traineeId': user_id}, {'trainerId': user_id}]})
    await db.trainer_achievements.delete_many({'trainerId': user_id})
    await db.trainee_achievements.delete_many({'traineeId': user_id})
    await db.blocks.delete_many({'$or': [{'blockerUserId': user_id}, {'blockedUserId': user_id}]})
    await db.reports.delete_many({'$or': [{'reporterUserId': user_id}, {'reportedUserId': user_id}]})

    # Finally delete user
    await db.users.delete_one({'_id': current_user['_id']})

    return {'success': True}


# ============================================================================
# PASSWORD RESET ENDPOINTS
# ============================================================================

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    newPassword: str

class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str

@router.post("/auth/change-password")
async def change_password(request: Request, data: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    """Change password for the currently authenticated user."""
    if not verify_password(data.currentPassword, current_user['passwordHash']):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    if len(data.newPassword) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    new_hash = hash_password(data.newPassword)
    await db.users.update_one(
        {'_id': current_user['_id']},
        {'$set': {'passwordHash': new_hash}}
    )
    return {"success": True, "message": "Password updated successfully"}


@router.post("/auth/forgot-password")
async def forgot_password(request: Request, data: ForgotPasswordRequest):
    """Request a password reset. Sends email if SendGrid is configured, otherwise returns contact support."""
    user = await db.users.find_one({'email': data.email})

    if user:
        # Generate reset token
        reset_token = uuid.uuid4().hex
        await db.password_resets.update_one(
            {'userId': str(user['_id'])},
            {'$set': {
                'userId': str(user['_id']),
                'token': reset_token,
                'createdAt': datetime.utcnow(),
                'used': False,
            }},
            upsert=True,
        )
        # Attempt to send email (no-op if SENDGRID_API_KEY is not set)
        email_sent = send_password_reset_email(
            data.email, reset_token, user.get('fullName', 'there')
        )
        if email_sent:
            return {"success": True, "message": "Password reset instructions have been sent to your email."}

    # Always return the same response to prevent email enumeration
    return {
        "success": True,
        "message": "If that email is registered, you'll receive reset instructions. Otherwise, contact support at support@rapidreps.com."
    }

@router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Reset password using a valid token."""
    reset_doc = await db.password_resets.find_one({
        'token': data.token,
        'used': False,
    })
    if not reset_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    # Check if token is older than 1 hour
    age = (datetime.utcnow() - reset_doc['createdAt']).total_seconds()
    if age > 3600:
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")

    if len(data.newPassword) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    hashed = bcrypt.hashpw(data.newPassword.encode(), bcrypt.gensalt()).decode()
    await db.users.update_one(
        {'_id': ObjectId(reset_doc['userId'])},
        {'$set': {'passwordHash': hashed, 'updatedAt': datetime.utcnow()}}
    )
    await db.password_resets.update_one(
        {'_id': reset_doc['_id']},
        {'$set': {'used': True}}
    )
    return {"success": True, "message": "Password reset successfully. You can now log in."}


