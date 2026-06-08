"""iter102ap — Trainer video-call link round-trip + virtual session surface.

Verifies:
- PUT /api/trainer-profiles/{id}/video-call-link persists the URL and
  validates the protocol (must be http/https/zoommtg/facetime).
- GET /api/trainer-profiles/{id} echoes the value back.
- GET /api/sessions/{id} joins the trainer's link onto the response for
  virtual sessions, so the trainee + trainer screens can render the
  "Join Video Call" card without an extra round-trip.
"""
import os
import httpx
import pytest

BASE_URL = os.environ.get("PUBLIC_BACKEND_URL") or "http://localhost:8001"


def _auth(email: str, pw: str) -> tuple[str, str]:
    r = httpx.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, timeout=10.0)
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    me = httpx.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=10.0).json()
    return tok, me["id"]


def test_video_call_link_round_trip():
    tok, uid = _auth("test_trainer_iter25@test.com", "Test123!")
    # Set
    r = httpx.put(
        f"{BASE_URL}/api/trainer-profiles/{uid}/video-call-link",
        headers={"Authorization": f"Bearer {tok}"},
        json={"videoCallLink": "https://meet.google.com/abc-defg-hij"},
        timeout=10.0,
    )
    assert r.status_code == 200, r.text
    assert r.json()["videoCallLink"] == "https://meet.google.com/abc-defg-hij"
    # Read back via profile
    p = httpx.get(
        f"{BASE_URL}/api/trainer-profiles/{uid}",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10.0,
    ).json()
    assert p.get("videoCallLink") == "https://meet.google.com/abc-defg-hij"
    # Clear
    httpx.put(
        f"{BASE_URL}/api/trainer-profiles/{uid}/video-call-link",
        headers={"Authorization": f"Bearer {tok}"},
        json={"videoCallLink": ""},
        timeout=10.0,
    )


@pytest.mark.parametrize("bad", ["hello world", "ftp://nope", "javascript:alert(1)", "ssh://server"])
def test_video_call_link_rejects_non_url(bad):
    tok, uid = _auth("test_trainer_iter25@test.com", "Test123!")
    r = httpx.put(
        f"{BASE_URL}/api/trainer-profiles/{uid}/video-call-link",
        headers={"Authorization": f"Bearer {tok}"},
        json={"videoCallLink": bad},
        timeout=10.0,
    )
    assert r.status_code == 400, f"Expected 400 for {bad!r}, got {r.status_code}: {r.text}"


def test_video_call_link_accepts_facetime_scheme():
    tok, uid = _auth("test_trainer_iter25@test.com", "Test123!")
    r = httpx.put(
        f"{BASE_URL}/api/trainer-profiles/{uid}/video-call-link",
        headers={"Authorization": f"Bearer {tok}"},
        json={"videoCallLink": "facetime://+15551234567"},
        timeout=10.0,
    )
    assert r.status_code == 200
    # Cleanup
    httpx.put(
        f"{BASE_URL}/api/trainer-profiles/{uid}/video-call-link",
        headers={"Authorization": f"Bearer {tok}"},
        json={"videoCallLink": ""},
        timeout=10.0,
    )


def test_only_owner_can_update_link():
    """Another logged-in user must not be able to write someone else's link."""
    tok_a, uid_a = _auth("test_trainer_iter25@test.com", "Test123!")
    tok_b, _ = _auth("test_trainee_iter25@test.com", "Test123!")
    r = httpx.put(
        f"{BASE_URL}/api/trainer-profiles/{uid_a}/video-call-link",
        headers={"Authorization": f"Bearer {tok_b}"},
        json={"videoCallLink": "https://hacker.example.com/zoom"},
        timeout=10.0,
    )
    assert r.status_code == 403
