"""
edge_case_scheduler.py — Critical Batch 1 scheduler (iter106an).

A single asyncio loop (kept distinct from the legacy 5-min notification
scheduler) that runs three idempotent jobs every EDGE_CASE_LOOP_INTERVAL_SEC:

  Job A — auto_no_show_trainer    (Scenario 1 / EDGE_CASE_PLAYBOOK G1)
  Job B — auto_decline_request    (Scenario 5 / G11 + G12)
  Job C — orphan_payment_reconcile (Scenario 7 / G18 safety-net for webhook)

Each tick:
  - Pulls a bounded batch of candidate sessions matching the trigger criteria.
  - For each candidate, executes the transition with an atomic compare-and-set
    on `status` (idempotent — losing the race is a no-op).
  - Writes an audit row via audit.log_edge_case_action.
  - Sends user-facing notifications.

Failure mode: any exception in a job is caught and logged; the loop continues.
A single broken job will never starve the others.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

import stripe
from bson import ObjectId

from deps import db, create_and_send_notification
from models import SessionStatus
from audit import log_edge_case_action, ensure_audit_indexes
from config import edge_cases as cfg

logger = logging.getLogger(__name__)


# ───────────────────────────────────────────────────────────────────────
# Job A — Trainer auto no-show (Scenario 1)
# ───────────────────────────────────────────────────────────────────────
async def _job_auto_no_show_trainer() -> int:
    """
    Auto-flip CONFIRMED/EN_ROUTE sessions to NO_SHOW (party=trainer) when:
      - sessionDateTimeStart < now - NO_SHOW_GRACE_MIN
      - trainer did NOT start en-route AND was NOT GPS-confirmed
      - status is still CONFIRMED or EN_ROUTE (atomic guard prevents races)

    Returns: number of sessions transitioned this tick.
    """
    if not cfg.ENABLE_AUTO_NO_SHOW:
        return 0

    now = datetime.utcnow()
    cutoff = now - timedelta(minutes=cfg.NO_SHOW_GRACE_MIN)

    # Bounded scan — only sessions that actually need attention.
    candidates = await db.sessions.find({
        'status': {'$in': [SessionStatus.CONFIRMED, SessionStatus.EN_ROUTE]},
        'sessionType': {'$ne': 'virtual'},
        'sessionDateTimeStart': {'$lte': cutoff},
        'enRouteStartedAt': {'$exists': False},
        'trainerGpsConfirmed': {'$ne': True},
        '_autoNoShowApplied': {'$ne': True},
    }).limit(cfg.NO_SHOW_BATCH_SIZE).to_list(cfg.NO_SHOW_BATCH_SIZE)

    transitioned = 0
    for s in candidates:
        sid = str(s['_id'])
        trainer_id = s.get('trainerId')
        trainee_id = s.get('traineeId')
        final_price = s.get('finalSessionPriceCents', 0)
        idempotency_key = f"auto_no_show:{sid}"

        # Atomic compare-and-set — if another path already moved this session,
        # `modified_count` will be 0 and we skip silently.
        result = await db.sessions.update_one(
            {
                '_id': s['_id'],
                'status': {'$in': [SessionStatus.CONFIRMED, SessionStatus.EN_ROUTE]},
                '_autoNoShowApplied': {'$ne': True},
            },
            {
                '$set': {
                    'status': SessionStatus.NO_SHOW,
                    'noShowParty': 'trainer',
                    'noShowDetectedBy': 'scheduler',
                    'noShowFeeCents': 0,
                    'platformFeeCents': 0,
                    'trainerEarningsCents': 0,
                    'traineeRefundCents': final_price,
                    'trainerStrikeApplied': True,
                    '_autoNoShowApplied': True,
                    'updatedAt': now,
                    'cancelledAt': now,
                }
            }
        )
        if result.modified_count == 0:
            continue  # Lost the race — somebody else moved it. Idempotent.

        # Stripe refund (full) — best-effort, errors stored on session.
        payment_intent_id = s.get('paymentIntentId')
        if payment_intent_id and not payment_intent_id.startswith('mock_'):
            try:
                refund = stripe.Refund.create(
                    payment_intent=payment_intent_id,
                    reason='requested_by_customer',
                    idempotency_key=f"refund:{idempotency_key}",  # Stripe-side dedup
                )
                await db.sessions.update_one(
                    {'_id': s['_id']},
                    {'$set': {'stripeRefundId': refund.id}}
                )
            except stripe.error.StripeError as e:
                await db.sessions.update_one(
                    {'_id': s['_id']},
                    {'$set': {'stripeRefundError': str(e)}}
                )

        # Strike + 3-strike review flag — same logic as manual no-show.
        await db.users.update_one(
            {'_id': ObjectId(trainer_id)},
            {
                '$inc': {'performanceStrikes': 1},
                '$push': {'strikeHistory': {
                    'sessionId': sid,
                    'reason': 'auto_no_show',
                    'createdAt': now,
                }}
            }
        )
        trainer_doc = await db.users.find_one({'_id': ObjectId(trainer_id)})
        if trainer_doc and trainer_doc.get('performanceStrikes', 0) >= 3:
            await db.users.update_one(
                {'_id': ObjectId(trainer_id)},
                {'$set': {
                    'accountUnderReview': True,
                    'reviewReason': '3+ performance strikes',
                }}
            )

        # Issue virtual-session credit to the trainee (same as late-cancel).
        await db.session_credits.insert_one({
            'userId': trainee_id,
            'type': 'virtual_session',
            'reason': f'Trainer auto no-show (session {sid})',
            'isUsed': False,
            'createdAt': now,
        })

        # Audit + notify.
        await log_edge_case_action(
            'auto_no_show_trainer',
            session_id=sid,
            trainer_id=trainer_id,
            trainee_id=trainee_id,
            reason=f'No en-route or GPS confirm by T+{cfg.NO_SHOW_GRACE_MIN}min',
            details={
                'refundCents': final_price,
                'gracePeriodMin': cfg.NO_SHOW_GRACE_MIN,
            },
            idempotency_key=idempotency_key,
        )
        asyncio.create_task(create_and_send_notification(
            trainee_id,
            "Trainer No-Show",
            "Your trainer didn't arrive. A full refund has been processed and a free virtual session credited.",
            "session_ended",
            {"sessionId": sid},
        ))
        asyncio.create_task(create_and_send_notification(
            trainer_id,
            "No-Show Strike",
            "You were auto-marked as a no-show. A performance strike has been applied.",
            "session_ended",
            {"sessionId": sid},
        ))
        transitioned += 1

    return transitioned


# ───────────────────────────────────────────────────────────────────────
# Job B — Auto-decline unresponsive request (Scenario 5)
# ───────────────────────────────────────────────────────────────────────
async def _job_auto_decline_request() -> int:
    """
    Auto-decline session requests that have been in 'requested' state
    longer than REQUEST_TIMEOUT_MIN. Track responsiveness on the trainer
    and apply a strike if they've ignored RESPONSIVENESS_STRIKE_IGNORES
    requests inside RESPONSIVENESS_WINDOW_DAYS.
    """
    if not cfg.ENABLE_AUTO_DECLINE:
        return 0

    now = datetime.utcnow()
    cutoff = now - timedelta(minutes=cfg.REQUEST_TIMEOUT_MIN)
    window_start = now - timedelta(days=cfg.RESPONSIVENESS_WINDOW_DAYS)

    candidates = await db.sessions.find({
        'status': 'requested',
        'createdAt': {'$lte': cutoff},
        '_autoDeclineApplied': {'$ne': True},
    }).limit(cfg.REQUEST_TIMEOUT_BATCH_SIZE).to_list(cfg.REQUEST_TIMEOUT_BATCH_SIZE)

    transitioned = 0
    for s in candidates:
        sid = str(s['_id'])
        trainer_id = s.get('trainerId')
        trainee_id = s.get('traineeId')
        idempotency_key = f"auto_decline:{sid}"

        result = await db.sessions.update_one(
            {'_id': s['_id'], 'status': 'requested', '_autoDeclineApplied': {'$ne': True}},
            {
                '$set': {
                    'status': SessionStatus.DECLINED,
                    'declinedReason': 'trainer_timeout',
                    'declinedAt': now,
                    'declinedBy': 'scheduler',
                    '_autoDeclineApplied': True,
                    'updatedAt': now,
                }
            }
        )
        if result.modified_count == 0:
            continue

        # Update responsiveness counters — increment lifetime + last 7d.
        await db.users.update_one(
            {'_id': ObjectId(trainer_id)},
            {
                '$inc': {'ignoredRequestsLifetime': 1},
                '$push': {
                    'ignoredRequestsRecent': {
                        '$each': [{'sessionId': sid, 'at': now}],
                        '$slice': -50,  # keep last 50 only
                    }
                }
            }
        )
        # Count strikes-worth of ignores inside the window.
        trainer_doc = await db.users.find_one({'_id': ObjectId(trainer_id)}) if trainer_id else None
        recent_raw = (trainer_doc or {}).get('ignoredRequestsRecent') or []
        recent = [
            r for r in recent_raw
            if isinstance(r, dict) and r.get('at') and r['at'] >= window_start
        ]
        gives_strike = bool(trainer_doc) and len(recent) >= cfg.RESPONSIVENESS_STRIKE_IGNORES
        if gives_strike:
            await db.users.update_one(
                {'_id': ObjectId(trainer_id)},
                {
                    '$inc': {'performanceStrikes': 1},
                    '$push': {'strikeHistory': {
                        'sessionId': sid,
                        'reason': 'unresponsive',
                        'createdAt': now,
                    }}
                }
            )
            # Re-fetch + 3-strike admin review.
            fresh = await db.users.find_one({'_id': ObjectId(trainer_id)})
            if fresh and fresh.get('performanceStrikes', 0) >= 3:
                await db.users.update_one(
                    {'_id': ObjectId(trainer_id)},
                    {'$set': {
                        'accountUnderReview': True,
                        'reviewReason': '3+ performance strikes',
                    }}
                )

        await log_edge_case_action(
            'auto_decline_request',
            session_id=sid,
            trainer_id=trainer_id,
            trainee_id=trainee_id,
            reason=f'No trainer response within {cfg.REQUEST_TIMEOUT_MIN} min',
            details={
                'ignoredInWindow': len(recent),
                'strikeApplied': gives_strike,
                'windowDays': cfg.RESPONSIVENESS_WINDOW_DAYS,
            },
            idempotency_key=idempotency_key,
        )
        asyncio.create_task(create_and_send_notification(
            trainee_id,
            "Trainer didn't respond",
            "Your trainer didn't respond in time. Tap to find another trainer near you.",
            "session_declined",
            {"sessionId": sid, "screen": "trainee/home", "action": "find_backup_trainers"},
        ))
        if gives_strike:
            asyncio.create_task(create_and_send_notification(
                trainer_id,
                "Responsiveness strike",
                f"You missed {len(recent)} session requests in the last {cfg.RESPONSIVENESS_WINDOW_DAYS} days. A performance strike has been applied.",
                "session_declined",
                {"screen": "trainer/home"},
            ))
        transitioned += 1

    return transitioned


# ───────────────────────────────────────────────────────────────────────
# Job C — Stripe orphan payment reconciliation (Scenario 7)
# ───────────────────────────────────────────────────────────────────────
async def _job_orphan_payment_reconcile() -> int:
    """
    Safety net for the Stripe webhook. Find sessions where:
      - paymentIntentId is set (so the trainee tried to pay)
      - paymentStatus != 'paid'
      - PI was created > ORPHAN_RECONCILE_MIN_AGE_MIN ago
      - PI was created < ORPHAN_RECONCILE_LOOKBACK_MIN ago

    For each, ask Stripe what the real status is. If 'succeeded', finalize
    the session as paid. Idempotent via the same compare-and-set pattern.
    """
    if not cfg.ENABLE_ORPHAN_RECONCILE:
        return 0

    now = datetime.utcnow()
    age_cutoff = now - timedelta(minutes=cfg.ORPHAN_RECONCILE_MIN_AGE_MIN)
    lookback_cutoff = now - timedelta(minutes=cfg.ORPHAN_RECONCILE_LOOKBACK_MIN)

    candidates = await db.sessions.find({
        'paymentIntentId': {'$exists': True, '$nin': [None, '']},
        'paymentStatus': {'$ne': 'paid'},
        'updatedAt': {'$lte': age_cutoff, '$gte': lookback_cutoff},
    }).limit(cfg.ORPHAN_BATCH_SIZE).to_list(cfg.ORPHAN_BATCH_SIZE)

    reconciled = 0
    for s in candidates:
        sid = str(s['_id'])
        pi_id = s.get('paymentIntentId')
        if not pi_id or pi_id.startswith('mock_') or pi_id.startswith('corp_'):
            continue
        idempotency_key = f"orphan_reconcile:{pi_id}"

        try:
            intent = stripe.PaymentIntent.retrieve(pi_id)
        except stripe.error.StripeError as e:
            logger.warning("Stripe retrieve failed for pi=%s: %s", pi_id, e)
            continue

        if intent.status != 'succeeded':
            continue

        # Atomic finalize.
        result = await db.sessions.update_one(
            {'_id': s['_id'], 'paymentStatus': {'$ne': 'paid'}},
            {
                '$set': {
                    'paymentStatus': 'paid',
                    'paidAt': now,
                    'paymentReconciledBy': 'scheduler',
                    'updatedAt': now,
                }
            }
        )
        if result.modified_count == 0:
            continue

        await log_edge_case_action(
            'orphan_payment_reconcile',
            session_id=sid,
            trainer_id=s.get('trainerId'),
            trainee_id=s.get('traineeId'),
            reason='PI succeeded but session was not marked paid (client confirm + webhook both missed)',
            details={
                'paymentIntentId': pi_id,
                'amountCents': intent.amount,
            },
            idempotency_key=idempotency_key,
        )
        asyncio.create_task(create_and_send_notification(
            s.get('traineeId'),
            "Payment confirmed",
            "Your session payment is confirmed.",
            "payment_received",
            {"sessionId": sid},
        ))
        reconciled += 1

    return reconciled


# ───────────────────────────────────────────────────────────────────────
# Loop
# ───────────────────────────────────────────────────────────────────────
async def edge_case_scheduler_loop() -> None:
    """Forever loop — must be started exactly once at app startup."""
    logger.info("edge_case_scheduler starting — config=%s", cfg.snapshot())

    # Idempotent index creation (also creates the unique idempotencyKey index).
    try:
        await ensure_audit_indexes()
    except Exception as e:
        logger.warning("ensure_audit_indexes failed (continuing): %s", e)

    while True:
        try:
            no_show = await _job_auto_no_show_trainer()
            decline = await _job_auto_decline_request()
            orphans = await _job_orphan_payment_reconcile()
            if no_show or decline or orphans:
                logger.info(
                    "edge_case_scheduler tick: no_show=%d decline=%d orphan=%d",
                    no_show, decline, orphans,
                )
        except Exception as e:
            logger.exception("edge_case_scheduler tick failed: %s", e)
        await asyncio.sleep(cfg.EDGE_CASE_LOOP_INTERVAL_SEC)
