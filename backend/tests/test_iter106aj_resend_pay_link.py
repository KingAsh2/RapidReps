"""
iter106aj regression — Resend Pay Link endpoint.

Verifies:
  1. Trainer can resend the pay-link notification after acceptance.
  2. 60s cooldown returns HTTP 429.
  3. Cannot resend before acceptance (paymentReady=false).
  4. Trainee cannot use this endpoint (403).
"""
import os
import time
import requests

API = os.environ.get("BACKEND_URL", "http://localhost:8001")
TRAINEE = {"email": "test_trainee_iter25@test.com", "password": "Test123!"}
TRAINER = {"email": "test_trainer_iter25@test.com", "password": "Test123!"}


def _login(c):
    r = requests.post(f"{API}/api/auth/login", json=c, timeout=10)
    r.raise_for_status()
    return r.json()


def _create_and_accept():
    trainee = _login(TRAINEE)
    trainer = _login(TRAINER)
    iso = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() + 7200)) + "Z"
    sid = requests.post(
        f"{API}/api/sessions",
        json={
            "traineeId": trainee["user"]["id"],
            "trainerId": trainer["user"]["id"],
            "sessionDateTimeStart": iso,
            "durationMinutes": 30,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Park",
        },
        headers={"Authorization": f"Bearer {trainee['access_token']}"},
        timeout=15,
    ).json()["id"]
    # Trainer accepts.
    r = requests.post(
        f"{API}/api/sessions/{sid}/negotiation/accept",
        headers={"Authorization": f"Bearer {trainer['access_token']}"},
        timeout=10,
    )
    assert r.status_code == 200
    return sid, trainee, trainer


def test_trainer_resend_succeeds_then_429_on_rapid_retry():
    sid, _trainee, trainer = _create_and_accept()
    h = {"Authorization": f"Bearer {trainer['access_token']}"}

    # First call works.
    r1 = requests.post(f"{API}/api/sessions/{sid}/resend-pay-link", headers=h, timeout=10)
    assert r1.status_code == 200, r1.text
    body = r1.json()
    assert body["success"] is True
    assert body["nextAvailableInSeconds"] == 60

    # Immediately retrying must be rate-limited.
    r2 = requests.post(f"{API}/api/sessions/{sid}/resend-pay-link", headers=h, timeout=10)
    assert r2.status_code == 429
    detail = r2.json().get("detail", "")
    assert "wait" in detail.lower(), f"detail should hint at cooldown: {detail}"


def test_resend_blocked_before_acceptance():
    """If the trainer never accepted, paymentReady is false → 400."""
    trainee = _login(TRAINEE)
    trainer = _login(TRAINER)
    iso = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() + 7200)) + "Z"
    sid = requests.post(
        f"{API}/api/sessions",
        json={
            "traineeId": trainee["user"]["id"],
            "trainerId": trainer["user"]["id"],
            "sessionDateTimeStart": iso,
            "durationMinutes": 30,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Park",
        },
        headers={"Authorization": f"Bearer {trainee['access_token']}"},
        timeout=15,
    ).json()["id"]

    r = requests.post(
        f"{API}/api/sessions/{sid}/resend-pay-link",
        headers={"Authorization": f"Bearer {trainer['access_token']}"},
        timeout=10,
    )
    assert r.status_code == 400
    assert "unlock" in r.json().get("detail", "").lower() or "accept" in r.json().get("detail", "").lower()


def test_trainee_cannot_resend():
    sid, trainee, _trainer = _create_and_accept()
    r = requests.post(
        f"{API}/api/sessions/{sid}/resend-pay-link",
        headers={"Authorization": f"Bearer {trainee['access_token']}"},
        timeout=10,
    )
    assert r.status_code == 403
