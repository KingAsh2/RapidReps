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
# Job D — G2/G3: Trainee no-show nudges + admin 3rd-strike alerts
# ───────────────────────────────────────────────────────────────────────
async def _job_trainee_nudges() -> int:
    """
    Two-phase trainee nudge for the "trainer accepted but never arrived"
    scenario:
      - Phase 1 (T+TRAINEE_NUDGE_T0_MIN): push "Where's your trainer?" when
        the session clock hits start time and the trainer has neither gone
        en_route nor GPS-confirmed.
      - Phase 2 (T+TRAINEE_NUDGE_T5_MIN): in-app CTA to report no-show so
        the trainee doesn't have to wait for the auto-no-show at T+10.

    Also handles G3: whenever a trainer flips to `accountUnderReview=true`
    from a 3rd strike (visible via `strikeHistory` growing past 3 without
    an adminStrikeAlertSentAt marker), send an in-app admin notification.
    """
    if not cfg.ENABLE_TRAINEE_NUDGES:
        return 0

    now = datetime.utcnow()
    fired = 0

    # ── Phase 1: T+0 nudge ────────────────────────────────────────────────
    t0_cutoff = now - timedelta(minutes=cfg.TRAINEE_NUDGE_T0_MIN)
    t0_upper = now - timedelta(minutes=cfg.TRAINEE_NUDGE_T0_MIN + 4)  # send once within a 4-min window
    p1 = await db.sessions.find({
        'status': {'$in': [SessionStatus.CONFIRMED, SessionStatus.EN_ROUTE]},
        'sessionType': {'$ne': 'virtual'},
        'sessionDateTimeStart': {'$lte': t0_cutoff, '$gte': t0_upper},
        'trainerGpsConfirmed': {'$ne': True},
        '_traineeNudgeT0Sent': {'$ne': True},
    }).limit(50).to_list(50)

    for s in p1:
        sid = str(s['_id'])
        result = await db.sessions.update_one(
            {'_id': s['_id'], '_traineeNudgeT0Sent': {'$ne': True}},
            {'$set': {'_traineeNudgeT0Sent': True, 'updatedAt': now}},
        )
        if result.modified_count == 0:
            continue
        asyncio.create_task(create_and_send_notification(
            s.get('traineeId'),
            "Where's your trainer?",
            "Session start time is here. If your trainer hasn't arrived, you can report a no-show.",
            "session_reminder",
            {"sessionId": sid, "screen": "trainee/session-detail", "phase": "t0"},
        ))
        await log_edge_case_action(
            'trainee_nudge_t0',
            session_id=sid,
            trainee_id=s.get('traineeId'),
            trainer_id=s.get('trainerId'),
            reason=f'T+{cfg.TRAINEE_NUDGE_T0_MIN}min — no en-route/GPS confirm',
            idempotency_key=f"trainee_nudge_t0:{sid}",
        )
        fired += 1

    # ── Phase 2: T+5 in-app CTA ───────────────────────────────────────────
    t5_cutoff = now - timedelta(minutes=cfg.TRAINEE_NUDGE_T5_MIN)
    t5_upper = now - timedelta(minutes=cfg.TRAINEE_NUDGE_T5_MIN + 4)
    p2 = await db.sessions.find({
        'status': {'$in': [SessionStatus.CONFIRMED, SessionStatus.EN_ROUTE]},
        'sessionType': {'$ne': 'virtual'},
        'sessionDateTimeStart': {'$lte': t5_cutoff, '$gte': t5_upper},
        'trainerGpsConfirmed': {'$ne': True},
        '_traineeNudgeT5Sent': {'$ne': True},
    }).limit(50).to_list(50)

    for s in p2:
        sid = str(s['_id'])
        result = await db.sessions.update_one(
            {'_id': s['_id'], '_traineeNudgeT5Sent': {'$ne': True}},
            {'$set': {'_traineeNudgeT5Sent': True, 'updatedAt': now}},
        )
        if result.modified_count == 0:
            continue
        asyncio.create_task(create_and_send_notification(
            s.get('traineeId'),
            "Trainer is late",
            "Your trainer still isn't here. Tap to report a no-show and get a full refund.",
            "session_reminder",
            {"sessionId": sid, "screen": "trainee/session-detail", "phase": "t5", "action": "report_no_show"},
        ))
        await log_edge_case_action(
            'trainee_nudge_t5',
            session_id=sid,
            trainee_id=s.get('traineeId'),
            trainer_id=s.get('trainerId'),
            reason=f'T+{cfg.TRAINEE_NUDGE_T5_MIN}min — trainer still not here',
            idempotency_key=f"trainee_nudge_t5:{sid}",
        )
        fired += 1

    return fired


async def _job_admin_strike_alerts() -> int:
    """
    G3: When a trainer's performanceStrikes crosses 3 (accountUnderReview=true),
    push an in-app notification to every admin user. Idempotent via the
    `adminStrikeAlertSentAt` marker on the trainer record.
    """
    if not cfg.ENABLE_ADMIN_STRIKE_ALERT:
        return 0

    now = datetime.utcnow()
    trainers = await db.users.find({
        'accountUnderReview': True,
        'adminStrikeAlertSentAt': {'$exists': False},
        'performanceStrikes': {'$gte': 3},
    }).limit(20).to_list(20)

    if not trainers:
        return 0

    admins = await db.users.find({'roles': 'admin'}).to_list(50)
    admin_ids = [str(a['_id']) for a in admins]
    fired = 0

    for t in trainers:
        tid = str(t['_id'])
        # Compare-and-set the marker so we don't repeat.
        result = await db.users.update_one(
            {'_id': t['_id'], 'adminStrikeAlertSentAt': {'$exists': False}},
            {'$set': {'adminStrikeAlertSentAt': now}},
        )
        if result.modified_count == 0:
            continue
        strikes = t.get('performanceStrikes', 0)
        name = t.get('fullName') or t.get('email') or f"trainer {tid[:8]}"
        for aid in admin_ids:
            asyncio.create_task(create_and_send_notification(
                aid,
                "Trainer Under Review",
                f"{name} has hit {strikes} performance strikes and is now under review.",
                "admin_alert",
                {"trainerId": tid, "screen": "admin/dashboard"},
            ))
        await log_edge_case_action(
            'admin_strike_alert',
            trainer_id=tid,
            reason=f'{strikes} strikes → accountUnderReview=true',
            details={'adminCount': len(admin_ids), 'strikes': strikes},
            idempotency_key=f"admin_strike_alert:{tid}",
        )
        fired += 1

    return fired


# ───────────────────────────────────────────────────────────────────────
# Job E — G5: Failed-refund retry queue
# ───────────────────────────────────────────────────────────────────────
async def _job_refund_retry() -> int:
    """
    Retries entries in db.failed_refunds with exponential backoff. Each row:
      { paymentIntentId, sessionId, amountCents (optional), attempts,
        nextRetryAt, lastError, createdAt, adminAlertedAt (optional) }
    After REFUND_RETRY_MAX_ATTEMPTS, stops retrying and pings admins.
    Producers: session_routes.cancel_session, edge_case_scheduler.auto_no_show.
    """
    if not cfg.ENABLE_REFUND_RETRY:
        return 0

    now = datetime.utcnow()
    candidates = await db.failed_refunds.find({
        'nextRetryAt': {'$lte': now},
        'attempts': {'$lt': cfg.REFUND_RETRY_MAX_ATTEMPTS},
        'succeededAt': {'$exists': False},
    }).limit(cfg.REFUND_RETRY_BATCH_SIZE).to_list(cfg.REFUND_RETRY_BATCH_SIZE)

    retried = 0
    for r in candidates:
        pi_id = r.get('paymentIntentId')
        rid = r['_id']
        attempts = r.get('attempts', 0) + 1
        idempotency_key = f"refund_retry:{pi_id}:{attempts}"
        if not pi_id or pi_id.startswith('mock_'):
            # Nothing we can do with mocks; mark done.
            await db.failed_refunds.update_one(
                {'_id': rid},
                {'$set': {'succeededAt': now, 'result': 'skipped_mock'}},
            )
            continue

        try:
            refund = stripe.Refund.create(
                payment_intent=pi_id,
                reason='requested_by_customer',
                idempotency_key=f"refund:{idempotency_key}",
            )
            await db.failed_refunds.update_one(
                {'_id': rid},
                {'$set': {
                    'succeededAt': now,
                    'refundId': refund.id,
                    'attempts': attempts,
                }},
            )
            if r.get('sessionId'):
                await db.sessions.update_one(
                    {'_id': ObjectId(r['sessionId'])},
                    {'$set': {'stripeRefundId': refund.id, 'refundRetriedAt': now}},
                )
            await log_edge_case_action(
                'refund_retry_success',
                session_id=r.get('sessionId'),
                reason=f'Refund succeeded on attempt {attempts}',
                details={'paymentIntentId': pi_id, 'refundId': refund.id, 'attempts': attempts},
                idempotency_key=idempotency_key,
            )
            retried += 1
        except stripe.error.StripeError as e:
            # Schedule next retry with exponential backoff (capped at 24h).
            delay_sec = min(
                cfg.REFUND_RETRY_BASE_DELAY_SEC * (2 ** (attempts - 1)),
                24 * 3600,
            )
            next_retry = now + timedelta(seconds=delay_sec)
            reached_max = attempts >= cfg.REFUND_RETRY_MAX_ATTEMPTS
            await db.failed_refunds.update_one(
                {'_id': rid},
                {'$set': {
                    'attempts': attempts,
                    'lastError': str(e)[:500],
                    'lastAttemptAt': now,
                    'nextRetryAt': next_retry,
                }},
            )
            if reached_max and not r.get('adminAlertedAt'):
                # Ping admins and stop retrying.
                admins = await db.users.find({'roles': 'admin'}).to_list(20)
                for a in admins:
                    asyncio.create_task(create_and_send_notification(
                        str(a['_id']),
                        "Refund needs manual attention",
                        f"Failed to auto-refund after {attempts} attempts. Check /admin/refunds.",
                        "admin_alert",
                        {"paymentIntentId": pi_id, "sessionId": r.get('sessionId')},
                    ))
                await db.failed_refunds.update_one(
                    {'_id': rid},
                    {'$set': {'adminAlertedAt': now}},
                )
                await log_edge_case_action(
                    'refund_retry_exhausted',
                    session_id=r.get('sessionId'),
                    reason=f'Refund failed after {attempts} attempts — admin alerted',
                    details={'paymentIntentId': pi_id, 'lastError': str(e)[:200]},
                    idempotency_key=f"refund_exhausted:{pi_id}",
                )
    return retried


# Public helper used by other backend code (cancel_session, auto_no_show)
# to enqueue a failed refund for later retry. Keeps refund-retry logic
# out of the caller.
async def enqueue_failed_refund(
    payment_intent_id: str,
    session_id: Optional[str],
    error: str,
    amount_cents: Optional[int] = None,
) -> None:
    if not cfg.ENABLE_REFUND_RETRY or not payment_intent_id:
        return
    now = datetime.utcnow()
    # Idempotent: one row per PI.
    existing = await db.failed_refunds.find_one({'paymentIntentId': payment_intent_id})
    if existing:
        # Reset the retry cadence — a new failure means we want to try again soon.
        await db.failed_refunds.update_one(
            {'_id': existing['_id']},
            {'$set': {
                'nextRetryAt': now + timedelta(seconds=cfg.REFUND_RETRY_BASE_DELAY_SEC),
                'lastError': error[:500],
                'lastAttemptAt': now,
            }},
        )
        return
    await db.failed_refunds.insert_one({
        'paymentIntentId': payment_intent_id,
        'sessionId': session_id,
        'amountCents': amount_cents,
        'attempts': 0,
        'nextRetryAt': now + timedelta(seconds=cfg.REFUND_RETRY_BASE_DELAY_SEC),
        'lastError': error[:500],
        'createdAt': now,
    })


# ───────────────────────────────────────────────────────────────────────
# Loop
# ───────────────────────────────────────────────────────────────────────
async def edge_case_scheduler_loop() -> None:
    """Forever loop — must be started exactly once at app startup."""
    logger.info("edge_case_scheduler starting — config=%s", cfg.snapshot())

    # Idempotent index creation (also creates the unique idempotencyKey index).
    try:
        await ensure_audit_indexes()
        # iter106at: helpful indexes for the new failed_refunds retry queue.
        await db.failed_refunds.create_index([('paymentIntentId', 1)], unique=True)
        await db.failed_refunds.create_index([('nextRetryAt', 1), ('attempts', 1)])
    except Exception as e:
        logger.warning("ensure_audit_indexes failed (continuing): %s", e)

    while True:
        try:
            no_show = await _job_auto_no_show_trainer()
            decline = await _job_auto_decline_request()
            orphans = await _job_orphan_payment_reconcile()
            # iter106at Batch 2 jobs
            nudges = await _job_trainee_nudges()
            alerts = await _job_admin_strike_alerts()
            refunds = await _job_refund_retry()
            if no_show or decline or orphans or nudges or alerts or refunds:
                logger.info(
                    "edge_case_scheduler tick: no_show=%d decline=%d orphan=%d nudge=%d alert=%d refund=%d",
                    no_show, decline, orphans, nudges, alerts, refunds,
                )
        except Exception as e:
            logger.exception("edge_case_scheduler tick failed: %s", e)
        await asyncio.sleep(cfg.EDGE_CASE_LOOP_INTERVAL_SEC)
