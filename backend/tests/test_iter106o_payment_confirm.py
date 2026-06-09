"""iter106o — Regression test for /api/payments/sessions/confirm.

The PaymentSheet flow is native-only (Stripe iOS/Android SDK) so we can't
hit the actual UI from a test, but we can verify the server-side hook that
the SDK calls after a successful payment. Covers auth, validation, and
the corporate fully-subsidised shortcut path (no Stripe call required).
"""
import os
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId

API = "http://localhost:8001"
TRAINEE = ("test_trainee_iter25@test.com", "Test123!")
TRAINER = ("test_trainer_iter25@test.com", "Test123!")


def _login(email, pw):
    r = requests.post(f"{API}/api/auth/login", json={"email": email, "password": pw}, timeout=10)
    r.raise_for_status()
    return r.json()["access_token"], r.json()["user"]["id"]


@pytest.fixture(scope="module")
def ctx():
    trainee_tok, trainee_id = _login(*TRAINEE)
    trainer_tok, trainer_id = _login(*TRAINER)
    m = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = m[os.environ.get("DB_NAME", "rapidreps")]
    doc = db.sessions.find_one({"trainerId": trainer_id, "traineeId": trainee_id})
    if not doc:
        res = db.sessions.insert_one({
            "trainerId": trainer_id, "traineeId": trainee_id,
            "status": "confirmed", "sessionType": "outdoor",
        })
        sid = str(res.inserted_id)
    else:
        sid = str(doc["_id"])
    return {"trainee_tok": trainee_tok, "trainer_tok": trainer_tok, "sid": sid, "db": db}


def test_unauth_rejected(ctx):
    r = requests.post(f"{API}/api/payments/sessions/confirm", json={}, timeout=8)
    assert r.status_code in (401, 403)


def test_missing_fields(ctx):
    r = requests.post(f"{API}/api/payments/sessions/confirm",
                      headers={"Authorization": f"Bearer {ctx['trainee_tok']}"}, json={}, timeout=8)
    assert r.status_code == 400
    assert "required" in r.json()["detail"].lower()


def test_invalid_session_id(ctx):
    r = requests.post(f"{API}/api/payments/sessions/confirm",
                      headers={"Authorization": f"Bearer {ctx['trainee_tok']}"},
                      json={"sessionId": "garbage", "paymentIntentId": "pi_x"}, timeout=8)
    assert r.status_code == 400
    assert "invalid session" in r.json()["detail"].lower()


def test_session_not_found(ctx):
    r = requests.post(f"{API}/api/payments/sessions/confirm",
                      headers={"Authorization": f"Bearer {ctx['trainee_tok']}"},
                      json={"sessionId": "000000000000000000000000", "paymentIntentId": "pi_x"}, timeout=8)
    assert r.status_code == 404


def test_only_trainee_can_confirm(ctx):
    """The trainer side must not be allowed to confirm payment on behalf of the trainee."""
    r = requests.post(f"{API}/api/payments/sessions/confirm",
                      headers={"Authorization": f"Bearer {ctx['trainer_tok']}"},
                      json={"sessionId": ctx["sid"], "paymentIntentId": "pi_x"}, timeout=8)
    assert r.status_code == 403


def test_corporate_subsidy_shortcut(ctx):
    """If paymentIntentId starts with 'corp_full_subsidy_' the endpoint marks
    the session paid WITHOUT hitting Stripe — this is the corporate path
    where the customer total is $0."""
    r = requests.post(f"{API}/api/payments/sessions/confirm",
                      headers={"Authorization": f"Bearer {ctx['trainee_tok']}"},
                      json={"sessionId": ctx["sid"], "paymentIntentId": "corp_full_subsidy_test_123"},
                      timeout=8)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "paid"
    assert body["method"] == "corporate_subsidy"
    # And the session doc reflects it
    doc = ctx["db"].sessions.find_one({"_id": ObjectId(ctx["sid"])})
    assert doc.get("paymentStatus") == "paid"
    assert doc.get("paymentMethod") == "corporate_subsidy"
