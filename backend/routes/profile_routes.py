"""Profile routes: Trainer & trainee profiles, gallery, vibe, personality tags, verification, highlights."""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Query, Response, Form, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import uuid
import asyncio
import aiohttp
import os
import logging

from deps import (
    db, get_current_user, serialize_doc, sanitize_text,
    check_trainer_can_go_live, calculate_distance, calculate_trainer_tier,
    VALID_PERSONALITY_TAGS,
)
from models import (
    TrainerProfileCreate, TrainerProfileResponse,
    TraineeProfileCreate, TraineeProfileResponse,
    VerificationStatus, TrainerTier, PricingRules, UserRole,
)
from storage import init_storage, put_object, get_object, generate_upload_path, MIME_TYPES

router = APIRouter(prefix="/api")

# ============================================================================
# TRAINER PROFILE ROUTES
# ============================================================================

@router.post("/trainer-profiles", response_model=TrainerProfileResponse)
async def create_trainer_profile(profile: TrainerProfileCreate, current_user: dict = Depends(get_current_user)):
    """Create or update trainer profile"""
    existing_profile = await db.trainer_profiles.find_one({'userId': profile.userId})

    profile_doc = profile.dict()
    profile_doc['bio'] = sanitize_text(profile_doc.get('bio'))
    profile_doc['averageRating'] = 0.0
    profile_doc['totalSessionsCompleted'] = 0
    profile_doc['isVerified'] = False
    profile_doc['stripeAccountId'] = None
    profile_doc['createdAt'] = datetime.utcnow()
    profile_doc['updatedAt'] = datetime.utcnow()

    # Sync profile photo to avatarUrl and users collection
    photo = profile_doc.get('profilePhoto')
    if photo:
        profile_doc['avatarUrl'] = photo
        await db.users.update_one(
            {'_id': ObjectId(profile.userId)},
            {'$set': {'profilePhoto': photo}}
        )
        # Auto-extract dominant color from the new photo. Failures fall back silently to
        # the previous accentColorAuto (or the FE default '#FF6A00').
        try:
            from color_extractor import extract_from_data_uri_or_url, extract_dominant_color
            new_auto: Optional[str] = None
            if photo.startswith('data:'):
                new_auto = extract_from_data_uri_or_url(photo)
            elif photo.startswith('/api/files/'):
                # Resolve to bytes via object storage. Strip the route prefix to get the storage path.
                from storage import get_object
                path = photo[len('/api/files/'):]
                try:
                    content, _ = get_object(path)
                    new_auto = extract_dominant_color(content)
                except Exception:
                    new_auto = None
            if new_auto:
                profile_doc['accentColorAuto'] = new_auto
        except Exception as exc:
            # Never block profile save on color extraction failure
            import logging
            logging.getLogger(__name__).info('accentColorAuto extraction skipped: %s', exc)

    if existing_profile:
        profile_doc['createdAt'] = existing_profile['createdAt']
        await db.trainer_profiles.update_one(
            {'userId': profile.userId},
            {'$set': profile_doc}
        )
        profile_doc['_id'] = existing_profile['_id']
    else:
        result = await db.trainer_profiles.insert_one(profile_doc)
        profile_doc['_id'] = result.inserted_id

    return TrainerProfileResponse(**serialize_doc(profile_doc))

@router.get("/trainer-profiles/{user_id}", response_model=TrainerProfileResponse)
async def get_trainer_profile(user_id: str):
    """Get trainer profile by user ID — enriched with user data (fullName, avatar)"""
    profile = await db.trainer_profiles.find_one({'userId': user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")

    user = await db.users.find_one({'_id': ObjectId(user_id)}, {'fullName': 1, 'profilePhoto': 1})
    if user:
        profile['fullName'] = user.get('fullName', 'Unknown Trainer')
        if not profile.get('avatarUrl') and user.get('profilePhoto'):
            profile['avatarUrl'] = user['profilePhoto']

    if not profile.get('introVideoUrl'):
        v_steps = profile.get('verificationSteps', {})
        if isinstance(v_steps, dict) and v_steps.get('video') == 'submitted':
            subs = await db.verification_submissions.find_one(
                {'userId': user_id, 'stepId': 'video'},
                sort=[('createdAt', -1)]
            )
            if subs and subs.get('fileUri'):
                profile['introVideoUrl'] = subs['fileUri']
                await db.trainer_profiles.update_one(
                    {'userId': user_id},
                    {'$set': {'introVideoUrl': subs['fileUri']}}
                )

    return TrainerProfileResponse(**serialize_doc(profile))


@router.post("/trainer-profiles/upload-documents")
async def upload_verification_documents(
    documents: List[str],
    current_user: dict = Depends(get_current_user)
):
    """Upload verification documents for trainer profile (base64 encoded)"""
    profile = await db.trainer_profiles.find_one({'userId': current_user['id']})

    if not profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")

    existing_docs = profile.get('verificationDocs', [])
    updated_docs = existing_docs + documents

    result = await db.trainer_profiles.update_one(
        {'userId': current_user['id']},
        {'$set': {'verificationDocs': updated_docs, 'updatedAt': datetime.utcnow()}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to upload documents")

    return {
        'success': True,
        'totalDocuments': len(updated_docs),
        'message': f'Successfully uploaded {len(documents)} document(s)'
    }

@router.get("/trainer-profiles/my-documents")
async def get_my_verification_documents(current_user: dict = Depends(get_current_user)):
    """Get verification documents for current trainer"""
    profile = await db.trainer_profiles.find_one({'userId': current_user['id']})
    if not profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    return {
        'documents': profile.get('verificationDocs', []),
        'isVerified': profile.get('isVerified', False),
        'totalDocuments': len(profile.get('verificationDocs', []))
    }


# ============================================================================
# TRAINER ONBOARDING & VERIFICATION ROUTES
# ============================================================================

@router.get("/trainer/onboarding-status")
async def get_trainer_onboarding_status(current_user: dict = Depends(get_current_user)):
    """Get trainer's onboarding status - check all requirements before going live."""
    user_id = str(current_user['_id'])
    profile = await db.trainer_profiles.find_one({'userId': user_id})

    if not profile:
        return {
            'canGoLive': False, 'profileExists': False,
            'missingRequirements': ['Create trainer profile'],
            'completedRequirements': [],
            'verificationStatus': VerificationStatus.PENDING,
            'trainerTier': TrainerTier.BASIC
        }

    can_go_live, missing = check_trainer_can_go_live(profile)

    completed = []
    if profile.get('governmentIdUploaded', False): completed.append('Government ID verification')
    if profile.get('ssnVerified', False): completed.append('SSN identity check')
    if profile.get('backgroundCheckPassed', False): completed.append('Background check')
    if profile.get('sexOffenderCheckPassed', False): completed.append('Sex offender screening')
    if profile.get('cprAedCertUploaded', False): completed.append('CPR/AED certification')
    if profile.get('fitnessCertUploaded', False): completed.append('Fitness certification')
    if profile.get('introVideoUploaded', False): completed.append('Intro video')
    if profile.get('bio') and len(profile.get('bio', '')) >= 50: completed.append('Profile bio')
    if profile.get('trainingStyles') and len(profile.get('trainingStyles', [])) > 0: completed.append('Training styles')

    total_reviews = profile.get('totalReviews', 0)
    avg_rating = profile.get('averageRating', 0.0)
    certs_verified = profile.get('fitnessCertUploaded', False)
    tier = calculate_trainer_tier(total_reviews, avg_rating, certs_verified)

    if can_go_live:
        verification_status = VerificationStatus.VERIFIED
    elif len(completed) > 0:
        verification_status = VerificationStatus.PENDING
    else:
        verification_status = VerificationStatus.PENDING

    return {
        'canGoLive': can_go_live, 'profileExists': True,
        'missingRequirements': missing, 'completedRequirements': completed,
        'verificationStatus': verification_status, 'trainerTier': tier,
        'totalReviews': total_reviews, 'averageRating': avg_rating
    }

@router.post("/trainer/upload-intro-video")
async def upload_intro_video(video_url: str, current_user: dict = Depends(get_current_user)):
    """Upload trainer intro video URL (10-30 seconds)."""
    user_id = str(current_user['_id'])
    result = await db.trainer_profiles.update_one(
        {'userId': user_id},
        {'$set': {'introVideoUrl': video_url, 'introVideoUploaded': True, 'updatedAt': datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    return {'success': True, 'message': 'Intro video uploaded successfully'}

@router.post("/trainer/update-verification")
async def update_verification_status(
    verification_type: str, passed: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Update a specific verification check status."""
    user_id = str(current_user['_id'])
    field_map = {
        'government_id': 'governmentIdUploaded', 'ssn_check': 'ssnVerified',
        'background_check': 'backgroundCheckPassed', 'sex_offender_check': 'sexOffenderCheckPassed',
        'cpr_aed_cert': 'cprAedCertUploaded', 'fitness_cert': 'fitnessCertUploaded',
    }
    if verification_type not in field_map:
        raise HTTPException(status_code=400, detail=f"Invalid verification type. Valid types: {list(field_map.keys())}")

    field_name = field_map[verification_type]
    result = await db.trainer_profiles.update_one(
        {'userId': user_id},
        {'$set': {field_name: passed, 'updatedAt': datetime.utcnow()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Trainer profile not found")

    profile = await db.trainer_profiles.find_one({'userId': user_id})
    can_go_live, missing_reqs = check_trainer_can_go_live(profile)

    if can_go_live:
        await db.trainer_profiles.update_one(
            {'userId': user_id},
            {'$set': {'canGoLive': True, 'isVerified': True, 'verificationStatus': VerificationStatus.VERIFIED}}
        )

    return {
        'success': True, 'verificationType': verification_type,
        'passed': passed, 'canGoLive': can_go_live, 'missingRequirements': missing_reqs
    }

@router.get("/trainer/verification-status")
async def get_verification_status(current_user: dict = Depends(get_current_user)):
    """Get detailed step-by-step verification status for the frontend."""
    user_id = str(current_user['_id'])
    profile = await db.trainer_profiles.find_one({'userId': user_id})

    default_steps = {
        'identity': 'pending', 'background': 'pending', 'certification': 'pending',
        'cpr': 'pending', 'insurance': 'pending', 'photo': 'pending', 'video': 'pending',
    }
    if not profile:
        return {'steps': default_steps, 'canGoLive': False}

    field_map = {
        'identity': 'governmentIdUploaded', 'background': 'backgroundCheckPassed',
        'certification': 'fitnessCertUploaded', 'cpr': 'cprAedCertUploaded',
        'insurance': 'insuranceUploaded', 'photo': 'profilePhotoUploaded', 'video': 'introVideoUploaded',
    }
    steps = {}
    for step_id, field in field_map.items():
        steps[step_id] = 'submitted' if profile.get(field, False) else 'pending'

    can_go_live, missing = check_trainer_can_go_live(profile)
    verification_status = profile.get('verificationStatus', 'pending')
    rejection_reason = profile.get('rejectionReason')

    return {
        'steps': steps, 'canGoLive': can_go_live, 'missingRequirements': missing,
        'verificationStatus': verification_status, 'rejectionReason': rejection_reason,
        'rejectedAt': profile.get('rejectedAt'), 'verifiedAt': profile.get('verifiedAt'),
    }


class VerificationSubmission(BaseModel):
    stepId: str
    fileUri: Optional[str] = None
    fileName: Optional[str] = None


@router.post("/trainer/upload-verification-file")
async def upload_verification_file(
    file: UploadFile = File(...),
    stepId: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a verification document file to object storage and return its URL."""
    import base64 as b64mod
    user_id = str(current_user['_id'])
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 50MB)")

    ext = (file.filename or 'doc.jpg').split('.')[-1].lower()
    content_type_str = MIME_TYPES.get(ext, file.content_type or 'application/octet-stream')
    storage_path = generate_upload_path(user_id, ext, folder="verification")
    try:
        put_object(storage_path, content, content_type_str)
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")
    url = f"/api/files/{storage_path}"
    return {"success": True, "url": url, "stepId": stepId}


@router.post("/trainer/upload-verification-file-base64")
async def upload_verification_file_base64(
    body: dict,
    current_user: dict = Depends(get_current_user)
):
    """Upload a verification document via base64 data and return its URL."""
    import base64
    user_id = str(current_user['_id'])
    data_b64 = body.get('data', '')
    step_id = body.get('stepId', '')
    filename = body.get('filename', 'doc.jpg')
    content_type = body.get('contentType', 'image/jpeg')

    if not data_b64:
        raise HTTPException(400, "No data provided")

    content = base64.b64decode(data_b64)
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 50MB)")

    ext = filename.split('.')[-1].lower() or 'jpg'
    storage_path = generate_upload_path(user_id, ext, folder="verification")
    try:
        put_object(storage_path, content, content_type)
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")
    url = f"/api/files/{storage_path}"
    return {"success": True, "url": url, "stepId": step_id}


@router.post("/trainer/submit-verification-step")
async def submit_verification_step(
    submission: VerificationSubmission,
    current_user: dict = Depends(get_current_user)
):
    """Submit a single verification step (mark it as uploaded/submitted)."""
    user_id = str(current_user['_id'])
    field_map = {
        'identity': 'governmentIdUploaded', 'background': 'backgroundCheckPassed',
        'certification': 'fitnessCertUploaded', 'cpr': 'cprAedCertUploaded',
        'insurance': 'insuranceUploaded', 'photo': 'profilePhotoUploaded', 'video': 'introVideoUploaded',
    }
    if submission.stepId not in field_map:
        raise HTTPException(status_code=400, detail=f"Invalid step ID: {submission.stepId}")

    field_name = field_map[submission.stepId]
    update_data = {field_name: True, 'updatedAt': datetime.utcnow()}

    if submission.fileUri:
        doc_uri_field = f'{submission.stepId}FileUri'
        update_data[doc_uri_field] = submission.fileUri

    if submission.stepId == 'photo' and submission.fileUri:
        update_data['avatarUrl'] = submission.fileUri
        # Sync to users collection
        await db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'profilePhoto': submission.fileUri}}
        )
    if submission.stepId == 'video' and submission.fileUri:
        update_data['introVideoUrl'] = submission.fileUri
        update_data['introVideoUploaded'] = True

    result = await db.trainer_profiles.update_one({'userId': user_id}, {'$set': update_data})

    if result.matched_count == 0:
        profile_doc = {
            'userId': user_id, field_name: True, 'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(), 'isAvailable': False, 'isVerified': False,
            'averageRating': 0.0, 'totalSessionsCompleted': 0, 'totalReviews': 0,
        }
        if submission.stepId == 'photo' and submission.fileUri:
            profile_doc['avatarUrl'] = submission.fileUri
            await db.users.update_one(
                {'_id': ObjectId(user_id)},
                {'$set': {'profilePhoto': submission.fileUri}}
            )
        if submission.stepId == 'video' and submission.fileUri:
            profile_doc['introVideoUrl'] = submission.fileUri
            profile_doc['introVideoUploaded'] = True
        await db.trainer_profiles.insert_one(profile_doc)

    profile = await db.trainer_profiles.find_one({'userId': user_id})
    can_go_live, missing = check_trainer_can_go_live(profile)

    if can_go_live:
        await db.trainer_profiles.update_one(
            {'userId': user_id},
            {'$set': {'canGoLive': True, 'isVerified': True, 'verificationStatus': VerificationStatus.VERIFIED}}
        )

    return {'success': True, 'stepId': submission.stepId, 'canGoLive': can_go_live, 'missingRequirements': missing}


@router.post("/trainer/submit-all-verification")
async def submit_all_verification(current_user: dict = Depends(get_current_user)):
    """Submit the full verification package for admin review."""
    user_id = str(current_user['_id'])
    profile = await db.trainer_profiles.find_one({'userId': user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")

    await db.trainer_profiles.update_one(
        {'userId': user_id},
        {'$set': {
            'verificationStatus': VerificationStatus.PENDING,
            'verificationSubmittedAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }}
    )
    return {'success': True, 'message': 'Verification submitted for review. You will be notified once approved.'}


@router.post("/trainer/submit-background-pii")
async def submit_background_pii(request: Request, current_user: dict = Depends(get_current_user)):
    """Submit PII for admin-run background check via TruthFinder."""
    user_id = str(current_user['_id'])
    body = await request.json()
    full_name = sanitize_text(body.get('fullName', ''))
    dob = sanitize_text(body.get('dob', ''))
    ssn = body.get('ssn', '')
    address = sanitize_text(body.get('address', ''))
    if not full_name or not dob or not address:
        raise HTTPException(status_code=400, detail="Full name, date of birth, and address are required.")
    await db.background_check_requests.insert_one({
        'userId': user_id, 'fullName': full_name, 'dob': dob, 'ssn': ssn,
        'address': address, 'status': 'pending_admin_review', 'createdAt': datetime.utcnow(),
    })
    await db.trainer_profiles.update_one(
        {'userId': user_id},
        {'$set': {'verificationSteps.background': 'submitted', 'updatedAt': datetime.utcnow()}}
    )
    return {'success': True, 'message': 'Your information has been submitted for background check review.'}


@router.get("/trainer/pricing-limits")
async def get_trainer_pricing_limits(current_user: dict = Depends(get_current_user)):
    """Get pricing limits based on trainer tier."""
    user_id = str(current_user['_id'])
    profile = await db.trainer_profiles.find_one({'userId': user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")

    total_reviews = profile.get('totalReviews', 0)
    avg_rating = profile.get('averageRating', 0.0)
    certs_verified = profile.get('fitnessCertUploaded', False)
    tier = calculate_trainer_tier(total_reviews, avg_rating, certs_verified)

    virtual_min = PricingRules.VIRTUAL_MIN_CENTS
    outdoor_min = PricingRules.OUTDOOR_MIN_CENTS
    in_home_min = PricingRules.IN_HOME_MIN_CENTS

    if tier == TrainerTier.BASIC:
        virtual_max = virtual_min + 1500
        outdoor_max = outdoor_min + 2000
        in_home_max = in_home_min + 2000
    elif tier == TrainerTier.PRO:
        virtual_max = virtual_min + PricingRules.PRO_TIER_MAX_BONUS
        outdoor_max = outdoor_min + PricingRules.PRO_TIER_MAX_BONUS
        in_home_max = in_home_min + PricingRules.PRO_TIER_MAX_BONUS
    else:
        virtual_max = virtual_min + PricingRules.ELITE_TIER_MAX_BONUS
        outdoor_max = outdoor_min + PricingRules.ELITE_TIER_MAX_BONUS
        in_home_max = in_home_min + PricingRules.ELITE_TIER_MAX_BONUS

    return {
        'trainerTier': tier, 'totalReviews': total_reviews, 'averageRating': avg_rating,
        'pricingLimits': {
            'virtual': {'minCents': virtual_min, 'maxCents': virtual_max},
            'outdoor': {'minCents': outdoor_min, 'maxCents': outdoor_max},
            'inHome': {'minCents': in_home_min, 'maxCents': in_home_max}
        },
        'travelFees': {
            '0-5 miles': PricingRules.TRAVEL_FEE_0_5_MILES,
            '5-10 miles': PricingRules.TRAVEL_FEE_5_10_MILES,
            '10-15 miles': PricingRules.TRAVEL_FEE_10_15_MILES,
            '15-20 miles': PricingRules.TRAVEL_FEE_15_20_MILES
        },
        'cancellationFees': {
            'virtual': PricingRules.CANCELLATION_FEE_VIRTUAL,
            'outdoor': PricingRules.CANCELLATION_FEE_OUTDOOR,
            'inHome': PricingRules.CANCELLATION_FEE_IN_HOME
        },
        'platformFeePercent': PricingRules.PLATFORM_FEE_PERCENT
    }

@router.get("/trainers/search", response_model=List[TrainerProfileResponse])
async def search_trainers(
    location: Optional[str] = None, styles: Optional[str] = None,
    minPrice: Optional[int] = None, maxPrice: Optional[int] = None,
    inPerson: Optional[bool] = None, virtual: Optional[bool] = None,
    latitude: Optional[float] = None, longitude: Optional[float] = None,
    wantsVirtual: Optional[bool] = None,
    q: Optional[str] = None,
):
    """Search trainers with filters - includes location and virtual matching.
    When `q` is provided, matches trainer by fullName / email / phone across ALL trainers
    (proximity is ignored so trainees can find specific trainers nationwide)."""
    # ── Direct lookup by name/email/phone (bypasses proximity entirely) ──
    if q and q.strip():
        q_clean = q.strip()
        import re
        regex = {'$regex': re.escape(q_clean), '$options': 'i'}
        matched_users = await db.users.find(
            {
                'roles': UserRole.TRAINER,
                '$or': [
                    {'fullName': regex},
                    {'email': regex},
                    {'phone': regex},
                ],
            },
            {'_id': 1, 'fullName': 1}
        ).to_list(50)
        if not matched_users:
            return []
        user_ids = [str(u['_id']) for u in matched_users]
        names_map = {str(u['_id']): u.get('fullName', 'Unknown Trainer') for u in matched_users}
        trainer_projection = {
            'userId': 1, 'avatarUrl': 1, 'profilePhoto': 1, 'bio': 1, 'experienceYears': 1,
            'certifications': 1, 'trainingStyles': 1, 'gymsWorkedAt': 1, 'primaryGym': 1,
            'offersInPerson': 1, 'offersVirtual': 1, 'offersOutdoor': 1, 'offersInHome': 1,
            'sessionDurationsOffered': 1, 'virtualRateCents': 1, 'outdoorRateCents': 1,
            'inHomeRateCents': 1, 'ratePerMinuteCents': 1, 'travelRadiusMiles': 1,
            'cancellationPolicy': 1, 'averageRating': 1, 'totalReviews': 1,
            'totalSessionsCompleted': 1, 'isVerified': 1, 'trainerTier': 1,
            'verificationStatus': 1, 'canGoLive': 1, 'latitude': 1, 'longitude': 1,
            'locationAddress': 1, 'isAvailable': 1, 'isVirtualTrainingAvailable': 1,
            'videoCallPreference': 1, 'createdAt': 1,
        }
        trainers_q = await db.trainer_profiles.find(
            {'userId': {'$in': user_ids}}, trainer_projection
        ).to_list(50)
        for t in trainers_q:
            t['fullName'] = names_map.get(t['userId'], 'Unknown Trainer')
            t['distance'] = None
            t['matchType'] = 'direct-search'
        return [TrainerProfileResponse(**serialize_doc(t)) for t in trainers_q]

    query = {'isAvailable': True}
    if styles:
        query['trainingStyles'] = {'$in': styles.split(',')}
    if minPrice is not None:
        query['ratePerMinuteCents'] = query.get('ratePerMinuteCents', {})
        query['ratePerMinuteCents']['$gte'] = minPrice
    if maxPrice is not None:
        query['ratePerMinuteCents'] = query.get('ratePerMinuteCents', {})
        query['ratePerMinuteCents']['$lte'] = maxPrice
    if inPerson is not None:
        query['offersInPerson'] = inPerson
    if virtual is not None:
        query['offersVirtual'] = virtual

    trainer_projection = {
        'userId': 1, 'avatarUrl': 1, 'bio': 1, 'experienceYears': 1, 'certifications': 1,
        'trainingStyles': 1, 'gymsWorkedAt': 1, 'primaryGym': 1, 'offersInPerson': 1,
        'offersVirtual': 1, 'offersOutdoor': 1, 'offersInHome': 1, 'sessionDurationsOffered': 1,
        'virtualRateCents': 1, 'outdoorRateCents': 1, 'inHomeRateCents': 1, 'ratePerMinuteCents': 1,
        'travelRadiusMiles': 1, 'cancellationPolicy': 1, 'averageRating': 1, 'totalReviews': 1,
        'totalSessionsCompleted': 1, 'isVerified': 1, 'trainerTier': 1, 'verificationStatus': 1,
        'canGoLive': 1, 'latitude': 1, 'longitude': 1, 'locationAddress': 1, 'isAvailable': 1,
        'isVirtualTrainingAvailable': 1, 'videoCallPreference': 1, 'createdAt': 1, 'profilePhoto': 1,
    }
    trainers = await db.trainer_profiles.find(query, trainer_projection).to_list(100)

    in_person_trainers = []
    virtual_trainers = []

    for trainer in trainers:
        if latitude and longitude and trainer.get('latitude') and trainer.get('longitude'):
            distance = calculate_distance(latitude, longitude, trainer['latitude'], trainer['longitude'])
            if trainer.get('offersInPerson') and distance <= 15:
                trainer['distance'] = distance
                trainer['matchType'] = 'in-person'
                in_person_trainers.append(trainer)
            elif wantsVirtual and trainer.get('isVirtualTrainingAvailable') and distance <= 20:
                trainer['distance'] = distance
                trainer['matchType'] = 'virtual'
                virtual_trainers.append(trainer)
        else:
            if wantsVirtual and trainer.get('isVirtualTrainingAvailable'):
                trainer['distance'] = None
                trainer['matchType'] = 'virtual'
                virtual_trainers.append(trainer)

    in_person_trainers.sort(key=lambda t: t.get('distance', 999) if t.get('distance') is not None else 999)
    virtual_trainers.sort(key=lambda t: t.get('distance', 999) if t.get('distance') is not None else 999)
    filtered_trainers = in_person_trainers + virtual_trainers

    if filtered_trainers:
        user_ids = [ObjectId(t['userId']) for t in filtered_trainers]
        users_cursor = db.users.find({'_id': {'$in': user_ids}})
        users_list = await users_cursor.to_list(len(user_ids))
        users_map = {str(u['_id']): u.get('fullName', 'Unknown Trainer') for u in users_list}
        for trainer in filtered_trainers:
            trainer['fullName'] = users_map.get(trainer['userId'], 'Unknown Trainer')

    return [TrainerProfileResponse(**serialize_doc(t)) for t in filtered_trainers]


@router.put("/trainer-profiles/{user_id}/gallery")
async def update_trainer_gallery(user_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update trainer gallery (photos/videos)."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own gallery")
    gallery = body.get('gallery', [])
    await db.trainer_profiles.update_one({'userId': user_id}, {'$set': {'gallery': gallery, 'updatedAt': datetime.utcnow()}})
    return {"success": True, "gallery": gallery}


@router.put("/trainer-profiles/{user_id}/social-links")
async def update_trainer_social_links(user_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update trainer social media links."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own social links")
    social_links = body.get('socialLinks', {})
    await db.trainer_profiles.update_one({'userId': user_id}, {'$set': {'socialLinks': social_links, 'updatedAt': datetime.utcnow()}})
    return {"success": True, "socialLinks": social_links}


@router.put("/trainer-profiles/{user_id}/vibe")
async def update_trainer_vibe(user_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update trainer's profile vibe/anthem."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own vibe")
    vibe_data = {
        'vibeTrackTitle': body.get('vibeTrackTitle'), 'vibeArtistName': body.get('vibeArtistName'),
        'vibeArtworkUrl': body.get('vibeArtworkUrl'), 'vibePreviewUrl': body.get('vibePreviewUrl'),
        'vibeAppleMusicUrl': body.get('vibeAppleMusicUrl'), 'vibeTrackId': body.get('vibeTrackId'),
        'updatedAt': datetime.utcnow(),
    }
    result = await db.trainer_profiles.update_one({'userId': user_id}, {'$set': vibe_data})
    if result.matched_count == 0:
        # Profile doesn't exist yet — create a minimal one with vibe data
        vibe_data['userId'] = user_id
        vibe_data['createdAt'] = datetime.utcnow()
        await db.trainer_profiles.insert_one(vibe_data)
    return {"success": True, **{k: v for k, v in vibe_data.items() if k not in ('updatedAt', 'createdAt', '_id', 'userId')}}


@router.delete("/trainer-profiles/{user_id}/vibe")
async def remove_trainer_vibe(user_id: str, current_user: dict = Depends(get_current_user)):
    """Remove trainer's profile vibe/anthem."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own vibe")
    clear_data = {
        'vibeTrackTitle': None, 'vibeArtistName': None, 'vibeArtworkUrl': None,
        'vibePreviewUrl': None, 'vibeAppleMusicUrl': None, 'vibeTrackId': None,
        'updatedAt': datetime.utcnow(),
    }
    await db.trainer_profiles.update_one({'userId': user_id}, {'$set': clear_data})
    return {"success": True}


@router.put("/trainer-profiles/{user_id}/personality-tag")
async def update_trainer_personality_tag(user_id: str, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Update trainer's personality tag."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own personality tag")
    tag = body.get("personalityTag")
    if tag and tag not in VALID_PERSONALITY_TAGS:
        raise HTTPException(400, f"Invalid personality tag. Must be one of: {VALID_PERSONALITY_TAGS}")
    await db.trainer_profiles.update_one(
        {'userId': user_id},
        {'$set': {'personalityTag': tag, 'updatedAt': datetime.utcnow()}}
    )
    return {"success": True, "personalityTag": tag}

@router.put("/trainee-profiles/{user_id}/personality-tag")
async def update_trainee_personality_tag(user_id: str, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Update trainee's personality tag."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own personality tag")
    tag = body.get("personalityTag")
    if tag and tag not in VALID_PERSONALITY_TAGS:
        raise HTTPException(400, f"Invalid personality tag. Must be one of: {VALID_PERSONALITY_TAGS}")
    await db.trainee_profiles.update_one(
        {'userId': user_id},
        {'$set': {'personalityTag': tag, 'updatedAt': datetime.utcnow()}}
    )
    return {"success": True, "personalityTag": tag}


VALID_ACCENT_COLORS = [
    "#FF6A00", "#FF3D00", "#00D68F", "#6C5CE7", "#0984E3",
    "#FDBB2D", "#E84393", "#00CEC9", "#D63031", "#A29BFE",
]

@router.put("/trainer-profiles/{user_id}/accent-color")
async def update_trainer_accent_color(user_id: str, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Update trainer's brand accent color."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own accent color")
    color = body.get("accentColor")
    if color and color not in VALID_ACCENT_COLORS:
        raise HTTPException(400, f"Invalid accent color. Must be one of: {VALID_ACCENT_COLORS}")
    await db.trainer_profiles.update_one(
        {'userId': user_id},
        {'$set': {'accentColor': color, 'updatedAt': datetime.utcnow()}}
    )
    return {"success": True, "accentColor": color}


@router.get("/music/search")
async def search_music(q: str = Query(..., min_length=2), limit: int = Query(10, le=25)):
    """Proxy iTunes Search API for song lookup."""
    url = f"https://itunes.apple.com/search?term={q}&media=music&entity=song&limit={limit}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            data = await resp.json(content_type=None)
    results = []
    for item in data.get('results', []):
        results.append({
            'trackId': str(item.get('trackId', '')),
            'trackName': item.get('trackName', ''),
            'artistName': item.get('artistName', ''),
            'artworkUrl': (item.get('artworkUrl100', '') or '').replace('100x100', '600x600'),
            'previewUrl': item.get('previewUrl', ''),
            'trackViewUrl': item.get('trackViewUrl', ''),
            'collectionName': item.get('collectionName', ''),
        })
    return {"results": results}


@router.get("/music/lookup")
async def lookup_music(trackId: str = Query(...)):
    """Lookup a specific iTunes track by ID to get fresh preview URL."""
    url = f"https://itunes.apple.com/lookup?id={trackId}"
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            data = await resp.json(content_type=None)
    results = data.get('results', [])
    if not results:
        return {"previewUrl": None}
    item = results[0]
    return {
        "previewUrl": item.get('previewUrl', ''),
        "artworkUrl": (item.get('artworkUrl100', '') or '').replace('100x100', '600x600'),
        "trackName": item.get('trackName', ''),
        "artistName": item.get('artistName', ''),
    }



@router.post("/trainer-profiles/{user_id}/highlights")
async def upload_highlight(user_id: str, file: UploadFile = File(...), caption: str = Form(""), current_user: dict = Depends(get_current_user)):
    """Upload a highlight reel clip (short video or image)."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own highlights")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 50MB)")

    ext = (file.filename or 'clip.mp4').split('.')[-1].lower()
    is_video = ext in ('mp4', 'mov', 'avi', 'webm')
    media_type = 'video' if is_video else 'photo'

    storage_path = generate_upload_path(user_id, ext, folder="highlights")
    content_type_str = MIME_TYPES.get(ext, file.content_type or 'application/octet-stream')
    try:
        put_object(storage_path, content, content_type_str)
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")
    url = f"/api/files/{storage_path}"

    highlight = {
        'url': url, 'storagePath': storage_path, 'type': media_type,
        'caption': caption, 'createdAt': datetime.utcnow().isoformat(),
    }

    await db.trainer_profiles.update_one({'userId': user_id}, {'$push': {'highlights': highlight}})
    return {"success": True, "highlight": highlight}


@router.post("/trainer-profiles/{user_id}/highlights/base64")
async def upload_highlight_base64(user_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Upload a highlight via base64 data (more reliable for iOS photo uploads)."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own highlights")

    import base64
    data_b64 = body.get('data', '')
    filename = body.get('filename', 'highlight.jpg')
    content_type = body.get('contentType', 'image/jpeg')
    caption = body.get('caption', '')

    if not data_b64:
        raise HTTPException(400, "No data provided")

    content = base64.b64decode(data_b64)
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 50MB)")

    ext = filename.split('.')[-1].lower() or 'jpg'
    is_video = ext in ('mp4', 'mov', 'avi', 'webm')
    media_type = 'video' if is_video else 'photo'

    storage_path = generate_upload_path(user_id, ext, folder="highlights")
    try:
        put_object(storage_path, content, content_type)
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")
    url = f"/api/files/{storage_path}"

    highlight = {
        'url': url, 'storagePath': storage_path, 'type': media_type,
        'caption': caption, 'createdAt': datetime.utcnow().isoformat(),
    }

    await db.trainer_profiles.update_one({'userId': user_id}, {'$push': {'highlights': highlight}})
    return {"success": True, "highlight": highlight}



@router.delete("/trainer-profiles/{user_id}/highlights/{index}")
async def delete_highlight(user_id: str, index: int, current_user: dict = Depends(get_current_user)):
    """Delete a highlight by index."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own highlights")
    profile = await db.trainer_profiles.find_one({'userId': user_id})
    if not profile:
        raise HTTPException(404, "Profile not found")
    highlights = profile.get('highlights', [])
    if index < 0 or index >= len(highlights):
        raise HTTPException(400, "Invalid highlight index")
    highlights.pop(index)
    await db.trainer_profiles.update_one({'userId': user_id}, {'$set': {'highlights': highlights}})
    return {"success": True, "highlights": highlights}


@router.get("/trainer-profiles/{user_id}/highlights")
async def get_highlights(user_id: str):
    """Get all highlights for a trainer."""
    profile = await db.trainer_profiles.find_one({'userId': user_id}, {'highlights': 1})
    return {"highlights": (profile or {}).get('highlights', [])}


# ============================================================================
# GALLERY UPLOAD / FILE SERVING
# ============================================================================

MAX_IMAGE_SIZE = 10 * 1024 * 1024
MAX_VIDEO_SIZE = 100 * 1024 * 1024
ALLOWED_IMAGE_EXT = {"jpg", "jpeg", "png", "gif", "webp", "heic"}
ALLOWED_VIDEO_EXT = {"mp4", "mov", "avi", "mkv"}


@router.post("/gallery/upload")
async def upload_gallery_file(
    file: UploadFile = File(...),
    caption: str = Query("", max_length=200),
    current_user: dict = Depends(get_current_user),
):
    """Upload image or video to user's gallery."""
    user_id = str(current_user['_id'])
    filename = file.filename or "file"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    is_image = ext in ALLOWED_IMAGE_EXT
    is_video = ext in ALLOWED_VIDEO_EXT
    if not (is_image or is_video):
        raise HTTPException(400, f"Unsupported file type: .{ext}. Allowed: {', '.join(ALLOWED_IMAGE_EXT | ALLOWED_VIDEO_EXT)}")

    content = await file.read()
    max_size = MAX_IMAGE_SIZE if is_image else MAX_VIDEO_SIZE
    if len(content) > max_size:
        raise HTTPException(400, f"File too large. Max {'10MB' if is_image else '100MB'}.")

    content_type = MIME_TYPES.get(ext, file.content_type or "application/octet-stream")
    path = generate_upload_path(user_id, ext)

    try:
        put_object(path, content, content_type)
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")

    media_type = "photo" if is_image else "video"
    gallery_item = {"url": f"/api/files/{path}", "type": media_type, "storagePath": path}
    if caption:
        gallery_item["caption"] = caption

    roles = current_user.get('roles', [])
    if 'trainer' in roles:
        await db.trainer_profiles.update_one(
            {'userId': user_id},
            {'$push': {'gallery': gallery_item}, '$set': {'updatedAt': datetime.utcnow()}}
        )
    else:
        await db.trainee_profiles.update_one(
            {'userId': user_id},
            {'$push': {'gallery': gallery_item}}
        )

    return {"success": True, "item": gallery_item, "mediaType": media_type}


@router.delete("/gallery/{item_index}")
async def delete_gallery_item(item_index: int, current_user: dict = Depends(get_current_user)):
    """Delete a gallery item by its index."""
    user_id = str(current_user['_id'])
    roles = current_user.get('roles', [])
    collection = 'trainer_profiles' if 'trainer' in roles else 'trainee_profiles'
    profile = await db[collection].find_one({'userId': user_id}, {'gallery': 1})
    if not profile or 'gallery' not in profile:
        raise HTTPException(404, "Gallery not found")
    gallery = profile['gallery']
    if item_index < 0 or item_index >= len(gallery):
        raise HTTPException(400, "Invalid gallery index")
    gallery.pop(item_index)
    await db[collection].update_one({'userId': user_id}, {'$set': {'gallery': gallery}})
    return {"success": True, "gallery": gallery}


def _build_file_headers(file_size: int, content_type: str, etag: str, extra: dict | None = None) -> dict:
    """Common headers for /api/files/{path} responses.
    
    Note: Cloudflare/ingress overrides plain `Cache-Control` to `no-store` on this domain.
    We additionally send `Surrogate-Control` and `CDN-Cache-Control` so CF-aware tiers respect
    the long cache, and we rely on ETag/If-None-Match for client-side 304 short-circuits as
    the practical workaround when CF strips Cache-Control.
    """
    headers = {
        'Accept-Ranges': 'bytes',
        'Content-Length': str(file_size),
        'ETag': etag,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'public, max-age=31536000, immutable',
        'Surrogate-Control': 'public, max-age=31536000, immutable',
        'Vary': 'Range',
        'Content-Type': content_type,
    }
    if extra:
        headers.update(extra)
    return headers


def _parse_range(range_header: str, file_size: int):
    """Parse `Range: bytes=START-END` into (start, end) or raise ValueError."""
    units, _, range_spec = range_header.strip().partition('=')
    if units.lower() != 'bytes':
        raise ValueError('only bytes unit supported')
    start_str, _, end_str = range_spec.partition('-')
    start = int(start_str) if start_str else 0
    end = int(end_str) if end_str else file_size - 1
    if start < 0 or end >= file_size or start > end:
        raise ValueError('invalid range')
    return start, end


def _stream_bytes(content: bytes, chunk_size: int = 64 * 1024):
    """Yield bytes in fixed-size chunks for StreamingResponse — bounds peak memory under concurrency."""
    for i in range(0, len(content), chunk_size):
        yield content[i:i + chunk_size]


@router.head("/files/{path:path}")
async def head_file(path: str):
    """HEAD support for /files/{path}. Some clients (iOS AVPlayer in certain configurations,
    HLS validators, link preview crawlers) preflight with HEAD before GET. Without this,
    we'd 405 and they'd refuse to play the video at all."""
    try:
        content, content_type = get_object(path)
    except Exception:
        raise HTTPException(404, "File not found")
    import hashlib
    etag = f'"{hashlib.md5(content).hexdigest()}"'
    headers = _build_file_headers(len(content), content_type, etag)
    return Response(status_code=200, headers=headers)


@router.get("/files/{path:path}")
async def serve_file(path: str, request: Request):
    """Serve a file from object storage with HTTP Range support + ETag-based 304 caching
    + chunked StreamingResponse to keep memory bounded under concurrent video streams.
    
    Range support is REQUIRED for video playback in React Native (expo-av), iOS AVPlayer,
    and most browser <video> elements.
    """
    try:
        content, content_type = get_object(path)
    except Exception:
        raise HTTPException(404, "File not found")

    file_size = len(content)
    import hashlib
    etag = f'"{hashlib.md5(content).hexdigest()}"'

    # 304 Not Modified short-circuit — primary workaround for downstream `no-store` override.
    if_none_match = request.headers.get('if-none-match') or request.headers.get('If-None-Match')
    if if_none_match and if_none_match == etag:
        return Response(
            status_code=304,
            headers={
                'ETag': etag,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Vary': 'Range',
            },
        )

    range_header = request.headers.get('range') or request.headers.get('Range')

    if not range_header:
        headers = _build_file_headers(file_size, content_type, etag)
        return StreamingResponse(_stream_bytes(content), media_type=content_type, headers=headers)

    try:
        start, end = _parse_range(range_header, file_size)
    except (ValueError, AttributeError):
        return Response(
            status_code=416,
            headers={
                'Content-Range': f'bytes */{file_size}',
                'ETag': etag,
            },
        )

    chunk = content[start:end + 1]
    headers = _build_file_headers(
        len(chunk),
        content_type,
        etag,
        extra={'Content-Range': f'bytes {start}-{end}/{file_size}'},
    )
    return StreamingResponse(_stream_bytes(chunk), status_code=206, media_type=content_type, headers=headers)


# ============================================================================
# TRAINEE PROFILE ROUTES
# ============================================================================

@router.post("/trainee-profiles", response_model=TraineeProfileResponse)
async def create_trainee_profile(profile: TraineeProfileCreate, current_user: dict = Depends(get_current_user)):
    """Create or update trainee profile"""
    existing_profile = await db.trainee_profiles.find_one({'userId': profile.userId})

    profile_doc = profile.dict()
    profile_doc['createdAt'] = datetime.utcnow()
    profile_doc['updatedAt'] = datetime.utcnow()

    # Sync profile photo to users collection
    photo = profile_doc.get('profilePhoto')
    if photo:
        await db.users.update_one(
            {'_id': ObjectId(profile.userId)},
            {'$set': {'profilePhoto': photo}}
        )

    if existing_profile:
        profile_doc['createdAt'] = existing_profile['createdAt']
        await db.trainee_profiles.update_one({'userId': profile.userId}, {'$set': profile_doc})
        profile_doc['_id'] = existing_profile['_id']
    else:
        result = await db.trainee_profiles.insert_one(profile_doc)
        profile_doc['_id'] = result.inserted_id

    return TraineeProfileResponse(**serialize_doc(profile_doc))

@router.get("/trainee-profiles/{user_id}", response_model=TraineeProfileResponse)
async def get_trainee_profile(user_id: str):
    """Get trainee profile by user ID"""
    profile = await db.trainee_profiles.find_one({'userId': user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Trainee profile not found")
    return TraineeProfileResponse(**serialize_doc(profile))


@router.put("/trainee-profiles/{user_id}/gallery")
async def update_trainee_gallery(user_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update trainee gallery (photos/videos)."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own gallery")
    gallery = body.get('gallery', [])
    await db.trainee_profiles.update_one({'userId': user_id}, {'$set': {'gallery': gallery}})
    return {"success": True, "gallery": gallery}


@router.put("/trainee-profiles/{user_id}/social-links")
async def update_trainee_social_links(user_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update trainee social media links."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own social links")
    social_links = body.get('socialLinks', {})
    await db.trainee_profiles.update_one({'userId': user_id}, {'$set': {'socialLinks': social_links}})
    return {"success": True, "socialLinks": social_links}


@router.get("/trainees/discover")
async def discover_trainees(
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    """Trainer-facing feed of trainees who've built out their showcase
    (have at least a vibe, personality tag, accent color, highlights, or bio).
    Excludes the current user. Sorted by most recently updated.
    """
    me_id = str(current_user['_id'])

    # Query: any showcase signal present
    query = {
        'userId': {'$ne': me_id},
        '$or': [
            {'vibeTrackTitle': {'$nin': [None, '']}},
            {'personalityTag': {'$nin': [None, '']}},
            {'accentColor': {'$nin': [None, '']}},
            {'bio': {'$nin': [None, '']}},
            {'highlights.0': {'$exists': True}},
        ],
    }

    projection = {
        '_id': 0,
        'userId': 1, 'profilePhoto': 1, 'bio': 1, 'fitnessGoals': 1,
        'currentFitnessLevel': 1, 'personalityTag': 1, 'accentColor': 1,
        'vibeTrackTitle': 1, 'vibeArtistName': 1, 'vibeArtworkUrl': 1,
        'highlights': 1, 'updatedAt': 1,
    }

    cursor = (
        db.trainee_profiles
        .find(query, projection)
        .sort('updatedAt', -1)
        .skip(offset)
        .limit(limit)
    )
    profiles = await cursor.to_list(length=limit)

    # Enrich with fullName from users collection
    user_ids = [ObjectId(p['userId']) for p in profiles if p.get('userId')]
    users_map = {}
    if user_ids:
        users = await db.users.find(
            {'_id': {'$in': user_ids}},
            {'fullName': 1, 'profilePhoto': 1, 'roles': 1}
        ).to_list(length=len(user_ids))
        for u in users:
            uid = str(u['_id'])
            # Only include users who actually have 'trainee' in roles
            if 'trainee' in (u.get('roles') or []):
                users_map[uid] = u

    # Filter and shape
    out = []
    for p in profiles:
        uid = p.get('userId', '')
        if uid not in users_map:
            continue  # Skip non-trainees / deleted users
        u = users_map[uid]
        highlights = p.get('highlights') or []
        out.append({
            'userId': uid,
            'fullName': u.get('fullName', 'Athlete'),
            'profilePhoto': p.get('profilePhoto') or u.get('profilePhoto'),
            'bio': p.get('bio'),
            'fitnessGoals': p.get('fitnessGoals'),
            'currentFitnessLevel': p.get('currentFitnessLevel'),
            'personalityTag': p.get('personalityTag'),
            'accentColor': p.get('accentColor'),
            'vibeTrackTitle': p.get('vibeTrackTitle'),
            'vibeArtistName': p.get('vibeArtistName'),
            'vibeArtworkUrl': p.get('vibeArtworkUrl'),
            'firstHighlight': highlights[0] if highlights else None,
            'highlightCount': len(highlights),
        })

    return {'trainees': out, 'count': len(out), 'offset': offset, 'limit': limit}


@router.put("/trainee-profiles/{user_id}/vibe")
async def update_trainee_vibe(user_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Update trainee's profile vibe/anthem."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own vibe")
    vibe_data = {
        'vibeTrackTitle': body.get('vibeTrackTitle'), 'vibeArtistName': body.get('vibeArtistName'),
        'vibeArtworkUrl': body.get('vibeArtworkUrl'), 'vibePreviewUrl': body.get('vibePreviewUrl'),
        'vibeAppleMusicUrl': body.get('vibeAppleMusicUrl'), 'vibeTrackId': body.get('vibeTrackId'),
        'updatedAt': datetime.utcnow(),
    }
    result = await db.trainee_profiles.update_one({'userId': user_id}, {'$set': vibe_data})
    if result.matched_count == 0:
        vibe_data['userId'] = user_id
        vibe_data['createdAt'] = datetime.utcnow()
        await db.trainee_profiles.insert_one(vibe_data)
    return {"success": True, **{k: v for k, v in vibe_data.items() if k not in ('updatedAt', 'createdAt', '_id', 'userId')}}


@router.delete("/trainee-profiles/{user_id}/vibe")
async def remove_trainee_vibe(user_id: str, current_user: dict = Depends(get_current_user)):
    """Remove trainee's profile vibe/anthem."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own vibe")
    clear_data = {
        'vibeTrackTitle': None, 'vibeArtistName': None, 'vibeArtworkUrl': None,
        'vibePreviewUrl': None, 'vibeAppleMusicUrl': None, 'vibeTrackId': None,
        'updatedAt': datetime.utcnow(),
    }
    await db.trainee_profiles.update_one({'userId': user_id}, {'$set': clear_data})
    return {"success": True}


@router.put("/trainee-profiles/{user_id}/accent-color")
async def update_trainee_accent_color(user_id: str, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Update trainee's brand accent color."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own accent color")
    color = body.get("accentColor")
    if color and color not in VALID_ACCENT_COLORS:
        raise HTTPException(400, f"Invalid accent color. Must be one of: {VALID_ACCENT_COLORS}")
    await db.trainee_profiles.update_one(
        {'userId': user_id},
        {'$set': {'accentColor': color, 'updatedAt': datetime.utcnow()}}
    )
    return {"success": True, "accentColor": color}


@router.put("/trainee-profiles/{user_id}/bio")
async def update_trainee_bio(user_id: str, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Update trainee's bio/about-me."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own bio")
    bio = sanitize_text(body.get("bio"))
    await db.trainee_profiles.update_one(
        {'userId': user_id},
        {'$set': {'bio': bio, 'updatedAt': datetime.utcnow()}}
    )
    return {"success": True, "bio": bio}


@router.post("/trainee-profiles/{user_id}/highlights")
async def upload_trainee_highlight(user_id: str, file: UploadFile = File(...), caption: str = Form(""), current_user: dict = Depends(get_current_user)):
    """Upload a trainee highlight reel clip (short video or image)."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own highlights")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 50MB)")

    ext = (file.filename or 'clip.mp4').split('.')[-1].lower()
    is_video = ext in ('mp4', 'mov', 'avi', 'webm')
    media_type = 'video' if is_video else 'photo'

    storage_path = generate_upload_path(user_id, ext, folder="highlights")
    content_type_str = MIME_TYPES.get(ext, file.content_type or 'application/octet-stream')
    try:
        put_object(storage_path, content, content_type_str)
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")
    url = f"/api/files/{storage_path}"

    highlight = {
        'url': url, 'storagePath': storage_path, 'type': media_type,
        'caption': caption, 'createdAt': datetime.utcnow().isoformat(),
    }

    await db.trainee_profiles.update_one({'userId': user_id}, {'$push': {'highlights': highlight}})
    return {"success": True, "highlight": highlight}


@router.post("/trainee-profiles/{user_id}/highlights/base64")
async def upload_trainee_highlight_base64(user_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Upload a trainee highlight via base64 data (more reliable for iOS photo uploads)."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own highlights")

    import base64
    data_b64 = body.get('data', '')
    filename = body.get('filename', 'highlight.jpg')
    content_type = body.get('contentType', 'image/jpeg')
    caption = body.get('caption', '')

    if not data_b64:
        raise HTTPException(400, "No data provided")

    content = base64.b64decode(data_b64)
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 50MB)")

    ext = filename.split('.')[-1].lower() or 'jpg'
    is_video = ext in ('mp4', 'mov', 'avi', 'webm')
    media_type = 'video' if is_video else 'photo'

    storage_path = generate_upload_path(user_id, ext, folder="highlights")
    try:
        put_object(storage_path, content, content_type)
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")
    url = f"/api/files/{storage_path}"

    highlight = {
        'url': url, 'storagePath': storage_path, 'type': media_type,
        'caption': caption, 'createdAt': datetime.utcnow().isoformat(),
    }

    await db.trainee_profiles.update_one({'userId': user_id}, {'$push': {'highlights': highlight}})
    return {"success": True, "highlight": highlight}


@router.delete("/trainee-profiles/{user_id}/highlights/{index}")
async def delete_trainee_highlight(user_id: str, index: int, current_user: dict = Depends(get_current_user)):
    """Delete a trainee highlight by index."""
    if str(current_user['_id']) != user_id:
        raise HTTPException(403, "Can only update your own highlights")
    profile = await db.trainee_profiles.find_one({'userId': user_id})
    if not profile:
        raise HTTPException(404, "Profile not found")
    highlights = profile.get('highlights', [])
    if index < 0 or index >= len(highlights):
        raise HTTPException(400, "Invalid highlight index")
    highlights.pop(index)
    await db.trainee_profiles.update_one({'userId': user_id}, {'$set': {'highlights': highlights}})
    return {"success": True, "highlights": highlights}


@router.get("/trainee-profiles/{user_id}/highlights")
async def get_trainee_highlights(user_id: str):
    """Get all highlights for a trainee."""
    profile = await db.trainee_profiles.find_one({'userId': user_id}, {'highlights': 1})
    return {"highlights": (profile or {}).get('highlights', [])}


@router.get("/trainers/nearby-trainees")
async def get_nearby_trainees(current_user: dict = Depends(get_current_user)):
    """Get trainees within 15 miles of the trainer"""
    trainer_profile = await db.trainer_profiles.find_one({'userId': str(current_user['_id'])})
    if not trainer_profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")

    trainer_lat = trainer_profile.get('latitude')
    trainer_lon = trainer_profile.get('longitude')

    if not trainer_lat or not trainer_lon:
        return {'trainees': [], 'message': 'Trainer location not set. Please update your profile with location.'}

    all_trainees = await db.trainee_profiles.find(
        {'latitude': {'$exists': True, '$ne': None}, 'longitude': {'$exists': True, '$ne': None}},
        {'userId': 1, 'latitude': 1, 'longitude': 1, 'avatarUrl': 1, 'fitnessGoals': 1, 'fitnessLevel': 1}
    ).to_list(1000)

    nearby_trainees = []
    nearby_user_ids = []
    for trainee in all_trainees:
        trainee_lat = trainee.get('latitude')
        trainee_lon = trainee.get('longitude')
        if trainee_lat and trainee_lon:
            distance = calculate_distance(trainer_lat, trainer_lon, trainee_lat, trainee_lon)
            if distance <= 15:
                trainee_data = serialize_doc(trainee)
                trainee_data['distance'] = round(distance, 1)
                nearby_trainees.append(trainee_data)
                nearby_user_ids.append(ObjectId(trainee['userId']))

    if nearby_user_ids:
        users_cursor = db.users.find({'_id': {'$in': nearby_user_ids}}, {'fullName': 1})
        users_list = await users_cursor.to_list(len(nearby_user_ids))
        users_map = {str(u['_id']): u.get('fullName', 'Unknown') for u in users_list}
        for trainee_data in nearby_trainees:
            trainee_data['fullName'] = users_map.get(trainee_data.get('userId'), 'Unknown')

    nearby_trainees.sort(key=lambda x: x['distance'])
    return {'trainees': nearby_trainees, 'count': len(nearby_trainees)}

@router.patch("/trainer-profiles/toggle-availability")
async def toggle_trainer_availability(isAvailable: bool, current_user: dict = Depends(get_current_user)):
    """Toggle trainer availability (online/offline)"""
    result = await db.trainer_profiles.update_one(
        {'userId': str(current_user['_id'])},
        {'$set': {'isAvailable': isAvailable, 'updatedAt': datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    return {
        'success': True, 'isAvailable': isAvailable,
        'message': f"You are now {'available' if isAvailable else 'unavailable'} to trainees"
    }


@router.get("/trainees/search")
async def search_trainees(
    q: str = Query(..., min_length=1, description="Search by trainee name, email, or phone"),
    current_user: dict = Depends(get_current_user),
):
    """Trainer-only: search trainees nationwide by fullName / email / phone.
    Proximity is ignored — trainers can reach out to any trainee."""
    if UserRole.TRAINER not in (current_user.get('roles') or []):
        raise HTTPException(403, "Only trainers can search trainees")

    import re
    q_clean = q.strip()
    if not q_clean:
        return {'trainees': [], 'count': 0}

    regex = {'$regex': re.escape(q_clean), '$options': 'i'}
    matched_users = await db.users.find(
        {
            'roles': UserRole.TRAINEE,
            '$or': [
                {'fullName': regex},
                {'email': regex},
                {'phone': regex},
            ],
        },
        {'_id': 1, 'fullName': 1, 'email': 1, 'phone': 1, 'profilePhoto': 1}
    ).to_list(50)

    if not matched_users:
        return {'trainees': [], 'count': 0}

    user_ids = [str(u['_id']) for u in matched_users]
    profiles = await db.trainee_profiles.find(
        {'userId': {'$in': user_ids}},
        {'userId': 1, 'avatarUrl': 1, 'fitnessGoals': 1, 'fitnessLevel': 1,
         'latitude': 1, 'longitude': 1, 'locationAddress': 1}
    ).to_list(50)
    profile_map = {p['userId']: p for p in profiles}

    # Compute distance if trainer has a location
    trainer_profile = await db.trainer_profiles.find_one(
        {'userId': str(current_user['_id'])},
        {'latitude': 1, 'longitude': 1}
    )
    t_lat = (trainer_profile or {}).get('latitude')
    t_lon = (trainer_profile or {}).get('longitude')

    results = []
    for u in matched_users:
        uid = str(u['_id'])
        p = profile_map.get(uid, {})
        distance = None
        if t_lat and t_lon and p.get('latitude') and p.get('longitude'):
            distance = round(calculate_distance(t_lat, t_lon, p['latitude'], p['longitude']), 1)
        results.append({
            'userId': uid,
            'id': uid,
            'fullName': u.get('fullName', 'Unknown Trainee'),
            'email': u.get('email'),
            'phone': u.get('phone'),
            'profilePhoto': u.get('profilePhoto') or p.get('avatarUrl'),
            'avatarUrl': p.get('avatarUrl') or u.get('profilePhoto'),
            'fitnessGoals': p.get('fitnessGoals'),
            'fitnessLevel': p.get('fitnessLevel'),
            'locationAddress': p.get('locationAddress'),
            'distance': distance,
        })
    return {'trainees': results, 'count': len(results)}
