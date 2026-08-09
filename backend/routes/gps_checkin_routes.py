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
    # iter106av G8: optional device GPS accuracy in meters. When present,
    # backend uses (distance + accuracy) for the radius check and rejects
    # readings above MAX_GPS_ACCURACY_METERS as too noisy to trust.
    accuracy: Optional[float] = None


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

    # iter106av G8: reject noisy GPS. Devices in tunnels/underground gyms
    # can report ±500m accuracy — trusting that would false-positive check-ins.
    MAX_GPS_ACCURACY_METERS = 100
    if checkin.accuracy is not None and checkin.accuracy > MAX_GPS_ACCURACY_METERS:
        raise HTTPException(
            400,
            f"Your GPS signal is too weak (±{int(checkin.accuracy)}m). Move outside or near a window and try again.",
        )

    # Get session location
    session_lat = session.get('locationLatitude') or session.get('traineeLatitude')
    session_lon = session.get('locationLongitude') or session.get('traineeLongitude')

    # Calculate distance
    distance_miles = None
    within_radius = True
    radius_miles = session.get('gpsCheckinRadiusMiles', 5)

    if session_lat and session_lon:
        distance_miles = haversine_miles(checkin.latitude, checkin.longitude, session_lat, session_lon)
        # iter106av G8: bake accuracy into the check. If the device is
        # ±80m sure of its position and we're 79m from the pin, that's a
        # possible miss — treat it as "within" only if (dist + accuracy) ≤ radius.
        effective_distance = distance_miles
        if checkin.accuracy is not None:
            accuracy_miles = checkin.accuracy / 1609.34  # meters → miles
            effective_distance = distance_miles + accuracy_miles
        within_radius = effective_distance <= radius_miles

    # Store check-in
    role_prefix = 'trainer' if is_trainer else 'trainee'
    now_utc = datetime.utcnow()
    update_fields = {
        f'{role_prefix}GpsCheckin': {
            'latitude': checkin.latitude,
            'longitude': checkin.longitude,
            'timestamp': now_utc,
            'distanceMiles': round(distance_miles, 2) if distance_miles else None,
            'withinRadius': within_radius,
        },
        f'{role_prefix}GpsConfirmed': within_radius,
        'updatedAt': now_utc,
    }

    # iter118p (spec #3): trainer lateness telemetry. If the trainer's
    # check-in is >5 min after the scheduled session start, tag the session
    # for admin visibility + trainer scorecards. 15+ min without any check-in
    # is handled by the trainee-side no-show action (see below). Tracked
    # independent of `within_radius` — a late check-in that also lands
    # outside the radius is still a "trainer was late" signal.
    if is_trainer:
        update_fields['trainerCheckedInAt'] = now_utc
        try:
            scheduled = session.get('sessionDateTimeStart')
            if scheduled:
                if isinstance(scheduled, str):
                    scheduled_dt = datetime.fromisoformat(scheduled.replace('Z', '+00:00'))
                    if scheduled_dt.tzinfo is not None:
                        scheduled_dt = scheduled_dt.replace(tzinfo=None)
                else:
                    scheduled_dt = scheduled
                minutes_late = (now_utc - scheduled_dt).total_seconds() / 60.0
                if minutes_late > 5:
                    update_fields['trainerLateCheckIn'] = True
                    update_fields['trainerLateMinutes'] = round(minutes_late, 1)
        except Exception:
            # Never let a datetime edge-case break the check-in flow
            pass

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


# ---------------------------------------------------------------------------
# iter118p (spec #3): trainee-side lateness / no-show action.
# ---------------------------------------------------------------------------
# Symmetric to the trainer's no-show endpoint above, but for the trainee to
# resolve a trainer who is either late (grace period at 15 min) or a no-show
# (30 min without any check-in). Actions:
#   • "wait"   → just note that trainee is still waiting.
#   • "refund" → mark session as NO_SHOW, notes it was trainer-initiated,
#                schedule refund via existing cancellation path, and record a
#                trainer strike (same treatment as trainer-initiated cancel).

@router.post("/sessions/{session_id}/trainee-no-show-action")
async def trainee_no_show_action(session_id: str, body: NoShowActionRequest, current_user: dict = Depends(get_current_user)):
    """Trainee decides what to do when the trainer hasn't checked in yet."""
    user_id = str(current_user['_id'])

    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(404, "Session not found")
    if session['traineeId'] != user_id:
        raise HTTPException(403, "Only the trainee can trigger this")

    if body.action not in ('wait', 'refund'):
        raise HTTPException(400, "Action must be 'wait' or 'refund'")

    # Guard: only allow refund action once the session is genuinely overdue —
    # this prevents impatient trainees pressing the button before the session
    # has even started. 15 min past scheduled start is the earliest allowed.
    if body.action == 'refund':
        scheduled = session.get('sessionDateTimeStart')
        if scheduled:
            if isinstance(scheduled, str):
                try:
                    scheduled_dt = datetime.fromisoformat(scheduled.replace('Z', '+00:00'))
                    if scheduled_dt.tzinfo is not None:
                        scheduled_dt = scheduled_dt.replace(tzinfo=None)
                except Exception:
                    scheduled_dt = None
            else:
                scheduled_dt = scheduled
            if scheduled_dt:
                minutes_since_start = (datetime.utcnow() - scheduled_dt).total_seconds() / 60.0
                if minutes_since_start < 15:
                    raise HTTPException(400, "Please wait until 15 minutes past session start before requesting a no-show refund.")
        # Only cancel if the trainer really hasn't checked in yet
        if session.get('trainerGpsConfirmed'):
            raise HTTPException(400, "Trainer has already checked in — this session is not a no-show.")

    now_utc = datetime.utcnow()
    update = {'updatedAt': now_utc, 'traineeNoShowAction': body.action}
    message = ""

    if body.action == 'wait':
        update['traineeNoShowNotes'] = body.notes or "Trainee is still waiting for trainer"
        message = "Marked as still waiting"
    else:  # refund
        update['status'] = SessionStatus.NO_SHOW
        update['trainerNoShow'] = True
        update['noShowInitiatedBy'] = 'trainee'
        update['traineeNoShowNotes'] = body.notes or "Trainer never arrived; trainee requested cancel + refund"
        update['cancelledAt'] = now_utc
        update['refundPending'] = True
        message = "Session cancelled — full refund pending"

        # Best-effort trainer strike (existing 3-strikes system). Any failure
        # is non-fatal to the refund flow.
        try:
            await db.trainer_profiles.update_one(
                {'userId': session['trainerId']},
                {'$inc': {'noShowStrikes': 1}, '$set': {'updatedAt': now_utc}},
            )
        except Exception:
            pass

        # Notify trainer their strike happened
        try:
            await send_push_notification(
                session['trainerId'],
                "Session Marked No-Show",
                "Trainee cancelled the session because you didn't check in. This affects your reliability score.",
                {'type': 'no_show_trainer_strike', 'sessionId': session_id},
            )
        except Exception:
            pass

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
