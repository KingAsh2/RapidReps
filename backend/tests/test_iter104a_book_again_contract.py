"""
iter104a — "Book Again" one-tap CTA backend contract.

This iteration adds a frontend CTA on the trainee's session-detail screen that
deep-links to /trainee/trainer-detail?trainerId=...&repeat=1&dur=...&type=...
&loc=... so the booking card opens with the trainer's last-used modality,
duration, and location pre-filled. Two-tap repeat booking.

The CTA itself is frontend, but the backend MUST keep its session creation
contract stable across the params it forwards. We assert that the same
session-create payload that powered the original session still works when
re-played by the "Book Again" flow.
"""
import os
import sys
from pathlib import Path

import httpx
import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8001")
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
PASSWORD = "Test123!"


def _login(email):
    r = httpx.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": PASSWORD},
        timeout=15.0,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    return body["access_token"], body["user"]["id"]


@pytest.fixture(scope="module")
def trainee_auth():
    tok, uid = _login(TRAINEE_EMAIL)
    return {"headers": {"Authorization": f"Bearer {tok}"}, "user_id": uid}


@pytest.fixture(scope="module")
def trainer_auth():
    tok, uid = _login(TRAINER_EMAIL)
    return {"headers": {"Authorization": f"Bearer {tok}"}, "user_id": uid}


def test_book_again_payload_is_accepted(trainee_auth, trainer_auth):
    """The repeat-booking payload is just a regular create-session payload —
    pre-filled with the prior session's dur/type/loc. This test re-plays
    that payload to verify the contract didn't drift."""
    payload = {
        "traineeId": trainee_auth["user_id"],
        "trainerId": trainer_auth["user_id"],
        "sessionDateTimeStart": "2027-01-15T10:00:00Z",
        "durationMinutes": 60,
        "sessionType": "outdoor",
        "locationType": "outdoor",
        "locationNameOrAddress": "Central Park, NYC",
    }
    r = httpx.post(
        f"{BASE_URL}/api/sessions",
        json=payload,
        headers=trainee_auth["headers"],
        timeout=15.0,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # Deferred-payment contract preserved
    assert body.get("status") == "requested"
    assert not body.get("paymentReady"), "Book-Again must still defer payment"
    # Cleanup
    sid = body.get("id")
    if sid:
        httpx.delete(
            f"{BASE_URL}/api/sessions/{sid}",
            headers=trainee_auth["headers"],
            timeout=15.0,
        )
