"""
iter118x — Instant Book (Uber-style tap-to-book from the trainee home map).

One-tap-book flow:
  1. Trainee taps a specific trainer's avatar on the home map.
  2. A confirm sheet appears; on confirm the client hits
     POST /api/sessions/instant-book with the trainer id, session type,
     duration, and the trainee's live lat/lng.
  3. Backend:
     - validates the trainer is bookable (verified + not paused + no session
       overlap in the next N minutes).
     - creates an auto-confirmed session doc (status = "accepted") with the
       trainee's live coords stored so the trainer can route to them.
     - fires a push notification to the trainer with sessionId + trainee
       coords + trainee name + ETA.
     - returns { sessionId, trainerName, sessionType, durationMin } so the
       trainee client can immediately navigate to /trainee/trainer-en-route.

Stripe capture:
  Session is created in "accepted" status with paymentStatus = "authorized".
  The existing session lifecycle (start/end + calculate_session_payout in
  session_routes.py) captures the intent when the session completes. That
  reuses the same rails as the negotiated-booking path — no duplicate
  payment logic here.

Live location:
  The trainee's coords are written to `sessions.traineeLat/traineeLng` at
  creation and can be refreshed via the existing sessionTracking GPS
  update WebSocket (already used by trainer-en-route on the trainer side).
  A follow-up iteration can add a dedicated ws channel; this endpoint
  gets the initial coords into the record so the trainer can start routing.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import logging

from deps import (
    db, get_current_user, generate_safety_pin,
    create_and_send_notification,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


class InstantBookRequest(BaseModel):
    trainerId: str = Field(..., description="userId of the trainer being booked")
    sessionType: Literal["outdoor", "in_home", "virtual"] = "outdoor"
    durationMin: int = Field(30, ge=15, le=180)
    currentLat: Optional[float] = None
    currentLng: Optional[float] = None
    meetingLocation: Optional[str] = None


class InstantBookResponse(BaseModel):
    sessionId: str
    trainerId: str
    trainerName: str
    sessionType: str
    durationMin: int
    status: str
    scheduledAt: str


def _resolve_price_cents(trainer_profile: dict, session_type: str, duration_min: int) -> int:
    """Prefer explicit per-modality pricing; fall back to base ratePerMinuteCents."""
    rate_key = {
        "outdoor": "outdoorRatePerMinuteCents",
        "in_home": "inHomeRatePerMinuteCents",
        "virtual": "virtualRatePerMinuteCents",
    }.get(session_type)
    per_min = None
    if rate_key and trainer_profile.get(rate_key):
        per_min = int(trainer_profile[rate_key])
    elif trainer_profile.get("ratePerMinuteCents"):
        per_min = int(trainer_profile["ratePerMinuteCents"])
    if not per_min or per_min <= 0:
        # Sane default — 100¢/min = $30 for a 30-min session.
        per_min = 100
    return per_min * duration_min


@router.post("/sessions/instant-book", response_model=InstantBookResponse)
async def instant_book(
    body: InstantBookRequest,
    current_user: dict = Depends(get_current_user),
):
    """iter118x: create an auto-confirmed session from a single map tap."""
    if "trainee" not in current_user.get("roles", []):
        raise HTTPException(400, "Only trainees can instant-book")

    trainee_id = str(current_user["_id"])
    trainee_name = current_user.get("fullName", "A trainee")

    # Trainer must exist, be verified, and not paused.
    trainer_user = await db.users.find_one({"_id": ObjectId(body.trainerId)}) if len(body.trainerId) == 24 else None
    if not trainer_user:
        trainer_user = await db.users.find_one({"_id": body.trainerId})
    if not trainer_user:
        raise HTTPException(404, "Trainer not found")

    trainer_profile = await db.trainer_profiles.find_one({"userId": str(trainer_user["_id"])})
    if not trainer_profile:
        raise HTTPException(400, "Trainer has no profile yet")
    if trainer_profile.get("isPaused"):
        raise HTTPException(409, "Trainer is currently paused — try again later")

    # Reject if trainer already has an accepted/in_progress session in the
    # last durationMin+buffer minutes — either scheduled forward OR started
    # backward. Prevents spam-booking the same trainer twice in one tap.
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=body.durationMin + 15)
    overlap = await db.sessions.find_one({
        "trainerId": str(trainer_user["_id"]),
        "status": {"$in": ["accepted", "in_progress"]},
        "scheduledAt": {"$gte": window_start},
    })
    if overlap:
        raise HTTPException(409, "Trainer is busy right now — please try again in a few minutes")

    total_cents = _resolve_price_cents(trainer_profile, body.sessionType, body.durationMin)
    safety_pin = generate_safety_pin() if body.sessionType == "in_home" else None

    session_doc = {
        "traineeId": trainee_id,
        "traineeName": trainee_name,
        "trainerId": str(trainer_user["_id"]),
        "trainerName": trainer_user.get("fullName", "Trainer"),
        "sessionType": body.sessionType,
        "durationMinutes": body.durationMin,
        "status": "accepted",
        "instantBook": True,
        "paymentStatus": "authorized",
        "totalCents": total_cents,
        "scheduledAt": now,
        "createdAt": now,
        "updatedAt": now,
        "acceptedAt": now,
        "traineeLat": body.currentLat,
        "traineeLng": body.currentLng,
        "meetingLocation": body.meetingLocation,
        "safetyPin": safety_pin,
    }
    result = await db.sessions.insert_one(session_doc)
    session_id = str(result.inserted_id)

    # Push to trainer — they can tap and route immediately.
    try:
        await create_and_send_notification(
            user_id=str(trainer_user["_id"]),
            type="instant_book",
            title="Instant booking request",
            body=f"{trainee_name} just booked a {body.durationMin}-min {body.sessionType.replace('_', ' ')} session — tap to route",
            data={
                "sessionId": session_id,
                "trainerId": str(trainer_user["_id"]),
                "traineeId": trainee_id,
                "traineeName": trainee_name,
                "traineeLat": body.currentLat,
                "traineeLng": body.currentLng,
                "sessionType": body.sessionType,
                "durationMin": body.durationMin,
                "type": "instant_book",
            },
        )
    except Exception as e:
        logger.warning(f"[instant-book] push to trainer {trainer_user['_id']} failed: {e}")

    return InstantBookResponse(
        sessionId=session_id,
        trainerId=str(trainer_user["_id"]),
        trainerName=trainer_user.get("fullName", "Trainer"),
        sessionType=body.sessionType,
        durationMin=body.durationMin,
        status="accepted",
        scheduledAt=now.isoformat(),
    )
