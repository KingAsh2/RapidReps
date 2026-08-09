"""
stripe_connect_service.py — iter118q

Stripe Connect Express glue for RapidReps' marketplace payout flow.

Architecture (per user decision, spec item #7):
    Trainee → PaymentIntent (100% on platform account, no destination) →
    session completes → trainee confirms end → set trainerEligibleAt = now + 24h →
    edge_case_scheduler `_job_connect_release_transfers` picks eligible rows →
    stripe.Transfer.create(destination=acct_xxx, amount=trainerGrossCents)
    → the trainer's own payout schedule wires funds to their bank.

Guarantees:
    • The platform's 20% + $2.99 never leaves the platform account.
    • Trainer funds are not moved for AT LEAST 24 h post session completion.
    • Refunds / disputes that land before the release simply skip the transfer.
    • Idempotency: `Transfer.create` uses `session-transfer-{sessionId}` so a
      worker crash mid-flight never double-pays.
"""
from __future__ import annotations

import logging
import math
import os
from datetime import datetime, timedelta
from typing import Any, Optional

import stripe
from bson import ObjectId

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
# Stripe secret key is already set globally by payment_routes.py at import
# time. We do NOT re-set stripe.api_key here to avoid double-init races.

# Where trainers land after opening the Stripe-hosted Account Link. We surface
# it as an env var so it can differ between local dev / preview / prod. The
# same path handles both `refresh_url` (link expired, mint a new one) and
# `return_url` (finished — recheck status via /connect/status).
CONNECT_RETURN_URL = os.environ.get(
    'STRIPE_CONNECT_RETURN_URL',
    'https://highlight-vibe-bugs.preview.emergentagent.com/trainer/connect-bank',
)

TRAINER_RELEASE_HOLD_HOURS = int(os.environ.get('TRAINER_RELEASE_HOLD_HOURS', '24'))


# ---------------------------------------------------------------------------
# Fee math — single source of truth for the platform cut.
# ---------------------------------------------------------------------------
PLATFORM_PERCENT = 20         # RapidReps' cut of the session fee
FLAT_SERVICE_FEE_CENTS = 299  # $2.99 flat on top


def compute_platform_and_trainer_split(session_price_cents: int, service_fee_cents: int = FLAT_SERVICE_FEE_CENTS) -> dict:
    """Return the platform cut, trainer gross, and total-charged breakdown.

    trainee_pays  = session_price + service_fee
    platform_cut  = 20% * session_price  + service_fee
    trainer_gross = 80% * session_price   (what we later Transfer to the
                                           trainer's Connect account)

    All in cents, all rounded to integers so no fractions drift.
    """
    session_price_cents = int(session_price_cents or 0)
    service_fee_cents = int(service_fee_cents or 0)
    # math.floor (not round) — banker's rounding on odd cents would sometimes
    # nick a cent off the trainer. floor on the platform share keeps every
    # rounding cent with the trainer, deterministically.
    platform_share = math.floor(session_price_cents * PLATFORM_PERCENT / 100.0)
    trainer_gross = session_price_cents - platform_share
    platform_cut_total = platform_share + service_fee_cents
    return {
        'traineePaysCents': session_price_cents + service_fee_cents,
        'platformCutCents': platform_cut_total,
        'trainerGrossCents': trainer_gross,
        'serviceFeeCents': service_fee_cents,
        'sessionPriceCents': session_price_cents,
    }


# ---------------------------------------------------------------------------
# Account creation (lazy — only when a trainer taps "Set up payouts").
# ---------------------------------------------------------------------------

async def ensure_express_account(db, trainer_user_id: str, email: Optional[str] = None) -> str:
    """Return the trainer's Stripe Connect Express account ID, creating one
    the first time this is called. Idempotent — the second caller sees the
    ID that the first caller wrote."""
    profile = await db.trainer_profiles.find_one({'userId': trainer_user_id})
    if not profile:
        raise ValueError(f"trainer_profiles row not found for userId={trainer_user_id}")
    if profile.get('stripeConnectAccountId'):
        return profile['stripeConnectAccountId']

    # Create the Express account. We request `transfers` capability so we
    # can call stripe.Transfer.create later; we do NOT request card_payments
    # because we're on the destination-charge-less separate-transfer flow.
    account = stripe.Account.create(
        type='express',
        country='US',
        email=email or None,
        capabilities={
            'transfers': {'requested': True},
        },
        business_type='individual',
        metadata={'rapidRepsTrainerId': trainer_user_id},
    )
    now = datetime.utcnow()
    # Conditional update — never overwrite an account ID a concurrent request
    # already inserted.
    await db.trainer_profiles.update_one(
        {'userId': trainer_user_id, 'stripeConnectAccountId': {'$exists': False}},
        {'$set': {
            'stripeConnectAccountId': account.id,
            'stripeConnectAccountType': 'express',
            'stripeConnectCountry': 'US',
            'payoutsEnabled': False,
            'chargesEnabled': False,
            'detailsSubmitted': False,
            'requirementsDue': [],
            'connectStatus': 'onboarding',
            'connectCreatedAt': now,
            'connectUpdatedAt': now,
        }},
    )
    updated = await db.trainer_profiles.find_one({'userId': trainer_user_id})
    return updated['stripeConnectAccountId']


async def create_account_link(account_id: str) -> str:
    """Mint a single-use hosted-onboarding URL. Never cache these."""
    link = stripe.AccountLink.create(
        account=account_id,
        refresh_url=f"{CONNECT_RETURN_URL}?refresh=1",
        return_url=f"{CONNECT_RETURN_URL}?returned=1",
        type='account_onboarding',
        collection_options={'fields': 'eventually_due'},
    )
    return link.url


def _status_for(account: Any) -> str:
    """Map a Stripe Account object to our local connectStatus enum."""
    reqs = getattr(account, 'requirements', None) or {}
    if hasattr(reqs, 'currently_due'):
        due = list(reqs.currently_due or [])
        disabled = getattr(reqs, 'disabled_reason', None)
    else:
        due = list(reqs.get('currently_due', []) if isinstance(reqs, dict) else [])
        disabled = reqs.get('disabled_reason') if isinstance(reqs, dict) else None
    payouts_enabled = bool(getattr(account, 'payouts_enabled', False))
    details_submitted = bool(getattr(account, 'details_submitted', False))
    if payouts_enabled and details_submitted:
        return 'connected'
    if due:
        return 'requirements_due'
    if disabled or not payouts_enabled:
        return 'restricted' if details_submitted else 'onboarding'
    return 'onboarding'


async def refresh_account_status(db, trainer_user_id: str) -> dict:
    """Pull the live Stripe account state and mirror it into trainer_profiles.

    Called after the trainer returns from the Account Link, and by the
    webhook handler for `account.updated`.
    """
    profile = await db.trainer_profiles.find_one({'userId': trainer_user_id})
    if not profile or not profile.get('stripeConnectAccountId'):
        return {'connectStatus': 'not_connected'}
    account_id = profile['stripeConnectAccountId']
    account = stripe.Account.retrieve(account_id)
    reqs = getattr(account, 'requirements', None) or {}
    if hasattr(reqs, 'to_dict'):
        reqs_dict = reqs.to_dict()
    elif isinstance(reqs, dict):
        reqs_dict = reqs
    else:
        reqs_dict = {}
    update = {
        'payoutsEnabled': bool(getattr(account, 'payouts_enabled', False)),
        'chargesEnabled': bool(getattr(account, 'charges_enabled', False)),
        'detailsSubmitted': bool(getattr(account, 'details_submitted', False)),
        'requirementsDue': list(reqs_dict.get('currently_due') or []),
        'requirementsPastDue': list(reqs_dict.get('past_due') or []),
        'requirementsPendingVerification': list(reqs_dict.get('pending_verification') or []),
        'requirementsDisabledReason': reqs_dict.get('disabled_reason'),
        'connectStatus': _status_for(account),
        'connectUpdatedAt': datetime.utcnow(),
    }
    await db.trainer_profiles.update_one({'userId': trainer_user_id}, {'$set': update})
    return update


# ---------------------------------------------------------------------------
# Transfer release worker (runs from edge_case_scheduler).
# ---------------------------------------------------------------------------

async def mark_session_eligible_for_release(db, session_id: str, session_doc: dict | None = None) -> None:
    """Called when the trainee confirms the session ended. Records the
    T+24h eligibility timestamp AND freezes the trainer gross amount so a
    later refund can't back-alter the transfer size."""
    if session_doc is None:
        session_doc = await db.sessions.find_one({'_id': ObjectId(session_id)})
    if not session_doc:
        return
    if session_doc.get('trainerEligibleAt'):
        # Already scheduled — don't reset the clock on a re-confirm.
        return
    price_cents = int(session_doc.get('finalSessionPriceCents')
                     or session_doc.get('baseSessionPriceCents')
                     or session_doc.get('totalCents')
                     or 0)
    trainer_gross = int(session_doc.get('trainerEarningsCents') or 0)
    if trainer_gross <= 0 and price_cents > 0:
        split = compute_platform_and_trainer_split(price_cents)
        trainer_gross = split['trainerGrossCents']
    if trainer_gross <= 0:
        # Free / fully-subsidized session — nothing to transfer.
        return
    eligible_at = datetime.utcnow() + timedelta(hours=TRAINER_RELEASE_HOLD_HOURS)
    await db.sessions.update_one(
        {'_id': session_doc['_id']},
        {'$set': {
            'trainerEligibleAt': eligible_at,
            'trainerGrossCents': trainer_gross,
            'transferState': 'pending',
            'trainerReleaseHoldHours': TRAINER_RELEASE_HOLD_HOURS,
        }},
    )
    logger.info(
        "connect: session %s scheduled for transfer at %s (gross=%s cents)",
        str(session_doc['_id']), eligible_at.isoformat(), trainer_gross,
    )


async def release_due_transfers(db, batch_size: int = 25) -> int:
    """Find sessions past their trainerEligibleAt with no transferId yet,
    create the Stripe Transfer, and record the id. Returns count released.

    Called by the edge_case_scheduler tick loop (60s cadence).
    """
    now = datetime.utcnow()
    query = {
        'trainerEligibleAt': {'$lte': now},
        'transferId': {'$in': [None, '']},
        'transferState': {'$ne': 'refunded'},
        'status': 'completed',
    }
    released = 0
    cursor = db.sessions.find(query).limit(batch_size)
    async for s in cursor:
        session_id = s['_id']
        trainer_id = s.get('trainerId')
        gross = int(s.get('trainerGrossCents') or 0)
        if not trainer_id or gross <= 0:
            await db.sessions.update_one(
                {'_id': session_id, 'transferState': {'$ne': 'skipped'}},
                {'$set': {'transferState': 'skipped', 'transferSkipReason': 'no-gross-or-trainer'}},
            )
            continue
        # Claim the row atomically so a second worker never races us.
        # awaiting-onboarding rows are re-eligible on later ticks so a
        # trainer who finishes Connect onboarding late still gets their
        # held funds released automatically.
        claim = await db.sessions.update_one(
            {'_id': session_id, 'transferState': {'$in': ['pending', 'retry', 'awaiting-onboarding']}},
            {'$set': {'transferState': 'creating', 'transferAttemptAt': now}},
        )
        if claim.modified_count != 1:
            continue

        profile = await db.trainer_profiles.find_one({'userId': trainer_id})
        acct = (profile or {}).get('stripeConnectAccountId')
        payouts_enabled = bool((profile or {}).get('payoutsEnabled'))
        if not acct or not payouts_enabled:
            # Trainer hasn't finished Connect onboarding — hold the release
            # rather than fail; we'll retry every tick until they onboard.
            await db.sessions.update_one(
                {'_id': session_id},
                {'$set': {
                    'transferState': 'awaiting-onboarding',
                    'transferBlockReason': 'trainer-not-connected',
                    'updatedAt': now,
                }},
            )
            continue

        try:
            transfer = stripe.Transfer.create(
                amount=gross,
                currency='usd',
                destination=acct,
                metadata={
                    'sessionId': str(session_id),
                    'trainerId': trainer_id,
                    'rapidRepsRelease': 'v1',
                },
                idempotency_key=f"session-transfer-{session_id}",
            )
            await db.sessions.update_one(
                {'_id': session_id},
                {'$set': {
                    'transferId': transfer.id,
                    'transferState': 'created',
                    'transferCreatedAt': now,
                    'trainerConnectAccountId': acct,
                }},
            )
            released += 1
        except stripe.error.StripeError as e:
            logger.warning("connect: transfer create failed for session=%s err=%s", session_id, e)
            await db.sessions.update_one(
                {'_id': session_id},
                {'$set': {
                    'transferState': 'retry',
                    'transferLastError': str(e)[:500],
                    'transferAttemptAt': now,
                }},
            )
    return released
