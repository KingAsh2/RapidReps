"""iter102aq — Trainer accept flow defers payment until lock-in.

Contract:
- Booking writes a session with `paymentReady=False` (or unset), `negotiationStatus`
  unset, and outdoor sessions also `outdoorLocationAgreed=False`. No payment
  is taken at this step.
- Trainer hits PATCH /sessions/{id}/accept → must flip:
    status='confirmed', paymentReady=True, negotiationStatus='agreed',
    outdoorLocationAgreed=True (for outdoor sessions)
- Payment intent endpoint only works after `paymentReady=True`.

This locks in the user-requested rewrite: "Time, Date and location of outdoor
session needs to be confirmed by trainer before a payment is taken from the user."
"""
import os
import httpx
import pytest
from bson import ObjectId

BASE_URL = os.environ.get("PUBLIC_BACKEND_URL") or "http://localhost:8001"


def _auth(email: str, pw: str) -> tuple[str, str]:
    r = httpx.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, timeout=10.0)
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    me = httpx.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=10.0).json()
    return tok, me["id"]


def test_payment_intent_blocked_before_acceptance():
    """If the trainer hasn't accepted, the trainee cannot create a payment intent."""
    tok, _ = _auth("test_trainee_iter25@test.com", "Test123!")
    # Find a session that ISN'T paymentReady yet
    sessions = httpx.get(
        f"{BASE_URL}/api/trainee/sessions",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10.0,
    ).json()
    target = next(
        (s for s in sessions if not s.get("paymentReady") and s.get("status") in ("requested", "confirmed")),
        None,
    )
    if not target:
        pytest.skip("No un-paid pending session to test against.")
    r = httpx.post(
        f"{BASE_URL}/api/payments/create-payment-intent?amount_cents=5000&session_id={target['id']}",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10.0,
    )
    # Should be 400 with "negotiation not yet agreed" message
    assert r.status_code == 400, r.text
    assert "agreed" in r.text.lower() or "negotiation" in r.text.lower() or "unavail" in r.text.lower()


def test_session_response_exposes_payment_ready_flag():
    """Trainee session-detail screen needs `paymentReady` to know whether to
    render the 'Confirm & Pay' CTA."""
    tok, _ = _auth("test_trainee_iter25@test.com", "Test123!")
    r = httpx.get(
        f"{BASE_URL}/api/trainee/sessions",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10.0,
    )
    sessions = r.json()
    if not sessions:
        pytest.skip("No sessions seeded.")
    s = sessions[0]
    # Key must be present (None ok, missing not ok).
    assert "paymentReady" in s
    assert "negotiationStatus" in s
    assert "paymentStatus" in s
