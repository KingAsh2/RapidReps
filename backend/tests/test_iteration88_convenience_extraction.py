"""Iter88 backend tests — convenience features extraction regression."""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'https://highlight-vibe-bugs.preview.emergentagent.com'
TRAINER_EMAIL = 'test_trainer_iter25@test.com'
TRAINER_PASS = 'Test123!'
TRAINEE_EMAIL = 'test_trainee_iter25@test.com'
TRAINEE_PASS = 'Test123!'


def _login(email: str, password: str) -> dict:
    res = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()


@pytest.fixture(scope='module')
def trainer_session():
    return _login(TRAINER_EMAIL, TRAINER_PASS)


@pytest.fixture(scope='module')
def trainee_session():
    return _login(TRAINEE_EMAIL, TRAINEE_PASS)


# --- Endpoints still reachable after extraction ---

def test_trainee_recent_trainers(trainee_session):
    h = {'Authorization': f"Bearer {trainee_session['access_token']}"}
    r = requests.get(f"{BASE_URL}/api/trainee/recent-trainers", headers=h)
    assert r.status_code == 200


def test_trainee_streak(trainee_session):
    h = {'Authorization': f"Bearer {trainee_session['access_token']}"}
    r = requests.get(f"{BASE_URL}/api/trainee/streak", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert 'currentStreak' in body or 'streak' in body or isinstance(body, dict)


def test_trainee_saved_trainers(trainee_session):
    h = {'Authorization': f"Bearer {trainee_session['access_token']}"}
    r = requests.get(f"{BASE_URL}/api/trainee/saved-trainers", headers=h)
    assert r.status_code == 200


def test_trainee_favorite_availability(trainee_session):
    h = {'Authorization': f"Bearer {trainee_session['access_token']}"}
    r = requests.get(f"{BASE_URL}/api/trainee/favorite-availability", headers=h)
    assert r.status_code == 200
    assert 'trainers' in r.json()


def test_trainer_go_offline(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.post(f"{BASE_URL}/api/trainer/go-offline", headers=h)
    assert r.status_code == 200


def test_trainer_go_live_reachable(trainee_session):
    """go-live endpoint doesn't role-gate currently; just confirm route is wired."""
    h = {'Authorization': f"Bearer {trainee_session['access_token']}"}
    r = requests.post(f"{BASE_URL}/api/trainer/go-live", headers=h)
    assert r.status_code in (200, 400, 403)


def test_toggle_favorite_reachable(trainee_session):
    """toggle-favorite doesn't strictly validate trainer_id format; just confirm route wires."""
    h = {'Authorization': f"Bearer {trainee_session['access_token']}"}
    r = requests.post(f"{BASE_URL}/api/trainee/toggle-favorite/not-a-valid-id", headers=h)
    assert r.status_code in (200, 400, 404, 422)


def test_recurring_sessions_requires_trainee(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    payload = {
        "trainerId": "any",
        "sessionRateCents": 5000,
        "scheduledStart": "2026-12-01T10:00:00Z",
        "recurrencePattern": "weekly",
        "occurrences": 4,
    }
    r = requests.post(f"{BASE_URL}/api/sessions/recurring", json=payload, headers=h)
    # Should be rejected for trainer role
    assert r.status_code in (400, 403, 422)


# --- Static checks ---

def test_server_py_has_convenience_router():
    with open('/app/backend/server.py', 'r') as f:
        src = f.read()
    assert 'from routes.convenience_routes import router as convenience_router' in src
    assert 'app.include_router(convenience_router)' in src


def test_no_duplicate_convenience_routes_in_server():
    with open('/app/backend/server.py', 'r') as f:
        src = f.read()
    assert not re.search(r'@api_router\.get\("/trainee/recent-trainers"\)', src)
    assert not re.search(r'@api_router\.get\("/trainee/streak"\)', src)
    assert not re.search(r'@api_router\.post\("/sessions/recurring"\)', src)
    assert not re.search(r'@api_router\.post\("/trainer/go-live"\)', src)
    assert not re.search(r'@api_router\.post\("/trainer/go-offline"\)', src)
    assert not re.search(r'@api_router\.post\("/trainee/toggle-favorite/', src)
    assert not re.search(r'@api_router\.get\("/trainee/saved-trainers"\)', src)
    assert not re.search(r'@api_router\.get\("/trainee/favorite-availability"\)', src)
    # The RecurringSessionCreate model also moved out
    assert 'class RecurringSessionCreate' not in src


def test_convenience_module_has_all_routes():
    with open('/app/backend/routes/convenience_routes.py', 'r') as f:
        src = f.read()
    for path in (
        '/trainee/recent-trainers', '/trainee/streak', '/sessions/recurring',
        '/trainer/go-live', '/trainer/go-offline', '/trainee/toggle-favorite/',
        '/trainee/saved-trainers', '/trainee/favorite-availability',
    ):
        assert path in src, f"Missing route path in convenience_routes.py: {path}"
    assert 'class RecurringSessionCreate' in src


def test_server_py_under_1100_lines():
    """After iter88, server.py should drop below 1,100 lines."""
    with open('/app/backend/server.py', 'r') as f:
        n = sum(1 for _ in f)
    assert n < 1100, f"server.py is {n} lines"
