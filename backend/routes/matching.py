"""Phase 1 & 2 & 6: ETA-weighted matching, instant workout mode, virtual accept timer."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import asyncio
import math

from routes import db, get_current_user, serialize_doc, haversine_miles
from deps import trainer_visibility_filter

router = APIRouter(prefix="/api", tags=["matching"])


# ---------------------------------------------------------------------------
# Phase 1: ETA-weighted composite scoring for trainer search
# ---------------------------------------------------------------------------

def compute_trainer_score(
    distance_miles: float,
    avg_rating: float,
    total_sessions: int,
    hourly_rate_cents: int,
    market_avg_rate: int,
    has_boost: bool,
    avg_response_mins: float,
) -> dict:
    """
    Composite score: ETA 40%, Rating 20%, Sessions 15%, Price 10%, Boost 10%, Responsiveness 5%.
    All sub-scores normalised to 0-100.
    """
    eta_minutes = max(1, distance_miles * 3 + 3)  # ~20 mph + 3-min buffer
    eta_score = max(0, 100 - eta_minutes * 2)      # 0 min=100, 50 min=0

    rating_score = (avg_rating / 5.0) * 100 if avg_rating else 50

    session_score = min(100, total_sessions * 2)   # 50 sessions = 100

    if market_avg_rate > 0 and hourly_rate_cents > 0:
        price_score = max(0, min(100, (1 - (hourly_rate_cents - market_avg_rate) / market_avg_rate) * 100))
    else:
        price_score = 50

    boost_score = 100 if has_boost else 0

    resp_score = max(0, 100 - avg_response_mins * 5) if avg_response_mins else 50

    composite = (
        eta_score * 0.40 +
        rating_score * 0.20 +
        session_score * 0.15 +
        price_score * 0.10 +
        boost_score * 0.10 +
        resp_score * 0.05
    )

    return {
        "compositeScore": round(composite, 2),
        "etaMinutes": round(eta_minutes, 1),
        "etaScore": round(eta_score, 1),
        "ratingScore": round(rating_score, 1),
        "sessionScore": round(session_score, 1),
        "priceScore": round(price_score, 1),
        "boostScore": round(boost_score, 1),
        "responsiveScore": round(resp_score, 1),
    }


@router.get("/trainers/ranked-search")
async def ranked_trainer_search(
    latitude: float = Query(...),
    longitude: float = Query(...),
    session_type: str = Query("outdoor"),
    max_distance: float = Query(20),
    specialty: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Search trainers using ETA-weighted composite scoring."""
    query = {"isAvailable": True}
    query.update(trainer_visibility_filter())
    if session_type == "virtual":
        query["offersVirtual"] = True
    else:
        query["offersInPerson"] = True
    if specialty:
        query["trainingStyles"] = {"$in": [specialty]}

    profiles = await db.trainer_profiles.find(query).to_list(200)

    # Compute market average rate
    rate_key = {"virtual": "virtualRateCents", "outdoor": "outdoorRateCents", "in_home": "inHomeRateCents"}.get(session_type, "outdoorRateCents")
    rates = [p.get(rate_key, 0) for p in profiles if p.get(rate_key)]
    market_avg = int(sum(rates) / len(rates)) if rates else 4000

    # Check active boosts
    now = datetime.now(timezone.utc)
    active_boosts = set()
    async for boost in db.boosts.find({"endDate": {"$gt": now}, "isActive": True}):
        active_boosts.add(boost.get("trainerId"))

    results = []
    for p in profiles:
        plat = p.get("latitude")
        plon = p.get("longitude")
        if not plat or not plon:
            continue
        dist = haversine_miles(latitude, longitude, plat, plon)
        if dist > max_distance:
            continue

        user_id = p.get("userId", "")
        score_data = compute_trainer_score(
            distance_miles=dist,
            avg_rating=p.get("averageRating", 0),
            total_sessions=p.get("totalSessionsCompleted", 0),
            hourly_rate_cents=p.get(rate_key, 0),
            market_avg_rate=market_avg,
            has_boost=user_id in active_boosts,
            avg_response_mins=p.get("avgResponseMinutes", 10),
        )

        # Enrich with user name
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"fullName": 1, "profilePhoto": 1})
        results.append({
            "trainerId": user_id,
            "fullName": user.get("fullName", "Trainer") if user else "Trainer",
            "avatarUrl": p.get("avatarUrl") or (user.get("profilePhoto") if user else None),
            "bio": p.get("bio", ""),
            "trainingStyles": p.get("trainingStyles", []),
            "averageRating": p.get("averageRating", 0),
            "totalReviews": p.get("totalReviews", 0),
            "totalSessions": p.get("totalSessionsCompleted", 0),
            "distanceMiles": round(dist, 1),
            "rateCents": p.get(rate_key, 0),
            # iter102ah: include per-duration rates so the client-side resolver
            # shows the trainer's real per-session price across every surface.
            "tierRates": p.get("tierRates", {}),
            "assignedTier": p.get("assignedTier"),
            "outdoorRateCents": p.get("outdoorRateCents"),
            "virtualRateCents": p.get("virtualRateCents"),
            "inHomeRateCents": p.get("inHomeRateCents"),
            **score_data,
        })

    results.sort(key=lambda x: x["compositeScore"], reverse=True)
    return {"trainers": results, "count": len(results)}


# ---------------------------------------------------------------------------
# Phase 2: Instant Workout Mode
# ---------------------------------------------------------------------------

class InstantMatchRequest(BaseModel):
    latitude: float
    longitude: float
    sessionType: str = "outdoor"
    durationMinutes: int = 30
    maxDistanceMiles: float = 10

@router.post("/sessions/instant-match")
async def instant_workout_match(
    req: InstantMatchRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Uber-style instant matching.
    1. Find nearby trainers ranked by composite score.
    2. Create an instant-match request.
    3. Send to top trainer with 15-second accept window.
    4. Cascade on decline/timeout.
    """
    if "trainee" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Only trainees can request instant matches")

    query = {"isAvailable": True, "offersInPerson": True}
    query.update(trainer_visibility_filter())
    if req.sessionType == "virtual":
        query = {"isAvailable": True, "offersVirtual": True}
        query.update(trainer_visibility_filter())

    profiles = await db.trainer_profiles.find(query).to_list(100)

    rate_key = {"virtual": "virtualRateCents", "outdoor": "outdoorRateCents", "in_home": "inHomeRateCents"}.get(req.sessionType, "outdoorRateCents")
    rates = [p.get(rate_key, 0) for p in profiles if p.get(rate_key)]
    market_avg = int(sum(rates) / len(rates)) if rates else 4000

    now = datetime.now(timezone.utc)
    active_boosts = set()
    async for boost in db.boosts.find({"endDate": {"$gt": now}, "isActive": True}):
        active_boosts.add(boost.get("trainerId"))

    # Score and filter trainers
    candidates = []
    for p in profiles:
        plat, plon = p.get("latitude"), p.get("longitude")
        if not plat or not plon:
            continue
        dist = haversine_miles(req.latitude, req.longitude, plat, plon)
        if dist > req.maxDistanceMiles:
            continue
        uid = p.get("userId", "")
        score = compute_trainer_score(dist, p.get("averageRating", 0), p.get("totalSessionsCompleted", 0),
                                       p.get(rate_key, 0), market_avg, uid in active_boosts, p.get("avgResponseMinutes", 10))
        candidates.append({"userId": uid, "score": score["compositeScore"], "dist": dist, "rateCents": p.get(rate_key, 0), "profile": p})

    candidates.sort(key=lambda x: x["score"], reverse=True)

    if not candidates:
        raise HTTPException(status_code=404, detail="No trainers available nearby. Try expanding your search radius.")

    # Create the instant match request
    match_doc = {
        "traineeId": current_user["id"],
        "traineeName": current_user.get("fullName", "Trainee"),
        "latitude": req.latitude,
        "longitude": req.longitude,
        "sessionType": req.sessionType,
        "durationMinutes": req.durationMinutes,
        "candidateTrainerIds": [c["userId"] for c in candidates],
        "currentCandidateIndex": 0,
        "status": "searching",  # searching | matched | expired | cancelled
        "matchedTrainerId": None,
        "createdAt": now,
        "expiresAt": now + timedelta(minutes=5),  # Overall timeout
        "currentOfferExpiresAt": now + timedelta(seconds=15),
    }
    result = await db.instant_matches.insert_one(match_doc)
    match_id = str(result.inserted_id)

    # Send push to first candidate
    first_trainer_id = candidates[0]["userId"]
    from routes import send_push
    try:
        await send_push(
            first_trainer_id,
            "Instant Workout Request!",
            f"{current_user.get('fullName', 'A trainee')} wants a {req.durationMinutes}-min {req.sessionType} session NOW!",
            {"type": "instant_match", "matchId": match_id}
        )
    except Exception:
        pass

    return {
        "matchId": match_id,
        "status": "searching",
        "totalCandidates": len(candidates),
        "currentTrainerIndex": 0,
        "message": "Looking for a trainer... You'll be matched shortly.",
    }


@router.get("/sessions/instant-match/{match_id}/status")
async def get_instant_match_status(match_id: str, current_user: dict = Depends(get_current_user)):
    """Poll the status of an instant match request."""
    match = await db.instant_matches.find_one({"_id": ObjectId(match_id)})
    if not match:
        raise HTTPException(status_code=404, detail="Match request not found")

    now = datetime.now(timezone.utc)

    # Check if current offer has expired → cascade
    if match["status"] == "searching":
        offer_expires = match.get("currentOfferExpiresAt", now)
        # Ensure timezone-aware comparison
        if offer_expires.tzinfo is None:
            offer_expires = offer_expires.replace(tzinfo=timezone.utc)
        if now > offer_expires:
            idx = match.get("currentCandidateIndex", 0) + 1
            candidates = match.get("candidateTrainerIds", [])

            if idx < len(candidates):
                next_trainer = candidates[idx]
                await db.instant_matches.update_one(
                    {"_id": ObjectId(match_id)},
                    {"$set": {
                        "currentCandidateIndex": idx,
                        "currentOfferExpiresAt": now + timedelta(seconds=15),
                    }}
                )
                try:
                    await send_push(next_trainer, "Instant Workout Request!", "A trainee wants to work out NOW!", {"type": "instant_match", "matchId": match_id})
                except Exception:
                    pass
                match["currentCandidateIndex"] = idx
            else:
                await db.instant_matches.update_one({"_id": ObjectId(match_id)}, {"$set": {"status": "expired"}})
                match["status"] = "expired"

        # Check overall timeout
        expires_at = match.get("expiresAt", now)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if now > expires_at:
            await db.instant_matches.update_one({"_id": ObjectId(match_id)}, {"$set": {"status": "expired"}})
            match["status"] = "expired"

    doc = serialize_doc(match)
    return {
        "matchId": doc["id"],
        "status": doc["status"],
        "matchedTrainerId": doc.get("matchedTrainerId"),
        "currentCandidateIndex": doc.get("currentCandidateIndex", 0),
        "totalCandidates": len(doc.get("candidateTrainerIds", [])),
        "sessionId": doc.get("sessionId"),
    }


@router.post("/sessions/instant-match/{match_id}/accept")
async def accept_instant_match(match_id: str, current_user: dict = Depends(get_current_user)):
    """Trainer accepts an instant match request."""
    if "trainer" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Only trainers can accept")

    match = await db.instant_matches.find_one({"_id": ObjectId(match_id)})
    if not match or match["status"] != "searching":
        raise HTTPException(status_code=400, detail="Match is no longer available")

    candidates = match.get("candidateTrainerIds", [])
    idx = match.get("currentCandidateIndex", 0)
    if idx >= len(candidates) or candidates[idx] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You are not the current candidate for this match")

    now = datetime.now(timezone.utc)

    # Create session
    session_doc = {
        "traineeId": match["traineeId"],
        "trainerId": current_user["id"],
        "trainerName": current_user.get("fullName", "Trainer"),
        "traineeName": match.get("traineeName", "Trainee"),
        "sessionType": match.get("sessionType", "outdoor"),
        "locationType": match.get("sessionType", "outdoor"),
        "durationMinutes": match.get("durationMinutes", 30),
        "status": "confirmed",
        "sessionDateTimeStart": now,
        "sessionDateTimeEnd": now + timedelta(minutes=match.get("durationMinutes", 30)),
        "isInstantMatch": True,
        "instantMatchId": match_id,
        "createdAt": now,
        "latitude": match.get("latitude"),
        "longitude": match.get("longitude"),
        "cancellationGracePeriod": now + timedelta(minutes=2),  # 2-min grace for instant
    }
    sess_result = await db.sessions.insert_one(session_doc)
    session_id = str(sess_result.inserted_id)

    await db.instant_matches.update_one(
        {"_id": ObjectId(match_id)},
        {"$set": {"status": "matched", "matchedTrainerId": current_user["id"], "sessionId": session_id}}
    )

    try:
        await send_push(match["traineeId"], "Trainer Found!", f"{current_user.get('fullName', 'A trainer')} is ready for your session!", {"type": "instant_match_accepted", "sessionId": session_id})
    except Exception:
        pass

    return {"status": "matched", "sessionId": session_id, "message": "You've accepted the instant workout!"}


@router.post("/sessions/instant-match/{match_id}/decline")
async def decline_instant_match(match_id: str, current_user: dict = Depends(get_current_user)):
    """Trainer declines — cascade to next candidate."""
    match = await db.instant_matches.find_one({"_id": ObjectId(match_id)})
    if not match or match["status"] != "searching":
        raise HTTPException(status_code=400, detail="Match is no longer available")

    now = datetime.now(timezone.utc)
    idx = match.get("currentCandidateIndex", 0) + 1
    candidates = match.get("candidateTrainerIds", [])

    if idx < len(candidates):
        await db.instant_matches.update_one(
            {"_id": ObjectId(match_id)},
            {"$set": {"currentCandidateIndex": idx, "currentOfferExpiresAt": now + timedelta(seconds=15)}}
        )
        try:
            await send_push(candidates[idx], "Instant Workout Request!", "A trainee wants to work out NOW!", {"type": "instant_match", "matchId": match_id})
        except Exception:
            pass
        return {"status": "searching", "message": "Declined. Sent to next trainer."}
    else:
        await db.instant_matches.update_one({"_id": ObjectId(match_id)}, {"$set": {"status": "expired"}})
        return {"status": "expired", "message": "No more trainers available."}


@router.post("/sessions/instant-match/{match_id}/cancel")
async def cancel_instant_match(match_id: str, current_user: dict = Depends(get_current_user)):
    """Trainee cancels the instant match search."""
    match = await db.instant_matches.find_one({"_id": ObjectId(match_id)})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if match["traineeId"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your match request")

    await db.instant_matches.update_one({"_id": ObjectId(match_id)}, {"$set": {"status": "cancelled"}})
    return {"status": "cancelled"}


# ---------------------------------------------------------------------------
# Phase 6: Virtual Session Accept Timer (modifies auto-match behaviour)
# ---------------------------------------------------------------------------

@router.post("/sessions/virtual-instant")
async def virtual_instant_match(
    duration_minutes: int = Query(30),
    current_user: dict = Depends(get_current_user),
):
    """
    Virtual instant match with accept timer.
    Creates pending session, trainer has 10s to accept.
    If timeout → cascade to next trainer.
    """
    if "trainee" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Only trainees can request virtual sessions")

    trainers = await db.trainer_profiles.find({
        "isAvailable": True, "offersVirtual": True,
        **trainer_visibility_filter(),
    }).sort([("averageRating", -1), ("totalSessionsCompleted", -1)]).to_list(20)

    if not trainers:
        raise HTTPException(status_code=404, detail="No virtual trainers available right now")

    now = datetime.now(timezone.utc)
    candidate_ids = [t.get("userId") for t in trainers if t.get("userId")]

    match_doc = {
        "traineeId": current_user["id"],
        "traineeName": current_user.get("fullName", "Trainee"),
        "sessionType": "virtual",
        "durationMinutes": duration_minutes,
        "candidateTrainerIds": candidate_ids,
        "currentCandidateIndex": 0,
        "status": "searching",
        "matchedTrainerId": None,
        "createdAt": now,
        "expiresAt": now + timedelta(minutes=3),
        "currentOfferExpiresAt": now + timedelta(seconds=10),
    }
    result = await db.instant_matches.insert_one(match_doc)
    match_id = str(result.inserted_id)

    if candidate_ids:
        try:
            await send_push(candidate_ids[0], "Virtual Session Request!", f"{current_user.get('fullName', 'A trainee')} wants a virtual session NOW! Accept within 10 seconds.", {"type": "instant_match", "matchId": match_id})
        except Exception:
            pass

    return {
        "matchId": match_id,
        "status": "searching",
        "totalCandidates": len(candidate_ids),
        "message": "Finding a virtual trainer...",
    }
