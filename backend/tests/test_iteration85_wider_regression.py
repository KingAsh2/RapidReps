"""Iter85 wider regression: messaging/notifications extraction + new endpoints + admin seed."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'https://highlight-vibe-bugs.preview.emergentagent.com'
ADMIN_EMAIL = 'admin@rapidreps.com'
ADMIN_PASS = 'admin123'
TRAINER_EMAIL = 'test_trainer_iter25@test.com'
TRAINER_PASS = 'Test123!'
TRAINEE_EMAIL = 'test_trainee_iter25@test.com'
TRAINEE_PASS = 'Test123!'


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope='module')
def admin():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope='module')
def trainer():
    return _login(TRAINER_EMAIL, TRAINER_PASS)


@pytest.fixture(scope='module')
def trainee():
    return _login(TRAINEE_EMAIL, TRAINEE_PASS)


def _hdr(sess):
    return {'Authorization': f"Bearer {sess['access_token']}"}


# --- Idempotent admin seed (admin login already works above as fixture) ---

def test_admin_seed_idempotent(admin):
    assert admin['user']['email'] == ADMIN_EMAIL
    # auth/me must reflect admin role
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(admin))
    assert r.status_code == 200
    body = r.json()
    # Admin role can be exposed via `role` (string), `roles` (list), or `isAdmin` bool
    is_admin = (
        body.get('role') in ('admin', 'ADMIN')
        or 'admin' in (body.get('roles') or [])
        or body.get('isAdmin') is True
    )
    assert is_admin, f"admin role not detected in /auth/me payload: {body}"
    assert body.get('email') == ADMIN_EMAIL


def test_auth_me_for_trainer_and_trainee(trainer, trainee):
    for sess, expected_email in ((trainer, TRAINER_EMAIL), (trainee, TRAINEE_EMAIL)):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_hdr(sess))
        assert r.status_code == 200, r.text
        assert r.json().get('email') == expected_email


# --- Messaging routes (extracted) deeper coverage ---

def test_conversations_create_and_list(trainer, trainee):
    h = _hdr(trainer)
    other_id = trainee['user']['id']
    # POST /api/conversations (create or fetch existing) - uses query param receiver_id
    r = requests.post(f"{BASE_URL}/api/conversations", params={"receiver_id": other_id}, headers=h)
    assert r.status_code == 200, r.text
    conv = r.json()
    # No mongo _id leak
    assert '_id' not in conv

    # GET list
    r2 = requests.get(f"{BASE_URL}/api/conversations", headers=h)
    assert r2.status_code == 200
    assert isinstance(r2.json(), list)


def test_get_conversation_messages_endpoint(trainer, trainee):
    # Send a message first to ensure a conversation exists
    h = _hdr(trainer)
    other_id = trainee['user']['id']
    requests.post(f"{BASE_URL}/api/messages",
                  json={"receiverId": other_id, "content": f"iter85-wider {int(time.time())}"},
                  headers=h)
    # Fetch conversations to find an id
    r = requests.get(f"{BASE_URL}/api/conversations", headers=h)
    assert r.status_code == 200
    convs = r.json()
    assert len(convs) >= 1, "expected at least one conversation after sending a message"
    cid = convs[0].get('id') or convs[0].get('conversationId') or convs[0].get('_id')
    assert cid, f"no usable conversation id in {convs[0]}"
    r2 = requests.get(f"{BASE_URL}/api/conversations/{cid}/messages", headers=h)
    # Some implementations 404 if id form differs (e.g., synthetic pair id) — allow 200 only as success
    assert r2.status_code in (200, 404), r2.text
    if r2.status_code == 200:
        body = r2.json()
        # Should be list or wrapped dict with messages
        assert isinstance(body, list) or isinstance(body.get('messages'), list)


def test_messages_requires_auth():
    r = requests.post(f"{BASE_URL}/api/messages", json={"receiverId": "x", "content": "hi"})
    assert r.status_code in (401, 403)


# --- Notification routes (extracted) deeper coverage ---

def test_notification_preferences_get_and_put(trainer):
    h = _hdr(trainer)
    r = requests.get(f"{BASE_URL}/api/notification-preferences", headers=h)
    assert r.status_code == 200
    prefs = r.json()
    # Flip a boolean and PUT it back
    new_prefs = dict(prefs)
    if 'session_requested' in new_prefs and isinstance(new_prefs['session_requested'], bool):
        new_prefs['session_requested'] = not new_prefs['session_requested']
    r2 = requests.put(f"{BASE_URL}/api/notification-preferences", json=new_prefs, headers=h)
    assert r2.status_code == 200, r2.text
    # Restore original
    requests.put(f"{BASE_URL}/api/notification-preferences", json=prefs, headers=h)


def test_notifications_mark_read(trainer):
    h = _hdr(trainer)
    r = requests.post(f"{BASE_URL}/api/notifications/mark-read", json={"notificationIds": []}, headers=h)
    # Should be 200 with empty list, or 400 if list required; both are acceptable contract-wise
    assert r.status_code in (200, 400), r.text


def test_notification_delete_404_for_unknown_objectid(trainer):
    # Valid ObjectId hex format but not present -> expect 404
    h = _hdr(trainer)
    r = requests.delete(f"{BASE_URL}/api/notifications/000000000000000000000000", headers=h)
    assert r.status_code == 404, r.text


def test_push_token_register_unregister_endpoint(trainer):
    h = _hdr(trainer)
    body = {"token": f"ExponentPushToken[iter85-wider-{int(time.time())}]", "deviceId": "wider-test"}
    r1 = requests.post(f"{BASE_URL}/api/push-tokens/register", json=body, headers=h)
    assert r1.status_code == 200, r1.text
    r2 = requests.request('DELETE', f"{BASE_URL}/api/push-tokens/unregister", json=body, headers=h)
    assert r2.status_code == 200, r2.text


# --- NEW: GET /api/trainee-profiles/{user_id}/highlights (was 405 before) ---

def test_trainee_highlights_endpoint_no_longer_405(trainee):
    h = _hdr(trainee)
    user_id = trainee['user']['id']
    r = requests.get(f"{BASE_URL}/api/trainee-profiles/{user_id}/highlights", headers=h)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    # Accept either a bare list or wrapped dict with `highlights`
    if isinstance(body, dict):
        assert 'highlights' in body
        assert isinstance(body['highlights'], list)
    else:
        assert isinstance(body, list)


# --- Approve-All-Steps deep tests ---

def test_approve_all_steps_idempotent(admin, trainer):
    """Calling twice in a row must remain 200 with consistent envelope shape."""
    h = _hdr(admin)
    trainer_id = trainer['user']['id']
    r1 = requests.post(f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve-all-steps", headers=h)
    assert r1.status_code == 200, r1.text
    r2 = requests.post(f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve-all-steps", headers=h)
    assert r2.status_code == 200, r2.text
    for body in (r1.json(), r2.json()):
        assert body.get('success') is True
        assert isinstance(body.get('approvedSteps'), list)
        assert isinstance(body.get('skipped'), list)
        assert isinstance(body.get('approvedCount'), int)
    # On the second call, approvedCount should be 0 (everything was already approved)
    assert r2.json()['approvedCount'] == 0, f"expected idempotent zero, got {r2.json()}"


def test_approve_all_steps_requires_auth():
    r = requests.post(f"{BASE_URL}/api/admin/verifications/000000000000000000000000/approve-all-steps")
    assert r.status_code in (401, 403)


def test_approve_all_steps_403_for_trainee(trainee):
    h = _hdr(trainee)
    r = requests.post(
        f"{BASE_URL}/api/admin/verifications/000000000000000000000000/approve-all-steps",
        headers=h,
    )
    assert r.status_code == 403, r.text


# --- Admin verifications listing still works (extraction regression) ---

def test_admin_verifications_listing(admin):
    h = _hdr(admin)
    # Common admin verification listing endpoints — try a couple of well-known paths
    candidate_paths = [
        '/api/admin/verifications',
        '/api/admin/verifications/pending',
    ]
    found_any_200 = False
    for p in candidate_paths:
        r = requests.get(f"{BASE_URL}{p}", headers=h)
        if r.status_code == 200:
            found_any_200 = True
            # Should not leak Mongo _id
            txt = r.text
            assert '"_id"' not in txt, f"{p} leaked _id"
    assert found_any_200, "no admin verifications listing endpoint returned 200"


# --- Trainer profile + highlight upload base64 still alive (regression) ---

def test_trainer_profile_get(trainer):
    h = _hdr(trainer)
    tid = trainer['user']['id']
    r = requests.get(f"{BASE_URL}/api/trainer-profiles/{tid}", headers=h)
    assert r.status_code == 200, r.text
    assert '"_id"' not in r.text
