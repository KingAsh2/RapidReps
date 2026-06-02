"""Iter85 backend tests — refactor regression + Approve All endpoint."""
import os
import re
import pytest
import requests
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'https://highlight-vibe-bugs.preview.emergentagent.com'
ADMIN_EMAIL = 'admin@rapidreps.com'
ADMIN_PASS = 'admin123'
TRAINER_EMAIL = 'test_trainer_iter25@test.com'
TRAINER_PASS = 'Test123!'
TRAINEE_EMAIL = 'test_trainee_iter25@test.com'
TRAINEE_PASS = 'Test123!'


def _login(email: str, password: str) -> dict:
    res = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"login failed for {email}: {res.text}"
    return res.json()


@pytest.fixture(scope='module')
def admin_session():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope='module')
def trainer_session():
    return _login(TRAINER_EMAIL, TRAINER_PASS)


@pytest.fixture(scope='module')
def trainee_session():
    return _login(TRAINEE_EMAIL, TRAINEE_PASS)


# --- Refactor regression: messaging routes still work via extracted module ---

def test_get_conversations_extracted(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.get(f"{BASE_URL}/api/conversations", headers=h)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_post_message_extracted(trainer_session, trainee_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    trainee_id = trainee_session['user']['id']
    payload = {"receiverId": trainee_id, "content": f"iter85-refactor-test {int(time.time())}"}
    r = requests.post(f"{BASE_URL}/api/messages", json=payload, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body['senderId'] == trainer_session['user']['id']
    assert body['receiverId'] == trainee_id


# --- Refactor regression: notification routes still work via extracted module ---

def test_get_notifications_extracted(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.get(f"{BASE_URL}/api/notifications", headers=h)
    assert r.status_code == 200
    assert 'notifications' in r.json()


def test_get_notification_preferences_extracted(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.get(f"{BASE_URL}/api/notification-preferences", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body.get('pushEnabled') in (True, False)
    assert 'session_requested' in body


def test_delete_notification_bad_id_returns_400(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.delete(f"{BASE_URL}/api/notifications/not-an-objectid", headers=h)
    assert r.status_code == 400


def test_push_token_register_unregister(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    payload = {"token": f"ExponentPushToken[iter85-{int(time.time())}]", "deviceId": "test-device"}
    r1 = requests.post(f"{BASE_URL}/api/push-tokens/register", json=payload, headers=h)
    assert r1.status_code == 200
    r2 = requests.request('DELETE', f"{BASE_URL}/api/push-tokens/unregister", json=payload, headers=h)
    assert r2.status_code == 200


# --- Approve All steps endpoint ---

def test_approve_all_steps_admin_only(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    trainer_id = trainer_session['user']['id']
    r = requests.post(f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve-all-steps", headers=h)
    assert r.status_code == 403, f"non-admin should be 403, got {r.status_code}: {r.text}"


def test_approve_all_steps_404_for_unknown_trainer(admin_session):
    h = {'Authorization': f"Bearer {admin_session['access_token']}"}
    r = requests.post(f"{BASE_URL}/api/admin/verifications/000000000000000000000000/approve-all-steps", headers=h)
    assert r.status_code == 404


def test_approve_all_steps_response_shape(admin_session, trainer_session):
    h = {'Authorization': f"Bearer {admin_session['access_token']}"}
    trainer_id = trainer_session['user']['id']
    r = requests.post(f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve-all-steps", headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get('success') is True
    assert 'approvedSteps' in body
    assert 'skipped' in body
    assert 'approvedCount' in body
    assert isinstance(body['approvedSteps'], list)
    assert isinstance(body['skipped'], list)
    assert isinstance(body['approvedCount'], int)


# --- Static checks: server.py shrunk, new modules exist ---

def test_server_py_extracted_modules_imported():
    with open('/app/backend/server.py', 'r') as f:
        src = f.read()
    assert 'from routes.messaging_routes import router as messaging_router' in src
    assert 'from routes.notification_routes import router as notification_router' in src
    assert 'app.include_router(messaging_router)' in src
    assert 'app.include_router(notification_router)' in src


def test_server_py_under_2600_lines():
    """Refactor target: messaging + notifications extracted should land us under 2600 lines."""
    with open('/app/backend/server.py', 'r') as f:
        n = sum(1 for _ in f)
    assert n < 2600, f"server.py is {n} lines — extraction regressed"


def test_no_duplicate_messaging_routes_in_server():
    with open('/app/backend/server.py', 'r') as f:
        src = f.read()
    # The decorators for the extracted endpoints must NOT live in server.py anymore
    assert not re.search(r'@api_router\.post\("/messages"\)', src)
    assert not re.search(r'@api_router\.get\("/conversations"\)', src)
    assert not re.search(r'@api_router\.get\("/notifications"\)', src)
    assert not re.search(r'@api_router\.post\("/push-tokens/register"\)', src)


# --- Frontend static checks: Approve All button + upload progress UI ---

def test_verifications_tab_has_approve_all_button():
    with open('/app/frontend/src/components/admin/VerificationsTab.tsx', 'r') as f:
        src = f.read()
    assert 'approve-all-steps-btn' in src
    assert 'handleApproveAllSteps' in src
    assert '/admin/verifications/${trainerId}/approve-all-steps' in src or '/approve-all-steps' in src


def test_highlight_upload_has_progress_ui():
    for path in (
        '/app/frontend/app/trainer/highlight-upload.tsx',
        '/app/frontend/app/trainee/highlight-upload.tsx',
    ):
        with open(path, 'r') as f:
            src = f.read()
        assert 'uploadWithProgress' in src, f"{path} missing uploadWithProgress"
        assert 'uploadProgress' in src, f"{path} missing uploadProgress state"
        assert 'XMLHttpRequest' in src, f"{path} missing XHR progress wiring"
        assert 'progressBarFill' in src, f"{path} missing progress bar styles"
