"""iter102aq — Backend contract for the shortened booking flow.

The frontend collapsed booking from 2 screens to 1: trainee picks date/time
inline on trainer-detail and hits SEND REQUEST → straight POST to /api/sessions.
Payment is deferred until the trainer accepts (which also locks in the
agreed time/location).

This test file verifies the BACKEND contract that this minimal-screen flow
depends on:
  1. POST /api/sessions creates a session in REQUESTED status with the
     trainee-supplied time/duration/type/location.
  2. New session has paymentReady=False and negotiationStatus=None.
     /api/payments/create-payment-intent must return 400 with an
     'agreed'/'negotiation' error before trainer accepts.
  3. PATCH /api/sessions/{id}/accept flips status=CONFIRMED, paymentReady=True,
     negotiationStatus='agreed', outdoorLocationAgreed=True (outdoor).
  4. After accept, the payment-intent endpoint stops 400ing on the gate
     (it may still 503 if Stripe isn't configured — that's a separate concern).
  5. GET /api/sessions/{id} surfaces paymentReady, negotiationStatus,
     paymentStatus, videoCallLink (virtual only), traineeName/Photo/Phone.
  6. PUT /api/trainer-profiles/{id}/video-call-link round-trips a valid URL,
     rejects invalid scheme (400), rejects cross-account write (403).
  7. PATCH /api/sessions/{id}/accept refuses if trainer is not verified (403).
  8. Pricing chain — 60-min outdoor on tier inPerson60Cents=9000 →
     finalSessionPriceCents == 9000 + 299 (SERVICE_FEE_CENTS) == 9299.
"""
from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone

import httpx
import pytest

# Direct mongo for one-shot seed of the trainer's live-readiness flags.
# Without this, prior test runs that flipped verificationStatus='rejected'
# block POST /sessions before the iter102aq contract can be exercised.
import sys
sys.path.insert(0, "/app/backend")
from pymongo import MongoClient  # noqa: E402
from dotenv import load_dotenv  # noqa: E402
load_dotenv("/app/backend/.env")
_mongo = MongoClient(os.environ["MONGO_URL"])
_db = _mongo[os.environ["DB_NAME"]]


BASE_URL = (
    os.environ.get("PUBLIC_BACKEND_URL")
    or os.environ.get("REACT_APP_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://highlight-vibe-bugs.preview.emergentagent.com"
).rstrip("/")

TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
ADMIN_EMAIL = "admin@rapidreps.com"
PWD = "Test123!"
ADMIN_PWD = "admin123"
SERVICE_FEE_CENTS = 299
TIMEOUT = 15.0


# ───────────────────────── helpers ─────────────────────────
def _login(email: str, password: str) -> tuple[str, dict]:
    r = httpx.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in login resp: {r.text}"
    me = httpx.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=TIMEOUT,
    ).json()
    return tok, me


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _set_tier_rate(tok: str, in_person_60_cents: int) -> None:
    """Trainer sets their tierRates.inPerson60Cents via the trainer-only endpoint."""
    r = httpx.post(
        f"{BASE_URL}/api/trainer/tier-rates",
        headers=_h(tok),
        json={
            "inPerson30Cents": max(in_person_60_cents // 2, 2000),
            "inPerson45Cents": max(int(in_person_60_cents * 0.75), 2500),
            "inPerson60Cents": in_person_60_cents,
            "inPerson90Cents": int(in_person_60_cents * 1.4),
        },
        timeout=TIMEOUT,
    )
    assert r.status_code in (200, 201), f"set tier rates failed: {r.status_code} {r.text}"


def _create_outdoor_session(trainee_tok: str, trainer_user_id: str, duration: int = 60) -> dict:
    start = (datetime.now(timezone.utc) + timedelta(days=2, hours=1)).isoformat()
    payload = {
        "trainerId": trainer_user_id,
        "traineeId": "",  # backend overrides from token
        "sessionDateTimeStart": start,
        "durationMinutes": duration,
        "sessionType": "outdoor",
        "locationType": "outdoor",
        "locationNameOrAddress": "Central Park, NYC",
        "notes": "iter102aq backend contract test",
    }
    # Some backends auto-fill traineeId from token; pre-fill from /me to be safe.
    me = httpx.get(
        f"{BASE_URL}/api/auth/me", headers=_h(trainee_tok), timeout=TIMEOUT
    ).json()
    payload["traineeId"] = me["id"]
    r = httpx.post(
        f"{BASE_URL}/api/sessions", headers=_h(trainee_tok), json=payload, timeout=TIMEOUT
    )
    assert r.status_code in (200, 201), f"POST /sessions failed: {r.status_code} {r.text}"
    return r.json()


# ───────────────────────── fixtures ─────────────────────────
@pytest.fixture(scope="module")
def tokens():
    # Pre-seed: trainer must be live-able for POST /api/sessions to succeed.
    # Prior test runs in this sandbox flipped verificationStatus='rejected'.
    # We restore the documented baseline (verified, all gates passed, bio/styles
    # present) so the iter102aq contract can be exercised. This mirrors what
    # the admin verify flow would do in prod.
    trainer_user = _db.users.find_one({"email": TRAINER_EMAIL})
    assert trainer_user, "Seed trainer missing — cannot test."
    _trainer_id = str(trainer_user["_id"])
    _original_profile = _db.trainer_profiles.find_one({"userId": _trainer_id}) or {}
    _db.trainer_profiles.update_one(
        {"userId": _trainer_id},
        {"$set": {
            "verificationStatus": "verified",
            "governmentIdUploaded": True,
            "ssnVerified": True,
            "backgroundCheckPassed": True,
            "sexOffenderCheckPassed": True,
            "cprAedCertUploaded": True,
            "bio": "Certified personal trainer with 8+ years of experience helping clients reach their goals through strength, conditioning, and outdoor training.",
            "trainingStyles": ["strength", "hiit", "outdoor"],
            "offersOutdoor": True,
            "outdoorRateCents": 8500,
            "assignedTier": "specialty",
        }},
        upsert=True,
    )
    trainer_tok, trainer_me = _login(TRAINER_EMAIL, PWD)
    trainee_tok, trainee_me = _login(TRAINEE_EMAIL, PWD)
    yield {
        "trainer_tok": trainer_tok,
        "trainer_id": trainer_me["id"],
        "trainee_tok": trainee_tok,
        "trainee_id": trainee_me["id"],
    }
    # No restore: we leave the trainer in a usable state so subsequent test
    # runs (and the main agent's manual verification) don't re-trip the gate.


# ─────────────────── 1. POST /api/sessions contract ───────────────────
def test_post_sessions_creates_requested_with_supplied_terms(tokens):
    _set_tier_rate(tokens["trainer_tok"], 9000)
    s = _create_outdoor_session(tokens["trainee_tok"], tokens["trainer_id"], duration=60)

    assert s.get("status") == "requested", f"expected status=requested, got {s.get('status')}"
    assert s.get("durationMinutes") == 60
    assert s.get("sessionType") in ("outdoor", "in_person", "in-person"), s.get("sessionType")
    assert s.get("locationType") == "outdoor"
    assert s.get("locationNameOrAddress") == "Central Park, NYC"
    assert s.get("id"), "missing session id"
    # GET-after-CREATE for persistence
    g = httpx.get(
        f"{BASE_URL}/api/sessions/{s['id']}", headers=_h(tokens["trainee_tok"]), timeout=TIMEOUT
    )
    assert g.status_code == 200, g.text
    g_json = g.json()
    assert g_json["id"] == s["id"]
    assert g_json["status"] == "requested"


# ─────────── 2. Payment gate blocks before acceptance ───────────
def test_payment_intent_blocked_before_acceptance(tokens):
    _set_tier_rate(tokens["trainer_tok"], 9000)
    s = _create_outdoor_session(tokens["trainee_tok"], tokens["trainer_id"])
    # paymentReady should be False/None and negotiationStatus None
    assert not s.get("paymentReady"), f"paymentReady should be falsy before accept, got {s.get('paymentReady')}"
    assert s.get("negotiationStatus") in (None, "", "pending"), s.get("negotiationStatus")

    r = httpx.post(
        f"{BASE_URL}/api/payments/create-payment-intent",
        params={"amount_cents": 9299, "session_id": s["id"]},
        headers=_h(tokens["trainee_tok"]),
        timeout=TIMEOUT,
    )
    assert r.status_code == 400, f"expected 400 gate, got {r.status_code}: {r.text}"
    body = r.text.lower()
    assert ("agreed" in body) or ("negotiation" in body), f"gate message wrong: {r.text}"


# ─────────── 3. PATCH /accept flips the flags ───────────
def test_accept_flips_flags_for_outdoor(tokens):
    _set_tier_rate(tokens["trainer_tok"], 9000)
    s = _create_outdoor_session(tokens["trainee_tok"], tokens["trainer_id"])
    sid = s["id"]
    r = httpx.patch(
        f"{BASE_URL}/api/sessions/{sid}/accept",
        headers=_h(tokens["trainer_tok"]),
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"accept failed: {r.status_code} {r.text}"
    accepted = r.json()
    assert accepted.get("status") == "confirmed", accepted.get("status")
    assert accepted.get("paymentReady") is True, f"paymentReady not flipped: {accepted}"
    assert accepted.get("negotiationStatus") == "agreed", accepted.get("negotiationStatus")
    assert accepted.get("outdoorLocationAgreed") is True, accepted.get("outdoorLocationAgreed")

    # Persisted via GET
    g = httpx.get(
        f"{BASE_URL}/api/sessions/{sid}", headers=_h(tokens["trainee_tok"]), timeout=TIMEOUT
    ).json()
    assert g["status"] == "confirmed"
    assert g["paymentReady"] is True
    assert g["negotiationStatus"] == "agreed"
    assert g["outdoorLocationAgreed"] is True


# ─────────── 4. After accept, payment-intent passes the gate ───────────
def test_payment_intent_passes_gate_after_acceptance(tokens):
    _set_tier_rate(tokens["trainer_tok"], 9000)
    s = _create_outdoor_session(tokens["trainee_tok"], tokens["trainer_id"])
    sid = s["id"]
    ar = httpx.patch(
        f"{BASE_URL}/api/sessions/{sid}/accept",
        headers=_h(tokens["trainer_tok"]),
        timeout=TIMEOUT,
    )
    assert ar.status_code == 200, ar.text

    r = httpx.post(
        f"{BASE_URL}/api/payments/create-payment-intent",
        params={"amount_cents": 9299, "session_id": sid},
        headers=_h(tokens["trainee_tok"]),
        timeout=TIMEOUT,
    )
    # 200 (Stripe configured) OR 503 (Stripe unavailable) are both acceptable;
    # 400 with the negotiation message means the gate failed to release.
    assert r.status_code != 400 or (
        "negotiation" not in r.text.lower() and "agreed" not in r.text.lower()
    ), f"gate did NOT release after accept: {r.status_code} {r.text}"
    assert r.status_code in (200, 503, 502), f"unexpected status {r.status_code}: {r.text}"


# ─────────── 5. GET /sessions/{id} surfaces required fields ───────────
def test_get_session_surfaces_required_fields(tokens):
    _set_tier_rate(tokens["trainer_tok"], 9000)
    s = _create_outdoor_session(tokens["trainee_tok"], tokens["trainer_id"])
    sid = s["id"]
    # Accept so the session has the joined fields and flipped flags
    httpx.patch(
        f"{BASE_URL}/api/sessions/{sid}/accept",
        headers=_h(tokens["trainer_tok"]),
        timeout=TIMEOUT,
    )
    g = httpx.get(
        f"{BASE_URL}/api/sessions/{sid}", headers=_h(tokens["trainer_tok"]), timeout=TIMEOUT
    )
    assert g.status_code == 200, g.text
    j = g.json()
    for key in (
        "paymentReady", "negotiationStatus", "paymentStatus",
        "traineeName", "traineePhoto", "traineePhone",
    ):
        assert key in j, f"missing key on SessionResponse: {key} (resp={list(j.keys())})"
    # Trainer surface should see the trainee's name
    assert j.get("traineeName"), f"traineeName not joined: {j.get('traineeName')}"


# ─────────── 6. PUT /trainer-profiles/{id}/video-call-link ───────────
def test_video_call_link_roundtrip_valid(tokens):
    url = "https://zoom.us/j/iter102aq-roundtrip-test"
    r = httpx.put(
        f"{BASE_URL}/api/trainer-profiles/{tokens['trainer_id']}/video-call-link",
        headers=_h(tokens["trainer_tok"]),
        json={"videoCallLink": url},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"PUT video-call-link failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("videoCallLink") == url
    # Verify it persisted on the trainer profile
    p = httpx.get(
        f"{BASE_URL}/api/trainer-profiles/{tokens['trainer_id']}",
        headers=_h(tokens["trainee_tok"]),
        timeout=TIMEOUT,
    )
    assert p.status_code == 200, p.text
    assert p.json().get("videoCallLink") == url


def test_video_call_link_rejects_invalid_scheme(tokens):
    r = httpx.put(
        f"{BASE_URL}/api/trainer-profiles/{tokens['trainer_id']}/video-call-link",
        headers=_h(tokens["trainer_tok"]),
        json={"videoCallLink": "ftp://evil.example.com/meet"},
        timeout=TIMEOUT,
    )
    assert r.status_code == 400, f"expected 400 for bad scheme, got {r.status_code}: {r.text}"


def test_video_call_link_rejects_cross_account(tokens):
    # Trainee tries to write the trainer's link
    r = httpx.put(
        f"{BASE_URL}/api/trainer-profiles/{tokens['trainer_id']}/video-call-link",
        headers=_h(tokens["trainee_tok"]),
        json={"videoCallLink": "https://meet.google.com/abc-defg-hij"},
        timeout=TIMEOUT,
    )
    assert r.status_code == 403, f"expected 403 cross-account, got {r.status_code}: {r.text}"


# ─────────── 7. Unverified trainer can't accept ───────────
def test_unverified_trainer_cannot_accept(tokens):
    """Flip trainer verification to 'rejected' directly in DB, attempt accept
    (must 403 with verification message), then restore to 'verified'."""
    _set_tier_rate(tokens["trainer_tok"], 9000)
    s = _create_outdoor_session(tokens["trainee_tok"], tokens["trainer_id"])
    sid = s["id"]

    # Flip via direct DB write (the admin endpoint signature isn't part of
    # this iteration's contract; we just need the gate state).
    _db.trainer_profiles.update_one(
        {"userId": tokens["trainer_id"]},
        {"$set": {"verificationStatus": "pending"}},
    )
    try:
        r = httpx.patch(
            f"{BASE_URL}/api/sessions/{sid}/accept",
            headers=_h(tokens["trainer_tok"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 403, f"unverified trainer accept should 403, got {r.status_code}: {r.text}"
        assert "verif" in r.text.lower(), f"403 message should mention verification: {r.text}"
    finally:
        _db.trainer_profiles.update_one(
            {"userId": tokens["trainer_id"]},
            {"$set": {"verificationStatus": "verified"}},
        )


# ─────────── 8. Pricing chain: 60-min outdoor @ inPerson60Cents=9000 ───────────
def test_pricing_chain_outdoor_60_with_tier_rate(tokens):
    _set_tier_rate(tokens["trainer_tok"], 9000)
    s = _create_outdoor_session(tokens["trainee_tok"], tokens["trainer_id"], duration=60)
    final_cents = s.get("finalSessionPriceCents")
    expected = 9000 + SERVICE_FEE_CENTS  # 9299
    assert final_cents == expected, (
        f"finalSessionPriceCents={final_cents} expected {expected} "
        f"(9000 tier + 299 service fee). baseSessionPriceCents={s.get('baseSessionPriceCents')} "
        f"travelFeeCents={s.get('travelFeeCents')} discountAmountCents={s.get('discountAmountCents')}"
    )
