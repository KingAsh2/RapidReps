"""
iter106ah regression — trainer should be able to ACCEPT a session right away.

Before this fix the backend only persisted the booking (`status='requested'`)
but did NOT seed the negotiation state, so the trainer-side NegotiationPanel
saw no proposal and only rendered the "Propose" button — there was literally
no way to accept the trainee's request as-is.

After the fix:
  POST /api/sessions  →  session.negotiationStatus == 'proposed_by_trainee'
  GET  /api/sessions/{id}/negotiation/timeline  →  proposedTime, proposedLocation
  POST /api/sessions/{id}/negotiation/accept (as trainer) → status agreed, paymentReady
"""
import os
import time
import pytest
import requests

API = os.environ.get("BACKEND_URL", "http://localhost:8001")
TRAINEE = {"email": "test_trainee_iter25@test.com", "password": "Test123!"}
TRAINER = {"email": "test_trainer_iter25@test.com", "password": "Test123!"}


def _login(c):
    r = requests.post(f"{API}/api/auth/login", json=c, timeout=10)
    r.raise_for_status()
    return r.json()


def _create_session(trainee_token, trainee_id, trainer_id):
    # Schedule 2 hrs out so it's >1 hr in the future (some routes enforce that).
    iso = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() + 7200)) + "Z"
    payload = {
        "traineeId": trainee_id,
        "trainerId": trainer_id,
        "sessionDateTimeStart": iso,
        "durationMinutes": 30,
        "sessionType": "outdoor",
        "locationType": "outdoor",
        "locationNameOrAddress": "Central Park, NYC",
        "traineeLocalDate": "Tomorrow",
        "traineeLocalTime": "8:00 AM",
        "notes": "iter106ah regression",
    }
    r = requests.post(
        f"{API}/api/sessions",
        json=payload,
        headers={"Authorization": f"Bearer {trainee_token}"},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


def test_new_session_seeds_negotiation_proposed_by_trainee():
    trainee = _login(TRAINEE)
    trainer = _login(TRAINER)
    s = _create_session(trainee["access_token"], trainee["user"]["id"], trainer["user"]["id"])
    sid = s["id"]

    # Trainer-side fetch sees the negotiation already seeded.
    r = requests.get(
        f"{API}/api/sessions/{sid}/negotiation/timeline",
        headers={"Authorization": f"Bearer {trainer['access_token']}"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    tl = r.json()
    assert tl.get("negotiationStatus") == "proposed_by_trainee"
    assert tl.get("proposedTime"), "Trainee's chosen time must be the initial proposal"
    # Location should be carried over for outdoor sessions.
    assert (tl.get("proposedLocation") or {}).get("address") == "Central Park, NYC"


def test_trainer_can_accept_seeded_proposal_directly():
    """Trainer hits Accept (after the new confirmation modal) → status flips
    to agreed and paymentReady=True so the trainee can pay."""
    trainee = _login(TRAINEE)
    trainer = _login(TRAINER)
    s = _create_session(trainee["access_token"], trainee["user"]["id"], trainer["user"]["id"])
    sid = s["id"]

    r = requests.post(
        f"{API}/api/sessions/{sid}/negotiation/accept",
        headers={"Authorization": f"Bearer {trainer['access_token']}"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # Accept endpoint returns `status` (not `negotiationStatus`) — both fields
    # refer to the same value.
    assert body.get("status") == "agreed"
    assert body.get("agreedTime"), "agreedTime should be present after accept"


def test_session_persists_trainee_local_time_for_timezone_safety():
    """Server stores `traineeLocalDate` + `traineeLocalTime` so the trainer
    can render the trainee's exact wall-clock time without timezone drift."""
    trainee = _login(TRAINEE)
    trainer = _login(TRAINER)
    s = _create_session(trainee["access_token"], trainee["user"]["id"], trainer["user"]["id"])

    r = requests.get(
        f"{API}/api/sessions/{s['id']}",
        headers={"Authorization": f"Bearer {trainer['access_token']}"},
        timeout=10,
    )
    assert r.status_code == 200
    body = r.json()
    assert body.get("traineeLocalDate") == "Tomorrow"
    assert body.get("traineeLocalTime") == "8:00 AM"
