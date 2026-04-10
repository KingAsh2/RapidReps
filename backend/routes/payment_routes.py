"""Payment routes: Ratings, earnings, payouts, Zelle, Stripe, memberships, boosts, receipts."""
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
# ZELLE PAYMENT SYSTEM
# ============================================================================

class ZelleSettingsUpdate(BaseModel):
    zelleEmail: Optional[str] = None
    zellePhone: Optional[str] = None


@router.get("/settings/zelle")
async def get_zelle_settings():
    """Get platform Zelle payment info (public - trainee needs to see this)."""
    settings = await db.app_settings.find_one({"key": "zelle_config"}, {"_id": 0, "key": 0})
    if not settings:
        return {"zelleEmail": "", "zellePhone": ""}
    return {"zelleEmail": settings.get("zelleEmail", ""), "zellePhone": settings.get("zellePhone", "")}


@router.put("/admin/settings/zelle")
async def update_zelle_settings(req: ZelleSettingsUpdate, admin_user: dict = Depends(require_admin)):
    """Admin: Update platform Zelle payment info."""
    update_fields = {"updatedAt": datetime.utcnow()}
    if req.zelleEmail is not None: update_fields["zelleEmail"] = req.zelleEmail
    if req.zellePhone is not None: update_fields["zellePhone"] = req.zellePhone
    await db.app_settings.update_one({"key": "zelle_config"}, {"$set": update_fields}, upsert=True)
    return {"success": True, "message": "Zelle settings updated"}


class ZelleMarkSentRequest(BaseModel):
    sessionId: str
    senderName: Optional[str] = None
    notes: Optional[str] = None


@router.post("/payments/zelle/mark-sent")
async def zelle_mark_payment_sent(req: ZelleMarkSentRequest, current_user: dict = Depends(get_current_user)):
    """Trainee marks that they have sent Zelle payment for a session."""
    user_id = str(current_user['_id'])
    session = await db.sessions.find_one({"_id": ObjectId(req.sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.get('traineeId') != user_id:
        raise HTTPException(status_code=403, detail="Not your session")
    if session.get('sessionType') == 'outdoor':
        if session.get('outdoorLocationStatus') != 'agreed':
            raise HTTPException(status_code=400, detail="Both trainer and trainee must verify/agree on the outdoor location before payment can be sent.")

    await db.sessions.update_one(
        {"_id": ObjectId(req.sessionId)},
        {"$set": {
            "zellePaymentStatus": "sent", "zellePaymentSentAt": datetime.utcnow(),
            "zellePaymentSenderName": req.senderName or current_user.get('fullName', ''),
            "zellePaymentNotes": sanitize_text(req.notes) if req.notes else None,
        }}
    )

    admins = await db.users.find({"isAdmin": True}).to_list(10)
    for admin in admins:
        asyncio.create_task(create_and_send_notification(
            str(admin['_id']), "Zelle Payment Received",
            f"{current_user.get('fullName', 'A trainee')} marked Zelle payment as sent for session.",
            "payment", {"sessionId": req.sessionId}
        ))

    return {"success": True, "message": "Payment marked as sent. Admin will verify shortly."}


@router.post("/admin/payments/verify-zelle/{session_id}")
async def admin_verify_zelle_payment(session_id: str, admin_user: dict = Depends(require_admin)):
    """Admin verifies that Zelle payment was received. Session becomes confirmed."""
    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    update_doc = {
        "zellePaymentStatus": "verified", "zellePaymentVerifiedAt": datetime.utcnow(),
        "zellePaymentVerifiedBy": str(admin_user['_id']), "paymentMethod": "zelle",
    }
    if session.get('status') in ['requested', 'payment_pending', 'pending']:
        update_doc['status'] = 'confirmed'

    await db.sessions.update_one({"_id": ObjectId(session_id)}, {"$set": update_doc})

    amount = session.get('priceCents', 0) or session.get('totalCents', 0)
    if amount:
        payout_info = calculate_session_payout(amount, session.get('sessionType', 'outdoor'))
        await db.transactions.insert_one({
            'userId': session.get('traineeId', ''), 'sessionId': session_id,
            'transactionType': TransactionType.SESSION_PAYMENT, 'amountCents': amount,
            'trainerPayoutCents': payout_info['trainer_payout_cents'],
            'platformFeeCents': payout_info['platform_fee_cents'],
            'status': PaymentStatus.COMPLETED, 'paymentMethod': 'zelle',
            'description': f"Zelle payment for {session.get('sessionType', 'training')} session",
            'createdAt': datetime.utcnow(),
        })

    asyncio.create_task(create_and_send_notification(
        session.get('traineeId', ''), "Payment Verified!",
        "Your Zelle payment has been verified and your session is confirmed! Your receipt is ready to download.",
        "payment", {"sessionId": session_id, "action": "view_receipt"}
    ))
    if session.get('trainerId'):
        asyncio.create_task(create_and_send_notification(
            session['trainerId'], "Session Confirmed - Receipt Ready!",
            "Payment verified and session confirmed. Your earnings receipt is ready to download.",
            "session_confirmed", {"sessionId": session_id, "action": "view_receipt"}
        ))

    return {"success": True, "message": "Payment verified. Session confirmed.", "newStatus": update_doc.get('status', session.get('status'))}


@router.get("/admin/payments/pending-zelle")
async def admin_get_pending_zelle_payments(admin_user: dict = Depends(require_admin)):
    """Admin: Get all sessions with pending Zelle payments to verify."""
    sessions = await db.sessions.find(
        {"zellePaymentStatus": "sent"},
        {"_id": 1, "traineeId": 1, "trainerId": 1, "sessionType": 1, "priceCents": 1,
         "totalCents": 1, "zellePaymentSentAt": 1, "zellePaymentSenderName": 1,
         "zellePaymentNotes": 1, "status": 1, "createdAt": 1}
    ).sort("zellePaymentSentAt", -1).to_list(100)

    results = []
    for s in sessions:
        trainee = await db.users.find_one({"_id": ObjectId(s['traineeId'])}, {"fullName": 1, "email": 1}) if s.get('traineeId') else None
        results.append({
            "sessionId": str(s['_id']),
            "traineeName": trainee.get('fullName', 'Unknown') if trainee else 'Unknown',
            "traineeEmail": trainee.get('email', '') if trainee else '',
            "sessionType": s.get('sessionType', ''),
            "amountCents": s.get('totalCents') or s.get('priceCents', 0),
            "senderName": s.get('zellePaymentSenderName', ''),
            "sentAt": s.get('zellePaymentSentAt', s.get('createdAt', '')),
            "notes": s.get('zellePaymentNotes', ''),
            "sessionStatus": s.get('status', ''),
        })
    return {"pendingPayments": results, "count": len(results)}


class TrainerZelleInfoUpdate(BaseModel):
    zelleEmail: Optional[str] = None
    zellePhone: Optional[str] = None


@router.post("/trainer/zelle-info")
async def save_trainer_zelle_info(req: TrainerZelleInfoUpdate, current_user: dict = Depends(get_current_user)):
    """Trainer saves their Zelle contact info for receiving payouts."""
    update_fields = {"zelleInfoUpdatedAt": datetime.utcnow()}
    if req.zelleEmail is not None: update_fields["zelleEmail"] = req.zelleEmail
    if req.zellePhone is not None: update_fields["zellePhone"] = req.zellePhone
    await db.users.update_one({"_id": current_user['_id']}, {"$set": update_fields})
    return {"success": True, "message": "Zelle info saved"}


@router.get("/trainer/zelle-info")
async def get_trainer_zelle_info(current_user: dict = Depends(get_current_user)):
    """Trainer gets their saved Zelle info."""
    return {
        "zelleEmail": current_user.get("zelleEmail", ""),
        "zellePhone": current_user.get("zellePhone", ""),
        "hasZelleInfo": bool(current_user.get("zelleEmail") or current_user.get("zellePhone")),
    }


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
    """Create a Stripe payment intent for a session"""
    if amount_cents < 100:
        raise HTTPException(status_code=400, detail="Minimum payment amount is $1.00")
    if amount_cents > 500000:
        raise HTTPException(status_code=400, detail="Amount exceeds maximum allowed ($5,000)")
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
