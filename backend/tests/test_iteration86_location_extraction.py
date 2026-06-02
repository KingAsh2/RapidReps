"""Iter86 backend tests — location/GPS route extraction regression."""
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


# --- Routes still reachable after extraction ---

def test_trainer_location_status(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.get(f"{BASE_URL}/api/trainer/my-location-status", headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert 'isAvailable' in body


def test_trainer_location_status_trainee_403(trainee_session):
    h = {'Authorization': f"Bearer {trainee_session['access_token']}"}
    r = requests.get(f"{BASE_URL}/api/trainer/my-location-status", headers=h)
    assert r.status_code == 403


def test_put_trainer_location(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.put(f"{BASE_URL}/api/trainer/location", json={"latitude": 37.7749, "longitude": -122.4194}, headers=h)
    assert r.status_code == 200
    assert r.json().get('success') is True


def test_put_trainer_availability(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.put(
        f"{BASE_URL}/api/trainer/availability",
        json={"isAvailable": False, "latitude": 37.7749, "longitude": -122.4194},
        headers=h,
    )
    assert r.status_code == 200


def test_trainers_nearby(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.get(f"{BASE_URL}/api/trainers/nearby?latitude=37.77&longitude=-122.41&radius_miles=25", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert 'trainers' in body
    assert 'count' in body
    assert isinstance(body['trainers'], list)


def test_gps_update_bad_session_id_400(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.post(
        f"{BASE_URL}/api/sessions/not-an-objectid/gps-update?latitude=37.77&longitude=-122.41",
        headers=h,
    )
    assert r.status_code == 400


def test_gps_track_bad_session_id_400(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.get(f"{BASE_URL}/api/sessions/not-an-objectid/gps-track", headers=h)
    assert r.status_code == 400


# --- Static checks ---

def test_server_py_has_location_router():
    with open('/app/backend/server.py', 'r') as f:
        src = f.read()
    assert 'from routes.location_routes import router as location_router' in src
    assert 'app.include_router(location_router)' in src


def test_no_duplicate_location_routes_in_server():
    with open('/app/backend/server.py', 'r') as f:
        src = f.read()
    # Decorators must NOT live in server.py anymore
    assert not re.search(r'@api_router\.put\("/trainer/location"\)', src)
    assert not re.search(r'@api_router\.put\("/trainer/availability"\)', src)
    assert not re.search(r'@api_router\.get\("/trainer/my-location-status"\)', src)
    assert not re.search(r'@api_router\.post\("/sessions/\{session_id\}/gps-update"\)', src)
    assert not re.search(r'@api_router\.get\("/trainers/nearby"\)', src)


def test_location_routes_module_has_helpers():
    with open('/app/backend/routes/location_routes.py', 'r') as f:
        src = f.read()
    assert 'def calculate_distance_miles' in src
    assert 'def estimate_eta_minutes' in src
    assert '@router.put("/trainer/location")' in src
    assert '@router.get("/trainers/nearby")' in src
