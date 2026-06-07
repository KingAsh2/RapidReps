"""iter102aj — Brand-color brightness slider contract.

Locks in the new `accentIntensity` field that the brand-color picker writes
through and that the global glow overlay reads from /api/auth/me.
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


def test_trainer_intensity_round_trip():
    tok, uid = _auth("test_trainer_iter25@test.com", "Test123!")
    # Persist 0.4
    r = httpx.put(
        f"{BASE_URL}/api/trainer-profiles/{uid}/accent-color",
        headers={"Authorization": f"Bearer {tok}"},
        json={"accentColor": "#FF6A00", "accentIntensity": 0.4},
        timeout=10.0,
    )
    assert r.status_code == 200, r.text
    assert r.json()["accentIntensity"] == 0.4
    # Verify via /auth/me (what AccentGlowOverlay reads)
    me = httpx.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=10.0).json()
    assert me.get("accentIntensity") == 0.4
    # Reset to Max
    httpx.put(
        f"{BASE_URL}/api/trainer-profiles/{uid}/accent-color",
        headers={"Authorization": f"Bearer {tok}"},
        json={"accentColor": "#FF6A00", "accentIntensity": 1.0},
        timeout=10.0,
    )


def test_trainee_intensity_round_trip():
    tok, uid = _auth("test_trainee_iter25@test.com", "Test123!")
    r = httpx.put(
        f"{BASE_URL}/api/trainee-profiles/{uid}/accent-color",
        headers={"Authorization": f"Bearer {tok}"},
        json={"accentColor": "#00D68F", "accentIntensity": 0.0},
        timeout=10.0,
    )
    assert r.status_code == 200, r.text
    assert r.json()["accentIntensity"] == 0.0
    me = httpx.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=10.0).json()
    assert me.get("accentIntensity") == 0.0
    # Reset
    httpx.put(
        f"{BASE_URL}/api/trainee-profiles/{uid}/accent-color",
        headers={"Authorization": f"Bearer {tok}"},
        json={"accentColor": "#FF6A00", "accentIntensity": 1.0},
        timeout=10.0,
    )


@pytest.mark.parametrize("bad", [1.5, -0.1, "foo", None])
def test_intensity_validation(bad):
    tok, uid = _auth("test_trainer_iter25@test.com", "Test123!")
    r = httpx.put(
        f"{BASE_URL}/api/trainer-profiles/{uid}/accent-color",
        headers={"Authorization": f"Bearer {tok}"},
        json={"accentColor": "#FF6A00", "accentIntensity": bad},
        timeout=10.0,
    )
    assert r.status_code == 400, f"Expected 400 for {bad!r}, got {r.status_code}: {r.text}"
