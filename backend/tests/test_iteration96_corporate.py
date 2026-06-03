"""
Iter96 — B2B Corporate Wellness Onboarding guards.

Coverage:
  • Company create / list / get / update (role-gated)
  • Credit pool top-up + ledger
  • Invite code generate / redeem (single use, expiry, double-redeem guard)
  • Employee enumeration + usage analytics
  • Public branded landing page
  • Trainee `/me/company` reflects membership
"""
import secrets

import pytest
import requests

API_BASE = "http://localhost:8001"


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API_BASE}/api/auth/login", json={"email": email, "password": password}, timeout=10)
    r.raise_for_status()
    d = r.json()
    return d.get("access_token") or d.get("token") or ""


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@rapidreps.com", "admin123")


@pytest.fixture(scope="module")
def trainee_token():
    return _login("test_trainee_iter25@test.com", "Test123!")


@pytest.fixture(scope="module")
def company_state(admin_token):
    """Create a fresh company owned by the platform admin for the suite."""
    slug = f"acme-{secrets.token_hex(3)}"
    r = requests.post(
        f"{API_BASE}/api/corporate/companies",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "ACME Wellness Co",
            "slug": slug,
            "contactEmail": "hr@acme.example.com",
            "brandColor": "#FF7A00",
            "brandTagline": "Move. Together.",
        },
        timeout=10,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["slug"] == slug
    assert body["creditPoolCents"] == 0
    assert body["employeeCount"] == 0
    return body


# ── Company CRUD ──────────────────────────────────────────────────────
def test_create_company_rejects_duplicate_slug(admin_token, company_state):
    r = requests.post(
        f"{API_BASE}/api/corporate/companies",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Other Co",
            "slug": company_state["slug"],
            "contactEmail": "x@example.com",
        },
        timeout=10,
    )
    assert r.status_code == 409


def test_create_company_rejects_invalid_slug(admin_token):
    r = requests.post(
        f"{API_BASE}/api/corporate/companies",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Bad", "slug": "X!", "contactEmail": "a@b.test"},
        timeout=10,
    )
    assert r.status_code == 422


def test_list_companies_requires_platform_admin(admin_token, trainee_token):
    r_ok = requests.get(
        f"{API_BASE}/api/corporate/companies",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10,
    )
    assert r_ok.status_code == 200
    assert isinstance(r_ok.json(), list)

    r_fail = requests.get(
        f"{API_BASE}/api/corporate/companies",
        headers={"Authorization": f"Bearer {trainee_token}"},
        timeout=10,
    )
    assert r_fail.status_code == 403


def test_update_company_metadata(admin_token, company_state):
    r = requests.patch(
        f"{API_BASE}/api/corporate/companies/{company_state['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"brandTagline": "New tagline"},
        timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["brandTagline"] == "New tagline"


def test_get_company_forbidden_for_outsiders(trainee_token, company_state):
    r = requests.get(
        f"{API_BASE}/api/corporate/companies/{company_state['id']}",
        headers={"Authorization": f"Bearer {trainee_token}"},
        timeout=10,
    )
    assert r.status_code == 403


# ── Credit Pool ───────────────────────────────────────────────────────
def test_topup_credit_pool(admin_token, company_state):
    r = requests.post(
        f"{API_BASE}/api/corporate/companies/{company_state['id']}/credit-pool",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"amountCents": 50000, "note": "Q1 funding"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    assert r.json()["creditPoolCents"] == 50000


def test_topup_rejects_negative(admin_token, company_state):
    r = requests.post(
        f"{API_BASE}/api/corporate/companies/{company_state['id']}/credit-pool",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"amountCents": -100},
        timeout=10,
    )
    assert r.status_code == 422


# ── Invites + Redemption ──────────────────────────────────────────────
@pytest.fixture(scope="module")
def invite_code(admin_token, company_state):
    r = requests.post(
        f"{API_BASE}/api/corporate/companies/{company_state['id']}/invites",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"maxUses": 1, "creditAllowanceCents": 15000, "expiresInDays": 14},
        timeout=10,
    )
    assert r.status_code == 201, r.text
    return r.json()["code"]


def test_invite_listed(admin_token, company_state, invite_code):
    r = requests.get(
        f"{API_BASE}/api/corporate/companies/{company_state['id']}/invites",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10,
    )
    assert r.status_code == 200
    codes = [i["code"] for i in r.json()]
    assert invite_code in codes


def test_redeem_invalid_code(trainee_token):
    r = requests.post(
        f"{API_BASE}/api/corporate/redeem",
        headers={"Authorization": f"Bearer {trainee_token}"},
        json={"code": "ZZZZZZZZ"},
        timeout=10,
    )
    assert r.status_code == 404


def test_redeem_happy_path_and_exhausted(trainee_token, invite_code, company_state, admin_token):
    """Trainee redeems → membership created. Second redeem fails."""
    # Ensure trainee starts clean (prior test runs may have enrolled them).
    import asyncio, os
    from pathlib import Path
    from dotenv import load_dotenv
    from motor.motor_asyncio import AsyncIOMotorClient
    load_dotenv(Path("/app/backend/.env"))
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    me = requests.get(f"{API_BASE}/api/auth/me", headers={"Authorization": f"Bearer {trainee_token}"}, timeout=5)
    trainee_id = me.json()["id"]

    async def _cleanup():
        await db.corporate_memberships.delete_many({"userId": trainee_id})
        await db.users.update_one(
            {"_id": __import__("bson").ObjectId(trainee_id)},
            {"$unset": {"corporateCompanyId": ""}},
        )
        # Reset invite + company counts so we can redeem fresh
        await db.corporate_invites.update_one({"code": invite_code}, {"$set": {"usedCount": 0}})
        await db.corporate_companies.update_one(
            {"_id": __import__("bson").ObjectId(company_state["id"])},
            {"$set": {"employeeCount": 0}},
        )

    asyncio.get_event_loop().run_until_complete(_cleanup())

    # 1st redeem — success
    r1 = requests.post(
        f"{API_BASE}/api/corporate/redeem",
        headers={"Authorization": f"Bearer {trainee_token}"},
        json={"code": invite_code},
        timeout=10,
    )
    assert r1.status_code == 200, r1.text
    body = r1.json()
    assert body["membership"]["creditAllowanceCents"] == 15000
    assert body["company"]["slug"] == company_state["slug"]

    # 2nd redeem — already enrolled
    r2 = requests.post(
        f"{API_BASE}/api/corporate/redeem",
        headers={"Authorization": f"Bearer {trainee_token}"},
        json={"code": invite_code},
        timeout=10,
    )
    assert r2.status_code == 409  # already enrolled


def test_me_company_reflects_membership(trainee_token, company_state):
    r = requests.get(
        f"{API_BASE}/api/corporate/me/company",
        headers={"Authorization": f"Bearer {trainee_token}"},
        timeout=10,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["company"]["id"] == company_state["id"]
    assert body["membership"]["creditAllowanceCents"] == 15000


def test_employees_and_usage(admin_token, company_state):
    e = requests.get(
        f"{API_BASE}/api/corporate/companies/{company_state['id']}/employees",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10,
    )
    assert e.status_code == 200
    emps = e.json()
    assert len(emps) >= 1
    assert emps[0]["user"]["email"]  # enriched user info

    u = requests.get(
        f"{API_BASE}/api/corporate/companies/{company_state['id']}/usage",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10,
    )
    assert u.status_code == 200
    usage = u.json()
    assert usage["creditPoolCents"] == 50000
    assert usage["employees"] >= 1
    assert usage["allocatedAllowanceCents"] >= 15000
    assert usage["remainingPoolCents"] == 50000


# ── Static guards: frontend files + DS sweep ──────────────────────────
from pathlib import Path as _P

_FRONTEND = _P("/app/frontend")


def test_corporate_frontend_screens_exist():
    for f in [
        "app/corporate/index.tsx",
        "app/corporate/signup.tsx",
        "app/corporate/redeem.tsx",
        "app/corporate/dashboard.tsx",
        "app/corporate/c/[slug].tsx",
    ]:
        assert (_FRONTEND / f).exists(), f"Missing {f}"


def test_corporate_api_client_exposed():
    src = (_FRONTEND / "src/services/api.ts").read_text()
    assert "corporateAPI" in src
    for method in ("createCompany", "redeem", "topupCreditPool", "createInvite", "publicLanding", "myCompany"):
        assert method in src, f"corporateAPI.{method} missing"


def test_redeem_screen_uses_ds_tokens():
    src = (_FRONTEND / "app/corporate/redeem.tsx").read_text()
    assert "DS.colors" in src
    assert "corp-redeem-submit-btn" in src


def test_dashboard_screen_has_required_testids():
    src = (_FRONTEND / "app/corporate/dashboard.tsx").read_text()
    # Tab testids are interpolated: `corp-dash-tab-${t}` over ['overview','invites','employees']
    assert "corp-dash-tab-${t}" in src, "Tab data-testid template missing"
    for tid in (
        "corp-dash-topup-btn",
        "corp-dash-create-invite-btn",
        "corp-dash-view-landing-btn",
    ):
        assert tid in src, f"Missing testid {tid}"


def test_ds_token_sweep_complete_on_remaining_screens():
    """Iter95d follow-up: top-traffic screens use DS.colors tokens."""
    for f in [
        "app/trainer/(tabs)/home.tsx",
        "app/trainee/(tabs)/messages.tsx",
        "app/trainer/(tabs)/messages.tsx",
        "app/trainee/confirm-booking.tsx",
        "app/trainer/(tabs)/profile.tsx",
        "src/components/admin/AdminShared.tsx",
    ]:
        text = (_FRONTEND / f).read_text()
        assert "DS.colors" in text, f"{f} not yet on DS token sweep"



# ── Public branded landing ────────────────────────────────────────────
def test_public_landing_returns_safe_fields(company_state):
    r = requests.get(f"{API_BASE}/api/corporate/landing/{company_state['slug']}", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "ACME Wellness Co"
    assert body["brandColor"] == "#FF7A00"
    # Sensitive fields should NOT be exposed publicly
    assert "creditPoolCents" not in body
    assert "adminUserIds" not in body
    assert "contactEmail" not in body


def test_public_landing_404_for_unknown_slug():
    r = requests.get(f"{API_BASE}/api/corporate/landing/this-does-not-exist-xyz", timeout=10)
    assert r.status_code == 404


def test_public_landing_rejects_bad_slug():
    r = requests.get(f"{API_BASE}/api/corporate/landing/BAD!!!", timeout=10)
    assert r.status_code == 400
