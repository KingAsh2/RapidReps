"""iter126: Notification screen refactor backend regression.

Covers the endpoints the frontend Notifications screen calls:
  - GET  /api/notifications          → list
  - POST /api/notifications/mark-read → bulk mark
  - DELETE /api/notifications/{id}   → swipe-delete
  - POST /api/notifications/{id}/read → per-item mark read (called from handleTap)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback to frontend/.env if invoked outside supervisor scope
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")

TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PW = "Test123!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": TRAINEE_EMAIL, "password": TRAINEE_PW}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_get_notifications_returns_list(headers):
    r = requests.get(f"{BASE_URL}/api/notifications", headers=headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    # Screen expects data.notifications OR raw array. Doc it.
    assert "notifications" in data or isinstance(data, list)
    items = data["notifications"] if isinstance(data, dict) else data
    assert isinstance(items, list)
    if items:
        n = items[0]
        assert "id" in n and "type" in n and "title" in n


def test_post_mark_read_bulk(headers):
    r = requests.post(f"{BASE_URL}/api/notifications/mark-read", headers=headers, timeout=15)
    assert r.status_code == 200


def test_post_per_item_mark_read_route(headers):
    """Frontend Notifications screen (handleTap) calls this route on tap.
    If it 404s, the unread dot will never clear via the tap flow."""
    r = requests.get(f"{BASE_URL}/api/notifications", headers=headers, timeout=15)
    items = r.json().get("notifications", [])
    if not items:
        pytest.skip("no notifications to test per-item read")
    nid = items[0]["id"]
    r2 = requests.post(f"{BASE_URL}/api/notifications/{nid}/read",
                       headers=headers, timeout=15)
    assert r2.status_code == 200, (
        f"handleTap route POST /api/notifications/{{id}}/read returned "
        f"{r2.status_code}. Frontend catches silently so no crash, but the "
        "unread dot will not disappear."
    )


def test_delete_notification(headers):
    """Swipe-delete path. Create a throwaway is not possible without admin;
    delete a real existing id and confirm 200; then verify GET no longer
    contains it."""
    r = requests.get(f"{BASE_URL}/api/notifications", headers=headers, timeout=15)
    items = r.json().get("notifications", [])
    if not items:
        pytest.skip("no notifications to delete")
    victim = items[-1]  # oldest — safest
    nid = victim["id"]
    d = requests.delete(f"{BASE_URL}/api/notifications/{nid}", headers=headers, timeout=15)
    assert d.status_code in (200, 204), f"delete failed {d.status_code} {d.text[:200]}"
    # Verify gone
    r2 = requests.get(f"{BASE_URL}/api/notifications", headers=headers, timeout=15)
    remaining_ids = {n["id"] for n in r2.json().get("notifications", [])}
    assert nid not in remaining_ids, "notification still present after delete"


def test_trainee_profile_get(headers, token):
    """Anthem / avatar persistence read path used by loadProfile()."""
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=15).json()
    uid = me["id"]
    r = requests.get(f"{BASE_URL}/api/trainee-profiles/{uid}", headers=headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    # Fields the profile screen relies on for anthem + avatar persistence.
    for key in ("userId",):
        assert key in data
    # Non-required but relevant — just print
    print("profilePhoto set:", bool(data.get("profilePhoto")),
          "vibeTrackId:", data.get("vibeTrackId"))
