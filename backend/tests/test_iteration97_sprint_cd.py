"""
Iter97 — Sprint C + D guards.

Coverage:
  C — Profile/Photo/UI Polish
    #7  Unified avatar helper exists (resolveAvatarUrl, initialsFor, UserAvatar)
    #14 FloatingOrangeBg component is droppable on any screen
    #15 Logo glow strengthened on login screen
    #18 Trainer-side TraineeCard avatar fallback uses avatarUrl + photoUrl chain
    #19 Profile tab icon renders <UserAvatar user={...} /> in BOTH tab layouts
    #6  (parity baseline: highlight-upload route reachable from trainee profile)

  D — Music / Admin / Navigation
    #1  audioCoordinator + TrainerVibePlayer auto-registers active sound
    #9  Admin VerificationsTab dropped the 15s cap
    #11 /api/messages/admin-contact endpoint live + Message Admin buttons exist
    #12 Profile → Saved Trainers now pushes /trainee/saved-trainers (not the tab)
    #13 notifications + notification-preferences back arrows are white (not navy)
"""
from pathlib import Path

import requests

API_BASE = "http://localhost:8001"
FRONTEND = Path("/app/frontend")
BACKEND = Path("/app/backend")


# ── #7 / #18 / #19 — Unified avatar ─────────────────────────────────
def test_avatar_helpers_exist():
    src = (FRONTEND / "src/utils/avatar.ts").read_text()
    for fn in ("resolveAvatarUrl", "initialsFor", "avatarAccentFor"):
        assert fn in src, f"avatar helper {fn} missing"


def test_user_avatar_component_exists():
    src = (FRONTEND / "src/components/UserAvatar.tsx").read_text()
    assert "export const UserAvatar" in src
    assert "resolveAvatarUrl" in src
    assert "initialsFor" in src


def test_trainer_tabs_layout_uses_user_avatar():
    src = (FRONTEND / "app/trainer/(tabs)/_layout.tsx").read_text()
    assert "UserAvatar" in src
    assert "user={user}" in src


def test_trainee_tabs_layout_uses_user_avatar():
    src = (FRONTEND / "app/trainee/(tabs)/_layout.tsx").read_text()
    assert "UserAvatar" in src


def test_discover_trainees_uses_avatar_chain():
    src = (FRONTEND / "app/trainer/discover-trainees.tsx").read_text()
    assert "avatarUrl" in src
    # fallback chain documented in iter97
    assert "fallbackPhoto" in src


# ── #14 / #15 — Floating particles + logo glow ──────────────────────
def test_floating_orange_bg_component():
    src = (FRONTEND / "src/components/FloatingOrangeBg.tsx").read_text()
    assert "FloatingOrangeBg" in src
    assert "useNativeDriver: true" in src


def test_login_logo_glow_strengthened():
    src = (FRONTEND / "app/auth/login.premium.tsx").read_text()
    # iter97 (#15): stronger halo — radius 28 (was 14), opacity .92 (was .6)
    assert "textShadowRadius: 28" in src
    assert "rgba(255,122,0,0.92)" in src


# ── #1 — Single-audio guardrail ──────────────────────────────────────
def test_audio_coordinator_present():
    src = (FRONTEND / "src/utils/audioCoordinator.ts").read_text()
    for fn in ("registerActiveAudio", "releaseActiveAudio", "stopAllAudio"):
        assert fn in src


def test_vibe_player_uses_coordinator():
    src = (FRONTEND / "src/components/TrainerVibePlayer.tsx").read_text()
    assert "registerActiveAudio" in src
    assert "releaseActiveAudio" in src


# ── #9 — Admin intro video: no 15s cap ──────────────────────────────
def test_admin_intro_video_no_15s_cap():
    src = (FRONTEND / "src/components/admin/VerificationsTab.tsx").read_text()
    assert "Intro Video (15s preview)" not in src
    # the 15s timeout body should be gone from handlePlayVideo
    assert "Video preview limited to 15 seconds" not in src


# ── #11 — Message Admin feature ─────────────────────────────────────
def test_admin_contact_endpoint_exists():
    """Endpoint should be registered (response code 401 without auth, not 404)."""
    r = requests.get(f"{API_BASE}/api/messages/admin-contact", timeout=10)
    assert r.status_code in (401, 403, 422), f"expected 401/403, got {r.status_code}"


def test_admin_contact_returns_admin_after_login():
    tok_res = requests.post(
        f"{API_BASE}/api/auth/login",
        json={"email": "test_trainee_iter25@test.com", "password": "Test123!"},
        timeout=10,
    )
    tok = (tok_res.json().get("access_token") or tok_res.json().get("token"))
    r = requests.get(
        f"{API_BASE}/api/messages/admin-contact",
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["conversationId"]
    assert body["admin"]["id"]
    assert body["admin"]["email"]


def test_message_admin_buttons_present():
    trainee_src = (FRONTEND / "app/trainee/(tabs)/profile.tsx").read_text()
    trainer_src = (FRONTEND / "app/trainer/(tabs)/profile.tsx").read_text()
    assert "message-admin-btn" in trainee_src
    assert "trainer-message-admin-btn" in trainer_src


# ── #12 — Back-button history preservation ──────────────────────────
def test_saved_trainers_non_tab_route_exists():
    f = FRONTEND / "app/trainee/saved-trainers.tsx"
    assert f.exists()


def test_profile_pushes_to_non_tab_saved_route():
    src = (FRONTEND / "app/trainee/(tabs)/profile.tsx").read_text()
    assert "router.push('/trainee/saved-trainers')" in src
    assert "router.push('/trainee/(tabs)/saved')" not in src


# ── #13 — Back-arrow visibility ─────────────────────────────────────
def test_back_arrows_white_on_navy():
    for f in ("app/notifications.tsx", "app/notification-preferences.tsx"):
        src = (FRONTEND / f).read_text()
        assert "Colors.navy" not in src or "color={Colors.white}" in src, f



# ── iter97b polish: Stripe readiness probe + extra UserAvatar applications ──
def test_payments_config_endpoint_live():
    r = requests.get(f"{API_BASE}/api/payments/config", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert "stripeKeyConfigured" in body
    assert isinstance(body["stripeKeyConfigured"], bool)


def test_chat_header_uses_user_avatar():
    src = (FRONTEND / "app/messages/chat.tsx").read_text()
    assert "UserAvatar" in src


def test_admin_users_tab_uses_user_avatar():
    src = (FRONTEND / "src/components/admin/UsersTab.tsx").read_text()
    assert "UserAvatar" in src


def test_leaderboard_uses_user_avatar():
    src = (FRONTEND / "app/trainee/leaderboard.tsx").read_text()
    assert "UserAvatar" in src


def test_trainee_profile_parity_share_button():
    src = (FRONTEND / "app/trainee/(tabs)/profile.tsx").read_text()
    assert "trainee-share-profile-btn" in src
    assert "Share Profile" in src
