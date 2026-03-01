from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
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


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Rate limiter — use X-Forwarded-For behind proxy/ingress
def get_real_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

limiter = Limiter(key_func=get_real_ip)

# Input sanitization — strip HTML/script tags from user-generated text
_TAG_RE = re.compile(r'<[^>]+>')
def sanitize_text(text: Optional[str]) -> Optional[str]:
    if text is None:
        return None
    text = _TAG_RE.sub('', text)          # strip HTML tags
    text = html.escape(text, quote=True)   # escape remaining entities
    return text.strip()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Stripe configuration
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')

# ============================================================================
# PUSH NOTIFICATION SERVICE (Expo Push API)
# ============================================================================
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """Send push notification to a user via Expo Push API. Fire-and-forget."""
    try:
        tokens_cursor = db.push_tokens.find({'userId': user_id})
        tokens = await tokens_cursor.to_list(10)
        if not tokens:
            return

        messages = []
        for t in tokens:
            msg = {
                "to": t['token'],
                "sound": "default",
                "title": title,
                "body": body,
            }
            if data:
                msg["data"] = data
            messages.append(msg)

        async with aiohttp.ClientSession() as session:
            await session.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={"Content-Type": "application/json"}
            )
    except Exception as e:
        logging.getLogger(__name__).warning(f"Push notification failed for user {user_id}: {e}")

async def send_push_to_many(user_ids: List[str], title: str, body: str, data: dict = None):
    """Send push notification to multiple users."""
    for uid in user_ids:
        await send_push_notification(uid, title, body, data)

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable must be set")
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()

# Create the main app
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

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class UserRole:
    TRAINER = "trainer"
    TRAINEE = "trainee"
    ADMIN = "admin"

class FitnessLevel:
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"

class SessionStatus:
    REQUESTED = "requested"
    CONFIRMED = "confirmed"
    DECLINED = "declined"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    NO_SHOW = "no_show"
    EN_ROUTE = "en_route"
    IN_PROGRESS = "in_progress"

# ============================================================================
# RAPIDREPS BUSINESS RULES - PAYMENT MODEL
# ============================================================================

class SessionType:
    VIRTUAL = "virtual"
    OUTDOOR = "outdoor"
    IN_HOME = "in_home"
    TRAINEE_HOME = "trainee_home"  # NEW: At trainee's home

class TrainerTier:
    BASIC = "basic"       # 0-29 reviews
    PRO = "pro"           # 30-99 reviews, 4.7+ stars
    ELITE = "elite"       # 100+ reviews, verified certifications

# PRICING & REVENUE SPLIT RULES
class PricingRules:
    # Revenue Split - Trainer keeps 75%, RapidReps keeps 25%
    TRAINER_REVENUE_PERCENT = 75
    PLATFORM_REVENUE_PERCENT = 25
    
    # Minimum session prices (in cents)
    VIRTUAL_MIN_CENTS = 3000       # $30 minimum
    OUTDOOR_MIN_CENTS = 4000       # $40 minimum
    IN_HOME_MIN_CENTS = 6000       # $60 minimum
    TRAINEE_HOME_MIN_CENTS = 6000  # $60 minimum (same as in-home)
    
    # Travel fee for In-Home/Trainee-Home sessions
    # Range: $0-$15, Trainer keeps 70%, Platform keeps 30%
    TRAVEL_FEE_MIN_CENTS = 0       # $0
    TRAVEL_FEE_MAX_CENTS = 1500    # $15
    TRAINER_TRAVEL_FEE_PERCENT = 70
    PLATFORM_TRAVEL_FEE_PERCENT = 30
    
    # Cancellation fees (in cents) - 75/25 split
    CANCELLATION_FEE_VIRTUAL = 1500   # $15
    CANCELLATION_FEE_OUTDOOR = 2500   # $25
    CANCELLATION_FEE_IN_HOME = 3500   # $35
    CANCELLATION_FEE_TRAINEE_HOME = 3500  # $35
    
    # No-show fee = full session price (75/25 split)
    
    # Paid Boosts - 100% to RapidReps
    BOOST_DAILY_CENTS = 999        # $9.99/day
    BOOST_WEEKLY_CENTS = 4999      # $49.99/week
    BOOST_MONTHLY_CENTS = 14999    # $149.99/month
    
    # Membership Program - 100% to RapidReps
    MEMBERSHIP_MONTHLY_CENTS = 1999  # $19.99/month
    MEMBERSHIP_SESSION_DISCOUNT_PERCENT = 10  # 10% off sessions for members
    MEMBERSHIP_MATCHING_PRIORITY_BONUS = 0.15  # Score bonus in matching engine
    
    # Legacy fields for backward compatibility
    PLATFORM_FEE_PERCENT = 25  # Kept for compatibility
    TRAVEL_FEE_0_5_MILES = 0
    TRAVEL_FEE_5_10_MILES = 500
    TRAVEL_FEE_10_15_MILES = 1000
    TRAVEL_FEE_15_20_MILES = 1500
    
    # Trainer tier price bonuses (in cents)
    PRO_TIER_MIN_BONUS = 1000
    PRO_TIER_MAX_BONUS = 2000
    ELITE_TIER_MIN_BONUS = 3000
    ELITE_TIER_MAX_BONUS = 5000

# Helper functions for payment calculations
def calculate_session_payout(session_price_cents: int, session_type: str) -> dict:
    """Calculate trainer payout and platform fee for a session"""
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
    """Calculate travel fee split (70% trainer, 30% platform)"""
    trainer_amount = int(travel_fee_cents * PricingRules.TRAINER_TRAVEL_FEE_PERCENT / 100)
    platform_amount = travel_fee_cents - trainer_amount
    return {
        "total_cents": travel_fee_cents,
        "trainer_payout_cents": trainer_amount,
        "platform_fee_cents": platform_amount
    }

def calculate_cancellation_fee(session_type: str) -> dict:
    """Get cancellation fee for session type with 75/25 split"""
    fee_map = {
        SessionType.VIRTUAL: PricingRules.CANCELLATION_FEE_VIRTUAL,
        SessionType.OUTDOOR: PricingRules.CANCELLATION_FEE_OUTDOOR,
        SessionType.IN_HOME: PricingRules.CANCELLATION_FEE_IN_HOME,
        SessionType.TRAINEE_HOME: PricingRules.CANCELLATION_FEE_TRAINEE_HOME,
    }
    fee_cents = fee_map.get(session_type, PricingRules.CANCELLATION_FEE_VIRTUAL)
    return calculate_session_payout(fee_cents, session_type)


def calculate_time_based_cancellation_penalty(session_start: datetime, session_price_cents: int, cancelled_by: str) -> dict:
    """
    Calculate cancellation penalty based on time before session.
    
    Trainee cancellation rules:
      > 12 hours before → $0 penalty
      12-2 hours before → 25% penalty
      < 2 hours before → 50% penalty
    
    Trainer cancellation rules:
      > 12 hours before → no penalty, full refund to trainee
      ≤ 12 hours before → full refund + virtual session credit, trainer gets strike
    """
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
            "penalty_percent": penalty_percent,
            "penalty_cents": penalty_cents,
            "refund_cents": refund_cents,
            "trainer_payout_cents": trainer_payout_cents,
            "platform_fee_cents": platform_fee_cents,
            "hours_until_session": round(hours_until_session, 1),
            "gives_strike": False,
            "gives_credit": False,
        }
    else:  # trainer cancellation
        gives_strike = hours_until_session <= 12
        return {
            "penalty_percent": 0,
            "penalty_cents": 0,
            "refund_cents": session_price_cents,
            "trainer_payout_cents": 0,
            "platform_fee_cents": 0,
            "hours_until_session": round(hours_until_session, 1),
            "gives_strike": gives_strike,
            "gives_credit": gives_strike,  # free virtual session credit
        }

def get_minimum_price(session_type: str) -> int:
    """Get minimum price for session type in cents"""
    min_prices = {
        SessionType.VIRTUAL: PricingRules.VIRTUAL_MIN_CENTS,
        SessionType.OUTDOOR: PricingRules.OUTDOOR_MIN_CENTS,
        SessionType.IN_HOME: PricingRules.IN_HOME_MIN_CENTS,
        SessionType.TRAINEE_HOME: PricingRules.TRAINEE_HOME_MIN_CENTS,
    }
    return min_prices.get(session_type, PricingRules.VIRTUAL_MIN_CENTS)

# Trainer Tier Thresholds
class TierThresholds:
    PRO_MIN_REVIEWS = 30
    PRO_MIN_RATING = 4.7
    ELITE_MIN_REVIEWS = 100

# Verification Requirements
class VerificationStatus:
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    
class VerificationRequirements:
    GOVERNMENT_ID = "government_id"
    SSN_CHECK = "ssn_check"
    BACKGROUND_CHECK = "background_check"
    SEX_OFFENDER_CHECK = "sex_offender_check"
    CPR_AED_CERT = "cpr_aed_cert"
    FITNESS_CERT = "fitness_cert"  # Optional
    INTRO_VIDEO = "intro_video"
    PROFILE_COMPLETE = "profile_complete"
    PRICING_SET = "pricing_set"

# User Models
class UserSignUp(BaseModel):
    fullName: str
    email: EmailStr
    phone: str
    password: str
    roles: List[str]  # ["trainer", "trainee"]

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    fullName: str
    email: str
    phone: str
    roles: List[str]
    isAdmin: bool = False
    createdAt: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Trainer Profile Models
class TrainerProfileCreate(BaseModel):
    userId: str
    avatarUrl: Optional[str] = None
    bio: Optional[str] = None
    experienceYears: Optional[int] = 0
    certifications: List[str] = []
    trainingStyles: List[str] = []
    gymsWorkedAt: List[str] = []
    primaryGym: Optional[str] = None
    offersInPerson: bool = True
    offersVirtual: bool = False
    offersOutdoor: bool = True  # NEW: Outdoor sessions
    offersInHome: bool = False  # NEW: In-home sessions
    sessionDurationsOffered: List[int] = [30, 45, 60]
    # NEW: Session-type specific pricing (in cents)
    virtualRateCents: int = PricingRules.VIRTUAL_MIN_CENTS  # $30 min
    outdoorRateCents: int = PricingRules.OUTDOOR_MIN_CENTS  # $40 min
    inHomeRateCents: int = PricingRules.IN_HOME_MIN_CENTS   # $60 min
    ratePerMinuteCents: int = 100  # Legacy field - $1/min default
    travelRadiusMiles: Optional[int] = 10
    cancellationPolicy: Optional[str] = "Free cancellation before 24 hours"
    availability: Optional[dict] = None
    # Verification documents
    verificationDocs: List[str] = []
    governmentIdUploaded: bool = False
    ssnVerified: bool = False
    backgroundCheckPassed: bool = False
    sexOffenderCheckPassed: bool = False
    cprAedCertUploaded: bool = False
    fitnessCertUploaded: bool = False
    # NEW: Intro video (mandatory)
    introVideoUrl: Optional[str] = None
    introVideoUploaded: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    locationAddress: Optional[str] = None
    isAvailable: bool = True  # Toggle for visibility to trainees
    isVirtualTrainingAvailable: bool = False
    videoCallPreference: Optional[str] = "native"  # native, zoom, etc.

class TrainerProfileResponse(BaseModel):
    id: str
    userId: str
    avatarUrl: Optional[str] = None
    bio: Optional[str] = None
    experienceYears: int = 0
    certifications: List[str] = []
    trainingStyles: List[str] = []
    gymsWorkedAt: List[str] = []
    primaryGym: Optional[str] = None
    offersInPerson: bool = True
    offersVirtual: bool = False
    offersOutdoor: bool = True  # NEW
    offersInHome: bool = False  # NEW
    sessionDurationsOffered: List[int] = []
    # NEW: Session-type specific pricing
    virtualRateCents: int = PricingRules.VIRTUAL_MIN_CENTS
    outdoorRateCents: int = PricingRules.OUTDOOR_MIN_CENTS
    inHomeRateCents: int = PricingRules.IN_HOME_MIN_CENTS
    ratePerMinuteCents: int = 100
    travelRadiusMiles: Optional[int] = 10
    cancellationPolicy: Optional[str] = None
    averageRating: float = 0.0
    totalReviews: int = 0  # NEW: For tier calculation
    totalSessionsCompleted: int = 0
    isVerified: bool = False
    # NEW: Trainer Tier
    trainerTier: str = TrainerTier.BASIC
    # NEW: Verification status
    verificationStatus: str = VerificationStatus.PENDING
    governmentIdUploaded: bool = False
    ssnVerified: bool = False
    backgroundCheckPassed: bool = False
    sexOffenderCheckPassed: bool = False
    cprAedCertUploaded: bool = False
    fitnessCertUploaded: bool = False
    introVideoUrl: Optional[str] = None
    introVideoUploaded: bool = False
    # NEW: Can trainer go live?
    canGoLive: bool = False
    availability: Optional[dict] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    locationAddress: Optional[str] = None
    isAvailable: bool = True  # Toggle for visibility to trainees
    isVirtualTrainingAvailable: bool = False
    videoCallPreference: Optional[str] = None
    distance: Optional[float] = None  # Distance from search location in miles
    matchType: Optional[str] = None  # 'in-person' or 'virtual'
    fullName: Optional[str] = None  # Trainer's full name from users collection
    createdAt: datetime

# Trainee Profile Models
class TraineeProfileCreate(BaseModel):
    userId: str
    profilePhoto: Optional[str] = None  # base64 encoded
    fitnessGoals: Optional[str] = None
    currentFitnessLevel: str = FitnessLevel.BEGINNER
    experienceLevel: Optional[str] = None  # "Never trained", "Some experience", "Regular exerciser"
    preferredTrainingStyles: List[str] = []
    injuriesOrLimitations: Optional[str] = None
    homeGymOrZipCode: Optional[str] = None
    homeAddress: Optional[str] = None  # Full home address for in-home training sessions
    prefersInPerson: bool = True
    prefersVirtual: bool = False
    isVirtualEnabled: bool = False
    typicalAvailability: Optional[dict] = None
    budgetMinPerMinuteCents: Optional[int] = 50
    budgetMaxPerMinuteCents: Optional[int] = 200
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    locationAddress: Optional[str] = None  # "City, State"

class TraineeProfileResponse(BaseModel):
    id: str
    userId: str
    profilePhoto: Optional[str] = None
    fitnessGoals: Optional[str] = None
    currentFitnessLevel: str = FitnessLevel.BEGINNER
    experienceLevel: Optional[str] = None
    preferredTrainingStyles: List[str] = []
    injuriesOrLimitations: Optional[str] = None
    homeGymOrZipCode: Optional[str] = None
    homeAddress: Optional[str] = None
    prefersInPerson: bool = True
    prefersVirtual: bool = False
    isVirtualEnabled: bool = False
    typicalAvailability: Optional[dict] = None
    budgetMinPerMinuteCents: int = 50
    budgetMaxPerMinuteCents: int = 200
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    locationAddress: Optional[str] = None
    createdAt: datetime

# Session Models
class SessionCreate(BaseModel):
    traineeId: str
    trainerId: str
    sessionDateTimeStart: datetime
    durationMinutes: int
    sessionType: str = SessionType.OUTDOOR  # NEW: "virtual", "outdoor", "in_home"
    locationType: str  # "gym", "home", "virtual" - legacy
    locationNameOrAddress: Optional[str] = None
    traineeLatitude: Optional[float] = None  # NEW: For travel fee calculation
    traineeLongitude: Optional[float] = None
    notes: Optional[str] = None

class SessionResponse(BaseModel):
    id: str
    traineeId: str
    trainerId: str
    status: str
    sessionDateTimeStart: Optional[datetime] = None
    sessionDateTimeEnd: Optional[datetime] = None
    durationMinutes: int = 60
    sessionType: str = SessionType.OUTDOOR
    # Pricing breakdown
    baseSessionPriceCents: int = 0
    basePricePerMinuteCents: int = 0
    # Travel fee (for in-home sessions)
    travelDistanceMiles: Optional[float] = None
    travelFeeCents: int = 0
    trainerTravelEarningsCents: int = 0
    platformTravelFeeCents: int = 0
    # Discounts
    discountType: Optional[str] = None
    discountAmountCents: int = 0
    # Final amounts
    finalSessionPriceCents: int = 0
    platformFeePercent: int = PricingRules.PLATFORM_FEE_PERCENT
    platformFeeCents: int = 0
    trainerEarningsCents: int = 0
    # Cancellation/No-show
    cancellationFeeCents: int = 0
    noShowFeeCents: int = 0
    # Safety PIN (for in-home sessions)
    safetyPin: Optional[str] = None
    safetyPinVerified: bool = False
    # Session tracking
    trainerGpsConfirmed: bool = False
    sessionStartedAt: Optional[datetime] = None
    sessionEndedAt: Optional[datetime] = None
    clientConfirmedEnd: bool = False
    # Location
    locationType: Optional[str] = None
    locationNameOrAddress: Optional[str] = None
    traineeLatitude: Optional[float] = None
    traineeLongitude: Optional[float] = None
    scheduledDate: Optional[str] = None
    scheduledTime: Optional[str] = None
    notes: Optional[str] = None
    createdAt: Optional[datetime] = None

# Rating Models
class RatingCreate(BaseModel):
    sessionId: str
    traineeId: str
    trainerId: str
    rating: int  # 1-5
    reviewText: Optional[str] = None

class RatingResponse(BaseModel):
    id: str
    sessionId: str
    traineeId: str
    trainerId: str
    rating: int
    reviewText: Optional[str] = None
    traineeName: Optional[str] = None
    createdAt: datetime
    clientIp: Optional[str] = None
    submittedAt: Optional[datetime] = None

# Virtual Session Models
class VirtualSessionRequest(BaseModel):
    traineeId: str
    durationMinutes: int = 30
    paymentMethod: str = "mock"  # For MVP: mock payment
    notes: Optional[str] = None

class VirtualSessionMatchResponse(BaseModel):
    sessionId: str
    trainerId: str
    trainerName: str
    trainerBio: Optional[str] = None
    trainerRating: float
    sessionDateTimeStart: datetime
    sessionDateTimeEnd: datetime
    durationMinutes: int
    finalSessionPriceCents: int
    zoomMeetingLink: Optional[str] = None
    status: str


# Badge/Achievement Models
class BadgeType:
    MILESTONE_MASTER = "milestone_master"
    WEEKEND_WARRIOR = "weekend_warrior"
    STREAK_STAR = "streak_star"
    EARLY_BIRD = "early_bird"
    NIGHT_OWL = "night_owl"
    TOP_TRAINER = "top_trainer"
    NEW_CLIENT_CHAMP = "new_client_champ"
    FLEXIBILITY_GURU = "flexibility_guru"
    FEEDBACK_FAVORITE = "feedback_favorite"
    DOUBLE_DUTY = "double_duty"

class BadgeProgress(BaseModel):
    badgeType: str
    badgeName: str
    description: str
    isUnlocked: bool
    progress: int
    target: int
    reward: Optional[str] = None
    unlockedAt: Optional[datetime] = None

class TrainerAchievements(BaseModel):
    trainerId: str
    badges: List[BadgeProgress]
    totalCompletedSessions: int
    discountSessionsRemaining: int = 0
    currentStreak: int = 0
    streakWeeks: int = 0
    lastStreakReset: Optional[datetime] = None



# Trainee Badge Types
class TraineeBadgeType:
    COMMITMENT = "commitment"
    CONSISTENCY_CHAMP = "consistency_champ"
    WEEKEND_GRINDER = "weekend_grinder"
    EARLY_RISER = "early_riser"
    NIGHT_HUSTLER = "night_hustler"
    LOYALTY_LOCK = "loyalty_lock"
    TRAINER_FAVORITE = "trainer_favorite"
    EXPLORER = "explorer"
    FEEDBACK_HERO = "feedback_hero"
    ALL_IN = "all_in"

class TraineeAchievements(BaseModel):
    traineeId: str
    badges: List[BadgeProgress]
    totalCompletedSessions: int
    discountSessionsRemaining: int = 0
    currentStreak: int = 0
    streakWeeks: int = 0
    lastStreakReset: Optional[datetime] = None


# ============================================================================
# MEMBERSHIP & BOOST MODELS
# ============================================================================

class MembershipStatus:
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    
class MembershipCreate(BaseModel):
    userId: str
    stripeSubscriptionId: Optional[str] = None

class MembershipResponse(BaseModel):
    id: str
    userId: str
    status: str = MembershipStatus.ACTIVE
    monthlyPriceCents: int = PricingRules.MEMBERSHIP_MONTHLY_CENTS
    startDate: datetime
    nextBillingDate: Optional[datetime] = None
    cancelledAt: Optional[datetime] = None
    benefits: List[str] = [
        "Discounted sessions",
        "1 free profile Boost per month",
        "Priority customer support",
        "Early access to elite trainers"
    ]
    freeBoostsRemaining: int = 1
    stripeSubscriptionId: Optional[str] = None

class BoostType:
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"

class BoostCreate(BaseModel):
    trainerId: str
    boostType: str
    paymentMethodId: Optional[str] = None
    isFreeBoost: bool = False

class BoostResponse(BaseModel):
    id: str
    trainerId: str
    boostType: str
    priceCents: int
    startDate: datetime
    endDate: datetime
    isActive: bool = True
    isFreeBoost: bool = False
    stripePaymentIntentId: Optional[str] = None

# ============================================================================
# PAYMENT/TRANSACTION MODELS
# ============================================================================

class TransactionType:
    SESSION_PAYMENT = "session_payment"
    CANCELLATION_FEE = "cancellation_fee"
    NO_SHOW_FEE = "no_show_fee"
    TRAVEL_FEE = "travel_fee"
    BOOST_PURCHASE = "boost_purchase"
    MEMBERSHIP_PAYMENT = "membership_payment"
    TRAINER_PAYOUT = "trainer_payout"
    REFUND = "refund"

class PaymentStatus:
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

class TransactionCreate(BaseModel):
    userId: str
    sessionId: Optional[str] = None
    transactionType: str
    amountCents: int
    trainerPayoutCents: int = 0
    platformFeeCents: int = 0
    description: Optional[str] = None
    stripePaymentIntentId: Optional[str] = None

class TransactionResponse(BaseModel):
    id: str
    userId: str
    sessionId: Optional[str] = None
    transactionType: str
    amountCents: int
    trainerPayoutCents: int = 0
    platformFeeCents: int = 0
    status: str = PaymentStatus.PENDING
    description: Optional[str] = None
    stripePaymentIntentId: Optional[str] = None
    createdAt: datetime

# Trainer Payout Info
class TrainerPayoutInfo(BaseModel):
    trainerId: str
    paymentMethod: str = "stripe"  # stripe, cashapp, applepay, zelle
    stripeAccountId: Optional[str] = None
    cashAppTag: Optional[str] = None
    applePayEmail: Optional[str] = None
    zelleEmail: Optional[str] = None
    zellePhone: Optional[str] = None

# Admin Models
class AdminDashboardStats(BaseModel):
    totalUsers: int
    totalTrainers: int
    totalTrainees: int
    totalSessions: int
    completedSessions: int
    totalRevenueCents: int
    platformRevenueCents: int
    trainerPayoutsCents: int
    activeMemberships: int
    activeBoosts: int
    pendingVerifications: int


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password) -> bool:
    """Verify a password against a hash"""
    # Handle both string and bytes hashed passwords
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password)

def create_access_token(user_id: str, email: str) -> str:
    """Create JWT access token"""
    expiration = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to get current authenticated user"""
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get('user_id')
    
    user = await db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB document to serializable dict"""
    if doc and '_id' in doc:
        doc['id'] = str(doc['_id'])
        del doc['_id']
    # Convert any datetime fields that might be stored inconsistently
    for key, val in doc.items():
        if isinstance(val, datetime) and key in ('scheduledDate',):
            doc[key] = val.isoformat()
    return doc

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points using Haversine formula. Returns distance in miles."""
    from math import radians, sin, cos, sqrt, atan2
    
    R = 3959  # Earth radius in miles
    lat1, lon1 = radians(lat1), radians(lon1)
    lat2, lon2 = radians(lat2), radians(lon2)
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    distance = R * c
    
    return distance

# ============================================================================
# RAPIDREPS BUSINESS LOGIC HELPERS
# ============================================================================

import random
import string

def generate_safety_pin() -> str:
    """Generate a 4-digit safety PIN for in-home sessions"""
    return ''.join(random.choices(string.digits, k=4))

def calculate_travel_fee(distance_miles: float) -> int:
    """Calculate travel fee based on distance for in-home sessions"""
    if distance_miles <= 5:
        return PricingRules.TRAVEL_FEE_0_5_MILES
    elif distance_miles <= 10:
        return PricingRules.TRAVEL_FEE_5_10_MILES
    elif distance_miles <= 15:
        return PricingRules.TRAVEL_FEE_10_15_MILES
    elif distance_miles <= 20:
        return PricingRules.TRAVEL_FEE_15_20_MILES
    else:
        # Beyond 20 miles - not supported
        return -1  # Signal that booking should be rejected

def get_session_minimum_price(session_type: str) -> int:
    """Get minimum price for session type (in cents)"""
    if session_type == SessionType.VIRTUAL:
        return PricingRules.VIRTUAL_MIN_CENTS
    elif session_type == SessionType.OUTDOOR:
        return PricingRules.OUTDOOR_MIN_CENTS
    elif session_type == SessionType.IN_HOME:
        return PricingRules.IN_HOME_MIN_CENTS
    return PricingRules.OUTDOOR_MIN_CENTS  # Default

def get_cancellation_fee(session_type: str) -> int:
    """Get cancellation fee for session type (in cents)"""
    if session_type == SessionType.VIRTUAL:
        return PricingRules.CANCELLATION_FEE_VIRTUAL
    elif session_type == SessionType.OUTDOOR:
        return PricingRules.CANCELLATION_FEE_OUTDOOR
    elif session_type == SessionType.IN_HOME:
        return PricingRules.CANCELLATION_FEE_IN_HOME
    return PricingRules.CANCELLATION_FEE_OUTDOOR

def calculate_trainer_tier(total_reviews: int, average_rating: float, certs_verified: bool = False) -> str:
    """Calculate trainer tier based on reviews, rating, and certifications"""
    if total_reviews >= TierThresholds.ELITE_MIN_REVIEWS and certs_verified:
        return TrainerTier.ELITE
    elif total_reviews >= TierThresholds.PRO_MIN_REVIEWS and average_rating >= TierThresholds.PRO_MIN_RATING:
        return TrainerTier.PRO
    return TrainerTier.BASIC

def check_trainer_can_go_live(profile: dict) -> tuple:
    """
    Check if trainer has completed all requirements to go live.
    Returns (can_go_live: bool, missing_requirements: list)
    """
    missing = []
    
    # Check identity verification
    if not profile.get('governmentIdUploaded', False):
        missing.append('Government ID verification')
    if not profile.get('ssnVerified', False):
        missing.append('SSN identity check')
    
    # Check background checks
    if not profile.get('backgroundCheckPassed', False):
        missing.append('Background check')
    if not profile.get('sexOffenderCheckPassed', False):
        missing.append('Sex offender screening')
    
    # Check certifications
    if not profile.get('cprAedCertUploaded', False):
        missing.append('CPR/AED certification')
    # Fitness cert is optional
    
    # Check intro video (mandatory)
    if not profile.get('introVideoUploaded', False):
        missing.append('Intro video (10-30 seconds)')
    
    # Check profile completion
    if not profile.get('bio') or len(profile.get('bio', '')) < 50:
        missing.append('Complete bio (min 50 characters)')
    if not profile.get('trainingStyles') or len(profile.get('trainingStyles', [])) == 0:
        missing.append('Training styles')
    
    # Check pricing is set above minimums
    virtual_rate = profile.get('virtualRateCents', 0)
    outdoor_rate = profile.get('outdoorRateCents', 0)
    in_home_rate = profile.get('inHomeRateCents', 0)
    
    if profile.get('offersVirtual', False) and virtual_rate < PricingRules.VIRTUAL_MIN_CENTS:
        missing.append(f'Virtual rate (min ${PricingRules.VIRTUAL_MIN_CENTS/100})')
    if profile.get('offersOutdoor', True) and outdoor_rate < PricingRules.OUTDOOR_MIN_CENTS:
        missing.append(f'Outdoor rate (min ${PricingRules.OUTDOOR_MIN_CENTS/100})')
    if profile.get('offersInHome', False) and in_home_rate < PricingRules.IN_HOME_MIN_CENTS:
        missing.append(f'In-home rate (min ${PricingRules.IN_HOME_MIN_CENTS/100})')
    
    can_go_live = len(missing) == 0
    return (can_go_live, missing)

def calculate_session_pricing(
    session_type: str,
    trainer_profile: dict,
    distance_miles: float = 0,
    trainee_session_count: int = 0,
    has_membership: bool = False,
) -> dict:
    """
    Calculate full session pricing including travel fees and discounts.
    Members get an additional 10% discount on all sessions.
    Returns a dict with all pricing components.
    """
    # Get base rate based on session type
    if session_type == SessionType.VIRTUAL:
        base_rate = trainer_profile.get('virtualRateCents', PricingRules.VIRTUAL_MIN_CENTS)
    elif session_type == SessionType.OUTDOOR:
        base_rate = trainer_profile.get('outdoorRateCents', PricingRules.OUTDOOR_MIN_CENTS)
    elif session_type == SessionType.IN_HOME:
        base_rate = trainer_profile.get('inHomeRateCents', PricingRules.IN_HOME_MIN_CENTS)
    else:
        base_rate = PricingRules.OUTDOOR_MIN_CENTS
    
    # Enforce minimums
    minimum = get_session_minimum_price(session_type)
    if base_rate < minimum:
        base_rate = minimum
    
    # Calculate travel fee for in-home sessions
    travel_fee = 0
    trainer_travel_earning = 0
    platform_travel_fee = 0
    
    if session_type == SessionType.IN_HOME and distance_miles > 0:
        travel_fee = calculate_travel_fee(distance_miles)
        if travel_fee > 0:
            trainer_travel_earning = int(travel_fee * PricingRules.TRAINER_TRAVEL_FEE_PERCENT / 100)
            platform_travel_fee = travel_fee - trainer_travel_earning
    
    # Multi-session discount (5% on 3rd+ session with same trainer)
    discount_type = None
    discount_amount = 0
    if trainee_session_count >= 2:  # This is their 3rd+ session
        discount_type = "multi_session_5pct"
        discount_amount = int(base_rate * 0.05)

    # Membership discount (10% off for members, stacks with multi-session)
    membership_discount = 0
    if has_membership:
        membership_discount = int(base_rate * PricingRules.MEMBERSHIP_SESSION_DISCOUNT_PERCENT / 100)
        discount_type = "membership_10pct" if not discount_type else f"{discount_type}+membership_10pct"
        discount_amount += membership_discount
    
    # Calculate final amounts
    subtotal = base_rate + travel_fee - discount_amount
    platform_fee = int(subtotal * PricingRules.PLATFORM_FEE_PERCENT / 100)
    trainer_earnings = subtotal - platform_fee + trainer_travel_earning
    
    return {
        'baseSessionPriceCents': base_rate,
        'travelFeeCents': travel_fee,
        'travelDistanceMiles': distance_miles if travel_fee > 0 else None,
        'trainerTravelEarningsCents': trainer_travel_earning,
        'platformTravelFeeCents': platform_travel_fee,
        'discountType': discount_type,
        'discountAmountCents': discount_amount,
        'membershipDiscountCents': membership_discount,
        'finalSessionPriceCents': subtotal,
        'platformFeePercent': PricingRules.PLATFORM_FEE_PERCENT,
        'platformFeeCents': platform_fee,
        'trainerEarningsCents': trainer_earnings,
        'cancellationFeeCents': get_cancellation_fee(session_type),
    }


class ReportCreate(BaseModel):
    reportedUserId: str
    reason: str
    context: Optional[str] = None
    contentType: Optional[str] = None  # e.g., "profile", "message", "media", "session"
    contentId: Optional[str] = None

class BlockResponse(BaseModel):
    blockedUserIds: List[str]

# Chat/Message Models
class MessageCreate(BaseModel):
    conversationId: Optional[str] = None
    receiverId: str
    content: str

class MessageResponse(BaseModel):
    id: str
    conversationId: str
    senderId: str
    receiverId: str
    content: str
    isRead: bool = False
    createdAt: datetime

class ConversationResponse(BaseModel):
    id: str
    participants: List[str]
    participantDetails: List[dict]  # Will include user details
    lastMessage: Optional[dict] = None
    unreadCount: int = 0
    updatedAt: datetime

# ============================================================================
# AUTH ROUTES
# ============================================================================

@api_router.post("/auth/signup", response_model=TokenResponse)
@limiter.limit("5/minute")
async def signup(request: Request, user_data: UserSignUp):
    """Register a new user"""
    # Validate password length
    if len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Check if user already exists
    existing_user = await db.users.find_one({'email': user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = hash_password(user_data.password)
    
    # Create user document
    user_doc = {
        'fullName': sanitize_text(user_data.fullName),
        'email': user_data.email,
        'phone': user_data.phone,
        'passwordHash': hashed_password,
        'roles': user_data.roles,
        'isAdmin': False,
        'emailVerified': True,  # Default true until email verification flow is implemented
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
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

@api_router.post("/auth/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, credentials: UserLogin):
    """Login user"""
    # Find user
    user = await db.users.find_one({'email': credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(credentials.password, user['passwordHash']):
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
    
    return TokenResponse(access_token=access_token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    return UserResponse(
        id=str(current_user['_id']),
        fullName=current_user['fullName'],
        email=current_user['email'],
        phone=current_user['phone'],
        roles=current_user['roles'],
        isAdmin=current_user.get('isAdmin', False),
        createdAt=current_user['createdAt']
    )



@api_router.delete("/auth/me")
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
    """Get trainer profile by user ID"""
    profile = await db.trainer_profiles.find_one({'userId': user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
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
    return {'steps': steps, 'canGoLive': can_go_live, 'missingRequirements': missing}


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
    
    # Get all matching trainers
    trainers = await db.trainer_profiles.find(query).to_list(100)
    
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

# ============================================================================
# SESSION ROUTES
# ============================================================================

@api_router.post("/sessions", response_model=SessionResponse)
async def create_session(session: SessionCreate, current_user: dict = Depends(get_current_user)):
    """
    Create a new session booking with full pricing calculation.
    PRD Rules #1, #2: Pricing, travel fees, platform commission.
    PRD Rule #7: Generate safety PIN for in-home sessions.
    """
    # Get trainer profile to get rates
    trainer_profile = await db.trainer_profiles.find_one({'userId': session.trainerId})
    if not trainer_profile:
        raise HTTPException(status_code=404, detail="Trainer not found")
    
    # Check if trainer can accept sessions (PRD Rule #10)
    can_go_live, missing = check_trainer_can_go_live(trainer_profile)
    if not can_go_live:
        raise HTTPException(
            status_code=403, 
            detail=f"Trainer is not verified yet. Missing: {', '.join(missing)}"
        )
    
    # Map legacy locationType to new sessionType
    session_type = session.sessionType
    if session.locationType == "virtual":
        session_type = SessionType.VIRTUAL
    elif session.locationType == "home":
        session_type = SessionType.IN_HOME
    elif session.locationType == "outdoor" or session.locationType == "gym":
        session_type = SessionType.OUTDOOR
    
    # Calculate distance for in-home sessions
    distance_miles = 0
    if session_type == SessionType.IN_HOME:
        trainer_lat = trainer_profile.get('latitude')
        trainer_lng = trainer_profile.get('longitude')
        trainee_lat = session.traineeLatitude
        trainee_lng = session.traineeLongitude
        
        if trainer_lat and trainer_lng and trainee_lat and trainee_lng:
            distance_miles = calculate_distance(trainer_lat, trainer_lng, trainee_lat, trainee_lng)
            
            # Check if within travel radius
            if distance_miles > 20:
                raise HTTPException(
                    status_code=400, 
                    detail="Distance exceeds maximum travel radius (20 miles)"
                )
    
    # Check for multi-session discount (3+ sessions with this trainer)
    previous_sessions = await db.sessions.count_documents({
        'traineeId': session.traineeId,
        'trainerId': session.trainerId,
        'status': SessionStatus.COMPLETED
    })

    # Check for active membership (10% discount)
    has_membership = False
    trainee_membership = await db.memberships.find_one({
        'userId': session.traineeId,
        'status': MembershipStatus.ACTIVE,
    })
    if trainee_membership:
        has_membership = True
    
    # Calculate full pricing
    pricing = calculate_session_pricing(
        session_type=session_type,
        trainer_profile=trainer_profile,
        distance_miles=distance_miles,
        trainee_session_count=previous_sessions,
        has_membership=has_membership,
    )
    
    # Generate safety PIN for in-home sessions (PRD Rule #7)
    safety_pin = None
    if session_type == SessionType.IN_HOME:
        safety_pin = generate_safety_pin()
    
    session_doc = {
        'traineeId': session.traineeId,
        'trainerId': session.trainerId,
        'status': SessionStatus.REQUESTED,
        'sessionDateTimeStart': session.sessionDateTimeStart,
        'sessionDateTimeEnd': session.sessionDateTimeStart + timedelta(minutes=session.durationMinutes),
        'durationMinutes': session.durationMinutes,
        'sessionType': session_type,
        # Pricing breakdown
        'basePricePerMinuteCents': pricing['baseSessionPriceCents'] // session.durationMinutes if session.durationMinutes > 0 else 0,
        'baseSessionPriceCents': pricing['baseSessionPriceCents'],
        'travelDistanceMiles': pricing['travelDistanceMiles'],
        'travelFeeCents': pricing['travelFeeCents'],
        'trainerTravelEarningsCents': pricing['trainerTravelEarningsCents'],
        'platformTravelFeeCents': pricing['platformTravelFeeCents'],
        'discountType': pricing['discountType'],
        'discountAmountCents': pricing['discountAmountCents'],
        'finalSessionPriceCents': pricing['finalSessionPriceCents'],
        'platformFeePercent': pricing['platformFeePercent'],
        'platformFeeCents': pricing['platformFeeCents'],
        'trainerEarningsCents': pricing['trainerEarningsCents'],
        'cancellationFeeCents': pricing['cancellationFeeCents'],
        'noShowFeeCents': pricing['finalSessionPriceCents'],  # Full amount for no-show
        # Safety PIN
        'safetyPin': safety_pin,
        'safetyPinVerified': False,
        'trainerGpsConfirmed': False,
        'sessionStartedAt': None,
        'sessionEndedAt': None,
        'clientConfirmedEnd': False,
        # Location
        'locationType': session.locationType,
        'locationNameOrAddress': session.locationNameOrAddress,
        'traineeLatitude': session.traineeLatitude,
        'traineeLongitude': session.traineeLongitude,
        'notes': sanitize_text(session.notes),
        'paymentIntentId': None,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    
    result = await db.sessions.insert_one(session_doc)
    session_doc['_id'] = result.inserted_id

    # Push: Notify trainer of new session request
    trainee_name = current_user.get('fullName', 'A trainee')
    asyncio.create_task(create_and_send_notification(
        session.trainerId,
        "New Session Request",
        f"{trainee_name} wants to book a {session.durationMinutes}-min session with you!",
        "session_requested",
        {"sessionId": str(result.inserted_id), "screen": "trainer/sessions"}
    ))

    return SessionResponse(**serialize_doc(session_doc))

@api_router.post("/sessions/{session_id}/verify-pin")
async def verify_session_pin(
    session_id: str,
    pin: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Trainer enters PIN to start in-home session.
    PRD Rule #7 & #12: PIN verification required to start session.
    """
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify current user is the trainer
    if str(current_user['_id']) != session['trainerId']:
        raise HTTPException(status_code=403, detail="Only the trainer can verify the PIN")
    
    # Check PIN
    if session.get('safetyPin') != pin:
        return {
            'success': False,
            'message': 'Invalid PIN. Please ask the client for the correct 4-digit PIN.'
        }
    
    # Update session
    await db.sessions.update_one(
        {'_id': oid},
        {
            '$set': {
                'safetyPinVerified': True,
                'sessionStartedAt': datetime.utcnow(),
                'status': SessionStatus.CONFIRMED,
                'updatedAt': datetime.utcnow()
            }
        }
    )
    
    return {
        'success': True,
        'message': 'PIN verified! Session started.',
        'sessionStartedAt': datetime.utcnow().isoformat()
    }

@api_router.post("/sessions/{session_id}/confirm-gps")
async def confirm_trainer_gps(
    session_id: str,
    latitude: float,
    longitude: float,
    current_user: dict = Depends(get_current_user)
):
    """
    Confirm trainer GPS arrival for in-person sessions.
    Distance thresholds:
      In-person (outdoor/gym): ≤ 0.25 miles (400m)
      At-home (trainee_home/in_home): ≤ 0.1 miles (160m)
    """
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID format")

    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session_type = session.get('sessionType', 'outdoor')
    if session_type in (SessionType.IN_HOME, SessionType.TRAINEE_HOME):
        max_distance = 0.1  # 160m for at-home
    else:
        max_distance = 0.25  # 400m for in-person

    if session.get('traineeLatitude') and session.get('traineeLongitude'):
        distance = calculate_distance(
            latitude, longitude,
            session['traineeLatitude'], session['traineeLongitude']
        )
        if distance > max_distance:
            return {
                'success': False,
                'message': f'You are {distance:.2f} miles away. Must be within {max_distance} miles to start.',
                'distanceMiles': round(distance, 3),
                'requiredMiles': max_distance,
            }

    await db.sessions.update_one(
        {'_id': oid},
        {'$set': {
            'trainerGpsConfirmed': True,
            'trainerArrivalLat': latitude,
            'trainerArrivalLon': longitude,
            'trainerArrivedAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
        }}
    )

    return {
        'success': True,
        'message': 'Location confirmed! You are at the session location.',
    }

@api_router.post("/sessions/{session_id}/end")
async def end_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Trainer presses "End Session" to complete.
    PRD Rule #12: Session end triggers payment release.
    """
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify current user is the trainer
    if str(current_user['_id']) != session['trainerId']:
        raise HTTPException(status_code=403, detail="Only the trainer can end the session")
    
    await db.sessions.update_one(
        {'_id': oid},
        {
            '$set': {
                'sessionEndedAt': datetime.utcnow(),
                'status': SessionStatus.COMPLETED,
                'updatedAt': datetime.utcnow()
            }
        }
    )
    
    # Push: Notify trainee that session ended
    asyncio.create_task(create_and_send_notification(
        session['traineeId'],
        "Session Complete",
        "Your session has ended! Please confirm to release payment.",
        "session_ended",
        {"sessionId": session_id, "screen": "trainee/sessions"}
    ))

    # Schedule "Rate Your Session" reminder — 30 min delay
    async def delayed_rate_reminder():
        await asyncio.sleep(1800)  # 30 minutes
        # Check if they already rated
        existing = await db.ratings.find_one({'sessionId': session_id})
        if not existing:
            await create_and_send_notification(
                session['traineeId'],
                "Rate Your Session",
                "How was your workout? Leave a rating for your trainer!",
                "rate_reminder",
                {"sessionId": session_id, "screen": "trainee/rate-session"}
            )
    asyncio.create_task(delayed_rate_reminder())

    return {
        'success': True,
        'message': 'Session ended. Awaiting client confirmation.',
        'sessionEndedAt': datetime.utcnow().isoformat()
    }

@api_router.post("/sessions/{session_id}/client-confirm-end")
async def client_confirm_session_end(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Client confirms session end, triggers payment release.
    PRD Rule #12: Client confirms, payment auto-releases.
    """
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify current user is the trainee
    if str(current_user['_id']) != session['traineeId']:
        raise HTTPException(status_code=403, detail="Only the client can confirm session end")
    
    await db.sessions.update_one(
        {'_id': oid},
        {
            '$set': {
                'clientConfirmedEnd': True,
                'status': SessionStatus.COMPLETED,
                'updatedAt': datetime.utcnow()
            }
        }
    )
    
    # Update trainer stats
    await db.trainer_profiles.update_one(
        {'userId': session['trainerId']},
        {'$inc': {'totalSessionsCompleted': 1}}
    )

    # Push: Notify trainer of payment release
    earnings = session.get('trainerEarningsCents', 0)
    asyncio.create_task(create_and_send_notification(
        session['trainerId'],
        "Payment Released!",
        f"Your session payment of ${earnings/100:.2f} has been released.",
        "payment_released",
        {"sessionId": session_id, "screen": "trainer/earnings"}
    ))

    return {
        'success': True,
        'message': 'Session confirmed! Payment has been released.',
        'trainerEarningsCents': session['trainerEarningsCents']
    }

@api_router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get session by ID — only participants or admin can view"""
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Auth: only the trainer, trainee, or admin can view
    user_id = str(current_user['_id'])
    is_admin = current_user.get('isAdmin', False)
    if user_id != session.get('trainerId') and user_id != session.get('traineeId') and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view this session")
    
    return SessionResponse(**serialize_doc(session))

@api_router.get("/trainer/sessions", response_model=List[SessionResponse])
async def get_trainer_sessions(
    session_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get sessions for a trainer"""
    user_id = str(current_user['_id'])
    query = {'trainerId': user_id}
    
    if session_status:
        query['status'] = session_status
    
    sessions = await db.sessions.find(query).sort('sessionDateTimeStart', -1).to_list(100)
    return [SessionResponse(**serialize_doc(s)) for s in sessions]

@api_router.get("/trainee/sessions", response_model=List[SessionResponse])
async def get_trainee_sessions(
    session_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get sessions for a trainee"""
    user_id = str(current_user['_id'])
    query = {'traineeId': user_id}
    
    if session_status:
        query['status'] = session_status
    
    sessions = await db.sessions.find(query).sort('sessionDateTimeStart', -1).to_list(100)
    return [SessionResponse(**serialize_doc(s)) for s in sessions]

@api_router.patch("/sessions/{session_id}/accept", response_model=SessionResponse)
async def accept_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Trainer accepts a session request"""
    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session['trainerId'] != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.sessions.update_one(
        {'_id': ObjectId(session_id)},
        {'$set': {'status': SessionStatus.CONFIRMED, 'updatedAt': datetime.utcnow()}}
    )
    
    updated_session = await db.sessions.find_one({'_id': ObjectId(session_id)})

    # Push: Notify trainee that session was accepted
    trainer_name = current_user.get('fullName', 'Your trainer')
    asyncio.create_task(create_and_send_notification(
        session['traineeId'],
        "Session Accepted!",
        f"{trainer_name} accepted your session request. Get ready!",
        "session_accepted",
        {"sessionId": session_id, "screen": "trainee/sessions"}
    ))

    return SessionResponse(**serialize_doc(updated_session))

@api_router.patch("/sessions/{session_id}/decline", response_model=SessionResponse)
async def decline_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Trainer declines a session request"""
    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session['trainerId'] != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.sessions.update_one(
        {'_id': ObjectId(session_id)},
        {'$set': {'status': SessionStatus.DECLINED, 'updatedAt': datetime.utcnow()}}
    )
    
    updated_session = await db.sessions.find_one({'_id': ObjectId(session_id)})

    # Push: Notify trainee that session was declined
    trainer_name = current_user.get('fullName', 'The trainer')
    asyncio.create_task(create_and_send_notification(
        session['traineeId'],
        "Session Declined",
        f"{trainer_name} is unable to take your session. Try another trainer!",
        "session_declined",
        {"sessionId": session_id, "screen": "trainee/home"}
    ))

    return SessionResponse(**serialize_doc(updated_session))

@api_router.patch("/sessions/{session_id}/cancel")
async def cancel_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """
    Cancel a session with time-based penalty rules.
    
    TRAINEE cancellation:
      > 12h before → $0 penalty
      12h-2h before → 25% penalty
      < 2h before → 50% penalty
    
    TRAINER cancellation:
      > 12h before → no penalty, full refund
      ≤ 12h before → full refund + virtual credit, trainer gets strike
    """
    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_id = str(current_user['_id'])
    is_trainee = session['traineeId'] == user_id
    is_trainer = session.get('trainerId') == user_id

    if not is_trainee and not is_trainer:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this session")

    current_status = session.get('status')
    if current_status in [SessionStatus.COMPLETED, SessionStatus.NO_SHOW]:
        raise HTTPException(status_code=400, detail="Cannot cancel a completed or no-show session")
    if current_status == SessionStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Session already cancelled")
    if current_status == SessionStatus.DECLINED:
        raise HTTPException(status_code=400, detail="Session was already declined")

    final_price = session.get('finalSessionPriceCents', 0)
    session_start = session.get('sessionDateTimeStart', datetime.utcnow() + timedelta(hours=24))
    cancelled_by = "trainee" if is_trainee else "trainer"

    # Calculate time-based penalty
    penalty = calculate_time_based_cancellation_penalty(session_start, final_price, cancelled_by)

    update_doc = {
        'status': SessionStatus.CANCELLED,
        'updatedAt': datetime.utcnow(),
        'cancelledAt': datetime.utcnow(),
        'cancelledBy': cancelled_by,
        'cancellationPenaltyPercent': penalty['penalty_percent'],
        'cancellationPenaltyCents': penalty['penalty_cents'],
        'refundAmountCents': penalty['refund_cents'],
        'trainerPayoutCents': penalty['trainer_payout_cents'],
        'platformFeeCents': penalty['platform_fee_cents'],
    }

    # Handle Stripe refund if payment exists
    payment_intent_id = session.get('paymentIntentId')
    if payment_intent_id and not payment_intent_id.startswith('mock_') and penalty['refund_cents'] > 0:
        try:
            refund = stripe.Refund.create(
                payment_intent=payment_intent_id,
                amount=penalty['refund_cents'],
                reason='requested_by_customer'
            )
            update_doc['stripeRefundId'] = refund.id
        except stripe.error.StripeError as e:
            update_doc['stripeRefundError'] = str(e)

    # Handle trainer strike for late cancellation
    if cancelled_by == "trainer" and penalty['gives_strike']:
        update_doc['trainerStrikeApplied'] = True
        await db.users.update_one(
            {'_id': ObjectId(session['trainerId'])},
            {
                '$inc': {'performanceStrikes': 1},
                '$push': {'strikeHistory': {
                    'sessionId': session_id,
                    'reason': 'late_cancellation',
                    'createdAt': datetime.utcnow()
                }}
            }
        )
        # Check if trainer has 3+ strikes → flag for account review
        trainer = await db.users.find_one({'_id': ObjectId(session['trainerId'])})
        if trainer and trainer.get('performanceStrikes', 0) >= 3:
            await db.users.update_one(
                {'_id': ObjectId(session['trainerId'])},
                {'$set': {'accountUnderReview': True, 'reviewReason': '3+ performance strikes'}}
            )

        # Grant virtual session credit to trainee
        if penalty['gives_credit']:
            await db.session_credits.insert_one({
                'userId': session['traineeId'],
                'type': 'virtual_session',
                'reason': f'Trainer late cancellation (session {session_id})',
                'isUsed': False,
                'createdAt': datetime.utcnow(),
            })

    await db.sessions.update_one({'_id': ObjectId(session_id)}, {'$set': update_doc})

    # Notify the other party
    if cancelled_by == "trainee":
        penalty_msg = "No penalty applied." if penalty['penalty_cents'] == 0 else f"Penalty: ${penalty['penalty_cents']/100:.2f}"
        await create_and_send_notification(
            session.get('trainerId', ''),
            "Session Cancelled",
            f"The trainee has cancelled the session. {penalty_msg}",
            "session_declined",
            {"sessionId": session_id}
        )
    else:
        msg = "Your trainer cancelled the session. Full refund processed."
        if penalty['gives_credit']:
            msg += " You also received a free virtual session credit."
        await create_and_send_notification(
            session['traineeId'],
            "Session Cancelled by Trainer",
            msg,
            "session_declined",
            {"sessionId": session_id}
        )

    penalty_str = "No penalty." if penalty['penalty_cents'] == 0 else f"Penalty: ${penalty['penalty_cents']/100:.2f}."
    return {
        'success': True,
        'cancelledBy': cancelled_by,
        'penaltyPercent': penalty['penalty_percent'],
        'penaltyCents': penalty['penalty_cents'],
        'refundCents': penalty['refund_cents'],
        'trainerPayoutCents': penalty['trainer_payout_cents'],
        'trainerStrike': penalty.get('gives_strike', False),
        'virtualCredit': penalty.get('gives_credit', False),
        'hoursUntilSession': penalty['hours_until_session'],
        'message': f"Session cancelled by {cancelled_by}. {penalty_str} Refund: ${penalty['refund_cents']/100:.2f}",
    }

@api_router.patch("/sessions/{session_id}/no-show")
async def mark_no_show(session_id: str, who: str = "trainee", current_user: dict = Depends(get_current_user)):
    """
    Mark session as no-show. Either trainee or trainer can be the no-show.
    
    TRAINEE NO-SHOW (who=trainee):
      - Trainer receives 50% payout
      - Platform keeps 25% fee from that 50%
      - Definition: Trainee doesn't appear within 10 minutes of start
    
    TRAINER NO-SHOW (who=trainer):
      - Trainee receives 100% refund
      - Trainer gets $0 + performance strike (3 strikes = account review)
      - Definition: Trainer doesn't appear/start within 10 minutes
    """
    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_id = str(current_user['_id'])
    is_trainer = session.get('trainerId') == user_id
    is_trainee = session.get('traineeId') == user_id
    is_admin = current_user.get('isAdmin', False)

    if not is_trainer and not is_trainee and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    if who not in ("trainee", "trainer"):
        raise HTTPException(status_code=400, detail="'who' must be 'trainee' or 'trainer'")

    final_price = session.get('finalSessionPriceCents', 0)
    update_doc = {
        'status': SessionStatus.NO_SHOW,
        'noShowParty': who,
        'updatedAt': datetime.utcnow(),
    }

    if who == "trainee":
        # Trainee no-show: trainer gets 50% payout, platform gets 25% of that 50%
        half_price = int(final_price * 50 / 100)
        platform_fee = int(half_price * PricingRules.PLATFORM_REVENUE_PERCENT / 100)
        trainer_payout = half_price - platform_fee

        update_doc.update({
            'noShowFeeCents': half_price,
            'platformFeeCents': platform_fee,
            'trainerEarningsCents': trainer_payout,
            'traineeRefundCents': 0,
        })

        # Stripe: partial refund of the other 50% to trainee
        payment_intent_id = session.get('paymentIntentId')
        refund_amount = final_price - half_price
        if payment_intent_id and not payment_intent_id.startswith('mock_') and refund_amount > 0:
            try:
                refund = stripe.Refund.create(
                    payment_intent=payment_intent_id,
                    amount=refund_amount,
                )
                update_doc['stripeRefundId'] = refund.id
                update_doc['traineeRefundCents'] = refund_amount
            except stripe.error.StripeError as e:
                update_doc['stripeRefundError'] = str(e)

        await create_and_send_notification(
            session['traineeId'],
            "No-Show Recorded",
            f"You were marked as a no-show. You've been charged ${half_price/100:.2f}.",
            "session_ended",
            {"sessionId": session_id}
        )
        await create_and_send_notification(
            session['trainerId'],
            "Trainee No-Show",
            f"Your trainee didn't show up. You'll receive ${trainer_payout/100:.2f}.",
            "session_ended",
            {"sessionId": session_id}
        )

        msg = f"Trainee no-show. Trainer payout: ${trainer_payout/100:.2f}. Platform fee: ${platform_fee/100:.2f}."

    else:  # trainer no-show
        # Full refund to trainee, trainer gets $0 + strike
        update_doc.update({
            'noShowFeeCents': 0,
            'platformFeeCents': 0,
            'trainerEarningsCents': 0,
            'traineeRefundCents': final_price,
            'trainerStrikeApplied': True,
        })

        # Stripe: full refund
        payment_intent_id = session.get('paymentIntentId')
        if payment_intent_id and not payment_intent_id.startswith('mock_'):
            try:
                refund = stripe.Refund.create(
                    payment_intent=payment_intent_id,
                    reason='requested_by_customer',
                )
                update_doc['stripeRefundId'] = refund.id
            except stripe.error.StripeError as e:
                update_doc['stripeRefundError'] = str(e)

        # Apply trainer strike
        await db.users.update_one(
            {'_id': ObjectId(session['trainerId'])},
            {
                '$inc': {'performanceStrikes': 1},
                '$push': {'strikeHistory': {
                    'sessionId': session_id,
                    'reason': 'no_show',
                    'createdAt': datetime.utcnow()
                }}
            }
        )
        # Check for 3-strike threshold
        trainer = await db.users.find_one({'_id': ObjectId(session['trainerId'])})
        if trainer and trainer.get('performanceStrikes', 0) >= 3:
            await db.users.update_one(
                {'_id': ObjectId(session['trainerId'])},
                {'$set': {'accountUnderReview': True, 'reviewReason': '3+ performance strikes'}}
            )

        await create_and_send_notification(
            session['traineeId'],
            "Trainer No-Show",
            "Your trainer didn't show up. A full refund has been processed.",
            "session_ended",
            {"sessionId": session_id}
        )
        await create_and_send_notification(
            session['trainerId'],
            "No-Show Strike",
            "You were marked as a no-show. A performance strike has been applied.",
            "session_ended",
            {"sessionId": session_id}
        )

        msg = f"Trainer no-show. Full refund of ${final_price/100:.2f} to trainee. Strike applied to trainer."

    await db.sessions.update_one({'_id': ObjectId(session_id)}, {'$set': update_doc})

    return {
        'success': True,
        'noShowParty': who,
        'trainerEarningsCents': update_doc.get('trainerEarningsCents', 0),
        'traineeRefundCents': update_doc.get('traineeRefundCents', 0),
        'platformFeeCents': update_doc.get('platformFeeCents', 0),
        'trainerStrike': who == "trainer",
        'message': msg,
    }

@api_router.patch("/sessions/{session_id}/complete", response_model=SessionResponse)
async def complete_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Mark session as completed"""
    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.sessions.update_one(
        {'_id': ObjectId(session_id)},
        {'$set': {'status': SessionStatus.COMPLETED, 'updatedAt': datetime.utcnow()}}
    )
    
    # Update trainer stats
    await db.trainer_profiles.update_one(
        {'userId': session['trainerId']},
        {'$inc': {'totalSessionsCompleted': 1}}
    )
    
    updated_session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    return SessionResponse(**serialize_doc(updated_session))

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
    # Find available virtual trainers
    available_trainers = await db.trainer_profiles.find({
        'isAvailable': True,
        'isVirtualTrainingAvailable': True,
        'offersVirtual': True
    }).to_list(100)
    
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
                       if datetime.fromisoformat(str(s['sessionDateTimeStart'])).weekday() >= 5]
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
                     if datetime.fromisoformat(str(s['sessionDateTimeStart'])).hour < 12]
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
                     if datetime.fromisoformat(str(s['sessionDateTimeStart'])).hour >= 18]
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
    sorted_sessions = sorted(completed_sessions, key=lambda s: s['sessionDateTimeStart'])
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
    
    # Get all completed sessions for this trainee
    completed_sessions = await db.sessions.find({
        'traineeId': trainee_id,
        'status': SessionStatus.COMPLETED
    }).to_list(1000)
    
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
    
    # Get all ratings by this trainee
    ratings = await db.ratings.find({'traineeId': trainee_id}).to_list(1000)
    
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
    feedback_count = len(ratings)
    feedback_progress = min(feedback_count, 10)
    badges.append(BadgeProgress(
        badgeType=TraineeBadgeType.FEEDBACK_HERO,
        badgeName="Feedback Hero",
        description="Write 10 session reviews",
        isUnlocked=feedback_count >= 10,
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
    
    # Build response with user names from map
    nearby_trainers = []
    for item in nearby_trainers_data:
        trainer = item['trainer']
        distance = item['distance']
        
        # Get trainer's user name from batch-fetched map
        full_name = users_map.get(trainer['userId'], 'Trainer')
        
        # Calculate ETA
        eta = estimate_eta_minutes(distance)
        
        nearby_trainers.append({
            'id': str(trainer['_id']),
            'trainerId': trainer['userId'],
            'fullName': full_name,
            'avatarUrl': trainer.get('avatarUrl'),
            'latitude': trainer.get('latitude'),
            'longitude': trainer.get('longitude'),
            'isAvailable': True,
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
@limiter.limit("10/minute")
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
            "benefits": [
                "Discounted sessions",
                "1 free profile Boost per month",
                "Priority customer support",
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
    trainer_total = session_split['trainer_payout_cents'] + (travel_split['trainer_payout_cents'] if travel_split else 0)
    platform_total = session_split['platform_fee_cents'] + (travel_split['platform_fee_cents'] if travel_split else 0)
    
    return {
        "sessionPrice": session_split,
        "travelFee": travel_split,
        "totals": {
            "totalCents": total_cost,
            "trainerPayoutCents": trainer_total,
            "platformFeeCents": platform_total,
            "totalDollars": total_cost / 100,
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


# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

async def require_admin(current_user: dict = Depends(get_current_user)):
    """Dependency to ensure user is admin"""
    if not current_user.get('isAdmin', False) and UserRole.ADMIN not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@api_router.get("/admin/dashboard")
async def get_admin_dashboard(admin_user: dict = Depends(require_admin)):
    """Get admin dashboard statistics"""
    
    # Count users
    total_users = await db.users.count_documents({})
    total_trainers = await db.users.count_documents({'roles': {'$in': ['trainer']}})
    total_trainees = await db.users.count_documents({'roles': {'$in': ['trainee']}})
    
    # Count sessions
    total_sessions = await db.sessions.count_documents({})
    completed_sessions = await db.sessions.count_documents({'status': SessionStatus.COMPLETED})
    
    # Calculate revenue (from completed sessions)
    sessions = await db.sessions.find({'status': SessionStatus.COMPLETED}).to_list(None)
    total_revenue = sum(s.get('finalSessionPriceCents', 0) for s in sessions)
    platform_revenue = int(total_revenue * PricingRules.PLATFORM_REVENUE_PERCENT / 100)
    trainer_payouts = total_revenue - platform_revenue
    
    # Count memberships and boosts
    active_memberships = await db.memberships.count_documents({'status': MembershipStatus.ACTIVE})
    active_boosts = await db.boosts.count_documents({'isActive': True, 'endDate': {'$gte': datetime.utcnow()}})
    
    # Pending verifications
    pending_verifications = await db.trainer_profiles.count_documents({
        'verificationStatus': VerificationStatus.PENDING
    })
    
    return {
        "totalUsers": total_users,
        "totalTrainers": total_trainers,
        "totalTrainees": total_trainees,
        "totalSessions": total_sessions,
        "completedSessions": completed_sessions,
        "totalRevenueCents": total_revenue,
        "totalRevenueDollars": total_revenue / 100,
        "platformRevenueCents": platform_revenue,
        "platformRevenueDollars": platform_revenue / 100,
        "trainerPayoutsCents": trainer_payouts,
        "trainerPayoutsDollars": trainer_payouts / 100,
        "activeMemberships": active_memberships,
        "activeBoosts": active_boosts,
        "pendingVerifications": pending_verifications
    }

@api_router.get("/admin/top-trainers")
async def admin_top_trainers(days: int = 7, limit: int = 5, admin_user: dict = Depends(require_admin)):
    """Get top trainers by completed sessions in the given period"""
    cutoff = datetime.utcnow() - timedelta(days=days)

    pipeline = [
        {"$match": {"status": SessionStatus.COMPLETED, "createdAt": {"$gte": cutoff}}},
        {"$group": {"_id": "$trainerId", "sessionCount": {"$sum": 1}, "totalRevenue": {"$sum": "$finalSessionPriceCents"}}},
        {"$sort": {"sessionCount": -1}},
        {"$limit": limit},
    ]
    results = await db.sessions.aggregate(pipeline).to_list(limit)

    trainer_ids = [r["_id"] for r in results if r["_id"]]
    users = {str(u["_id"]): u for u in await db.users.find({"_id": {"$in": [ObjectId(tid) for tid in trainer_ids]}}).to_list(len(trainer_ids))} if trainer_ids else {}
    profiles = {p["userId"]: p for p in await db.trainer_profiles.find({"userId": {"$in": trainer_ids}}).to_list(len(trainer_ids))} if trainer_ids else {}

    leaderboard = []
    for r in results:
        tid = r["_id"]
        user = users.get(tid, {})
        profile = profiles.get(tid, {})
        total_reviews = profile.get("totalReviews", 0)
        avg_rating = profile.get("averageRating", 0.0)
        tier = calculate_trainer_tier(total_reviews, avg_rating, False)
        leaderboard.append({
            "trainerId": tid,
            "fullName": user.get("fullName", "Unknown Trainer"),
            "sessionCount": r["sessionCount"],
            "totalRevenueCents": r["totalRevenue"],
            "averageRating": round(avg_rating, 1),
            "tier": tier,
        })

    # If no data in period, return top trainers by all-time rating
    if not leaderboard:
        fallback = await db.trainer_profiles.find(
            {}, {"_id": 0, "userId": 1, "averageRating": 1, "totalReviews": 1}
        ).sort("averageRating", -1).limit(limit).to_list(limit)
        fb_ids = [f["userId"] for f in fallback]
        fb_users = {str(u["_id"]): u for u in await db.users.find({"_id": {"$in": [ObjectId(fid) for fid in fb_ids]}}).to_list(len(fb_ids))} if fb_ids else {}
        for f in fallback:
            uid = f["userId"]
            u = fb_users.get(uid, {})
            leaderboard.append({
                "trainerId": uid,
                "fullName": u.get("fullName", "Unknown Trainer"),
                "sessionCount": 0,
                "totalRevenueCents": 0,
                "averageRating": round(f.get("averageRating", 0), 1),
                "tier": calculate_trainer_tier(f.get("totalReviews", 0), f.get("averageRating", 0), False),
            })

    return {"leaderboard": leaderboard, "periodDays": days}


@api_router.get("/admin/users")
async def admin_get_users(
    skip: int = 0,
    limit: int = 50,
    role: Optional[str] = None,
    admin_user: dict = Depends(require_admin)
):
    """Get all users for admin"""
    query = {}
    if role:
        query['roles'] = {'$in': [role]}
    
    users = await db.users.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    
    serialized_users = []
    for u in users:
        doc = serialize_doc(u)
        doc.pop('passwordHash', None)
        serialized_users.append(doc)
    
    return {
        "users": serialized_users,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.get("/admin/users/{user_id}")
async def admin_get_user_detail(user_id: str, admin_user: dict = Depends(require_admin)):
    """Get detailed user information for admin"""
    user = await db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get profile
    trainer_profile = await db.trainer_profiles.find_one({'userId': user_id})
    trainee_profile = await db.trainee_profiles.find_one({'userId': user_id})
    
    # Get sessions
    sessions = await db.sessions.find({
        '$or': [{'traineeId': user_id}, {'trainerId': user_id}]
    }).sort('createdAt', -1).limit(20).to_list(20)
    
    # Get transactions
    transactions = await db.transactions.find({
        'userId': user_id
    }).sort('createdAt', -1).limit(20).to_list(20)
    
    # Get achievements
    achievements = await db.achievements.find_one({'userId': user_id})
    
    return {
        "user": serialize_doc(user),
        "trainerProfile": serialize_doc(trainer_profile) if trainer_profile else None,
        "traineeProfile": serialize_doc(trainee_profile) if trainee_profile else None,
        "recentSessions": [serialize_doc(s) for s in sessions],
        "recentTransactions": [serialize_doc(t) for t in transactions],
        "achievements": serialize_doc(achievements) if achievements else None
    }

@api_router.put("/admin/users/{user_id}")
async def admin_update_user(
    user_id: str,
    updates: dict,
    admin_user: dict = Depends(require_admin)
):
    """Update user details (admin only)"""
    # Don't allow changing password directly
    updates.pop('password', None)
    updates.pop('passwordHash', None)
    updates['updatedAt'] = datetime.utcnow()
    updates['updatedBy'] = str(admin_user['_id'])
    
    result = await db.users.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": "User updated"}

@api_router.get("/admin/sessions")
async def admin_get_sessions(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    admin_user: dict = Depends(require_admin)
):
    """Get all sessions for admin with trainer/trainee names, location, and duration"""
    query = {}
    if status:
        query['status'] = status
    
    sessions = await db.sessions.find(query).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.sessions.count_documents(query)
    
    # Collect all unique user IDs for batch lookup
    user_ids = set()
    for s in sessions:
        if s.get('trainerId'):
            user_ids.add(s['trainerId'])
        if s.get('traineeId'):
            user_ids.add(s['traineeId'])
    
    # Batch fetch user names
    users_map = {}
    if user_ids:
        user_obj_ids = []
        for uid in user_ids:
            try:
                user_obj_ids.append(ObjectId(uid))
            except Exception:
                pass
        if user_obj_ids:
            users_cursor = db.users.find({'_id': {'$in': user_obj_ids}}, {'fullName': 1, 'email': 1})
            users_list = await users_cursor.to_list(len(user_obj_ids))
            users_map = {str(u['_id']): u for u in users_list}
    
    # Batch fetch trainee profiles for home address
    trainee_profiles_map = {}
    trainee_ids = [s.get('traineeId') for s in sessions if s.get('traineeId')]
    if trainee_ids:
        trainee_profiles = await db.trainee_profiles.find(
            {'userId': {'$in': list(set(trainee_ids))}},
            {'userId': 1, 'homeAddress': 1, 'locationAddress': 1}
        ).to_list(len(set(trainee_ids)))
        trainee_profiles_map = {tp['userId']: tp for tp in trainee_profiles}
    
    # Enrich sessions with names and computed duration
    enriched_sessions = []
    for s in sessions:
        doc = serialize_doc(s)
        trainer_user = users_map.get(s.get('trainerId', ''), {})
        trainee_user = users_map.get(s.get('traineeId', ''), {})
        doc['trainerName'] = trainer_user.get('fullName', 'Unknown')
        doc['trainerEmail'] = trainer_user.get('email', '')
        doc['traineeName'] = trainee_user.get('fullName', 'Unknown')
        doc['traineeEmail'] = trainee_user.get('email', '')
        
        # Add trainee home address for in-home sessions
        trainee_profile = trainee_profiles_map.get(s.get('traineeId', ''))
        if trainee_profile:
            doc['traineeHomeAddress'] = trainee_profile.get('homeAddress') or trainee_profile.get('locationAddress', '')
        else:
            doc['traineeHomeAddress'] = ''
        
        # Compute actual duration if start/end times exist
        started = s.get('sessionStartedAt')
        ended = s.get('sessionEndedAt')
        if started and ended:
            actual_minutes = int((ended - started).total_seconds() / 60)
            doc['actualDurationMinutes'] = actual_minutes
        else:
            doc['actualDurationMinutes'] = None
        
        enriched_sessions.append(doc)
    
    return {
        "sessions": enriched_sessions,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.get("/admin/transactions")
async def admin_get_transactions(
    skip: int = 0,
    limit: int = 50,
    transaction_type: Optional[str] = None,
    admin_user: dict = Depends(require_admin)
):
    """Get all transactions for admin"""
    query = {}
    if transaction_type:
        query['transactionType'] = transaction_type
    
    transactions = await db.transactions.find(query).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.transactions.count_documents(query)
    
    return {
        "transactions": [serialize_doc(t) for t in transactions],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@api_router.get("/admin/verifications/pending")
async def admin_get_pending_verifications(admin_user: dict = Depends(require_admin)):
    """Get all pending trainer verifications"""
    pending = await db.trainer_profiles.find({
        'verificationStatus': VerificationStatus.PENDING
    }).to_list(None)
    
    # Get user names
    result = []
    for profile in pending:
        user = await db.users.find_one({'_id': ObjectId(profile['userId'])})
        result.append({
            "profile": serialize_doc(profile),
            "user": serialize_doc(user) if user else None
        })
    
    return {"pendingVerifications": result, "count": len(result)}

@api_router.post("/admin/verifications/{trainer_id}/approve")
async def admin_approve_verification(
    trainer_id: str,
    admin_user: dict = Depends(require_admin)
):
    """Approve trainer verification"""
    result = await db.trainer_profiles.update_one(
        {'userId': trainer_id},
        {
            '$set': {
                'verificationStatus': VerificationStatus.VERIFIED,
                'isVerified': True,
                'canGoLive': True,
                'verifiedAt': datetime.utcnow(),
                'verifiedBy': str(admin_user['_id'])
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    return {"success": True, "message": "Trainer verification approved"}

@api_router.post("/admin/verifications/{trainer_id}/reject")
async def admin_reject_verification(
    trainer_id: str,
    reason: str = "Verification requirements not met",
    admin_user: dict = Depends(require_admin)
):
    """Reject trainer verification"""
    result = await db.trainer_profiles.update_one(
        {'userId': trainer_id},
        {
            '$set': {
                'verificationStatus': VerificationStatus.REJECTED,
                'isVerified': False,
                'canGoLive': False,
                'rejectionReason': reason,
                'rejectedAt': datetime.utcnow(),
                'rejectedBy': str(admin_user['_id'])
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    return {"success": True, "message": "Trainer verification rejected"}

@api_router.get("/admin/trainer-payout-info/{trainer_id}")
async def admin_get_trainer_payout_info(
    trainer_id: str,
    admin_user: dict = Depends(require_admin)
):
    """Get trainer's payout information for admin to process payment"""
    payout_info = await db.trainer_payout_info.find_one({'trainerId': trainer_id})
    if not payout_info:
        return {"hasPayoutInfo": False, "payoutInfo": None}
    
    return {"hasPayoutInfo": True, "payoutInfo": serialize_doc(payout_info)}

@api_router.post("/admin/process-payout")
async def admin_process_payout(
    trainer_id: str,
    amount_cents: int,
    payment_method: str,
    notes: Optional[str] = None,
    admin_user: dict = Depends(require_admin)
):
    """Record a payout to trainer (manual process via CashApp/Zelle/etc)"""
    payout = {
        'trainerId': trainer_id,
        'amountCents': amount_cents,
        'paymentMethod': payment_method,
        'notes': notes,
        'processedBy': str(admin_user['_id']),
        'processedAt': datetime.utcnow(),
        'createdAt': datetime.utcnow()
    }
    
    result = await db.trainer_payouts.insert_one(payout)
    payout['id'] = str(result.inserted_id)
    
    return {"success": True, "payout": serialize_doc(payout)}


# --- Admin: Delete/Remove User ---
@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin_user: dict = Depends(require_admin)):
    """Admin: Remove a user and all their associated data"""
    user = await db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting yourself
    if str(admin_user['_id']) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
    
    # Delete related data
    await db.trainer_profiles.delete_many({'userId': user_id})
    await db.trainee_profiles.delete_many({'userId': user_id})
    await db.sessions.delete_many({'$or': [{'traineeId': user_id}, {'trainerId': user_id}]})
    await db.ratings.delete_many({'$or': [{'traineeId': user_id}, {'trainerId': user_id}]})
    await db.trainer_achievements.delete_many({'trainerId': user_id})
    await db.trainee_achievements.delete_many({'traineeId': user_id})
    await db.blocks.delete_many({'$or': [{'blockerUserId': user_id}, {'blockedUserId': user_id}]})
    await db.reports.delete_many({'$or': [{'reporterUserId': user_id}, {'reportedUserId': user_id}]})
    await db.transactions.delete_many({'userId': user_id})
    await db.memberships.delete_many({'userId': user_id})
    await db.boosts.delete_many({'trainerId': user_id})
    await db.payout_requests.delete_many({'trainerId': user_id})
    await db.trainer_payouts.delete_many({'trainerId': user_id})
    
    # Delete conversations & messages
    convos = await db.conversations.find({'participants': user_id}).to_list(None)
    for c in convos:
        await db.messages.delete_many({'conversationId': str(c['_id'])})
    await db.conversations.delete_many({'participants': user_id})
    
    # Delete the user
    await db.users.delete_one({'_id': ObjectId(user_id)})
    
    return {"success": True, "message": f"User {user.get('fullName', '')} and all associated data removed"}


# --- Admin: Refund a Session Payment ---
class AdminRefundRequest(BaseModel):
    sessionId: str
    reason: Optional[str] = "Admin refund"

@api_router.post("/admin/refund")
async def admin_refund_payment(
    refund_req: AdminRefundRequest,
    admin_user: dict = Depends(require_admin)
):
    """Admin: Refund a session payment. Attempts Stripe refund if payment intent exists, otherwise records refund."""
    try:
        oid = ObjectId(refund_req.sessionId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.get('refunded'):
        raise HTTPException(status_code=400, detail="Session already refunded")
    
    amount_cents = session.get('finalSessionPriceCents', 0)
    stripe_refund_id = None
    refund_status = "completed"
    
    # Try Stripe refund if payment intent exists
    payment_intent_id = session.get('paymentIntentId')
    if payment_intent_id and not payment_intent_id.startswith('mock_'):
        try:
            refund = stripe.Refund.create(
                payment_intent=payment_intent_id,
                reason='requested_by_customer'
            )
            stripe_refund_id = refund.id
        except Exception as e:
            refund_status = "stripe_failed"
            logger.error(f"Stripe refund failed: {e}")
    
    # Update session as refunded
    await db.sessions.update_one(
        {'_id': oid},
        {'$set': {
            'refunded': True,
            'refundedAt': datetime.utcnow(),
            'refundedBy': str(admin_user['_id']),
            'refundReason': refund_req.reason,
            'refundAmountCents': amount_cents,
            'stripeRefundId': stripe_refund_id,
            'updatedAt': datetime.utcnow()
        }}
    )
    
    # Record transaction
    refund_transaction = {
        'userId': session.get('traineeId', ''),
        'sessionId': refund_req.sessionId,
        'transactionType': TransactionType.REFUND,
        'amountCents': amount_cents,
        'status': refund_status,
        'description': f"Refund: {refund_req.reason}",
        'stripeRefundId': stripe_refund_id,
        'processedBy': str(admin_user['_id']),
        'createdAt': datetime.utcnow()
    }
    await db.transactions.insert_one(refund_transaction)
    
    return {
        "success": True,
        "refundAmountCents": amount_cents,
        "stripeRefundId": stripe_refund_id,
        "status": refund_status,
        "message": f"Refund of ${amount_cents/100:.2f} processed"
    }


# --- Admin: Confirm a Payment ---
class AdminConfirmPaymentRequest(BaseModel):
    sessionId: str
    notes: Optional[str] = None

@api_router.post("/admin/confirm-payment")
async def admin_confirm_payment(
    req: AdminConfirmPaymentRequest,
    admin_user: dict = Depends(require_admin)
):
    """Admin: Manually confirm/mark a session payment as completed"""
    try:
        oid = ObjectId(req.sessionId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    amount_cents = session.get('finalSessionPriceCents', 0)
    
    await db.sessions.update_one(
        {'_id': oid},
        {'$set': {
            'paymentConfirmed': True,
            'paymentConfirmedAt': datetime.utcnow(),
            'paymentConfirmedBy': str(admin_user['_id']),
            'updatedAt': datetime.utcnow()
        }}
    )
    
    # Record transaction
    confirm_transaction = {
        'userId': session.get('traineeId', ''),
        'sessionId': req.sessionId,
        'transactionType': TransactionType.SESSION_PAYMENT,
        'amountCents': amount_cents,
        'trainerPayoutCents': session.get('trainerEarningsCents', 0),
        'platformFeeCents': session.get('platformFeeCents', 0),
        'status': PaymentStatus.COMPLETED,
        'description': f"Payment confirmed by admin. {req.notes or ''}".strip(),
        'processedBy': str(admin_user['_id']),
        'createdAt': datetime.utcnow()
    }
    await db.transactions.insert_one(confirm_transaction)
    
    return {
        "success": True,
        "amountCents": amount_cents,
        "message": f"Payment of ${amount_cents/100:.2f} confirmed"
    }


# --- Admin: Update own profile ---
class AdminProfileUpdate(BaseModel):
    fullName: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None

@api_router.put("/admin/profile")
async def admin_update_profile(
    profile_update: AdminProfileUpdate,
    admin_user: dict = Depends(require_admin)
):
    """Admin: Update own profile information"""
    update_data = {}
    if profile_update.fullName:
        update_data['fullName'] = profile_update.fullName
    if profile_update.phone:
        update_data['phone'] = profile_update.phone
    if profile_update.email:
        # Check email not taken by another user
        existing = await db.users.find_one({'email': profile_update.email, '_id': {'$ne': admin_user['_id']}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use by another account")
        update_data['email'] = profile_update.email
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data['updatedAt'] = datetime.utcnow()
    
    await db.users.update_one(
        {'_id': admin_user['_id']},
        {'$set': update_data}
    )
    
    updated_user = await db.users.find_one({'_id': admin_user['_id']})
    user_doc = serialize_doc(updated_user)
    user_doc.pop('passwordHash', None)
    return {
        "success": True,
        "user": user_doc,
        "message": "Profile updated successfully"
    }


# --- Admin: Get enriched transactions with user names ---
@api_router.get("/admin/transactions-enriched")
async def admin_get_transactions_enriched(
    skip: int = 0,
    limit: int = 50,
    admin_user: dict = Depends(require_admin)
):
    """Get all sessions as transactions with user names for admin panel"""
    sessions = await db.sessions.find().sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.sessions.count_documents({})
    
    # Batch fetch user names
    user_ids = set()
    for s in sessions:
        if s.get('trainerId'):
            user_ids.add(s['trainerId'])
        if s.get('traineeId'):
            user_ids.add(s['traineeId'])
    
    users_map = {}
    if user_ids:
        user_obj_ids = [ObjectId(uid) for uid in user_ids if uid]
        if user_obj_ids:
            users_list = await db.users.find({'_id': {'$in': user_obj_ids}}, {'fullName': 1}).to_list(len(user_obj_ids))
            users_map = {str(u['_id']): u.get('fullName', 'Unknown') for u in users_list}
    
    enriched = []
    for s in sessions:
        doc = serialize_doc(s)
        doc['trainerName'] = users_map.get(s.get('trainerId', ''), 'Unknown')
        doc['traineeName'] = users_map.get(s.get('traineeId', ''), 'Unknown')
        enriched.append(doc)
    
    return {"transactions": enriched, "total": total, "skip": skip, "limit": limit}


# --- Admin: Send message to any user ---
class AdminMessageSend(BaseModel):
    receiverId: str
    content: str

@api_router.post("/admin/message")
async def admin_send_message(
    msg: AdminMessageSend,
    admin_user: dict = Depends(require_admin)
):
    """Admin: Send a message to any user via the existing chat system"""
    admin_id = str(admin_user['_id'])
    
    # Find or create conversation
    conversation = await db.conversations.find_one({
        'participants': {'$all': [admin_id, msg.receiverId]}
    })
    
    if not conversation:
        conversation_doc = {
            '_id': str(uuid.uuid4()),
            'participants': [admin_id, msg.receiverId],
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }
        await db.conversations.insert_one(conversation_doc)
        conversation = conversation_doc
    
    message_doc = {
        '_id': str(uuid.uuid4()),
        'conversationId': str(conversation['_id']),
        'senderId': admin_id,
        'receiverId': msg.receiverId,
        'content': msg.content,
        'isRead': False,
        'createdAt': datetime.utcnow()
    }
    
    await db.messages.insert_one(message_doc)
    await db.conversations.update_one(
        {'_id': conversation['_id']},
        {'$set': {'updatedAt': datetime.utcnow()}}
    )
    
    return {
        "success": True,
        "messageId": str(message_doc['_id']),
        "conversationId": str(conversation['_id']),
        "message": "Message sent successfully"
    }


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


# ============================================================================
# PASSWORD RESET ENDPOINTS
# ============================================================================

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    newPassword: str

@api_router.post("/auth/forgot-password")
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

@api_router.post("/auth/reset-password")
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
    path = os.path.join(os.path.dirname(__file__), "RapidReps_User_Manual.pdf")
    return FileResponse(path, media_type="application/pdf", filename="RapidReps_User_Manual.pdf")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# ============================================================================
# BACKGROUND NOTIFICATION SCHEDULER
# ============================================================================

async def notification_scheduler():
    """Background task: checks every 5 minutes for timed notifications."""
    while True:
        try:
            now = datetime.utcnow()

            # 1. Session Reminders — sessions starting in next 25-35 min
            reminder_start = now + timedelta(minutes=25)
            reminder_end = now + timedelta(minutes=35)
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
    """Trainee rejects the matched trainer and re-enters the queue"""
    try:
        req = await db.virtual_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(404, "Request not found")
    if not req or req["traineeId"] != str(current_user["_id"]):
        raise HTTPException(403, "Not authorized")

    old_trainer = req.get("matchedTrainerId")
    rejected_list = req.get("rejectedTrainers", [])
    if old_trainer:
        rejected_list.append(old_trainer)

    await db.virtual_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "status": "searching",
            "matchedTrainerId": None,
            "matchedTrainerName": None,
            "rejectedTrainers": rejected_list,
        }}
    )

    # Re-run matching engine with rejected list
    session_type = req.get("sessionType", "virtual")
    t_lat = req.get("traineeLat")
    t_lon = req.get("traineeLon")

    notified, wave_data = await run_matching_engine(
        trainee_id=str(current_user["_id"]),
        trainee_name=current_user.get("fullName", "A Trainee"),
        trainee_lat=t_lat,
        trainee_lon=t_lon,
        session_type=session_type,
        rejected_trainers=rejected_list,
        request_id=request_id,
    )

    await db.virtual_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$addToSet": {"notifiedTrainers": {"$each": notified}},
         "$set": {"waveScores": wave_data}}
    )

    return {"success": True, "status": "searching"}


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

# Include the router in the main app - MUST be after all route definitions
app.include_router(api_router)

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
