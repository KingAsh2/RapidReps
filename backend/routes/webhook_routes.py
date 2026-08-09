"""
webhook_routes.py — Stripe webhook + supporting endpoints (iter106an).

Primary path for Scenario 7 (payment-succeeded-but-booking-failed). The
scheduler's orphan_payment_reconcile is the safety net; this is the
real-time source of truth.

Endpoints:
  POST /api/webhooks/stripe       — Stripe webhook (no auth, signature verified)
  GET  /api/admin/edge-case-audit — Admin debug feed of all automated actions
  GET  /api/admin/edge-case-config — Admin debug view of current scheduler config

Idempotency:
  Every Stripe event id is recorded in `db.processed_webhook_events` with a
  unique index. Duplicate deliveries become no-ops.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

import stripe
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request

from deps import db, require_admin, create_and_send_notification
from audit import log_edge_case_action
from config import edge_cases as cfg

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ───────────────────────────────────────────────────────────────────────
# Stripe webhook
# ───────────────────────────────────────────────────────────────────────
@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """
    Stripe webhook endpoint.

    Expects header `Stripe-Signature` and a signed payload. Verifies the
    signature against STRIPE_WEBHOOK_SECRET. Without the secret configured,
    the endpoint fails closed (503) — we never accept unsigned events.

    Handled events:
      - payment_intent.succeeded → finalize session as paid, or refund if orphan
      - payment_intent.payment_failed → mark session paymentStatus='failed'
      - charge.refunded → record refund metadata on the session

    All other events are accepted (204) but no-op'd — so newly-enabled
    events don't 500.
    """
    if not cfg.STRIPE_WEBHOOK_SECRET:
        # Fail closed — never trust unsigned webhook traffic in production.
        raise HTTPException(503, "Webhook secret not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=cfg.STRIPE_WEBHOOK_SECRET,
        )
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        logger.warning("Stripe webhook bad signature: %s", e)
        raise HTTPException(400, f"Bad signature: {e}")

    event_id = event["id"]
    event_type = event["type"]

    # Idempotency — unique index makes the insert race-safe.
    try:
        await db.processed_webhook_events.insert_one({
            "eventId": event_id,
            "eventType": event_type,
            "processedAt": datetime.utcnow(),
        })
    except Exception:
        # Duplicate event → already processed. Return success so Stripe stops
        # retrying.
        logger.info("Stripe webhook duplicate event %s — skipping", event_id)
        return {"received": True, "duplicate": True}

    if event_type == "payment_intent.succeeded":
        await _handle_payment_succeeded(event)
    elif event_type == "payment_intent.payment_failed":
        await _handle_payment_failed(event)
    elif event_type == "charge.refunded":
        await _handle_charge_refunded(event)
    # iter118q — Stripe Connect payout / account lifecycle
    elif event_type == "account.updated":
        await _handle_account_updated(event)
    elif event_type == "payout.paid":
        await _handle_payout_paid(event)
    elif event_type == "payout.failed":
        await _handle_payout_failed(event)
    else:
        logger.info("Stripe webhook ignored event_type=%s", event_type)

    return {"received": True}


# ---------------------------------------------------------------------------
# iter118q Connect handlers
# ---------------------------------------------------------------------------

async def _handle_account_updated(event: dict) -> None:
    """Mirror the connected account's payouts_enabled / requirements into
    trainer_profiles so the frontend can gate the [Withdraw] CTA off the
    latest state without polling Stripe."""
    obj = event.get('data', {}).get('object') or {}
    account_id = obj.get('id')
    if not account_id:
        return
    reqs = obj.get('requirements') or {}
    due = list(reqs.get('currently_due') or [])
    past_due = list(reqs.get('past_due') or [])
    disabled = reqs.get('disabled_reason')
    payouts_enabled = bool(obj.get('payouts_enabled'))
    details_submitted = bool(obj.get('details_submitted'))
    charges_enabled = bool(obj.get('charges_enabled'))
    if payouts_enabled and details_submitted:
        status = 'connected'
    elif due or past_due:
        status = 'requirements_due'
    elif disabled and details_submitted:
        status = 'restricted'
    else:
        status = 'onboarding'
    await db.trainer_profiles.update_one(
        {'stripeConnectAccountId': account_id},
        {'$set': {
            'payoutsEnabled': payouts_enabled,
            'detailsSubmitted': details_submitted,
            'chargesEnabled': charges_enabled,
            'requirementsDue': due,
            'requirementsPastDue': past_due,
            'requirementsPendingVerification': list(reqs.get('pending_verification') or []),
            'requirementsDisabledReason': disabled,
            'connectStatus': status,
            'connectUpdatedAt': datetime.utcnow(),
            'lastStripeAccountEventId': event.get('id'),
        }},
    )
    logger.info("connect: account.updated %s → %s", account_id, status)


async def _handle_payout_paid(event: dict) -> None:
    obj = event.get('data', {}).get('object') or {}
    payout_id = obj.get('id')
    if not payout_id:
        return
    account_id = event.get('account')
    await db.trainer_payouts.update_one(
        {'stripePayoutId': payout_id},
        {'$set': {
            'stripePayoutId': payout_id,
            'stripeConnectAccountId': account_id,
            'amountCents': int(obj.get('amount') or 0),
            'currency': obj.get('currency', 'usd'),
            'status': 'paid',
            'arrivalDate': obj.get('arrival_date'),
            'paidAt': datetime.utcnow(),
        }},
        upsert=True,
    )
    # Best-effort trainer push
    try:
        profile = await db.trainer_profiles.find_one({'stripeConnectAccountId': account_id})
        if profile:
            amt = int(obj.get('amount') or 0) / 100.0
            await create_and_send_notification(
                profile['userId'],
                "Payout Sent",
                f"${amt:.2f} is on its way to your bank.",
                "payout_paid",
                {"payoutId": payout_id, "screen": "trainer/earnings"},
            )
    except Exception:
        pass


async def _handle_payout_failed(event: dict) -> None:
    obj = event.get('data', {}).get('object') or {}
    payout_id = obj.get('id')
    if not payout_id:
        return
    account_id = event.get('account')
    await db.trainer_payouts.update_one(
        {'stripePayoutId': payout_id},
        {'$set': {
            'stripePayoutId': payout_id,
            'stripeConnectAccountId': account_id,
            'amountCents': int(obj.get('amount') or 0),
            'currency': obj.get('currency', 'usd'),
            'status': 'failed',
            'failureCode': obj.get('failure_code'),
            'failureMessage': obj.get('failure_message'),
            'failedAt': datetime.utcnow(),
        }},
        upsert=True,
    )
    try:
        profile = await db.trainer_profiles.find_one({'stripeConnectAccountId': account_id})
        if profile:
            await create_and_send_notification(
                profile['userId'],
                "Payout Failed",
                f"Your payout couldn't be delivered: {obj.get('failure_message') or 'update your bank in Payouts.'}",
                "payout_failed",
                {"payoutId": payout_id, "screen": "trainer/connect-bank"},
            )
    except Exception:
        pass


async def _handle_payment_succeeded(event: dict) -> None:
    intent = event["data"]["object"]
    pi_id = intent.get("id")
    amount = intent.get("amount", 0)
    if not pi_id:
        return

    # Find the session that owns this PI.
    session = await db.sessions.find_one({"paymentIntentId": pi_id})
    now = datetime.utcnow()
    idempotency_key = f"webhook_paid:{pi_id}"

    if session:
        # Atomic finalize — only flip if not already paid (compare-and-set).
        result = await db.sessions.update_one(
            {"_id": session["_id"], "paymentStatus": {"$ne": "paid"}},
            {"$set": {
                "paymentStatus": "paid",
                "paidAt": now,
                "paymentReconciledBy": "webhook",
                "updatedAt": now,
            }}
        )
        if result.modified_count > 0:
            sid = str(session["_id"])
            await log_edge_case_action(
                "webhook_payment_succeeded",
                session_id=sid,
                trainer_id=session.get("trainerId"),
                trainee_id=session.get("traineeId"),
                reason="Stripe payment_intent.succeeded webhook received",
                source="webhook",
                details={"paymentIntentId": pi_id, "amountCents": amount},
                idempotency_key=idempotency_key,
            )
            import asyncio
            asyncio.create_task(create_and_send_notification(
                session.get("traineeId", ""),
                "Payment confirmed",
                "Your session payment is confirmed.",
                "payment_received",
                {"sessionId": sid},
            ))
        return

    # Orphan: PI succeeded but no session owns it. Auto-refund.
    try:
        refund = stripe.Refund.create(
            payment_intent=pi_id,
            reason="requested_by_customer",
            idempotency_key=f"refund:orphan:{pi_id}",
        )
        await log_edge_case_action(
            "orphan_payment_auto_refunded",
            session_id=None,
            reason="Stripe PI succeeded but no session owns paymentIntentId — auto-refunded",
            source="webhook",
            details={
                "paymentIntentId": pi_id,
                "amountCents": amount,
                "refundId": refund.id,
            },
            idempotency_key=f"orphan_refund:{pi_id}",
        )
    except stripe.error.StripeError as e:
        logger.error("Orphan auto-refund failed for pi=%s: %s", pi_id, e)
        await log_edge_case_action(
            "orphan_payment_refund_failed",
            session_id=None,
            reason=f"Auto-refund failed: {e}",
            source="webhook",
            details={"paymentIntentId": pi_id, "amountCents": amount},
        )


async def _handle_payment_failed(event: dict) -> None:
    intent = event["data"]["object"]
    pi_id = intent.get("id")
    if not pi_id:
        return
    session = await db.sessions.find_one({"paymentIntentId": pi_id})
    if not session:
        return
    now = datetime.utcnow()
    await db.sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {
            "paymentStatus": "failed",
            "paymentFailedAt": now,
            "updatedAt": now,
        }}
    )
    await log_edge_case_action(
        "webhook_payment_failed",
        session_id=str(session["_id"]),
        trainer_id=session.get("trainerId"),
        trainee_id=session.get("traineeId"),
        reason="Stripe payment_intent.payment_failed",
        source="webhook",
        details={"paymentIntentId": pi_id},
        idempotency_key=f"webhook_failed:{pi_id}",
    )


async def _handle_charge_refunded(event: dict) -> None:
    charge = event["data"]["object"]
    pi_id = charge.get("payment_intent")
    if not pi_id:
        return
    session = await db.sessions.find_one({"paymentIntentId": pi_id})
    if not session:
        return
    await db.sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {
            "refundConfirmedByWebhookAt": datetime.utcnow(),
            "refundedAmountCents": charge.get("amount_refunded", 0),
        }}
    )
    await log_edge_case_action(
        "webhook_charge_refunded",
        session_id=str(session["_id"]),
        trainer_id=session.get("trainerId"),
        trainee_id=session.get("traineeId"),
        reason="Stripe charge.refunded confirmation",
        source="webhook",
        details={"paymentIntentId": pi_id, "refundedCents": charge.get("amount_refunded", 0)},
        idempotency_key=f"webhook_refunded:{charge.get('id', pi_id)}",
    )


# ───────────────────────────────────────────────────────────────────────
# Admin debug — audit feed + config snapshot
# ───────────────────────────────────────────────────────────────────────
@router.get("/admin/edge-case-audit")
async def list_edge_case_audit(
    action: Optional[str] = None,
    session_id: Optional[str] = None,
    limit: int = 50,
    _admin=Depends(require_admin),
):
    """Read recent automated-action rows for ops + post-incident review."""
    q: dict = {}
    if action:
        q["action"] = action
    if session_id:
        q["sessionId"] = session_id
    limit = max(1, min(limit, 200))
    rows = await db.edge_case_audit.find(q).sort("timestamp", -1).limit(limit).to_list(limit)
    for r in rows:
        r["id"] = str(r.pop("_id"))
        ts = r.get("timestamp")
        if isinstance(ts, datetime):
            r["timestamp"] = ts.isoformat()
    return {"count": len(rows), "rows": rows}


@router.get("/admin/edge-case-config")
async def get_edge_case_config(_admin=Depends(require_admin)):
    """Return the live scheduler config snapshot for the admin debug screen."""
    return cfg.snapshot()
