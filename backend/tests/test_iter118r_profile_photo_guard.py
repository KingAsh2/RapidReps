"""
iter118r: profile photo `file://` guard test
Verifies:
  (a) POST /api/trainee-profiles + /api/trainer-profiles reject device-local URIs
      (file://, content://, ph://, assets-library://) with HTTP 400 and expected detail.
  (b) Valid data:image/... base64 uploads succeed and are synced across:
        - profile endpoint
        - GET /api/{role}-profiles/{userId}
        - GET /api/auth/me
"""
import os
import base64
import pytest
import requests

BASE_URL = (
    os.environ.get('REACT_APP_BACKEND_URL')
    or os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    or "https://highlight-vibe-bugs.preview.emergentagent.com"
).rstrip('/')

TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
PASSWORD = "Test123!"

# 1x1 transparent PNG
PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)
DATA_URL = "data:image/png;base64," + base64.b64encode(PNG_BYTES).decode()

EXPECTED_DETAIL = "Profile photo must be a data URL or hosted URL"


def login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed {r.status_code}: {r.text}"
    data = r.json()
    return data["access_token"], data["user"]["id"]


@pytest.fixture(scope="module")
def trainee_auth():
    tok, uid = login(TRAINEE_EMAIL, PASSWORD)
    return {"token": tok, "user_id": uid, "headers": {"Authorization": f"Bearer {tok}"}}


@pytest.fixture(scope="module")
def trainer_auth():
    tok, uid = login(TRAINER_EMAIL, PASSWORD)
    return {"token": tok, "user_id": uid, "headers": {"Authorization": f"Bearer {tok}"}}


# ---------- (a) file:// guard on both endpoints ----------
BAD_PREFIXES = [
    "file:///data/tmp/photo.jpg",
    "content://media/external/images/1234",
    "ph://ABCD-1234",
    "assets-library://asset/xyz",
]


@pytest.mark.parametrize("bad_uri", BAD_PREFIXES)
def test_trainee_profile_rejects_device_local_uri(trainee_auth, bad_uri):
    r = requests.post(
        f"{BASE_URL}/api/trainee-profiles",
        json={"userId": trainee_auth["user_id"], "profilePhoto": bad_uri, "fitnessGoals": "strength"},
        headers=trainee_auth["headers"],
        timeout=30,
    )
    assert r.status_code == 400, f"Expected 400 for {bad_uri}, got {r.status_code}: {r.text}"
    body = r.json()
    detail = body.get("detail", "")
    assert EXPECTED_DETAIL in detail, f"Unexpected detail: {detail}"


@pytest.mark.parametrize("bad_uri", BAD_PREFIXES)
def test_trainer_profile_rejects_device_local_uri(trainer_auth, bad_uri):
    r = requests.post(
        f"{BASE_URL}/api/trainer-profiles",
        json={"userId": trainer_auth["user_id"], "profilePhoto": bad_uri, "bio": "hi"},
        headers=trainer_auth["headers"],
        timeout=30,
    )
    assert r.status_code == 400, f"Expected 400 for {bad_uri}, got {r.status_code}: {r.text}"
    detail = r.json().get("detail", "")
    assert EXPECTED_DETAIL in detail, f"Unexpected detail: {detail}"


# ---------- (b) valid data URL succeeds end-to-end ----------
def test_trainee_valid_data_url_persists_and_syncs(trainee_auth):
    # POST
    r = requests.post(
        f"{BASE_URL}/api/trainee-profiles",
        json={"userId": trainee_auth["user_id"], "profilePhoto": DATA_URL, "fitnessGoals": "strength"},
        headers=trainee_auth["headers"],
        timeout=30,
    )
    assert r.status_code == 200, f"POST failed {r.status_code}: {r.text}"

    # GET trainee-profiles/{userId}
    r2 = requests.get(
        f"{BASE_URL}/api/trainee-profiles/{trainee_auth['user_id']}",
        headers=trainee_auth["headers"],
        timeout=30,
    )
    assert r2.status_code == 200, f"GET failed: {r2.text}"
    body = r2.json()
    assert body.get("profilePhoto") == DATA_URL, "profilePhoto did not persist via GET trainee-profiles/{userId}"

    # GET /auth/me
    r3 = requests.get(f"{BASE_URL}/api/auth/me", headers=trainee_auth["headers"], timeout=30)
    assert r3.status_code == 200
    me = r3.json()
    assert me.get("profilePhoto") == DATA_URL, f"/auth/me profilePhoto mismatch: {me.get('profilePhoto')!r:.80}"


def test_trainer_valid_data_url_persists_and_syncs(trainer_auth):
    # POST
    r = requests.post(
        f"{BASE_URL}/api/trainer-profiles",
        json={"userId": trainer_auth["user_id"], "profilePhoto": DATA_URL, "bio": "test bio"},
        headers=trainer_auth["headers"],
        timeout=30,
    )
    assert r.status_code == 200, f"POST failed {r.status_code}: {r.text}"

    # GET trainer-profiles/{userId} — should surface avatarUrl
    r2 = requests.get(
        f"{BASE_URL}/api/trainer-profiles/{trainer_auth['user_id']}",
        headers=trainer_auth["headers"],
        timeout=30,
    )
    assert r2.status_code == 200, f"GET failed: {r2.text}"
    body = r2.json()
    avatar = body.get("avatarUrl") or body.get("profilePhoto")
    assert avatar == DATA_URL, f"trainer profile avatarUrl mismatch (got prefix {str(avatar)[:60]!r})"

    # GET /auth/me — trainer should have both profilePhoto + avatarUrl populated
    r3 = requests.get(f"{BASE_URL}/api/auth/me", headers=trainer_auth["headers"], timeout=30)
    assert r3.status_code == 200
    me = r3.json()
    assert me.get("profilePhoto") == DATA_URL, "trainer /auth/me profilePhoto mismatch"
    assert me.get("avatarUrl") == DATA_URL, "trainer /auth/me avatarUrl mismatch"
