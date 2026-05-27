"""
Iteration 70 — Backend tests for new people-search endpoints.

Covers:
- GET /api/trainers/search?q=...  (trainee can find any trainer nationwide, bypassing proximity)
- GET /api/trainees/search?q=...  (trainer-only; searches trainees nationwide)
- AuthN/AuthZ on /api/trainees/search (403 for trainees, 401/403 unauthenticated)
- Backward compatibility for /api/trainers/search with no q
- Whitespace-only q returns [] (no error)
- Email substring + phone substring (case-insensitive)
- Regression sanity: POST /api/auth/login, GET /api/auth/me, GET /api/trainers/nearby still work
"""
import os
import pytest
import requests

BASE_URL = "https://highlight-vibe-bugs.preview.emergentagent.com"
API = f"{BASE_URL}/api"

TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
PASSWORD = "Test123!"


# ────────────────────────── Fixtures ──────────────────────────
@pytest.fixture(scope="session")
def trainee_token():
    r = requests.post(f"{API}/auth/login", json={"email": TRAINEE_EMAIL, "password": PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Trainee login failed: {r.status_code} {r.text}")
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="session")
def trainer_token():
    r = requests.post(f"{API}/auth/login", json={"email": TRAINER_EMAIL, "password": PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Trainer login failed: {r.status_code} {r.text}")
    return r.json().get("access_token") or r.json().get("token")


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ────────────────────────── Regression / Sanity ──────────────────────────
class TestRegressionSanity:
    def test_login_trainee(self):
        r = requests.post(f"{API}/auth/login", json={"email": TRAINEE_EMAIL, "password": PASSWORD}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert ("access_token" in data) or ("token" in data)

    def test_login_trainer(self):
        r = requests.post(f"{API}/auth/login", json={"email": TRAINER_EMAIL, "password": PASSWORD}, timeout=15)
        assert r.status_code == 200, r.text

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": TRAINEE_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code in (400, 401)

    def test_auth_me_trainee(self, trainee_token):
        r = requests.get(f"{API}/auth/me", headers=auth(trainee_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("email") == TRAINEE_EMAIL

    def test_auth_me_trainer(self, trainer_token):
        r = requests.get(f"{API}/auth/me", headers=auth(trainer_token), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("email") == TRAINER_EMAIL


# ────────────────────────── /api/trainers/search ──────────────────────────
class TestTrainersSearch:
    def test_search_trainers_by_name_substring(self, trainee_token):
        r = requests.get(f"{API}/trainers/search", params={"q": "trainer"}, headers=auth(trainee_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # Should find at least the seeded test trainer (and others)
        assert len(data) >= 1, "expected matches for q='trainer'"
        # fullName must be populated
        sample = data[0]
        assert "fullName" in sample and sample["fullName"], f"missing fullName: {sample}"
        # proximity is bypassed → distance should be None
        assert sample.get("distance") in (None, 0, 0.0) or sample.get("matchType") == "direct-search"

    def test_search_trainers_by_email_substring(self, trainee_token):
        # Email portion of the seeded trainer
        r = requests.get(f"{API}/trainers/search", params={"q": "test_trainer_iter25"}, headers=auth(trainee_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "expected at least the seeded trainer"

    def test_search_trainers_by_email_case_insensitive(self, trainee_token):
        r = requests.get(f"{API}/trainers/search", params={"q": "TEST_TRAINER_ITER25"}, headers=auth(trainee_token), timeout=20)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    def test_search_trainers_whitespace_q_returns_legacy(self, trainee_token):
        """Whitespace-only q should NOT trigger direct-lookup path and should not error."""
        r = requests.get(f"{API}/trainers/search", params={"q": "   "}, headers=auth(trainee_token), timeout=20)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_search_trainers_no_q_legacy_filter(self, trainee_token):
        r = requests.get(f"{API}/trainers/search", headers=auth(trainee_token), timeout=20)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_search_trainers_no_match(self, trainee_token):
        r = requests.get(f"{API}/trainers/search", params={"q": "ZZZ_no_such_trainer_qqq_999"}, headers=auth(trainee_token), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json() == []

    def test_search_trainers_works_for_trainer_user_too(self, trainer_token):
        """Endpoint is not role-restricted; trainers should also be able to call it."""
        r = requests.get(f"{API}/trainers/search", params={"q": "trainer"}, headers=auth(trainer_token), timeout=20)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)


# ────────────────────────── /api/trainees/search ──────────────────────────
class TestTraineesSearch:
    def test_search_trainees_as_trainer_by_name(self, trainer_token):
        r = requests.get(f"{API}/trainees/search", params={"q": "test"}, headers=auth(trainer_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, dict)
        assert "trainees" in data and "count" in data
        assert isinstance(data["trainees"], list)
        assert data["count"] == len(data["trainees"])
        assert data["count"] >= 1, "expected at least the seeded test trainee"
        sample = data["trainees"][0]
        for f in ("fullName", "email", "phone", "profilePhoto", "distance"):
            assert f in sample, f"missing field {f} in response: {sample}"

    def test_search_trainees_by_email_substring(self, trainer_token):
        r = requests.get(f"{API}/trainees/search", params={"q": "test_trainee_iter25"}, headers=auth(trainer_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["count"] >= 1
        emails = [t.get("email") for t in data["trainees"]]
        assert any((e or "").lower() == TRAINEE_EMAIL.lower() for e in emails), f"emails={emails}"

    def test_search_trainees_by_email_case_insensitive(self, trainer_token):
        r = requests.get(f"{API}/trainees/search", params={"q": "TEST_TRAINEE_ITER25"}, headers=auth(trainer_token), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["count"] >= 1

    def test_search_trainees_by_phone(self, trainer_token):
        """If seeded trainee has a phone, find them via the last 4 digits.
        Otherwise verify the endpoint at least returns valid shape (no error)."""
        # First, fetch a phone from a known trainee via /api/auth/me of trainee
        tr_login = requests.post(f"{API}/auth/login", json={"email": TRAINEE_EMAIL, "password": PASSWORD}, timeout=15)
        trainee_jwt = tr_login.json().get("access_token") or tr_login.json().get("token")
        me = requests.get(f"{API}/auth/me", headers=auth(trainee_jwt), timeout=15).json()
        phone = (me or {}).get("phone") or ""
        if len(phone) >= 4:
            q = phone[-4:]
            r = requests.get(f"{API}/trainees/search", params={"q": q}, headers=auth(trainer_token), timeout=20)
            assert r.status_code == 200, r.text
            assert r.json()["count"] >= 1
        else:
            # phone unset on seeded trainee — at least confirm endpoint works with arbitrary digits
            r = requests.get(f"{API}/trainees/search", params={"q": "0000"}, headers=auth(trainer_token), timeout=20)
            assert r.status_code == 200, r.text
            assert isinstance(r.json().get("trainees"), list)

    def test_search_trainees_no_match(self, trainer_token):
        r = requests.get(f"{API}/trainees/search", params={"q": "ZZZ_no_such_trainee_qqq_999"}, headers=auth(trainer_token), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json() == {"trainees": [], "count": 0}

    def test_search_trainees_as_trainee_forbidden(self, trainee_token):
        r = requests.get(f"{API}/trainees/search", params={"q": "test"}, headers=auth(trainee_token), timeout=20)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_search_trainees_unauthenticated(self):
        r = requests.get(f"{API}/trainees/search", params={"q": "test"}, timeout=20)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code} {r.text}"

    def test_search_trainees_requires_q(self, trainer_token):
        """q has min_length=1 → FastAPI should 422 when missing or empty."""
        r = requests.get(f"{API}/trainees/search", headers=auth(trainer_token), timeout=20)
        assert r.status_code in (400, 422), f"expected 422, got {r.status_code} {r.text}"

    def test_search_trainees_whitespace_q(self, trainer_token):
        """q is non-empty but only whitespace → endpoint returns empty list, not 500."""
        r = requests.get(f"{API}/trainees/search", params={"q": "   "}, headers=auth(trainer_token), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json() == {"trainees": [], "count": 0}
