"""iter98a: Tests for the premium admin dashboard endpoints — added KPIs,
recent-sessions feed, and CSV export sorted by trainer."""
import os
import pytest
import httpx

BASE_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    with httpx.Client(base_url=BASE_URL, timeout=30) as c:
        r = c.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        body = r.json()
        return body.get("access_token") or body.get("token")


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


def test_dashboard_returns_new_kpi_fields(admin_token):
    """Dashboard should expose all new premium KPI fields."""
    with httpx.Client(base_url=BASE_URL, timeout=30) as c:
        r = c.get("/api/admin/dashboard", headers=_auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    # New fields from iter98a
    for f in [
        "avgSessionValueCents",
        "sessionsThisMonth",
        "monthRevenueCents",
        "monthPlatformRevenueCents",
        "corporatePoolTotalCents",
        "corporatePoolSpentCents",
        "corporatePoolRemainingCents",
        "corporateCompaniesCount",
        "commissionRevenueCents",
    ]:
        assert f in data, f"missing field {f}"
    # Sanity
    assert data["corporatePoolRemainingCents"] >= 0
    assert data["commissionRevenueCents"] >= 0


def test_recent_sessions_endpoint(admin_token):
    with httpx.Client(base_url=BASE_URL, timeout=30) as c:
        r = c.get("/api/admin/recent-sessions?limit=5", headers=_auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert "sessions" in data and isinstance(data["sessions"], list)
    assert "count" in data
    if data["sessions"]:
        first = data["sessions"][0]
        for f in ["id", "trainerName", "traineeName", "finalSessionPriceCents", "platformFeeCents", "trainerEarningsCents"]:
            assert f in first, f"missing recent-session field {f}"


def test_csv_export_this_month(admin_token):
    with httpx.Client(base_url=BASE_URL, timeout=30) as c:
        r = c.get("/api/admin/payments/csv-export?period=this_month", headers=_auth(admin_token))
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    body = r.text
    # First line is header
    header = body.splitlines()[0]
    for col in ["Trainer Name", "Session Date", "Customer", "Gross", "Commission %", "Service Fee", "Trainer Payout", "Corporate Subsidy", "Stripe Intent ID", "Status"]:
        assert col in header, f"CSV header missing column: {col}"


def test_csv_export_sorted_by_trainer(admin_token):
    """Rows must be sorted alphabetically by trainer name (case-insensitive)."""
    with httpx.Client(base_url=BASE_URL, timeout=30) as c:
        r = c.get("/api/admin/payments/csv-export?period=all_time", headers=_auth(admin_token))
    assert r.status_code == 200
    lines = r.text.splitlines()
    # Skip header
    if len(lines) <= 2:
        pytest.skip("Not enough data to verify sort")
    trainer_col_values = [ln.split(",", 1)[0].lower() for ln in lines[1:]]
    sorted_copy = sorted(trainer_col_values)
    assert trainer_col_values == sorted_copy, "CSV rows must be sorted by trainer name"


def test_csv_export_invalid_date(admin_token):
    with httpx.Client(base_url=BASE_URL, timeout=30) as c:
        r = c.get("/api/admin/payments/csv-export?start_date=not-a-date", headers=_auth(admin_token))
    assert r.status_code == 400


def test_admin_endpoints_require_auth():
    """Admin endpoints reject unauthenticated requests."""
    with httpx.Client(base_url=BASE_URL, timeout=30) as c:
        r1 = c.get("/api/admin/recent-sessions")
        r2 = c.get("/api/admin/payments/csv-export?period=this_month")
    assert r1.status_code in (401, 403)
    assert r2.status_code in (401, 403)
