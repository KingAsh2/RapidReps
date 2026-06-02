"""Iter87 backend tests — matching engine + virtual/instant routes extraction."""
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

def test_virtual_pending_trainer(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.get(f"{BASE_URL}/api/virtual/pending", headers=h)
    assert r.status_code == 200
    body = r.json()
    # Endpoint returns a list of request dicts directly
    assert isinstance(body, list)


def test_virtual_request_bad_id_returns_404(trainee_session):
    h = {'Authorization': f"Bearer {trainee_session['access_token']}"}
    r = requests.get(f"{BASE_URL}/api/virtual/request/not-a-valid-id", headers=h)
    assert r.status_code == 404


def test_virtual_request_trainer_role_forbidden(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.post(f"{BASE_URL}/api/virtual/request", headers=h)
    assert r.status_code == 400


def test_virtual_cancel_bad_id_returns_404(trainee_session):
    h = {'Authorization': f"Bearer {trainee_session['access_token']}"}
    r = requests.post(f"{BASE_URL}/api/virtual/cancel/not-a-valid-id", headers=h)
    assert r.status_code == 404


def test_virtual_accept_bad_id_returns_error(trainer_session):
    """Accept rejects bad ids with either 403 (auth-first) or 404 — both prove route is wired."""
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.post(f"{BASE_URL}/api/virtual/accept/not-a-valid-id", headers=h)
    assert r.status_code in (403, 404)


def test_virtual_reject_bad_id_returns_error(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.post(f"{BASE_URL}/api/virtual/reject/not-a-valid-id", headers=h)
    assert r.status_code in (403, 404)


def test_instant_request_trainer_role_forbidden(trainer_session):
    h = {'Authorization': f"Bearer {trainer_session['access_token']}"}
    r = requests.post(f"{BASE_URL}/api/instant/request", headers=h)
    assert r.status_code == 400


# --- Static checks ---

def test_server_py_has_matching_router():
    with open('/app/backend/server.py', 'r') as f:
        src = f.read()
    assert 'from routes.matching_routes import router as matching_router' in src
    assert 'app.include_router(matching_router)' in src


def test_no_duplicate_matching_routes_in_server():
    with open('/app/backend/server.py', 'r') as f:
        src = f.read()
    assert not re.search(r'@api_router\.post\("/virtual/request"\)', src)
    assert not re.search(r'@api_router\.post\("/instant/request"\)', src)
    assert not re.search(r'@api_router\.get\("/virtual/pending"\)', src)
    assert not re.search(r'@api_router\.post\("/virtual/accept/\{request_id\}"\)', src)
    assert not re.search(r'def score_trainer\(', src)
    assert not re.search(r'def get_wave_trainers\(', src)
    assert not re.search(r'async def run_matching_engine\(', src)


def test_matching_module_has_helpers_and_routes():
    with open('/app/backend/routes/matching_routes.py', 'r') as f:
        src = f.read()
    assert 'def score_trainer' in src
    assert 'def get_wave_trainers' in src
    assert 'async def run_matching_engine' in src
    assert '@router.post("/virtual/request")' in src
    assert '@router.post("/instant/request")' in src
    assert '@router.get("/virtual/pending")' in src


def test_server_py_under_1500_lines():
    """Refactor target after iter87: server.py should be under 1500 lines."""
    with open('/app/backend/server.py', 'r') as f:
        n = sum(1 for _ in f)
    assert n < 1500, f"server.py is {n} lines — extraction regressed"
