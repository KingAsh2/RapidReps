"""
Iteration 73 — Verify booking flow (POST /api/sessions) + verification-status
+ regression sanity on auth/profile/sessions endpoints.

Covers all backend items requested in iteration 73 review_request.
"""
import os
import pytest
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://highlight-vibe-bugs.preview.emergentagent.com"
).rstrip("/")

ADMIN = {"email": "admin@rapidreps.com", "password": "admin123"}
TRAINEE = {"email": "test_trainee_iter25@test.com", "password": "Test123!"}
TRAINER = {"email": "test_trainer_iter25@test.com", "password": "Test123!"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token and "user" in data, f"Unexpected login response: {data}"
    return token, data["user"]


@pytest.fixture(scope="session")
def admin_ctx():
    tok, user = _login(ADMIN)
    return {"token": tok, "user": user, "headers": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="session")
def trainee_ctx():
    tok, user = _login(TRAINEE)
    return {"token": tok, "user": user, "headers": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="session")
def trainer_ctx():
    tok, user = _login(TRAINER)
    return {"token": tok, "user": user, "headers": {"Authorization": f"Bearer {tok}"}}


# =========================================================================
# AUTH REGRESSION
# =========================================================================
class TestAuthRegression:
    def test_admin_login(self, admin_ctx):
        assert admin_ctx["user"].get("email") == ADMIN["email"]
        assert "roles" in admin_ctx["user"] or admin_ctx["user"].get("isAdmin") is True

    def test_trainee_login(self, trainee_ctx):
        assert trainee_ctx["user"].get("email") == TRAINEE["email"]
        assert "trainee" in (trainee_ctx["user"].get("roles") or [])

    def test_trainer_login(self, trainer_ctx):
        assert trainer_ctx["user"].get("email") == TRAINER["email"]
        assert "trainer" in (trainer_ctx["user"].get("roles") or [])

    def test_auth_me_trainee(self, trainee_ctx):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=trainee_ctx["headers"], timeout=15)
        assert r.status_code == 200
        assert r.json().get("email") == TRAINEE["email"]

    def test_auth_me_trainer(self, trainer_ctx):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=trainer_ctx["headers"], timeout=15)
        assert r.status_code == 200
        assert r.json().get("email") == TRAINER["email"]

    def test_auth_me_admin(self, admin_ctx):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_ctx["headers"], timeout=15)
        assert r.status_code == 200
        assert r.json().get("email") == ADMIN["email"]


# =========================================================================
# TRAINER VERIFICATION-STATUS (used by approval modal hook on FE)
# =========================================================================
class TestTrainerVerificationStatus:
    def test_verification_status_shape(self, trainer_ctx):
        r = requests.get(
            f"{BASE_URL}/api/trainer/verification-status",
            headers=trainer_ctx["headers"],
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Required shape per FE contract
        assert "steps" in data, "Missing 'steps' field"
        assert isinstance(data["steps"], dict)
        assert "canGoLive" in data, "Missing 'canGoLive' field"
        assert isinstance(data["canGoLive"], bool)
        # 7-step verification map
        expected_steps = {"identity", "background", "certification", "cpr", "insurance", "photo", "video"}
        assert expected_steps.issubset(set(data["steps"].keys())), \
            f"Missing step keys: {expected_steps - set(data['steps'].keys())}"

    def test_verification_status_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/trainer/verification-status", timeout=15)
        assert r.status_code in (401, 403)


# =========================================================================
# BOOKING — POST /api/sessions
# =========================================================================
@pytest.fixture(scope="session")
def trainer_profile(trainer_ctx):
    """Fetch trainer profile by user id."""
    uid = trainer_ctx["user"]["id"]
    r = requests.get(
        f"{BASE_URL}/api/trainer-profiles/{uid}",
        headers=trainer_ctx["headers"],
        timeout=15,
    )
    assert r.status_code == 200, f"Trainer profile fetch failed: {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def ensure_trainer_verified(admin_ctx, trainer_ctx, trainer_profile):
    """Ensure test trainer is verified (canGoLive). If not, attempt admin approval."""
    vs = requests.get(
        f"{BASE_URL}/api/trainer/verification-status",
        headers=trainer_ctx["headers"],
        timeout=15,
    ).json()
    if vs.get("canGoLive"):
        return True
    # Attempt admin approval
    uid = trainer_ctx["user"]["id"]
    # Try common admin endpoints
    candidates = [
        ("POST", f"/api/admin/verifications/{uid}/approve", {}),
        ("POST", f"/api/admin/trainers/{uid}/approve", {}),
        ("PATCH", f"/api/admin/trainers/{uid}/verification", {"status": "verified"}),
    ]
    for method, path, body in candidates:
        try:
            r = requests.request(
                method, f"{BASE_URL}{path}", json=body,
                headers=admin_ctx["headers"], timeout=15,
            )
            if r.status_code in (200, 201, 204):
                break
        except Exception:
            continue
    # Re-check
    vs2 = requests.get(
        f"{BASE_URL}/api/trainer/verification-status",
        headers=trainer_ctx["headers"], timeout=15,
    ).json()
    return vs2.get("canGoLive", False)


class TestBookingFlow:
    def test_post_session_creates_requested_session(
        self, trainee_ctx, trainer_ctx, ensure_trainer_verified
    ):
        if not ensure_trainer_verified:
            pytest.skip("Test trainer is not verified (canGoLive=false); cannot book.")

        # Count pending before
        before = requests.get(
            f"{BASE_URL}/api/trainee/sessions?session_status=requested",
            headers=trainee_ctx["headers"], timeout=15,
        )
        assert before.status_code == 200
        pending_before = len(before.json())

        # Build payload per frontend trainer-detail.tsx booking shape
        future_dt = (datetime.now(timezone.utc) + timedelta(days=2)).replace(microsecond=0)
        payload = {
            "traineeId": trainee_ctx["user"]["id"],
            "trainerId": trainer_ctx["user"]["id"],
            "sessionDateTimeStart": future_dt.isoformat(),
            "durationMinutes": 60,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Central Park, NYC",
        }
        r = requests.post(
            f"{BASE_URL}/api/sessions",
            headers=trainee_ctx["headers"],
            json=payload,
            timeout=30,
        )
        assert r.status_code == 200, f"POST /api/sessions failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("status") == "requested", f"Expected status='requested', got {body.get('status')}"
        assert body.get("trainerId") == payload["trainerId"]
        assert body.get("traineeId") == payload["traineeId"]
        assert body.get("durationMinutes") == 60
        new_id = body.get("id")
        assert new_id, f"No id returned in response: {body}"

        # Verify it shows up in GET /api/trainee/sessions?session_status=requested
        after = requests.get(
            f"{BASE_URL}/api/trainee/sessions?session_status=requested",
            headers=trainee_ctx["headers"], timeout=15,
        )
        assert after.status_code == 200
        after_list = after.json()
        assert len(after_list) == pending_before + 1, \
            f"Pending count did not increment: before={pending_before}, after={len(after_list)}"
        ids = [s.get("id") for s in after_list]
        assert new_id in ids, f"Newly created session {new_id} not in pending list"

        # Also verify the FE filter (s.status === 'requested') works on the unfiltered list
        unfiltered = requests.get(
            f"{BASE_URL}/api/trainee/sessions",
            headers=trainee_ctx["headers"], timeout=15,
        ).json()
        match = [s for s in unfiltered if s.get("id") == new_id]
        assert match and match[0].get("status") == "requested"


# =========================================================================
# REGRESSION — other critical endpoints
# =========================================================================
class TestRegression:
    def test_trainer_profile_by_id(self, trainer_ctx):
        uid = trainer_ctx["user"]["id"]
        r = requests.get(
            f"{BASE_URL}/api/trainer-profiles/{uid}",
            headers=trainer_ctx["headers"], timeout=15,
        )
        assert r.status_code == 200
        assert r.json().get("userId") == uid

    def test_trainee_sessions_endpoint(self, trainee_ctx):
        r = requests.get(
            f"{BASE_URL}/api/trainee/sessions",
            headers=trainee_ctx["headers"], timeout=15,
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_experiments_event_post(self, trainee_ctx):
        r = requests.post(
            f"{BASE_URL}/api/experiments/event",
            json={
                "experimentKey": "google_cta_copy",
                "variant": "control",
                "event": "impression",
            },
            headers=trainee_ctx["headers"], timeout=15,
        )
        assert r.status_code == 200, r.text

    def test_instagram_data_deletion(self):
        r = requests.post(
            f"{BASE_URL}/api/instagram/data-deletion",
            data={"signed_request": "test.signed_request_payload"},
            timeout=15,
        )
        # Meta-required shape: {url, confirmation_code}
        assert r.status_code == 200, r.text
        body = r.json()
        assert "url" in body and "confirmation_code" in body
