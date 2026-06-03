"""
RapidReps Session Negotiation State Machine (iter93).

Both parties (trainee + trainer) must agree on time + location (or time-only
for virtual) BEFORE payment is unlocked.

Lifecycle:
    proposed_by_trainee  ──┐
    proposed_by_trainer  ──┤    (counter resets back to proposed_by_X)
            │              │
            ▼              ▼
        counter_offer ─────┘
            │
            ▼
       agreed (mutual)  → payment unlocked
            │
            ▼
       paid → confirmed
            │
            ▼  (after session date)
       in_progress → completed | no_show | disputed | cancelled

Auto-expiry: any proposal/counter older than 1h with no response → expired.

Endpoints (all under /api/sessions/{id}/negotiation):
    POST  propose            { proposedTime, proposedLocation? }
    POST  counter            { proposedTime, proposedLocation? }
    POST  accept             {}
    POST  reject             { reason? }
    GET   timeline           returns full negotiation history

Permissions: only trainee + trainer assigned to the session may negotiate.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from bson import ObjectId

from deps import db, get_current_user


router = APIRouter(prefix="/sessions", tags=["negotiation"])


# ── Constants ─────────────────────────────────────────────────────────
NEGOTIATION_TIMEOUT_MINUTES = 60  # 1 hour inactivity → auto-expire

NEG_STATUS_PROPOSED_BY_TRAINEE = "proposed_by_trainee"
NEG_STATUS_PROPOSED_BY_TRAINER = "proposed_by_trainer"
NEG_STATUS_COUNTERED_BY_TRAINEE = "countered_by_trainee"
NEG_STATUS_COUNTERED_BY_TRAINER = "countered_by_trainer"
NEG_STATUS_AGREED = "agreed"
NEG_STATUS_REJECTED = "rejected"
NEG_STATUS_EXPIRED = "expired"

PENDING_STATUSES = {
    NEG_STATUS_PROPOSED_BY_TRAINEE,
    NEG_STATUS_PROPOSED_BY_TRAINER,
    NEG_STATUS_COUNTERED_BY_TRAINEE,
    NEG_STATUS_COUNTERED_BY_TRAINER,
}


# ── Models ────────────────────────────────────────────────────────────
class ProposalLocation(BaseModel):
    address: str = Field(..., max_length=300)
    lat: Optional[float] = None
    lng: Optional[float] = None


class ProposeRequest(BaseModel):
    proposedTime: datetime  # ISO timestamp
    proposedLocation: Optional[ProposalLocation] = None  # required for in-person


class RejectRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=300)


# ── Helpers ───────────────────────────────────────────────────────────
def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_oid(session_id: str) -> ObjectId:
    try:
        return ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session id.")


async def _load_session(session_oid: ObjectId, user_id: str) -> dict:
    session = await db.sessions.find_one({"_id": session_oid})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if user_id != session.get("traineeId") and user_id != session.get("trainerId"):
        raise HTTPException(status_code=403, detail="You are not a participant in this session.")
    return session


def _user_role(session: dict, user_id: str) -> str:
    if session.get("traineeId") == user_id:
        return "trainee"
    return "trainer"


def _maybe_expire(session: dict) -> Optional[dict]:
    """Mutates the session dict in-memory & DB if proposal has lapsed."""
    status = session.get("negotiationStatus")
    if status not in PENDING_STATUSES:
        return None
    last = session.get("negotiationLastUpdatedAt")
    if not last:
        return None
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    if _utcnow() - last > timedelta(minutes=NEGOTIATION_TIMEOUT_MINUTES):
        return {"negotiationStatus": NEG_STATUS_EXPIRED, "negotiationExpiredAt": _utcnow()}
    return None


# ── POST /sessions/{id}/negotiation/propose ───────────────────────────
@router.post("/{session_id}/negotiation/propose")
async def propose(session_id: str, req: ProposeRequest, current_user: dict = Depends(get_current_user)):
    """First proposal — only valid if no proposal yet OR previous was rejected/expired."""
    oid = _ensure_oid(session_id)
    user_id = str(current_user["_id"])
    session = await _load_session(oid, user_id)

    current_status = session.get("negotiationStatus")
    if current_status == NEG_STATUS_AGREED:
        raise HTTPException(status_code=400, detail="Already agreed. Use a fresh session to re-propose.")
    if current_status in PENDING_STATUSES:
        raise HTTPException(status_code=400, detail="A proposal is already pending — use counter or accept.")

    role = _user_role(session, user_id)
    is_virtual = session.get("sessionType") == "virtual" or session.get("modality") == "virtual"
    if not is_virtual and not req.proposedLocation:
        raise HTTPException(status_code=400, detail="In-person sessions require a proposed location.")

    new_status = NEG_STATUS_PROPOSED_BY_TRAINEE if role == "trainee" else NEG_STATUS_PROPOSED_BY_TRAINER
    entry = {
        "type": "proposal",
        "by": role,
        "byUserId": user_id,
        "proposedTime": req.proposedTime,
        "proposedLocation": req.proposedLocation.dict() if req.proposedLocation else None,
        "at": _utcnow(),
    }
    await db.sessions.update_one(
        {"_id": oid},
        {
            "$set": {
                "negotiationStatus": new_status,
                "negotiationLastUpdatedAt": _utcnow(),
                "proposedTime": req.proposedTime,
                "proposedLocation": req.proposedLocation.dict() if req.proposedLocation else None,
            },
            "$push": {"negotiationTimeline": entry},
        },
    )
    return {"success": True, "status": new_status, "timelineEntry": entry}


# ── POST /sessions/{id}/negotiation/counter ───────────────────────────
@router.post("/{session_id}/negotiation/counter")
async def counter(session_id: str, req: ProposeRequest, current_user: dict = Depends(get_current_user)):
    """Counter-offer the existing proposal."""
    oid = _ensure_oid(session_id)
    user_id = str(current_user["_id"])
    session = await _load_session(oid, user_id)

    expired = _maybe_expire(session)
    if expired:
        await db.sessions.update_one({"_id": oid}, {"$set": expired})
        raise HTTPException(status_code=400, detail="The previous proposal expired. Start a new one.")

    current_status = session.get("negotiationStatus")
    if current_status not in PENDING_STATUSES:
        raise HTTPException(status_code=400, detail="No pending proposal to counter.")

    role = _user_role(session, user_id)
    # Counter must come from the OPPOSITE party of the last proposer
    last_was_trainee = current_status in (NEG_STATUS_PROPOSED_BY_TRAINEE, NEG_STATUS_COUNTERED_BY_TRAINEE)
    if role == "trainee" and last_was_trainee:
        raise HTTPException(status_code=400, detail="You proposed last — wait for the trainer to respond.")
    if role == "trainer" and not last_was_trainee:
        raise HTTPException(status_code=400, detail="You proposed last — wait for the trainee to respond.")

    is_virtual = session.get("sessionType") == "virtual" or session.get("modality") == "virtual"
    if not is_virtual and not req.proposedLocation:
        raise HTTPException(status_code=400, detail="In-person sessions require a counter location.")

    new_status = NEG_STATUS_COUNTERED_BY_TRAINEE if role == "trainee" else NEG_STATUS_COUNTERED_BY_TRAINER
    entry = {
        "type": "counter",
        "by": role,
        "byUserId": user_id,
        "proposedTime": req.proposedTime,
        "proposedLocation": req.proposedLocation.dict() if req.proposedLocation else None,
        "at": _utcnow(),
    }
    await db.sessions.update_one(
        {"_id": oid},
        {
            "$set": {
                "negotiationStatus": new_status,
                "negotiationLastUpdatedAt": _utcnow(),
                "proposedTime": req.proposedTime,
                "proposedLocation": req.proposedLocation.dict() if req.proposedLocation else None,
            },
            "$push": {"negotiationTimeline": entry},
        },
    )
    return {"success": True, "status": new_status, "timelineEntry": entry}


# ── POST /sessions/{id}/negotiation/accept ────────────────────────────
@router.post("/{session_id}/negotiation/accept")
async def accept(session_id: str, current_user: dict = Depends(get_current_user)):
    """Accept the latest proposal — locks in the agreed time/location and unlocks payment."""
    oid = _ensure_oid(session_id)
    user_id = str(current_user["_id"])
    session = await _load_session(oid, user_id)

    expired = _maybe_expire(session)
    if expired:
        await db.sessions.update_one({"_id": oid}, {"$set": expired})
        raise HTTPException(status_code=400, detail="The proposal expired before you accepted.")

    current_status = session.get("negotiationStatus")
    if current_status not in PENDING_STATUSES:
        raise HTTPException(status_code=400, detail="No pending proposal to accept.")

    role = _user_role(session, user_id)
    last_was_trainee = current_status in (NEG_STATUS_PROPOSED_BY_TRAINEE, NEG_STATUS_COUNTERED_BY_TRAINEE)
    if role == "trainee" and last_was_trainee:
        raise HTTPException(status_code=400, detail="You proposed last — wait for the trainer to accept it.")
    if role == "trainer" and not last_was_trainee:
        raise HTTPException(status_code=400, detail="You proposed last — wait for the trainee to accept it.")

    entry = {"type": "accept", "by": role, "byUserId": user_id, "at": _utcnow()}
    await db.sessions.update_one(
        {"_id": oid},
        {
            "$set": {
                "negotiationStatus": NEG_STATUS_AGREED,
                "negotiationAgreedAt": _utcnow(),
                "negotiationLastUpdatedAt": _utcnow(),
                "agreedTime": session.get("proposedTime"),
                "agreedLocation": session.get("proposedLocation"),
                "paymentReady": True,
            },
            "$push": {"negotiationTimeline": entry},
        },
    )
    return {
        "success": True,
        "status": NEG_STATUS_AGREED,
        "agreedTime": session.get("proposedTime"),
        "agreedLocation": session.get("proposedLocation"),
    }


# ── POST /sessions/{id}/negotiation/reject ────────────────────────────
@router.post("/{session_id}/negotiation/reject")
async def reject(session_id: str, req: RejectRequest, current_user: dict = Depends(get_current_user)):
    """Reject the current proposal — session moves to rejected state."""
    oid = _ensure_oid(session_id)
    user_id = str(current_user["_id"])
    session = await _load_session(oid, user_id)

    current_status = session.get("negotiationStatus")
    if current_status not in PENDING_STATUSES:
        raise HTTPException(status_code=400, detail="No pending proposal to reject.")

    role = _user_role(session, user_id)
    entry = {
        "type": "reject",
        "by": role,
        "byUserId": user_id,
        "reason": (req.reason or "")[:300],
        "at": _utcnow(),
    }
    await db.sessions.update_one(
        {"_id": oid},
        {
            "$set": {
                "negotiationStatus": NEG_STATUS_REJECTED,
                "negotiationRejectedAt": _utcnow(),
                "negotiationLastUpdatedAt": _utcnow(),
            },
            "$push": {"negotiationTimeline": entry},
        },
    )
    return {"success": True, "status": NEG_STATUS_REJECTED}


# ── GET /sessions/{id}/negotiation/timeline ───────────────────────────
@router.get("/{session_id}/negotiation/timeline")
async def timeline(session_id: str, current_user: dict = Depends(get_current_user)):
    oid = _ensure_oid(session_id)
    user_id = str(current_user["_id"])
    session = await _load_session(oid, user_id)

    expired = _maybe_expire(session)
    if expired:
        await db.sessions.update_one({"_id": oid}, {"$set": expired})
        session.update(expired)

    return {
        "sessionId": str(session["_id"]),
        "negotiationStatus": session.get("negotiationStatus"),
        "agreedTime": session.get("agreedTime"),
        "agreedLocation": session.get("agreedLocation"),
        "proposedTime": session.get("proposedTime"),
        "proposedLocation": session.get("proposedLocation"),
        "paymentReady": bool(session.get("paymentReady")),
        "timeline": session.get("negotiationTimeline", []),
        "expiresInMinutes": (
            NEGOTIATION_TIMEOUT_MINUTES
            - int((_utcnow() - (session.get("negotiationLastUpdatedAt") or _utcnow())
                   .replace(tzinfo=timezone.utc) if session.get("negotiationLastUpdatedAt")
                   and session["negotiationLastUpdatedAt"].tzinfo is None
                   else session.get("negotiationLastUpdatedAt") or _utcnow()).total_seconds() // 60)
            if session.get("negotiationStatus") in PENDING_STATUSES else None
        ),
    }
