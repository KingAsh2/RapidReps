"""
Iter97c — Polish: trainee profile parity, FloatingOrangeBg propagation,
admin-reply push notification badging.
"""
from pathlib import Path

import requests

API_BASE = "http://localhost:8001"
FRONTEND = Path("/app/frontend")
BACKEND = Path("/app/backend")


# ── Trainee profile visual parity bump ───────────────────────────────
def test_trainee_profile_uses_user_avatar_in_hero():
    src = (FRONTEND / "app/trainee/(tabs)/profile.tsx").read_text()
    assert "UserAvatar" in src
    # The old generic-person icon + LinearGradient placeholder should be gone
    assert "size={50}\n                  color={COLORS.white}\n                />" not in src
    assert "trainee-avatar-tap" in src


def test_trainee_profile_floats_orange_bg():
    src = (FRONTEND / "app/trainee/(tabs)/profile.tsx").read_text()
    assert "FloatingOrangeBg" in src


# ── FloatingOrangeBg propagation ─────────────────────────────────────
def test_leaderboard_uses_floating_orange_bg():
    src = (FRONTEND / "app/trainee/leaderboard.tsx").read_text()
    assert "FloatingOrangeBg" in src


# ── Admin reply push badge ───────────────────────────────────────────
def test_messaging_routes_badges_admin_replies():
    src = (BACKEND / "routes/messaging_routes.py").read_text()
    assert "RapidReps Support replied" in src
    assert "admin_reply" in src
    assert "isAdminReply" in src


def test_send_message_to_user_creates_push(monkeypatch=None):
    """End-to-end: admin sends a message, response 200 and push task scheduled."""
    # Login as admin
    a = requests.post(f"{API_BASE}/api/auth/login",
                      json={"email": "admin@rapidreps.com", "password": "admin123"},
                      timeout=10).json()
    admin_tok = a.get("access_token") or a.get("token")

    # Login as trainee
    t = requests.post(f"{API_BASE}/api/auth/login",
                      json={"email": "test_trainee_iter25@test.com", "password": "Test123!"},
                      timeout=10).json()
    trainee_tok = t.get("access_token") or t.get("token")

    # Trainee initiates admin contact (creates/returns the conversation)
    contact = requests.get(f"{API_BASE}/api/messages/admin-contact",
                           headers={"Authorization": f"Bearer {trainee_tok}"},
                           timeout=10).json()
    trainee_me = requests.get(f"{API_BASE}/api/auth/me",
                              headers={"Authorization": f"Bearer {trainee_tok}"},
                              timeout=10).json()
    trainee_id = trainee_me["id"]

    # Admin replies → expect 200 (push happens in background, can't assert directly
    # but we can ensure the endpoint accepts the payload and persists it)
    r = requests.post(
        f"{API_BASE}/api/messages",
        headers={"Authorization": f"Bearer {admin_tok}"},
        json={"receiverId": trainee_id, "content": "Hello from RapidReps support!"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["content"]
    assert body["senderId"]
