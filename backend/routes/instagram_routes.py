"""Instagram Graph API (Instagram Login) integration — Tinder-style profile linking.

Backend handles all token exchange & storage. Mobile client only opens OAuth URL
and relays the authorization code. Tokens are AES-GCM encrypted at rest.

Endpoints:
- POST   /api/instagram/oauth/start       — returns authorization_url
- POST   /api/instagram/oauth/callback    — exchanges code → long-lived token
- GET    /api/instagram/media             — returns last 8 media items
- GET    /api/instagram/status            — { linked, username, selectedMediaIds, lastSyncedAt }
- POST   /api/instagram/curate            — body: { selectedMediaIds: [...] }
- POST   /api/instagram/refresh           — manual refresh trigger
- POST   /api/instagram/unlink            — user-initiated unlink
- POST   /api/instagram/deauthorize       — Meta webhook (no auth)
- POST   /api/instagram/data-deletion     — Meta webhook (no auth)
"""
from fastapi import APIRouter, HTTPException, Depends, Request, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from urllib.parse import urlencode
import os
import base64
import secrets
import logging
import httpx

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from deps import db, get_current_user

router = APIRouter(prefix="/api/instagram", tags=["instagram"])
logger = logging.getLogger(__name__)

# ── Config ──
INSTAGRAM_APP_ID = os.environ.get("INSTAGRAM_APP_ID", "")
INSTAGRAM_APP_SECRET = os.environ.get("INSTAGRAM_APP_SECRET", "")
INSTAGRAM_REDIRECT_URI = os.environ.get("INSTAGRAM_REDIRECT_URI", "rapidreps://instagram-callback")
ENC_KEY_B64 = os.environ.get("INSTAGRAM_TOKEN_ENC_KEY", "")

AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize"
TOKEN_EXCHANGE_URL = "https://api.instagram.com/oauth/access_token"
LONG_LIVED_URL = "https://graph.instagram.com/access_token"
REFRESH_URL = "https://graph.instagram.com/refresh_access_token"
PROFILE_URL = "https://graph.instagram.com/me"
MEDIA_URL = "https://graph.instagram.com/me/media"

# Scope: instagram_business_basic (read profile + media for Business/Creator accounts)
DEFAULT_SCOPES = "instagram_business_basic"


def _enc_key() -> bytes:
    if not ENC_KEY_B64:
        raise RuntimeError("INSTAGRAM_TOKEN_ENC_KEY not set")
    return base64.urlsafe_b64decode(ENC_KEY_B64)


def encrypt_token(plain: str) -> dict:
    aesgcm = AESGCM(_enc_key())
    iv = os.urandom(12)
    ct = aesgcm.encrypt(iv, plain.encode("utf-8"), None)
    return {
        "access_token_enc": base64.b64encode(ct).decode("ascii"),
        "access_token_iv": base64.b64encode(iv).decode("ascii"),
    }


def decrypt_token(doc: dict) -> str:
    aesgcm = AESGCM(_enc_key())
    iv = base64.b64decode(doc["access_token_iv"])
    ct = base64.b64decode(doc["access_token_enc"])
    return aesgcm.decrypt(iv, ct, None).decode("utf-8")


def _instagram_configured() -> bool:
    return bool(INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET and ENC_KEY_B64)


# ────────────────────────────────────────────────────────────────────────
# MODELS
# ────────────────────────────────────────────────────────────────────────

class OAuthStartResponse(BaseModel):
    authorization_url: str
    state: str


class OAuthCallbackRequest(BaseModel):
    code: str
    state: str


class OAuthCallbackResponse(BaseModel):
    linked: bool
    username: Optional[str] = None
    accountType: Optional[str] = None
    mediaCount: int = 0


class MediaItem(BaseModel):
    id: str
    media_type: str
    media_product_type: Optional[str] = None
    media_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    permalink: Optional[str] = None
    caption: Optional[str] = None
    timestamp: Optional[str] = None
    isSelected: bool = False


class MediaResponse(BaseModel):
    items: List[MediaItem]
    lastSyncedAt: Optional[str] = None


class CurateRequest(BaseModel):
    selectedMediaIds: List[str]


class StatusResponse(BaseModel):
    linked: bool
    username: Optional[str] = None
    accountType: Optional[str] = None
    selectedMediaIds: List[str] = []
    lastSyncedAt: Optional[str] = None
    expiresAt: Optional[str] = None


# ────────────────────────────────────────────────────────────────────────
# HELPERS
# ────────────────────────────────────────────────────────────────────────

async def _fetch_media_from_ig(access_token: str, limit: int = 8) -> List[dict]:
    """Call /me/media and return raw data array."""
    params = {
        "fields": "id,media_type,media_product_type,media_url,thumbnail_url,permalink,caption,timestamp",
        "limit": limit,
        "access_token": access_token,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(MEDIA_URL, params=params)
    if resp.status_code != 200:
        logger.warning(f"IG /me/media failed: {resp.status_code} {resp.text[:200]}")
        raise HTTPException(502, "Failed to fetch Instagram media")
    return resp.json().get("data", [])


def _to_iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


# ────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ────────────────────────────────────────────────────────────────────────

@router.post("/oauth/start", response_model=OAuthStartResponse)
async def oauth_start(current_user: dict = Depends(get_current_user)):
    """Build authorization URL with CSRF-safe state. Stores state per user."""
    if not _instagram_configured():
        raise HTTPException(503, "Instagram integration not yet configured")

    state = secrets.token_urlsafe(32)
    user_id = str(current_user["_id"])
    await db.instagram_links.update_one(
        {"userId": user_id},
        {"$set": {
            "userId": user_id,
            "oauthState": state,
            "oauthStateCreatedAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }},
        upsert=True,
    )

    params = {
        "client_id": INSTAGRAM_APP_ID,
        "redirect_uri": INSTAGRAM_REDIRECT_URI,
        "scope": DEFAULT_SCOPES,
        "response_type": "code",
        "state": state,
    }
    return OAuthStartResponse(
        authorization_url=f"{AUTHORIZE_URL}?{urlencode(params)}",
        state=state,
    )


@router.post("/oauth/callback", response_model=OAuthCallbackResponse)
async def oauth_callback(payload: OAuthCallbackRequest, current_user: dict = Depends(get_current_user)):
    """Exchange auth code → short-lived → long-lived token. Reject personal accounts."""
    if not _instagram_configured():
        raise HTTPException(503, "Instagram integration not yet configured")

    user_id = str(current_user["_id"])
    link_doc = await db.instagram_links.find_one({"userId": user_id})
    expected_state = (link_doc or {}).get("oauthState")
    if not expected_state or payload.state != expected_state:
        raise HTTPException(400, "Invalid OAuth state")

    # 1️⃣ Exchange code → short-lived token
    async with httpx.AsyncClient(timeout=15.0) as client:
        token_resp = await client.post(
            TOKEN_EXCHANGE_URL,
            data={
                "client_id": INSTAGRAM_APP_ID,
                "client_secret": INSTAGRAM_APP_SECRET,
                "grant_type": "authorization_code",
                "redirect_uri": INSTAGRAM_REDIRECT_URI,
                "code": payload.code,
            },
        )
    if token_resp.status_code != 200:
        logger.warning(f"IG token exchange failed: {token_resp.status_code} {token_resp.text[:200]}")
        raise HTTPException(400, "Instagram token exchange failed")
    short_data = token_resp.json()
    short_token = short_data["access_token"]
    ig_user_id = short_data.get("user_id")

    # 2️⃣ Upgrade to long-lived token (60-day)
    async with httpx.AsyncClient(timeout=15.0) as client:
        long_resp = await client.get(
            LONG_LIVED_URL,
            params={
                "grant_type": "ig_exchange_token",
                "client_secret": INSTAGRAM_APP_SECRET,
                "access_token": short_token,
            },
        )
    if long_resp.status_code != 200:
        logger.warning(f"IG long-lived exchange failed: {long_resp.text[:200]}")
        raise HTTPException(400, "Long-lived token exchange failed")
    long_data = long_resp.json()
    long_token = long_data["access_token"]
    expires_in = long_data.get("expires_in", 60 * 24 * 3600)  # default 60 days
    expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

    # 3️⃣ Fetch profile to check account_type (reject PERSONAL)
    async with httpx.AsyncClient(timeout=15.0) as client:
        profile_resp = await client.get(
            PROFILE_URL,
            params={"fields": "id,username,account_type", "access_token": long_token},
        )
    if profile_resp.status_code != 200:
        raise HTTPException(400, "Failed to fetch Instagram profile")
    profile = profile_resp.json()
    account_type = profile.get("account_type", "")
    username = profile.get("username")
    ig_uid = profile.get("id") or ig_user_id

    if account_type not in ("BUSINESS", "CREATOR"):
        # Decision 1a: block personal accounts
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PERSONAL_ACCOUNT_NOT_SUPPORTED",
                "message": "Only Instagram Business or Creator accounts can be linked. Convert your account in Instagram settings and try again.",
                "accountType": account_type,
            },
        )

    # 4️⃣ Fetch initial media to count
    media_items = await _fetch_media_from_ig(long_token, limit=8)

    # 5️⃣ Persist encrypted token + metadata
    enc = encrypt_token(long_token)
    await db.instagram_links.update_one(
        {"userId": user_id},
        {
            "$set": {
                **enc,
                "instagramUserId": ig_uid,
                "username": username,
                "accountType": account_type,
                "expiresAt": expires_at,
                "lastSyncedAt": datetime.utcnow(),
                "cachedMedia": media_items,
                "selectedMediaIds": [m["id"] for m in media_items],  # default: all selected
                "updatedAt": datetime.utcnow(),
            },
            "$unset": {"oauthState": "", "oauthStateCreatedAt": ""},
        },
        upsert=True,
    )

    return OAuthCallbackResponse(
        linked=True,
        username=username,
        accountType=account_type,
        mediaCount=len(media_items),
    )


@router.get("/status", response_model=StatusResponse)
async def get_status(current_user: dict = Depends(get_current_user)):
    """Lightweight status check used by Profile screen to decide whether to show 'Link IG' or the grid."""
    user_id = str(current_user["_id"])
    doc = await db.instagram_links.find_one(
        {"userId": user_id, "access_token_enc": {"$exists": True}},
        {"_id": 0, "username": 1, "accountType": 1, "selectedMediaIds": 1, "lastSyncedAt": 1, "expiresAt": 1},
    )
    if not doc:
        return StatusResponse(linked=False)
    return StatusResponse(
        linked=True,
        username=doc.get("username"),
        accountType=doc.get("accountType"),
        selectedMediaIds=doc.get("selectedMediaIds", []),
        lastSyncedAt=_to_iso(doc.get("lastSyncedAt")),
        expiresAt=_to_iso(doc.get("expiresAt")),
    )


@router.get("/media", response_model=MediaResponse)
async def get_media(current_user: dict = Depends(get_current_user)):
    """Return the cached last-8 media items with isSelected flag. Curator view uses this."""
    user_id = str(current_user["_id"])
    doc = await db.instagram_links.find_one({"userId": user_id})
    if not doc or not doc.get("access_token_enc"):
        raise HTTPException(404, "Instagram not linked")

    cached = doc.get("cachedMedia", [])
    selected = set(doc.get("selectedMediaIds", []))
    items = [
        MediaItem(
            id=m.get("id"),
            media_type=m.get("media_type", ""),
            media_product_type=m.get("media_product_type"),
            media_url=m.get("media_url"),
            thumbnail_url=m.get("thumbnail_url"),
            permalink=m.get("permalink"),
            caption=m.get("caption"),
            timestamp=m.get("timestamp"),
            isSelected=m.get("id") in selected,
        )
        for m in cached
    ]
    return MediaResponse(items=items, lastSyncedAt=_to_iso(doc.get("lastSyncedAt")))


@router.get("/public-media/{target_user_id}")
async def get_public_media(target_user_id: str, current_user: dict = Depends(get_current_user)):
    """When viewing another user's profile, return ONLY their selected (curated) media."""
    doc = await db.instagram_links.find_one({"userId": target_user_id})
    if not doc or not doc.get("access_token_enc"):
        return {"linked": False, "items": [], "username": None}
    selected = set(doc.get("selectedMediaIds", []))
    cached = doc.get("cachedMedia", [])
    items = [
        {
            "id": m.get("id"),
            "media_type": m.get("media_type"),
            "media_product_type": m.get("media_product_type"),
            "media_url": m.get("media_url"),
            "thumbnail_url": m.get("thumbnail_url"),
            "permalink": m.get("permalink"),
            "timestamp": m.get("timestamp"),
        }
        for m in cached if m.get("id") in selected
    ]
    return {"linked": True, "items": items, "username": doc.get("username")}


@router.post("/curate")
async def curate_media(payload: CurateRequest, current_user: dict = Depends(get_current_user)):
    """User picks WHICH of their last 8 media items appear on their public profile."""
    user_id = str(current_user["_id"])
    doc = await db.instagram_links.find_one({"userId": user_id})
    if not doc or not doc.get("access_token_enc"):
        raise HTTPException(404, "Instagram not linked")
    valid_ids = {m["id"] for m in doc.get("cachedMedia", [])}
    selected = [mid for mid in payload.selectedMediaIds if mid in valid_ids]
    await db.instagram_links.update_one(
        {"userId": user_id},
        {"$set": {"selectedMediaIds": selected, "updatedAt": datetime.utcnow()}},
    )
    return {"success": True, "selectedCount": len(selected)}


@router.post("/refresh", response_model=MediaResponse)
async def refresh_media(current_user: dict = Depends(get_current_user)):
    """User-triggered refresh: re-fetch /me/media + optionally extend long-lived token."""
    if not _instagram_configured():
        raise HTTPException(503, "Instagram integration not yet configured")

    user_id = str(current_user["_id"])
    doc = await db.instagram_links.find_one({"userId": user_id})
    if not doc or not doc.get("access_token_enc"):
        raise HTTPException(404, "Instagram not linked")

    token = decrypt_token(doc)

    # If token is < 7 days from expiry, refresh it
    expires_at = doc.get("expiresAt")
    if expires_at and (expires_at - datetime.utcnow()) < timedelta(days=7):
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(REFRESH_URL, params={"grant_type": "ig_refresh_token", "access_token": token})
        if r.status_code == 200:
            d = r.json()
            token = d["access_token"]
            new_expires = datetime.utcnow() + timedelta(seconds=d.get("expires_in", 60 * 24 * 3600))
            enc = encrypt_token(token)
            await db.instagram_links.update_one(
                {"userId": user_id},
                {"$set": {**enc, "expiresAt": new_expires, "updatedAt": datetime.utcnow()}},
            )

    # Fetch fresh media
    fresh = await _fetch_media_from_ig(token, limit=8)
    fresh_ids = {m["id"] for m in fresh}
    # Preserve curation only for media that still exists
    prior_selected = set(doc.get("selectedMediaIds", []))
    selected = [mid for mid in prior_selected if mid in fresh_ids]
    # If user hadn't curated yet, default to all selected
    if not selected:
        selected = [m["id"] for m in fresh]

    now = datetime.utcnow()
    await db.instagram_links.update_one(
        {"userId": user_id},
        {"$set": {"cachedMedia": fresh, "selectedMediaIds": selected, "lastSyncedAt": now, "updatedAt": now}},
    )

    return MediaResponse(
        items=[
            MediaItem(
                id=m.get("id"),
                media_type=m.get("media_type", ""),
                media_product_type=m.get("media_product_type"),
                media_url=m.get("media_url"),
                thumbnail_url=m.get("thumbnail_url"),
                permalink=m.get("permalink"),
                caption=m.get("caption"),
                timestamp=m.get("timestamp"),
                isSelected=m.get("id") in set(selected),
            )
            for m in fresh
        ],
        lastSyncedAt=_to_iso(now),
    )


@router.post("/unlink")
async def unlink(current_user: dict = Depends(get_current_user)):
    """User-initiated unlink: hard-delete the link doc."""
    user_id = str(current_user["_id"])
    result = await db.instagram_links.delete_one({"userId": user_id})
    return {"success": True, "deleted": result.deleted_count > 0}


# ── Meta-required webhook endpoints (unauthenticated, public URLs) ──

@router.post("/deauthorize")
async def deauthorize_webhook(request: Request):
    """Called by Meta when a user revokes the app's IG access from their IG settings."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    ig_user_id = body.get("user_id") or body.get("instagram_user_id")
    logger.info(f"IG deauthorize webhook received: ig_user_id={ig_user_id}")
    if ig_user_id:
        await db.instagram_links.delete_many({"instagramUserId": str(ig_user_id)})
    return {"status": "ok"}


@router.post("/data-deletion")
async def data_deletion_webhook(request: Request):
    """Called by Meta when a user requests deletion of their data."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    ig_user_id = body.get("user_id") or body.get("instagram_user_id")
    logger.info(f"IG data-deletion webhook received: ig_user_id={ig_user_id}")
    confirmation_code = secrets.token_urlsafe(16)
    if ig_user_id:
        await db.instagram_links.delete_many({"instagramUserId": str(ig_user_id)})
    return {
        "url": f"https://trainer-finder-9.emergent.host/api/privacy/data-deletion-status?code={confirmation_code}",
        "confirmation_code": confirmation_code,
    }


@router.get("/deauthorize")
@router.get("/data-deletion")
async def webhook_verification():
    """Some Meta dashboard 'Verify' buttons send a GET to confirm reachability."""
    return {"status": "ok", "message": "RapidReps Instagram webhook is live"}
