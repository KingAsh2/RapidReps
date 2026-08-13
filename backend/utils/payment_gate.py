"""
iter118be — Payment gate for session start / arrival / check-in.

Any handler that transitions a session toward `in_progress` MUST call
`require_paid_session(session)` first. This blocks off-platform
circumvention where a trainer + trainee agree a price, then start the
session on the app to satisfy the tracking / rating / streak features
while paying each other outside RapidReps.

Exceptions (spelled out so we can audit later):
- Free sessions (`finalSessionPriceCents == 0` and `paymentStatus` in
  {'skipped', 'paid'}) — allowed. Kept for admin comp / promo flows.
- `paymentStatus` in {'paid', 'succeeded'} — canonical happy path.
- Any other status — reject with HTTP 402 Payment Required.

The precise field used across the codebase is `sessions.paymentStatus`
(see negotiation_routes.py:395, webhook_routes.py:239). We treat 'paid'
and 'succeeded' as equivalent because both spellings exist in DB rows.
"""
from fastapi import HTTPException

PAID_STATUSES = {"paid", "succeeded"}
FREE_STATUSES = {"skipped", "waived", "free", "comp"}


def require_paid_session(session: dict) -> None:
    """Raise 402 if the session isn't paid. Idempotent — call anywhere."""
    if not session:
        # let the caller's own 404 handle it — this fn shouldn't gate 404s
        return
    status = (session.get("paymentStatus") or "").lower()
    if status in PAID_STATUSES:
        return
    # Allow explicit free / waived sessions (admin comps / promos).
    price_cents = int(
        session.get("finalSessionPriceCents")
        or session.get("priceCents")
        or 0
    )
    if price_cents == 0 and status in FREE_STATUSES:
        return
    raise HTTPException(
        status_code=402,
        detail={
            "code": "PAYMENT_REQUIRED",
            "message": (
                "Payment must be confirmed before starting or checking in "
                "to this session. Please complete payment inside RapidReps."
            ),
            "sessionPaymentStatus": status or "unpaid",
        },
    )
