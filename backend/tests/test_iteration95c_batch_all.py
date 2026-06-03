"""
Iter95c — Static + live guards for the batch:
  (b) Welcome Variant B differentiated hero
  (c) Tier celebration sheet + backend one-shot endpoints
  (d) Chunked highlight reel uploads (init/append/commit/abort)
  (a) DS token sweep on top-traffic screens
"""
import base64
import re
from pathlib import Path

import pytest
import requests

FRONTEND = Path("/app/frontend")
BACKEND = Path("/app/backend")
API_BASE = "http://localhost:8001"


# ─── (b) Variant B differentiated hero ────────────────────────────────
def test_variant_b_hero_is_differentiated():
    """B must NOT just re-export A — it should have its own copy."""
    src = (FRONTEND / "app/index.premium-b.tsx").read_text()
    assert "TRAINERS" in src, "Variant B must lead with 'TRAINERS' headline"
    assert "NEAR YOU" in src, "Variant B must include 'NEAR YOU' subheading"
    assert "BUILD WITH PROS" in src, "Variant B must include the new eyebrow"
    # Must reuse the A test IDs so conversion analytics keep working
    for tid in ("premium-find-trainer-btn", "premium-become-trainer-btn", "premium-login-link"):
        assert f'testID="{tid}"' in src, f"Variant B must keep testID {tid} for funnel parity"


def test_index_switcher_consults_variant():
    src = (FRONTEND / "app/index.tsx").read_text()
    assert "WELCOME_VARIANT" in src and "index.premium-b" in src


# ─── (c) Tier celebration sheet ───────────────────────────────────────
def test_tier_celebration_sheet_exists():
    f = FRONTEND / "src/components/TierCelebrationSheet.tsx"
    assert f.exists()
    src = f.read_text()
    assert "Confetti" in src, "TierCelebrationSheet must render confetti"
    assert "tier-celebration-set-rates" in src, "Must have Set My Rates CTA"
    assert "tier-celebration-close" in src, "Must have Later/close CTA"
    assert "/trainer/tier-celebration/acknowledge" in src, "Must call acknowledge endpoint"


def test_trainer_home_wires_celebration_sheet():
    src = (FRONTEND / "app/trainer/(tabs)/home.tsx").read_text()
    assert "TierCelebrationSheet" in src, "Trainer home must import TierCelebrationSheet"
    assert "/trainer/tier-celebration" in src, "Trainer home must fetch /trainer/tier-celebration"
    assert "setTierCelebration" in src, "Trainer home must hold celebration state"


def test_celebration_backend_endpoints_registered():
    src = (BACKEND / "routes/payment_routes.py").read_text()
    assert "/trainer/tier-celebration" in src
    assert "/trainer/tier-celebration/acknowledge" in src
    assert "tierCelebrationAck" in src, "Backend must persist acknowledgement"


# ─── (c) Live API: celebration acknowledgement flow ───────────────────
def _login(email: str, password: str) -> str:
    r = requests.post(f"{API_BASE}/api/auth/login", json={"email": email, "password": password}, timeout=10)
    r.raise_for_status()
    d = r.json()
    return d.get("access_token") or d.get("token") or ""


@pytest.fixture(scope="module")
def trainer_token():
    return _login("test_trainer_iter25@test.com", "Test123!")


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@rapidreps.com", "admin123")


def test_tier_celebration_returns_shouldShow_after_assignment(trainer_token, admin_token):
    # Re-assign tier via admin to reset acknowledgement state
    me = requests.get(f"{API_BASE}/api/auth/me", headers={"Authorization": f"Bearer {trainer_token}"}, timeout=5)
    trainer_id = me.json()["id"]

    # Reset ack flag directly via update endpoint (admin assign-tier resets implicitly per backend logic)
    requests.post(
        f"{API_BASE}/api/admin/trainers/{trainer_id}/assign-tier",
        json={"tier": "certified"},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=10,
    )

    # Force-clear the ack flag so this test can be re-run idempotently
    import asyncio, os
    from dotenv import load_dotenv
    from motor.motor_asyncio import AsyncIOMotorClient
    load_dotenv(BACKEND / ".env")
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    async def _reset():
        await db.trainer_profiles.update_one(
            {"userId": trainer_id}, {"$set": {"tierCelebrationAck": False}}, upsert=True
        )
    asyncio.get_event_loop().run_until_complete(_reset())

    # GET celebration — should show
    r = requests.get(
        f"{API_BASE}/api/trainer/tier-celebration",
        headers={"Authorization": f"Bearer {trainer_token}"}, timeout=5,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["shouldShow"] is True
    assert data["tier"] == "certified"
    assert data["takeHomePct"] == 80
    assert data["tierLabel"]

    # Acknowledge
    r2 = requests.post(
        f"{API_BASE}/api/trainer/tier-celebration/acknowledge",
        headers={"Authorization": f"Bearer {trainer_token}"}, timeout=5,
    )
    assert r2.status_code == 200

    # Subsequent GET must NOT show again
    r3 = requests.get(
        f"{API_BASE}/api/trainer/tier-celebration",
        headers={"Authorization": f"Bearer {trainer_token}"}, timeout=5,
    )
    assert r3.json()["shouldShow"] is False


# ─── (d) Chunked highlight uploads ────────────────────────────────────
def test_chunked_routes_registered():
    src = (BACKEND / "routes/profile_routes.py").read_text()
    for endpoint in (
        "/highlights/chunked/init",
        "/highlights/chunked/append",
        "/highlights/chunked/commit",
        "/highlights/chunked/{upload_id}",
    ):
        assert endpoint in src, f"Missing chunked endpoint: {endpoint}"


def test_frontend_chunked_helper_exists():
    f = FRONTEND / "src/utils/uploadHighlightChunked.ts"
    assert f.exists()
    src = f.read_text()
    for marker in ("uploadId", "/append", "/commit", "totalChunks", "onProgress"):
        assert marker in src, f"Frontend chunked helper missing {marker}"


def test_trainer_highlight_upload_uses_chunked():
    src = (FRONTEND / "app/trainer/highlight-upload.tsx").read_text()
    assert "uploadHighlightChunked" in src, "Trainer highlight upload screen must use chunked uploader"
    assert "mediaType === 'video'" in src, "Chunked path should fire for video uploads"


def test_chunked_e2e_init_append_commit(trainer_token):
    """Drive the full chunked protocol end-to-end with a tiny fake clip."""
    me = requests.get(f"{API_BASE}/api/auth/me", headers={"Authorization": f"Bearer {trainer_token}"}, timeout=5)
    trainer_id = me.json()["id"]
    headers = {"Authorization": f"Bearer {trainer_token}"}

    # 1×1 black PNG bytes (tiny but a valid asset for the storage layer)
    png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Zo3vK0AAAAASUVORK5CYII="
    )
    total = len(png)

    r = requests.post(
        f"{API_BASE}/api/trainer-profiles/{trainer_id}/highlights/chunked/init",
        json={"filename": "test.png", "contentType": "image/png", "totalBytes": total, "caption": "iter95c test"},
        headers=headers, timeout=10,
    )
    assert r.status_code == 200, r.text
    upload_id = r.json()["uploadId"]
    assert upload_id

    # Single chunk (tiny payload)
    r2 = requests.post(
        f"{API_BASE}/api/trainer-profiles/{trainer_id}/highlights/chunked/append",
        json={"uploadId": upload_id, "chunkIndex": 0, "dataBase64": base64.b64encode(png).decode()},
        headers=headers, timeout=10,
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["received"] is True

    # Commit
    r3 = requests.post(
        f"{API_BASE}/api/trainer-profiles/{trainer_id}/highlights/chunked/commit",
        json={"uploadId": upload_id, "totalChunks": 1},
        headers=headers, timeout=15,
    )
    assert r3.status_code == 200, r3.text
    highlight = r3.json()["highlight"]
    assert highlight.get("url"), "Commit must return a stored highlight URL"


def test_chunked_init_rejects_oversized():
    """A 200 MB declared size must be rejected outright."""
    token = _login("test_trainer_iter25@test.com", "Test123!")
    me = requests.get(f"{API_BASE}/api/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=5)
    trainer_id = me.json()["id"]
    r = requests.post(
        f"{API_BASE}/api/trainer-profiles/{trainer_id}/highlights/chunked/init",
        json={"filename": "huge.mp4", "totalBytes": 200 * 1024 * 1024},
        headers={"Authorization": f"Bearer {token}"}, timeout=10,
    )
    assert r.status_code == 400


def test_chunked_abort_cleans_up_session():
    token = _login("test_trainer_iter25@test.com", "Test123!")
    me = requests.get(f"{API_BASE}/api/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=5)
    trainer_id = me.json()["id"]
    headers = {"Authorization": f"Bearer {token}"}

    init = requests.post(
        f"{API_BASE}/api/trainer-profiles/{trainer_id}/highlights/chunked/init",
        json={"filename": "drop.mp4", "totalBytes": 100},
        headers=headers, timeout=10,
    ).json()
    upload_id = init["uploadId"]

    r = requests.delete(
        f"{API_BASE}/api/trainer-profiles/{trainer_id}/highlights/chunked/{upload_id}",
        headers=headers, timeout=10,
    )
    assert r.status_code == 200

    # Subsequent append must fail — session gone
    r2 = requests.post(
        f"{API_BASE}/api/trainer-profiles/{trainer_id}/highlights/chunked/append",
        json={"uploadId": upload_id, "chunkIndex": 0, "dataBase64": "AA=="},
        headers=headers, timeout=10,
    )
    assert r2.status_code == 404


# ─── (a) DS token sweep ───────────────────────────────────────────────
def test_ds_tokens_include_orange_variants():
    """designSystem must expose orangeDeep and orangeEmber for downstream screens."""
    src = (FRONTEND / "src/theme/designSystem.ts").read_text()
    assert "orangeDeep:" in src
    assert "orangeEmber:" in src


def test_trainee_profile_uses_ds_tokens():
    src = (FRONTEND / "app/trainee/(tabs)/profile.tsx").read_text()
    assert "designSystem" in src, "Trainee profile must import DS tokens"
    assert "DS.colors." in src


def test_trainee_sessions_uses_ds_tokens():
    src = (FRONTEND / "app/trainee/(tabs)/sessions.tsx").read_text()
    assert "designSystem" in src, "Trainee sessions must import DS tokens"
    assert "DS.colors." in src


def test_trainer_session_detail_already_uses_ds():
    src = (FRONTEND / "app/trainer/session-detail.tsx").read_text()
    assert "designSystem" in src and "DS.colors." in src
