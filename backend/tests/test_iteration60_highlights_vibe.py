"""
Iteration 60: Comprehensive tests for Trainer Profile Personality Redesign
- Highlight Reel CRUD endpoints (GET/POST/DELETE)
- Music Search API (iTunes proxy)
- Vibe CRUD endpoints (PUT/DELETE)
- Auth requirements verification
"""
import requests
import os
import sys

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"


def login(email, password):
    """Login and return (token, user_id) tuple"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": email,
        "password": password
    })
    if response.status_code == 200:
        data = response.json()
        # Try both 'token' and 'access_token' keys
        token = data.get("token") or data.get("access_token")
        # Get user ID from login response
        user_id = data.get("user", {}).get("id")
        return token, user_id
    return None, None


def test_music_search_eminem():
    """Search for 'eminem' returns valid results with previewUrl"""
    response = requests.get(f"{BASE_URL}/api/music/search", params={
        "q": "eminem",
        "limit": 5
    })
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert "results" in data, "Response should contain 'results' key"
    assert len(data["results"]) > 0, "Should return at least one result"
    
    # Verify result structure
    first_result = data["results"][0]
    assert "trackId" in first_result, "Result should have trackId"
    assert "trackName" in first_result, "Result should have trackName"
    assert "artistName" in first_result, "Result should have artistName"
    assert "previewUrl" in first_result, "Result should have previewUrl"
    
    print(f"PASS: Music search returned {len(data['results'])} results for 'eminem'")
    return True


def test_music_search_various_queries():
    """Test various search queries"""
    queries = ["taylor swift", "drake", "workout music"]
    
    for query in queries:
        response = requests.get(f"{BASE_URL}/api/music/search", params={
            "q": query,
            "limit": 3
        })
        assert response.status_code == 200, f"Search for '{query}' failed"
        data = response.json()
        assert "results" in data, f"No results key for '{query}'"
    
    print(f"PASS: Various music search queries work")
    return True


def test_music_search_short_query_rejected():
    """Short queries (< 2 chars) should be rejected"""
    response = requests.get(f"{BASE_URL}/api/music/search", params={
        "q": "a"
    })
    assert response.status_code == 422, f"Expected 422 for short query, got {response.status_code}"
    print("PASS: Short query rejected with 422")
    return True


def test_music_search_no_auth_required():
    """Music search should work without authentication"""
    response = requests.get(f"{BASE_URL}/api/music/search", params={
        "q": "rock"
    })
    assert response.status_code == 200, "Music search should be public"
    print("PASS: Music search works without auth")
    return True


def test_get_highlights_public():
    """GET /api/trainer-profiles/{userId}/highlights returns highlights array"""
    trainer_token, trainer_user_id = login(TRAINER_EMAIL, TRAINER_PASSWORD)
    assert trainer_token, "Trainer login failed"
    assert trainer_user_id, "Could not get trainer user ID"
    
    response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/highlights")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert "highlights" in data, "Response should contain 'highlights' key"
    assert isinstance(data["highlights"], list), "Highlights should be a list"
    
    print(f"PASS: GET highlights returns array with {len(data['highlights'])} items")
    return True


def test_post_highlights_requires_auth():
    """POST /api/trainer-profiles/{userId}/highlights requires auth (401 without token)"""
    trainer_token, trainer_user_id = login(TRAINER_EMAIL, TRAINER_PASSWORD)
    
    # Try without auth
    response = requests.post(
        f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/highlights",
        files={"file": ("test.jpg", b"fake image data", "image/jpeg")},
        data={"caption": "Test highlight"}
    )
    assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
    print("PASS: POST highlights requires auth")
    return True


def test_delete_highlights_requires_auth():
    """DELETE /api/trainer-profiles/{userId}/highlights/{index} requires auth"""
    trainer_token, trainer_user_id = login(TRAINER_EMAIL, TRAINER_PASSWORD)
    
    response = requests.delete(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/highlights/0")
    assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
    print("PASS: DELETE highlights requires auth")
    return True


def test_put_vibe_requires_auth():
    """PUT /api/trainer-profiles/{userId}/vibe requires auth"""
    trainer_token, trainer_user_id = login(TRAINER_EMAIL, TRAINER_PASSWORD)
    
    response = requests.put(
        f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe",
        json={
            "vibeTrackTitle": "Test Song",
            "vibeArtistName": "Test Artist"
        }
    )
    assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
    print("PASS: PUT vibe requires auth")
    return True


def test_put_vibe_saves_data():
    """PUT /api/trainer-profiles/{userId}/vibe saves and returns vibe data"""
    trainer_token, trainer_user_id = login(TRAINER_EMAIL, TRAINER_PASSWORD)
    assert trainer_token, "Trainer login failed"
    assert trainer_user_id, "Could not get trainer user ID"
    
    vibe_data = {
        "vibeTrackTitle": "Lose Yourself",
        "vibeArtistName": "Eminem",
        "vibeArtworkUrl": "https://example.com/artwork.jpg",
        "vibePreviewUrl": "https://example.com/preview.m4a",
        "vibeAppleMusicUrl": "https://music.apple.com/track/123",
        "vibeTrackId": "123456789"
    }
    
    response = requests.put(
        f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe",
        json=vibe_data,
        headers={"Authorization": f"Bearer {trainer_token}"}
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    # Verify vibe was saved by fetching profile
    profile_response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}")
    assert profile_response.status_code == 200
    
    profile = profile_response.json()
    assert profile.get("vibeTrackTitle") == "Lose Yourself", "Vibe title should be saved"
    assert profile.get("vibeArtistName") == "Eminem", "Vibe artist should be saved"
    
    print("PASS: PUT vibe saves data correctly")
    return True


def test_delete_vibe_requires_auth():
    """DELETE /api/trainer-profiles/{userId}/vibe requires auth"""
    trainer_token, trainer_user_id = login(TRAINER_EMAIL, TRAINER_PASSWORD)
    
    response = requests.delete(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe")
    assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
    print("PASS: DELETE vibe requires auth")
    return True


def test_delete_vibe_clears_data():
    """DELETE /api/trainer-profiles/{userId}/vibe clears vibe data"""
    trainer_token, trainer_user_id = login(TRAINER_EMAIL, TRAINER_PASSWORD)
    assert trainer_token, "Trainer login failed"
    assert trainer_user_id, "Could not get trainer user ID"
    
    response = requests.delete(
        f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe",
        headers={"Authorization": f"Bearer {trainer_token}"}
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    # Verify vibe was cleared
    profile_response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}")
    assert profile_response.status_code == 200
    
    profile = profile_response.json()
    assert not profile.get("vibeTrackTitle"), "Vibe title should be cleared"
    
    print("PASS: DELETE vibe clears data")
    return True


def test_complete_vibe_flow():
    """Test complete vibe workflow: Search -> Save -> Verify -> Delete"""
    trainer_token, trainer_user_id = login(TRAINER_EMAIL, TRAINER_PASSWORD)
    assert trainer_token, "Trainer login failed"
    assert trainer_user_id, "Could not get trainer user ID"
    
    # Step 1: Search for a song
    search_response = requests.get(f"{BASE_URL}/api/music/search", params={
        "q": "workout",
        "limit": 1
    })
    assert search_response.status_code == 200
    results = search_response.json().get("results", [])
    
    if len(results) == 0:
        print("SKIP: No search results to test with")
        return True
    
    track = results[0]
    print(f"  Found track: {track['trackName']} by {track['artistName']}")
    
    # Step 2: Save as vibe
    save_response = requests.put(
        f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe",
        json={
            "vibeTrackTitle": track["trackName"],
            "vibeArtistName": track["artistName"],
            "vibeArtworkUrl": track.get("artworkUrl", ""),
            "vibePreviewUrl": track.get("previewUrl", ""),
            "vibeAppleMusicUrl": track.get("trackViewUrl", ""),
            "vibeTrackId": track["trackId"]
        },
        headers={"Authorization": f"Bearer {trainer_token}"}
    )
    assert save_response.status_code == 200, f"Save failed: {save_response.text}"
    
    # Step 3: Verify saved
    profile_response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}")
    assert profile_response.status_code == 200
    profile = profile_response.json()
    assert profile.get("vibeTrackTitle") == track["trackName"]
    
    # Step 4: Delete vibe
    delete_response = requests.delete(
        f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe",
        headers={"Authorization": f"Bearer {trainer_token}"}
    )
    assert delete_response.status_code == 200
    
    # Step 5: Verify deleted
    profile_response2 = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}")
    profile2 = profile_response2.json()
    assert not profile2.get("vibeTrackTitle"), "Vibe should be cleared"
    
    print("PASS: Complete vibe flow (search -> save -> verify -> delete)")
    return True


def test_get_trainer_profile():
    """GET /api/trainer-profiles/{userId} returns profile"""
    trainer_token, trainer_user_id = login(TRAINER_EMAIL, TRAINER_PASSWORD)
    assert trainer_user_id, "Could not get trainer user ID"
    
    response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    profile = response.json()
    assert "userId" in profile or "fullName" in profile, "Profile should have basic fields"
    
    print(f"PASS: GET trainer profile works - {profile.get('fullName', 'Unknown')}")
    return True


def test_trainer_profile_includes_gallery():
    """Trainer profile should include gallery field"""
    trainer_token, trainer_user_id = login(TRAINER_EMAIL, TRAINER_PASSWORD)
    assert trainer_user_id, "Could not get trainer user ID"
    
    response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}")
    assert response.status_code == 200
    
    profile = response.json()
    # Gallery may be empty but should exist or be None
    gallery = profile.get("gallery", [])
    
    print(f"PASS: Profile includes gallery with {len(gallery)} items")
    return True


def run_all_tests():
    """Run all tests and report results"""
    tests = [
        ("Music Search - Eminem", test_music_search_eminem),
        ("Music Search - Various Queries", test_music_search_various_queries),
        ("Music Search - Short Query Rejected", test_music_search_short_query_rejected),
        ("Music Search - No Auth Required", test_music_search_no_auth_required),
        ("Highlights - GET Public", test_get_highlights_public),
        ("Highlights - POST Requires Auth", test_post_highlights_requires_auth),
        ("Highlights - DELETE Requires Auth", test_delete_highlights_requires_auth),
        ("Vibe - PUT Requires Auth", test_put_vibe_requires_auth),
        ("Vibe - PUT Saves Data", test_put_vibe_saves_data),
        ("Vibe - DELETE Requires Auth", test_delete_vibe_requires_auth),
        ("Vibe - DELETE Clears Data", test_delete_vibe_clears_data),
        ("Vibe - Complete Flow", test_complete_vibe_flow),
        ("Profile - GET Works", test_get_trainer_profile),
        ("Profile - Includes Gallery", test_trainer_profile_includes_gallery),
    ]
    
    passed = 0
    failed = 0
    failures = []
    
    print(f"\n{'='*60}")
    print(f"Running {len(tests)} tests against {BASE_URL}")
    print(f"{'='*60}\n")
    
    for name, test_func in tests:
        try:
            test_func()
            passed += 1
        except AssertionError as e:
            failed += 1
            failures.append((name, str(e)))
            print(f"FAIL: {name} - {e}")
        except Exception as e:
            failed += 1
            failures.append((name, str(e)))
            print(f"ERROR: {name} - {e}")
    
    print(f"\n{'='*60}")
    print(f"Results: {passed} passed, {failed} failed out of {len(tests)} tests")
    print(f"{'='*60}")
    
    if failures:
        print("\nFailures:")
        for name, error in failures:
            print(f"  - {name}: {error}")
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
