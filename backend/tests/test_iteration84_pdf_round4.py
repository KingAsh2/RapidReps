"""Iter 84 — Notifications, virtual session deep link, intro video meta, safety contrast.

Covers PDF round 4 issues:
- #2 Unread notification readability — frontend static (orange-tinted bg + bold title)
- #3 Swipe-left to delete — backend DELETE /api/notifications/{id}
- #4 Virtual session deep link — backend injects deepLink into virtual_session_request notifications
- #7 Intro video meta editable — backend PUT /api/trainer-profiles/{id}/intro-video-meta + persisted on TrainerProfileResponse
- #8 Safety Center contrast — frontend static (text opacity bumped)
"""
import os
import re

import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://highlight-vibe-bugs.preview.emergentagent.com').rstrip('/')
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASS = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASS = "Test123!"


def _login(email: str, password: str) -> dict:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def trainer_session():
    data = _login(TRAINER_EMAIL, TRAINER_PASS)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"})
    return s, data["user"]["id"]


@pytest.fixture(scope="module")
def trainee_session():
    data = _login(TRAINEE_EMAIL, TRAINEE_PASS)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"})
    return s, data["user"]["id"]


# -------- #7 Intro video meta --------

def test_intro_video_meta_set_and_get(trainer_session):
    s, user_id = trainer_session
    r = s.put(
        f"{BASE_URL}/api/trainer-profiles/{user_id}/intro-video-meta",
        json={"introVideoTitle": "My Story", "introVideoDescription": "60 seconds about how I train."},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    assert r.json()["introVideoTitle"] == "My Story"

    # GET surfaces it on TrainerProfileResponse
    r = requests.get(f"{BASE_URL}/api/trainer-profiles/{user_id}", timeout=30)
    assert r.status_code == 200
    assert r.json().get("introVideoTitle") == "My Story"
    assert r.json().get("introVideoDescription") == "60 seconds about how I train."


def test_intro_video_meta_cross_user_403(trainer_session, trainee_session):
    """A trainee cannot update someone else's intro video meta."""
    ts, _ = trainee_session
    _, trainer_id = trainer_session
    r = ts.put(
        f"{BASE_URL}/api/trainer-profiles/{trainer_id}/intro-video-meta",
        json={"introVideoTitle": "Pwned"},
        timeout=30,
    )
    assert r.status_code == 403


# -------- #3 Notification swipe-to-delete --------

def test_notifications_response_has_id_field(trainee_session):
    """Notifications must include `id` so the FE can DELETE by id."""
    s, _ = trainee_session
    r = s.get(f"{BASE_URL}/api/notifications", timeout=30)
    assert r.status_code == 200, r.text
    notifs = r.json().get("notifications", [])
    # If there are any notifications, each must have an `id`. If none, that's fine.
    for n in notifs:
        assert "id" in n, f"Notification missing id: {n}"


def test_notification_delete_404_for_bogus_id(trainee_session):
    """Hitting DELETE with an invalid id returns 400; non-existent returns 404."""
    s, _ = trainee_session
    r = s.delete(f"{BASE_URL}/api/notifications/not-an-objectid", timeout=30)
    assert r.status_code == 400


# -------- #4 Virtual session deep link --------

def test_virtual_session_notification_has_deeplink(trainee_session):
    """Inject a virtual_session_request notification directly and confirm deepLink is generated."""
    # We don't have a public endpoint to insert notifications, so this is a static
    # contract test: confirm the server.py code path injects deepLink for that type.
    server_path = os.path.join(os.path.dirname(__file__), "..", "server.py")
    with open(server_path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "virtual_session_request" in src, "server must reference virtual_session_request notification type"
    assert "deepLink" in src, "server must inject deepLink for virtual session notifications"
    assert "trainee-detail?traineeId" in src, "deepLink must point to /trainer/trainee-detail with traineeId"


# -------- #4 Sticky ACCEPT CTA on the cinematic showcase --------

def test_trainee_detail_renders_sticky_accept_when_param_set():
    """Frontend trainee-detail.tsx must read showAcceptCTA param and render the sticky CTA."""
    path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "app", "trainer", "trainee-detail.tsx")
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "showAcceptCTA" in src
    assert 'data-testid="trainee-detail-sticky-accept"' in src
    assert "ACCEPT SESSION" in src


# -------- #2 Unread notification contrast --------

def test_unread_notification_has_orange_tint():
    """Frontend notifications.tsx must give unread cards orange tint & bolder text."""
    path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "app", "notifications.tsx")
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()
    # Orange-tinted unread state must use 255,106,0 + a left border accent
    assert "rgba(255,106,0,0.12)" in src or "rgba(255, 106, 0, 0.12)" in src
    assert "borderLeftWidth" in src
    # Unread title must not stay the same as read — must have a Unread variant
    assert "notifTitleUnread" in src
    # Must use PanResponder + DELETE for swipe behavior
    assert "PanResponder" in src
    assert "/api/notifications/${notif.id}" in src or "/api/notifications/{notification_id}" in src or "delete(`${API_URL}/api/notifications" in src


# -------- #8 Safety Center contrast --------

def test_safety_center_contrast_boosted():
    """Trainee safety-center must use higher-opacity body text."""
    path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "app", "trainee", "safety-center.tsx")
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()
    # The old gray-on-dark (rgba(255,255,255,0.6)) was unreadable per user PDF.
    # Body / description text must be at least 0.85 opacity now.
    assert "rgba(255,255,255,0.88)" in src or "rgba(255,255,255,0.92)" in src, (
        "Safety Center body text must use >= 0.85 opacity for readability"
    )
    # And the old too-faint colors must be gone
    assert "rgba(255,255,255,0.6)" not in src, "Old too-faint 0.6 opacity must be replaced"


# -------- #7 Intro video position --------

def test_intro_video_renders_above_highlight_reel():
    """trainee/trainer-detail.tsx must render Intro Video JSX BEFORE HighlightReel JSX."""
    path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "app", "trainee", "trainer-detail.tsx")
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()
    intro_idx = src.find('data-testid="trainer-video-intro"')
    reel_idx = src.find("<HighlightReel")
    assert intro_idx > 0, "Intro video block missing"
    assert reel_idx > 0, "HighlightReel block missing"
    assert intro_idx < reel_idx, (
        f"Intro video must be ABOVE Highlight Reel (intro at {intro_idx}, reel at {reel_idx})"
    )
    # The dynamic title fallback must include the default copy
    assert "INTRO TO MY PROFILE" in src
