"""Iteration 74 backend tests — profilePhoto/avatarUrl sync, highlights, admin approve-step, regression.

Covers:
- POST /api/trainer-profiles with legacy `profilePhoto` (synced to avatarUrl + users.profilePhoto)
- POST /api/trainer-profiles with canonical `avatarUrl`
- GET  /api/trainer-profiles/{user_id} returns avatarUrl
- POST /api/trainer-profiles/{user_id}/highlights/base64 + GET highlights + /api/files/* serving
- POST /api/admin/verifications/{trainer_id}/approve-step shape
- GET  /api/trainer/verification-status (with url field on detail endpoint)
- Regression: login (admin/trainee/trainer), POST /api/sessions, GET /api/trainee/sessions
"""
import base64
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://highlight-vibe-bugs.preview.emergentagent.com').rstrip('/')

ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASS = "admin123"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASS = "Test123!"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASS = "Test123!"

# A 1x1 red PNG (base64) — small, valid image bytes
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)
DATA_URI = f"data:image/png;base64,{TINY_PNG_B64}"


def _login(email: str, password: str) -> dict:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login {email} failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def admin_session():
    data = _login(ADMIN_EMAIL, ADMIN_PASS)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"})
    return s, data


@pytest.fixture(scope="module")
def trainee_session():
    data = _login(TRAINEE_EMAIL, TRAINEE_PASS)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"})
    return s, data


@pytest.fixture(scope="module")
def trainer_session():
    data = _login(TRAINER_EMAIL, TRAINER_PASS)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"})
    return s, data


# ============================================================================
# Regression: auth
# ============================================================================
class TestAuthRegression:
    def test_admin_login(self, admin_session):
        s, data = admin_session
        assert data["user"]["email"] == ADMIN_EMAIL
        assert "access_token" in data and len(data["access_token"]) > 20

    def test_trainee_login(self, trainee_session):
        s, data = trainee_session
        assert data["user"]["email"] == TRAINEE_EMAIL

    def test_trainer_login(self, trainer_session):
        s, data = trainer_session
        assert data["user"]["email"] == TRAINER_EMAIL


# ============================================================================
# Trainer profile: profilePhoto (legacy) and avatarUrl sync
# ============================================================================
class TestTrainerProfilePhotoSync:
    def test_post_with_legacy_profilePhoto_syncs_to_avatarUrl(self, trainer_session):
        s, data = trainer_session
        uid = data["user"]["id"]

        # Pull current profile to preserve required fields
        cur = s.get(f"{BASE_URL}/api/trainer-profiles/{uid}")
        assert cur.status_code == 200, cur.text
        current = cur.json()

        # Unique sentinel to confirm THIS request persisted
        sentinel = f"data:image/png;base64,{TINY_PNG_B64}#legacy-{uuid.uuid4().hex[:8]}"

        payload = {
            "userId": uid,
            "profilePhoto": sentinel,
            # Spread minimal required fields the model may need
            "bio": current.get("bio") or "Test trainer bio",
            "experienceYears": current.get("experienceYears", 1),
        }
        r = s.post(f"{BASE_URL}/api/trainer-profiles", json=payload)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        body = r.json()
        # profilePhoto should have been synced into avatarUrl
        assert body.get("avatarUrl") == sentinel, f"avatarUrl mismatch in POST response: {body.get('avatarUrl')!r}"

        # GET must return same avatarUrl (and ideally fullName too)
        gr = s.get(f"{BASE_URL}/api/trainer-profiles/{uid}")
        assert gr.status_code == 200, gr.text
        gbody = gr.json()
        assert gbody.get("avatarUrl") == sentinel, f"avatarUrl not persisted on GET: {gbody.get('avatarUrl')!r}"

        # Also verify users.profilePhoto sync indirectly: clear avatarUrl on the profile and
        # confirm GET /api/trainer-profiles falls back to users.profilePhoto (profile_routes line 77).
        # Re-POST without profilePhoto to force avatarUrl back to None for the fallback assertion.
        clear_payload = {
            "userId": uid,
            "avatarUrl": None,
            "bio": current.get("bio") or "Test trainer bio",
            "experienceYears": current.get("experienceYears", 1),
        }
        cr = s.post(f"{BASE_URL}/api/trainer-profiles", json=clear_payload)
        assert cr.status_code == 200, cr.text
        # The GET fallback should fill avatarUrl from users.profilePhoto (proves users.profilePhoto was synced)
        gr2 = s.get(f"{BASE_URL}/api/trainer-profiles/{uid}")
        assert gr2.status_code == 200
        assert gr2.json().get("avatarUrl") == sentinel, (
            f"users.profilePhoto fallback failed — sync to users collection did NOT persist. "
            f"Got: {gr2.json().get('avatarUrl')!r}"
        )

    def test_post_with_canonical_avatarUrl(self, trainer_session):
        s, data = trainer_session
        uid = data["user"]["id"]
        sentinel = f"data:image/png;base64,{TINY_PNG_B64}#canon-{uuid.uuid4().hex[:8]}"

        cur = s.get(f"{BASE_URL}/api/trainer-profiles/{uid}").json()

        payload = {
            "userId": uid,
            "avatarUrl": sentinel,
            "bio": cur.get("bio") or "Test trainer bio",
            "experienceYears": cur.get("experienceYears", 1),
        }
        r = s.post(f"{BASE_URL}/api/trainer-profiles", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("avatarUrl") == sentinel

        gr = s.get(f"{BASE_URL}/api/trainer-profiles/{uid}")
        assert gr.status_code == 200
        assert gr.json().get("avatarUrl") == sentinel


# ============================================================================
# Highlights upload + retrieval + file serving
# ============================================================================
class TestHighlights:
    def test_upload_highlight_base64_and_retrieve_and_serve(self, trainer_session):
        s, data = trainer_session
        uid = data["user"]["id"]

        caption = f"TEST_iter74_{uuid.uuid4().hex[:8]}"
        body = {
            "data": TINY_PNG_B64,
            "filename": "iter74.png",
            "contentType": "image/png",
            "caption": caption,
        }
        r = s.post(f"{BASE_URL}/api/trainer-profiles/{uid}/highlights/base64", json=body)
        assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
        rb = r.json()
        assert rb.get("success") is True
        hl = rb.get("highlight")
        assert hl and hl.get("url", "").startswith("/api/files/"), f"bad highlight url: {hl}"
        assert hl.get("caption") == caption
        assert hl.get("type") == "photo"

        # GET highlights → must include our caption
        g = s.get(f"{BASE_URL}/api/trainer-profiles/{uid}/highlights")
        assert g.status_code == 200, g.text
        hls = g.json().get("highlights", [])
        assert any(h.get("caption") == caption for h in hls), f"new highlight not present: {hls}"

        # File serve check
        served = requests.get(f"{BASE_URL}{hl['url']}", timeout=30)
        assert served.status_code == 200, f"file serve failed: {served.status_code}"
        assert len(served.content) > 10
        assert served.headers.get("content-type", "").startswith("image/")


# ============================================================================
# Admin verification: detail endpoint url field + approve-step
# ============================================================================
class TestAdminVerification:
    def test_verification_detail_has_steps_with_url_for_photo(self, admin_session, trainer_session):
        s_admin, _ = admin_session
        _, t_data = trainer_session
        trainer_id = t_data["user"]["id"]

        r = s_admin.get(f"{BASE_URL}/api/admin/verifications/{trainer_id}/detail")
        assert r.status_code == 200, r.text
        body = r.json()
        steps = body.get("steps", [])
        assert len(steps) >= 7
        step_ids = {st["id"] for st in steps}
        for sid in ("identity", "background", "certification", "cpr", "insurance", "photo", "video"):
            assert sid in step_ids
        # Each step has 'url' key (may be None for unsubmitted docs)
        for st in steps:
            assert "url" in st, f"step {st['id']} missing url key"
        # Photo step's url should now be set (avatarUrl was just persisted)
        photo_step = next(st for st in steps if st["id"] == "photo")
        assert photo_step.get("url"), f"photo step url empty: {photo_step}"

    def test_approve_step_response_shape(self, admin_session, trainer_session):
        s_admin, _ = admin_session
        _, t_data = trainer_session
        trainer_id = t_data["user"]["id"]

        # Approve the "photo" step (we know its url is non-empty from previous test)
        r = s_admin.post(
            f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve-step",
            json={"stepId": "photo"},
        )
        assert r.status_code == 200, f"approve-step failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("success") is True
        assert "message" in body and isinstance(body["message"], str)

    def test_approve_step_missing_stepId(self, admin_session, trainer_session):
        s_admin, _ = admin_session
        _, t_data = trainer_session
        trainer_id = t_data["user"]["id"]
        r = s_admin.post(
            f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve-step",
            json={},
        )
        assert r.status_code == 400


# ============================================================================
# Trainer verification-status (FE contract)
# ============================================================================
class TestVerificationStatus:
    def test_get_verification_status_shape(self, trainer_session):
        s, _ = trainer_session
        r = s.get(f"{BASE_URL}/api/trainer/verification-status")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "steps" in body
        assert "canGoLive" in body
        steps = body["steps"]
        for sid in ("identity", "background", "certification", "cpr", "insurance", "photo", "video"):
            assert sid in steps, f"missing step {sid}"
            assert steps[sid] in ("pending", "submitted", "verified", "rejected"), f"bad value for {sid}: {steps[sid]}"


# ============================================================================
# Regression: booking flow (iter73)
# ============================================================================
class TestBookingRegression:
    def test_post_session_returns_requested(self, trainee_session, trainer_session):
        s_trainee, trainee_data = trainee_session
        _, trainer_data = trainer_session
        trainee_id = trainee_data["user"]["id"]
        trainer_id = trainer_data["user"]["id"]

        # Schedule for ~2 days out
        from datetime import datetime, timedelta, timezone
        start = (datetime.now(timezone.utc) + timedelta(days=2, hours=1)).replace(microsecond=0).isoformat()

        payload = {
            "traineeId": trainee_id,
            "trainerId": trainer_id,
            "sessionDateTimeStart": start,
            "durationMinutes": 60,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Central Park, NYC - iter74 test",
        }
        r = s_trainee.post(f"{BASE_URL}/api/sessions", json=payload)
        assert r.status_code in (200, 201), f"booking failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("status") in ("requested", "pending"), f"bad status: {body.get('status')}"

    def test_get_trainee_sessions_pending(self, trainee_session):
        s, _ = trainee_session
        r = s.get(f"{BASE_URL}/api/trainee/sessions", params={"session_status": "requested"})
        assert r.status_code == 200, r.text
        body = r.json()
        # Tolerate either {sessions: [...]} or [...]
        sessions = body.get("sessions") if isinstance(body, dict) else body
        assert isinstance(sessions, list)
