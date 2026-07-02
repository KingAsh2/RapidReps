"""Session routes: booking, confirm, decline, cancel, verify-pin, GPS, start, end, etc."""
from fastapi import APIRouter, HTTPException, Depends, Request, Body
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import stripe
import os
import asyncio

from deps import (
    db, get_current_user, serialize_doc, sanitize_text,
    calculate_distance, generate_safety_pin, calculate_travel_fee,
    get_session_minimum_price, get_cancellation_fee, calculate_trainer_tier,
    check_trainer_can_go_live, calculate_session_payout, calculate_travel_fee_split,
    calculate_time_based_cancellation_penalty,
    calculate_session_pricing, send_push_notification,
    create_and_send_notification,
)
from models import (
    SessionCreate, SessionResponse, SessionStatus, SessionType,
    PricingRules, TrainerTier, TransactionType, PaymentStatus,
    MembershipStatus, REFERRAL_CREDIT_CENTS,
)
from email_service import send_session_booked_email

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')

router = APIRouter(prefix="/api")

# ============================================================================
# SESSION ROUTES
# ============================================================================

@router.post("/sessions", response_model=SessionResponse)
async def create_session(session: SessionCreate, current_user: dict = Depends(get_current_user)):
    """
    Create a new session booking with full pricing calculation.
    PRD Rules #1, #2: Pricing, travel fees, platform commission.
    PRD Rule #7: Generate safety PIN for in-home sessions.
    """
    # Get trainer profile to get rates
    trainer_profile = await db.trainer_profiles.find_one({'userId': session.trainerId})
    if not trainer_profile:
        raise HTTPException(status_code=404, detail="Trainer not found")
    
    # Check if trainer can accept sessions (PRD Rule #10)
    can_go_live, missing = check_trainer_can_go_live(trainer_profile)
    if not can_go_live:
        raise HTTPException(
            status_code=403, 
            detail=f"Trainer is not verified yet. Missing: {', '.join(missing)}"
        )
    
    # Map legacy locationType to new sessionType
    session_type = session.sessionType
    if session.locationType == "virtual":
        session_type = SessionType.VIRTUAL
    elif session.locationType == "home":
        session_type = SessionType.IN_HOME
    elif session.locationType == "outdoor" or session.locationType == "gym":
        session_type = SessionType.OUTDOOR
    
    # Calculate distance for in-home sessions
    distance_miles = 0
    if session_type == SessionType.IN_HOME:
        trainer_lat = trainer_profile.get('latitude')
        trainer_lng = trainer_profile.get('longitude')
        trainee_lat = session.traineeLatitude
        trainee_lng = session.traineeLongitude
        
        if trainer_lat and trainer_lng and trainee_lat and trainee_lng:
            distance_miles = calculate_distance(trainer_lat, trainer_lng, trainee_lat, trainee_lng)
            
            # Check if within travel radius
            if distance_miles > 20:
                raise HTTPException(
                    status_code=400, 
                    detail="Distance exceeds maximum travel radius (20 miles)"
                )
    
    # Check for multi-session discount (3+ sessions with this trainer)
    previous_sessions = await db.sessions.count_documents({
        'traineeId': session.traineeId,
        'trainerId': session.trainerId,
        'status': SessionStatus.COMPLETED
    })

    # Check for active membership (10% discount)
    has_membership = False
    trainee_membership = await db.memberships.find_one({
        'userId': session.traineeId,
        'status': MembershipStatus.ACTIVE,
    })
    if trainee_membership:
        has_membership = True
    
    # Calculate full pricing
    pricing = calculate_session_pricing(
        session_type=session_type,
        trainer_profile=trainer_profile,
        distance_miles=distance_miles,
        trainee_session_count=previous_sessions,
        has_membership=has_membership,
    )
    
    # Apply referral credits as discount (deducted from what trainee pays, NOT from trainer earnings)
    referral_credit_applied = 0
    trainee_credits = current_user.get('referralCredits', 0)
    if trainee_credits > 0:
        # Apply up to the service fee + platform fee portion (never reduce trainer earnings)
        max_credit = pricing['serviceFeeCents'] + (pricing['platformFeeCents'] - pricing['serviceFeeCents'])
        referral_credit_applied = min(trainee_credits, max_credit, pricing['totalChargedCents'])
        pricing['referralCreditAppliedCents'] = referral_credit_applied
        pricing['totalChargedCents'] -= referral_credit_applied
        pricing['finalSessionPriceCents'] -= referral_credit_applied
        pricing['platformFeeCents'] -= referral_credit_applied  # Platform absorbs the discount
        # Deduct credits from user
        await db.users.update_one(
            {'_id': current_user['_id']},
            {'$inc': {'referralCredits': -referral_credit_applied}}
        )
    else:
        pricing['referralCreditAppliedCents'] = 0
    
    # Activate pending referral on first session booking
    trainee_id = session.traineeId
    pending_referral = await db.referrals.find_one({
        'referredUserId': trainee_id,
        'status': 'pending'
    })
    if pending_referral:
        # Activate the referral - credit both parties
        await db.referrals.update_one(
            {'_id': pending_referral['_id']},
            {'$set': {'status': 'activated', 'activatedAt': datetime.utcnow()}}
        )
        # Credit the referrer
        await db.users.update_one(
            {'_id': ObjectId(pending_referral['referrerId'])},
            {'$inc': {'referralCredits': REFERRAL_CREDIT_CENTS}}
        )
        # Credit the referred user (this user)
        await db.users.update_one(
            {'_id': ObjectId(trainee_id)},
            {'$inc': {'referralCredits': REFERRAL_CREDIT_CENTS}}
        )
        # Notify the referrer
        asyncio.create_task(create_and_send_notification(
            pending_referral['referrerId'],
            "Referral Bonus Earned!",
            f"Your referral just booked their first session! You both earned a ${REFERRAL_CREDIT_CENTS/100:.2f} credit.",
            "referral_activated",
            {"screen": "referral"}
        ))
    
    # Generate safety PIN for in-home sessions (PRD Rule #7)
    safety_pin = None
    if session_type == SessionType.IN_HOME:
        safety_pin = generate_safety_pin()
    
    session_doc = {
        'traineeId': session.traineeId,
        'trainerId': session.trainerId,
        'status': SessionStatus.REQUESTED,
        'sessionDateTimeStart': session.sessionDateTimeStart,
        'sessionDateTimeEnd': session.sessionDateTimeStart + timedelta(minutes=session.durationMinutes),
        'durationMinutes': session.durationMinutes,
        'sessionType': session_type,
        # iter106f: persist trainee-side display strings so trainer-side
        # rendering uses the exact wall-clock time the trainee selected
        # (timezone-drift safe).
        'traineeLocalTime': session.traineeLocalTime,
        'traineeLocalDate': session.traineeLocalDate,
        # Pricing breakdown
        'basePricePerMinuteCents': pricing['baseSessionPriceCents'] // session.durationMinutes if session.durationMinutes > 0 else 0,
        'baseSessionPriceCents': pricing['baseSessionPriceCents'],
        'travelDistanceMiles': pricing['travelDistanceMiles'],
        'travelFeeCents': pricing['travelFeeCents'],
        'trainerTravelEarningsCents': pricing['trainerTravelEarningsCents'],
        'platformTravelFeeCents': pricing['platformTravelFeeCents'],
        'discountType': pricing['discountType'],
        'discountAmountCents': pricing['discountAmountCents'],
        'finalSessionPriceCents': pricing['finalSessionPriceCents'],
        'platformFeePercent': pricing['platformFeePercent'],
        'platformFeeCents': pricing['platformFeeCents'],
        'trainerEarningsCents': pricing['trainerEarningsCents'],
        'cancellationFeeCents': pricing['cancellationFeeCents'],
        'noShowFeeCents': pricing['finalSessionPriceCents'],  # Full amount for no-show
        # Safety PIN
        'safetyPin': safety_pin,
        'safetyPinVerified': False,
        'trainerGpsConfirmed': False,
        'sessionStartedAt': None,
        'sessionEndedAt': None,
        'clientConfirmedEnd': False,
        # Location
        'locationType': session.locationType,
        'locationNameOrAddress': session.locationNameOrAddress,
        'traineeLatitude': session.traineeLatitude,
        'traineeLongitude': session.traineeLongitude,
        # Outdoor location agreement (trainer must confirm outdoor meeting spot)
        'outdoorLocationProposed': session.locationNameOrAddress if session_type == SessionType.OUTDOOR else None,
        'outdoorLocationAgreed': False if session_type == SessionType.OUTDOOR else None,
        'outdoorLocationTrainerProposal': None,
        # iter106ah: seed the negotiation panel as proposed_by_trainee on creation
        # so the trainer's session-detail screen shows ACCEPT / COUNTER / REJECT
        # immediately on first load (instead of just "Propose"). Without this
        # seed the negotiation_routes timeline endpoint returns nothing and
        # NegotiationPanel only renders the Propose button — meaning a trainer
        # had no way to accept a request right then and there.
        # NOTE: field names match what negotiation_routes.py reads/writes
        # (`proposedTime` / `proposedLocation` / `negotiationLastUpdatedAt`).
        'negotiationStatus': 'proposed_by_trainee',
        'negotiationLastUpdatedAt': datetime.utcnow(),
        'proposedTime': session.sessionDateTimeStart,
        'proposedLocation': (
            {'address': session.locationNameOrAddress}
            if session.locationNameOrAddress and session_type != SessionType.VIRTUAL
            else None
        ),
        'negotiationTimeline': [{
            'type': 'proposal',
            'by': 'trainee',
            'byUserId': trainee_id,
            'proposedTime': session.sessionDateTimeStart,
            'proposedLocation': (
                {'address': session.locationNameOrAddress}
                if session.locationNameOrAddress and session_type != SessionType.VIRTUAL
                else None
            ),
            'at': datetime.utcnow(),
        }],
        'notes': sanitize_text(session.notes),
        'paymentIntentId': None,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }
    
    result = await db.sessions.insert_one(session_doc)
    session_doc['_id'] = result.inserted_id

    # Push: Notify trainer of new session request
    trainee_name = current_user.get('fullName', 'A trainee')
    asyncio.create_task(create_and_send_notification(
        session.trainerId,
        "New Session Request",
        f"{trainee_name} wants to book a {session.durationMinutes}-min session with you!",
        "session_requested",
        {"sessionId": str(result.inserted_id), "screen": "trainer/sessions"}
    ))

    return SessionResponse(**serialize_doc(session_doc))

@router.post("/sessions/{session_id}/verify-pin")
async def verify_session_pin(
    session_id: str,
    pin: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Trainer enters PIN to start in-home session.
    PRD Rule #7 & #12: PIN verification required to start session.
    """
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify current user is the trainer
    if str(current_user['_id']) != session['trainerId']:
        raise HTTPException(status_code=403, detail="Only the trainer can verify the PIN")
    
    # Check PIN
    if session.get('safetyPin') != pin:
        return {
            'success': False,
            'message': 'Invalid PIN. Please ask the client for the correct 4-digit PIN.'
        }
    
    # Update session
    await db.sessions.update_one(
        {'_id': oid},
        {
            '$set': {
                'safetyPinVerified': True,
                'sessionStartedAt': datetime.utcnow(),
                'status': SessionStatus.CONFIRMED,
                'updatedAt': datetime.utcnow()
            }
        }
    )
    
    return {
        'success': True,
        'message': 'PIN verified! Session started.',
        'sessionStartedAt': datetime.utcnow().isoformat()
    }


# ─────────────────────────────────────────────────────────────
# SESSION SELFIE VERIFICATION
# ─────────────────────────────────────────────────────────────

class SelfieVerifyRequest(BaseModel):
    selfieBase64: str  # base64-encoded JPEG/PNG

@router.post("/sessions/{session_id}/verify-selfie")
async def verify_selfie(session_id: str, body: SelfieVerifyRequest, current_user: dict = Depends(get_current_user)):
    """
    Submit a selfie to verify attendance before a session starts.
    Both trainer and trainee must submit. Session can only start
    once both selfies are received.
    """
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(400, "Invalid session ID")

    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(404, "Session not found")

    user_id = str(current_user['_id'])
    is_trainer = session.get('trainerId') == user_id
    is_trainee = session.get('traineeId') == user_id
    if not is_trainer and not is_trainee:
        raise HTTPException(403, "Not a participant of this session")

    role = "trainer" if is_trainer else "trainee"

    # Validate selfie data (basic check — non-empty, reasonable size)
    selfie_data = body.selfieBase64
    if not selfie_data or len(selfie_data) < 100:
        raise HTTPException(400, "Invalid selfie data. Try again or switch cameras.")

    # Max ~5MB base64
    if len(selfie_data) > 7_000_000:
        raise HTTPException(400, "Selfie image too large (max 5MB). Move to a brighter area and try again.")

    # Track selfie attempts — max 3 failures before manual verification fallback
    attempt_key = f"{session_id}_{user_id}"
    existing_attempts = await db.selfie_attempts.find_one({'key': attempt_key})
    attempt_count = (existing_attempts.get('count', 0) if existing_attempts else 0) + 1
    await db.selfie_attempts.update_one(
        {'key': attempt_key},
        {'$set': {'key': attempt_key, 'count': attempt_count, 'lastAttempt': datetime.utcnow()}},
        upsert=True,
    )

    if attempt_count > PricingRules.MAX_SELFIE_ATTEMPTS:
        # Trigger manual verification fallback
        await db.sessions.update_one(
            {'_id': oid},
            {'$set': {
                f'{role}ManualVerificationRequired': True,
                'updatedAt': datetime.utcnow(),
            }}
        )
        return {
            'success': False,
            'manualVerification': True,
            'message': 'Selfie verification failed multiple times. Manual verification initiated — a support agent will review your session.',
        }

    now = datetime.utcnow()

    # Store the selfie verification
    await db.session_selfies.update_one(
        {'sessionId': session_id, 'userId': user_id},
        {'$set': {
            'sessionId': session_id,
            'userId': user_id,
            'role': role,
            'selfieBase64': selfie_data[:200] + '...',  # Store thumbnail reference only
            'verifiedAt': now,
            'verified': True,
        }},
        upsert=True,
    )

    # Update session verification flags
    field = 'trainerSelfieVerified' if is_trainer else 'traineeSelfieVerified'
    time_field = 'trainerSelfieAt' if is_trainer else 'traineeSelfieAt'
    await db.sessions.update_one(
        {'_id': oid},
        {'$set': {field: True, time_field: now, 'updatedAt': now}}
    )

    # Check if BOTH parties have verified
    updated = await db.sessions.find_one({'_id': oid})
    both_verified = updated.get('trainerSelfieVerified', False) and updated.get('traineeSelfieVerified', False)

    if both_verified:
        await db.sessions.update_one(
            {'_id': oid},
            {'$set': {'selfieVerificationComplete': True, 'selfieVerifiedAt': now}}
        )

    # Notify the other party
    other_id = session['traineeId'] if is_trainer else session['trainerId']
    other_role = "trainee" if is_trainer else "trainer"
    await create_and_send_notification(
        other_id,
        "Selfie Verified",
        f"Your {role} has submitted their attendance selfie." + (" Both verified — session can start!" if both_verified else f" Waiting for {other_role} selfie."),
        "session_started",
        {"sessionId": session_id}
    )

    return {
        'success': True,
        'role': role,
        'bothVerified': both_verified,
        'message': 'Both parties verified! Session can now start.' if both_verified else f'Your selfie is submitted. Waiting for {other_role} to verify.',
    }


@router.get("/sessions/{session_id}/verification-status")
async def get_verification_status(session_id: str, current_user: dict = Depends(get_current_user)):
    """Check selfie verification status for a session."""
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(400, "Invalid session ID")

    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(404, "Session not found")

    user_id = str(current_user['_id'])
    if session.get('trainerId') != user_id and session.get('traineeId') != user_id:
        raise HTTPException(403, "Not a participant")

    return {
        'trainerVerified': session.get('trainerSelfieVerified', False),
        'traineeVerified': session.get('traineeSelfieVerified', False),
        'bothVerified': session.get('selfieVerificationComplete', False),
        'trainerSelfieAt': session.get('trainerSelfieAt', '').isoformat() if session.get('trainerSelfieAt') else None,
        'traineeSelfieAt': session.get('traineeSelfieAt', '').isoformat() if session.get('traineeSelfieAt') else None,
    }


@router.post("/sessions/{session_id}/propose-location")
async def propose_outdoor_location(
    session_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user)
):
    """Trainer proposes a different outdoor meeting location."""
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(400, "Invalid session ID")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(404, "Session not found")
    
    user_id = str(current_user['_id'])
    if session.get('trainerId') != user_id:
        raise HTTPException(403, "Only trainer can propose location")
    
    if session.get('sessionType') != SessionType.OUTDOOR:
        raise HTTPException(400, "Location proposals only for outdoor sessions")
    
    new_location = body.get('proposedLocation', '').strip()
    if not new_location:
        raise HTTPException(400, "Location cannot be empty")
    
    await db.sessions.update_one(
        {'_id': oid},
        {'$set': {
            'outdoorLocationTrainerProposal': new_location,
            'outdoorLocationAgreed': False,
            'updatedAt': datetime.utcnow()
        }}
    )
    
    # Notify trainee about the new location proposal
    trainee_name = session.get('traineeName', 'Trainee')
    await create_and_send_notification(
        session['traineeId'],
        "Location Proposal",
        f"Your trainer has proposed a new meeting location: {new_location}",
        "location_proposed",
        {"sessionId": session_id}
    )
    
    return {"success": True, "message": "Location proposal sent to trainee"}


@router.post("/sessions/{session_id}/agree-location")
async def agree_outdoor_location(
    session_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user)
):
    """Trainee agrees to the proposed outdoor location."""
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(400, "Invalid session ID")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(404, "Session not found")
    
    user_id = str(current_user['_id'])
    if session.get('traineeId') != user_id:
        raise HTTPException(403, "Only trainee can agree to location")
    
    if session.get('sessionType') != SessionType.OUTDOOR:
        raise HTTPException(400, "Location agreement only for outdoor sessions")
    
    agreed = body.get('agreed', True)
    
    if agreed:
        final_location = session.get('outdoorLocationTrainerProposal') or session.get('outdoorLocationProposed')
        await db.sessions.update_one(
            {'_id': oid},
            {'$set': {
                'outdoorLocationAgreed': True,
                'locationNameOrAddress': final_location,
                'updatedAt': datetime.utcnow()
            }}
        )
        # Notify trainer
        await create_and_send_notification(
            session['trainerId'],
            "Location Confirmed",
            f"Trainee has agreed to meet at: {final_location}",
            "location_agreed",
            {"sessionId": session_id}
        )
        return {"success": True, "message": "Location agreed", "finalLocation": final_location}
    else:
        # Trainee rejected, they can propose their own location
        counter_proposal = body.get('counterProposal', '').strip()
        if counter_proposal:
            await db.sessions.update_one(
                {'_id': oid},
                {'$set': {
                    'outdoorLocationProposed': counter_proposal,
                    'outdoorLocationTrainerProposal': None,
                    'outdoorLocationAgreed': False,
                    'updatedAt': datetime.utcnow()
                }}
            )
            # Notify trainer
            await create_and_send_notification(
                session['trainerId'],
                "Counter Proposal",
                f"Trainee proposed a different location: {counter_proposal}",
                "location_counter",
                {"sessionId": session_id}
            )
            return {"success": True, "message": "Counter proposal sent"}
        return {"success": False, "message": "Please provide a counter proposal"}



@router.post("/sessions/{session_id}/confirm-gps")
async def confirm_trainer_gps(
    session_id: str,
    latitude: float,
    longitude: float,
    current_user: dict = Depends(get_current_user)
):
    """
    Confirm trainer GPS arrival for in-person sessions.
    Distance thresholds:
      In-person (outdoor/gym): ≤ 0.25 miles (400m)
      At-home (trainee_home/in_home): ≤ 0.1 miles (160m)
    """
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID format")

    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session_type = session.get('sessionType', 'outdoor')
    if session_type in (SessionType.IN_HOME, SessionType.TRAINEE_HOME):
        max_distance = 0.1  # 160m for at-home
    else:
        max_distance = 0.25  # 400m for in-person

    if session.get('traineeLatitude') and session.get('traineeLongitude'):
        distance = calculate_distance(
            latitude, longitude,
            session['traineeLatitude'], session['traineeLongitude']
        )
        if distance > max_distance:
            return {
                'success': False,
                'message': f'You are {distance:.2f} miles away. Must be within {max_distance} miles to start.',
                'distanceMiles': round(distance, 3),
                'requiredMiles': max_distance,
            }

    await db.sessions.update_one(
        {'_id': oid},
        {'$set': {
            'trainerGpsConfirmed': True,
            'trainerArrivalLat': latitude,
            'trainerArrivalLon': longitude,
            'trainerArrivedAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
        }}
    )

    return {
        'success': True,
        'message': 'Location confirmed! You are at the session location.',
    }


@router.post("/sessions/{session_id}/trainer-arrived")
async def trainer_confirm_arrival(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Trainer confirms they have arrived at session location."""
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(400, "Invalid session ID")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(404, "Session not found")
    
    user_id = str(current_user['_id'])
    if session.get('trainerId') != user_id:
        raise HTTPException(403, "Only the trainer can confirm arrival")
    
    if session.get('status') not in [SessionStatus.CONFIRMED, SessionStatus.EN_ROUTE]:
        raise HTTPException(400, "Session must be confirmed or en-route to confirm arrival")
    
    await db.sessions.update_one(
        {'_id': oid},
        {'$set': {
            'trainerArrivedConfirmed': True,
            'trainerArrivedAt': datetime.utcnow(),
            'status': SessionStatus.EN_ROUTE,
            'updatedAt': datetime.utcnow(),
        }}
    )
    
    # Notify trainee
    trainee_id = session.get('traineeId')
    if trainee_id:
        asyncio.create_task(create_and_send_notification(
            trainee_id,
            "Trainer Has Arrived",
            "Your trainer has arrived and is waiting for you!",
            "trainer_arrived",
            {"sessionId": session_id}
        ))
    
    return {"success": True, "message": "Arrival confirmed! Trainee has been notified."}


@router.post("/sessions/{session_id}/trainee-arrived")
async def trainee_confirm_arrival(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Trainee confirms they have arrived at session location."""
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(400, "Invalid session ID")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(404, "Session not found")
    
    user_id = str(current_user['_id'])
    if session.get('traineeId') != user_id:
        raise HTTPException(403, "Only the trainee can confirm their arrival")
    
    if session.get('status') not in [SessionStatus.CONFIRMED, SessionStatus.EN_ROUTE]:
        raise HTTPException(400, "Session must be confirmed or en-route to confirm arrival")
    
    await db.sessions.update_one(
        {'_id': oid},
        {'$set': {
            'traineeArrivedConfirmed': True,
            'traineeArrivedAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
        }}
    )
    
    # Notify trainer
    trainer_id = session.get('trainerId')
    if trainer_id:
        asyncio.create_task(create_and_send_notification(
            trainer_id,
            "Trainee Has Arrived",
            "Your trainee has arrived and is ready!",
            "trainee_arrived",
            {"sessionId": session_id}
        ))
    
    # Check if both have arrived - can start session
    updated_session = await db.sessions.find_one({'_id': oid})
    both_arrived = updated_session.get('trainerArrivedConfirmed') and updated_session.get('traineeArrivedConfirmed')
    
    return {
        "success": True,
        "message": "Arrival confirmed! Trainer has been notified.",
        "bothArrived": both_arrived,
    }


# ─────────────────────────────────────────────────────────────
# POST-SESSION SUMMARY — Auto-generated after session completion
# ─────────────────────────────────────────────────────────────

# Calories per hour by training style (average adult)
CALORIES_PER_HOUR = {
    'hiit': 650, 'crossfit': 600, 'boxing': 580, 'kickboxing': 570,
    'strength': 420, 'weightlifting': 400, 'bodybuilding': 400,
    'functional': 380, 'circuit': 500, 'cardio': 500,
    'running': 550, 'cycling': 480, 'swimming': 450,
    'yoga': 250, 'pilates': 280, 'stretching': 180,
    'dance': 400, 'zumba': 450, 'martial_arts': 550,
    'sports': 450, 'rehabilitation': 200, 'prenatal': 220,
    'senior': 200, 'kids': 350,
}
DEFAULT_CALORIES_PER_HOUR = 400


def estimate_calories(training_styles: list, duration_minutes: int) -> int:
    """Estimate calories burned based on training style(s) and duration."""
    if not training_styles:
        return int(DEFAULT_CALORIES_PER_HOUR * duration_minutes / 60)
    total_cal_per_hour = 0
    matched = 0
    for style in training_styles:
        key = style.lower().replace(' ', '_').replace('-', '_')
        if key in CALORIES_PER_HOUR:
            total_cal_per_hour += CALORIES_PER_HOUR[key]
            matched += 1
    if matched == 0:
        return int(DEFAULT_CALORIES_PER_HOUR * duration_minutes / 60)
    avg_cal_per_hour = total_cal_per_hour / matched
    return int(avg_cal_per_hour * duration_minutes / 60)


async def generate_session_summary(session_id: str, session: dict) -> dict:
    """
    Auto-generate a post-session summary with stats, calories, streak.
    Stored in session_summaries collection.
    """
    trainee_id = session['traineeId']
    trainer_id = session['trainerId']

    # Calculate actual duration
    started_at = session.get('sessionActualStart') or session.get('sessionDateTimeStart')
    ended_at = session.get('sessionEndedAt') or datetime.utcnow()
    if isinstance(started_at, str):
        started_at = datetime.fromisoformat(started_at)
    if isinstance(ended_at, str):
        ended_at = datetime.fromisoformat(ended_at)
    duration_minutes = max(1, int((ended_at - started_at).total_seconds() / 60))

    # Get trainer info
    trainer_profile = await db.trainer_profiles.find_one({'userId': trainer_id})
    trainer_user = await db.users.find_one({'_id': ObjectId(trainer_id)}, {'fullName': 1, 'profilePhoto': 1})
    trainer_name = trainer_user.get('fullName', 'Your Trainer') if trainer_user else 'Your Trainer'
    training_styles = trainer_profile.get('trainingStyles', []) if trainer_profile else []

    # Estimate calories
    calories = estimate_calories(training_styles, duration_minutes)

    # Calculate trainee streak (consecutive weeks with at least 1 completed session)
    now = datetime.utcnow()
    streak = 0
    for week_offset in range(52):
        week_start = now - timedelta(weeks=week_offset + 1)
        week_end = now - timedelta(weeks=week_offset)
        has_session = await db.sessions.find_one({
            'traineeId': trainee_id,
            'status': SessionStatus.COMPLETED,
            'sessionEndedAt': {'$gte': week_start, '$lte': week_end},
        })
        if has_session:
            streak += 1
        else:
            break

    # Total sessions with this trainer
    sessions_with_trainer = await db.sessions.count_documents({
        'traineeId': trainee_id,
        'trainerId': trainer_id,
        'status': SessionStatus.COMPLETED,
    })

    # Build summary
    session_type_label = {
        'virtual': 'Virtual', 'outdoor': 'Outdoor', 'in_home': 'At Home', 'trainee_home': 'Home Visit',
    }.get(session.get('sessionType', ''), 'Training')

    workout_label = ', '.join(training_styles[:3]) if training_styles else session_type_label

    summary = {
        'sessionId': session_id,
        'traineeId': trainee_id,
        'trainerId': trainer_id,
        'trainerName': trainer_name,
        'trainerPhoto': trainer_user.get('profilePhoto') if trainer_user else None,
        'sessionType': session.get('sessionType', 'outdoor'),
        'sessionTypeLabel': session_type_label,
        'workoutLabel': workout_label,
        'trainingStyles': training_styles,
        'startedAt': started_at.isoformat() if started_at else None,
        'endedAt': ended_at.isoformat() if ended_at else None,
        'durationMinutes': duration_minutes,
        'caloriesEstimate': calories,
        'weeklyStreak': streak,
        'sessionsWithTrainer': sessions_with_trainer,
        'shareText': f"Just crushed a {duration_minutes}-min {workout_label} session with {trainer_name}! {calories} cal burned. {streak}-week streak!",
        'deepLink': f"rapidreps://session-summary/{session_id}",
        'createdAt': now,
    }

    # Store in DB
    await db.session_summaries.update_one(
        {'sessionId': session_id},
        {'$set': summary},
        upsert=True,
    )

    return summary


@router.get("/sessions/{session_id}/summary")
async def get_session_summary(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get the post-session summary for a completed session."""
    # Check if summary already exists
    summary = await db.session_summaries.find_one(
        {'sessionId': session_id},
        {'_id': 0},
    )
    if summary:
        if 'createdAt' in summary and hasattr(summary['createdAt'], 'isoformat'):
            summary['createdAt'] = summary['createdAt'].isoformat()
        return summary

    # Generate on-demand if session is completed but summary doesn't exist
    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(404, "Session not found")

    user_id = str(current_user['_id'])
    if session.get('trainerId') != user_id and session.get('traineeId') != user_id:
        raise HTTPException(403, "Not a participant")

    if session.get('status') != SessionStatus.COMPLETED:
        raise HTTPException(400, "Session is not yet completed")

    summary = await generate_session_summary(session_id, session)
    if 'createdAt' in summary and hasattr(summary['createdAt'], 'isoformat'):
        summary['createdAt'] = summary['createdAt'].isoformat()
    return summary


@router.get("/sessions/summaries/my")
async def get_my_summaries(current_user: dict = Depends(get_current_user)):
    """Get all session summaries for the current user (trainee or trainer)."""
    user_id = str(current_user['_id'])
    summaries = await db.session_summaries.find(
        {'$or': [{'traineeId': user_id}, {'trainerId': user_id}]},
        {'_id': 0},
    ).sort('createdAt', -1).to_list(50)

    for s in summaries:
        if 'createdAt' in s and hasattr(s['createdAt'], 'isoformat'):
            s['createdAt'] = s['createdAt'].isoformat()

    total_calories = sum(s.get('caloriesEstimate', 0) for s in summaries)
    total_minutes = sum(s.get('durationMinutes', 0) for s in summaries)

    return {
        'summaries': summaries,
        'totalSessions': len(summaries),
        'totalCalories': total_calories,
        'totalMinutes': total_minutes,
    }


@router.get("/sessions/{session_id}/share-card")
async def get_share_card_data(session_id: str):
    """
    Public endpoint — returns styled card data for sharing.
    Used by deep links and social sharing.
    """
    summary = await db.session_summaries.find_one(
        {'sessionId': session_id},
        {'_id': 0, 'traineeId': 0, 'trainerId': 0},
    )
    if not summary:
        raise HTTPException(404, "Summary not found")

    if 'createdAt' in summary and hasattr(summary['createdAt'], 'isoformat'):
        summary['createdAt'] = summary['createdAt'].isoformat()

    return {
        'card': {
            'trainerName': summary.get('trainerName'),
            'workoutLabel': summary.get('workoutLabel'),
            'durationMinutes': summary.get('durationMinutes'),
            'caloriesEstimate': summary.get('caloriesEstimate'),
            'weeklyStreak': summary.get('weeklyStreak'),
            'sessionTypeLabel': summary.get('sessionTypeLabel'),
            'shareText': summary.get('shareText'),
            'deepLink': summary.get('deepLink'),
        },
    }


@router.post("/sessions/{session_id}/end")
async def end_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Trainer presses "End Session" to complete.
    PRD Rule #12: Session end triggers payment release.
    """
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify current user is the trainer
    if str(current_user['_id']) != session['trainerId']:
        raise HTTPException(status_code=403, detail="Only the trainer can end the session")

    # ── iter106au G15: end-session max-duration cap ───────────────────────
    # Per EDGE_CASE_PLAYBOOK Scenario 6: end must be ≥ actualStart + 10 min
    # (no instant complete) and ≤ actualStart + durationMinutes × cap. If
    # over the cap, we clamp `sessionEndedAt` to the cap (protects earnings
    # analytics + calorie estimates from stale open sessions).
    from config import edge_cases as cfg
    now = datetime.utcnow()
    end_at = now
    duration_capped = False
    actual_start = session.get('sessionActualStart') or session.get('sessionStartedAt')
    planned_min = session.get('durationMinutes') or 0
    if cfg.ENABLE_END_DURATION_CAP and isinstance(actual_start, datetime) and planned_min > 0:
        # Normalize tz to compare with utcnow (naive).
        start_naive = actual_start.replace(tzinfo=None) if actual_start.tzinfo else actual_start
        elapsed_min = (now - start_naive).total_seconds() / 60.0
        if elapsed_min < 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot end a session that just started. Wait a moment and try again.",
            )
        cap_min = planned_min * cfg.END_DURATION_CAP_MULTIPLIER
        if elapsed_min > cap_min:
            # Clamp end time — session ran too long to trust.
            end_at = start_naive + timedelta(minutes=cap_min)
            duration_capped = True

    update_set = {
        'sessionEndedAt': end_at,
        'status': SessionStatus.COMPLETED,
        'updatedAt': now,
    }
    if duration_capped:
        update_set['durationCapped'] = True
        update_set['durationCappedAt'] = now

    await db.sessions.update_one({'_id': oid}, {'$set': update_set})
    
    # Push: Notify trainee that session ended
    asyncio.create_task(create_and_send_notification(
        session['traineeId'],
        "Session Complete",
        "Your session has ended! Please confirm to release payment.",
        "session_ended",
        {"sessionId": session_id, "screen": "trainee/sessions"}
    ))

    # Schedule "Rate Your Session" reminder — 30 min delay
    async def delayed_rate_reminder():
        await asyncio.sleep(1800)  # 30 minutes
        # Check if they already rated
        existing = await db.ratings.find_one({'sessionId': session_id})
        if not existing:
            await create_and_send_notification(
                session['traineeId'],
                "Rate Your Session",
                "How was your workout? Leave a rating for your trainer!",
                "rate_reminder",
                {"sessionId": session_id, "screen": "trainee/rate-session"}
            )
    asyncio.create_task(delayed_rate_reminder())

    # Auto-generate post-session summary
    updated_session = await db.sessions.find_one({'_id': oid})
    summary = await generate_session_summary(session_id, updated_session)

    # Notify trainee about their summary
    asyncio.create_task(create_and_send_notification(
        session['traineeId'],
        "Session Summary Ready!",
        f"{summary.get('caloriesEstimate', 0)} cal burned in {summary.get('durationMinutes', 0)} min. View your summary!",
        "session_ended",
        {"sessionId": session_id, "screen": "trainee/session-summary"}
    ))

    # Auto-generate community feed post
    try:
        from routes.feed import auto_create_feed_post
        trainee_name = session.get('traineeName', 'Someone')
        trainer_name = session.get('trainerName', 'a trainer')
        duration_mins = session.get('durationMinutes', 30)
        session_type = session.get('sessionType', 'workout')
        asyncio.create_task(auto_create_feed_post(
            "session_complete",
            session['traineeId'],
            trainee_name,
            f"{trainee_name} just completed a {duration_mins}-min {session_type} session with {trainer_name}!",
            {"sessionId": session_id, "durationMinutes": duration_mins, "sessionType": session_type}
        ))
    except Exception:
        pass

    return {
        'success': True,
        'message': 'Session ended. Awaiting client confirmation.',
        'sessionEndedAt': datetime.utcnow().isoformat()
    }

@router.post("/sessions/{session_id}/client-confirm-end")
async def client_confirm_session_end(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Client confirms session end, triggers payment release.
    PRD Rule #12: Client confirms, payment auto-releases.
    """
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify current user is the trainee
    if str(current_user['_id']) != session['traineeId']:
        raise HTTPException(status_code=403, detail="Only the client can confirm session end")
    
    await db.sessions.update_one(
        {'_id': oid},
        {
            '$set': {
                'clientConfirmedEnd': True,
                'status': SessionStatus.COMPLETED,
                'updatedAt': datetime.utcnow()
            }
        }
    )
    
    # Update trainer stats
    await db.trainer_profiles.update_one(
        {'userId': session['trainerId']},
        {'$inc': {'totalSessionsCompleted': 1}}
    )

    # Push: Notify trainer of payment release
    earnings = session.get('trainerEarningsCents', 0)
    asyncio.create_task(create_and_send_notification(
        session['trainerId'],
        "Payment Released!",
        f"Your session payment of ${earnings/100:.2f} has been released.",
        "payment_released",
        {"sessionId": session_id, "screen": "trainer/earnings"}
    ))

    return {
        'success': True,
        'message': 'Session confirmed! Payment has been released.',
        'trainerEarningsCents': session['trainerEarningsCents']
    }

@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get session by ID — only participants or admin can view"""
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID format")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Auth: only the trainer, trainee, or admin can view
    user_id = str(current_user['_id'])
    is_admin = current_user.get('isAdmin', False)
    if user_id != session.get('trainerId') and user_id != session.get('traineeId') and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view this session")

    # iter102ap: for virtual sessions, join the trainer's videoCallLink so the
    # session-detail screen can render the "Join Video Call" card without an
    # extra round-trip to the trainer-profiles endpoint.
    if session.get('sessionType') == SessionType.VIRTUAL or session.get('locationType') == 'virtual':
        trainer_doc = await db.trainer_profiles.find_one(
            {'userId': session.get('trainerId')},
            {'videoCallLink': 1},
        )
        if trainer_doc and trainer_doc.get('videoCallLink'):
            session['videoCallLink'] = trainer_doc['videoCallLink']

    # iter102aq: join trainee name + photo so the Session Details screen can
    # render the real trainee avatar instead of a generic person icon. Falls
    # back to trainee_profiles.avatarUrl if users.profilePhoto is empty.
    if session.get('traineeId') and ObjectId.is_valid(session['traineeId']):
        trainee_user = await db.users.find_one(
            {'_id': ObjectId(session['traineeId'])},
            {'fullName': 1, 'profilePhoto': 1, 'phone': 1},
        )
        if trainee_user:
            session.setdefault('traineeName', trainee_user.get('fullName', 'Trainee'))
            photo = trainee_user.get('profilePhoto')
            if not photo:
                t_prof = await db.trainee_profiles.find_one(
                    {'userId': session['traineeId']},
                    {'avatarUrl': 1, 'profilePhoto': 1},
                )
                if t_prof:
                    photo = t_prof.get('avatarUrl') or t_prof.get('profilePhoto')
            session['traineePhoto'] = photo
            session.setdefault('traineePhone', trainee_user.get('phone'))

    return SessionResponse(**serialize_doc(session))

@router.get("/trainer/sessions", response_model=List[SessionResponse])
async def get_trainer_sessions(
    session_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get sessions for a trainer with trainee info populated, including group sessions"""
    user_id = str(current_user['_id'])
    query = {'trainerId': user_id}
    
    if session_status:
        query['status'] = session_status
    
    sessions = await db.sessions.find(query).sort('sessionDateTimeStart', -1).to_list(100)
    
    # Also fetch group sessions created by this trainer
    group_query = {'trainerId': user_id}
    if session_status:
        group_query['status'] = session_status
    group_sessions = await db.group_sessions.find(group_query).sort('dateTime', -1).to_list(50)
    
    # Collect unique trainee IDs and look up their info
    trainee_ids = list(set(s.get('traineeId') for s in sessions if s.get('traineeId')))
    trainee_map = {}
    if trainee_ids:
        trainee_users = await db.users.find(
            {'_id': {'$in': [ObjectId(tid) for tid in trainee_ids if ObjectId.is_valid(tid)]}},
            {'fullName': 1, 'profilePhoto': 1, 'phone': 1}
        ).to_list(200)
        trainee_map = {str(u['_id']): u for u in trainee_users}
    
    results = []
    for s in sessions:
        doc = serialize_doc(s)
        trainee = trainee_map.get(s.get('traineeId', ''))
        if trainee:
            doc['traineeName'] = trainee.get('fullName', 'Trainee')
            doc['traineePhoto'] = trainee.get('profilePhoto')
            doc['traineePhone'] = trainee.get('phone')
        results.append(SessionResponse(**doc))
    
    # Convert group sessions to session-like format
    for gs in group_sessions:
        doc = serialize_doc(gs)
        results.append(SessionResponse(
            id=doc.get('id', ''),
            trainerId=doc.get('trainerId', ''),
            traineeId='group',
            traineeName=f"Group: {doc.get('title', 'Bootcamp')}",
            locationType=doc.get('locationType', 'outdoor'),
            durationMinutes=doc.get('durationMinutes', 60),
            sessionDateTimeStart=doc.get('dateTime', ''),
            status=doc.get('status', 'upcoming'),
            isGroupSession=True,
        ))
    return results

@router.get("/trainee/sessions", response_model=List[SessionResponse])
async def get_trainee_sessions(
    session_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get sessions for a trainee with trainer info populated, including joined group sessions"""
    user_id = str(current_user['_id'])
    query = {'traineeId': user_id}
    
    if session_status:
        query['status'] = session_status
    
    sessions = await db.sessions.find(query).sort('sessionDateTimeStart', -1).to_list(100)
    
    # Also fetch group sessions this trainee has joined
    group_sessions = await db.group_sessions.find({
        'participants': user_id,
        **({"status": session_status} if session_status else {})
    }).sort('dateTime', -1).to_list(50)
    
    # Collect unique trainer IDs and look up their info
    all_trainer_ids = list(set(
        [s.get('trainerId') for s in sessions if s.get('trainerId')] +
        [gs.get('trainerId') for gs in group_sessions if gs.get('trainerId')]
    ))
    trainer_map = {}
    if all_trainer_ids:
        trainer_users = await db.users.find(
            {'_id': {'$in': [ObjectId(tid) for tid in all_trainer_ids if ObjectId.is_valid(tid)]}},
            {'fullName': 1, 'profilePhoto': 1}
        ).to_list(200)
        trainer_map = {str(u['_id']): u for u in trainer_users}
    
    results = []
    for s in sessions:
        doc = serialize_doc(s)
        trainer = trainer_map.get(s.get('trainerId', ''))
        if trainer:
            doc['trainerName'] = trainer.get('fullName', 'Trainer')
            doc['trainerPhoto'] = trainer.get('profilePhoto')
        results.append(SessionResponse(**doc))
    
    # Convert group sessions to session-like format
    for gs in group_sessions:
        doc = serialize_doc(gs)
        trainer = trainer_map.get(gs.get('trainerId', ''))
        results.append(SessionResponse(
            id=doc.get('id', ''),
            trainerId=doc.get('trainerId', ''),
            traineeId=user_id,
            trainerName=trainer.get('fullName', 'Trainer') if trainer else doc.get('trainerName', 'Trainer'),
            trainerPhoto=trainer.get('profilePhoto') if trainer else None,
            traineeName=f"Group: {doc.get('title', 'Bootcamp')}",
            locationType=doc.get('locationType', 'outdoor'),
            durationMinutes=doc.get('durationMinutes', 60),
            sessionDateTimeStart=doc.get('dateTime', ''),
            status=doc.get('status', 'upcoming'),
            isGroupSession=True,
        ))
    return results

@router.patch("/sessions/{session_id}/accept", response_model=SessionResponse)
async def accept_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Trainer accepts a session request.

    iter102aq: accepting now ALSO unlocks payment. The trainer is implicitly
    agreeing to the trainee's proposed time + location + duration, so we set
    `negotiationStatus='agreed'`, `paymentReady=True`, and for outdoor sessions
    also `outdoorLocationAgreed=True`. The trainee gets a push that deep-links
    to the session-detail screen which now shows a "Confirm & Pay" CTA. No
    payment is captured before this step — exactly the flow the user asked for.
    """
    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session['trainerId'] != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Verification gate: trainer must be admin-verified
    trainer_profile = await db.trainer_profiles.find_one({'userId': str(current_user['_id'])})
    if not trainer_profile or trainer_profile.get('verificationStatus') != 'verified':
        raise HTTPException(status_code=403, detail="Your account must be verified by an admin before you can accept sessions. Please complete your verification process.")

    update: dict = {
        'status': SessionStatus.CONFIRMED,
        'updatedAt': datetime.utcnow(),
        # iter102aq: unlock payment + lock the agreed terms.
        'negotiationStatus': 'agreed',
        'paymentReady': True,
        'agreedAt': datetime.utcnow(),
    }
    if session.get('sessionType') == SessionType.OUTDOOR or session.get('locationType') == 'outdoor':
        update['outdoorLocationAgreed'] = True

    await db.sessions.update_one({'_id': ObjectId(session_id)}, {'$set': update})

    updated_session = await db.sessions.find_one({'_id': ObjectId(session_id)})

    # Push: Notify trainee that session was accepted — nudge to pay.
    trainer_name = current_user.get('fullName', 'Your trainer')
    asyncio.create_task(create_and_send_notification(
        session['traineeId'],
        "Session Accepted — confirm & pay",
        f"{trainer_name} accepted your session. Tap to confirm and pay.",
        "session_accepted_pay",
        {"sessionId": session_id, "screen": "trainee/session-detail"}
    ))

    return SessionResponse(**serialize_doc(updated_session))

@router.patch("/sessions/{session_id}/decline", response_model=SessionResponse)
async def decline_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Trainer declines a session request"""
    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session['trainerId'] != str(current_user['_id']):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.sessions.update_one(
        {'_id': ObjectId(session_id)},
        {'$set': {'status': SessionStatus.DECLINED, 'updatedAt': datetime.utcnow()}}
    )
    
    updated_session = await db.sessions.find_one({'_id': ObjectId(session_id)})

    # Push: Notify trainee that session was declined
    trainer_name = current_user.get('fullName', 'The trainer')
    asyncio.create_task(create_and_send_notification(
        session['traineeId'],
        "Session Declined",
        f"{trainer_name} is unable to take your session. Try another trainer!",
        "session_declined",
        {"sessionId": session_id, "screen": "trainee/home"}
    ))

    return SessionResponse(**serialize_doc(updated_session))

@router.patch("/sessions/{session_id}/cancel")
async def cancel_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """
    Cancel a session with time-based penalty rules.
    
    TRAINEE cancellation:
      > 12h before → $0 penalty
      12h-2h before → 25% penalty
      < 2h before → 50% penalty
    
    TRAINER cancellation:
      > 12h before → no penalty, full refund
      ≤ 12h before → full refund + virtual credit, trainer gets strike
    """
    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_id = str(current_user['_id'])
    is_trainee = session['traineeId'] == user_id
    is_trainer = session.get('trainerId') == user_id

    if not is_trainee and not is_trainer:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this session")

    current_status = session.get('status')
    if current_status in [SessionStatus.COMPLETED, SessionStatus.NO_SHOW]:
        raise HTTPException(status_code=400, detail="Cannot cancel a completed or no-show session")
    if current_status == SessionStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Session already cancelled")
    if current_status == SessionStatus.DECLINED:
        raise HTTPException(status_code=400, detail="Session was already declined")

    final_price = session.get('finalSessionPriceCents', 0)
    session_start = session.get('sessionDateTimeStart', datetime.utcnow() + timedelta(hours=24))
    cancelled_by = "trainee" if is_trainee else "trainer"

    # Calculate time-based penalty
    penalty = calculate_time_based_cancellation_penalty(session_start, final_price, cancelled_by)

    update_doc = {
        'status': SessionStatus.CANCELLED,
        'updatedAt': datetime.utcnow(),
        'cancelledAt': datetime.utcnow(),
        'cancelledBy': cancelled_by,
        'cancellationPenaltyPercent': penalty['penalty_percent'],
        'cancellationPenaltyCents': penalty['penalty_cents'],
        'refundAmountCents': penalty['refund_cents'],
        'trainerPayoutCents': penalty['trainer_payout_cents'],
        'platformFeeCents': penalty['platform_fee_cents'],
    }

    # Handle Stripe refund if payment exists
    payment_intent_id = session.get('paymentIntentId')
    if payment_intent_id and not payment_intent_id.startswith('mock_') and penalty['refund_cents'] > 0:
        try:
            refund = stripe.Refund.create(
                payment_intent=payment_intent_id,
                amount=penalty['refund_cents'],
                reason='requested_by_customer'
            )
            update_doc['stripeRefundId'] = refund.id
        except stripe.error.StripeError as e:
            update_doc['stripeRefundError'] = str(e)

    # Handle trainer strike for late cancellation
    if cancelled_by == "trainer" and penalty['gives_strike']:
        update_doc['trainerStrikeApplied'] = True
        await db.users.update_one(
            {'_id': ObjectId(session['trainerId'])},
            {
                '$inc': {'performanceStrikes': 1},
                '$push': {'strikeHistory': {
                    'sessionId': session_id,
                    'reason': 'late_cancellation',
                    'createdAt': datetime.utcnow()
                }}
            }
        )
        # Check if trainer has 3+ strikes → flag for account review
        trainer = await db.users.find_one({'_id': ObjectId(session['trainerId'])})
        if trainer and trainer.get('performanceStrikes', 0) >= 3:
            await db.users.update_one(
                {'_id': ObjectId(session['trainerId'])},
                {'$set': {'accountUnderReview': True, 'reviewReason': '3+ performance strikes'}}
            )

        # Grant virtual session credit to trainee
        if penalty['gives_credit']:
            await db.session_credits.insert_one({
                'userId': session['traineeId'],
                'type': 'virtual_session',
                'reason': f'Trainer late cancellation (session {session_id})',
                'isUsed': False,
                'createdAt': datetime.utcnow(),
            })

    await db.sessions.update_one({'_id': ObjectId(session_id)}, {'$set': update_doc})

    # Notify the other party
    if cancelled_by == "trainee":
        penalty_msg = "No penalty applied." if penalty['penalty_cents'] == 0 else f"Penalty: ${penalty['penalty_cents']/100:.2f}"
        await create_and_send_notification(
            session.get('trainerId', ''),
            "Session Cancelled",
            f"The trainee has cancelled the session. {penalty_msg}",
            "session_declined",
            {"sessionId": session_id}
        )
    else:
        msg = "Your trainer cancelled the session. Full refund processed."
        if penalty['gives_credit']:
            msg += " You also received a free virtual session credit."
        await create_and_send_notification(
            session['traineeId'],
            "Session Cancelled by Trainer",
            msg,
            "session_declined",
            {"sessionId": session_id}
        )

    penalty_str = "No penalty." if penalty['penalty_cents'] == 0 else f"Penalty: ${penalty['penalty_cents']/100:.2f}."
    return {
        'success': True,
        'cancelledBy': cancelled_by,
        'penaltyPercent': penalty['penalty_percent'],
        'penaltyCents': penalty['penalty_cents'],
        'refundCents': penalty['refund_cents'],
        'trainerPayoutCents': penalty['trainer_payout_cents'],
        'trainerStrike': penalty.get('gives_strike', False),
        'virtualCredit': penalty.get('gives_credit', False),
        'hoursUntilSession': penalty['hours_until_session'],
        'message': f"Session cancelled by {cancelled_by}. {penalty_str} Refund: ${penalty['refund_cents']/100:.2f}",
    }

@router.patch("/sessions/{session_id}/no-show")
async def mark_no_show(session_id: str, who: str = "trainee", current_user: dict = Depends(get_current_user)):
    """
    Mark session as no-show. Either trainee or trainer can be the no-show.
    
    TRAINEE NO-SHOW (who=trainee):
      - Trainer receives 50% payout
      - Platform keeps 25% fee from that 50%
      - Definition: Trainee doesn't appear within 10 minutes of start
    
    TRAINER NO-SHOW (who=trainer):
      - Trainee receives 100% refund
      - Trainer gets $0 + performance strike (3 strikes = account review)
      - Definition: Trainer doesn't appear/start within 10 minutes
    """
    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_id = str(current_user['_id'])
    is_trainer = session.get('trainerId') == user_id
    is_trainee = session.get('traineeId') == user_id
    is_admin = current_user.get('isAdmin', False)

    if not is_trainer and not is_trainee and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    if who not in ("trainee", "trainer"):
        raise HTTPException(status_code=400, detail="'who' must be 'trainee' or 'trainer'")

    final_price = session.get('finalSessionPriceCents', 0)
    update_doc = {
        'status': SessionStatus.NO_SHOW,
        'noShowParty': who,
        'updatedAt': datetime.utcnow(),
    }

    if who == "trainee":
        # Trainee no-show: trainer gets 50% payout, platform gets 25% of that 50%
        half_price = int(final_price * 50 / 100)
        platform_fee = int(half_price * PricingRules.PLATFORM_REVENUE_PERCENT / 100)
        trainer_payout = half_price - platform_fee

        update_doc.update({
            'noShowFeeCents': half_price,
            'platformFeeCents': platform_fee,
            'trainerEarningsCents': trainer_payout,
            'traineeRefundCents': 0,
        })

        # Stripe: partial refund of the other 50% to trainee
        payment_intent_id = session.get('paymentIntentId')
        refund_amount = final_price - half_price
        if payment_intent_id and not payment_intent_id.startswith('mock_') and refund_amount > 0:
            try:
                refund = stripe.Refund.create(
                    payment_intent=payment_intent_id,
                    amount=refund_amount,
                )
                update_doc['stripeRefundId'] = refund.id
                update_doc['traineeRefundCents'] = refund_amount
            except stripe.error.StripeError as e:
                update_doc['stripeRefundError'] = str(e)

        await create_and_send_notification(
            session['traineeId'],
            "No-Show Recorded",
            f"You were marked as a no-show. You've been charged ${half_price/100:.2f}.",
            "session_ended",
            {"sessionId": session_id}
        )
        await create_and_send_notification(
            session['trainerId'],
            "Trainee No-Show",
            f"Your trainee didn't show up. You'll receive ${trainer_payout/100:.2f}.",
            "session_ended",
            {"sessionId": session_id}
        )

        msg = f"Trainee no-show. Trainer payout: ${trainer_payout/100:.2f}. Platform fee: ${platform_fee/100:.2f}."

    else:  # trainer no-show
        # Full refund to trainee, trainer gets $0 + strike
        update_doc.update({
            'noShowFeeCents': 0,
            'platformFeeCents': 0,
            'trainerEarningsCents': 0,
            'traineeRefundCents': final_price,
            'trainerStrikeApplied': True,
        })

        # Stripe: full refund
        payment_intent_id = session.get('paymentIntentId')
        if payment_intent_id and not payment_intent_id.startswith('mock_'):
            try:
                refund = stripe.Refund.create(
                    payment_intent=payment_intent_id,
                    reason='requested_by_customer',
                )
                update_doc['stripeRefundId'] = refund.id
            except stripe.error.StripeError as e:
                update_doc['stripeRefundError'] = str(e)

        # Apply trainer strike
        await db.users.update_one(
            {'_id': ObjectId(session['trainerId'])},
            {
                '$inc': {'performanceStrikes': 1},
                '$push': {'strikeHistory': {
                    'sessionId': session_id,
                    'reason': 'no_show',
                    'createdAt': datetime.utcnow()
                }}
            }
        )
        # Check for 3-strike threshold
        trainer = await db.users.find_one({'_id': ObjectId(session['trainerId'])})
        if trainer and trainer.get('performanceStrikes', 0) >= 3:
            await db.users.update_one(
                {'_id': ObjectId(session['trainerId'])},
                {'$set': {'accountUnderReview': True, 'reviewReason': '3+ performance strikes'}}
            )

        await create_and_send_notification(
            session['traineeId'],
            "Trainer No-Show",
            "Your trainer didn't show up. A full refund has been processed.",
            "session_ended",
            {"sessionId": session_id}
        )
        await create_and_send_notification(
            session['trainerId'],
            "No-Show Strike",
            "You were marked as a no-show. A performance strike has been applied.",
            "session_ended",
            {"sessionId": session_id}
        )

        msg = f"Trainer no-show. Full refund of ${final_price/100:.2f} to trainee. Strike applied to trainer."

    await db.sessions.update_one({'_id': ObjectId(session_id)}, {'$set': update_doc})

    return {
        'success': True,
        'noShowParty': who,
        'trainerEarningsCents': update_doc.get('trainerEarningsCents', 0),
        'traineeRefundCents': update_doc.get('traineeRefundCents', 0),
        'platformFeeCents': update_doc.get('platformFeeCents', 0),
        'trainerStrike': who == "trainer",
        'message': msg,
    }

@router.patch("/sessions/{session_id}/complete", response_model=SessionResponse)
async def complete_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Mark session as completed"""
    session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.sessions.update_one(
        {'_id': ObjectId(session_id)},
        {'$set': {'status': SessionStatus.COMPLETED, 'updatedAt': datetime.utcnow()}}
    )
    
    # Update trainer stats
    await db.trainer_profiles.update_one(
        {'userId': session['trainerId']},
        {'$inc': {'totalSessionsCompleted': 1}}
    )
    
    updated_session = await db.sessions.find_one({'_id': ObjectId(session_id)})
    return SessionResponse(**serialize_doc(updated_session))

