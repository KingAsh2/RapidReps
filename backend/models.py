"""
RapidReps Pydantic Models & Constants
All data models, constants, enums, and business rules.
"""
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime


# ============================================================================
# ENUMS / CONSTANTS
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

class SessionType:
    VIRTUAL = "virtual"
    OUTDOOR = "outdoor"
    IN_HOME = "in_home"
    TRAINEE_HOME = "trainee_home"

class TrainerTier:
    BASIC = "basic"
    PRO = "pro"
    ELITE = "elite"

class PricingRules:
    TRAINER_REVENUE_PERCENT = 80
    PLATFORM_REVENUE_PERCENT = 20
    SERVICE_FEE_CENTS = 200
    VIRTUAL_MIN_CENTS = 3000
    OUTDOOR_MIN_CENTS = 4000
    IN_HOME_MIN_CENTS = 6000
    TRAINEE_HOME_MIN_CENTS = 6000
    TRAVEL_FEE_MIN_CENTS = 0
    TRAVEL_FEE_MAX_CENTS = 1500
    TRAINER_TRAVEL_FEE_PERCENT = 70
    PLATFORM_TRAVEL_FEE_PERCENT = 30
    CANCELLATION_FEE_VIRTUAL = 1500
    CANCELLATION_FEE_OUTDOOR = 2500
    CANCELLATION_FEE_IN_HOME = 3500
    CANCELLATION_FEE_TRAINEE_HOME = 3500
    BOOST_DAILY_CENTS = 999
    BOOST_WEEKLY_CENTS = 4999
    BOOST_MONTHLY_CENTS = 14999
    MEMBERSHIP_MONTHLY_CENTS = 1999
    MEMBERSHIP_SESSION_DISCOUNT_PERCENT = 10
    MEMBERSHIP_MATCHING_PRIORITY_BONUS = 0.15
    PLATFORM_FEE_PERCENT = 20
    TRAVEL_FEE_0_5_MILES = 0
    TRAVEL_FEE_5_10_MILES = 500
    TRAVEL_FEE_10_15_MILES = 1000
    TRAVEL_FEE_15_20_MILES = 1500
    PRO_TIER_MIN_BONUS = 1000
    PRO_TIER_MAX_BONUS = 2000
    ELITE_TIER_MIN_BONUS = 3000
    ELITE_TIER_MAX_BONUS = 5000
    VIRTUAL_DEFAULT_DURATION_MIN = 30
    VIRTUAL_MAX_DURATION_MIN = 90
    VIRTUAL_GRACE_PERIOD_MIN = 2
    MAX_ETA_MINUTES = 15
    FIND_ANOTHER_COOLDOWN_MIN = 10
    ARRIVAL_WINDOW_BEFORE_START_MIN = 5
    NO_SHOW_THRESHOLD_MIN = 10
    MAX_SELFIE_ATTEMPTS = 3
    MAX_FAKE_REQUESTS_PER_HOUR = 3
    HIGH_CANCEL_RATE_THRESHOLD = 0.5
    GPS_SPOOF_JUMP_MILES = 2.0

class TierThresholds:
    PRO_MIN_REVIEWS = 30
    PRO_MIN_RATING = 4.7
    ELITE_MIN_REVIEWS = 100

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
    FITNESS_CERT = "fitness_cert"
    INTRO_VIDEO = "intro_video"
    PROFILE_COMPLETE = "profile_complete"
    PRICING_SET = "pricing_set"

class MembershipStatus:
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"

class BoostType:
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"

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

# Referral constants
REFERRAL_CREDIT_CENTS = 500
MAX_REFERRALS_PER_USER = 5

# Personality tag constants
VALID_PERSONALITY_TAGS = [
    "INTENSE", "CHILL", "BEAST MODE", "ZEN",
    "HIGH ENERGY", "NO EXCUSES", "PATIENT", "COMPETITIVE"
]


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class UserSignUp(BaseModel):
    fullName: str
    email: EmailStr
    phone: str
    password: Optional[str] = None
    roles: List[str]
    referralCode: Optional[str] = None
    isSocialAuth: Optional[bool] = False

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
    profilePhoto: Optional[str] = None  # Exposed so /auth/me reflects the synced trainer profile photo
    avatarUrl: Optional[str] = None     # Canonical alias kept in sync via /trainer-profiles POST

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TrainerProfileCreate(BaseModel):
    userId: str
    avatarUrl: Optional[str] = None
    profilePhoto: Optional[str] = None  # legacy alias — synced to avatarUrl by route handler
    bio: Optional[str] = None
    experienceYears: Optional[int] = 0
    certifications: List[str] = []
    trainingStyles: List[str] = []
    gymsWorkedAt: List[str] = []
    primaryGym: Optional[str] = None
    offersInPerson: bool = True
    offersVirtual: bool = False
    offersOutdoor: bool = True
    offersInHome: bool = False
    sessionDurationsOffered: List[int] = [30, 45, 60]
    virtualRateCents: int = PricingRules.VIRTUAL_MIN_CENTS
    outdoorRateCents: int = PricingRules.OUTDOOR_MIN_CENTS
    inHomeRateCents: int = PricingRules.IN_HOME_MIN_CENTS
    ratePerMinuteCents: int = 100
    travelRadiusMiles: Optional[int] = 10
    cancellationPolicy: Optional[str] = "Free cancellation before 24 hours"
    availability: Optional[dict] = None
    verificationDocs: List[str] = []
    governmentIdUploaded: bool = False
    ssnVerified: bool = False
    backgroundCheckPassed: bool = False
    sexOffenderCheckPassed: bool = False
    cprAedCertUploaded: bool = False
    fitnessCertUploaded: bool = False
    introVideoUrl: Optional[str] = None
    introVideoUploaded: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    locationAddress: Optional[str] = None
    isAvailable: bool = True
    isVirtualTrainingAvailable: bool = False
    videoCallPreference: Optional[str] = "native"
    vibeTrackTitle: Optional[str] = None
    vibeArtistName: Optional[str] = None
    vibeArtworkUrl: Optional[str] = None
    vibePreviewUrl: Optional[str] = None
    vibeAppleMusicUrl: Optional[str] = None
    vibeTrackId: Optional[str] = None
    personalityTag: Optional[str] = None
    accentColor: Optional[str] = None
    accentColorAuto: Optional[str] = None  # Server-extracted from profile photo

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
    offersOutdoor: bool = True
    offersInHome: bool = False
    sessionDurationsOffered: List[int] = []
    virtualRateCents: int = PricingRules.VIRTUAL_MIN_CENTS
    outdoorRateCents: int = PricingRules.OUTDOOR_MIN_CENTS
    inHomeRateCents: int = PricingRules.IN_HOME_MIN_CENTS
    ratePerMinuteCents: int = 100
    travelRadiusMiles: Optional[int] = 10
    cancellationPolicy: Optional[str] = None
    averageRating: float = 0.0
    totalReviews: int = 0
    totalSessionsCompleted: int = 0
    isVerified: bool = False
    trainerTier: str = TrainerTier.BASIC
    verificationStatus: str = VerificationStatus.PENDING
    governmentIdUploaded: bool = False
    ssnVerified: bool = False
    backgroundCheckPassed: bool = False
    sexOffenderCheckPassed: bool = False
    cprAedCertUploaded: bool = False
    fitnessCertUploaded: bool = False
    introVideoUrl: Optional[str] = None
    introVideoUploaded: bool = False
    gallery: List[dict] = []
    socialLinks: Optional[dict] = None
    canGoLive: bool = False
    availability: Optional[dict] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    locationAddress: Optional[str] = None
    isAvailable: bool = True
    isVirtualTrainingAvailable: bool = False
    videoCallPreference: Optional[str] = None
    distance: Optional[float] = None
    matchType: Optional[str] = None
    fullName: Optional[str] = None
    vibeTrackTitle: Optional[str] = None
    vibeArtistName: Optional[str] = None
    vibeArtworkUrl: Optional[str] = None
    vibePreviewUrl: Optional[str] = None
    vibeAppleMusicUrl: Optional[str] = None
    vibeTrackId: Optional[str] = None
    personalityTag: Optional[str] = None
    accentColor: Optional[str] = None
    accentColorAuto: Optional[str] = None  # Server-extracted from profile photo
    createdAt: datetime

class TraineeProfileCreate(BaseModel):
    userId: str
    profilePhoto: Optional[str] = None
    fitnessGoals: Optional[str] = None
    currentFitnessLevel: str = FitnessLevel.BEGINNER
    experienceLevel: Optional[str] = None
    preferredTrainingStyles: List[str] = []
    injuriesOrLimitations: Optional[str] = None
    homeGymOrZipCode: Optional[str] = None
    homeAddress: Optional[str] = None
    homeStreet: Optional[str] = None
    homeCity: Optional[str] = None
    homeState: Optional[str] = None
    homeZipCode: Optional[str] = None
    prefersInPerson: bool = True
    prefersVirtual: bool = False
    isVirtualEnabled: bool = False
    typicalAvailability: Optional[dict] = None
    budgetMinPerMinuteCents: Optional[int] = 50
    budgetMaxPerMinuteCents: Optional[int] = 200
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    locationAddress: Optional[str] = None
    personalityTag: Optional[str] = None

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
    homeStreet: Optional[str] = None
    homeCity: Optional[str] = None
    homeState: Optional[str] = None
    homeZipCode: Optional[str] = None
    prefersInPerson: bool = True
    prefersVirtual: bool = False
    isVirtualEnabled: bool = False
    typicalAvailability: Optional[dict] = None
    budgetMinPerMinuteCents: int = 50
    budgetMaxPerMinuteCents: int = 200
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    locationAddress: Optional[str] = None
    personalityTag: Optional[str] = None
    gallery: List[dict] = []
    socialLinks: Optional[dict] = None
    createdAt: datetime

class SessionCreate(BaseModel):
    traineeId: str
    trainerId: str
    sessionDateTimeStart: datetime
    durationMinutes: int
    sessionType: str = SessionType.OUTDOOR
    locationType: str
    locationNameOrAddress: Optional[str] = None
    traineeLatitude: Optional[float] = None
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
    baseSessionPriceCents: int = 0
    basePricePerMinuteCents: int = 0
    travelDistanceMiles: Optional[float] = None
    travelFeeCents: int = 0
    trainerTravelEarningsCents: int = 0
    platformTravelFeeCents: int = 0
    discountType: Optional[str] = None
    discountAmountCents: int = 0
    finalSessionPriceCents: int = 0
    platformFeePercent: int = PricingRules.PLATFORM_FEE_PERCENT
    platformFeeCents: int = 0
    trainerEarningsCents: int = 0
    cancellationFeeCents: int = 0
    noShowFeeCents: int = 0
    safetyPin: Optional[str] = None
    safetyPinVerified: bool = False
    trainerGpsConfirmed: bool = False
    sessionStartedAt: Optional[datetime] = None
    sessionEndedAt: Optional[datetime] = None
    clientConfirmedEnd: bool = False
    locationType: Optional[str] = None
    locationNameOrAddress: Optional[str] = None
    traineeLatitude: Optional[float] = None
    traineeLongitude: Optional[float] = None
    scheduledDate: Optional[str] = None
    scheduledTime: Optional[str] = None
    notes: Optional[str] = None
    createdAt: Optional[datetime] = None
    trainerName: Optional[str] = None
    traineeName: Optional[str] = None
    trainerPhoto: Optional[str] = None
    traineePhoto: Optional[str] = None
    traineePhone: Optional[str] = None
    isGroupSession: bool = False
    zellePaymentStatus: Optional[str] = None

class RatingCreate(BaseModel):
    sessionId: str
    traineeId: str
    trainerId: str
    rating: int
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

class VirtualSessionRequest(BaseModel):
    traineeId: str
    durationMinutes: int = 30
    paymentMethod: str = "mock"
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

class TraineeAchievements(BaseModel):
    traineeId: str
    badges: List[BadgeProgress]
    totalCompletedSessions: int
    discountSessionsRemaining: int = 0
    currentStreak: int = 0
    streakWeeks: int = 0
    lastStreakReset: Optional[datetime] = None

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

class TrainerPayoutInfo(BaseModel):
    trainerId: str
    paymentMethod: str = "stripe"
    stripeAccountId: Optional[str] = None
    cashAppTag: Optional[str] = None
    applePayEmail: Optional[str] = None
    zelleEmail: Optional[str] = None
    zellePhone: Optional[str] = None

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

class ReportCreate(BaseModel):
    reportedUserId: str
    reason: str
    context: Optional[str] = None
    contentType: Optional[str] = None
    contentId: Optional[str] = None

class BlockResponse(BaseModel):
    blockedUserIds: List[str]

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
    participantDetails: List[dict]
    lastMessage: Optional[dict] = None
    unreadCount: int = 0
    updatedAt: datetime

class ReferralStats(BaseModel):
    referralCode: str
    totalReferrals: int
    activatedReferrals: int
    pendingReferrals: int
    totalCreditsEarned: int
    availableCredits: int
    maxReferrals: int
    referralsRemaining: int
    referralHistory: List[dict]
