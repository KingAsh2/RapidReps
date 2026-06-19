"""
iter106ai regression — when the trainer accepts the trainee's proposal, a
"session_accepted" notification with `action: pay` and a `trainee/payment...
&autoPay=1` deep-link must land on the trainee's feed. The frontend reads
`autoPay=1` and opens the Stripe sheet on land → one tap from notification
to pay sheet.
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


def _create_session(trainee, trainer):
    iso = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() + 7200)) + "Z"
    r = requests.post(
        f"{API}/api/sessions",
        json={
            "traineeId": trainee["user"]["id"],
            "trainerId": trainer["user"]["id"],
            "sessionDateTimeStart": iso,
            "durationMinutes": 30,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Central Park",
        },
        headers={"Authorization": f"Bearer {trainee['access_token']}"},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["id"]


def test_trainer_accept_fires_pay_notification_to_trainee():
    trainee = _login(TRAINEE)
    trainer = _login(TRAINER)
    sid = _create_session(trainee, trainer)

    # Trainer accepts the trainee's initial proposal.
    r = requests.post(
        f"{API}/api/sessions/{sid}/negotiation/accept",
        headers={"Authorization": f"Bearer {trainer['access_token']}"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "agreed"

    # Give the asyncio task a moment to flush the notification.
    time.sleep(1.2)

    nf = requests.get(
        f"{API}/api/notifications?limit=10",
        headers={"Authorization": f"Bearer {trainee['access_token']}"},
        timeout=10,
    )
    assert nf.status_code == 200
    payload = nf.json()
    notifs = payload.get("notifications", payload if isinstance(payload, list) else [])

    pay_notif = next(
        (
            n for n in notifs
            if n.get("type") == "session_accepted"
            and (n.get("data") or {}).get("sessionId") == sid
        ),
        None,
    )
    assert pay_notif, "Trainee should receive a session_accepted notification on trainer accept"
    data = pay_notif.get("data") or {}
    assert data.get("action") == "pay", "Deep-link must signal `action=pay` to auto-open Stripe"
    assert data.get("screen", "").startswith("trainee/payment?sessionId="), (
        "Deep-link should target the dedicated payment screen, not session-detail"
    )
    assert "autoPay=1" in data.get("screen", ""), (
        "autoPay=1 is what triggers the Stripe sheet to open on land"
    )
