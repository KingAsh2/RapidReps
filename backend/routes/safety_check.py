"""
Rapid Reps Safety Check - In-Person Session Verification System
QR-based trainer verification, session timer, and admin tracking
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import secrets
import hashlib

from routes import db, get_current_user, serialize_doc, send_push

router = APIRouter(prefix="/api/safety-check", tags=["Safety Check"])

# ============================================================================
# CONSTANTS
# ============================================================================
TOKEN_EXPIRY_MINUTES = 5
ALLOWED_START_WINDOW_MINUTES = 60


# ============================================================================
# MODELS
# ============================================================================

class VerifyRequest(BaseModel):
    token: str

class AdminOverrideRequest(BaseModel):
    sessionId: str
    reason: str


# ============================================================================
# HELPER: require admin
# ============================================================================
async def require_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("isAdmin") and "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ============================================================================
# 1. GENERATE QR TOKEN (Trainer)
# ============================================================================

@router.post("/generate-token/{session_id}")
async def generate_qr_token(session_id: str, current_user: dict = Depends(get_current_user)):
    """Generate a short-lived QR verification token tied to a session."""
    trainer_id = current_user["id"]

    # Get session
    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify this trainer owns the session
    if session.get("trainerId") != trainer_id:
        raise HTTPException(status_code=403, detail="Not your session")

    # Only for in-person / at-home sessions
    s_type = session.get("sessionType", "outdoor")
    if s_type == "virtual":
        raise HTTPException(status_code=400, detail="Verification not required for virtual sessions")

    # Invalidate any existing tokens for this session
    await db.verification_tokens.update_many(
        {"sessionId": session_id, "used": False},
        {"$set": {"used": True, "invalidatedAt": datetime.now(timezone.utc)}}
    )

    # Generate secure token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=TOKEN_EXPIRY_MINUTES)

    # Get trainee info
    trainee = await db.users.find_one({"_id": ObjectId(session.get("traineeId"))})
    trainee_name = trainee.get("fullName", "Client") if trainee else "Client"

    token_doc = {
        "tokenHash": token_hash,
        "sessionId": session_id,
        "trainerId": trainer_id,
        "traineeId": session.get("traineeId"),
        "traineeName": trainee_name,
        "sessionType": s_type,
        "durationMinutes": session.get("durationMinutes", 60),
        "createdAt": now,
        "expiresAt": expires_at,
        "used": False,
        "usedAt": None,
        "verificationResult": None,
    }
    await db.verification_tokens.insert_one(token_doc)

    return {
        "token": raw_token,
        "expiresAt": expires_at.isoformat(),
        "sessionId": session_id,
        "trainerId": trainer_id,
        "traineeId": session.get("traineeId"),
        "traineeName": trainee_name,
        "sessionType": s_type,
        "durationMinutes": session.get("durationMinutes", 60),
        "status": session.get("verificationStatus", "pending_verification"),
    }


# ============================================================================
# 2. VERIFY QR TOKEN (Client scans trainer badge)
# ============================================================================

@router.post("/verify")
async def verify_trainer(body: VerifyRequest, current_user: dict = Depends(get_current_user)):
    """Client scans trainer's QR code to verify identity and start session."""
    trainee_id = current_user["id"]
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    # Find token
    token_doc = await db.verification_tokens.find_one({"tokenHash": token_hash})
    if not token_doc:
        await _log_verification(None, trainee_id, None, "failed", "Invalid QR code")
        raise HTTPException(status_code=400, detail="Invalid QR code")

    session_id = token_doc["sessionId"]
    trainer_id = token_doc["trainerId"]

    # Check if already used
    if token_doc.get("used"):
        await _log_verification(session_id, trainee_id, trainer_id, "failed", "QR code already used")
        raise HTTPException(status_code=400, detail="QR code already used. Ask trainer to refresh badge.")

    # Check expiry
    expires_at = token_doc["expiresAt"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if now > expires_at:
        await db.verification_tokens.update_one(
            {"_id": token_doc["_id"]}, {"$set": {"used": True, "usedAt": now, "verificationResult": "expired"}}
        )
        await _log_verification(session_id, trainee_id, trainer_id, "failed", "QR code expired")
        raise HTTPException(status_code=400, detail="QR code expired. Ask trainer to refresh badge.")

    # Check trainee matches
    if token_doc["traineeId"] != trainee_id:
        await _log_verification(session_id, trainee_id, trainer_id, "failed", "Trainer not assigned to this booking")
        raise HTTPException(status_code=400, detail="Trainer not assigned to your booking")

    # Get session
    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check session type
    if session.get("sessionType") == "virtual":
        raise HTTPException(status_code=400, detail="Verification not needed for virtual sessions")

    # Check session time window
    session_start = session.get("sessionDateTimeStart")
    if session_start:
        if isinstance(session_start, str):
            session_start = datetime.fromisoformat(session_start.replace("Z", "+00:00"))
        if session_start.tzinfo is None:
            session_start = session_start.replace(tzinfo=timezone.utc)
        window_start = session_start - timedelta(minutes=ALLOWED_START_WINDOW_MINUTES)
        window_end = session_start + timedelta(minutes=ALLOWED_START_WINDOW_MINUTES)
        if not (window_start <= now <= window_end):
            await _log_verification(session_id, trainee_id, trainer_id, "failed", "Session outside allowed start window")
            raise HTTPException(status_code=400, detail="Session outside allowed start window")

    # Check trainer is verified
    trainer = await db.users.find_one({"_id": ObjectId(trainer_id)})
    trainer_profile = await db.trainer_profiles.find_one({"userId": trainer_id})

    if not trainer:
        raise HTTPException(status_code=400, detail="Trainer account not found")

    trainer_name = trainer.get("fullName", "Trainer")
    trainer_photo = trainer_profile.get("profilePhoto") if trainer_profile else None
    trainer_rating = trainer_profile.get("averageRating", 0) if trainer_profile else 0
    is_verified = trainer_profile.get("verified", False) if trainer_profile else False
    bg_checked = trainer_profile.get("backgroundCheckPassed", False) if trainer_profile else False

    # Mark token as used
    await db.verification_tokens.update_one(
        {"_id": token_doc["_id"]},
        {"$set": {"used": True, "usedAt": now, "verificationResult": "success"}}
    )

    # Update session - mark as verified and start timer
    session_started_at = now.isoformat()
    duration = session.get("durationMinutes", 60)
    expected_end = (now + timedelta(minutes=duration)).isoformat()

    verification_id = secrets.token_hex(8)
    await db.sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {
            "verificationStatus": "verified",
            "verificationId": verification_id,
            "verifiedAt": now,
            "sessionStartedAt": now,
            "expectedEndAt": now + timedelta(minutes=duration),
            "timerState": "running",
            "badgeScanned": True,
            "scanTimestamp": now,
            "status": "in_progress",
        }}
    )

    # Log successful verification
    await _log_verification(session_id, trainee_id, trainer_id, "success", "Verification successful", verification_id)

    # Send push to trainer
    await send_push(trainer_id, "Session Verified", f"Your session with {current_user.get('fullName', 'Client')} has been verified. Timer started!")

    return {
        "success": True,
        "message": "Rapid Reps Safety Check Complete - Your trainer has been verified.",
        "trainerName": trainer_name,
        "trainerPhoto": trainer_photo,
        "trainerRating": trainer_rating,
        "isVerified": is_verified,
        "isBackgroundChecked": bg_checked,
        "sessionType": session.get("sessionType"),
        "durationMinutes": duration,
        "sessionId": session_id,
        "verificationId": verification_id,
        "sessionStartedAt": session_started_at,
    }


# ============================================================================
# 3. GET BADGE DATA (Trainer fetches badge info for active session)
# ============================================================================

@router.get("/badge/{session_id}")
async def get_badge_data(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get trainer badge data for a specific session."""
    trainer_id = current_user["id"]

    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.get("trainerId") != trainer_id:
        raise HTTPException(status_code=403, detail="Not your session")

    # Get trainer profile
    trainer_profile = await db.trainer_profiles.find_one({"userId": trainer_id})
    trainee = await db.users.find_one({"_id": ObjectId(session.get("traineeId"))})

    verif_status = session.get("verificationStatus", "pending_verification")

    return {
        "sessionId": session_id,
        "trainerName": current_user.get("fullName", "Trainer"),
        "trainerPhoto": trainer_profile.get("profilePhoto") if trainer_profile else None,
        "trainerRating": trainer_profile.get("averageRating", 0) if trainer_profile else 0,
        "isVerified": trainer_profile.get("verified", False) if trainer_profile else False,
        "isBackgroundChecked": trainer_profile.get("backgroundCheckPassed", False) if trainer_profile else False,
        "isCertified": bool(trainer_profile.get("certifications")) if trainer_profile else False,
        "traineeName": trainee.get("fullName", "Client") if trainee else "Client",
        "sessionType": session.get("sessionType", "outdoor"),
        "durationMinutes": session.get("durationMinutes", 60),
        "verificationStatus": verif_status,
        "sessionStartedAt": session.get("sessionStartedAt").isoformat() if session.get("sessionStartedAt") else None,
        "expectedEndAt": session.get("expectedEndAt").isoformat() if session.get("expectedEndAt") else None,
    }


# ============================================================================
# 4. GET ACTIVE SESSION FOR BADGE (Trainer gets next in-person session)
# ============================================================================

@router.get("/active-session")
async def get_active_badge_session(current_user: dict = Depends(get_current_user)):
    """Get the next upcoming in-person/at-home session for badge display."""
    trainer_id = current_user["id"]
    now = datetime.now(timezone.utc)

    # Find the next upcoming or accepted in-person session
    session = await db.sessions.find_one(
        {
            "trainerId": trainer_id,
            "sessionType": {"$in": ["outdoor", "in_home"]},
            "status": {"$in": ["accepted", "in_progress"]},
        },
        sort=[("sessionDateTimeStart", 1)]
    )

    if not session:
        return {"hasActiveSession": False, "session": None}

    trainee = await db.users.find_one({"_id": ObjectId(session.get("traineeId"))})
    trainer_profile = await db.trainer_profiles.find_one({"userId": trainer_id})

    return {
        "hasActiveSession": True,
        "session": {
            "sessionId": str(session["_id"]),
            "traineeName": trainee.get("fullName", "Client") if trainee else "Client",
            "sessionType": session.get("sessionType", "outdoor"),
            "durationMinutes": session.get("durationMinutes", 60),
            "sessionDateTimeStart": session.get("sessionDateTimeStart").isoformat() if session.get("sessionDateTimeStart") else None,
            "verificationStatus": session.get("verificationStatus", "pending_verification"),
            "status": session.get("status"),
        },
        "trainerName": current_user.get("fullName", "Trainer"),
        "trainerPhoto": trainer_profile.get("profilePhoto") if trainer_profile else None,
        "trainerRating": trainer_profile.get("averageRating", 0) if trainer_profile else 0,
        "isVerified": trainer_profile.get("verified", False) if trainer_profile else False,
        "isBackgroundChecked": trainer_profile.get("backgroundCheckPassed", False) if trainer_profile else False,
        "isCertified": bool(trainer_profile.get("certifications")) if trainer_profile else False,
    }


# ============================================================================
# 5. SESSION TIMER ENDPOINTS
# ============================================================================

@router.get("/timer/{session_id}")
async def get_timer_status(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get current timer state for a session."""
    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_id = current_user["id"]
    if session.get("trainerId") != user_id and session.get("traineeId") != user_id:
        raise HTTPException(status_code=403, detail="Not your session")

    now = datetime.now(timezone.utc)
    verification_status = session.get("verificationStatus", "pending_verification")
    timer_state = session.get("timerState", "locked")
    started_at = session.get("sessionStartedAt")
    expected_end = session.get("expectedEndAt")
    actual_end = session.get("sessionEndedAt")

    remaining_seconds = None
    elapsed_seconds = None
    if started_at and not actual_end:
        if isinstance(started_at, str):
            started_at = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        elapsed_seconds = int((now - started_at).total_seconds())
        total_seconds = session.get("durationMinutes", 60) * 60
        remaining_seconds = max(0, total_seconds - elapsed_seconds)

    return {
        "sessionId": session_id,
        "verificationStatus": verification_status,
        "timerState": timer_state,
        "durationMinutes": session.get("durationMinutes", 60),
        "sessionStartedAt": started_at.isoformat() if isinstance(started_at, datetime) else started_at,
        "expectedEndAt": expected_end.isoformat() if isinstance(expected_end, datetime) else expected_end,
        "actualEndAt": actual_end.isoformat() if isinstance(actual_end, datetime) else actual_end,
        "elapsedSeconds": elapsed_seconds,
        "remainingSeconds": remaining_seconds,
        "isLocked": verification_status != "verified",
    }


@router.post("/timer/{session_id}/complete")
async def complete_session_timer(session_id: str, current_user: dict = Depends(get_current_user)):
    """Mark session timer as completed."""
    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.get("trainerId") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only trainer can complete session")

    if session.get("verificationStatus") != "verified":
        raise HTTPException(status_code=400, detail="Session not verified yet")

    now = datetime.now(timezone.utc)
    await db.sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {
            "timerState": "completed",
            "sessionEndedAt": now,
            "status": "completed",
        }}
    )

    # Log completion
    await db.verification_logs.insert_one({
        "sessionId": session_id,
        "action": "session_completed",
        "trainerId": session.get("trainerId"),
        "traineeId": session.get("traineeId"),
        "timestamp": now,
        "bookedDuration": session.get("durationMinutes", 60),
        "startedAt": session.get("sessionStartedAt"),
        "completedAt": now,
    })

    return {"success": True, "message": "Session completed", "actualEndAt": now.isoformat()}


# ============================================================================
# 6. ADMIN ENDPOINTS
# ============================================================================

@router.get("/admin/active-sessions")
async def admin_active_sessions(admin_user: dict = Depends(require_admin)):
    """Get all currently running verified sessions with remaining time."""
    now = datetime.now(timezone.utc)
    sessions = await db.sessions.find({
        "timerState": "running",
        "verificationStatus": "verified",
    }).to_list(200)

    results = []
    for s in sessions:
        started_at = s.get("sessionStartedAt")
        if started_at:
            if isinstance(started_at, str):
                started_at = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            if started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=timezone.utc)
            total_secs = s.get("durationMinutes", 60) * 60
            elapsed = int((now - started_at).total_seconds())
            remaining = max(0, total_secs - elapsed)
        else:
            elapsed = 0
            remaining = s.get("durationMinutes", 60) * 60

        # Get names
        trainer = await db.users.find_one({"_id": ObjectId(s.get("trainerId"))}, {"fullName": 1})
        trainee = await db.users.find_one({"_id": ObjectId(s.get("traineeId"))}, {"fullName": 1})

        results.append({
            "sessionId": str(s["_id"]),
            "bookingType": s.get("sessionType"),
            "trainerName": trainer.get("fullName") if trainer else "Unknown",
            "trainerId": s.get("trainerId"),
            "traineeName": trainee.get("fullName") if trainee else "Unknown",
            "traineeId": s.get("traineeId"),
            "bookedDuration": s.get("durationMinutes", 60),
            "sessionStartedAt": s.get("sessionStartedAt").isoformat() if isinstance(s.get("sessionStartedAt"), datetime) else s.get("sessionStartedAt"),
            "expectedEndAt": s.get("expectedEndAt").isoformat() if isinstance(s.get("expectedEndAt"), datetime) else s.get("expectedEndAt"),
            "elapsedSeconds": elapsed,
            "remainingSeconds": remaining,
            "timerState": s.get("timerState", "locked"),
            "verificationId": s.get("verificationId"),
        })

    return {"activeSessions": results, "count": len(results)}


@router.get("/admin/verification-log")
async def admin_verification_log(
    limit: int = Query(50, le=200),
    skip: int = Query(0),
    admin_user: dict = Depends(require_admin)
):
    """Get all badge scan attempts and results."""
    logs = await db.verification_logs.find().sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.verification_logs.count_documents({})
    return {
        "logs": [serialize_doc(l) for l in logs],
        "total": total,
        "limit": limit,
        "skip": skip,
    }


@router.get("/admin/safety-events")
async def admin_safety_events(
    limit: int = Query(50, le=200),
    admin_user: dict = Depends(require_admin)
):
    """Get failed scans, reports, emergency triggers, and overrides."""
    events = await db.verification_logs.find({
        "result": {"$in": ["failed", "override"]}
    }).sort("timestamp", -1).limit(limit).to_list(limit)

    overrides = await db.admin_overrides.find().sort("timestamp", -1).limit(limit).to_list(limit)

    return {
        "failedVerifications": [serialize_doc(e) for e in events],
        "overrides": [serialize_doc(o) for o in overrides],
    }


@router.get("/admin/duration-tracking")
async def admin_duration_tracking(
    limit: int = Query(50, le=200),
    admin_user: dict = Depends(require_admin)
):
    """Show booked duration vs actual duration for completed sessions."""
    sessions = await db.sessions.find({
        "verificationStatus": "verified",
        "sessionEndedAt": {"$exists": True},
    }).sort("sessionEndedAt", -1).limit(limit).to_list(limit)

    results = []
    for s in sessions:
        started = s.get("sessionStartedAt")
        ended = s.get("sessionEndedAt")
        actual_minutes = None
        if started and ended:
            if isinstance(started, str):
                started = datetime.fromisoformat(started.replace("Z", "+00:00"))
            if isinstance(ended, str):
                ended = datetime.fromisoformat(ended.replace("Z", "+00:00"))
            actual_minutes = round((ended - started).total_seconds() / 60, 1)

        trainer = await db.users.find_one({"_id": ObjectId(s.get("trainerId"))}, {"fullName": 1})
        trainee = await db.users.find_one({"_id": ObjectId(s.get("traineeId"))}, {"fullName": 1})

        results.append({
            "sessionId": str(s["_id"]),
            "trainerName": trainer.get("fullName") if trainer else "Unknown",
            "traineeName": trainee.get("fullName") if trainee else "Unknown",
            "bookingType": s.get("sessionType"),
            "bookedDuration": s.get("durationMinutes", 60),
            "actualDuration": actual_minutes,
            "difference": round(actual_minutes - s.get("durationMinutes", 60), 1) if actual_minutes else None,
            "sessionStartedAt": s.get("sessionStartedAt").isoformat() if isinstance(s.get("sessionStartedAt"), datetime) else s.get("sessionStartedAt"),
            "sessionEndedAt": s.get("sessionEndedAt").isoformat() if isinstance(s.get("sessionEndedAt"), datetime) else s.get("sessionEndedAt"),
        })

    return {"sessions": results, "count": len(results)}


@router.post("/admin/override")
async def admin_override_verification(body: AdminOverrideRequest, admin_user: dict = Depends(require_admin)):
    """Admin manually overrides verification for a session."""
    session = await db.sessions.find_one({"_id": ObjectId(body.sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc)
    duration = session.get("durationMinutes", 60)

    await db.sessions.update_one(
        {"_id": ObjectId(body.sessionId)},
        {"$set": {
            "verificationStatus": "verified",
            "verifiedAt": now,
            "sessionStartedAt": now,
            "expectedEndAt": now + timedelta(minutes=duration),
            "timerState": "running",
            "badgeScanned": False,
            "adminOverride": True,
            "adminOverrideBy": admin_user["id"],
            "adminOverrideAt": now,
            "adminOverrideReason": body.reason,
            "status": "in_progress",
        }}
    )

    # Log override
    await db.admin_overrides.insert_one({
        "sessionId": body.sessionId,
        "adminId": admin_user["id"],
        "adminName": admin_user.get("fullName", "Admin"),
        "reason": body.reason,
        "timestamp": now,
        "trainerId": session.get("trainerId"),
        "traineeId": session.get("traineeId"),
    })

    await _log_verification(body.sessionId, session.get("traineeId"), session.get("trainerId"), "override", f"Admin override: {body.reason}")

    return {"success": True, "message": "Session verification overridden by admin"}


# ============================================================================
# 7. BLOCKING CHECK (Can trainer start session?)
# ============================================================================

@router.get("/can-start/{session_id}")
async def can_start_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Check if a session can be started (verification required for in-person)."""
    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    s_type = session.get("sessionType", "outdoor")
    if s_type == "virtual":
        return {"canStart": True, "requiresVerification": False, "reason": "Virtual sessions don't require verification"}

    verification_status = session.get("verificationStatus", "pending_verification")
    can_start = verification_status == "verified" or session.get("adminOverride", False)

    return {
        "canStart": can_start,
        "requiresVerification": True,
        "verificationStatus": verification_status,
        "reason": "Verification complete" if can_start else "Rapid Reps Safety Check required before starting session",
    }


# ============================================================================
# HELPER: Log verification events
# ============================================================================

async def _log_verification(session_id, trainee_id, trainer_id, result, reason, verification_id=None):
    """Log a verification attempt to the database."""
    await db.verification_logs.insert_one({
        "sessionId": session_id,
        "traineeId": trainee_id,
        "trainerId": trainer_id,
        "result": result,
        "reason": reason,
        "verificationId": verification_id,
        "timestamp": datetime.now(timezone.utc),
        "action": "badge_scan",
    })
