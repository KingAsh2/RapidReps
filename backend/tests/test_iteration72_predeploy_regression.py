"""
Iteration 72 — Pre-Deployment Full-Stack Regression
Smoke test for: auth, search (trainers/trainees), referral, A/B experiments,
Instagram (pre-creds 503 scaffold), public privacy endpoints, core flows.

Backend URL is sourced from EXPO_PUBLIC_BACKEND_URL since this project uses Expo
(no REACT_APP_BACKEND_URL). Falls back to that env var.
"""
import os
import uuid
import pytest
import requests

BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://highlight-vibe-bugs.preview.emergentagent.com"
).rstrip("/")

ADMIN = {"email": "admin@rapidreps.com", "password": "admin123"}
TRAINEE = {"email": "test_trainee_iter25@test.com", "password": "Test123!"}
TRAINER = {"email": "test_trainer_iter25@test.com", "password": "Test123!"}

TIMEOUT = 30


# ---------- shared fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, creds):
    r = session.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=TIMEOUT)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data, f"No access_token in login resp: {data}"
    return data


@pytest.fixture(scope="session")
def admin_login(session):
    return _login(session, ADMIN)


@pytest.fixture(scope="session")
def trainee_login(session):
    return _login(session, TRAINEE)


@pytest.fixture(scope="session")
def trainer_login(session):
    return _login(session, TRAINER)


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- AUTH REGRESSION ----------
class TestAuth:
    def test_admin_login_role(self, admin_login):
        roles = admin_login.get("user", {}).get("roles") or admin_login.get("roles") or []
        assert "admin" in roles, f"admin role missing: {admin_login}"

    def test_trainee_login_role(self, trainee_login):
        roles = trainee_login.get("user", {}).get("roles") or trainee_login.get("roles") or []
        assert "trainee" in roles, f"trainee role missing: {trainee_login}"

    def test_trainer_login_role(self, trainer_login):
        roles = trainer_login.get("user", {}).get("roles") or trainer_login.get("roles") or []
        assert "trainer" in roles, f"trainer role missing: {trainer_login}"

    def test_auth_me_admin(self, session, admin_login):
        r = session.get(f"{BASE_URL}/api/auth/me", headers=_auth(admin_login["access_token"]), timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("email") == ADMIN["email"]

    def test_auth_me_trainee(self, session, trainee_login):
        r = session.get(f"{BASE_URL}/api/auth/me", headers=_auth(trainee_login["access_token"]), timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("email") == TRAINEE["email"]

    def test_auth_me_trainer(self, session, trainer_login):
        r = session.get(f"{BASE_URL}/api/auth/me", headers=_auth(trainer_login["access_token"]), timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("email") == TRAINER["email"]


# ---------- SEARCH FEATURE ----------
class TestSearch:
    def test_trainer_search_by_name(self, session, trainee_login):
        r = session.get(
            f"{BASE_URL}/api/trainers/search",
            params={"q": "trainer"},
            headers=_auth(trainee_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # accept either bare list or {trainers:[]}
        items = data if isinstance(data, list) else data.get("trainers", [])
        assert isinstance(items, list)

    def test_trainer_search_by_exact_email(self, session, trainee_login):
        r = session.get(
            f"{BASE_URL}/api/trainers/search",
            params={"q": TRAINER["email"]},
            headers=_auth(trainee_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        items = data if isinstance(data, list) else data.get("trainers", [])
        assert len(items) >= 1, f"Expected at least 1 trainer match for exact email, got {data}"

    def test_trainee_search_as_trainer(self, session, trainer_login):
        r = session.get(
            f"{BASE_URL}/api/trainees/search",
            params={"q": "test"},
            headers=_auth(trainer_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "trainees" in data and "count" in data, f"shape mismatch: {data}"
        assert isinstance(data["trainees"], list)

    def test_trainee_search_as_trainee_forbidden(self, session, trainee_login):
        r = session.get(
            f"{BASE_URL}/api/trainees/search",
            params={"q": "test"},
            headers=_auth(trainee_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

    def test_trainee_search_no_auth(self, session):
        r = session.get(f"{BASE_URL}/api/trainees/search", params={"q": "test"}, timeout=TIMEOUT)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


# ---------- REFERRAL ----------
class TestReferral:
    def test_my_code(self, session, trainee_login):
        r = session.get(
            f"{BASE_URL}/api/referral/my-code",
            headers=_auth(trainee_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        code = data.get("referralCode") or data.get("code")
        assert code, f"No referralCode in response: {data}"

    def test_track_invite_sms(self, session, trainee_login):
        r = session.post(
            f"{BASE_URL}/api/referral/track-invite",
            json={"channel": "sms"},
            headers=_auth(trainee_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True or data.get("success") is True, f"unexpected: {data}"

    def test_track_invite_invalid_channel(self, session, trainee_login):
        r = session.post(
            f"{BASE_URL}/api/referral/track-invite",
            json={"channel": "carrier-pigeon"},
            headers=_auth(trainee_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"

    def test_invite_stats(self, session, trainee_login):
        r = session.get(
            f"{BASE_URL}/api/referral/invite-stats",
            headers=_auth(trainee_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "total" in data and "byChannel" in data, f"shape mismatch: {data}"
        assert isinstance(data["byChannel"], dict)


# ---------- A/B EXPERIMENTS ----------
class TestExperiments:
    KEY = "google_cta_copy"

    @pytest.mark.parametrize("ev", ["impression", "click", "conversion"])
    def test_event_valid(self, session, trainee_login, ev):
        r = session.post(
            f"{BASE_URL}/api/experiments/event",
            json={"experimentKey": self.KEY, "variant": "control", "event": ev},
            headers=_auth(trainee_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"{ev} failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("ok") is True or data.get("success") is True

    def test_event_invalid(self, session, trainee_login):
        r = session.post(
            f"{BASE_URL}/api/experiments/event",
            json={"experimentKey": self.KEY, "variant": "control", "event": "bogus"},
            headers=_auth(trainee_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"

    def test_results_as_admin(self, session, admin_login):
        r = session.get(
            f"{BASE_URL}/api/experiments/{self.KEY}/results",
            headers=_auth(admin_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        variants = data.get("variants") or data
        assert "control" in variants, f"missing control variant: {data}"
        assert "fast" in variants, f"missing fast variant: {data}"
        for vname in ("control", "fast"):
            v = variants[vname]
            for f in ("impression", "click", "conversion", "ctr"):
                assert f in v, f"variant {vname} missing field {f}: {v}"

    def test_results_as_non_admin_forbidden(self, session, trainee_login):
        r = session.get(
            f"{BASE_URL}/api/experiments/{self.KEY}/results",
            headers=_auth(trainee_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


# ---------- INSTAGRAM (pre-creds) ----------
class TestInstagram:
    def test_status_not_linked(self, session, trainee_login):
        r = session.get(
            f"{BASE_URL}/api/instagram/status",
            headers=_auth(trainee_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("linked") is False

    def test_oauth_start_503(self, session, trainee_login):
        r = session.post(
            f"{BASE_URL}/api/instagram/oauth/start",
            headers=_auth(trainee_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 503, f"Expected 503 (no creds), got {r.status_code}: {r.text}"
        body = r.text.lower()
        assert "not yet configured" in body or "not configured" in body, body

    def test_deauthorize_ping(self, session):
        # Meta verify ping - no auth, no body
        r = session.get(f"{BASE_URL}/api/instagram/deauthorize", timeout=TIMEOUT)
        assert r.status_code == 200, f"{r.status_code} {r.text}"

    def test_data_deletion_meta_shape(self, session):
        # Meta sends form-encoded signed_request; endpoint should still return URL+code shape
        r = session.post(
            f"{BASE_URL}/api/instagram/data-deletion",
            data={"signed_request": "fake.signedrequest"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert "url" in data and "confirmation_code" in data, f"shape mismatch: {data}"

    def test_public_media_unlinked(self, session, trainee_login):
        rand_user = uuid.uuid4().hex
        r = session.get(
            f"{BASE_URL}/api/instagram/public-media/{rand_user}",
            headers=_auth(trainee_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("linked") is False
        assert data.get("items") == []


# ---------- PUBLIC PRIVACY PAGES ----------
class TestPrivacyPublic:
    def test_privacy_policy_html(self, session):
        r = session.get(f"{BASE_URL}/api/privacy/policy", timeout=TIMEOUT)
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "").lower()
        assert "<html" in r.text.lower() or "<!doctype" in r.text.lower()

    def test_data_deletion_status_html(self, session):
        r = session.get(
            f"{BASE_URL}/api/privacy/data-deletion-status",
            params={"code": "test"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "").lower()
        # echoed code
        assert "test" in r.text


# ---------- CORE FLOWS REGRESSION ----------
class TestCoreFlows:
    def test_trainer_profile_self(self, session, trainer_login):
        uid = trainer_login.get("user", {}).get("id") or trainer_login.get("user", {}).get("_id")
        assert uid, f"No user id in login response: {trainer_login}"
        r = session.get(
            f"{BASE_URL}/api/trainer-profiles/{uid}",
            headers=_auth(trainer_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"

    def test_trainee_profile_self(self, session, trainee_login):
        uid = trainee_login.get("user", {}).get("id") or trainee_login.get("user", {}).get("_id")
        assert uid, f"No user id in login response: {trainee_login}"
        r = session.get(
            f"{BASE_URL}/api/trainee-profiles/{uid}",
            headers=_auth(trainee_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"

    def test_trainee_sessions_list(self, session, trainee_login):
        r = session.get(
            f"{BASE_URL}/api/trainee/sessions",
            headers=_auth(trainee_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        assert isinstance(r.json(), list)

    def test_trainer_sessions_list(self, session, trainer_login):
        r = session.get(
            f"{BASE_URL}/api/trainer/sessions",
            headers=_auth(trainer_login["access_token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        assert isinstance(r.json(), list)
