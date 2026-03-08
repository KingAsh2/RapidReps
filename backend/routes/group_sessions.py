"""Phase 5: Group workout sessions."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import stripe
import os

from routes import db, get_current_user, serialize_doc, send_push

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')

router = APIRouter(prefix="/api/group-sessions", tags=["group-sessions"])


class GroupSessionCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    sessionType: str = "outdoor"  # outdoor, virtual, gym
    dateTime: str  # ISO string
    durationMinutes: int = 60
    capacity: int = 10
    pricePerPersonCents: int = 1200
    location: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    tags: List[str] = []


@router.post("")
async def create_group_session(session: GroupSessionCreate, current_user: dict = Depends(get_current_user)):
    if "trainer" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Only trainers can create group sessions")

    now = datetime.now(timezone.utc)
    doc = session.dict()
    doc["trainerId"] = current_user["id"]
    doc["trainerName"] = current_user.get("fullName", "Trainer")
    doc["participants"] = []
    doc["status"] = "upcoming"  # upcoming, in_progress, completed, cancelled
    doc["createdAt"] = now
    doc["spotsRemaining"] = session.capacity

    result = await db.group_sessions.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return serialize_doc(doc)


@router.get("")
async def list_group_sessions(
    status: Optional[str] = "upcoming",
    trainer_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if status:
        query["status"] = status
    if trainer_id:
        query["trainerId"] = trainer_id
    skip = (page - 1) * limit

    sessions = await db.group_sessions.find(query).sort("dateTime", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.group_sessions.count_documents(query)

    results = []
    for s in sessions:
        doc = serialize_doc(s)
        doc["spotsRemaining"] = s.get("capacity", 10) - len(s.get("participants", []))
        doc["isJoined"] = current_user["id"] in [p.get("traineeId") for p in s.get("participants", [])]
        doc["participantCount"] = len(s.get("participants", []))
        results.append(doc)

    return {"sessions": results, "total": total, "page": page}


@router.get("/{session_id}")
async def get_group_session(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await db.group_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Group session not found")
    doc = serialize_doc(session)
    doc["spotsRemaining"] = session.get("capacity", 10) - len(session.get("participants", []))
    doc["isJoined"] = current_user["id"] in [p.get("traineeId") for p in session.get("participants", [])]
    doc["participantCount"] = len(session.get("participants", []))
    return doc


@router.post("/{session_id}/join")
async def join_group_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Trainee joins a group session and pays."""
    session = await db.group_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Group session not found")
    if session["status"] != "upcoming":
        raise HTTPException(status_code=400, detail="Session is no longer accepting participants")

    participants = session.get("participants", [])
    if current_user["id"] in [p.get("traineeId") for p in participants]:
        raise HTTPException(status_code=400, detail="You've already joined this session")
    if len(participants) >= session.get("capacity", 10):
        raise HTTPException(status_code=400, detail="Session is full")

    # Create individual PaymentIntent for this participant
    price = session.get("pricePerPersonCents", 1200)
    try:
        intent = stripe.PaymentIntent.create(
            amount=price,
            currency="usd",
            description=f"Group Session: {session.get('title', 'Workout')}",
            metadata={"groupSessionId": session_id, "traineeId": current_user["id"]},
        )
        payment_intent_id = intent.id
        client_secret = intent.client_secret
    except Exception as e:
        payment_intent_id = None
        client_secret = None

    participant = {
        "traineeId": current_user["id"],
        "traineeName": current_user.get("fullName", "Trainee"),
        "joinedAt": datetime.now(timezone.utc).isoformat(),
        "paymentIntentId": payment_intent_id,
        "paid": False,
    }

    await db.group_sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$push": {"participants": participant}, "$inc": {"spotsRemaining": -1}}
    )

    try:
        await send_push(session["trainerId"], "New Participant!", f"{current_user.get('fullName', 'Someone')} joined your group session!", {"type": "group_join", "sessionId": session_id})
    except Exception:
        pass

    return {
        "message": "Joined! Complete payment to confirm.",
        "clientSecret": client_secret,
        "paymentIntentId": payment_intent_id,
        "pricePerPersonCents": price,
    }


@router.post("/{session_id}/leave")
async def leave_group_session(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await db.group_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Group session not found")
    if session["status"] != "upcoming":
        raise HTTPException(status_code=400, detail="Cannot leave a session that has started")

    await db.group_sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$pull": {"participants": {"traineeId": current_user["id"]}}, "$inc": {"spotsRemaining": 1}}
    )
    return {"message": "You've left the group session"}


@router.post("/{session_id}/start")
async def start_group_session(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await db.group_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Group session not found")
    if session.get("trainerId") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the trainer can start this session")

    await db.group_sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"status": "in_progress", "startedAt": datetime.now(timezone.utc)}}
    )

    for p in session.get("participants", []):
        try:
            await send_push(p["traineeId"], "Session Starting!", f"Your group session '{session.get('title')}' is starting now!", {"type": "group_start", "sessionId": session_id})
        except Exception:
            pass

    return {"message": "Group session started", "participantCount": len(session.get("participants", []))}


@router.post("/{session_id}/complete")
async def complete_group_session(session_id: str, current_user: dict = Depends(get_current_user)):
    session = await db.group_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Group session not found")
    if session.get("trainerId") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the trainer can complete this session")

    await db.group_sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"status": "completed", "completedAt": datetime.now(timezone.utc)}}
    )
    return {"message": "Group session completed"}


@router.put("/{session_id}")
async def edit_group_session(session_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Allow the creator trainer to edit their group session."""
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    session = await db.group_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Group session not found")
    if session.get("trainerId") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the creator can edit this session")
    if session.get("status") != "upcoming":
        raise HTTPException(status_code=400, detail="Can only edit upcoming sessions")

    body = await request.json()
    update_fields = {}
    for field in ["title", "description", "dateTime", "durationMinutes", "locationType", "locationName", "capacity", "pricePerPersonCents"]:
        if field in body:
            update_fields[field] = body[field]

    if "capacity" in update_fields:
        current_participants = len(session.get("participants", []))
        update_fields["spotsRemaining"] = update_fields["capacity"] - current_participants

    if update_fields:
        update_fields["updatedAt"] = datetime.now(timezone.utc)
        await db.group_sessions.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": update_fields}
        )

    updated = await db.group_sessions.find_one({"_id": ObjectId(session_id)})
    return serialize_doc(updated)
