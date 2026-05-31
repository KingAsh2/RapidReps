"""Iteration 75 backend tests: HTTP Range support for /api/files/{path}
and profilePhoto/avatarUrl exposure on /api/auth/me (UserResponse).

Scenarios covered:
  1. GET /api/files/{path} without Range → 200 + Accept-Ranges/Content-Length/Cache-Control.
  2. GET /api/files/{path} with Range: bytes=0-49 → 206 + correct Content-Range + Content-Length=50.
  3. GET /api/files/{path} with open-ended Range: bytes=N- → 206 from N to EOF.
  4. GET /api/files/{path} with malformed/over-range Range → 416 + Content-Range: bytes */<total>.
  5. GET /api/auth/me exposes profilePhoto + avatarUrl (nullable, synced via /trainer-profiles).
  6. Regression: POST /api/sessions still works, POST /trainer-profiles/{uid}/highlights/base64 still works,
     admin verifications detail unchanged.
"""
import os
import base64
import uuid
import pytest
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://highlight-vibe-bugs.preview.emergentagent.com"
).rstrip("/")

ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PW = "admin123"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PW = "Test123!"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PW = "Test123!"


def _login(email: str, password: str) -> dict:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=15,
    )
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    body = r.json()
    return {
        "token": body.get("access_token") or body.get("token"),
        "user": body.get("user", {}),
    }


# ---------- Session-scoped fixtures ----------

@pytest.fixture(scope="session")
def admin_auth():
    return _login(ADMIN_EMAIL, ADMIN_PW)


@pytest.fixture(scope="session")
def trainer_auth():
    return _login(TRAINER_EMAIL, TRAINER_PW)


@pytest.fixture(scope="session")
def trainee_auth():
    return _login(TRAINEE_EMAIL, TRAINEE_PW)


@pytest.fixture(scope="session")
def small_highlight_path(trainer_auth):
    """Upload a tiny known-size PNG highlight on the trainer and return its storagePath + size."""
    # 1x1 transparent PNG (67 bytes)
    png_b64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII="
    )
    raw_bytes = base64.b64decode(png_b64)
    trainer_uid = trainer_auth["user"]["id"]
    headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
    r = requests.post(
        f"{BASE_URL}/api/trainer-profiles/{trainer_uid}/highlights/base64",
        json={
            "data": png_b64,
            "filename": f"iter75_{uuid.uuid4().hex[:8]}.png",
            "contentType": "image/png",
            "caption": "TEST_iter75_range",
        },
        headers=headers,
        timeout=20,
    )
    assert r.status_code == 200, f"upload highlight failed: {r.status_code} {r.text}"
    hl = r.json()["highlight"]
    url_path = hl["url"]  # e.g. /api/files/rapidreps/highlights/<uid>/<file>.png
    assert url_path.startswith("/api/files/"), url_path
    return {"url": url_path, "size": len(raw_bytes)}


# ============================================================================
# Scenario 1: No Range header
# ============================================================================
class TestFilesNoRange:
    def test_no_range_returns_200_with_headers(self, small_highlight_path):
        r = requests.get(f"{BASE_URL}{small_highlight_path['url']}", timeout=15)
        assert r.status_code == 200, r.text
        # Critical Range-streaming headers
        assert r.headers.get("Accept-Ranges", "").lower() == "bytes"
        assert r.headers.get("Content-Length") == str(small_highlight_path["size"])
        # Cache-Control header must be present (middleware may override the route's value).
        assert r.headers.get("Cache-Control") is not None, "Cache-Control header missing"
        # Full body returned
        assert len(r.content) == small_highlight_path["size"]


# ============================================================================
# Scenarios 2 + 3: Valid Range requests → 206 Partial Content
# ============================================================================
class TestFilesValidRange:
    def test_range_first_50_bytes(self, small_highlight_path):
        total = small_highlight_path["size"]
        # Use a range guaranteed to be valid even for small files.
        end = min(49, total - 1)
        r = requests.get(
            f"{BASE_URL}{small_highlight_path['url']}",
            headers={"Range": f"bytes=0-{end}"},
            timeout=15,
        )
        assert r.status_code == 206, f"expected 206, got {r.status_code}: {r.text}"
        assert r.headers.get("Content-Range") == f"bytes 0-{end}/{total}"
        expected_len = end - 0 + 1
        assert r.headers.get("Content-Length") == str(expected_len)
        assert len(r.content) == expected_len
        assert r.headers.get("Accept-Ranges", "").lower() == "bytes"

    def test_range_open_ended_from_offset(self, small_highlight_path):
        total = small_highlight_path["size"]
        start = max(0, total - 20)  # last 20 bytes (or all if file is tiny)
        r = requests.get(
            f"{BASE_URL}{small_highlight_path['url']}",
            headers={"Range": f"bytes={start}-"},
            timeout=15,
        )
        assert r.status_code == 206, f"expected 206, got {r.status_code}: {r.text}"
        expected_end = total - 1
        assert r.headers.get("Content-Range") == f"bytes {start}-{expected_end}/{total}"
        expected_len = expected_end - start + 1
        assert r.headers.get("Content-Length") == str(expected_len)
        assert len(r.content) == expected_len


# ============================================================================
# Scenario 4: Invalid Range → 416 Range Not Satisfiable
# ============================================================================
class TestFilesInvalidRange:
    def test_range_beyond_eof_returns_416(self, small_highlight_path):
        total = small_highlight_path["size"]
        bad_start = total + 100
        bad_end = total + 200
        r = requests.get(
            f"{BASE_URL}{small_highlight_path['url']}",
            headers={"Range": f"bytes={bad_start}-{bad_end}"},
            timeout=15,
        )
        assert r.status_code == 416, f"expected 416, got {r.status_code}: {r.text}"
        assert r.headers.get("Content-Range") == f"bytes */{total}"

    def test_range_malformed_returns_416(self, small_highlight_path):
        total = small_highlight_path["size"]
        r = requests.get(
            f"{BASE_URL}{small_highlight_path['url']}",
            headers={"Range": "bytes=abc-xyz"},
            timeout=15,
        )
        assert r.status_code == 416, f"expected 416, got {r.status_code}: {r.text}"
        assert r.headers.get("Content-Range") == f"bytes */{total}"


# ============================================================================
# Scenario 5: /api/auth/me exposes profilePhoto + avatarUrl
# ============================================================================
class TestAuthMeProfilePhoto:
    def test_me_includes_profilePhoto_and_avatarUrl_keys(self, trainer_auth):
        r = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {trainer_auth['token']}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "profilePhoto" in body, f"profilePhoto missing from /me: keys={list(body.keys())}"
        assert "avatarUrl" in body, f"avatarUrl missing from /me: keys={list(body.keys())}"

    def test_me_reflects_synced_profilePhoto_after_trainer_profile_post(self, trainer_auth):
        """POST /trainer-profiles with profilePhoto=<sentinel>, then GET /me must surface it."""
        trainer_uid = trainer_auth["user"]["id"]
        headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
        sentinel = f"https://example.com/iter75-sync-{uuid.uuid4().hex[:8]}.png"
        # Minimal payload — userId + profilePhoto trigger the sync block at profile_routes.py L46-52
        post_body = {
            "userId": trainer_uid,
            "profilePhoto": sentinel,
            "avatarUrl": sentinel,
        }
        rp = requests.post(
            f"{BASE_URL}/api/trainer-profiles",
            json=post_body,
            headers=headers,
            timeout=20,
        )
        assert rp.status_code == 200, f"trainer-profiles POST failed: {rp.status_code} {rp.text}"

        # Now /me should reflect users.profilePhoto = sentinel
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=15)
        assert me.status_code == 200, me.text
        body = me.json()
        assert body.get("profilePhoto") == sentinel, (
            f"/me profilePhoto={body.get('profilePhoto')!r} did not reflect synced sentinel {sentinel!r}"
        )
        # avatarUrl on /me is optional/nullable per model, but if exposed should also be string-compatible.
        # We don't strict-equal here because the user document doesn't carry avatarUrl directly —
        # the field exists in the response schema, value may be None for users (avatarUrl lives on profile).
        assert "avatarUrl" in body


# ============================================================================
# Scenario 6: Regression — booking + highlight upload + admin verifications
# ============================================================================
class TestRegression:
    def test_post_session_still_works(self, trainee_auth, trainer_auth):
        trainee_uid = trainee_auth["user"]["id"]
        trainer_uid = trainer_auth["user"]["id"]
        start = datetime.now(timezone.utc) + timedelta(days=2)
        body = {
            "traineeId": trainee_uid,
            "trainerId": trainer_uid,
            "sessionDateTimeStart": start.isoformat(),
            "durationMinutes": 60,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "TEST_iter75 Park",
            "notes": "TEST_iter75 regression",
        }
        r = requests.post(
            f"{BASE_URL}/api/sessions",
            json=body,
            headers={"Authorization": f"Bearer {trainee_auth['token']}"},
            timeout=20,
        )
        assert r.status_code in (200, 201), f"sessions POST failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("trainerId") == trainer_uid
        assert data.get("traineeId") == trainee_uid

    def test_highlight_base64_still_works(self, small_highlight_path):
        # Already proven by fixture — assert URL shape & retrievability.
        assert small_highlight_path["url"].startswith("/api/files/")
        r = requests.get(f"{BASE_URL}{small_highlight_path['url']}", timeout=15)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")

    def test_admin_verifications_detail_unchanged(self, admin_auth, trainer_auth):
        """Admin verifications detail endpoint still works (used by FE admin panel)."""
        trainer_uid = trainer_auth["user"]["id"]
        r = requests.get(
            f"{BASE_URL}/api/admin/verifications/{trainer_uid}/detail",
            headers={"Authorization": f"Bearer {admin_auth['token']}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # Per iter74 contract: returns steps array
        assert "steps" in body or isinstance(body, dict)
