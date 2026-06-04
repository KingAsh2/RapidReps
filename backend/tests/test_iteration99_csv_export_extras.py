"""iter99: Extra guards for the admin CSV export endpoint — full header,
period=last_month, period=all_time, filename suffix in Content-Disposition,
and unauth rejection. Complements test_iteration98_admin_dashboard.py.
"""
import csv
import io
import os
import time
import pytest
import httpx

BASE_URL = os.environ.get("BACKEND_URL", "http://localhost:8001")
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    # gentle backoff for rate-limited test runner
    for attempt in range(3):
        with httpx.Client(base_url=BASE_URL, timeout=30) as c:
            r = c.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        if r.status_code == 200:
            body = r.json()
            return body.get("access_token") or body.get("token")
        if r.status_code == 429:
            time.sleep(60)
            continue
        pytest.fail(f"login failed: {r.status_code} {r.text}")
    pytest.skip("rate-limited; cannot acquire admin token")


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


REQUIRED_COLUMNS = [
    "Trainer Name", "Trainer Email", "Session Date", "Customer",
    "Gross ($)", "Commission %", "Commission ($)", "Service Fee ($)",
    "Trainer Payout ($)", "Corporate Subsidy ($)", "Stripe Intent ID", "Status",
]


def _fetch_csv(token, params):
    with httpx.Client(base_url=BASE_URL, timeout=30) as c:
        return c.get("/api/admin/payments/csv-export", headers=_auth(token), params=params)


def test_csv_header_has_all_required_columns(admin_token):
    r = _fetch_csv(admin_token, {"period": "all_time"})
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    reader = csv.reader(io.StringIO(r.text))
    header = next(reader)
    assert header == REQUIRED_COLUMNS, f"header mismatch: {header}"


def test_csv_content_disposition_attachment_filename(admin_token):
    r = _fetch_csv(admin_token, {"period": "this_month"})
    assert r.status_code == 200
    cd = r.headers.get("content-disposition", "")
    assert "attachment" in cd.lower()
    assert "this_month" in cd
    assert cd.endswith(".csv")


def test_csv_period_last_month(admin_token):
    r = _fetch_csv(admin_token, {"period": "last_month"})
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    cd = r.headers.get("content-disposition", "")
    assert "last_month" in cd
    # at minimum header row present
    assert r.text.splitlines()[0].startswith("Trainer Name")


def test_csv_period_all_time_filename(admin_token):
    r = _fetch_csv(admin_token, {"period": "all_time"})
    assert r.status_code == 200
    cd = r.headers.get("content-disposition", "")
    assert "all_time" in cd


def test_csv_default_no_params_returns_all(admin_token):
    """No params → suffix should be 'all'."""
    r = _fetch_csv(admin_token, {})
    assert r.status_code == 200
    cd = r.headers.get("content-disposition", "")
    assert "all" in cd
    assert "text/csv" in r.headers.get("content-type", "")


def test_csv_sort_case_insensitive(admin_token):
    """Parse CSV with csv.reader (handles quoted commas) and verify alphabetic
    sort on lower-cased trainer name."""
    r = _fetch_csv(admin_token, {"period": "all_time"})
    assert r.status_code == 200
    reader = csv.reader(io.StringIO(r.text))
    next(reader)  # skip header
    names = [row[0].lower() for row in reader if row]
    if len(names) < 2:
        pytest.skip("Not enough rows to verify sort")
    assert names == sorted(names), f"trainer names not sorted: {names[:10]}"


def test_csv_invalid_start_date_returns_400(admin_token):
    r = _fetch_csv(admin_token, {"start_date": "garbage"})
    assert r.status_code == 400


def test_csv_invalid_end_date_returns_400(admin_token):
    r = _fetch_csv(admin_token, {"end_date": "garbage"})
    assert r.status_code == 400


def test_csv_export_unauth_rejected():
    with httpx.Client(base_url=BASE_URL, timeout=30) as c:
        r = c.get("/api/admin/payments/csv-export?period=this_month")
    assert r.status_code in (401, 403)


def test_dashboard_unauth_rejected():
    with httpx.Client(base_url=BASE_URL, timeout=30) as c:
        r = c.get("/api/admin/dashboard")
    assert r.status_code in (401, 403)


def test_dashboard_commission_breakout_math(admin_token):
    """commissionRevenueCents must equal platformRevenueCents - serviceFeeRevenueCents,
    and be non-negative."""
    with httpx.Client(base_url=BASE_URL, timeout=30) as c:
        r = c.get("/api/admin/dashboard", headers=_auth(admin_token))
    assert r.status_code == 200
    d = r.json()
    expected = max(0, d["platformRevenueCents"] - d["serviceFeeRevenueCents"])
    assert d["commissionRevenueCents"] == expected


def test_recent_sessions_default_limit(admin_token):
    with httpx.Client(base_url=BASE_URL, timeout=30) as c:
        r = c.get("/api/admin/recent-sessions", headers=_auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data["sessions"], list)
    assert data["count"] == len(data["sessions"])
    assert len(data["sessions"]) <= 10
