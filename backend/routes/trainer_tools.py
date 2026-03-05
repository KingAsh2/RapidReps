"""Phase 3: Trainer tools — workout plans, session notes, client progress."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId

from routes import db, get_current_user, serialize_doc

router = APIRouter(prefix="/api/trainer-tools", tags=["trainer-tools"])


# ---------------------------------------------------------------------------
# Workout Plans
# ---------------------------------------------------------------------------

class WorkoutPlanCreate(BaseModel):
    traineeId: str
    title: str
    description: Optional[str] = ""
    exercises: List[dict] = []  # [{name, sets, reps, weight, notes}]
    weekday: Optional[str] = None
    durationWeeks: Optional[int] = 4

@router.post("/workout-plans")
async def create_workout_plan(plan: WorkoutPlanCreate, current_user: dict = Depends(get_current_user)):
    if "trainer" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Trainers only")
    doc = plan.dict()
    doc["trainerId"] = current_user["id"]
    doc["createdAt"] = datetime.now(timezone.utc)
    doc["updatedAt"] = datetime.now(timezone.utc)
    result = await db.workout_plans.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return serialize_doc(doc)

@router.get("/workout-plans")
async def list_workout_plans(
    trainee_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if "trainer" in current_user.get("roles", []):
        query["trainerId"] = current_user["id"]
        if trainee_id:
            query["traineeId"] = trainee_id
    else:
        query["traineeId"] = current_user["id"]
    plans = await db.workout_plans.find(query).sort("createdAt", -1).to_list(100)
    return [serialize_doc(p) for p in plans]

@router.get("/workout-plans/{plan_id}")
async def get_workout_plan(plan_id: str, current_user: dict = Depends(get_current_user)):
    plan = await db.workout_plans.find_one({"_id": ObjectId(plan_id)})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if current_user["id"] not in [plan.get("trainerId"), plan.get("traineeId")]:
        raise HTTPException(status_code=403, detail="Access denied")
    return serialize_doc(plan)

@router.put("/workout-plans/{plan_id}")
async def update_workout_plan(plan_id: str, plan: WorkoutPlanCreate, current_user: dict = Depends(get_current_user)):
    existing = await db.workout_plans.find_one({"_id": ObjectId(plan_id)})
    if not existing or existing.get("trainerId") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your plan")
    update = plan.dict()
    update["updatedAt"] = datetime.now(timezone.utc)
    await db.workout_plans.update_one({"_id": ObjectId(plan_id)}, {"$set": update})
    return {"message": "Plan updated"}

@router.delete("/workout-plans/{plan_id}")
async def delete_workout_plan(plan_id: str, current_user: dict = Depends(get_current_user)):
    existing = await db.workout_plans.find_one({"_id": ObjectId(plan_id)})
    if not existing or existing.get("trainerId") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your plan")
    await db.workout_plans.delete_one({"_id": ObjectId(plan_id)})
    return {"message": "Plan deleted"}


# ---------------------------------------------------------------------------
# Session Notes
# ---------------------------------------------------------------------------

class SessionNoteCreate(BaseModel):
    sessionId: Optional[str] = None
    traineeId: str
    note: str
    tags: List[str] = []

@router.post("/session-notes")
async def create_session_note(note: SessionNoteCreate, current_user: dict = Depends(get_current_user)):
    if "trainer" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Trainers only")
    doc = note.dict()
    doc["trainerId"] = current_user["id"]
    doc["createdAt"] = datetime.now(timezone.utc)
    result = await db.session_notes.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return serialize_doc(doc)

@router.get("/session-notes")
async def list_session_notes(
    trainee_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if "trainer" in current_user.get("roles", []):
        query["trainerId"] = current_user["id"]
        if trainee_id:
            query["traineeId"] = trainee_id
    else:
        query["traineeId"] = current_user["id"]
    notes = await db.session_notes.find(query).sort("createdAt", -1).to_list(200)
    return [serialize_doc(n) for n in notes]

@router.delete("/session-notes/{note_id}")
async def delete_session_note(note_id: str, current_user: dict = Depends(get_current_user)):
    existing = await db.session_notes.find_one({"_id": ObjectId(note_id)})
    if not existing or existing.get("trainerId") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your note")
    await db.session_notes.delete_one({"_id": ObjectId(note_id)})
    return {"message": "Note deleted"}


# ---------------------------------------------------------------------------
# Client Progress Tracking (trainer-submitted)
# ---------------------------------------------------------------------------

class ClientProgressUpdate(BaseModel):
    weight: Optional[float] = None
    bodyFatPercent: Optional[float] = None
    benchmarks: Optional[dict] = None  # {squat: "200lbs", deadlift: "300lbs", ...}
    progressPhotoUrl: Optional[str] = None
    notes: Optional[str] = None
    milestones: Optional[List[str]] = None  # ["First 5K", "Lost 10lbs"]

@router.post("/client-progress/{trainee_id}")
async def update_client_progress(
    trainee_id: str,
    progress: ClientProgressUpdate,
    current_user: dict = Depends(get_current_user),
):
    if "trainer" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Trainers only")

    now = datetime.now(timezone.utc)
    update_data = {k: v for k, v in progress.dict().items() if v is not None}
    update_data["updatedAt"] = now

    # Upsert the progress document
    existing = await db.client_progress.find_one({"trainerId": current_user["id"], "traineeId": trainee_id})
    if existing:
        # Also append to history
        history_entry = {**update_data, "recordedAt": now}
        await db.client_progress.update_one(
            {"_id": existing["_id"]},
            {"$set": update_data, "$push": {"history": history_entry}}
        )
    else:
        doc = {
            "trainerId": current_user["id"],
            "traineeId": trainee_id,
            **update_data,
            "history": [{**update_data, "recordedAt": now}],
            "createdAt": now,
        }
        await db.client_progress.insert_one(doc)

    return {"message": "Progress updated"}

@router.get("/client-progress/{trainee_id}")
async def get_client_progress(trainee_id: str, current_user: dict = Depends(get_current_user)):
    # Trainer or trainee can view
    query = {"traineeId": trainee_id}
    if "trainer" in current_user.get("roles", []):
        query["trainerId"] = current_user["id"]

    doc = await db.client_progress.find_one(query)
    if not doc:
        return {"traineeId": trainee_id, "history": [], "message": "No progress recorded yet"}
    return serialize_doc(doc)

@router.get("/my-clients")
async def get_trainer_clients(current_user: dict = Depends(get_current_user)):
    """Get all trainees the trainer has had sessions with."""
    if "trainer" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Trainers only")

    pipeline = [
        {"$match": {"trainerId": current_user["id"], "status": {"$in": ["completed", "confirmed", "in_progress"]}}},
        {"$group": {"_id": "$traineeId", "sessionCount": {"$sum": 1}, "lastSession": {"$max": "$createdAt"}}},
        {"$sort": {"lastSession": -1}},
    ]
    clients_agg = await db.sessions.aggregate(pipeline).to_list(100)

    clients = []
    for c in clients_agg:
        trainee_id = c["_id"]
        user = await db.users.find_one({"_id": ObjectId(trainee_id)}, {"fullName": 1, "profilePhoto": 1})
        progress = await db.client_progress.find_one({"trainerId": current_user["id"], "traineeId": trainee_id})
        clients.append({
            "traineeId": trainee_id,
            "fullName": user.get("fullName", "Unknown") if user else "Unknown",
            "profilePhoto": user.get("profilePhoto") if user else None,
            "sessionCount": c["sessionCount"],
            "lastSession": c["lastSession"].isoformat() if c.get("lastSession") else None,
            "hasProgress": progress is not None,
        })

    return {"clients": clients, "count": len(clients)}
