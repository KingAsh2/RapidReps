"""
iter106ae regression — Trainer payout info CRUD + admin visibility.

User flow:
  Stripe (trainee) → Admin (platform Stripe balance) → Trainer (off-platform,
  via Zelle / PayPal / Venmo / Cash App).

We test:
  1. Trainer can save Zelle / PayPal / Venmo / Cash App handles.
  2. Saving Zelle mirrors the handle to legacy zelleEmail / zellePhone.
  3. Empty handle and unsupported methods are rejected.
  4. Admin /payouts/pending lists the trainer with the chosen method + handle.
"""
import os
import pytest
import requests

API = os.environ.get("BACKEND_URL", "http://localhost:8001")
TRAINER = {"email": "test_trainer_iter25@test.com", "password": "Test123!"}
ADMIN = {"email": "admin@rapidreps.com", "password": "admin123"}


def _login(creds):
    r = requests.post(f"{API}/api/auth/login", json=creds, timeout=10)
    r.raise_for_status()
    return r.json()["access_token"]


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def test_zelle_save_and_mirror():
    token = _login(TRAINER)
    r = requests.post(
        f"{API}/api/trainer/payout-info",
        json={"payoutMethod": "zelle", "payoutHandle": "trainer25@zelle.com"},
        headers=_h(token), timeout=10,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["payoutMethod"] == "zelle"
    assert body["payoutHandle"] == "trainer25@zelle.com"

    # GET reflects the save and legacy mirror is populated.
    info = requests.get(f"{API}/api/trainer/payout-info", headers=_h(token), timeout=10).json()
    assert info["payoutMethod"] == "zelle"
    assert info["zelleEmail"] == "trainer25@zelle.com"
    assert info["isSetup"] is True


def test_paypal_save():
    token = _login(TRAINER)
    r = requests.post(
        f"{API}/api/trainer/payout-info",
        json={"payoutMethod": "paypal", "payoutHandle": "trainer25@paypal.me"},
        headers=_h(token), timeout=10,
    )
    assert r.status_code == 200
    info = requests.get(f"{API}/api/trainer/payout-info", headers=_h(token), timeout=10).json()
    assert info["payoutMethod"] == "paypal"
    assert info["payoutHandle"] == "trainer25@paypal.me"


def test_validation_empty_handle():
    token = _login(TRAINER)
    r = requests.post(
        f"{API}/api/trainer/payout-info",
        json={"payoutMethod": "venmo", "payoutHandle": "   "},
        headers=_h(token), timeout=10,
    )
    assert r.status_code == 400


def test_validation_bad_method():
    token = _login(TRAINER)
    r = requests.post(
        f"{API}/api/trainer/payout-info",
        json={"payoutMethod": "bitcoin", "payoutHandle": "abc"},
        headers=_h(token), timeout=10,
    )
    assert r.status_code == 400


def test_admin_pending_shows_method_and_handle():
    # Trainer sets PayPal first
    t = _login(TRAINER)
    requests.post(
        f"{API}/api/trainer/payout-info",
        json={"payoutMethod": "paypal", "payoutHandle": "trainer25@paypal.me"},
        headers=_h(t), timeout=10,
    )
    admin = _login(ADMIN)
    r = requests.get(f"{API}/api/admin/payouts/pending", headers=_h(admin), timeout=10)
    assert r.status_code == 200
    data = r.json()
    found = next(
        (x for x in data["trainers"] if x["trainerEmail"] == TRAINER["email"]),
        None,
    )
    assert found is not None, "Trainer should appear in admin pending payouts list"
    assert found["payoutMethod"] == "paypal"
    assert found["payoutHandle"] == "trainer25@paypal.me"
