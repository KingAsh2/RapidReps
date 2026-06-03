"""
Iter95 — Live end-to-end backend tests for the Negotiation state machine,
Pricing quote, Tier assignment, Session details surfacing of negotiation
fields, and Payment gating on negotiationStatus=='agreed'.

Scope (per main agent review_request):
  - Backend negotiation happy path (propose → counter → accept)
  - Backend negotiation rejection path + re-propose after reject
  - Payment gating on /api/payments/create-payment-intent
  - Pricing quote endpoint sanity per tier matrix
  - Admin tier assignment endpoint
  - GET /api/sessions/{id} surfaces negotiationStatus/agreedTime/agreedLocation/paymentReady
  - Permission (non-participant -> 403) and counter-turn enforcement (400)
  - Auto-expiry of stale proposals (>60 min) and re-propose afterward

Uses live preview backend (EXPO_PUBLIC_BACKEND_URL) and the documented
test_credentials.md accounts. Sessions are seeded directly via MongoDB to
avoid coupling to the booking flow (per main-agent's note).
"""
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests
from bson import ObjectId
from pymongo import MongoClient

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://highlight-vibe-bugs.preview.emergentagent.com",
).rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "rapidreps")

ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASS = "admin123"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
USER_PASS = "Test123!"


def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"Login failed for {email}: {r.status_code} {r.text[:200]}")
    token = r.json().get("access_token") or r.json().get("token")
    if not token:
        pytest.skip(f"No token in login response for {email}: {r.json()}")
    return token


def _hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _user_id_from_me(tok: str) -> str:
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(tok), timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    return body.get("id") or body.get("_id") or body.get("userId")


# ── Fixtures ──────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def mongo():
    cli = MongoClient(MONGO_URL)
    yield cli[DB_NAME]
    cli.close()


@pytest.fixture(scope="module")
def tokens():
    return {
        "admin": _login(ADMIN_EMAIL, ADMIN_PASS),
        "trainee": _login(TRAINEE_EMAIL, USER_PASS),
        "trainer": _login(TRAINER_EMAIL, USER_PASS),
    }


@pytest.fixture(scope="module")
def ids(tokens):
    return {
        "trainee": _user_id_from_me(tokens["trainee"]),
        "trainer": _user_id_from_me(tokens["trainer"]),
    }


def _make_session(mongo, trainee_id: str, trainer_id: str, modality: str = "in_person") -> str:
    """Insert a bare session doc; return string ObjectId."""
    doc = {
        "traineeId": trainee_id,
        "trainerId": trainer_id,
        "status": "requested",
        "sessionType": "outdoor" if modality == "in_person" else "virtual",
        "modality": modality,
        "durationMinutes": 60,
        "baseSessionPriceCents": 8000,
        "createdAt": datetime.now(timezone.utc),
        "negotiationTimeline": [],
    }
    res = mongo.sessions.insert_one(doc)
    return str(res.inserted_id)


@pytest.fixture
def session_id(mongo, ids):
    sid = _make_session(mongo, ids["trainee"], ids["trainer"])
    yield sid
    mongo.sessions.delete_one({"_id": ObjectId(sid)})


# ════════════════════════════════════════════════════════════════════════
# Sanity: auth + login
# ════════════════════════════════════════════════════════════════════════
def test_login_works_for_all_three_accounts(tokens):
    assert tokens["admin"] and tokens["trainee"] and tokens["trainer"]


# ════════════════════════════════════════════════════════════════════════
# Pricing quote (no session needed)
# ════════════════════════════════════════════════════════════════════════
class TestPricingQuote:
    def test_quote_new_in_person_60_8000(self, tokens):
        r = requests.get(
            f"{BASE_URL}/api/pricing/quote",
            params={"tier": "new", "modality": "in_person", "duration": 60, "base_cents": 8000},
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        # base=8000, fee=499 → customer_total=8499; commission 25% = 2000
        # But cap for new/in_person/60 = 6500, so 8000 should EXCEED cap → 400
        # Update: matrix says new/in_person/60 = 6500 cap → 8000 exceeds.
        assert r.status_code == 400, f"Expected cap-exceeded 400, got {r.status_code}: {r.text}"
        assert "cap" in r.text.lower() or "exceed" in r.text.lower()

    def test_quote_new_in_person_60_within_cap(self, tokens):
        r = requests.get(
            f"{BASE_URL}/api/pricing/quote",
            params={"tier": "new", "modality": "in_person", "duration": 60, "base_cents": 6500},
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["base_price_cents"] == 6500
        assert b["service_fee_cents"] == 499
        assert b["customer_total_cents"] == 6500 + 499
        assert b["commission_percent"] == 25
        # 25% of 6500 = 1625; trainer take home 4875
        assert b["commission_cents"] == 1625
        assert b["trainer_take_home_cents"] == 4875

    def test_quote_certified_virtual_60_8000(self, tokens):
        r = requests.get(
            f"{BASE_URL}/api/pricing/quote",
            params={"tier": "certified", "modality": "virtual", "duration": 60, "base_cents": 8000},
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["commission_percent"] == 20
        assert b["service_fee_cents"] == 499  # certified/virtual fee
        assert b["customer_total_cents"] == 8499

    def test_quote_specialty_in_person_60_14000(self, tokens):
        r = requests.get(
            f"{BASE_URL}/api/pricing/quote",
            params={"tier": "specialty", "modality": "in_person", "duration": 60, "base_cents": 14000},
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["commission_percent"] == 15
        assert b["service_fee_cents"] == 799
        assert b["customer_total_cents"] == 14799


# ════════════════════════════════════════════════════════════════════════
# Tier assignment (admin)
# ════════════════════════════════════════════════════════════════════════
class TestTierAssignment:
    def test_admin_assigns_tier_to_trainer(self, tokens, ids, mongo):
        r = requests.post(
            f"{BASE_URL}/api/admin/trainers/{ids['trainer']}/assign-tier",
            json={"tier": "certified"},
            headers=_hdr(tokens["admin"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("tier") == "certified"
        # Verify DB persistence
        prof = mongo.trainer_profiles.find_one({"userId": ids["trainer"]})
        assert prof is not None
        assert prof.get("assignedTier") == "certified"

    def test_non_admin_cannot_assign_tier(self, tokens, ids):
        r = requests.post(
            f"{BASE_URL}/api/admin/trainers/{ids['trainer']}/assign-tier",
            json={"tier": "specialty"},
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        assert r.status_code in (401, 403), r.text

    def test_invalid_tier_rejected(self, tokens, ids):
        r = requests.post(
            f"{BASE_URL}/api/admin/trainers/{ids['trainer']}/assign-tier",
            json={"tier": "bogus"},
            headers=_hdr(tokens["admin"]),
            timeout=30,
        )
        assert r.status_code == 400


# ════════════════════════════════════════════════════════════════════════
# Negotiation happy path
# ════════════════════════════════════════════════════════════════════════
class TestNegotiationHappyPath:
    def test_propose_counter_accept_then_paymentReady(self, tokens, session_id):
        sid = session_id
        future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        # 1) Trainee proposes
        r = requests.post(
            f"{BASE_URL}/api/sessions/{sid}/negotiation/propose",
            json={
                "proposedTime": future,
                "proposedLocation": {"address": "Central Park, NYC", "lat": 40.78, "lng": -73.97},
            },
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "proposed_by_trainee"

        # 2) Trainer counters
        future2 = (datetime.now(timezone.utc) + timedelta(days=2, hours=1)).isoformat()
        r = requests.post(
            f"{BASE_URL}/api/sessions/{sid}/negotiation/counter",
            json={
                "proposedTime": future2,
                "proposedLocation": {"address": "Prospect Park, Brooklyn", "lat": 40.66, "lng": -73.97},
            },
            headers=_hdr(tokens["trainer"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "countered_by_trainer"

        # 3) Trainee accepts the counter
        r = requests.post(
            f"{BASE_URL}/api/sessions/{sid}/negotiation/accept",
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "agreed"
        assert body.get("agreedTime") is not None
        assert body.get("agreedLocation") is not None

        # 4) Timeline reflects agreed + paymentReady
        r = requests.get(
            f"{BASE_URL}/api/sessions/{sid}/negotiation/timeline",
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["negotiationStatus"] == "agreed"
        assert t["paymentReady"] is True
        assert isinstance(t["timeline"], list) and len(t["timeline"]) >= 3

    def test_session_detail_surfaces_negotiation_fields(self, tokens, session_id):
        """GET /api/sessions/{id} should expose negotiationStatus, agreedTime,
        agreedLocation, paymentReady — per review_request item #6."""
        sid = session_id
        future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        requests.post(
            f"{BASE_URL}/api/sessions/{sid}/negotiation/propose",
            json={"proposedTime": future, "proposedLocation": {"address": "Gym A"}},
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        requests.post(
            f"{BASE_URL}/api/sessions/{sid}/negotiation/accept",
            headers=_hdr(tokens["trainer"]),
            timeout=30,
        )
        r = requests.get(
            f"{BASE_URL}/api/sessions/{sid}", headers=_hdr(tokens["trainee"]), timeout=30
        )
        assert r.status_code == 200, r.text
        body = r.json()
        missing = [
            f for f in ("negotiationStatus", "agreedTime", "agreedLocation", "paymentReady")
            if f not in body
        ]
        assert not missing, (
            f"GET /api/sessions/{{id}} is missing required negotiation fields: {missing}. "
            f"Returned keys: {sorted(body.keys())}"
        )


# ════════════════════════════════════════════════════════════════════════
# Negotiation rejection + re-propose
# ════════════════════════════════════════════════════════════════════════
class TestNegotiationRejection:
    def test_propose_reject_then_re_propose_allowed(self, tokens, session_id):
        sid = session_id
        future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        r = requests.post(
            f"{BASE_URL}/api/sessions/{sid}/negotiation/propose",
            json={"proposedTime": future, "proposedLocation": {"address": "Loc1"}},
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text

        r = requests.post(
            f"{BASE_URL}/api/sessions/{sid}/negotiation/reject",
            json={"reason": "doesn't work for me"},
            headers=_hdr(tokens["trainer"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "rejected"

        # Re-propose should be allowed
        future2 = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        r = requests.post(
            f"{BASE_URL}/api/sessions/{sid}/negotiation/propose",
            json={"proposedTime": future2, "proposedLocation": {"address": "Loc2"}},
            headers=_hdr(tokens["trainer"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "proposed_by_trainer"


# ════════════════════════════════════════════════════════════════════════
# Permissions + turn enforcement
# ════════════════════════════════════════════════════════════════════════
class TestPermissionsAndTurn:
    def test_non_participant_blocked(self, tokens, session_id):
        # Admin is not a participant in this session
        future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        r = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/negotiation/propose",
            json={"proposedTime": future, "proposedLocation": {"address": "X"}},
            headers=_hdr(tokens["admin"]),
            timeout=30,
        )
        assert r.status_code == 403, r.text
        assert "participant" in r.text.lower()

    def test_cannot_counter_own_proposal(self, tokens, session_id):
        future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        r = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/negotiation/propose",
            json={"proposedTime": future, "proposedLocation": {"address": "A"}},
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        assert r.status_code == 200
        # Same trainee counters → must be rejected
        r = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/negotiation/counter",
            json={"proposedTime": future, "proposedLocation": {"address": "B"}},
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        assert r.status_code == 400, r.text


# ════════════════════════════════════════════════════════════════════════
# Auto-expiry (>60 min)
# ════════════════════════════════════════════════════════════════════════
class TestExpiry:
    def test_stale_proposal_auto_expires_and_repropose_allowed(self, tokens, session_id, mongo):
        future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        r = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/negotiation/propose",
            json={"proposedTime": future, "proposedLocation": {"address": "X"}},
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        assert r.status_code == 200
        # Backdate the negotiationLastUpdatedAt to 2 hours ago
        old = datetime.now(timezone.utc) - timedelta(hours=2)
        mongo.sessions.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"negotiationLastUpdatedAt": old}},
        )
        # Reading timeline triggers expiry
        r = requests.get(
            f"{BASE_URL}/api/sessions/{session_id}/negotiation/timeline",
            headers=_hdr(tokens["trainer"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["negotiationStatus"] == "expired"
        # Re-propose now allowed
        r = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/negotiation/propose",
            json={"proposedTime": future, "proposedLocation": {"address": "Y"}},
            headers=_hdr(tokens["trainer"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text


# ════════════════════════════════════════════════════════════════════════
# Payment gating
# ════════════════════════════════════════════════════════════════════════
class TestPaymentGating:
    def test_create_payment_intent_blocked_before_agreed(self, tokens, session_id):
        """REQUIREMENT: create-payment-intent must fail (or return clear error)
        when negotiationStatus != 'agreed' / paymentReady != true.

        If this test fails it means payment gating is NOT enforced server-side.
        """
        r = requests.post(
            f"{BASE_URL}/api/payments/create-payment-intent"
            f"?amount_cents=8499&session_id={session_id}&description=Test",
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        # Acceptable: 400/403/409. NOT acceptable: 200 with a payment intent.
        assert r.status_code in (400, 402, 403, 409), (
            f"Payment gating MISSING — create-payment-intent returned {r.status_code} "
            f"before negotiation was agreed. Response: {r.text[:300]}"
        )

    def test_create_payment_intent_succeeds_after_agreed(self, tokens, session_id, mongo):
        # Drive negotiation to agreed
        future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/negotiation/propose",
            json={"proposedTime": future, "proposedLocation": {"address": "Gym"}},
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        r = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/negotiation/accept",
            headers=_hdr(tokens["trainer"]),
            timeout=30,
        )
        assert r.status_code == 200
        # Now payment should be allowed (may still 400 if Stripe key invalid;
        # accept either success or Stripe-side error — but NOT a gating error).
        r = requests.post(
            f"{BASE_URL}/api/payments/create-payment-intent"
            f"?amount_cents=8499&session_id={session_id}&description=Test",
            headers=_hdr(tokens["trainee"]),
            timeout=30,
        )
        # Either success OR a Stripe error (key) is acceptable here.
        # What we want to guard against: a gating error like "negotiation not agreed".
        if r.status_code != 200:
            body = r.text.lower()
            assert "negotiation" not in body and "agree" not in body and "payment_ready" not in body, (
                f"Payment was blocked AFTER agreement: {r.text}"
            )
