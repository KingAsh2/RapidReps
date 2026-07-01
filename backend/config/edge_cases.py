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
    }
