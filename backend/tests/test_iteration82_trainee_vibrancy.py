"""Iteration 82 — Trainee Profile Vibrancy Parity Tests.

Verifies that trainee profiles now have feature parity with trainer profiles for
showcase fields (vibe music, accent color, bio, highlight reel).

Covers:
- PUT/DELETE /api/trainee-profiles/{id}/vibe
- PUT /api/trainee-profiles/{id}/accent-color (with validation)
- PUT /api/trainee-profiles/{id}/bio
- POST/GET/DELETE /api/trainee-profiles/{id}/highlights (base64 path)
- GET /api/trainee-profiles/{id} surfaces all new showcase keys
- Cross-user 403 enforcement
"""
import base64
import os

import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://highlight-vibe-bugs.preview.emergentagent.com').rstrip('/')

TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASS = "Test123!"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASS = "Test123!"

TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)


def _login(email: str, password: str) -> dict:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login {email} failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def trainee_session():
    data = _login(TRAINEE_EMAIL, TRAINEE_PASS)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"})
    user_id = data["user"]["id"]
    return s, user_id


@pytest.fixture(scope="module")
def trainer_session():
    data = _login(TRAINER_EMAIL, TRAINER_PASS)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"})
    user_id = data["user"]["id"]
    return s, user_id


def test_vibe_set_clear(trainee_session):
    s, user_id = trainee_session
    # Set
    r = s.put(
        f"{BASE_URL}/api/trainee-profiles/{user_id}/vibe",
        json={
            "vibeTrackTitle": "Lose Yourself",
            "vibeArtistName": "Eminem",
            "vibeTrackId": "iter82-track-1",
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True
    assert body["vibeTrackTitle"] == "Lose Yourself"

    # GET shows it
    r = requests.get(f"{BASE_URL}/api/trainee-profiles/{user_id}", timeout=30)
    assert r.status_code == 200
    assert r.json()["vibeTrackTitle"] == "Lose Yourself"

    # Clear
    r = s.delete(f"{BASE_URL}/api/trainee-profiles/{user_id}/vibe", timeout=30)
    assert r.status_code == 200
    r = requests.get(f"{BASE_URL}/api/trainee-profiles/{user_id}", timeout=30)
    assert r.json()["vibeTrackTitle"] is None


def test_accent_color_valid_and_invalid(trainee_session):
    s, user_id = trainee_session
    # Valid
    r = s.put(
        f"{BASE_URL}/api/trainee-profiles/{user_id}/accent-color",
        json={"accentColor": "#6C5CE7"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    assert r.json()["accentColor"] == "#6C5CE7"

    # Invalid
    r = s.put(
        f"{BASE_URL}/api/trainee-profiles/{user_id}/accent-color",
        json={"accentColor": "#NOTAHEX"},
        timeout=30,
    )
    assert r.status_code == 400


def test_bio_update(trainee_session):
    s, user_id = trainee_session
    r = s.put(
        f"{BASE_URL}/api/trainee-profiles/{user_id}/bio",
        json={"bio": "Marathon runner. Strength training newbie."},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    assert "Marathon runner" in r.json()["bio"]
    # GET shows it
    r = requests.get(f"{BASE_URL}/api/trainee-profiles/{user_id}", timeout=30)
    assert "Marathon runner" in r.json()["bio"]


def test_highlights_base64_lifecycle(trainee_session):
    s, user_id = trainee_session
    # Snapshot existing count, then upload one and verify count grew by 1.
    r = requests.get(f"{BASE_URL}/api/trainee-profiles/{user_id}/highlights", timeout=30)
    initial = r.json().get("highlights", [])
    initial_count = len(initial)

    # Upload
    r = s.post(
        f"{BASE_URL}/api/trainee-profiles/{user_id}/highlights/base64",
        json={
            "data": TINY_PNG_B64,
            "filename": "iter82-test.png",
            "contentType": "image/png",
            "caption": "PR day",
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    hl = r.json()["highlight"]
    assert hl["type"] == "photo"
    assert hl["caption"] == "PR day"
    assert hl["url"].startswith("/api/files/")

    # GET shows new one
    r = requests.get(f"{BASE_URL}/api/trainee-profiles/{user_id}/highlights", timeout=30)
    after = r.json().get("highlights", [])
    assert len(after) == initial_count + 1, f"Expected {initial_count + 1}, got {len(after)}"
    assert any(h.get("caption") == "PR day" for h in after)

    # DELETE (last index = our just-uploaded one)
    new_index = len(after) - 1
    r = s.delete(f"{BASE_URL}/api/trainee-profiles/{user_id}/highlights/{new_index}", timeout=30)
    assert r.status_code == 200

    # Verify count reverted
    r = requests.get(f"{BASE_URL}/api/trainee-profiles/{user_id}/highlights", timeout=30)
    assert len(r.json().get("highlights", [])) == initial_count


def test_profile_response_surfaces_showcase_keys(trainee_session):
    s, user_id = trainee_session
    r = requests.get(f"{BASE_URL}/api/trainee-profiles/{user_id}", timeout=30)
    assert r.status_code == 200
    body = r.json()
    required_keys = [
        "bio",
        "vibeTrackTitle",
        "vibeArtistName",
        "vibeArtworkUrl",
        "vibePreviewUrl",
        "vibeAppleMusicUrl",
        "vibeTrackId",
        "accentColor",
        "accentColorAuto",
        "highlights",
        "personalityTag",
    ]
    for key in required_keys:
        assert key in body, f"TraineeProfileResponse missing showcase key: {key}"


def test_cross_user_vibe_update_blocked(trainee_session, trainer_session):
    """Trainee with their token cannot update another user's vibe."""
    s, _ = trainee_session
    _, trainer_id = trainer_session
    r = s.put(
        f"{BASE_URL}/api/trainee-profiles/{trainer_id}/vibe",
        json={"vibeTrackTitle": "Pwned"},
        timeout=30,
    )
    assert r.status_code == 403


def test_cross_user_highlight_upload_blocked(trainee_session, trainer_session):
    s, _ = trainee_session
    _, trainer_id = trainer_session
    r = s.post(
        f"{BASE_URL}/api/trainee-profiles/{trainer_id}/highlights/base64",
        json={
            "data": TINY_PNG_B64,
            "filename": "evil.png",
            "contentType": "image/png",
            "caption": "pwn",
        },
        timeout=30,
    )
    assert r.status_code == 403
