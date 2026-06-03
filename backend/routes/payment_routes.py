"""Payment routes: Ratings, earnings, payouts, tier pricing, Stripe, memberships, boosts, receipts."""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import uuid
import asyncio
import os
import logging
import stripe

from deps import (
    db, get_current_user, serialize_doc, sanitize_text,
    require_admin, calculate_session_payout, calculate_travel_fee_split,
    get_real_ip, create_and_send_notification,
)
from models import (
    RatingCreate, RatingResponse, SessionStatus, UserRole,
    PricingRules, MembershipStatus, BoostType,
    TransactionType, PaymentStatus, VirtualSessionRequest, VirtualSessionMatchResponse,
)

router = APIRouter(prefix="/api")

# Stripe configuration
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')

PAYOUT_MINIMUM_CENTS = 3500  # $35.00


# ============================================================================
# RATING ROUTES
# ============================================================================

@router.post("/ratings", response_model=RatingResponse)
async def create_rating(request: Request, rating: RatingCreate, current_user: dict = Depends(get_current_user)):
    """Create a rating for a completed session — enforces 6 server-side rules + 48h window"""
    user_id = str(current_user['_id'])

    if not current_user.get('emailVerified', False):
        raise HTTPException(status_code=403, detail="Please verify your email before submitting a rating")
    if user_id == rating.trainerId:
        raise HTTPException(status_code=403, detail="Trainers cannot rate their own sessions")

    session = await db.sessions.find_one({'_id': ObjectId(rating.sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session['status'] != SessionStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Can only rate completed sessions")
    if user_id != session.get('traineeId'):
        raise HTTPException(status_code=403, detail="Only the trainee of this session can submit a rating")

    session_ended_at = session.get('sessionEndedAt') or session.get('sessionDateTimeEnd')
    if session_ended_at:
        window_deadline = session_ended_at + timedelta(hours=48)
        if datetime.utcnow() > window_deadline:
            raise HTTPException(status_code=400, detail="The 48-hour rating window for this session has closed.")

    existing_rating = await db.ratings.find_one({'sessionId': rating.sessionId, 'traineeId': user_id})
    if existing_rating:
        raise HTTPException(status_code=400, detail="You have already rated this session")

    client_ip = get_real_ip(request)
    now = datetime.utcnow()

    rating_doc = rating.dict()
    rating_doc['reviewText'] = sanitize_text(rating_doc.get('reviewText'))
    rating_doc['createdAt'] = now
    rating_doc['submittedAt'] = now
    rating_doc['clientIp'] = client_ip
    rating_doc['userAgent'] = request.headers.get('user-agent', '')

    result = await db.ratings.insert_one(rating_doc)
    rating_doc['_id'] = result.inserted_id

    avg_result = await db.ratings.aggregate([
        {'$match': {'trainerId': rating.trainerId}},
        {'$group': {'_id': None, 'avg': {'$avg': '$rating'}, 'count': {'$sum': 1}}}
    ]).to_list(1)
    if avg_result:
        await db.trainer_profiles.update_one(
            {'userId': rating.trainerId},
            {'$set': {'averageRating': round(avg_result[0]['avg'], 2), 'totalReviews': avg_result[0]['count']}}
        )

    return RatingResponse(**serialize_doc(rating_doc))

@router.get("/trainers/{trainer_id}/ratings")
async def get_trainer_ratings(trainer_id: str):
    """Get all ratings for a trainer with reviewer names via aggregation"""
    pipeline = [
        {'$match': {'trainerId': trainer_id}},
        {'$sort': {'createdAt': -1}},
        {'$limit': 100},
        {'$addFields': {'traineeObjId': {'$toObjectId': '$traineeId'}}},
        {'$lookup': {
            'from': 'users', 'localField': 'traineeObjId',
            'foreignField': '_id', 'as': 'traineeUser'
        }},
        {'$addFields': {
            'traineeName': {'$ifNull': [{'$arrayElemAt': ['$traineeUser.fullName', 0]}, 'Anonymous']}
        }},
        {'$project': {'traineeUser': 0, 'traineeObjId': 0}}
    ]
    ratings = await db.ratings.aggregate(pipeline).to_list(100)
    return [RatingResponse(**serialize_doc(r)) for r in ratings]


# ============================================================================
# TRAINER EARNINGS
# ============================================================================

@router.get("/trainer/earnings")
async def get_trainer_earnings(current_user: dict = Depends(get_current_user)):
    """Get trainer earnings summary with weekly/monthly breakdown and payout history"""
    user_id = str(current_user['_id'])
    now = datetime.utcnow()

    completed_sessions = await db.sessions.find(
        {'trainerId': user_id, 'status': SessionStatus.COMPLETED},
        {'trainerEarningsCents': 1, 'createdAt': 1, 'sessionType': 1, 'durationMinutes': 1, 'traineeId': 1}
    ).sort('createdAt', -1).to_list(1000)

    total_earnings = sum(s.get('trainerEarningsCents', 0) for s in completed_sessions)

    month_start = datetime(now.year, now.month, 1)
    month_sessions = [s for s in completed_sessions if s.get('createdAt', now) >= month_start]
    month_earnings = sum(s.get('trainerEarningsCents', 0) for s in month_sessions)

    if now.month == 1:
        last_month_start = datetime(now.year - 1, 12, 1)
    else:
        last_month_start = datetime(now.year, now.month - 1, 1)
    last_month_sessions = [s for s in completed_sessions if last_month_start <= s.get('createdAt', now) < month_start]
    last_month_earnings = sum(s.get('trainerEarningsCents', 0) for s in last_month_sessions)

    week_start = now - timedelta(days=now.weekday())
    week_start = datetime(week_start.year, week_start.month, week_start.day)
    week_sessions = [s for s in completed_sessions if s.get('createdAt', now) >= week_start]
    week_earnings = sum(s.get('trainerEarningsCents', 0) for s in week_sessions)

    last_week_start = week_start - timedelta(days=7)
    last_week_sessions = [s for s in completed_sessions if last_week_start <= s.get('createdAt', now) < week_start]
    last_week_earnings = sum(s.get('trainerEarningsCents', 0) for s in last_week_sessions)

    daily_breakdown = []
    for i in range(7):
        day_start = week_start + timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        day_sessions = [s for s in completed_sessions if day_start <= s.get('createdAt', now) < day_end]
        daily_breakdown.append({
            'day': day_start.strftime('%a'), 'date': day_start.strftime('%m/%d'),
            'earningsCents': sum(s.get('trainerEarningsCents', 0) for s in day_sessions),
            'sessions': len(day_sessions),
        })

    weekly_breakdown = []
    current_week_start = month_start
    week_num = 1
    while current_week_start < now and week_num <= 5:
        current_week_end = min(current_week_start + timedelta(days=7), now)
        w_sessions = [s for s in completed_sessions if current_week_start <= s.get('createdAt', now) < current_week_end]
        weekly_breakdown.append({
            'week': f'Week {week_num}', 'startDate': current_week_start.strftime('%m/%d'),
            'earningsCents': sum(s.get('trainerEarningsCents', 0) for s in w_sessions),
            'sessions': len(w_sessions),
        })
        current_week_start = current_week_end
        week_num += 1

    payouts = await db.trainer_payouts.find({'trainerId': user_id}).sort('createdAt', -1).to_list(50)
    total_paid_out = sum(p.get('amountCents', 0) for p in payouts)

    payout_requests = await db.payout_requests.find({'trainerId': user_id}).sort('createdAt', -1).to_list(20)
    pending_balance = total_earnings - total_paid_out

    recent_sessions = []
    for s in completed_sessions[:10]:
        trainee = await db.users.find_one({'_id': ObjectId(s['traineeId'])}) if s.get('traineeId') else None
        recent_sessions.append({
            'id': str(s['_id']), 'sessionType': s.get('sessionType', 'Training'),
            'earningsCents': s.get('trainerEarningsCents', 0),
            'date': s.get('createdAt', now).isoformat(),
            'traineeName': trainee.get('fullName', 'Unknown') if trainee else 'Unknown',
            'durationMinutes': s.get('durationMinutes', 60),
        })

    return {
        'totalEarningsCents': total_earnings, 'monthEarningsCents': month_earnings,
        'lastMonthEarningsCents': last_month_earnings, 'weekEarningsCents': week_earnings,
        'lastWeekEarningsCents': last_week_earnings, 'totalSessions': len(completed_sessions),
        'monthSessions': len(month_sessions), 'weekSessions': len(week_sessions),
        'pendingBalanceCents': pending_balance, 'totalPaidOutCents': total_paid_out,
        'dailyBreakdown': daily_breakdown, 'weeklyBreakdown': weekly_breakdown,
        'recentSessions': recent_sessions,
        'payouts': [serialize_doc(p) for p in payouts],
        'payoutRequests': [serialize_doc(pr) for pr in payout_requests],
    }


class PayoutRequestCreate(BaseModel):
    paymentMethod: str
    paymentHandle: Optional[str] = None
    notes: Optional[str] = None


@router.post("/trainer/request-payout")
async def request_payout(request: PayoutRequestCreate, current_user: dict = Depends(get_current_user)):
    """Trainer requests a payout of their pending balance."""
    user_id = str(current_user['_id'])

    completed_sessions = await db.sessions.find(
        {'trainerId': user_id, 'status': SessionStatus.COMPLETED}
    ).to_list(1000)
    total_earnings = sum(s.get('trainerEarningsCents', 0) for s in completed_sessions)

    payouts = await db.trainer_payouts.find({'trainerId': user_id}).to_list(1000)
    total_paid = sum(p.get('amountCents', 0) for p in payouts)

    pending = total_earnings - total_paid
    if pending <= 0:
        raise HTTPException(status_code=400, detail="No pending balance to pay out")

    existing = await db.payout_requests.find_one({'trainerId': user_id, 'status': 'pending'})
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending payout request")

    payout_request = {
        'trainerId': user_id, 'trainerName': current_user.get('fullName', ''),
        'trainerEmail': current_user.get('email', ''), 'amountCents': pending,
        'paymentMethod': request.paymentMethod, 'paymentHandle': request.paymentHandle,
        'notes': sanitize_text(request.notes), 'status': 'pending',
        'createdAt': datetime.utcnow(), 'updatedAt': datetime.utcnow(),
    }
    result = await db.payout_requests.insert_one(payout_request)

    return {
        'success': True, 'requestId': str(result.inserted_id), 'amountCents': pending,
        'message': f'Payout request for ${pending/100:.2f} submitted. You will be paid via {request.paymentMethod}.'
    }


@router.get("/trainer/payout-requests")
async def get_payout_requests(current_user: dict = Depends(get_current_user)):
    """Get trainer's payout request history."""
    user_id = str(current_user['_id'])
    requests = await db.payout_requests.find({'trainerId': user_id}).sort('createdAt', -1).to_list(50)
    return {'requests': [serialize_doc(r) for r in requests]}


# ============================================================================
# TIER PRICING SYSTEM (iter92) — replaces legacy Zelle payment flow.
# ============================================================================
from services.pricing_tiers import (  # noqa: E402
    TrainerTierV2,
    calculate_pricing,
    get_rate_cap_cents,
    get_tier_summary,
    validate_trainer_rate_cents,
    TIER_MATRIX,
)


@router.get("/pricing/tiers")
async def get_pricing_tiers_public():
    """Public — returns the full tier matrix so clients can render caps + service fees."""
    return {"tiers": get_tier_summary()}


@router.get("/pricing/quote")
async def get_pricing_quote(
    tier: str = Query(..., description="new | certified | specialty"),
    modality: str = Query(..., description="in_person | virtual"),
    duration: int = Query(..., description="30 | 60 | 90"),
    base_cents: int = Query(..., ge=0, description="Trainer base price in cents"),
):
    """Compute a full pricing breakdown for the given tier/modality/duration/base."""
    ok, err = validate_trainer_rate_cents(tier, modality, duration, base_cents)
    if not ok:
        raise HTTPException(status_code=400, detail=err)
    breakdown = calculate_pricing(tier, modality, duration, base_cents)
    return breakdown


class TrainerRatesPayload(BaseModel):
    """All six rates a trainer can set: 3 durations × 2 modalities (cents)."""
    inPerson30Cents: Optional[int] = None
    inPerson60Cents: Optional[int] = None
    inPerson90Cents: Optional[int] = None
    virtual30Cents: Optional[int] = None
    virtual60Cents: Optional[int] = None
    virtual90Cents: Optional[int] = None


@router.post("/trainer/tier-rates")
async def save_trainer_tier_rates(req: TrainerRatesPayload, current_user: dict = Depends(get_current_user)):
    """Trainer saves their per-tier per-session-length rates. Caps enforced server-side."""
    profile = await db.trainer_profiles.find_one({"userId": str(current_user["_id"])})
    if not profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found.")
    tier = profile.get("assignedTier")
    if tier not in TrainerTierV2.ALL:
        raise HTTPException(
            status_code=400,
            detail="Your tier hasn't been assigned yet. An admin must approve your verification first.",
        )

    field_map = {
        "inPerson30Cents": ("in_person", 30),
        "inPerson60Cents": ("in_person", 60),
        "inPerson90Cents": ("in_person", 90),
        "virtual30Cents": ("virtual", 30),
        "virtual60Cents": ("virtual", 60),
        "virtual90Cents": ("virtual", 90),
    }

    updates: dict = {}
    errors: list[str] = []
    payload = req.dict(exclude_unset=True)
    for field, value in payload.items():
        if field not in field_map or value is None:
            continue
        modality, duration = field_map[field]
        ok, err = validate_trainer_rate_cents(tier, modality, duration, int(value))
        if not ok:
            errors.append(f"{field}: {err}")
            continue
        updates[f"tierRates.{field}"] = int(value)

    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    if not updates:
        raise HTTPException(status_code=400, detail="No rates provided.")

    updates["tierRatesUpdatedAt"] = datetime.utcnow()
    await db.trainer_profiles.update_one(
        {"userId": str(current_user["_id"])}, {"$set": updates}
    )
    saved = await db.trainer_profiles.find_one(
        {"userId": str(current_user["_id"])}, {"_id": 0, "tierRates": 1, "assignedTier": 1}
    )
    return {"success": True, "tier": saved.get("assignedTier"), "tierRates": saved.get("tierRates", {})}


@router.get("/trainer/tier-rates")
async def get_trainer_tier_rates(current_user: dict = Depends(get_current_user)):
    """Trainer gets their current per-session-length rates + tier caps."""
    profile = await db.trainer_profiles.find_one(
        {"userId": str(current_user["_id"])},
        {"_id": 0, "assignedTier": 1, "tierRates": 1},
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found.")
    tier = profile.get("assignedTier")
    caps = None
    if tier in TrainerTierV2.ALL:
        caps = {
            "in_person": TIER_MATRIX[tier]["in_person"]["rate_caps_cents"],
            "virtual": TIER_MATRIX[tier]["virtual"]["rate_caps_cents"],
            "service_fee_in_person_cents": TIER_MATRIX[tier]["in_person"]["service_fee_cents"],
            "service_fee_virtual_cents": TIER_MATRIX[tier]["virtual"]["service_fee_cents"],
            "commission_percent": TIER_MATRIX[tier]["commission_percent"],
        }
    return {
        "tier": tier,
        "tierRates": profile.get("tierRates", {}),
        "tierCaps": caps,
    }


class AdminAssignTierRequest(BaseModel):
    tier: str  # new | certified | specialty


@router.post("/admin/trainers/{trainer_id}/assign-tier")
async def admin_assign_tier(
    trainer_id: str,
    req: AdminAssignTierRequest,
    admin_user: dict = Depends(require_admin),
):
    """Admin sets a trainer's tier (typically during verification approval)."""
    if req.tier not in TrainerTierV2.ALL:
        raise HTTPException(status_code=400, detail=f"Invalid tier '{req.tier}'.")
    try:
        oid = ObjectId(trainer_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid trainer id.")
    user_doc = await db.users.find_one({"_id": oid})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Trainer user not found.")

    await db.trainer_profiles.update_one(
        {"userId": str(oid)},
        {"$set": {
            "assignedTier": req.tier,
            "tierAssignedAt": datetime.utcnow(),
            "tierAssignedBy": str(admin_user["_id"]),
        }},
        upsert=True,
    )
    asyncio.create_task(create_and_send_notification(
        str(oid),
        "Tier Assigned",
        f"You've been placed in the {TIER_MATRIX[req.tier]['label']} tier. You can now set your rates.",
        "tier_assigned",
        {"tier": req.tier},
    ))
    return {"success": True, "tier": req.tier}


# ── Admin Payouts (manual reconciliation) ────────────────────────────
@router.get("/admin/payouts/summary")
async def admin_payouts_summary(admin_user: dict = Depends(require_admin)):
    """Per-trainer totals: amount owed, amount paid, # pending sessions."""
    pipeline = [
        {"$match": {"status": {"$in": ["completed", "confirmed"]}, "trainerId": {"$ne": None}}},
        {"$group": {
            "_id": "$trainerId",
            "totalOwedCents": {"$sum": {"$ifNull": ["$trainerPayoutCents", 0]}},
            "totalPaidCents": {"$sum": {"$cond": [{"$eq": ["$payoutStatus", "paid"]},
                                                   {"$ifNull": ["$trainerPayoutCents", 0]}, 0]}},
            "sessionsCompleted": {"$sum": 1},
            "sessionsPending": {"$sum": {"$cond": [{"$ne": ["$payoutStatus", "paid"]}, 1, 0]}},
        }},
    ]
    rows = await db.sessions.aggregate(pipeline).to_list(1000)

    out = []
    for r in rows:
        trainer_id = r["_id"]
        try:
            user = await db.users.find_one({"_id": ObjectId(trainer_id)},
                                           {"fullName": 1, "email": 1})
        except Exception:
            user = None
        profile = await db.trainer_profiles.find_one(
            {"userId": trainer_id}, {"_id": 0, "assignedTier": 1}
        )
        owed = max(0, r["totalOwedCents"] - r["totalPaidCents"])
        out.append({
            "trainerId": trainer_id,
            "trainerName": user.get("fullName", "Unknown") if user else "Unknown",
            "trainerEmail": user.get("email", "") if user else "",
            "tier": (profile or {}).get("assignedTier"),
            "balanceOwedCents": owed,
            "totalEarnedCents": r["totalOwedCents"],
            "totalPaidCents": r["totalPaidCents"],
            "sessionsCompleted": r["sessionsCompleted"],
            "sessionsPending": r["sessionsPending"],
        })
    out.sort(key=lambda x: x["balanceOwedCents"], reverse=True)
    return {"trainers": out, "count": len(out)}


@router.get("/admin/payouts/{trainer_id}/sessions")
async def admin_trainer_payout_sessions(
    trainer_id: str,
    paid: Optional[bool] = Query(None, description="filter by paid/unpaid; omit for all"),
    admin_user: dict = Depends(require_admin),
):
    """Per-session payout breakdown for a single trainer."""
    q: dict = {"trainerId": trainer_id, "status": {"$in": ["completed", "confirmed"]}}
    if paid is True:
        q["payoutStatus"] = "paid"
    elif paid is False:
        q["payoutStatus"] = {"$ne": "paid"}

    sessions = await db.sessions.find(
        q,
        {"_id": 1, "sessionType": 1, "startTime": 1, "trainerPayoutCents": 1,
         "platformFeeCents": 1, "totalCents": 1, "payoutStatus": 1, "payoutPaidAt": 1,
         "createdAt": 1, "tier": 1, "modality": 1, "durationMin": 1},
    ).sort("startTime", -1).to_list(500)

    return {
        "sessions": [
            {
                "sessionId": str(s["_id"]),
                "sessionType": s.get("sessionType"),
                "tier": s.get("tier"),
                "modality": s.get("modality"),
                "durationMin": s.get("durationMin"),
                "startTime": s.get("startTime") or s.get("createdAt"),
                "trainerPayoutCents": s.get("trainerPayoutCents", 0),
                "platformFeeCents": s.get("platformFeeCents", 0),
                "totalCents": s.get("totalCents", 0),
                "payoutStatus": s.get("payoutStatus", "unpaid"),
                "payoutPaidAt": s.get("payoutPaidAt"),
            }
            for s in sessions
        ],
        "count": len(sessions),
    }


class AdminMarkPayoutPaidRequest(BaseModel):
    sessionIds: List[str]
    note: Optional[str] = None


@router.post("/admin/payouts/mark-paid")
async def admin_mark_payouts_paid(
    req: AdminMarkPayoutPaidRequest,
    admin_user: dict = Depends(require_admin),
):
    """Bulk-mark sessions as paid out (manual Stripe reconciliation)."""
    if not req.sessionIds:
        raise HTTPException(status_code=400, detail="No sessions provided.")
    object_ids = []
    for sid in req.sessionIds:
        try:
            object_ids.append(ObjectId(sid))
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid sessionId '{sid}'.")
    res = await db.sessions.update_many(
        {"_id": {"$in": object_ids}},
        {"$set": {
            "payoutStatus": "paid",
            "payoutPaidAt": datetime.utcnow(),
            "payoutPaidBy": str(admin_user["_id"]),
            "payoutNote": sanitize_text(req.note) if req.note else None,
        }},
    )
    return {"success": True, "matched": res.matched_count, "modified": res.modified_count}


# ============================================================================

# ONBOARDING STATUS / RECEIPTS
# ============================================================================

@router.get("/onboarding/status")
async def get_onboarding_status(current_user: dict = Depends(get_current_user)):
    """Check if user has completed required onboarding steps."""
    roles = current_user.get('roles', [])
    needs = []

    if 'trainer' in roles:
        has_zelle = bool(current_user.get('zelleEmail') or current_user.get('zellePhone'))
        if not has_zelle:
            needs.append({'step': 'zelle_setup', 'label': 'Set up Zelle to receive payouts', 'route': '/trainer/connect-bank'})

    if 'trainee' in roles:
        has_address = bool(current_user.get('homeAddress') or current_user.get('address'))
        if not has_address:
            needs.append({'step': 'address', 'label': 'Add your home address', 'route': '/trainee/edit-address'})

    return {'complete': len(needs) == 0, 'pendingSteps': needs}


@router.get("/receipt-logo")
async def get_receipt_logo():
    """Return Base64-encoded logo for PDF receipts."""
    logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logo_b64.txt")
    try:
        with open(logo_path, "r") as f:
            logo_b64 = f.read().strip()
        return {"logo": logo_b64}
    except FileNotFoundError:
        return {"logo": ""}


@router.get("/receipts/session/{session_id}")
async def get_session_receipt(session_id: str, current_user: dict = Depends(get_current_user)):
    """Generate receipt data for a session."""
    session = await db.sessions.find_one({"_id": ObjectId(session_id)}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_id = str(current_user['_id'])
    is_admin = current_user.get('isAdmin', False)
    is_trainee = session.get('traineeId') == user_id
    is_trainer = session.get('trainerId') == user_id

    if not (is_admin or is_trainee or is_trainer):
        raise HTTPException(status_code=403, detail="Not authorized to view this receipt")

    trainee = await db.users.find_one({"_id": ObjectId(session['traineeId'])}, {"fullName": 1, "email": 1, "homeAddress": 1, "address": 1}) if session.get('traineeId') else None
    trainer = await db.users.find_one({"_id": ObjectId(session['trainerId'])}, {"fullName": 1, "email": 1}) if session.get('trainerId') else None

    total_cents = session.get('totalCents') or session.get('priceCents', 0)
    payout_info = calculate_session_payout(total_cents, session.get('sessionType', 'outdoor'))

    zelle_status = session.get('zellePaymentStatus', 'pending')
    zelle_verified_at = session.get('zellePaymentVerifiedAt')
    receipt_number = f"RR-{session_id[-8:].upper()}"

    receipt = {
        "receiptNumber": receipt_number, "sessionId": session_id,
        "date": (session.get('sessionDateTimeStart') or session.get('createdAt', datetime.utcnow())).isoformat() if isinstance(session.get('sessionDateTimeStart') or session.get('createdAt'), datetime) else str(session.get('sessionDateTimeStart') or session.get('createdAt', '')),
        "sessionType": session.get('sessionType', 'outdoor'),
        "sessionStatus": session.get('status', ''),
        "durationMinutes": session.get('durationMinutes', 30),
        "traineeName": trainee.get('fullName', 'N/A') if trainee else 'N/A',
        "traineeEmail": trainee.get('email', '') if trainee else '',
        "trainerName": trainer.get('fullName', 'N/A') if trainer else 'N/A',
        "trainerEmail": trainer.get('email', '') if trainer else '',
        "location": session.get('outdoorLocationProposal') or session.get('address') or (trainee.get('homeAddress') or trainee.get('address', '') if trainee else ''),
        "totalCents": total_cents,
        "trainerPayoutCents": payout_info['trainer_payout_cents'],
        "platformFeeCents": payout_info['platform_fee_cents'],
        "trainerPercent": payout_info['trainer_percent'],
        "platformPercent": payout_info['platform_percent'],
        "paymentMethod": "Zelle", "paymentStatus": zelle_status,
        "paymentVerifiedAt": zelle_verified_at.isoformat() if isinstance(zelle_verified_at, datetime) else str(zelle_verified_at or ''),
        "createdAt": session.get('createdAt', datetime.utcnow()).isoformat() if isinstance(session.get('createdAt'), datetime) else str(session.get('createdAt', '')),
        "isTrainee": is_trainee, "isTrainer": is_trainer, "isAdmin": is_admin,
    }
    return receipt


@router.get("/admin/receipts")
async def admin_get_all_receipts(admin_user: dict = Depends(require_admin), limit: int = 50, offset: int = 0):
    """Admin: Get all receipts for verified Zelle payments."""
    pipeline = [
        {"$match": {"zellePaymentStatus": "verified"}},
        {"$sort": {"zellePaymentVerifiedAt": -1}},
        {"$skip": offset}, {"$limit": limit},
    ]
    sessions = await db.sessions.aggregate(pipeline).to_list(limit)

    receipts = []
    for s in sessions:
        sid = str(s['_id'])
        trainee = await db.users.find_one({"_id": ObjectId(s['traineeId'])}, {"fullName": 1, "email": 1}) if s.get('traineeId') else None
        trainer = await db.users.find_one({"_id": ObjectId(s['trainerId'])}, {"fullName": 1}) if s.get('trainerId') else None
        total = s.get('totalCents') or s.get('priceCents', 0)
        receipts.append({
            "receiptNumber": f"RR-{sid[-8:].upper()}", "sessionId": sid,
            "traineeName": trainee.get('fullName', 'N/A') if trainee else 'N/A',
            "traineeEmail": trainee.get('email', '') if trainee else '',
            "trainerName": trainer.get('fullName', 'N/A') if trainer else 'N/A',
            "sessionType": s.get('sessionType', ''),
            "totalCents": total,
            "paymentVerifiedAt": s.get('zellePaymentVerifiedAt', s.get('createdAt', '')),
            "status": s.get('status', ''),
        })

    total_count = await db.sessions.count_documents({"zellePaymentStatus": "verified"})
    return {"receipts": receipts, "total": total_count}


@router.get("/trainee/receipts")
async def get_trainee_receipts(current_user: dict = Depends(get_current_user), limit: int = 50, offset: int = 0):
    """Trainee: Get all their receipts (verified Zelle payments)."""
    user_id = str(current_user['_id'])
    query = {"traineeId": user_id, "zellePaymentStatus": "verified"}
    pipeline = [{"$match": query}, {"$sort": {"zellePaymentVerifiedAt": -1}}, {"$skip": offset}, {"$limit": limit}]
    sessions = await db.sessions.aggregate(pipeline).to_list(limit)

    receipts = []
    for s in sessions:
        sid = str(s['_id'])
        trainer = await db.users.find_one({"_id": ObjectId(s['trainerId'])}, {"fullName": 1}) if s.get('trainerId') else None
        total = s.get('totalCents') or s.get('priceCents', 0)
        receipts.append({
            "receiptNumber": f"RR-{sid[-8:].upper()}", "sessionId": sid,
            "trainerName": trainer.get('fullName', 'N/A') if trainer else 'N/A',
            "sessionType": s.get('sessionType', ''), "durationMinutes": s.get('durationMinutes', 30),
            "totalCents": total,
            "date": (s.get('sessionDateTimeStart') or s.get('createdAt', '')),
            "paymentVerifiedAt": s.get('zellePaymentVerifiedAt', ''),
        })
    total_count = await db.sessions.count_documents(query)
    return {"receipts": receipts, "total": total_count}


@router.get("/trainer/receipts")
async def get_trainer_receipts(current_user: dict = Depends(get_current_user), limit: int = 50, offset: int = 0):
    """Trainer: Get all their receipts (verified Zelle payments)."""
    user_id = str(current_user['_id'])
    query = {"trainerId": user_id, "zellePaymentStatus": "verified"}
    pipeline = [{"$match": query}, {"$sort": {"zellePaymentVerifiedAt": -1}}, {"$skip": offset}, {"$limit": limit}]
    sessions = await db.sessions.aggregate(pipeline).to_list(limit)

    receipts = []
    for s in sessions:
        sid = str(s['_id'])
        trainee = await db.users.find_one({"_id": ObjectId(s['traineeId'])}, {"fullName": 1}) if s.get('traineeId') else None
        total = s.get('totalCents') or s.get('priceCents', 0)
        payout = calculate_session_payout(total, s.get('sessionType', 'outdoor'))
        receipts.append({
            "receiptNumber": f"RR-{sid[-8:].upper()}", "sessionId": sid,
            "traineeName": trainee.get('fullName', 'N/A') if trainee else 'N/A',
            "sessionType": s.get('sessionType', ''), "durationMinutes": s.get('durationMinutes', 30),
            "totalCents": total, "trainerPayoutCents": payout['trainer_payout_cents'],
            "date": (s.get('sessionDateTimeStart') or s.get('createdAt', '')),
            "paymentVerifiedAt": s.get('zellePaymentVerifiedAt', ''),
        })
    total_count = await db.sessions.count_documents(query)
    return {"receipts": receipts, "total": total_count}


@router.get("/trainer/connect/status")
async def trainer_connect_status(current_user: dict = Depends(get_current_user)):
    """Check if trainer has Zelle info set up (replaces Stripe Connect status)."""
    has_zelle = bool(current_user.get("zelleEmail") or current_user.get("zellePhone"))
    return {
        "connected": has_zelle, "onboarded": has_zelle, "paymentMethod": "zelle",
        "zelleEmail": current_user.get("zelleEmail", ""),
        "zellePhone": current_user.get("zellePhone", ""),
    }


# ============================================================================
# ADMIN PAYOUTS
# ============================================================================

class AdminPayoutRequest(BaseModel):
    trainerId: str
    amountCents: Optional[int] = None
    notes: Optional[str] = None


@router.get("/admin/payouts/pending")
async def admin_get_pending_payouts(admin_user: dict = Depends(require_admin)):
    """Get list of trainers eligible for payout ($35+ pending balance with Zelle info)."""
    trainers = await db.users.find(
        {'roles': 'trainer', '$or': [{'zelleEmail': {'$exists': True, '$ne': ''}}, {'zellePhone': {'$exists': True, '$ne': ''}}]},
        {'fullName': 1, 'email': 1, 'profilePhoto': 1, 'zelleEmail': 1, 'zellePhone': 1}
    ).to_list(500)

    results = []
    for trainer in trainers:
        trainer_id = str(trainer['_id'])
        completed = await db.sessions.find(
            {'trainerId': trainer_id, 'status': SessionStatus.COMPLETED}, {'trainerEarningsCents': 1}
        ).to_list(1000)
        total_earnings = sum(s.get('trainerEarningsCents', 0) for s in completed)
        payouts = await db.trainer_payouts.find({'trainerId': trainer_id}, {'amountCents': 1}).to_list(1000)
        total_paid = sum(p.get('amountCents', 0) for p in payouts)
        pending = total_earnings - total_paid

        results.append({
            'trainerId': trainer_id, 'trainerName': trainer.get('fullName', 'Unknown'),
            'trainerEmail': trainer.get('email', ''), 'profilePhoto': trainer.get('profilePhoto'),
            'zelleEmail': trainer.get('zelleEmail', ''), 'zellePhone': trainer.get('zellePhone', ''),
            'pendingBalanceCents': pending, 'totalEarningsCents': total_earnings,
            'totalPaidOutCents': total_paid, 'eligible': pending >= PAYOUT_MINIMUM_CENTS,
        })

    results.sort(key=lambda x: x['pendingBalanceCents'], reverse=True)
    return {
        'trainers': results, 'payoutMinimumCents': PAYOUT_MINIMUM_CENTS,
        'totalPendingCents': sum(r['pendingBalanceCents'] for r in results if r['eligible']),
        'eligibleCount': sum(1 for r in results if r['eligible']),
    }


@router.post("/admin/payouts/pay-trainer")
async def admin_pay_trainer(req: AdminPayoutRequest, admin_user: dict = Depends(require_admin)):
    """Admin marks a trainer as paid via Zelle (manual payment tracking)."""
    trainer = await db.users.find_one({'_id': ObjectId(req.trainerId)})
    if not trainer:
        raise HTTPException(status_code=404, detail="Trainer not found")
    if not trainer.get('zelleEmail') and not trainer.get('zellePhone'):
        raise HTTPException(status_code=400, detail="Trainer has not set up Zelle info")

    completed = await db.sessions.find(
        {'trainerId': req.trainerId, 'status': SessionStatus.COMPLETED}, {'trainerEarningsCents': 1}
    ).to_list(1000)
    total_earnings = sum(s.get('trainerEarningsCents', 0) for s in completed)
    payouts = await db.trainer_payouts.find({'trainerId': req.trainerId}, {'amountCents': 1}).to_list(1000)
    total_paid = sum(p.get('amountCents', 0) for p in payouts)
    pending = total_earnings - total_paid

    payout_amount = req.amountCents if req.amountCents else pending
    if payout_amount <= 0:
        raise HTTPException(status_code=400, detail="No balance to pay out")
    if payout_amount > pending:
        raise HTTPException(status_code=400, detail=f"Payout amount (${payout_amount/100:.2f}) exceeds pending balance (${pending/100:.2f})")
    if payout_amount < PAYOUT_MINIMUM_CENTS:
        raise HTTPException(status_code=400, detail=f"Minimum payout is ${PAYOUT_MINIMUM_CENTS/100:.2f}")

    payout_doc = {
        'trainerId': req.trainerId, 'trainerName': trainer.get('fullName', ''),
        'amountCents': payout_amount, 'paymentMethod': 'zelle',
        'zelleEmail': trainer.get('zelleEmail', ''), 'zellePhone': trainer.get('zellePhone', ''),
        'status': 'completed', 'notes': req.notes,
        'processedBy': str(admin_user['_id']), 'createdAt': datetime.utcnow(),
    }
    await db.trainer_payouts.insert_one(payout_doc)

    await db.payout_requests.update_many(
        {'trainerId': req.trainerId, 'status': 'pending'},
        {'$set': {'status': 'completed', 'updatedAt': datetime.utcnow()}}
    )

    asyncio.create_task(create_and_send_notification(
        req.trainerId, "Payout Sent!",
        f"${payout_amount/100:.2f} has been sent to your Zelle account.",
        "payout", {"amount": str(payout_amount)}
    ))

    return {
        'success': True, 'amountCents': payout_amount, 'trainerName': trainer.get('fullName', ''),
        'message': f"${payout_amount/100:.2f} marked as paid to {trainer.get('fullName', 'Trainer')} via Zelle",
    }


@router.post("/admin/payouts/pay-all")
async def admin_pay_all_trainers(admin_user: dict = Depends(require_admin)):
    """Batch mark all eligible trainers as paid via Zelle."""
    trainers = await db.users.find(
        {'roles': 'trainer', '$or': [{'zelleEmail': {'$exists': True, '$ne': ''}}, {'zellePhone': {'$exists': True, '$ne': ''}}]},
        {'fullName': 1, 'zelleEmail': 1, 'zellePhone': 1}
    ).to_list(500)

    results = []
    total_paid = 0

    for trainer in trainers:
        trainer_id = str(trainer['_id'])
        completed = await db.sessions.find(
            {'trainerId': trainer_id, 'status': SessionStatus.COMPLETED}, {'trainerEarningsCents': 1}
        ).to_list(1000)
        total_earnings = sum(s.get('trainerEarningsCents', 0) for s in completed)
        prev_payouts = await db.trainer_payouts.find({'trainerId': trainer_id}, {'amountCents': 1}).to_list(1000)
        total_paid_prev = sum(p.get('amountCents', 0) for p in prev_payouts)
        pending = total_earnings - total_paid_prev

        if pending < PAYOUT_MINIMUM_CENTS:
            continue

        payout_doc = {
            'trainerId': trainer_id, 'trainerName': trainer.get('fullName', ''),
            'amountCents': pending, 'paymentMethod': 'zelle',
            'zelleEmail': trainer.get('zelleEmail', ''), 'zellePhone': trainer.get('zellePhone', ''),
            'status': 'completed', 'notes': 'Batch Zelle payout',
            'processedBy': str(admin_user['_id']), 'createdAt': datetime.utcnow(),
        }
        await db.trainer_payouts.insert_one(payout_doc)

        asyncio.create_task(create_and_send_notification(
            trainer_id, "Payout Sent!",
            f"${pending/100:.2f} has been sent to your Zelle account.",
            "payout", {"amount": str(pending)}
        ))

        results.append({'trainerId': trainer_id, 'trainerName': trainer.get('fullName', ''), 'amountCents': pending})
        total_paid += pending

    return {
        'success': True, 'paidCount': len(results), 'totalPaidCents': total_paid,
        'payouts': results,
        'message': f"Marked {len(results)} trainer(s) as paid - total ${total_paid/100:.2f} via Zelle",
    }


@router.get("/admin/payouts/history")
async def admin_payout_history(limit: int = 50, admin_user: dict = Depends(require_admin)):
    """Get payout history for all trainers."""
    payouts = await db.trainer_payouts.find().sort('createdAt', -1).to_list(limit)
    return {'payouts': [serialize_doc(p) for p in payouts]}


# ============================================================================
# ADMIN TRAINERS / REVENUE (inline admin routes still in server.py scope)
# ============================================================================

@router.get("/admin/trainers")
async def get_all_trainers(current_user: dict = Depends(get_current_user)):
    """Admin: Get all trainers"""
    if not current_user.get('isAdmin'):
        raise HTTPException(status_code=403, detail="Admin access required")
    trainers = await db.trainer_profiles.find().to_list(1000)
    return [serialize_doc(t) for t in trainers]

@router.patch("/admin/trainers/{trainer_id}/verify")
async def verify_trainer(trainer_id: str, verified: bool, current_user: dict = Depends(get_current_user)):
    """Admin: Verify or unverify a trainer"""
    if not current_user.get('isAdmin'):
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.trainer_profiles.update_one(
        {'_id': ObjectId(trainer_id)},
        {'$set': {'isVerified': verified, 'updatedAt': datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Trainer not found")
    return {'success': True, 'verified': verified}

@router.get("/admin/revenue")
async def get_platform_revenue(current_user: dict = Depends(get_current_user)):
    """Admin: Get platform revenue statistics"""
    if not current_user.get('isAdmin'):
        raise HTTPException(status_code=403, detail="Admin access required")
    completed_sessions = await db.sessions.find(
        {'status': SessionStatus.COMPLETED},
        {'platformFeeCents': 1, 'finalSessionPriceCents': 1}
    ).to_list(1000)
    total_platform_fees = sum(s.get('platformFeeCents', 0) for s in completed_sessions)
    total_session_value = sum(s.get('finalSessionPriceCents', 0) for s in completed_sessions)
    return {
        'totalPlatformFeesCents': total_platform_fees,
        'totalSessionValueCents': total_session_value,
        'totalSessions': len(completed_sessions),
        'averageSessionValueCents': total_session_value // len(completed_sessions) if completed_sessions else 0
    }


# ============================================================================
# STRIPE PAYMENT ENDPOINTS
# ============================================================================

from deps import limiter

@router.post("/payments/create-payment-intent")
@limiter.limit("60/minute")
async def create_payment_intent(
    request: Request, amount_cents: int,
    session_id: Optional[str] = None, description: str = "RapidReps Session",
    current_user: dict = Depends(get_current_user)
):
    """Create a Stripe payment intent for a session.

    Negotiation gate (iter95): when a session_id is supplied, the session MUST
    have negotiationStatus == 'agreed' (paymentReady=True) and the current user
    MUST be the trainee on that session. Charges before mutual agreement are
    explicitly rejected to honor the iter93+ contract.
    """
    if amount_cents < 100:
        raise HTTPException(status_code=400, detail="Minimum payment amount is $1.00")
    if amount_cents > 500000:
        raise HTTPException(status_code=400, detail="Amount exceeds maximum allowed ($5,000)")

    # Negotiation / ownership gate
    if session_id:
        try:
            session_oid = ObjectId(session_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid session id.")
        session_doc = await db.sessions.find_one({"_id": session_oid})
        if not session_doc:
            raise HTTPException(status_code=404, detail="Session not found.")
        if str(current_user['_id']) != session_doc.get('traineeId'):
            raise HTTPException(status_code=403, detail="Only the trainee on this session can pay.")
        if not session_doc.get('paymentReady') or session_doc.get('negotiationStatus') != 'agreed':
            raise HTTPException(
                status_code=400,
                detail="Payment unlocks after both parties agree on time and location. Negotiation not yet agreed.",
            )

    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_cents, currency='usd',
            metadata={'user_id': str(current_user['_id']), 'session_id': session_id or '', 'description': description}
        )
        return {"clientSecret": intent.client_secret, "paymentIntentId": intent.id}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/payments/pricing-rules")
async def get_pricing_rules():
    """Get current pricing rules for the platform"""
    return {
        "revenueSplit": {
            "trainerPercent": PricingRules.TRAINER_REVENUE_PERCENT,
            "platformPercent": PricingRules.PLATFORM_REVENUE_PERCENT
        },
        "serviceFeeCents": PricingRules.SERVICE_FEE_CENTS,
        "serviceFee": PricingRules.SERVICE_FEE_CENTS / 100,
        "minimumPrices": {
            "virtual": PricingRules.VIRTUAL_MIN_CENTS / 100,
            "outdoor": PricingRules.OUTDOOR_MIN_CENTS / 100,
            "inHome": PricingRules.IN_HOME_MIN_CENTS / 100,
            "traineeHome": PricingRules.TRAINEE_HOME_MIN_CENTS / 100
        },
        "travelFee": {
            "minCents": PricingRules.TRAVEL_FEE_MIN_CENTS,
            "maxCents": PricingRules.TRAVEL_FEE_MAX_CENTS,
            "trainerPercent": PricingRules.TRAINER_TRAVEL_FEE_PERCENT,
            "platformPercent": PricingRules.PLATFORM_TRAVEL_FEE_PERCENT
        },
        "cancellationFees": {
            "virtual": PricingRules.CANCELLATION_FEE_VIRTUAL / 100,
            "outdoor": PricingRules.CANCELLATION_FEE_OUTDOOR / 100,
            "inHome": PricingRules.CANCELLATION_FEE_IN_HOME / 100
        },
        "boostPrices": {
            "daily": PricingRules.BOOST_DAILY_CENTS / 100,
            "weekly": PricingRules.BOOST_WEEKLY_CENTS / 100,
            "monthly": PricingRules.BOOST_MONTHLY_CENTS / 100
        },
        "membership": {
            "monthlyPrice": PricingRules.MEMBERSHIP_MONTHLY_CENTS / 100,
            "sessionDiscountPercent": PricingRules.MEMBERSHIP_SESSION_DISCOUNT_PERCENT,
            "matchingPriorityBonus": PricingRules.MEMBERSHIP_MATCHING_PRIORITY_BONUS,
            "benefits": [
                f"{PricingRules.MEMBERSHIP_SESSION_DISCOUNT_PERCENT}% off all sessions",
                "1 free profile Boost per month",
                "Priority matching (faster trainer response)",
                "Early access to elite trainers"
            ]
        }
    }

@router.post("/payments/calculate-session-cost")
async def calculate_session_cost(session_type: str, session_price_cents: int, travel_fee_cents: int = 0):
    """Calculate cost breakdown for a session"""
    session_split = calculate_session_payout(session_price_cents, session_type)
    travel_split = calculate_travel_fee_split(travel_fee_cents) if travel_fee_cents > 0 else None

    total_cost = session_price_cents + travel_fee_cents
    service_fee = PricingRules.SERVICE_FEE_CENTS
    trainer_total = session_split['trainer_payout_cents'] + (travel_split['trainer_payout_cents'] if travel_split else 0)
    platform_total = session_split['platform_fee_cents'] + (travel_split['platform_fee_cents'] if travel_split else 0) + service_fee
    total_charged = total_cost + service_fee

    return {
        "sessionPrice": session_split, "travelFee": travel_split,
        "serviceFeeCents": service_fee,
        "totals": {
            "sessionSubtotalCents": total_cost, "serviceFeeCents": service_fee,
            "totalChargedCents": total_charged, "trainerPayoutCents": trainer_total,
            "platformFeeCents": platform_total, "totalChargedDollars": total_charged / 100,
            "trainerPayoutDollars": trainer_total / 100, "platformFeeDollars": platform_total / 100
        }
    }

@router.post("/memberships/subscribe")
async def subscribe_membership(current_user: dict = Depends(get_current_user)):
    """Subscribe to RapidReps membership ($19.99/month) — creates Stripe PaymentIntent"""
    user_id = str(current_user['_id'])
    existing = await db.memberships.find_one({'userId': user_id, 'status': MembershipStatus.ACTIVE})
    if existing:
        raise HTTPException(status_code=400, detail="Already have an active membership")

    amount_cents = PricingRules.MEMBERSHIP_MONTHLY_CENTS
    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_cents, currency='usd',
            metadata={'user_id': user_id, 'type': 'membership', 'description': 'RapidReps Monthly Membership'}
        )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Payment setup failed: {str(e)}")

    now = datetime.utcnow()
    membership = {
        'userId': user_id, 'status': 'pending_payment', 'monthlyPriceCents': amount_cents,
        'paymentIntentId': intent.id, 'startDate': now, 'nextBillingDate': now + timedelta(days=30),
        'freeBoostsRemaining': 1, 'createdAt': now
    }
    result = await db.memberships.insert_one(membership)
    return {
        "clientSecret": intent.client_secret, "paymentIntentId": intent.id,
        "membershipId": str(result.inserted_id), "amountCents": amount_cents
    }


@router.post("/memberships/{membership_id}/confirm-payment")
async def confirm_membership_payment(membership_id: str, current_user: dict = Depends(get_current_user)):
    """Confirm membership payment after Stripe payment succeeds"""
    try:
        oid = ObjectId(membership_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid membership ID")

    membership = await db.memberships.find_one({'_id': oid})
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    if membership['userId'] != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Not your membership")
    if membership.get('status') == MembershipStatus.ACTIVE:
        return {"success": True, "message": "Membership already active"}

    payment_intent_id = membership.get('paymentIntentId')
    if payment_intent_id:
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            if intent.status != 'succeeded':
                raise HTTPException(status_code=400, detail=f"Payment not completed. Status: {intent.status}")
        except stripe.error.StripeError:
            pass

    await db.memberships.update_one(
        {'_id': oid},
        {'$set': {'status': MembershipStatus.ACTIVE, 'activatedAt': datetime.utcnow()}}
    )
    await db.transactions.insert_one({
        'userId': membership['userId'], 'transactionType': 'membership_payment',
        'amountCents': membership['monthlyPriceCents'], 'status': 'completed',
        'paymentIntentId': payment_intent_id, 'description': 'Monthly Membership - $19.99',
        'createdAt': datetime.utcnow()
    })
    return {"success": True, "message": "Membership activated successfully"}

@router.get("/memberships/my-membership")
async def get_my_membership(current_user: dict = Depends(get_current_user)):
    """Get current user's membership status"""
    user_id = str(current_user['_id'])
    membership = await db.memberships.find_one({'userId': user_id, 'status': MembershipStatus.ACTIVE})
    if not membership:
        return {"hasMembership": False, "membership": None}
    return {"hasMembership": True, "membership": serialize_doc(membership)}

@router.post("/boosts/purchase")
async def purchase_boost(boost_type: str, current_user: dict = Depends(get_current_user)):
    """Purchase a visibility boost — creates Stripe PaymentIntent"""
    if UserRole.TRAINER not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Only trainers can purchase boosts")

    user_id = str(current_user['_id'])
    price_map = {
        BoostType.DAILY: PricingRules.BOOST_DAILY_CENTS,
        BoostType.WEEKLY: PricingRules.BOOST_WEEKLY_CENTS,
        BoostType.MONTHLY: PricingRules.BOOST_MONTHLY_CENTS
    }
    duration_map = {BoostType.DAILY: 1, BoostType.WEEKLY: 7, BoostType.MONTHLY: 30}

    price_cents = price_map.get(boost_type)
    duration_days = duration_map.get(boost_type)
    if not price_cents:
        raise HTTPException(status_code=400, detail="Invalid boost type")

    membership = await db.memberships.find_one({
        'userId': user_id, 'status': MembershipStatus.ACTIVE, 'freeBoostsRemaining': {'$gt': 0}
    })
    is_free = membership is not None

    if is_free:
        await db.memberships.update_one({'_id': membership['_id']}, {'$inc': {'freeBoostsRemaining': -1}})
        now = datetime.utcnow()
        boost = {
            'trainerId': user_id, 'boostType': boost_type, 'priceCents': 0,
            'startDate': now, 'endDate': now + timedelta(days=duration_days),
            'isActive': True, 'isFreeBoost': True, 'status': 'active', 'createdAt': now
        }
        result = await db.boosts.insert_one(boost)
        return {"success": True, "boostId": str(result.inserted_id), "isFreeBoost": True, "message": "Free boost activated from membership!"}

    try:
        intent = stripe.PaymentIntent.create(
            amount=price_cents, currency='usd',
            metadata={'user_id': user_id, 'type': 'boost', 'boost_type': boost_type,
                      'description': f'RapidReps {boost_type.capitalize()} Visibility Boost'}
        )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Payment setup failed: {str(e)}")

    now = datetime.utcnow()
    boost = {
        'trainerId': user_id, 'boostType': boost_type, 'priceCents': price_cents,
        'paymentIntentId': intent.id, 'startDate': now, 'endDate': now + timedelta(days=duration_days),
        'isActive': False, 'isFreeBoost': False, 'status': 'pending_payment', 'createdAt': now
    }
    result = await db.boosts.insert_one(boost)
    return {
        "clientSecret": intent.client_secret, "paymentIntentId": intent.id,
        "boostId": str(result.inserted_id), "amountCents": price_cents, "isFreeBoost": False
    }


@router.post("/boosts/{boost_id}/confirm-payment")
async def confirm_boost_payment(boost_id: str, current_user: dict = Depends(get_current_user)):
    """Confirm boost payment after Stripe payment succeeds"""
    try:
        oid = ObjectId(boost_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid boost ID")

    boost = await db.boosts.find_one({'_id': oid})
    if not boost:
        raise HTTPException(status_code=404, detail="Boost not found")
    if boost['trainerId'] != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Not your boost")
    if boost.get('isActive'):
        return {"success": True, "message": "Boost already active"}

    payment_intent_id = boost.get('paymentIntentId')
    if payment_intent_id:
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            if intent.status != 'succeeded':
                raise HTTPException(status_code=400, detail=f"Payment not completed. Status: {intent.status}")
        except stripe.error.StripeError:
            pass

    await db.boosts.update_one(
        {'_id': oid},
        {'$set': {'isActive': True, 'status': 'active', 'activatedAt': datetime.utcnow()}}
    )
    await db.transactions.insert_one({
        'userId': boost['trainerId'], 'transactionType': 'boost_payment',
        'amountCents': boost['priceCents'], 'status': 'completed',
        'paymentIntentId': payment_intent_id,
        'description': f"{boost['boostType'].capitalize()} Visibility Boost",
        'createdAt': datetime.utcnow()
    })
    return {"success": True, "message": "Boost activated successfully"}


@router.get("/boosts/my-boosts")
async def get_my_boosts(current_user: dict = Depends(get_current_user)):
    """Get trainer's active and past boosts"""
    user_id = str(current_user['_id'])
    boosts = await db.boosts.find({'trainerId': user_id}).sort('createdAt', -1).to_list(50)
    return {'boosts': [serialize_doc(b) for b in boosts]}


@router.get("/boosts/analytics")
async def get_boost_analytics(current_user: dict = Depends(get_current_user)):
    """Get boost performance analytics for the trainer."""
    user_id = str(current_user['_id'])
    now = datetime.utcnow()

    active_boost = await db.boosts.find_one({
        'trainerId': user_id, 'isActive': True, 'endDate': {'$gte': now},
    })

    thirty_days_ago = (now - timedelta(days=30)).strftime('%Y-%m-%d')
    analytics = await db.boost_analytics.find({
        'trainerId': user_id, 'date': {'$gte': thirty_days_ago},
    }).sort('date', -1).to_list(30)

    total_impressions = sum(a.get('impressions', 0) for a in analytics)
    total_views = sum(a.get('profileViews', 0) for a in analytics)
    total_clicks = sum(a.get('clicks', 0) for a in analytics)

    daily_data = [{'date': a.get('date'), 'impressions': a.get('impressions', 0),
                   'profileViews': a.get('profileViews', 0), 'clicks': a.get('clicks', 0)} for a in analytics]

    return {
        'hasActiveBoost': active_boost is not None,
        'boostType': active_boost.get('boostType') if active_boost else None,
        'boostEndsAt': active_boost.get('endDate').isoformat() if active_boost and active_boost.get('endDate') else None,
        'totalImpressions': total_impressions, 'totalProfileViews': total_views,
        'totalClicks': total_clicks,
        'clickThroughRate': round(total_clicks / max(total_impressions, 1) * 100, 1),
        'dailyData': daily_data,
    }


@router.post("/boosts/{trainer_id}/track-view")
async def track_boost_view(trainer_id: str):
    """Track a profile view for a boosted trainer."""
    now = datetime.utcnow()
    await db.boost_analytics.update_one(
        {'trainerId': trainer_id, 'date': now.strftime('%Y-%m-%d')},
        {'$inc': {'profileViews': 1, 'clicks': 1}},
        upsert=True,
    )
    return {'success': True}


@router.get("/memberships/member-badge/{user_id}")
async def get_member_badge(user_id: str):
    """Check if a user has an active membership (public endpoint for badges)."""
    membership = await db.memberships.find_one({'userId': user_id, 'status': MembershipStatus.ACTIVE})
    if membership:
        return {
            'isMember': True,
            'memberSince': membership.get('activatedAt', membership.get('startDate')).isoformat() if membership.get('activatedAt') or membership.get('startDate') else None,
            'benefits': ['10% off all sessions', '1 free profile Boost per month', 'Priority matching', 'Early access to elite trainers'],
        }
    return {'isMember': False}
