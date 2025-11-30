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

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

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
    filtered_trainers = []
    
    for trainer in trainers:
        # Include if trainee wants virtual AND trainer offers virtual
        if wantsVirtual and trainer.get('isVirtualTrainingAvailable'):
            filtered_trainers.append(trainer)
            continue
        
        # Include if within 10 miles (if both have location data)
        if latitude and longitude and trainer.get('latitude') and trainer.get('longitude'):
            from math import radians, sin, cos, sqrt, atan2
            
            # Haversine formula
            R = 3959  # Earth radius in miles
            lat1, lon1 = radians(latitude), radians(longitude)
            lat2, lon2 = radians(trainer['latitude']), radians(trainer['longitude'])
            
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            distance = R * c
            
            if distance <= 10:  # Within 10 miles
                filtered_trainers.append(trainer)
                continue
        
        # Include if no location data (for backwards compatibility)
        if not latitude and not longitude:
            filtered_trainers.append(trainer)
    
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
