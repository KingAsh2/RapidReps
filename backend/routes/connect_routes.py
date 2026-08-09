"""
connect_routes.py — iter118q — Stripe Connect Express trainer endpoints.

Routes (all under /api):
  POST /api/trainer/connect/account-link   — start / resume onboarding
  GET  /api/trainer/connect/status         — status + balance + recent payouts
  GET  /api/admin/trainers/connect-status  — admin dashboard view

The Stripe secret key is loaded globally by payment_routes at app boot.
"""
from __future__ import annotations

import logging
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException

from deps import db, get_current_user, require_admin
from models import UserRole
from services.stripe_connect_service import (
    ensure_express_account,
    create_account_link,
    refresh_account_status,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Trainer onboarding + status
# ---------------------------------------------------------------------------

@router.post("/trainer/connect/account-link")
async def create_connect_account_link(current_user: dict = Depends(get_current_user)):
    """Return a fresh Stripe-hosted onboarding URL. Creates the Express
    account on the first call (lazy). One-time-use; the frontend opens it
    in the system browser via expo-web-browser."""
    if UserRole.TRAINER not in (current_user.get('roles') or []):
        raise HTTPException(403, "Trainer access required")
    trainer_id = str(current_user['_id'])
    email = current_user.get('email')
    try:
        account_id = await ensure_express_account(db, trainer_id, email=email)
        url = await create_account_link(account_id)
    except stripe.error.StripeError as e:
        logger.exception("connect: account-link creation failed")
        raise HTTPException(400, f"Stripe error: {e.user_message or str(e)}")
    return {"url": url, "accountId": account_id}


@router.get("/trainer/connect/status")
async def get_connect_status(current_user: dict = Depends(get_current_user)):
    """Return connectStatus + live balance + recent payouts for the
    trainer's Earnings tab Payouts panel."""
    if UserRole.TRAINER not in (current_user.get('roles') or []):
        raise HTTPException(403, "Trainer access required")
    trainer_id = str(current_user['_id'])

    profile = await db.trainer_profiles.find_one({'userId': trainer_id})
    if not profile or not profile.get('stripeConnectAccountId'):
        return {
            "connectStatus": "not_connected",
            "payoutsEnabled": False,
            "detailsSubmitted": False,
            "chargesEnabled": False,
            "requirementsDue": [],
            "availableCents": 0,
            "pendingCents": 0,
            "payouts": [],
        }

    # Best-effort refresh so we don't rely on the webhook race.
    try:
        await refresh_account_status(db, trainer_id)
        profile = await db.trainer_profiles.find_one({'userId': trainer_id})
    except stripe.error.StripeError:
        pass

    account_id = profile['stripeConnectAccountId']
    available_cents = 0
    pending_cents = 0
    payouts_out: list[dict] = []
    try:
        bal = stripe.Balance.retrieve(stripe_account=account_id)
        for slot in (bal.available or []):
            if getattr(slot, 'currency', None) == 'usd':
                available_cents = int(slot.amount)
                break
        for slot in (bal.pending or []):
            if getattr(slot, 'currency', None) == 'usd':
                pending_cents = int(slot.amount)
                break
        pouts = stripe.Payout.list(limit=10, stripe_account=account_id)
        for p in pouts.auto_paging_iter():
            payouts_out.append({
                "id": p.id,
                "amountCents": int(p.amount),
                "status": p.status,
                "arrivalDate": int(p.arrival_date) if p.arrival_date else None,
                "created": int(p.created) if p.created else None,
                "failureCode": getattr(p, 'failure_code', None),
                "failureMessage": getattr(p, 'failure_message', None),
            })
            if len(payouts_out) >= 10:
                break
    except stripe.error.StripeError as e:
        logger.info("connect status: balance/payouts fetch failed (%s) — returning zeros", e)

    return {
        "connectStatus": profile.get('connectStatus', 'onboarding'),
        "payoutsEnabled": bool(profile.get('payoutsEnabled')),
        "detailsSubmitted": bool(profile.get('detailsSubmitted')),
        "chargesEnabled": bool(profile.get('chargesEnabled')),
        "requirementsDue": list(profile.get('requirementsDue') or []),
        "requirementsPastDue": list(profile.get('requirementsPastDue') or []),
        "requirementsDisabledReason": profile.get('requirementsDisabledReason'),
        "availableCents": available_cents,
        "pendingCents": pending_cents,
        "payouts": payouts_out,
    }


# ---------------------------------------------------------------------------
# Admin dashboard: connect health across the trainer fleet
# ---------------------------------------------------------------------------

@router.get("/admin/trainers/connect-status")
async def admin_list_connect_status(_admin: dict = Depends(require_admin)):
    """Return every trainer's Connect status so admins can spot trainers
    stuck in onboarding. Read-only — admins CANNOT edit KYC; they send
    the trainer a new Account Link via the trainer-side flow."""
    rows: list[dict] = []
    cursor = db.trainer_profiles.find({}, {
        'userId': 1, 'stripeConnectAccountId': 1, 'connectStatus': 1,
        'payoutsEnabled': 1, 'detailsSubmitted': 1, 'chargesEnabled': 1,
        'requirementsDue': 1, 'requirementsPastDue': 1,
        'requirementsDisabledReason': 1, 'connectUpdatedAt': 1,
    })
    trainer_ids: list[str] = []
    async for p in cursor:
        rows.append({
            'trainerId': p.get('userId'),
            'stripeConnectAccountId': p.get('stripeConnectAccountId'),
            'connectStatus': p.get('connectStatus') or (
                'not_connected' if not p.get('stripeConnectAccountId') else 'onboarding'
            ),
            'payoutsEnabled': bool(p.get('payoutsEnabled')),
            'detailsSubmitted': bool(p.get('detailsSubmitted')),
            'chargesEnabled': bool(p.get('chargesEnabled')),
            'requirementsDue': list(p.get('requirementsDue') or []),
            'requirementsPastDue': list(p.get('requirementsPastDue') or []),
            'requirementsDisabledReason': p.get('requirementsDisabledReason'),
            'connectUpdatedAt': p.get('connectUpdatedAt').isoformat() if p.get('connectUpdatedAt') else None,
        })
        if p.get('userId'):
            trainer_ids.append(p['userId'])

    # Enrich with fullName so the admin table isn't opaque user IDs.
    if trainer_ids:
        from bson import ObjectId
        name_map: dict[str, str] = {}
        object_ids = []
        for tid in trainer_ids:
            try:
                object_ids.append(ObjectId(tid))
            except Exception:
                pass
        async for u in db.users.find({'_id': {'$in': object_ids}}, {'_id': 1, 'fullName': 1, 'email': 1}):
            name_map[str(u['_id'])] = u.get('fullName') or u.get('email') or 'Unknown'
        for r in rows:
            r['trainerName'] = name_map.get(r['trainerId'], 'Unknown')

    # Sort: needs-attention first, then connected.
    def priority(r: dict) -> int:
        s = r.get('connectStatus')
        return {'requirements_due': 0, 'restricted': 1, 'onboarding': 2,
                'not_connected': 3, 'connected': 4}.get(s, 5)
    rows.sort(key=priority)
    return {"trainers": rows, "count": len(rows)}
