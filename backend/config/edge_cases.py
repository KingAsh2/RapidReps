"""
edge_cases.py — centralized configuration for Critical Batch 1.

Every timeout / interval / SLA value lives here, sourced from environment
variables with safe production defaults. Tweak via `.env` without code change.

Source of truth referenced from:
  - edge_case_scheduler (loop interval, no-show window, request-timeout window)
  - routes/webhook_routes (Stripe webhook secret, orphan refund window)

All durations are minutes unless suffixed `_SEC`.
"""
from __future__ import annotations

import os


def _int(name: str, default: int) -> int:
    """Read an int env var; fall back to `default` if unset/garbage."""
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default


# ── Scheduler loop ────────────────────────────────────────────────────────
# How often the edge-case scheduler wakes up. 60s gives a worst-case 60s
# detection lag — fine for our 10-min / 60-min SLAs.
EDGE_CASE_LOOP_INTERVAL_SEC: int = _int("EDGE_CASE_LOOP_INTERVAL_SEC", 60)


# ── Scenario 1: Trainer auto no-show ──────────────────────────────────────
# Sessions whose `sessionDateTimeStart` is older than NO_SHOW_GRACE_MIN
# minutes AND that have neither `enRouteStartedAt` nor `trainerGpsConfirmed`
# get auto-flipped to NO_SHOW (party=trainer) by the scheduler.
NO_SHOW_GRACE_MIN: int = _int("NO_SHOW_GRACE_MIN", 10)
# Max sessions processed per scheduler tick — avoids monopolizing the loop
# when there's a backlog.
NO_SHOW_BATCH_SIZE: int = _int("NO_SHOW_BATCH_SIZE", 50)


# ── Scenario 5: Trainer auto-decline (unresponsive request) ───────────────
# A session in `requested` state older than this is auto-declined.
REQUEST_TIMEOUT_MIN: int = _int("REQUEST_TIMEOUT_MIN", 60)
# Earlier nudge: how many minutes before the timeout to push the trainer.
REQUEST_NUDGE_MIN: int = _int("REQUEST_NUDGE_MIN", 30)
# Ignores-per-window threshold for a strike.
RESPONSIVENESS_STRIKE_IGNORES: int = _int("RESPONSIVENESS_STRIKE_IGNORES", 3)
# The window (days) over which the strike-ignores count is evaluated.
RESPONSIVENESS_WINDOW_DAYS: int = _int("RESPONSIVENESS_WINDOW_DAYS", 7)
REQUEST_TIMEOUT_BATCH_SIZE: int = _int("REQUEST_TIMEOUT_BATCH_SIZE", 50)


# ── Scenario 7: Stripe orphan reconciliation ──────────────────────────────
# Webhook is the primary path; reconciliation is a safety net for sessions
# where the client confirm-call AND the webhook both failed. Looks back this
# many minutes.
ORPHAN_RECONCILE_LOOKBACK_MIN: int = _int("ORPHAN_RECONCILE_LOOKBACK_MIN", 60)
# Min age of a payment intent before we treat its session as a candidate
# (skip newly-created PIs that are still in normal client-confirm window).
ORPHAN_RECONCILE_MIN_AGE_MIN: int = _int("ORPHAN_RECONCILE_MIN_AGE_MIN", 10)
ORPHAN_BATCH_SIZE: int = _int("ORPHAN_BATCH_SIZE", 25)

# Stripe webhook signing secret (whsec_...). Set via .env in production.
# If unset, the webhook endpoint will reject all requests with 503 — fail
# closed rather than accept unsigned events.
STRIPE_WEBHOOK_SECRET: str | None = os.environ.get("STRIPE_WEBHOOK_SECRET") or None


# ── Feature flags ─────────────────────────────────────────────────────────
# Master kill-switches so ops can quickly disable any single job without a
# code deploy.
ENABLE_AUTO_NO_SHOW: bool = os.environ.get("ENABLE_AUTO_NO_SHOW", "true").lower() == "true"
ENABLE_AUTO_DECLINE: bool = os.environ.get("ENABLE_AUTO_DECLINE", "true").lower() == "true"
ENABLE_ORPHAN_RECONCILE: bool = os.environ.get("ENABLE_ORPHAN_RECONCILE", "true").lower() == "true"

# ── Batch 2 (iter106at) ───────────────────────────────────────────────────
# G2 — T+0 "Where's your trainer?" nudge to the trainee when the session
# clock hits start-time and the trainer hasn't gone en_route yet.
ENABLE_TRAINEE_NUDGES: bool = os.environ.get("ENABLE_TRAINEE_NUDGES", "true").lower() == "true"
TRAINEE_NUDGE_T0_MIN: int = _int("TRAINEE_NUDGE_T0_MIN", 0)  # at start-time
TRAINEE_NUDGE_T5_MIN: int = _int("TRAINEE_NUDGE_T5_MIN", 5)  # 5 min after start

# G3 — Admin alert channel when a trainer hits `accountUnderReview=true`
# from the 3rd strike. In-app admin notification only (no external deps).
ENABLE_ADMIN_STRIKE_ALERT: bool = os.environ.get("ENABLE_ADMIN_STRIKE_ALERT", "true").lower() == "true"

# G14 — Start-session gate. Trainer/trainee cannot press "start" before T-15
# or after T+30 relative to the scheduled sessionDateTimeStart. Outside T+30
# also triggers a late-start credit (see G16 below).
ENABLE_START_TIME_GATE: bool = os.environ.get("ENABLE_START_TIME_GATE", "true").lower() == "true"
START_EARLY_WINDOW_MIN: int = _int("START_EARLY_WINDOW_MIN", 15)   # can start T-15
START_LATE_WINDOW_MIN: int = _int("START_LATE_WINDOW_MIN", 30)     # cannot start after T+30
# G16 — Late-start credit: if the trainer starts > this many minutes late,
# stamp lateStartCredit=true and issue a 50% virtual-session credit to the
# trainee. Different from the hard reject at START_LATE_WINDOW_MIN (30).
LATE_START_CREDIT_THRESHOLD_MIN: int = _int("LATE_START_CREDIT_THRESHOLD_MIN", 30)

# G15 — End-session max-duration cap. If the trainer ends a session > this
# multiple of the planned durationMinutes, reject with 400 and require a
# confirmation via ?confirm=true (client-side modal). Stops absurd durations
# poisoning earnings/analytics.
ENABLE_END_DURATION_CAP: bool = os.environ.get("ENABLE_END_DURATION_CAP", "true").lower() == "true"
END_DURATION_CAP_MULTIPLIER: float = float(os.environ.get("END_DURATION_CAP_MULTIPLIER", "2.0"))

# G5 — Failed-refund retry queue. When Stripe rejects a refund
# (network/expired charge/rate limit), we insert into db.failed_refunds and
# retry on the scheduler with exponential backoff (5 attempts) before
# alerting an admin.
ENABLE_REFUND_RETRY: bool = os.environ.get("ENABLE_REFUND_RETRY", "true").lower() == "true"
REFUND_RETRY_MAX_ATTEMPTS: int = _int("REFUND_RETRY_MAX_ATTEMPTS", 5)
REFUND_RETRY_BATCH_SIZE: int = _int("REFUND_RETRY_BATCH_SIZE", 20)
# Base delay in seconds; effective delay = base * 2^(attempts-1), capped at 24h.
REFUND_RETRY_BASE_DELAY_SEC: int = _int("REFUND_RETRY_BASE_DELAY_SEC", 300)


def snapshot() -> dict:
    """Return current config as a dict — useful for /admin debug endpoints and tests."""
    return {
        "EDGE_CASE_LOOP_INTERVAL_SEC": EDGE_CASE_LOOP_INTERVAL_SEC,
        "NO_SHOW_GRACE_MIN": NO_SHOW_GRACE_MIN,
        "NO_SHOW_BATCH_SIZE": NO_SHOW_BATCH_SIZE,
        "REQUEST_TIMEOUT_MIN": REQUEST_TIMEOUT_MIN,
        "REQUEST_NUDGE_MIN": REQUEST_NUDGE_MIN,
        "RESPONSIVENESS_STRIKE_IGNORES": RESPONSIVENESS_STRIKE_IGNORES,
        "RESPONSIVENESS_WINDOW_DAYS": RESPONSIVENESS_WINDOW_DAYS,
        "REQUEST_TIMEOUT_BATCH_SIZE": REQUEST_TIMEOUT_BATCH_SIZE,
        "ORPHAN_RECONCILE_LOOKBACK_MIN": ORPHAN_RECONCILE_LOOKBACK_MIN,
        "ORPHAN_RECONCILE_MIN_AGE_MIN": ORPHAN_RECONCILE_MIN_AGE_MIN,
        "ORPHAN_BATCH_SIZE": ORPHAN_BATCH_SIZE,
        "STRIPE_WEBHOOK_SECRET_SET": bool(STRIPE_WEBHOOK_SECRET),
        "ENABLE_AUTO_NO_SHOW": ENABLE_AUTO_NO_SHOW,
        "ENABLE_AUTO_DECLINE": ENABLE_AUTO_DECLINE,
        "ENABLE_ORPHAN_RECONCILE": ENABLE_ORPHAN_RECONCILE,
        # Batch 2 (iter106at)
        "ENABLE_TRAINEE_NUDGES": ENABLE_TRAINEE_NUDGES,
        "TRAINEE_NUDGE_T0_MIN": TRAINEE_NUDGE_T0_MIN,
        "TRAINEE_NUDGE_T5_MIN": TRAINEE_NUDGE_T5_MIN,
        "ENABLE_ADMIN_STRIKE_ALERT": ENABLE_ADMIN_STRIKE_ALERT,
        "ENABLE_START_TIME_GATE": ENABLE_START_TIME_GATE,
        "START_EARLY_WINDOW_MIN": START_EARLY_WINDOW_MIN,
        "START_LATE_WINDOW_MIN": START_LATE_WINDOW_MIN,
        "LATE_START_CREDIT_THRESHOLD_MIN": LATE_START_CREDIT_THRESHOLD_MIN,
        "ENABLE_END_DURATION_CAP": ENABLE_END_DURATION_CAP,
        "END_DURATION_CAP_MULTIPLIER": END_DURATION_CAP_MULTIPLIER,
        "ENABLE_REFUND_RETRY": ENABLE_REFUND_RETRY,
        "REFUND_RETRY_MAX_ATTEMPTS": REFUND_RETRY_MAX_ATTEMPTS,
        "REFUND_RETRY_BATCH_SIZE": REFUND_RETRY_BATCH_SIZE,
        "REFUND_RETRY_BASE_DELAY_SEC": REFUND_RETRY_BASE_DELAY_SEC,
    }
