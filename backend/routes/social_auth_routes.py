"""Social auth routes: Google (Emergent), Apple Sign-In, Facebook (scaffolded)."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import logging
import httpx

from deps import (
    db, create_access_token, hash_password, limiter,
)
from models import UserResponse, TokenResponse

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
APPLE_PUBLIC_KEYS_URL = "https://appleid.apple.com/auth/keys"

# Cache Apple public keys
_apple_keys_cache = {}


# ============================================================================
# MODELS
# ============================================================================

class GoogleSocialLogin(BaseModel):
    sessionId: str

class AppleSocialLogin(BaseModel):
    identityToken: str
    userId: str
    email: Optional[str] = None
    fullName: Optional[str] = None

class FacebookSocialLogin(BaseModel):
    accessToken: str
    userId: str
    email: Optional[str] = None
    fullName: Optional[str] = None


# ============================================================================
# HELPERS
# ============================================================================

async def find_or_create_social_user(
    email: str,
    full_name: str,
    provider: str,
    provider_id: str,
    picture: Optional[str] = None,
):
    """Find existing user by email or create new one. Returns (user_doc, is_new)."""
    existing = await db.users.find_one({'email': email})

    if existing:
        # Link social provider if not already linked
        social_providers = existing.get('socialProviders', [])
        if provider not in [sp.get('provider') for sp in social_providers]:
            social_providers.append({
                'provider': provider,
                'providerId': provider_id,
                'linkedAt': datetime.utcnow(),
            })
            update_fields = {'socialProviders': social_providers, 'updatedAt': datetime.utcnow()}
            if picture and not existing.get('profilePhoto'):
                update_fields['profilePhoto'] = picture
            await db.users.update_one({'_id': existing['_id']}, {'$set': update_fields})

        return existing, False

    # Create new user (no password — social-only account)
    import random
    import string
    referral_code = f"RR-{''.join(random.choices(string.ascii_uppercase + string.digits, k=6))}"

    user_doc = {
        'fullName': full_name,
        'email': email,
        'phone': '',
        'passwordHash': None,
        'roles': [],  # Will be set during onboarding
        'isAdmin': False,
        'emailVerified': True,
        'authProvider': provider,
        'socialProviders': [{
            'provider': provider,
            'providerId': provider_id,
            'linkedAt': datetime.utcnow(),
        }],
        'profilePhoto': picture,
        'referralCode': referral_code,
        'referralCredits': 0,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow(),
    }

    result = await db.users.insert_one(user_doc)
    user_doc['_id'] = result.inserted_id
    return user_doc, True


def build_social_response(user_doc, is_new: bool):
    """Build JWT token + user response for social login."""
    user_id = str(user_doc['_id'])
    access_token = create_access_token(user_id, user_doc['email'])

    user_response = UserResponse(
        id=user_id,
        fullName=user_doc.get('fullName', ''),
        email=user_doc['email'],
        phone=user_doc.get('phone', ''),
        roles=user_doc.get('roles', []),
        isAdmin=user_doc.get('isAdmin', False),
        createdAt=user_doc.get('createdAt', datetime.utcnow()),
    )

    return {
        'access_token': access_token,
        'user': user_response.dict(),
        'isNewUser': is_new,
    }


# ============================================================================
# GOOGLE (EMERGENT AUTH)
# ============================================================================

@router.post("/auth/social/google")
@limiter.limit("30/minute")
async def google_social_login(request: Request, body: GoogleSocialLogin):
    """Exchange Emergent Google session_id for user data and create/find user."""
    logger.info(f"GOOGLE SOCIAL LOGIN: session_id={body.sessionId[:20]}...")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                EMERGENT_SESSION_URL,
                headers={"X-Session-ID": body.sessionId},
            )

        if resp.status_code != 200:
            logger.error(f"Emergent session lookup failed: {resp.status_code} {resp.text}")
            raise HTTPException(401, "Google authentication failed. Please try again.")

        session_data = resp.json()
        email = session_data.get('email')
        name = session_data.get('name', '')
        picture = session_data.get('picture', '')
        provider_id = session_data.get('id', '')

        if not email:
            raise HTTPException(400, "No email returned from Google.")

        logger.info(f"GOOGLE AUTH: email={email}, name={name}")

    except httpx.RequestError as e:
        logger.error(f"Emergent session request error: {e}")
        raise HTTPException(502, "Unable to verify Google login. Please try again.")

    user_doc, is_new = await find_or_create_social_user(
        email=email,
        full_name=name,
        provider='google',
        provider_id=provider_id,
        picture=picture,
    )

    logger.info(f"GOOGLE LOGIN {'NEW' if is_new else 'EXISTING'}: email={email}")
    return build_social_response(user_doc, is_new)


# ============================================================================
# APPLE SIGN-IN
# ============================================================================

async def get_apple_public_keys():
    """Fetch and cache Apple's public signing keys."""
    global _apple_keys_cache
    if not _apple_keys_cache:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(APPLE_PUBLIC_KEYS_URL)
            keys_data = resp.json()
            _apple_keys_cache = {k['kid']: k for k in keys_data.get('keys', [])}
    return _apple_keys_cache


@router.post("/auth/social/apple")
@limiter.limit("30/minute")
async def apple_social_login(request: Request, body: AppleSocialLogin):
    """Verify Apple identity token and create/find user."""
    logger.info(f"APPLE SOCIAL LOGIN: userId={body.userId[:20]}...")

    try:
        from jose import jwt as jose_jwt, jwk

        # Decode token header to get kid
        headers = jose_jwt.get_unverified_header(body.identityToken)
        kid = headers.get('kid')

        if not kid:
            raise HTTPException(401, "Invalid Apple token: missing kid")

        # Get Apple's public keys
        apple_keys = await get_apple_public_keys()
        if kid not in apple_keys:
            # Refresh cache and retry
            global _apple_keys_cache
            _apple_keys_cache = {}
            apple_keys = await get_apple_public_keys()
            if kid not in apple_keys:
                raise HTTPException(401, "Invalid Apple token: unknown key")

        key = apple_keys[kid]

        # Verify and decode the token
        payload = jose_jwt.decode(
            body.identityToken,
            key,
            algorithms=['RS256'],
            audience=None,  # Skip audience check — bundle ID varies
            options={
                'verify_aud': False,
                'verify_iss': True,
            },
            issuer='https://appleid.apple.com',
        )

        # Verify sub matches userId
        if payload.get('sub') != body.userId:
            raise HTTPException(401, "Apple token user mismatch")

        email = payload.get('email') or body.email
        if not email:
            # Apple may not return email on subsequent logins
            # Try to find existing user by Apple userId
            existing = await db.users.find_one({
                'socialProviders': {
                    '$elemMatch': {'provider': 'apple', 'providerId': body.userId}
                }
            })
            if existing:
                return build_social_response(existing, False)
            raise HTTPException(400, "Email not available. Please use a different sign-in method.")

        # Name is only provided on FIRST Apple sign-in
        full_name = body.fullName or email.split('@')[0]

        logger.info(f"APPLE AUTH: email={email}, sub={body.userId[:15]}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Apple token verification error: {e}")
        raise HTTPException(401, f"Apple authentication failed: {str(e)}")

    user_doc, is_new = await find_or_create_social_user(
        email=email,
        full_name=full_name,
        provider='apple',
        provider_id=body.userId,
    )

    logger.info(f"APPLE LOGIN {'NEW' if is_new else 'EXISTING'}: email={email}")
    return build_social_response(user_doc, is_new)


# ============================================================================
# FACEBOOK (SCAFFOLDED — Requires App ID)
# ============================================================================

@router.post("/auth/social/facebook")
@limiter.limit("30/minute")
async def facebook_social_login(request: Request, body: FacebookSocialLogin):
    """Verify Facebook access token and create/find user.
    NOTE: Requires FACEBOOK_APP_ID environment variable to be set.
    """
    import os
    fb_app_id = os.environ.get('FACEBOOK_APP_ID')

    if not fb_app_id:
        raise HTTPException(
            501,
            "Facebook login is coming soon. Please use Google or Apple to sign in."
        )

    logger.info(f"FACEBOOK SOCIAL LOGIN: userId={body.userId[:20]}...")

    try:
        # Verify token with Facebook Graph API
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://graph.facebook.com/me?fields=id,name,email,picture&access_token={body.accessToken}"
            )

        if resp.status_code != 200:
            raise HTTPException(401, "Facebook authentication failed.")

        fb_data = resp.json()
        email = fb_data.get('email') or body.email
        name = fb_data.get('name', '')
        picture = fb_data.get('picture', {}).get('data', {}).get('url', '')
        fb_id = fb_data.get('id', body.userId)

        if not email:
            raise HTTPException(400, "Email not available from Facebook. Please use a different method.")

    except httpx.RequestError as e:
        logger.error(f"Facebook verification error: {e}")
        raise HTTPException(502, "Unable to verify Facebook login.")

    user_doc, is_new = await find_or_create_social_user(
        email=email,
        full_name=name,
        provider='facebook',
        provider_id=fb_id,
        picture=picture,
    )

    logger.info(f"FACEBOOK LOGIN {'NEW' if is_new else 'EXISTING'}: email={email}")
    return build_social_response(user_doc, is_new)
