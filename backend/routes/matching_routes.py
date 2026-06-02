"""Smart matching engine + virtual & instant session routes.
Extracted from server.py (Iteration 87 — P3 refactor)."""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timedelta
from bson import ObjectId
import logging

from deps import db, get_current_user, calculate_distance, create_and_send_notification
from models import MembershipStatus, PricingRules

router = APIRouter(prefix="/api")


# ─── UBER-STYLE MATCHING ENGINE ───────────────────────────────────────

# Speed assumptions for ETA (miles per minute)
AVG_DRIVING_MPM = 0.5  # ~30 mph

def score_trainer(trainer_profile: dict, trainee_lat: float = None, trainee_lon: float = None, session_type: str = "virtual") -> dict:
    """Score a trainer for matching. Returns dict with score breakdown and ETA."""
    t_lat = trainer_profile.get("latitude")
    t_lon = trainer_profile.get("longitude")
    
    # --- ETA ---
    distance_miles = 0.0
    eta_minutes = 0.0
    if session_type != "virtual" and trainee_lat and trainee_lon and t_lat and t_lon:
        distance_miles = calculate_distance(trainee_lat, trainee_lon, t_lat, t_lon)
        eta_minutes = distance_miles / AVG_DRIVING_MPM if AVG_DRIVING_MPM > 0 else 999
    
    # ETA score: 1.0 at 0 min, 0.0 at 20+ min (for in-person)
    if session_type == "virtual":
        eta_score = 1.0  # distance irrelevant for virtual
    else:
        eta_score = max(0, 1.0 - (eta_minutes / 20.0))
    
    # --- Rating score: 0-1 ---
    avg_rating = trainer_profile.get("averageRating", 0)
    total_reviews = trainer_profile.get("totalReviews", 0)
    rating_score = (avg_rating / 5.0) if avg_rating > 0 else 0.3  # default for new trainers
    
    # --- Price score: lower = better (normalize against a $100 max) ---
    if session_type == "virtual":
        rate = trainer_profile.get("virtualRateCents", 3000)
    else:
        rate = trainer_profile.get("sessionRateCents", 5000)
    price_score = max(0, 1.0 - (rate / 15000))  # $150 = 0 score
    
    # --- Boost bonus ---
    boost_score = 1.0 if trainer_profile.get("boostActive") else 0.0
    
    # --- Responsiveness (acceptance history) ---
    acceptance_rate = trainer_profile.get("acceptanceRate", 0.7)
    responsiveness_score = min(acceptance_rate, 1.0)
    
    # --- Profile completeness ---
    has_bio = 1 if trainer_profile.get("bio") else 0
    has_photo = 1 if trainer_profile.get("profilePhoto") else 0
    has_certs = 1 if trainer_profile.get("isVerified") else 0
    completeness_score = (has_bio + has_photo + has_certs) / 3.0
    
    # --- Weighted total ---
    total = (
        eta_score * 0.40 +
        rating_score * 0.25 +
        price_score * 0.15 +
        boost_score * 0.10 +
        responsiveness_score * 0.05 +
        completeness_score * 0.05
    )
    
    return {
        "userId": trainer_profile.get("userId"),
        "score": round(total, 4),
        "eta_minutes": round(eta_minutes, 1),
        "distance_miles": round(distance_miles, 1),
        "rating": avg_rating,
        "rateCents": rate,
        "boosted": bool(trainer_profile.get("boostActive")),
    }


def get_wave_trainers(scored: list, wave_max_eta: float, session_type: str, limit: int = 3) -> list:
    """Filter scored trainers by ETA wave and return top N by score."""
    if session_type == "virtual":
        # Virtual: all trainers qualify, just sort by score
        return sorted(scored, key=lambda x: -x["score"])[:limit]
    wave = [t for t in scored if t["eta_minutes"] <= wave_max_eta]
    return sorted(wave, key=lambda x: -x["score"])[:limit]


async def run_matching_engine(
    trainee_id: str,
    trainee_name: str,
    trainee_lat: float = None,
    trainee_lon: float = None,
    session_type: str = "virtual",
    rejected_trainers: list = None,
    request_id: str = None,
    wave_number: int = 1,
):
    """
    Smart Matching Engine — scores, filters by wave/ETA, and sends
    intelligent push notifications ONLY to qualified trainers.

    Wave logic (in-person):
      Wave 1: ETA ≤ 5 min, top 3 by score
      Wave 2: ETA ≤ 10 min, top 3 by score
      Wave 3: ETA ≤ 15 min, top 5 by score
    Virtual: all eligible, top 5 by score.

    Scoring weights: ETA 40%, Rating 25%, Price 15%, Boost 10%,
    Responsiveness 5%, Completeness 5%.

    Members get priority matching bonus (+0.15 score).

    Returns (notified_ids, wave_data).
    """
    rejected = rejected_trainers or []

    # Check if trainee has active membership for priority matching
    trainee_membership = await db.memberships.find_one({
        'userId': trainee_id,
        'status': MembershipStatus.ACTIVE,
    })
    is_member = trainee_membership is not None

    # Build query — only available, qualified trainers
    query = {"isAvailable": True, "userId": {"$nin": rejected}}
    if session_type == "virtual":
        query["offersVirtual"] = True
    else:
        query["offersInPerson"] = True

    eligible = await db.trainer_profiles.find(query).to_list(100)

    # Fetch user data for profile photos
    if eligible:
        user_ids = [ObjectId(p["userId"]) for p in eligible if p.get("userId")]
        users_map = {}
        async for u in db.users.find({"_id": {"$in": user_ids}}, {"_id": 1, "profilePhoto": 1}):
            users_map[str(u["_id"])] = u
        for p in eligible:
            uid = p.get("userId")
            if uid in users_map:
                p["profilePhoto"] = users_map[uid].get("profilePhoto")

    # Check active boosts for each trainer
    now = datetime.utcnow()
    boosted_trainer_ids = set()
    active_boosts = await db.boosts.find({
        'isActive': True,
        'endDate': {'$gte': now},
    }).to_list(200)
    for b in active_boosts:
        boosted_trainer_ids.add(b.get('trainerId'))

    for p in eligible:
        p['boostActive'] = p.get('userId') in boosted_trainer_ids

    # Score all eligible trainers
    scored = [score_trainer(p, trainee_lat, trainee_lon, session_type) for p in eligible]

    # HARD ETA CAP: No trainer outside 15 min ETA can be matched (in-person only)
    MAX_ETA_MINUTES = 15
    if session_type != "virtual":
        scored = [t for t in scored if t["eta_minutes"] <= MAX_ETA_MINUTES]

    # Member priority: boost top scores for members
    if is_member:
        for t in scored:
            t['score'] = min(1.0, t['score'] + PricingRules.MEMBERSHIP_MATCHING_PRIORITY_BONUS)
            t['memberPriority'] = True

    # Filter out trainers with score below minimum threshold (quality gate)
    MIN_SCORE = 0.15
    scored = [t for t in scored if t["score"] >= MIN_SCORE]

    # Wave-based notification — ETA tiers for in-person
    if session_type == "virtual":
        top = get_wave_trainers(scored, 999, "virtual", limit=5)
    else:
        # Wave 1: ETA ≤ 5 min
        top = get_wave_trainers(scored, 5, session_type, limit=3)
        if len(top) < 2:
            # Wave 2: ETA ≤ 10 min
            top = get_wave_trainers(scored, 10, session_type, limit=3)
        if len(top) < 1:
            # Wave 3: ETA ≤ 15 min
            top = get_wave_trainers(scored, 15, session_type, limit=5)

    # Notify only the qualified top trainers
    notified = []
    wave_data = []
    for t in top:
        tid = t["userId"]
        try:
            session_label = "Virtual Live" if session_type == "virtual" else "In-Person"
            eta_text = ""
            if session_type != "virtual" and t["eta_minutes"] > 0:
                eta_text = f" (ETA: {int(t['eta_minutes'])} min)"

            await create_and_send_notification(
                tid,
                f"{session_label} Session Request",
                f"{trainee_name} needs a {session_label} trainer now!{eta_text} Accept quickly — first-accept wins.",
                "virtual_request",
                {
                    "screen": "trainer/virtual-request",
                    "requestId": request_id,
                    "sessionType": session_type,
                    "traineeId": trainee_id,
                    "waveNumber": wave_number,
                }
            )
            notified.append(tid)
            t["notifiedAt"] = datetime.utcnow().isoformat()
            wave_data.append(t)
        except Exception:
            pass

    return notified, wave_data


@router.post("/virtual/request")
async def create_virtual_request(current_user: dict = Depends(get_current_user)):
    """Trainee requests a virtual session — Uber-style wave matching"""
    if "trainee" not in current_user.get("roles", []):
        raise HTTPException(400, "Only trainees can request virtual sessions")

    # Check for existing active request
    existing = await db.virtual_requests.find_one({
        "traineeId": str(current_user["_id"]),
        "status": {"$in": ["searching", "matched"]}
    })
    if existing:
        return {
            "requestId": str(existing["_id"]),
            "status": existing["status"],
            "matchedTrainerId": existing.get("matchedTrainerId"),
        }

    # Get trainee location
    trainee_profile = await db.trainee_profiles.find_one(
        {"userId": str(current_user["_id"])},
        {"latitude": 1, "longitude": 1}
    )
    trainee_lat = trainee_profile.get("latitude") if trainee_profile else None
    trainee_lon = trainee_profile.get("longitude") if trainee_profile else None

    request_doc = {
        "traineeId": str(current_user["_id"]),
        "traineeName": current_user.get("fullName", "A Trainee"),
        "sessionType": "virtual",
        "status": "searching",
        "currentWave": 1,
        "matchedTrainerId": None,
        "matchedTrainerName": None,
        "notifiedTrainers": [],
        "rejectedTrainers": [],
        "waveScores": [],
        "traineeLat": trainee_lat,
        "traineeLon": trainee_lon,
        "createdAt": datetime.utcnow(),
    }
    result = await db.virtual_requests.insert_one(request_doc)
    request_id = str(result.inserted_id)

    notified, wave_data = await run_matching_engine(
        trainee_id=str(current_user["_id"]),
        trainee_name=current_user.get("fullName", "A Trainee"),
        trainee_lat=trainee_lat,
        trainee_lon=trainee_lon,
        session_type="virtual",
        request_id=request_id,
    )

    await db.virtual_requests.update_one(
        {"_id": result.inserted_id},
        {"$set": {"notifiedTrainers": notified, "waveScores": wave_data}}
    )

    return {"requestId": request_id, "status": "searching", "trainersNotified": len(notified)}


@router.post("/instant/request")
async def create_instant_inperson_request(current_user: dict = Depends(get_current_user)):
    """Trainee requests an instant in-person session — wave-based matching"""
    if "trainee" not in current_user.get("roles", []):
        raise HTTPException(400, "Only trainees can request sessions")

    existing = await db.virtual_requests.find_one({
        "traineeId": str(current_user["_id"]),
        "sessionType": "in_person",
        "status": {"$in": ["searching", "matched"]}
    })
    if existing:
        return {
            "requestId": str(existing["_id"]),
            "status": existing["status"],
            "matchedTrainerId": existing.get("matchedTrainerId"),
        }

    trainee_profile = await db.trainee_profiles.find_one(
        {"userId": str(current_user["_id"])},
        {"latitude": 1, "longitude": 1}
    )
    trainee_lat = trainee_profile.get("latitude") if trainee_profile else None
    trainee_lon = trainee_profile.get("longitude") if trainee_profile else None

    if not trainee_lat or not trainee_lon:
        raise HTTPException(400, "Location required for in-person instant booking. Please update your profile.")

    request_doc = {
        "traineeId": str(current_user["_id"]),
        "traineeName": current_user.get("fullName", "A Trainee"),
        "sessionType": "in_person",
        "status": "searching",
        "currentWave": 1,
        "matchedTrainerId": None,
        "matchedTrainerName": None,
        "notifiedTrainers": [],
        "rejectedTrainers": [],
        "waveScores": [],
        "traineeLat": trainee_lat,
        "traineeLon": trainee_lon,
        "createdAt": datetime.utcnow(),
    }
    result = await db.virtual_requests.insert_one(request_doc)
    request_id = str(result.inserted_id)

    notified, wave_data = await run_matching_engine(
        trainee_id=str(current_user["_id"]),
        trainee_name=current_user.get("fullName", "A Trainee"),
        trainee_lat=trainee_lat,
        trainee_lon=trainee_lon,
        session_type="in_person",
        request_id=request_id,
    )

    await db.virtual_requests.update_one(
        {"_id": result.inserted_id},
        {"$set": {"notifiedTrainers": notified, "waveScores": wave_data}}
    )

    fallback = None
    if len(notified) == 0:
        fallback = "no_trainers_nearby"

    return {
        "requestId": request_id,
        "status": "searching",
        "trainersNotified": len(notified),
        "fallback": fallback,
    }


@router.get("/virtual/request/{request_id}")
async def get_virtual_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Check the status of a virtual request"""
    try:
        req = await db.virtual_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(404, "Request not found")
    if not req:
        raise HTTPException(404, "Request not found")

    uid = str(current_user["_id"])
    if uid != req["traineeId"] and uid not in req.get("notifiedTrainers", []):
        raise HTTPException(403, "Not authorized")

    result = {
        "requestId": str(req["_id"]),
        "status": req["status"],
        "traineeId": req["traineeId"],
        "traineeName": req.get("traineeName"),
        "matchedTrainerId": req.get("matchedTrainerId"),
        "matchedTrainerName": req.get("matchedTrainerName"),
        "createdAt": req["createdAt"].isoformat(),
    }

    # If matched, include trainer profile data
    if req.get("matchedTrainerId"):
        trainer_user = await db.users.find_one({"_id": ObjectId(req["matchedTrainerId"])}, {"_id": 0, "password": 0})
        trainer_profile = await db.trainer_profiles.find_one({"userId": req["matchedTrainerId"]}, {"_id": 0})
        if trainer_user:
            result["trainerDetails"] = {
                "fullName": trainer_user.get("fullName", ""),
                "profilePhoto": trainer_user.get("profilePhoto"),
                "bio": trainer_profile.get("bio", "") if trainer_profile else "",
                "averageRating": trainer_profile.get("averageRating", 0) if trainer_profile else 0,
                "totalReviews": trainer_profile.get("totalReviews", 0) if trainer_profile else 0,
                "virtualRateCents": trainer_profile.get("virtualRateCents", 3000) if trainer_profile else 3000,
                "tier": calculate_trainer_tier(
                    trainer_profile.get("totalReviews", 0) if trainer_profile else 0,
                    trainer_profile.get("averageRating", 0) if trainer_profile else 0,
                    False
                ),
            }
    return result


@router.get("/virtual/pending")
async def get_pending_virtual_requests(current_user: dict = Depends(get_current_user)):
    """Get pending virtual requests for a trainer"""
    if "trainer" not in current_user.get("roles", []):
        raise HTTPException(400, "Only trainers can view pending requests")

    uid = str(current_user["_id"])
    requests = await db.virtual_requests.find({
        "status": "searching",
        "notifiedTrainers": uid,
        "rejectedTrainers": {"$ne": uid},
    }).sort("createdAt", -1).to_list(10)

    return [{
        "requestId": str(r["_id"]),
        "traineeName": r.get("traineeName", "A Trainee"),
        "createdAt": r["createdAt"].isoformat(),
    } for r in requests]


@router.post("/virtual/accept/{request_id}")
async def accept_virtual_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """
    Trainer accepts a session — first-come-first-served, atomic.
    Uses find_one_and_update to prevent double-acceptance race conditions.
    """
    if "trainer" not in current_user.get("roles", []):
        raise HTTPException(400, "Only trainers can accept requests")

    # Verification gate: trainer must be admin-verified
    trainer_profile = await db.trainer_profiles.find_one({'userId': str(current_user['_id'])})
    if not trainer_profile or trainer_profile.get('verificationStatus') != 'verified':
        raise HTTPException(403, "Your account must be verified by an admin before you can accept sessions. Please complete your verification process.")

    try:
        oid = ObjectId(request_id)
    except Exception:
        raise HTTPException(404, "Invalid request ID")

    trainer_id = str(current_user["_id"])
    trainer_name = current_user.get("fullName", "A Trainer")

    # Atomic update — ONLY succeeds if status is still 'searching'
    # This prevents double-acceptance race conditions
    result = await db.virtual_requests.find_one_and_update(
        {"_id": oid, "status": "searching"},
        {"$set": {
            "status": "matched",
            "matchedTrainerId": trainer_id,
            "matchedTrainerName": trainer_name,
            "matchedAt": datetime.utcnow(),
        }},
        return_document=True,
    )

    if not result:
        # Another trainer already accepted — race condition blocked
        return {"success": False, "message": "Another trainer has already accepted this session request."}

    session_type = result.get("sessionType", "virtual")
    session_label = "virtual" if session_type == "virtual" else "in-person"

    # Notify the trainee — include sound trigger for boxing-bell
    await create_and_send_notification(
        result["traineeId"],
        "Trainer Found!",
        f"{trainer_name} has accepted your {session_label} session request!",
        "virtual_matched",
        {
            "screen": "trainee/virtual-confirm",
            "requestId": request_id,
            "trainerId": trainer_id,
            "trainerName": trainer_name,
            "playSound": "boxing_bell",
        }
    )

    # Notify all OTHER notified trainers that this request is taken
    for tid in result.get("notifiedTrainers", []):
        if tid != trainer_id:
            await create_and_send_notification(
                tid,
                "Session Taken",
                f"Another trainer accepted this {session_label} session.",
                "virtual_taken",
                {"requestId": request_id}
            )

    return {"success": True, "message": "You have been matched with the trainee!"}


@router.post("/virtual/reject/{request_id}")
async def reject_virtual_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Trainer rejects a virtual session request"""
    try:
        oid = ObjectId(request_id)
    except Exception:
        raise HTTPException(404, "Invalid request ID")

    await db.virtual_requests.update_one(
        {"_id": oid},
        {"$addToSet": {"rejectedTrainers": str(current_user["_id"])}}
    )
    return {"success": True}


@router.post("/virtual/trainee-confirm/{request_id}")
async def trainee_confirm_match(request_id: str, current_user: dict = Depends(get_current_user)):
    """Trainee confirms the matched trainer — proceed to payment"""
    try:
        req = await db.virtual_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(404, "Request not found")
    if not req or req["traineeId"] != str(current_user["_id"]):
        raise HTTPException(403, "Not authorized")
    if req["status"] != "matched":
        raise HTTPException(400, "Request is not in matched state")

    await db.virtual_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "confirmed", "confirmedAt": datetime.utcnow()}}
    )
    return {"success": True, "trainerId": req["matchedTrainerId"]}


@router.post("/virtual/find-another/{request_id}")
async def trainee_find_another(request_id: str, current_user: dict = Depends(get_current_user)):
    """
    Trainee rejects matched trainer and re-enters the queue.
    - Previously matched trainer is excluded for 10 minutes (cooldown)
    - New wave of scoring runs with same rules
    - If all waves exhausted → returns exhausted=true with fallback message
    """
    try:
        req = await db.virtual_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(404, "Request not found")
    if not req or req["traineeId"] != str(current_user["_id"]):
        raise HTTPException(403, "Not authorized")

    old_trainer = req.get("matchedTrainerId")
    rejected_list = req.get("rejectedTrainers", [])
    if old_trainer and old_trainer not in rejected_list:
        rejected_list.append(old_trainer)

    # Store cooldown timestamp for rejected trainer (10-minute exclusion)
    cooldown_map = req.get("rejectedCooldowns", {})
    if old_trainer:
        cooldown_map[old_trainer] = datetime.utcnow().isoformat()

    await db.virtual_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "status": "searching",
            "matchedTrainerId": None,
            "matchedTrainerName": None,
            "rejectedTrainers": rejected_list,
            "rejectedCooldowns": cooldown_map,
        }}
    )

    # Re-run matching engine with rejected list
    session_type = req.get("sessionType", "virtual")
    t_lat = req.get("traineeLat")
    t_lon = req.get("traineeLon")
    current_wave = req.get("currentWave", 1)

    notified, wave_data = await run_matching_engine(
        trainee_id=str(current_user["_id"]),
        trainee_name=current_user.get("fullName", "A Trainee"),
        trainee_lat=t_lat,
        trainee_lon=t_lon,
        session_type=session_type,
        rejected_trainers=rejected_list,
        request_id=request_id,
        wave_number=current_wave,
    )

    # Check if all waves are exhausted (no trainers found after Wave 3)
    exhausted = len(notified) == 0 and current_wave >= 3

    await db.virtual_requests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$addToSet": {"notifiedTrainers": {"$each": notified}},
            "$set": {"waveScores": wave_data},
        }
    )

    if exhausted:
        await db.virtual_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"status": "exhausted"}}
        )
        return {
            "success": True,
            "status": "exhausted",
            "exhausted": True,
            "message": "All available trainers have been contacted. Please try again later or adjust your preferences.",
        }

    return {"success": True, "status": "searching", "exhausted": False, "trainersNotified": len(notified)}


@router.post("/virtual/cancel/{request_id}")
async def cancel_virtual_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a virtual session request"""
    try:
        req = await db.virtual_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(404, "Request not found")
    if not req or req["traineeId"] != str(current_user["_id"]):
        raise HTTPException(403, "Not authorized")

    await db.virtual_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "cancelled"}}
    )
    return {"success": True}

