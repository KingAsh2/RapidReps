"""Iteration 83 Phase B — Highlight thumbnail + Range-streaming regression tests.

Validates server-side video thumbnail generation:
- POST /api/trainee-profiles/{id}/highlights/base64 with a real video → response
  contains `thumbnailUrl` pointing to a JPEG served via /api/files/.
- The same path works for the trainer endpoint.
- Photo uploads still work and do NOT have a thumbnailUrl.
- /api/files/ supports Range requests (already shipped, regression-locked here).

Also validates frontend changes via static checks:
- HighlightReel.tsx now consumes `thumbnailUrl` (no longer uses video URL as poster).
"""
import base64
import os
import subprocess
import tempfile

import pytest
import requests

BASE_URL = os.environ.get(
    'EXPO_PUBLIC_BACKEND_URL',
    'https://highlight-vibe-bugs.preview.emergentagent.com',
).rstrip('/')

TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASS = "Test123!"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASS = "Test123!"

TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
)


def _make_tiny_mp4() -> bytes:
    """Generate a 2-second red square video for the test."""
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    out = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    out.close()
    cmd = [
        ffmpeg, "-y",
        "-f", "lavfi", "-i", "color=c=red:s=320x240:d=2",
        "-c:v", "libx264", "-t", "2", "-pix_fmt", "yuv420p",
        out.name,
    ]
    subprocess.run(cmd, capture_output=True, check=True, timeout=30)
    with open(out.name, "rb") as f:
        data = f.read()
    os.remove(out.name)
    return data


def _login(email: str, password: str) -> dict:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def trainee_session():
    data = _login(TRAINEE_EMAIL, TRAINEE_PASS)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"})
    return s, data["user"]["id"]


@pytest.fixture(scope="module")
def trainer_session():
    data = _login(TRAINER_EMAIL, TRAINER_PASS)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"})
    return s, data["user"]["id"]


@pytest.fixture(scope="module")
def video_b64():
    return base64.b64encode(_make_tiny_mp4()).decode()


def _cleanup_test_highlight(s: requests.Session, profile_path: str, user_id: str, caption: str):
    r = requests.get(f"{BASE_URL}/api/{profile_path}/{user_id}/highlights", timeout=30)
    hls = r.json().get("highlights", [])
    for i in range(len(hls) - 1, -1, -1):
        if hls[i].get("caption") == caption:
            s.delete(f"{BASE_URL}/api/{profile_path}/{user_id}/highlights/{i}", timeout=30)
            return


def test_trainee_video_upload_generates_thumbnail(trainee_session, video_b64):
    s, user_id = trainee_session
    cap = "iter83-thumb-trainee"
    _cleanup_test_highlight(s, "trainee-profiles", user_id, cap)

    r = s.post(
        f"{BASE_URL}/api/trainee-profiles/{user_id}/highlights/base64",
        json={"data": video_b64, "filename": "x.mp4", "contentType": "video/mp4", "caption": cap},
        timeout=60,
    )
    assert r.status_code == 200, r.text
    hl = r.json()["highlight"]
    assert hl["type"] == "video"
    assert "thumbnailUrl" in hl, "Video upload must return thumbnailUrl"
    assert hl["thumbnailUrl"].startswith("/api/files/"), hl["thumbnailUrl"]

    # Thumbnail URL must serve a real JPEG
    rr = requests.get(f"{BASE_URL}{hl['thumbnailUrl']}", timeout=30)
    assert rr.status_code == 200
    assert rr.headers.get("content-type", "").startswith("image/jpeg"), rr.headers
    assert len(rr.content) > 100, f"Thumbnail looks empty: {len(rr.content)} bytes"

    _cleanup_test_highlight(s, "trainee-profiles", user_id, cap)


def test_trainer_video_upload_generates_thumbnail(trainer_session, video_b64):
    s, user_id = trainer_session
    cap = "iter83-thumb-trainer"
    _cleanup_test_highlight(s, "trainer-profiles", user_id, cap)

    r = s.post(
        f"{BASE_URL}/api/trainer-profiles/{user_id}/highlights/base64",
        json={"data": video_b64, "filename": "x.mp4", "contentType": "video/mp4", "caption": cap},
        timeout=60,
    )
    assert r.status_code == 200, r.text
    hl = r.json()["highlight"]
    assert hl["type"] == "video"
    assert "thumbnailUrl" in hl
    rr = requests.get(f"{BASE_URL}{hl['thumbnailUrl']}", timeout=30)
    assert rr.status_code == 200

    _cleanup_test_highlight(s, "trainer-profiles", user_id, cap)


def test_photo_upload_has_no_thumbnail_url(trainee_session):
    s, user_id = trainee_session
    cap = "iter83-photo-no-thumb"
    _cleanup_test_highlight(s, "trainee-profiles", user_id, cap)

    r = s.post(
        f"{BASE_URL}/api/trainee-profiles/{user_id}/highlights/base64",
        json={"data": TINY_PNG_B64, "filename": "x.png", "contentType": "image/png", "caption": cap},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    hl = r.json()["highlight"]
    assert hl["type"] == "photo"
    # Photos don't need a separate thumbnail — the image itself is its thumbnail
    assert "thumbnailUrl" not in hl or hl["thumbnailUrl"] is None

    _cleanup_test_highlight(s, "trainee-profiles", user_id, cap)


def test_files_endpoint_supports_range_requests():
    """Regression-lock: video playback in iOS/expo-av requires Range support."""
    # Upload a small file first to have something to range-request
    data = _login(TRAINEE_EMAIL, TRAINEE_PASS)
    token = data["access_token"]
    user_id = data["user"]["id"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})

    cap = "iter83-range"
    _cleanup_test_highlight(s, "trainee-profiles", user_id, cap)
    r = s.post(
        f"{BASE_URL}/api/trainee-profiles/{user_id}/highlights/base64",
        json={"data": TINY_PNG_B64, "filename": "range.png", "contentType": "image/png", "caption": cap},
        timeout=30,
    )
    url = r.json()["highlight"]["url"]

    # Full GET should return 200 with Accept-Ranges
    full = requests.get(f"{BASE_URL}{url}", timeout=30)
    assert full.status_code == 200
    assert full.headers.get("Accept-Ranges", "").lower() == "bytes"

    # Range request should return 206 Partial Content
    partial = requests.get(f"{BASE_URL}{url}", headers={"Range": "bytes=0-10"}, timeout=30)
    assert partial.status_code == 206, f"Expected 206, got {partial.status_code}: {partial.headers}"
    assert "Content-Range" in partial.headers

    _cleanup_test_highlight(s, "trainee-profiles", user_id, cap)


def test_highlight_reel_frontend_uses_thumbnail_url():
    """Static check: HighlightReel.tsx must consume thumbnailUrl, not video URL as poster."""
    path = os.path.join(
        os.path.dirname(__file__), "..", "..",
        "frontend", "src", "components", "HighlightReel.tsx",
    )
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()
    assert "thumbnailUrl" in src, "HighlightReel must reference thumbnailUrl"
    # The old buggy pattern was posterSource={{ uri: item.url }} for videos
    assert "posterSource={{ uri: item.url }}" not in src, (
        "Old buggy pattern (using video URL as poster) must be removed"
    )
    assert "resolveUrl" in src, "Component must resolve relative /api/files paths to absolute"
