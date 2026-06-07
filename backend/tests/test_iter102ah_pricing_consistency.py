"""iter102ah — Trainer rate & pricing consistency tests.

Locks in the fix for the user-reported pricing bug where:
- Trainee saw "$—" for per-duration buttons but "$50" in the summary
- Trainer's "/30 min" badge was driven by `ratePerMinuteCents` defaulting to $30
- Service Fee row was hardcoded to "$2.00" while the actual fee is $2.99
- Recurring sessions multiplied by 4 silently

These tests verify the BACKEND side of the contract — the frontend resolver
relies on `tierRates`, `assignedTier`, and the legacy hourly fields being
shipped together so a single source of truth can render the price across
every surface (badge, duration tiles, summary, recurring, map popup).
"""

import os
import sys

import httpx
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Use public ingress URL so we're testing what the user sees
BASE_URL = (
    os.environ.get("PUBLIC_BACKEND_URL")
    or os.environ.get("REACT_APP_BACKEND_URL")
    or "https://highlight-vibe-bugs.preview.emergentagent.com"
).rstrip("/")

TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASS = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASS = "Test123!"


def _login(email: str, password: str) -> dict:
    resp = httpx.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=15.0,
    )
    assert resp.status_code == 200, f"login failed for {email}: {resp.text}"
    return resp.json()


def _auth_token(email: str, password: str) -> str:
    return _login(email, password)["access_token"]


@pytest.fixture(scope="module")
def trainer_auth():
    data = _login(TRAINER_EMAIL, TRAINER_PASS)
    return {
        "token": data["access_token"],
        "user_id": data["user"]["id"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
    }


@pytest.fixture(scope="module")
def trainee_auth():
    data = _login(TRAINEE_EMAIL, TRAINEE_PASS)
    return {
        "token": data["access_token"],
        "user_id": data["user"]["id"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
    }


# ---------------------------------------------------------------------------
# 1. /api/trainer-profiles/{user_id} ships tierRates + assignedTier
# ---------------------------------------------------------------------------

def test_trainer_profile_response_includes_tier_rates_and_assigned_tier(trainer_auth):
    """GET /api/trainer-profiles/{userId} MUST include `tierRates` and `assignedTier`."""
    resp = httpx.get(
        f"{BASE_URL}/api/trainer-profiles/{trainer_auth['user_id']}",
        headers=trainer_auth["headers"],
        timeout=15.0,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "tierRates" in data, "Frontend resolver depends on `tierRates` key"
    assert "assignedTier" in data, "Frontend resolver depends on `assignedTier` key"
    # Legacy fallback fields must remain available
    assert "outdoorRateCents" in data
    assert "virtualRateCents" in data
    assert "inHomeRateCents" in data


def test_trainer_profile_returned_to_trainee_includes_tier_rates(trainer_auth, trainee_auth):
    """Trainee fetching another trainer's profile must also see `tierRates` (not just self)."""
    resp = httpx.get(
        f"{BASE_URL}/api/trainer-profiles/{trainer_auth['user_id']}",
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "tierRates" in data
    assert "assignedTier" in data


# ---------------------------------------------------------------------------
# 2. /api/trainers/nearby ships tierRates + per-modality rates
# ---------------------------------------------------------------------------

def test_nearby_trainers_includes_tier_rates(trainee_auth):
    """The nearby map / discover feed MUST ship `tierRates`."""
    resp = httpx.get(
        f"{BASE_URL}/api/trainers/nearby",
        params={"latitude": 37.7749, "longitude": -122.4194, "radius_miles": 999999},
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    trainers = payload.get("trainers", [])
    if not trainers:
        pytest.skip("No nearby trainers seeded in this DB.")
    trainer = trainers[0]
    assert "tierRates" in trainer, "Resolver-critical field missing on map response"
    assert "assignedTier" in trainer
    assert "outdoorRateCents" in trainer, "Legacy fallback field must remain"
    assert "virtualRateCents" in trainer, "Legacy fallback field must remain"
    assert "inHomeRateCents" in trainer, "Legacy fallback field must remain"


# ---------------------------------------------------------------------------
# 3. /api/find-matches (matching/discover) ships tierRates
# ---------------------------------------------------------------------------

def test_ranked_search_includes_tier_rates(trainee_auth):
    """The ranked-search matching endpoint MUST ship tierRates + per-modality cents fields."""
    r = httpx.get(
        f"{BASE_URL}/api/trainers/ranked-search",
        params={
            "latitude": 37.7749,
            "longitude": -122.4194,
            "session_type": "outdoor",
            "max_distance": 999999,
        },
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    matches = payload.get("trainers", [])
    if not matches:
        pytest.skip("ranked-search returned empty list — no candidates seeded with lat/long.")
    m = matches[0]
    assert "tierRates" in m, f"resolver-critical `tierRates` missing on match. keys={list(m.keys())}"
    assert "assignedTier" in m
    assert "outdoorRateCents" in m
    assert "virtualRateCents" in m
    assert "inHomeRateCents" in m


def test_trainers_search_includes_tier_rates(trainee_auth):
    """The /api/trainers/search endpoint (general discover) MUST ship tierRates."""
    r = httpx.get(
        f"{BASE_URL}/api/trainers/search",
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert r.status_code == 200, r.text
    results = r.json()
    if not isinstance(results, list) or not results:
        pytest.skip("trainers/search returned empty list.")
    t = results[0]
    assert "tierRates" in t, f"resolver-critical `tierRates` missing on search. keys={list(t.keys())}"
    assert "assignedTier" in t


# ---------------------------------------------------------------------------
# 4. POST/GET /api/trainer/tier-rates round-trip
# ---------------------------------------------------------------------------

def test_trainer_tier_rates_post_then_get_roundtrip(trainer_auth):
    """Trainer POSTs rates → GET reflects them."""
    # Pick values that fit the 'specialty' caps the seeded trainer has
    # (specialty in_person 30 cap is typically wide; use values aligned with seed: 4500/8500/12000)
    body = {
        "inPerson30Cents": 4500,
        "inPerson60Cents": 8500,
        "inPerson90Cents": 12000,
    }
    post_resp = httpx.post(
        f"{BASE_URL}/api/trainer/tier-rates",
        json=body,
        headers=trainer_auth["headers"],
        timeout=15.0,
    )
    assert post_resp.status_code == 200, post_resp.text
    post_data = post_resp.json()
    assert post_data.get("success") is True
    tier_rates_after_post = post_data.get("tierRates", {})
    for k, v in body.items():
        assert tier_rates_after_post.get(k) == v, (
            f"POST response missing/wrong {k}: expected {v}, got {tier_rates_after_post.get(k)}"
        )

    # GET endpoint should reflect them
    get_resp = httpx.get(
        f"{BASE_URL}/api/trainer/tier-rates",
        headers=trainer_auth["headers"],
        timeout=15.0,
    )
    assert get_resp.status_code == 200, get_resp.text
    get_data = get_resp.json()
    rates = get_data.get("tierRates", {})
    for k, v in body.items():
        assert rates.get(k) == v, (
            f"GET tier-rates missing/wrong {k}: expected {v}, got {rates.get(k)}"
        )
    assert get_data.get("tier") in {"new", "certified", "specialty"}


# ---------------------------------------------------------------------------
# 5. End-to-end: trainer saves rates → trainee fetches profile → sees same rates
# ---------------------------------------------------------------------------

def test_e2e_trainer_sets_rates_trainee_sees_them(trainer_auth, trainee_auth):
    """Full plumbing: trainer's saved tierRates are returned to trainee on
    /api/trainer-profiles/{trainer_id}."""
    body = {
        "inPerson30Cents": 4500,
        "inPerson45Cents": 6500,
        "inPerson60Cents": 8500,
        "inPerson90Cents": 12000,
    }
    save = httpx.post(
        f"{BASE_URL}/api/trainer/tier-rates",
        json=body,
        headers=trainer_auth["headers"],
        timeout=15.0,
    )
    if save.status_code == 400 and "45" in save.text:
        # Some tiers cap 45-min; fall back to the 30/60/90 only set
        body = {k: v for k, v in body.items() if "45" not in k}
        save = httpx.post(
            f"{BASE_URL}/api/trainer/tier-rates",
            json=body,
            headers=trainer_auth["headers"],
            timeout=15.0,
        )
    assert save.status_code == 200, save.text

    resp = httpx.get(
        f"{BASE_URL}/api/trainer-profiles/{trainer_auth['user_id']}",
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert resp.status_code == 200, resp.text
    profile = resp.json()
    tier_rates = profile.get("tierRates") or {}
    for k, v in body.items():
        assert tier_rates.get(k) == v, (
            f"Trainee-visible profile missing rate {k}: expected {v}, got {tier_rates.get(k)} "
            f"(tierRates={tier_rates})"
        )
    assert profile.get("assignedTier") in {"new", "certified", "specialty"}
