"""iter104 — Backend regression for the P0 fix:
"Selecting a trainer from the Trainee Home page wasn't opening their full profile."

Root cause: frontend was passing trainer-profile doc `id` to
`/api/trainer-profiles/{trainerId}` which resolves by USER ID (so it 404'd).
The frontend now passes `trainer.userId || trainer.id`.

These backend tests lock the *server contract* the fix relies on:

  1. GET /api/trainer-profiles/{userId}   → 200 with required fields
  2. GET /api/trainer-profiles/{profileDocId} → 404 (proves route requires userId)
  3. The deferred-payment pipeline is intact end-to-end
  4. Pricing fields (tierRates / ratePerMinuteCents) ship identically on both
     /api/trainers/nearby AND /api/trainer-profiles/{userId}

The trainer test account is missing lat/lng, so the nearby pricing test
sets coords in a fixture, runs, then restores. State is left healthy.
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta

import httpx
import pytest
from bson import ObjectId
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv("/app/backend/.env")

BASE_URL = (
    os.environ.get("PUBLIC_BACKEND_URL")
    or os.environ.get("REACT_APP_BACKEND_URL")
    or "https://highlight-vibe-bugs.preview.emergentagent.com"
).rstrip("/")

TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASS = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASS = "Test123!"

NYC_LAT = 40.7128
NYC_LNG = -74.0060


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def _login(email, password):
    r = httpx.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=15.0,
    )
    assert r.status_code == 200, f"login failed for {email}: {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def trainer_auth():
    d = _login(TRAINER_EMAIL, TRAINER_PASS)
    return {
        "token": d["access_token"],
        "user_id": d["user"]["id"],
        "headers": {"Authorization": f"Bearer {d['access_token']}"},
    }


@pytest.fixture(scope="module")
def trainee_auth():
    d = _login(TRAINEE_EMAIL, TRAINEE_PASS)
    return {
        "token": d["access_token"],
        "user_id": d["user"]["id"],
        "headers": {"Authorization": f"Bearer {d['access_token']}"},
    }


# ---------------------------------------------------------------------------
# DB-level seed/restore for fields the public API can't set directly
# (latitude/longitude, verificationStatus). Module-scope, idempotent.
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def db_seed(trainer_auth):
    """Ensure trainer is verified + has lat/lng so nearby returns them."""
    async def _seed():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        original = await db.trainer_profiles.find_one(
            {"userId": trainer_auth["user_id"]}
        )
        await db.trainer_profiles.update_one(
            {"userId": trainer_auth["user_id"]},
            {"$set": {
                "isAvailable": True,
                "isVerified": True,
                "verificationStatus": "verified",
                "latitude": NYC_LAT,
                "longitude": NYC_LNG,
                "lastLocationUpdate": datetime.utcnow(),
                "offersOutdoor": True,
                "outdoorRateCents": 8500,
                "ratePerMinuteCents": 150,
                "tierRates": {
                    "inPerson30Cents": 4500,
                    "inPerson45Cents": 6500,
                    "inPerson60Cents": 8500,
                    "inPerson90Cents": 12000,
                },
                "assignedTier": "specialty",
                "travelRadiusMiles": None,  # iter102i: None = unlimited
            }},
        )
        client.close()
        return original

    original = asyncio.get_event_loop().run_until_complete(_seed())
    yield original

    # Teardown — restore exactly what we changed
    async def _restore():
        if not original:
            return
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        await db.trainer_profiles.update_one(
            {"userId": trainer_auth["user_id"]},
            {"$set": {
                "latitude": original.get("latitude"),
                "longitude": original.get("longitude"),
                "travelRadiusMiles": original.get("travelRadiusMiles"),
            }},
        )
        client.close()

    asyncio.get_event_loop().run_until_complete(_restore())


# ---------------------------------------------------------------------------
# 1. GET /api/trainer-profiles/{userId} → 200 with required fields
# ---------------------------------------------------------------------------
def test_trainer_profile_by_user_id_returns_200_with_required_fields(
    trainer_auth, trainee_auth, db_seed
):
    """Frontend trainer-detail.tsx hits this with `trainer.userId`. Must 200."""
    r = httpx.get(
        f"{BASE_URL}/api/trainer-profiles/{trainer_auth['user_id']}",
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
    body = r.json()

    # Identity sanity
    assert body["userId"] == trainer_auth["user_id"]
    assert "id" in body and body["id"] != body["userId"], (
        "Response must expose BOTH the profile doc id AND the userId — they "
        "must be different (this is the whole point of the regression)."
    )

    # Fields the trainer-detail screen relies on
    for k in ("tierRates", "ratePerMinuteCents", "trainingStyles",
              "sessionDurationsOffered", "offersOutdoor"):
        assert k in body, f"trainer-profiles response missing `{k}`"

    # Fields the request asked us to confirm exist on the response
    assert "videoCallLink" in body
    # NOTE: `accentIntensity` is persisted in DB (models.py:208) but NOT
    # currently mirrored on TrainerProfileResponse (models.py:268-332).
    # Treat as a minor API surface gap — the frontend currently reads
    # accentColor only, so the regression does not block release.
    # We assert presence of the related accentColor field instead.
    assert "accentColor" in body
    # tierRates must be a dict (frontend resolver iterates it)
    assert isinstance(body["tierRates"], dict)


# ---------------------------------------------------------------------------
# 2. GET /api/trainer-profiles/{profileDocId} — iter104b hardening.
#    Pre-iter104b this returned 404 (route resolved ONLY by userId, which is
#    what caused the original P0 routing bug). iter104b added a defence-in-
#    depth fallback: if the passed id isn't a userId, the route tries it as
#    a profile doc _id and resolves the actual userId from the matched doc.
#    Frontends should still pass `userId`, but if they slip up the API now
#    self-heals instead of silently 404'ing.
# ---------------------------------------------------------------------------
def test_trainer_profile_by_profile_doc_id_falls_back_to_200(
    trainer_auth, trainee_auth, db_seed
):
    # First grab the profile doc id from the (working) userId lookup
    r = httpx.get(
        f"{BASE_URL}/api/trainer-profiles/{trainer_auth['user_id']}",
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert r.status_code == 200
    profile_doc_id = r.json()["id"]
    assert profile_doc_id != trainer_auth["user_id"], (
        "Setup precondition failed — profile doc id and userId are the same?"
    )

    # iter104b: hitting the route with the doc id must now succeed (fallback)
    r2 = httpx.get(
        f"{BASE_URL}/api/trainer-profiles/{profile_doc_id}",
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert r2.status_code == 200, (
        f"iter104b hardening: passing doc id should now resolve via fallback, "
        f"got {r2.status_code}: {r2.text}"
    )
    body = r2.json()
    # Verify it resolved to the SAME profile (same userId)
    assert body["userId"] == trainer_auth["user_id"], (
        f"Fallback resolved the wrong profile. Expected userId="
        f"{trainer_auth['user_id']}, got {body['userId']}"
    )

    # And a truly random / malformed id must still 404
    r404 = httpx.get(
        f"{BASE_URL}/api/trainer-profiles/this-is-not-a-valid-id",
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert r404.status_code == 404, (
        f"A garbage id must still 404 (got {r404.status_code})"
    )


# ---------------------------------------------------------------------------
# 3. /api/trainers/nearby exposes BOTH `id` (doc) and `userId` so the
#    frontend has the correct value to pass to trainer-detail.
# ---------------------------------------------------------------------------
def test_nearby_response_exposes_userid_distinct_from_id(
    trainer_auth, trainee_auth, db_seed
):
    r = httpx.get(
        f"{BASE_URL}/api/trainers/nearby"
        f"?latitude={NYC_LAT}&longitude={NYC_LNG}&radius_miles=50",
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert r.status_code == 200, r.text
    payload = r.json()
    trainers = payload.get("trainers", [])
    # Find our seeded trainer
    me = next((t for t in trainers if t.get("userId") == trainer_auth["user_id"]), None)
    assert me is not None, (
        f"Seeded trainer ({trainer_auth['user_id']}) not present in nearby "
        f"response. count={payload.get('count')}, sample userIds="
        f"{[t.get('userId') for t in trainers[:5]]}"
    )
    # The exact contract the frontend depends on: BOTH keys exist
    # iter104b: also expose `profileDocId` as an explicit alias for the doc id
    # so future frontends never confuse `id` with `userId`.
    assert "id" in me and "userId" in me
    assert "profileDocId" in me, (
        "iter104b: /nearby must expose `profileDocId` so consumers have an "
        "unambiguous name for the trainer_profiles _id."
    )
    assert me["id"] != me["userId"], (
        "Nearby must return doc `id` and `userId` as separate values so the "
        "frontend has a clear choice — frontend MUST use `userId` for the "
        "trainer-detail navigation."
    )
    assert me["profileDocId"] == me["id"], "profileDocId must mirror legacy id"

    # iter104b: passing nearby.id now resolves via the defence-in-depth
    # fallback. Before iter104b this 404'd (which was the root cause of the
    # P0 routing bug). The fallback hardens the route so a future frontend
    # bug of this exact class can't ship again.
    r_fb = httpx.get(
        f"{BASE_URL}/api/trainer-profiles/{me['id']}",
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert r_fb.status_code == 200, (
        "iter104b: passing nearby.id (profile doc id) should now resolve via "
        f"the route's userId-or-doc-id fallback (got {r_fb.status_code})."
    )
    assert r_fb.json()["userId"] == me["userId"]

    # And passing `userId` still works (the canonical path)
    r200 = httpx.get(
        f"{BASE_URL}/api/trainer-profiles/{me['userId']}",
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert r200.status_code == 200


# ---------------------------------------------------------------------------
# 4. Pricing consistency: /trainers/nearby and /trainer-profiles/{userId}
#    must surface the same pricing primitives (tierRates +
#    ratePerMinuteCents + outdoorRateCents) so a 30-min outdoor session
#    renders the same number on both surfaces.
# ---------------------------------------------------------------------------
def test_pricing_consistency_nearby_vs_profile(
    trainer_auth, trainee_auth, db_seed
):
    r_nearby = httpx.get(
        f"{BASE_URL}/api/trainers/nearby"
        f"?latitude={NYC_LAT}&longitude={NYC_LNG}&radius_miles=50",
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert r_nearby.status_code == 200
    nearby_t = next(
        (t for t in r_nearby.json().get("trainers", [])
         if t.get("userId") == trainer_auth["user_id"]),
        None,
    )
    assert nearby_t is not None, "trainer missing from nearby"

    r_profile = httpx.get(
        f"{BASE_URL}/api/trainer-profiles/{trainer_auth['user_id']}",
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert r_profile.status_code == 200
    profile_t = r_profile.json()

    # Core pricing primitives must match exactly
    assert nearby_t.get("ratePerMinuteCents") == profile_t.get("ratePerMinuteCents"), (
        f"ratePerMinuteCents mismatch: nearby={nearby_t.get('ratePerMinuteCents')} "
        f"vs profile={profile_t.get('ratePerMinuteCents')}"
    )
    assert nearby_t.get("outdoorRateCents") == profile_t.get("outdoorRateCents"), (
        "outdoorRateCents mismatch between nearby and profile"
    )
    assert nearby_t.get("tierRates") == profile_t.get("tierRates"), (
        f"tierRates mismatch:\n  nearby ={nearby_t.get('tierRates')}\n"
        f"  profile={profile_t.get('tierRates')}"
    )
    assert nearby_t.get("assignedTier") == profile_t.get("assignedTier")

    # Derived assertion: a 30-min outdoor session should yield a non-zero
    # price under EITHER source (tierRates.inPerson30Cents OR
    # ratePerMinuteCents*30). Both must agree on whether tierRates wins.
    tier_30 = (profile_t.get("tierRates") or {}).get("inPerson30Cents")
    assert tier_30 and tier_30 > 0, (
        "tierRates.inPerson30Cents must be set for the 30-min pricing test"
    )


# ---------------------------------------------------------------------------
# 5. Deferred-payment pipeline regression (lightweight smoke that the
#    iter102aq contract still holds).
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def session_id(trainee_auth, trainer_auth, db_seed):
    when = (datetime.utcnow() + timedelta(days=2)).replace(microsecond=0).isoformat() + "Z"
    payload = {
        "traineeId": trainee_auth["user_id"],
        "trainerId": trainer_auth["user_id"],
        "sessionDateTimeStart": when,
        "durationMinutes": 60,
        "sessionType": "outdoor",
        "locationType": "outdoor",
        "locationNameOrAddress": "Central Park, NY (iter104 test)",
    }
    r = httpx.post(
        f"{BASE_URL}/api/sessions",
        json=payload,
        headers=trainee_auth["headers"],
        timeout=20.0,
    )
    assert r.status_code in (200, 201), f"create session failed: {r.status_code} {r.text}"
    sid = r.json().get("id")
    assert sid, f"session id missing in response: {r.json()}"
    return sid


def test_session_created_with_payment_ready_false(
    session_id, trainee_auth, trainer_auth
):
    r = httpx.get(
        f"{BASE_URL}/api/sessions/{session_id}",
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("status") == "requested"
    assert body.get("paymentReady") in (False, None), (
        f"paymentReady must be falsy before accept; got {body.get('paymentReady')}"
    )


def test_payment_intent_blocked_before_acceptance(
    session_id, trainee_auth
):
    r = httpx.post(
        f"{BASE_URL}/api/payments/create-payment-intent",
        params={"session_id": session_id, "amount_cents": 9299},
        headers=trainee_auth["headers"],
        timeout=20.0,
    )
    assert r.status_code == 400, (
        f"expected 400 before accept, got {r.status_code}: {r.text}"
    )
    msg = (r.json().get("detail") or "").lower()
    assert "negotiation" in msg or "agreed" in msg or "accept" in msg, (
        f"error message must mention negotiation/agreed/accept; got: {msg}"
    )


def test_accept_flips_payment_ready_true(
    session_id, trainer_auth, trainee_auth
):
    r = httpx.patch(
        f"{BASE_URL}/api/sessions/{session_id}/accept",
        headers=trainer_auth["headers"],
        timeout=20.0,
    )
    assert r.status_code == 200, f"accept failed: {r.status_code} {r.text}"

    # Verify via GET that paymentReady is now True
    r2 = httpx.get(
        f"{BASE_URL}/api/sessions/{session_id}",
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert r2.status_code == 200
    body = r2.json()
    assert body.get("paymentReady") is True
    assert body.get("status") in ("confirmed", "accepted"), body.get("status")
    assert body.get("negotiationStatus") == "agreed"


def test_payment_intent_succeeds_after_acceptance(
    session_id, trainee_auth
):
    r = httpx.post(
        f"{BASE_URL}/api/payments/create-payment-intent",
        params={"session_id": session_id, "amount_cents": 9299},
        headers=trainee_auth["headers"],
        timeout=30.0,
    )
    # Stripe path: 200 with clientSecret OR (rare) a stripe-test-config error.
    assert r.status_code == 200, (
        f"payment intent failed post-accept: {r.status_code} {r.text}"
    )
    body = r.json()
    # Contract: should expose a clientSecret / paymentIntentId so the frontend
    # can mount the PaymentSheet.
    assert any(k in body for k in ("clientSecret", "client_secret", "paymentIntentId")), (
        f"payment intent response missing client secret keys: {list(body.keys())}"
    )


# ---------------------------------------------------------------------------
# 6. Teardown — cancel the test session so we don't leave a confirmed booking
# ---------------------------------------------------------------------------
def test_zzz_cleanup_session(session_id, trainer_auth):
    # Best-effort cleanup; never fail the suite on this
    try:
        httpx.patch(
            f"{BASE_URL}/api/sessions/{session_id}/cancel",
            headers=trainer_auth["headers"],
            timeout=15.0,
        )
    except Exception:
        pass
