"""
RapidReps Shared Dependencies
Central module for database, auth, helpers, and utilities used across all route modules.
"""
import os
import re
import html
import logging
import bcrypt
import jwt
import random
import string
import aiohttp
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

from models import (
    PricingRules, SessionType, TrainerTier, TierThresholds,
    VerificationStatus, SessionStatus, REFERRAL_CREDIT_CENTS, MAX_REFERRALS_PER_USER,
    VALID_PERSONALITY_TAGS,
)

from slowapi import Limiter
from slowapi.util import get_remote_address

# Rate limiter
def get_real_ip(request):
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

limiter = Limiter(key_func=get_real_ip)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable must be set")
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()

# Input sanitization
_TAG_RE = re.compile(r'<[^>]+>')
def sanitize_text(text: Optional[str]) -> Optional[str]:
    if text is None:
        return None
    text = _TAG_RE.sub('', text)
    text = html.escape(text, quote=True)
    return text.strip()

# Auth helpers
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password) -> bool:
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password)

def create_access_token(user_id: str, email: str) -> str:
    expiration = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {'user_id': user_id, 'email': email, 'exp': expiration}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get('user_id')
    user = await db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def serialize_doc(doc: dict) -> dict:
    if doc and '_id' in doc:
        doc['id'] = str(doc['_id'])
        del doc['_id']
    for key, val in doc.items():
        if isinstance(val, datetime) and key in ('scheduledDate',):
            doc[key] = val.isoformat()
    return doc

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import radians, sin, cos, sqrt, atan2
    R = 3959
    lat1, lon1 = radians(lat1), radians(lon1)
    lat2, lon2 = radians(lat2), radians(lon2)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

# Business logic helpers
def generate_safety_pin() -> str:
    return ''.join(random.choices(string.digits, k=4))

def calculate_travel_fee(distance_miles: float) -> int:
    if distance_miles <= 5:
        return PricingRules.TRAVEL_FEE_0_5_MILES
    elif distance_miles <= 10:
        return PricingRules.TRAVEL_FEE_5_10_MILES
    elif distance_miles <= 15:
        return PricingRules.TRAVEL_FEE_10_15_MILES
    elif distance_miles <= 20:
        return PricingRules.TRAVEL_FEE_15_20_MILES
    else:
        return -1

def get_session_minimum_price(session_type: str) -> int:
    if session_type == SessionType.VIRTUAL:
        return PricingRules.VIRTUAL_MIN_CENTS
    elif session_type == SessionType.OUTDOOR:
        return PricingRules.OUTDOOR_MIN_CENTS
    elif session_type == SessionType.IN_HOME:
        return PricingRules.IN_HOME_MIN_CENTS
    return PricingRules.OUTDOOR_MIN_CENTS

def get_cancellation_fee(session_type: str) -> int:
    if session_type == SessionType.VIRTUAL:
        return PricingRules.CANCELLATION_FEE_VIRTUAL
    elif session_type == SessionType.OUTDOOR:
        return PricingRules.CANCELLATION_FEE_OUTDOOR
    elif session_type == SessionType.IN_HOME:
        return PricingRules.CANCELLATION_FEE_IN_HOME
    return PricingRules.CANCELLATION_FEE_OUTDOOR

def calculate_trainer_tier(total_reviews: int, average_rating: float, certs_verified: bool = False) -> str:
    if total_reviews >= TierThresholds.ELITE_MIN_REVIEWS and certs_verified:
        return TrainerTier.ELITE
    elif total_reviews >= TierThresholds.PRO_MIN_REVIEWS and average_rating >= TierThresholds.PRO_MIN_RATING:
        return TrainerTier.PRO
    return TrainerTier.BASIC

def check_trainer_can_go_live(profile: dict) -> tuple:
    if profile.get('verificationStatus') == VerificationStatus.VERIFIED:
        return (True, [])
    missing = []
    if not profile.get('governmentIdUploaded', False):
        missing.append('Government ID verification')
    if not profile.get('ssnVerified', False):
        missing.append('SSN identity check')
    if not profile.get('backgroundCheckPassed', False):
        missing.append('Background check')
    if not profile.get('sexOffenderCheckPassed', False):
        missing.append('Sex offender screening')
    if not profile.get('cprAedCertUploaded', False):
        missing.append('CPR/AED certification')
    if not profile.get('introVideoUploaded', False):
        missing.append('Intro video (10-30 seconds)')
    if not profile.get('bio') or len(profile.get('bio', '')) < 50:
        missing.append('Complete bio (min 50 characters)')
    if not profile.get('trainingStyles') or len(profile.get('trainingStyles', [])) == 0:
        missing.append('Training styles')
    virtual_rate = profile.get('virtualRateCents', 0)
    outdoor_rate = profile.get('outdoorRateCents', 0)
    in_home_rate = profile.get('inHomeRateCents', 0)
    if profile.get('offersVirtual', False) and virtual_rate < PricingRules.VIRTUAL_MIN_CENTS:
        missing.append(f'Virtual rate (min ${PricingRules.VIRTUAL_MIN_CENTS/100})')
    if profile.get('offersOutdoor', True) and outdoor_rate < PricingRules.OUTDOOR_MIN_CENTS:
        missing.append(f'Outdoor rate (min ${PricingRules.OUTDOOR_MIN_CENTS/100})')
    if profile.get('offersInHome', False) and in_home_rate < PricingRules.IN_HOME_MIN_CENTS:
        missing.append(f'In-home rate (min ${PricingRules.IN_HOME_MIN_CENTS/100})')
    return (len(missing) == 0, missing)

def calculate_session_payout(session_price_cents: int, session_type: str) -> dict:
    trainer_amount = int(session_price_cents * PricingRules.TRAINER_REVENUE_PERCENT / 100)
    platform_amount = session_price_cents - trainer_amount
    return {
        "total_cents": session_price_cents,
        "trainer_payout_cents": trainer_amount,
        "platform_fee_cents": platform_amount,
        "trainer_percent": PricingRules.TRAINER_REVENUE_PERCENT,
        "platform_percent": PricingRules.PLATFORM_REVENUE_PERCENT
    }

def calculate_travel_fee_split(travel_fee_cents: int) -> dict:
    trainer_amount = int(travel_fee_cents * PricingRules.TRAINER_TRAVEL_FEE_PERCENT / 100)
    platform_amount = travel_fee_cents - trainer_amount
    return {"total_cents": travel_fee_cents, "trainer_payout_cents": trainer_amount, "platform_fee_cents": platform_amount}

def calculate_cancellation_fee_detail(session_type: str) -> dict:
    fee_map = {
        SessionType.VIRTUAL: PricingRules.CANCELLATION_FEE_VIRTUAL,
        SessionType.OUTDOOR: PricingRules.CANCELLATION_FEE_OUTDOOR,
        SessionType.IN_HOME: PricingRules.CANCELLATION_FEE_IN_HOME,
    }
    fee_cents = fee_map.get(session_type, PricingRules.CANCELLATION_FEE_VIRTUAL)
    return calculate_session_payout(fee_cents, session_type)

def calculate_time_based_cancellation_penalty(session_start: datetime, session_price_cents: int, cancelled_by: str) -> dict:
    now = datetime.utcnow()
    hours_until_session = (session_start - now).total_seconds() / 3600
    if cancelled_by == "trainee":
        if hours_until_session > 12:
            penalty_percent = 0
        elif hours_until_session > 2:
            penalty_percent = 25
        else:
            penalty_percent = 50
        penalty_cents = int(session_price_cents * penalty_percent / 100)
        refund_cents = session_price_cents - penalty_cents
        trainer_payout_cents = int(penalty_cents * PricingRules.TRAINER_REVENUE_PERCENT / 100)
        platform_fee_cents = penalty_cents - trainer_payout_cents
        return {
            "penalty_percent": penalty_percent, "penalty_cents": penalty_cents,
            "refund_cents": refund_cents, "trainer_payout_cents": trainer_payout_cents,
            "platform_fee_cents": platform_fee_cents,
            "hours_until_session": round(hours_until_session, 1),
            "gives_strike": False, "gives_credit": False,
        }
    else:
        gives_strike = hours_until_session <= 12
        return {
            "penalty_percent": 0, "penalty_cents": 0,
            "refund_cents": session_price_cents, "trainer_payout_cents": 0,
            "platform_fee_cents": 0, "hours_until_session": round(hours_until_session, 1),
            "gives_strike": gives_strike, "gives_credit": gives_strike,
        }

def get_minimum_price(session_type: str) -> int:
    min_prices = {
        SessionType.VIRTUAL: PricingRules.VIRTUAL_MIN_CENTS,
        SessionType.OUTDOOR: PricingRules.OUTDOOR_MIN_CENTS,
        SessionType.IN_HOME: PricingRules.IN_HOME_MIN_CENTS,
    }
    return min_prices.get(session_type, PricingRules.VIRTUAL_MIN_CENTS)

def calculate_session_pricing(
    session_type: str, trainer_profile: dict, duration_minutes: int = 60,
    distance_miles: float = 0, trainee_session_count: int = 0, has_membership: bool = False,
) -> dict:
    if session_type == SessionType.VIRTUAL:
        hourly_rate = trainer_profile.get('virtualRateCents', PricingRules.VIRTUAL_MIN_CENTS)
    elif session_type == SessionType.OUTDOOR:
        hourly_rate = trainer_profile.get('outdoorRateCents', PricingRules.OUTDOOR_MIN_CENTS)
    elif session_type == SessionType.IN_HOME:
        hourly_rate = trainer_profile.get('inHomeRateCents', PricingRules.IN_HOME_MIN_CENTS)
    else:
        hourly_rate = PricingRules.OUTDOOR_MIN_CENTS
    base_rate = int(hourly_rate * duration_minutes / 60)
    minimum = get_session_minimum_price(session_type)
    if base_rate < minimum:
        base_rate = minimum
    travel_fee = 0
    trainer_travel_earning = 0
    platform_travel_fee = 0
    if session_type == SessionType.IN_HOME and distance_miles > 0:
        travel_fee = calculate_travel_fee(distance_miles)
        if travel_fee > 0:
            trainer_travel_earning = int(travel_fee * PricingRules.TRAINER_TRAVEL_FEE_PERCENT / 100)
            platform_travel_fee = travel_fee - trainer_travel_earning
    discount_type = None
    discount_amount = 0
    if trainee_session_count >= 2:
        discount_type = "multi_session_5pct"
        discount_amount = int(base_rate * 0.05)
    membership_discount = 0
    if has_membership:
        membership_discount = int(base_rate * PricingRules.MEMBERSHIP_SESSION_DISCOUNT_PERCENT / 100)
        discount_type = "membership_10pct" if not discount_type else f"{discount_type}+membership_10pct"
        discount_amount += membership_discount
    trainer_rate = base_rate - discount_amount
    session_gross = int(round(trainer_rate / 0.80))
    trainer_earnings = trainer_rate
    platform_fee = session_gross - trainer_earnings
    service_fee = PricingRules.SERVICE_FEE_CENTS
    subtotal = session_gross + travel_fee
    total_charged = subtotal + service_fee
    return {
        'baseSessionPriceCents': base_rate, 'travelFeeCents': travel_fee,
        'travelDistanceMiles': distance_miles if travel_fee > 0 else None,
        'trainerTravelEarningsCents': trainer_travel_earning,
        'platformTravelFeeCents': platform_travel_fee,
        'discountType': discount_type, 'discountAmountCents': discount_amount,
        'membershipDiscountCents': membership_discount,
        'sessionSubtotalCents': subtotal, 'serviceFeeCents': service_fee,
        'totalChargedCents': total_charged, 'finalSessionPriceCents': total_charged,
        'platformFeePercent': PricingRules.PLATFORM_REVENUE_PERCENT,
        'platformFeeCents': platform_fee + service_fee + platform_travel_fee,
        'trainerEarningsCents': trainer_earnings + trainer_travel_earning,
        'trainerRevenuePercent': PricingRules.TRAINER_REVENUE_PERCENT,
        'cancellationFeeCents': get_cancellation_fee(session_type),
    }

# Push notifications
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    try:
        tokens_cursor = db.push_tokens.find({'userId': user_id})
        tokens = await tokens_cursor.to_list(10)
        if not tokens:
            return
        unread_count = await db.notifications.count_documents({'userId': user_id, 'read': False})
        messages = []
        for t in tokens:
            msg = {
                "to": t['token'], "sound": "default", "title": title, "body": body,
                "priority": "high", "badge": unread_count, "channelId": "default",
            }
            if data:
                msg["data"] = data
            messages.append(msg)
        async with aiohttp.ClientSession() as session:
            await session.post(EXPO_PUSH_URL, json=messages, headers={"Content-Type": "application/json"})
    except Exception as e:
        logging.getLogger(__name__).warning(f"Push notification failed for user {user_id}: {e}")

async def send_push_to_many(user_ids: List[str], title: str, body: str, data: dict = None):
    for uid in user_ids:
        await send_push_notification(uid, title, body, data)


async def require_admin(current_user: dict = Depends(get_current_user)):
    """Dependency to ensure user is admin"""
    from models import UserRole
    if not current_user.get('isAdmin', False) and UserRole.ADMIN not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
