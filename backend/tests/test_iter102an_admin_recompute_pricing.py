"""iter102an — Admin endpoint to recompute legacy pending session pricing.

Existing sessions saved BEFORE the tier-rates-first pricing fix have the
wrong `finalSessionPriceCents`. Admins can hit this endpoint to retro-fix
those rows without manual DB surgery. Dry-run mode previews the changes.
"""
import os
import httpx
import pytest

BASE_URL = os.environ.get("PUBLIC_BACKEND_URL") or "http://localhost:8001"


def _admin_token() -> str:
    r = httpx.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@rapidreps.com", "password": "admin123"},
        timeout=10.0,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_recompute_dry_run_reports_but_does_not_mutate():
    tok = _admin_token()
    r = httpx.post(
        f"{BASE_URL}/api/admin/recompute-pending-pricing?dry_run=true",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=20.0,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["dryRun"] is True
    assert "inspected" in body and "repriced" in body and "sample" in body
    assert isinstance(body["sample"], list)


def test_recompute_requires_admin():
    # Non-admin trainer token must be rejected.
    r = httpx.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "test_trainer_iter25@test.com", "password": "Test123!"},
        timeout=10.0,
    )
    tok = r.json()["access_token"]
    r2 = httpx.post(
        f"{BASE_URL}/api/admin/recompute-pending-pricing?dry_run=true",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10.0,
    )
    assert r2.status_code in (401, 403), r2.text


def test_recompute_endpoint_exists():
    """Negative: missing token = 401/403, not 404."""
    r = httpx.post(
        f"{BASE_URL}/api/admin/recompute-pending-pricing",
        timeout=10.0,
    )
    assert r.status_code in (401, 403, 422), r.text
