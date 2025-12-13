from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'rapidreps_db')]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()

# Create the main app
app = FastAPI(title="RapidReps API")

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
    sessionDurationsOffered: List[int] = [30, 45, 60]
    ratePerMinuteCents: int = 100  # $1 per minute default
    travelRadiusMiles: Optional[int] = 10
    cancellationPolicy: Optional[str] = "Free cancellation before 24 hours"
    availability: Optional[dict] = None
    verificationDocs: List[str] = []
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
    sessionDurationsOffered: List[int] = []
    ratePerMinuteCents: int = 100
    travelRadiusMiles: Optional[int] = 10
    cancellationPolicy: Optional[str] = None
    averageRating: float = 0.0
    totalSessionsCompleted: int = 0
    isVerified: bool = False
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
    locationType: str  # "gym", "home", "virtual"
    locationNameOrAddress: Optional[str] = None
    notes: Optional[str] = None

class SessionResponse(BaseModel):
    id: str
    traineeId: str
    trainerId: str
    status: str
    sessionDateTimeStart: datetime
    sessionDateTimeEnd: datetime
    durationMinutes: int
    basePricePerMinuteCents: int
    baseSessionPriceCents: int
    discountType: Optional[str] = None
    discountAmountCents: int = 0
    finalSessionPriceCents: int
    platformFeePercent: int = 10
    platformFeeCents: int
    trainerEarningsCents: int
    locationType: str
    locationNameOrAddress: Optional[str] = None
    notes: Optional[str] = None
    createdAt: datetime

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
    createdAt: datetime

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
# AUTH ROUTES
# ============================================================================

@api_router.post("/auth/signup", response_model=TokenResponse)
async def signup(user_data: UserSignUp):
    """Register a new user"""
    # Check if user already exists
    existing_user = await db.users.find_one({'email': user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = hash_password(user_data.password)
    
    # Create user document
    user_doc = {
        'fullName': user_data.fullName,
        'email': user_data.email,
        'phone': user_data.phone,
        'passwordHash': hashed_password,
        'roles': user_data.roles,
        'isAdmin': False,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
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
async def login(credentials: UserLogin):
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

# ============================================================================
# TRAINER PROFILE ROUTES
# ============================================================================

@api_router.post("/trainer-profiles", response_model=TrainerProfileResponse)
async def create_trainer_profile(profile: TrainerProfileCreate, current_user: dict = Depends(get_current_user)):
    """Create or update trainer profile"""
    # Check if profile already exists
    existing_profile = await db.trainer_profiles.find_one({'userId': profile.userId})
    
    profile_doc = profile.dict()
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
    
    # Add fullName from users collection
    for trainer in filtered_trainers:
        user = await db.users.find_one({'_id': ObjectId(trainer['userId'])})
        if user:
            trainer['fullName'] = user.get('fullName', 'Unknown Trainer')
    
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
    
    # Get all trainee profiles
    all_trainees = await db.trainee_profiles.find({}).to_list(1000)
    
    # Filter trainees within 15 miles
    nearby_trainees = []
    for trainee in all_trainees:
        trainee_lat = trainee.get('latitude')
        trainee_lon = trainee.get('longitude')
        
        if trainee_lat and trainee_lon:
            distance = calculate_distance(trainer_lat, trainer_lon, trainee_lat, trainee_lon)
            
            if distance <= 15:
                # Get user info for trainee
                user = await db.users.find_one({'_id': ObjectId(trainee['userId'])})
                trainee_data = serialize_doc(trainee)
                trainee_data['distance'] = round(distance, 1)
                trainee_data['fullName'] = user.get('fullName', 'Unknown') if user else 'Unknown'
                nearby_trainees.append(trainee_data)
    
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
    """Create a new session booking"""
    # Get trainer profile to get rate
    trainer_profile = await db.trainer_profiles.find_one({'userId': session.trainerId})
    if not trainer_profile:
        raise HTTPException(status_code=404, detail="Trainer not found")
    
    base_rate = trainer_profile['ratePerMinuteCents']
    base_price = base_rate * session.durationMinutes
    
    # Check for multi-session discount (3+ sessions in last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_sessions = await db.sessions.count_documents({
        'traineeId': session.traineeId,
        'trainerId': session.trainerId,
        'createdAt': {'$gte': thirty_days_ago},
        'status': {'$ne': SessionStatus.DECLINED}
    })
    
    discount_amount = 0
    discount_type = None
    if recent_sessions >= 2:  # This will be the 3rd session
        discount_amount = int(base_price * 0.05)  # 5% discount
        discount_type = "multi_session"
    
    final_price = base_price - discount_amount
    platform_fee = int(final_price * 0.10)  # 10% platform fee
    trainer_earnings = final_price - platform_fee
    
    session_doc = {
        'traineeId': session.traineeId,
        'trainerId': session.trainerId,
        'status': SessionStatus.REQUESTED,
        'sessionDateTimeStart': session.sessionDateTimeStart,
        'sessionDateTimeEnd': session.sessionDateTimeStart + timedelta(minutes=session.durationMinutes),
        'durationMinutes': session.durationMinutes,
        'basePricePerMinuteCents': base_rate,
        'baseSessionPriceCents': base_price,
        'discountType': discount_type,
        'discountAmountCents': discount_amount,
        'finalSessionPriceCents': final_price,
        'platformFeePercent': 10,
        'platformFeeCents': platform_fee,
        'trainerEarningsCents': trainer_earnings,
        'locationType': session.locationType,
        'locationNameOrAddress': session.locationNameOrAddress,
        'notes': session.notes,
        'paymentIntentId': None,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    
    result = await db.sessions.insert_one(session_doc)
    session_doc['_id'] = result.inserted_id
    
    return SessionResponse(**serialize_doc(session_doc))

@api_router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    """Get session by ID"""
    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return SessionResponse(**serialize_doc(session))

@api_router.get("/trainer/sessions", response_model=List[SessionResponse])
async def get_trainer_sessions(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get sessions for a trainer"""
    user_id = str(current_user['_id'])
    query = {'trainerId': user_id}
    
    if status:
        query['status'] = status
    
    sessions = await db.sessions.find(query).sort('sessionDateTimeStart', -1).to_list(100)
    return [SessionResponse(**serialize_doc(s)) for s in sessions]

@api_router.get("/trainee/sessions", response_model=List[SessionResponse])
async def get_trainee_sessions(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get sessions for a trainee"""
    user_id = str(current_user['_id'])
    query = {'traineeId': user_id}
    
    if status:
        query['status'] = status
    
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
    return SessionResponse(**serialize_doc(updated_session))

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
        'notes': request.notes,
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
async def create_rating(rating: RatingCreate, current_user: dict = Depends(get_current_user)):
    """Create a rating for a completed session"""
    # Check if session exists and is completed
    session = await db.sessions.find_one({'_id': ObjectId(rating.sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session['status'] != SessionStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Can only rate completed sessions")
    
    # Check if rating already exists
    existing_rating = await db.ratings.find_one({'sessionId': rating.sessionId})
    if existing_rating:
        raise HTTPException(status_code=400, detail="Session already rated")
    
    rating_doc = rating.dict()
    rating_doc['createdAt'] = datetime.utcnow()
    
    result = await db.ratings.insert_one(rating_doc)
    rating_doc['_id'] = result.inserted_id
    
    # Update trainer average rating
    all_ratings = await db.ratings.find({'trainerId': rating.trainerId}).to_list(1000)
    if all_ratings:
        avg_rating = sum(r['rating'] for r in all_ratings) / len(all_ratings)
        await db.trainer_profiles.update_one(
            {'userId': rating.trainerId},
            {'$set': {'averageRating': round(avg_rating, 2)}}
        )
    
    return RatingResponse(**serialize_doc(rating_doc))

@api_router.get("/trainers/{trainer_id}/ratings", response_model=List[RatingResponse])
async def get_trainer_ratings(trainer_id: str):
    """Get all ratings for a trainer"""
    ratings = await db.ratings.find({'trainerId': trainer_id}).sort('createdAt', -1).to_list(100)
    return [RatingResponse(**serialize_doc(r)) for r in ratings]

# ============================================================================
# TRAINER EARNINGS
# ============================================================================

@api_router.get("/trainer/earnings")
async def get_trainer_earnings(current_user: dict = Depends(get_current_user)):
    """Get trainer earnings summary"""
    user_id = str(current_user['_id'])
    
    # Get all completed sessions
    completed_sessions = await db.sessions.find({
        'trainerId': user_id,
        'status': SessionStatus.COMPLETED
    }).to_list(1000)
    
    total_earnings = sum(s['trainerEarningsCents'] for s in completed_sessions)
    
    # This month
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    month_sessions = [s for s in completed_sessions if s['createdAt'] >= month_start]
    month_earnings = sum(s['trainerEarningsCents'] for s in month_sessions)
    
    # This week
    week_start = now - timedelta(days=now.weekday())
    week_sessions = [s for s in completed_sessions if s['createdAt'] >= week_start]
    week_earnings = sum(s['trainerEarningsCents'] for s in week_sessions)
    
    return {
        'totalEarningsCents': total_earnings,
        'monthEarningsCents': month_earnings,
        'weekEarningsCents': week_earnings,
        'totalSessions': len(completed_sessions),
        'monthSessions': len(month_sessions),
        'weekSessions': len(week_sessions),
        'sessions': [serialize_doc(s) for s in completed_sessions]
    }

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

@api_router.get("/admin/sessions")
async def get_all_sessions(current_user: dict = Depends(get_current_user)):
    """Admin: Get all sessions"""
    if not current_user.get('isAdmin'):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    sessions = await db.sessions.find().sort('createdAt', -1).to_list(1000)
    return [serialize_doc(s) for s in sessions]

@api_router.get("/admin/revenue")
async def get_platform_revenue(current_user: dict = Depends(get_current_user)):
    """Admin: Get platform revenue statistics"""
    if not current_user.get('isAdmin'):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    completed_sessions = await db.sessions.find({
        'status': SessionStatus.COMPLETED
    }).to_list(1000)
    
    total_platform_fees = sum(s['platformFeeCents'] for s in completed_sessions)
    total_session_value = sum(s['finalSessionPriceCents'] for s in completed_sessions)
    
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
    completed_sessions = await db.sessions.find({
        'trainerId': trainer_id,
        'status': SessionStatus.COMPLETED
    }).to_list(1000)
    
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
    
    achievements = await calculate_badge_progress(str(trainer_profile['_id']))
    
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
    
    newly_unlocked = await check_and_unlock_badges(str(trainer_profile['_id']))
    
    return {
        'newlyUnlocked': newly_unlocked,
        'message': f"Unlocked {len(newly_unlocked)} new badge(s)" if newly_unlocked else "No new badges"
    }



# ============================================================================
# TRAINEE ACHIEVEMENTS & BADGES SYSTEM
# ============================================================================

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
                       if datetime.fromisoformat(str(s['sessionDateTimeStart'])).weekday() >= 5]
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
                     if datetime.fromisoformat(str(s['sessionDateTimeStart'])).hour < 12]
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
                     if datetime.fromisoformat(str(s['sessionDateTimeStart'])).hour >= 18]
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
# ROOT ROUTES
# ============================================================================

@api_router.get("/")
async def root():
    return {"message": "RapidReps API - Uber for Personal Training"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
