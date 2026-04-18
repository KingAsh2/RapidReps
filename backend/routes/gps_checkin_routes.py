"""GPS Check-in routes: Live location verification for sessions."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from bson import ObjectId
import math

from deps import db, get_current_user, send_push_notification
from models import SessionStatus

router = APIRouter(prefix="/api")


# ============================================================================
# MODELS
# ============================================================================

class GpsCheckinRequest(BaseModel):
    latitude: float
    longitude: float


class GpsRadiusUpdate(BaseModel):
    radiusMiles: float  # 1-35 miles


class NoShowActionRequest(BaseModel):
    action: str  # "cancel", "wait", "proceed"
    notes: Optional[str] = None


# ============================================================================
# HELPER
# ============================================================================

def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in miles between two GPS coordinates."""
    R = 3959  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return R * c


# ============================================================================
# GPS CHECK-IN ENDPOINTS
# ============================================================================

@router.post("/sessions/{session_id}/gps-checkin")
async def gps_checkin(session_id: str, checkin: GpsCheckinRequest, current_user: dict = Depends(get_current_user)):
    """
    Both trainee and trainer check in with GPS when arriving at session location.
    Validates they are within the configured radius of the session location.
    """
    user_id = str(current_user['_id'])

    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(404, "Session not found")

    # Determine role
    is_trainer = session['trainerId'] == user_id
    is_trainee = session['traineeId'] == user_id
    if not is_trainer and not is_trainee:
        raise HTTPException(403, "Not a participant in this session")

    # Session must be confirmed or en_route
    if session['status'] not in [SessionStatus.CONFIRMED, SessionStatus.EN_ROUTE, SessionStatus.IN_PROGRESS]:
        raise HTTPException(400, f"Cannot check in to session with status '{session['status']}'")

    # Get session location
    session_lat = session.get('locationLatitude') or session.get('traineeLatitude')
    session_lon = session.get('locationLongitude') or session.get('traineeLongitude')

    # Calculate distance
    distance_miles = None
    within_radius = True
    radius_miles = session.get('gpsCheckinRadiusMiles', 5)

    if session_lat and session_lon:
        distance_miles = haversine_miles(checkin.latitude, checkin.longitude, session_lat, session_lon)
        within_radius = distance_miles <= radius_miles

    # Store check-in
    role_prefix = 'trainer' if is_trainer else 'trainee'
    update_fields = {
        f'{role_prefix}GpsCheckin': {
            'latitude': checkin.latitude,
            'longitude': checkin.longitude,
            'timestamp': datetime.utcnow(),
            'distanceMiles': round(distance_miles, 2) if distance_miles else None,
            'withinRadius': within_radius,
        },
        f'{role_prefix}GpsConfirmed': within_radius,
        'updatedAt': datetime.utcnow(),
    }

    await db.sessions.update_one({'_id': ObjectId(session_id)}, {'$set': update_fields})

    # Check if both parties have checked in
    updated_session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    trainer_confirmed = updated_session.get('trainerGpsConfirmed', False)
    trainee_confirmed = updated_session.get('traineeGpsConfirmed', False)
    both_confirmed = trainer_confirmed and trainee_confirmed

    # Notify the other party
    other_id = session['traineeId'] if is_trainer else session['trainerId']
    role_name = "Trainer" if is_trainer else "Trainee"

    if within_radius:
        await send_push_notification(
            other_id,
            f"{role_name} Has Arrived!",
            f"Your {role_name.lower()} checked in at the session location.",
            {'type': 'gps_checkin', 'sessionId': session_id}
        )
    else:
        await send_push_notification(
            other_id,
            f"{role_name} Check-in Warning",
            f"Your {role_name.lower()} checked in but is {round(distance_miles, 1) if distance_miles else '?'} miles away.",
            {'type': 'gps_checkin_warning', 'sessionId': session_id}
        )

    return {
        "success": True,
        "withinRadius": within_radius,
        "distanceMiles": round(distance_miles, 2) if distance_miles else None,
        "radiusLimitMiles": radius_miles,
        "role": role_prefix,
        "bothPartiesConfirmed": both_confirmed,
        "trainerConfirmed": trainer_confirmed if is_trainee else within_radius,
        "traineeConfirmed": trainee_confirmed if is_trainer else within_radius,
    }


@router.get("/sessions/{session_id}/checkin-status")
async def get_checkin_status(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get GPS check-in status for both parties."""
    user_id = str(current_user['_id'])

    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(404, "Session not found")
    if session['trainerId'] != user_id and session['traineeId'] != user_id:
        raise HTTPException(403, "Not a participant")

    return {
        "sessionId": session_id,
        "trainerCheckin": session.get('trainerGpsCheckin'),
        "traineeCheckin": session.get('traineeGpsCheckin'),
        "trainerConfirmed": session.get('trainerGpsConfirmed', False),
        "traineeConfirmed": session.get('traineeGpsConfirmed', False),
        "bothConfirmed": session.get('trainerGpsConfirmed', False) and session.get('traineeGpsConfirmed', False),
        "radiusMiles": session.get('gpsCheckinRadiusMiles', 5),
    }


@router.put("/sessions/{session_id}/gps-radius")
async def update_gps_radius(session_id: str, body: GpsRadiusUpdate, current_user: dict = Depends(get_current_user)):
    """Trainer sets the GPS check-in radius for a session (1-35 miles)."""
    user_id = str(current_user['_id'])

    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(404, "Session not found")
    if session['trainerId'] != user_id:
        raise HTTPException(403, "Only the trainer can set GPS radius")

    if body.radiusMiles < 1 or body.radiusMiles > 35:
        raise HTTPException(400, "Radius must be between 1 and 35 miles")

    await db.sessions.update_one(
        {'_id': ObjectId(session_id)},
        {'$set': {'gpsCheckinRadiusMiles': body.radiusMiles, 'updatedAt': datetime.utcnow()}}
    )

    return {"success": True, "radiusMiles": body.radiusMiles}


@router.post("/sessions/{session_id}/no-show-action")
async def trainer_no_show_action(session_id: str, body: NoShowActionRequest, current_user: dict = Depends(get_current_user)):
    """Trainer decides what to do when trainee doesn't check in: cancel, wait, or proceed."""
    user_id = str(current_user['_id'])

    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(404, "Session not found")
    if session['trainerId'] != user_id:
        raise HTTPException(403, "Only the trainer can decide on no-shows")

    if body.action not in ('cancel', 'wait', 'proceed'):
        raise HTTPException(400, "Action must be 'cancel', 'wait', or 'proceed'")

    update = {'updatedAt': datetime.utcnow(), 'noShowAction': body.action}

    if body.action == 'cancel':
        update['status'] = SessionStatus.NO_SHOW
        update['noShowNotes'] = body.notes
        update['cancelledAt'] = datetime.utcnow()
        message = "Session marked as no-show and cancelled"

        await send_push_notification(
            session['traineeId'],
            "Session Cancelled - No Show",
            "Your trainer cancelled the session because you didn't check in.",
            {'type': 'no_show', 'sessionId': session_id}
        )

    elif body.action == 'wait':
        update['noShowNotes'] = body.notes or "Trainer is waiting"
        message = "Waiting for trainee"

    elif body.action == 'proceed':
        update['status'] = SessionStatus.IN_PROGRESS
        update['noShowNotes'] = body.notes or "Proceeding without GPS confirmation"
        update['startedAt'] = datetime.utcnow()
        message = "Session started without GPS confirmation"

        await send_push_notification(
            session['traineeId'],
            "Session Started",
            "Your trainer has started the session.",
            {'type': 'session_started', 'sessionId': session_id}
        )

    await db.sessions.update_one({'_id': ObjectId(session_id)}, {'$set': update})

    return {"success": True, "action": body.action, "message": message}


@router.put("/sessions/{session_id}/location")
async def set_session_location(session_id: str, body: GpsCheckinRequest, current_user: dict = Depends(get_current_user)):
    """Set/update the GPS location for a session (trainer or trainee who booked)."""
    user_id = str(current_user['_id'])

    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(404, "Session not found")
    if session['trainerId'] != user_id and session['traineeId'] != user_id:
        raise HTTPException(403, "Not a participant")

    await db.sessions.update_one(
        {'_id': ObjectId(session_id)},
        {'$set': {
            'locationLatitude': body.latitude,
            'locationLongitude': body.longitude,
            'updatedAt': datetime.utcnow(),
        }}
    )

    return {"success": True, "latitude": body.latitude, "longitude": body.longitude}
