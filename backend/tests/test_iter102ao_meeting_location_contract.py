"""iter102ao — Meeting-location surface contract.

The trainer's session-detail screen reads three fields off the SessionResponse
to render the meeting location:
- `locationNameOrAddress` (initial trainee-supplied value at booking)
- `outdoorLocationTrainerProposal` (trainer-proposed alternative)
- `outdoorLocationAgreed` (boolean confirming both sides accepted)

Pydantic strips unknown fields, so these MUST be declared on SessionResponse
or the trainer UI ends up blind for outdoor bookings — which was the exact
production bug we just fixed.
"""
import os
import httpx

BASE_URL = os.environ.get("PUBLIC_BACKEND_URL") or "http://localhost:8001"


def _login(email: str, pw: str) -> str:
    r = httpx.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, timeout=10.0)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_trainee_sessions_surface_outdoor_location_fields():
    tok = _login("test_trainee_iter25@test.com", "Test123!")
    r = httpx.get(
        f"{BASE_URL}/api/trainee/sessions",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10.0,
    )
    assert r.status_code == 200, r.text
    sessions = r.json()
    if not sessions:
        return  # nothing to assert against
    s = sessions[0]
    # The three location keys MUST be present (None is fine, missing is not).
    assert "locationNameOrAddress" in s
    assert "outdoorLocationAgreed" in s
    assert "outdoorLocationTrainerProposal" in s


def test_trainer_sessions_surface_outdoor_location_fields():
    tok = _login("test_trainer_iter25@test.com", "Test123!")
    r = httpx.get(
        f"{BASE_URL}/api/trainer/sessions",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10.0,
    )
    assert r.status_code == 200, r.text
    sessions = r.json()
    if not sessions:
        return
    s = sessions[0]
    assert "locationNameOrAddress" in s
    assert "outdoorLocationAgreed" in s
    assert "outdoorLocationTrainerProposal" in s
