"""
kyc_routes.py — iter106aw.

Trainer KYC (identity verification) — Option B: self-attestation + admin
manual review. Blocks manual payouts until a human admin approves.

Fields on `trainer_profiles`:
  - kycStatus:     'not_submitted' | 'submitted' | 'approved' | 'rejected'
  - kycDocumentUrl: URL to uploaded gov-ID (stored via existing upload path)
  - kycSelfieUrl:   URL to holding-ID selfie (optional but requested)
  - kycFullLegalName: exact name on the doc (for admin cross-check)
  - kycSubmittedAt / kycReviewedAt / kycReviewedBy / kycNotes

Flow:
  1. Trainer POST /trainer/kyc/submit with {documentUrl, selfieUrl, fullLegalName}
  2. Admin GET /admin/kyc/queue → sees pending list
  3. Admin POST /admin/kyc/{trainerId}/approve  or  /reject with {notes}
  4. Payout path (payment_routes.admin_mark_payouts_paid) refuses when trainer.kycStatus != 'approved'
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from bson import ObjectId

from deps import (
    db, get_current_user, require_admin, serialize_doc, sanitize_text,
    create_and_send_notification,
)

router = APIRouter(prefix="/api")


# ── Models ────────────────────────────────────────────────────────────
class KycSubmitRequest(BaseModel):
    documentUrl: str = Field(..., min_length=8)
    selfieUrl: Optional[str] = None
    fullLegalName: str = Field(..., min_length=2, max_length=120)


class KycReviewRequest(BaseModel):
    notes: Optional[str] = None


# ── Trainer-facing ────────────────────────────────────────────────────
@router.post("/trainer/kyc/submit")
async def kyc_submit(req: KycSubmitRequest, current_user: dict = Depends(get_current_user)):
    """Trainer submits their KYC package (ID + optional selfie + legal name)."""
    uid = str(current_user['_id'])
    if 'trainer' not in (current_user.get('roles') or []):
        raise HTTPException(403, "Only trainers can submit KYC")

    now = datetime.utcnow()
    update = {
        'kycStatus': 'submitted',
        'kycDocumentUrl': req.documentUrl.strip(),
        'kycSelfieUrl': (req.selfieUrl or '').strip() or None,
        'kycFullLegalName': sanitize_text(req.fullLegalName),
        'kycSubmittedAt': now,
        'kycReviewedAt': None,
        'kycReviewedBy': None,
        'kycNotes': None,
        'updatedAt': now,
    }
    await db.trainer_profiles.update_one(
        {'userId': uid}, {'$set': update}, upsert=True,
    )

    # Notify admins.
    admins = await db.users.find({'roles': 'admin'}).to_list(20)
    trainer_name = current_user.get('fullName') or current_user.get('email') or uid
    for a in admins:
        await create_and_send_notification(
            str(a['_id']),
            "KYC Ready for Review",
            f"{trainer_name} submitted identity verification.",
            "admin_alert",
            {"screen": "admin/kyc", "trainerId": uid},
        )

    return {"success": True, "status": "submitted", "submittedAt": now.isoformat()}


@router.get("/trainer/kyc/status")
async def kyc_status(current_user: dict = Depends(get_current_user)):
    """Trainer checks their own KYC status."""
    uid = str(current_user['_id'])
    profile = await db.trainer_profiles.find_one({'userId': uid}) or {}
    return {
        'status': profile.get('kycStatus', 'not_submitted'),
        'submittedAt': profile.get('kycSubmittedAt'),
        'reviewedAt': profile.get('kycReviewedAt'),
        'notes': profile.get('kycNotes'),
        'documentUrl': profile.get('kycDocumentUrl'),
        'selfieUrl': profile.get('kycSelfieUrl'),
        'fullLegalName': profile.get('kycFullLegalName'),
    }


# ── Admin-facing ──────────────────────────────────────────────────────
@router.get("/admin/kyc/queue")
async def admin_kyc_queue(
    kyc_status: Optional[str] = None,
    admin_user: dict = Depends(require_admin),
):
    """
    Admin queue of trainers awaiting KYC review.
    ?kyc_status=submitted (default) | approved | rejected | all
    """
    filter_val = kyc_status or 'submitted'
    query: dict = {}
    if filter_val != 'all':
        query['kycStatus'] = filter_val
    else:
        query['kycStatus'] = {'$exists': True}

    profiles = await db.trainer_profiles.find(query).sort('kycSubmittedAt', 1).to_list(200)
    out: List[dict] = []
    for p in profiles:
        user = await db.users.find_one(
            {'_id': ObjectId(p['userId'])},
            {'fullName': 1, 'email': 1, 'phone': 1, 'profilePhoto': 1},
        )
        out.append({
            'trainerId': p['userId'],
            'fullName': (user or {}).get('fullName', ''),
            'email': (user or {}).get('email', ''),
            'phone': (user or {}).get('phone'),
            'profilePhoto': (user or {}).get('profilePhoto'),
            'kycStatus': p.get('kycStatus'),
            'kycFullLegalName': p.get('kycFullLegalName'),
            'kycDocumentUrl': p.get('kycDocumentUrl'),
            'kycSelfieUrl': p.get('kycSelfieUrl'),
            'kycSubmittedAt': p.get('kycSubmittedAt'),
            'kycReviewedAt': p.get('kycReviewedAt'),
            'kycNotes': p.get('kycNotes'),
        })
    return {'items': out, 'count': len(out), 'filter': filter_val}


@router.post("/admin/kyc/{trainer_id}/approve")
async def admin_kyc_approve(
    trainer_id: str,
    req: KycReviewRequest,
    admin_user: dict = Depends(require_admin),
):
    """Approve a trainer's KYC — unlocks manual payouts."""
    try:
        ObjectId(trainer_id)
    except Exception:
        raise HTTPException(400, "Invalid trainer ID")

    result = await db.trainer_profiles.update_one(
        {'userId': trainer_id, 'kycStatus': {'$in': ['submitted', 'rejected']}},
        {'$set': {
            'kycStatus': 'approved',
            'kycReviewedAt': datetime.utcnow(),
            'kycReviewedBy': str(admin_user['_id']),
            'kycNotes': sanitize_text(req.notes) if req.notes else None,
            'updatedAt': datetime.utcnow(),
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Trainer has no reviewable KYC record")

    await create_and_send_notification(
        trainer_id,
        "Identity Verified",
        "Your identity was verified. You can now receive payouts.",
        "verification_status",
        {"screen": "trainer/earnings"},
    )
    return {"success": True, "trainerId": trainer_id, "status": "approved"}


@router.post("/admin/kyc/{trainer_id}/reject")
async def admin_kyc_reject(
    trainer_id: str,
    req: KycReviewRequest,
    admin_user: dict = Depends(require_admin),
):
    """Reject a trainer's KYC — they'll need to resubmit."""
    try:
        ObjectId(trainer_id)
    except Exception:
        raise HTTPException(400, "Invalid trainer ID")

    if not req.notes or not req.notes.strip():
        raise HTTPException(400, "Notes required when rejecting KYC")

    result = await db.trainer_profiles.update_one(
        {'userId': trainer_id, 'kycStatus': 'submitted'},
        {'$set': {
            'kycStatus': 'rejected',
            'kycReviewedAt': datetime.utcnow(),
            'kycReviewedBy': str(admin_user['_id']),
            'kycNotes': sanitize_text(req.notes),
            'updatedAt': datetime.utcnow(),
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "No submitted KYC record to reject")

    await create_and_send_notification(
        trainer_id,
        "Identity Not Verified",
        f"Please resubmit your ID. Reason: {req.notes[:120]}",
        "verification_status",
        {"screen": "trainer/kyc"},
    )
    return {"success": True, "trainerId": trainer_id, "status": "rejected"}
