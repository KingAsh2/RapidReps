"""Location & GPS routes: trainer location, availability, session GPS tracking, en-route/start-session, nearby trainers.
Extracted from server.py (Iteration 86 — P3 refactor)."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from deps import db, get_current_user, calculate_distance, create_and_send_notification, trainer_visibility_filter
from models import UserRole, SessionStatus, PricingRules, MembershipStatus

router = APIRouter(prefix="/api")


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

@router.put("/trainer/location")
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

@router.put("/trainer/availability")
async def update_trainer_availability(
    update: AvailabilityUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Toggle trainer availability status.

    iter102e: Toggling ON REQUIRES fresh live GPS coords. There is no
    fallback to stored profile coords — trainees pin proximity to the
    trainer's real-time location, so allowing a stale address to keep them
    on the map would mislead users. Without live coords the API returns 400
    and the client must surface the permission prompt to the trainer.
    """
    if UserRole.TRAINER not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Trainer access required")

    user_id = str(current_user['_id'])

    update_data = {
        'isAvailable': update.isAvailable,
        'lastAvailabilityChange': datetime.utcnow()
    }

    if update.isAvailable:
        # Live GPS is mandatory when going Available — no profile-coord fallback.
        if not (update.latitude and update.longitude):
            raise HTTPException(
                status_code=400,
                detail="Live GPS is required to go Available. Please enable Location for RapidReps in your phone settings and try again."
            )
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

@router.get("/trainer/my-location-status")
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

@router.post("/sessions/{session_id}/gps-update")
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


@router.get("/sessions/{session_id}/gps-track")
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


@router.post("/sessions/{session_id}/start-en-route")
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


@router.post("/sessions/{session_id}/start-session")
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



@router.get("/trainers/nearby")
async def get_nearby_trainers(
    latitude: float,
    longitude: float,
    radius_miles: float = 25,
    current_user: dict = Depends(get_current_user)
):
    """Get all available trainers near a location with distance and ETA"""
    
    # Get all available, ADMIN-APPROVED trainers with valid locations
    trainers = await db.trainer_profiles.find({
        'isAvailable': True,
        'latitude': {'$exists': True, '$ne': None},
        'longitude': {'$exists': True, '$ne': None},
        **trainer_visibility_filter(),
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
        
        # Filter by trainee's requested radius
        if distance > radius_miles:
            continue

        # iter102h: also honor the trainer's own willing-to-travel radius. If
        # the trainee is further than the trainer's `travelRadiusMiles`, the
        # trainer is hidden — a trainer who only wants to travel 5 mi should
        # never be shown to a trainee 12 mi away. Default 10 mi mirrors the
        # schema default in TrainerProfile.travelRadiusMiles.
        trainer_radius = trainer.get('travelRadiusMiles')
        if trainer_radius is None:
            trainer_radius = 10
        if distance > trainer_radius:
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
            'userId': trainer['userId'],
            'fullName': full_name,
            'avatarUrl': trainer.get('avatarUrl'),
            # iter98d (Task 7): expose richer fields so the swipe-discover screen
            # can render full profiles without a 2nd round-trip per card.
            'profilePhoto': trainer.get('profilePhoto') or trainer.get('avatarUrl'),
            'accentColor': trainer.get('accentColor'),
            'accentColorAuto': trainer.get('accentColorAuto'),
            'personalityTag': trainer.get('personalityTag'),
            'vibeTrackTitle': trainer.get('vibeTrackTitle'),
            'vibeArtistName': trainer.get('vibeArtistName'),
            'vibePreviewUrl': trainer.get('vibePreviewUrl'),
            'vibeTrackId': trainer.get('vibeTrackId'),
            'vibeArtworkUrl': trainer.get('vibeArtworkUrl'),
            'specialties': trainer.get('specialties') or trainer.get('trainingStyles') or [],
            'outdoor60Cents': trainer.get('outdoor60Cents'),
            'outdoorRateCents': trainer.get('outdoorRateCents'),
            'rating': trainer.get('averageRating', 0.0),
            'totalSessions': trainer.get('totalSessionsCompleted', 0),
            # Convenience aliases used by the swipe-discover card
            'distance': round(distance, 1),
            # Existing fields preserved for the map view
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
            'totalSessionsCompleted': trainer.get('totalSessionsCompleted', 0),
            # iter102g: ship a small slice of highlight media + intro video so
            # the swipe-discover card can show a true full-profile preview.
            'highlights': (trainer.get('highlights') or [])[:6],
            'introVideoUrl': trainer.get('introVideoUrl'),
        })
    
    # Sort by distance
    nearby_trainers.sort(key=lambda x: x['distanceMiles'])
    
    return {
        "trainers": nearby_trainers,
        "count": len(nearby_trainers),
        "searchLocation": {"latitude": latitude, "longitude": longitude},
        "radiusMiles": radius_miles
    }

