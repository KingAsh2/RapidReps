"""
Iter97d — FloatingOrangeBg propagation + admin-reply "SUPPORT" badge on chat list.
"""
from pathlib import Path
import requests

API_BASE = "http://localhost:8001"
FRONTEND = Path("/app/frontend")
BACKEND = Path("/app/backend")


# ── FloatingOrangeBg propagation to additional interior screens ─────
def test_achievements_has_floating_orange_bg():
    src = (FRONTEND / "app/trainee/achievements.tsx").read_text()
    assert "FloatingOrangeBg" in src


def test_corporate_dashboard_has_floating_orange_bg():
    src = (FRONTEND / "app/corporate/dashboard.tsx").read_text()
    assert "FloatingOrangeBg" in src


def test_corporate_index_has_floating_orange_bg():
    src = (FRONTEND / "app/corporate/index.tsx").read_text()
    assert "FloatingOrangeBg" in src


def test_notification_preferences_has_floating_orange_bg():
    src = (FRONTEND / "app/notification-preferences.tsx").read_text()
    assert "FloatingOrangeBg" in src


# ── Admin-reply badge: backend exposes isAdmin in conversations ─────
def test_conversations_endpoint_exposes_admin_flag():
    # Login as trainee (already has a conversation with admin from iter97 tests)
    r0 = requests.post(
        f"{API_BASE}/api/auth/login",
        json={"email": "test_trainee_iter25@test.com", "password": "Test123!"},
        timeout=10,
    )
    tok = (r0.json().get("access_token") or r0.json().get("token"))
    # Ensure an admin conversation exists
    requests.get(
        f"{API_BASE}/api/messages/admin-contact",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10,
    )
    r = requests.get(
        f"{API_BASE}/api/conversations",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    convs = r.json()
    assert isinstance(convs, list)
    # At least one participant entry across all conversations should report isAdmin=True
    saw_admin_flag = False
    for c in convs:
        for p in c.get("participantDetails", []):
            if p.get("isAdmin") is True:
                saw_admin_flag = True
    assert saw_admin_flag, "expected isAdmin flag in conversations response after admin-contact"


# ── Admin-reply badge: frontend renders SUPPORT pill ────────────────
def test_messages_list_renders_support_badge_when_isAdmin():
    src = (FRONTEND / "app/messages/index.tsx").read_text()
    assert "otherUser.isAdmin" in src
    assert "SUPPORT" in src
    assert "supportBadge:" in src  # style is defined
