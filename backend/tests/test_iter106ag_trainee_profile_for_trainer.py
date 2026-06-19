"""
iter106ag regression — trainer-side trainee profile must surface the same rich
data the trainee built into their own profile (vibe music auto-play, highlight
reel, fitness goals, training preferences, gallery).

We only test the backend contract here — that the public profile endpoint
returns every field the trainer screen needs to render. The UI consumption is
covered by the screen file itself (search_replace landed all conditionals).
"""
import os
import requests

API = os.environ.get("BACKEND_URL", "http://localhost:8001")
TRAINEE = {"email": "test_trainee_iter25@test.com", "password": "Test123!"}


def _login(creds):
    r = requests.post(f"{API}/api/auth/login", json=creds, timeout=10)
    r.raise_for_status()
    return r.json()


def test_public_profile_exposes_all_trainer_view_fields():
    info = _login(TRAINEE)
    user_id = info["user"]["id"]

    r = requests.get(f"{API}/api/trainee-profiles/{user_id}", timeout=10)
    assert r.status_code == 200
    data = r.json()

    # Required fields the trainer's view reads (presence — not necessarily set).
    required_keys = {
        "fullName",
        "bio",
        "personalityTag",
        "fitnessGoals",
        "preferredTrainingStyles",
        "prefersInPerson",
        "prefersVirtual",
        "isVirtualEnabled",
        "currentFitnessLevel",
        "experienceLevel",
        "budgetMinPerMinuteCents",
        "budgetMaxPerMinuteCents",
        "gallery",
        "vibeTrackTitle",
        "vibeArtistName",
        "vibePreviewUrl",
        "vibeArtworkUrl",
        "vibeAppleMusicUrl",
        "accentColor",
    }
    missing = required_keys - set(data.keys())
    assert not missing, f"trainer-view trainee profile is missing keys: {missing}"


def test_vibe_music_loads_when_set():
    """If the trainee has set up their vibe, the API must return the preview
    URL so the trainer's `<TrainerVibePlayer autoPlay />` can actually play."""
    info = _login(TRAINEE)
    user_id = info["user"]["id"]
    token = info["access_token"]

    # Force-set a vibe via the public endpoint so this test is deterministic.
    payload = {
        "vibeTrackId": "1440899532",
        "vibeTrackTitle": "HUMBLE.",
        "vibeArtistName": "Kendrick Lamar",
        "vibeArtworkUrl": "https://example.com/art.jpg",
        "vibePreviewUrl": "https://example.com/preview.m4a",
        "vibeAppleMusicUrl": "https://music.apple.com/us/album/humble/1440898929?i=1440899532",
    }
    requests.put(
        f"{API}/api/trainee-profiles/{user_id}/vibe",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    ).raise_for_status()

    r = requests.get(f"{API}/api/trainee-profiles/{user_id}", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data.get("vibeTrackTitle") == "HUMBLE."
    assert data.get("vibePreviewUrl") == "https://example.com/preview.m4a"
    # Trainer view condition: `vibeTrackTitle || vibePreviewUrl` — both true.
    assert bool(data.get("vibeTrackTitle") or data.get("vibePreviewUrl"))


def test_highlights_endpoint_works():
    info = _login(TRAINEE)
    user_id = info["user"]["id"]
    r = requests.get(f"{API}/api/trainee-profiles/{user_id}/highlights", timeout=10)
    assert r.status_code == 200
    # Response shape is either {"highlights": [...]} or [...] — both supported by UI.
    body = r.json()
    assert isinstance(body, (list, dict))
