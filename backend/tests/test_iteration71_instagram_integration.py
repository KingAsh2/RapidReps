"""Iteration 71 — Instagram backend integration scaffold tests.

Verifies the Instagram router contract under the "credentials-empty" precondition:
- Authenticated endpoints requiring IG API calls return 503 when not configured.
- Endpoints requiring an existing link return 404 for non-linked users.
- Idempotent unlink returns {success:true, deleted:false}.
- Public webhooks (deauthorize, data-deletion) work without auth.
- Privacy policy + data-deletion-status pages serve HTML.
- Public-media for a non-linked target returns {linked:false, items:[]}.
- Regression: login, /auth/me, referral, people-search.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://highlight-vibe-bugs.preview.emergentagent.com").rstrip("/")

TRAINEE = {"email": "test_trainee_iter25@test.com", "password": "Test123!"}
TRAINER = {"email": "test_trainer_iter25@test.com", "password": "Test123!"}


# ── Fixtures ───────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def trainee_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=TRAINEE, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Trainee login failed: {r.status_code} {r.text}")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="session")
def trainer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=TRAINER, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Trainer login failed: {r.status_code} {r.text}")
    return r.json().get("access_token") or r.json().get("token")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ── Auth sanity (regression) ───────────────────────────────────────────
class TestAuthRegression:
    def test_trainee_login(self, trainee_token):
        assert isinstance(trainee_token, str) and len(trainee_token) > 10

    def test_trainer_login(self, trainer_token):
        assert isinstance(trainer_token, str) and len(trainer_token) > 10

    def test_auth_me_trainee(self, trainee_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth(trainee_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("email") == TRAINEE["email"]


# ── Instagram: status ──────────────────────────────────────────────────
class TestInstagramStatus:
    def test_status_unlinked_trainee(self, trainee_token):
        r = requests.get(f"{BASE_URL}/api/instagram/status", headers=_auth(trainee_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("linked") is False
        # selectedMediaIds default empty list
        assert data.get("selectedMediaIds", []) == []

    def test_status_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/instagram/status", timeout=15)
        assert r.status_code in (401, 403)


# ── Instagram: oauth start/callback return 503 when not configured ─────
class TestInstagramOAuthNotConfigured:
    def test_oauth_start_503(self, trainee_token):
        r = requests.post(f"{BASE_URL}/api/instagram/oauth/start", headers=_auth(trainee_token), timeout=15)
        assert r.status_code == 503, r.text
        body = r.json()
        assert "not yet configured" in (body.get("detail") or "").lower() or "not configured" in (body.get("detail") or "").lower()

    def test_oauth_callback_503(self, trainee_token):
        r = requests.post(
            f"{BASE_URL}/api/instagram/oauth/callback",
            headers=_auth(trainee_token),
            json={"code": "fake_code", "state": "fake_state"},
            timeout=15,
        )
        assert r.status_code == 503, r.text

    def test_oauth_start_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/instagram/oauth/start", timeout=15)
        assert r.status_code in (401, 403)


# ── Instagram: media / curate / refresh — non-linked user ──────────────
class TestInstagramNotLinked:
    def test_media_404(self, trainee_token):
        r = requests.get(f"{BASE_URL}/api/instagram/media", headers=_auth(trainee_token), timeout=15)
        assert r.status_code == 404, r.text
        assert "not linked" in (r.json().get("detail") or "").lower()

    def test_curate_404(self, trainee_token):
        r = requests.post(
            f"{BASE_URL}/api/instagram/curate",
            headers=_auth(trainee_token),
            json={"selectedMediaIds": ["abc", "def"]},
            timeout=15,
        )
        assert r.status_code == 404, r.text

    def test_refresh_returns_404_or_503(self, trainee_token):
        # Implementation checks _instagram_configured() FIRST → expect 503 in current empty-creds state.
        r = requests.post(f"{BASE_URL}/api/instagram/refresh", headers=_auth(trainee_token), timeout=15)
        assert r.status_code in (404, 503), r.text


# ── Instagram: unlink is idempotent ────────────────────────────────────
class TestInstagramUnlink:
    def test_unlink_idempotent(self, trainee_token):
        r = requests.post(f"{BASE_URL}/api/instagram/unlink", headers=_auth(trainee_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert data.get("deleted") is False  # nothing to delete

    def test_unlink_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/instagram/unlink", timeout=15)
        assert r.status_code in (401, 403)


# ── Instagram: webhooks (no auth) ──────────────────────────────────────
class TestInstagramWebhooks:
    def test_deauthorize_get_ok(self):
        r = requests.get(f"{BASE_URL}/api/instagram/deauthorize", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("status") == "ok"

    def test_deauthorize_post_ok(self):
        r = requests.post(
            f"{BASE_URL}/api/instagram/deauthorize",
            json={"user_id": "test_ig_abc"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "ok"

    def test_data_deletion_get_ok(self):
        r = requests.get(f"{BASE_URL}/api/instagram/data-deletion", timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "ok"

    def test_data_deletion_post_meta_format(self):
        r = requests.post(
            f"{BASE_URL}/api/instagram/data-deletion",
            json={"user_id": "test_ig_abc"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Meta-required fields
        assert "url" in data and isinstance(data["url"], str) and data["url"].startswith("http")
        assert "confirmation_code" in data and isinstance(data["confirmation_code"], str)
        assert len(data["confirmation_code"]) >= 8
        # URL should reference the data-deletion-status endpoint
        assert "data-deletion-status" in data["url"]


# ── Instagram: public media for non-linked target ──────────────────────
class TestInstagramPublicMedia:
    def test_public_media_non_linked_target(self, trainee_token):
        r = requests.get(
            f"{BASE_URL}/api/instagram/public-media/some_random_target_user_id_xyz",
            headers=_auth(trainee_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("linked") is False
        assert data.get("items") == []
        assert data.get("username") is None

    def test_public_media_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/instagram/public-media/anything", timeout=15)
        assert r.status_code in (401, 403)


# ── Privacy pages (Meta-reachable URLs) ────────────────────────────────
class TestPrivacyPages:
    def test_privacy_policy_html(self):
        r = requests.get(f"{BASE_URL}/api/privacy/policy", timeout=15)
        assert r.status_code == 200, r.text
        assert "text/html" in r.headers.get("content-type", "").lower()
        assert len(r.text) > 100

    def test_data_deletion_status_html(self):
        r = requests.get(f"{BASE_URL}/api/privacy/data-deletion-status?code=XYZ123", timeout=15)
        assert r.status_code == 200, r.text
        assert "text/html" in r.headers.get("content-type", "").lower()
        assert "XYZ123" in r.text  # confirmation code echoed

    def test_data_deletion_status_no_code(self):
        r = requests.get(f"{BASE_URL}/api/privacy/data-deletion-status", timeout=15)
        assert r.status_code == 200


# ── Regression: existing endpoints still work ──────────────────────────
class TestRegression:
    def test_referral_my_code(self, trainee_token):
        r = requests.get(f"{BASE_URL}/api/referral/my-code", headers=_auth(trainee_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Endpoint may return referralCode/code/referral_code
        assert any(k in data for k in ("referralCode", "code", "referral_code"))

    def test_referral_track_invite(self, trainee_token):
        r = requests.post(
            f"{BASE_URL}/api/referral/track-invite",
            headers=_auth(trainee_token),
            json={"channel": "sms"},
            timeout=15,
        )
        # Should succeed (200/201) or accept (202)
        assert r.status_code in (200, 201, 202), r.text

    def test_trainers_search(self, trainee_token):
        r = requests.get(
            f"{BASE_URL}/api/trainers/search?q=test",
            headers=_auth(trainee_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text

    def test_trainees_search_as_trainer(self, trainer_token):
        r = requests.get(
            f"{BASE_URL}/api/trainees/search?q=test",
            headers=_auth(trainer_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "trainees" in data and isinstance(data["trainees"], list)
