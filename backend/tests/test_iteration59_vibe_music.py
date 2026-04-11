"""
Iteration 59: Trainer Vibe & Music Search API Tests
Tests for the new trainer card/profile redesign features:
- GET /api/music/search - iTunes search proxy
- PUT /api/trainer-profiles/{userId}/vibe - Save vibe
- DELETE /api/trainer-profiles/{userId}/vibe - Clear vibe
- GET /api/trainer-profiles/{userId} - Verify vibe fields in response
- Auth requirements (401 without token, 403 for non-owner)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://auth-layout-preview.preview.emergentagent.com').rstrip('/')

# Test credentials
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"

# Known trainer user ID from context
TRAINER_USER_ID = "69a859371897769df5a8314f"


class TestMusicSearch:
    """Tests for GET /api/music/search endpoint"""
    
    def test_music_search_eminem(self):
        """Test music search with 'eminem' query returns expected fields"""
        response = requests.get(f"{BASE_URL}/api/music/search", params={"q": "eminem", "limit": 5})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "results" in data, "Response should have 'results' field"
        assert len(data["results"]) > 0, "Should return at least one result for 'eminem'"
        
        # Verify first result has all required fields
        first_result = data["results"][0]
        required_fields = ["trackId", "trackName", "artistName", "artworkUrl", "previewUrl", "trackViewUrl"]
        for field in required_fields:
            assert field in first_result, f"Result should have '{field}' field"
        
        print(f"✓ Music search returned {len(data['results'])} results for 'eminem'")
        print(f"  First result: {first_result['trackName']} by {first_result['artistName']}")
    
    def test_music_search_various_artists(self):
        """Test music search handles various queries"""
        queries = ["taylor swift", "drake", "workout music", "hip hop"]
        
        for query in queries:
            response = requests.get(f"{BASE_URL}/api/music/search", params={"q": query, "limit": 3})
            assert response.status_code == 200, f"Search for '{query}' failed: {response.text}"
            
            data = response.json()
            assert "results" in data, f"Response for '{query}' should have 'results'"
            print(f"✓ Search for '{query}' returned {len(data['results'])} results")
    
    def test_music_search_limit_parameter(self):
        """Test that limit parameter works correctly"""
        response = requests.get(f"{BASE_URL}/api/music/search", params={"q": "pop", "limit": 5})
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["results"]) <= 5, "Should respect limit parameter"
        print(f"✓ Limit parameter works - returned {len(data['results'])} results (limit=5)")
    
    def test_music_search_short_query_rejected(self):
        """Test that queries shorter than 2 chars are rejected"""
        response = requests.get(f"{BASE_URL}/api/music/search", params={"q": "a"})
        assert response.status_code == 422, f"Expected 422 for short query, got {response.status_code}"
        print("✓ Short query (1 char) correctly rejected with 422")
    
    def test_music_search_no_auth_required(self):
        """Test that music search doesn't require authentication"""
        response = requests.get(f"{BASE_URL}/api/music/search", params={"q": "rock"})
        assert response.status_code == 200, "Music search should work without auth"
        print("✓ Music search works without authentication")


class TestVibeEndpoints:
    """Tests for vibe CRUD endpoints"""
    
    @pytest.fixture
    def trainer_token(self):
        """Get trainer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Trainer login failed: {response.text}")
        return response.json()["access_token"]
    
    @pytest.fixture
    def trainer_user_id(self, trainer_token):
        """Get trainer user ID from /auth/me"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {trainer_token}"
        })
        if response.status_code != 200:
            pytest.skip(f"Failed to get trainer user ID: {response.text}")
        return response.json()["id"]
    
    @pytest.fixture
    def trainee_token(self):
        """Get trainee auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Trainee login failed: {response.text}")
        return response.json()["access_token"]
    
    def test_vibe_update_requires_auth(self, trainer_user_id):
        """Test that PUT /api/trainer-profiles/{userId}/vibe requires auth"""
        response = requests.put(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe", json={
            "vibeTrackTitle": "Test Song"
        })
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Vibe update correctly requires authentication")
    
    def test_vibe_update_rejects_non_owner(self, trainer_user_id, trainee_token):
        """Test that PUT /api/trainer-profiles/{userId}/vibe rejects non-owner (403)"""
        response = requests.put(
            f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe",
            headers={"Authorization": f"Bearer {trainee_token}"},
            json={"vibeTrackTitle": "Unauthorized Song"}
        )
        assert response.status_code == 403, f"Expected 403 for non-owner, got {response.status_code}: {response.text}"
        print("✓ Vibe update correctly rejects non-owner with 403")
    
    def test_vibe_update_success(self, trainer_token, trainer_user_id):
        """Test PUT /api/trainer-profiles/{userId}/vibe saves vibe data"""
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
            headers={"Authorization": f"Bearer {trainer_token}"},
            json=vibe_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert data.get("vibeTrackTitle") == vibe_data["vibeTrackTitle"], "Should return saved vibeTrackTitle"
        assert data.get("vibeArtistName") == vibe_data["vibeArtistName"], "Should return saved vibeArtistName"
        print(f"✓ Vibe saved successfully: {vibe_data['vibeTrackTitle']} by {vibe_data['vibeArtistName']}")
    
    def test_vibe_in_profile_response(self, trainer_user_id):
        """Test GET /api/trainer-profiles/{userId} includes vibe fields"""
        response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        vibe_fields = ["vibeTrackTitle", "vibeArtistName", "vibeArtworkUrl", "vibePreviewUrl", "vibeAppleMusicUrl", "vibeTrackId"]
        
        for field in vibe_fields:
            assert field in data, f"Profile response should include '{field}'"
        
        print(f"✓ Profile includes vibe fields")
        if data.get("vibeTrackTitle"):
            print(f"  Current vibe: {data['vibeTrackTitle']} by {data.get('vibeArtistName', 'Unknown')}")
    
    def test_vibe_delete_requires_auth(self, trainer_user_id):
        """Test that DELETE /api/trainer-profiles/{userId}/vibe requires auth"""
        response = requests.delete(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Vibe delete correctly requires authentication")
    
    def test_vibe_delete_rejects_non_owner(self, trainer_user_id, trainee_token):
        """Test that DELETE /api/trainer-profiles/{userId}/vibe rejects non-owner (403)"""
        response = requests.delete(
            f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-owner, got {response.status_code}: {response.text}"
        print("✓ Vibe delete correctly rejects non-owner with 403")
    
    def test_vibe_delete_success(self, trainer_token, trainer_user_id):
        """Test DELETE /api/trainer-profiles/{userId}/vibe clears vibe data"""
        # First set a vibe
        requests.put(
            f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={"vibeTrackTitle": "Temp Song", "vibeArtistName": "Temp Artist"}
        )
        
        # Now delete it
        response = requests.delete(
            f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        
        # Verify vibe is cleared in profile
        profile_response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}")
        profile_data = profile_response.json()
        assert profile_data.get("vibeTrackTitle") is None, "vibeTrackTitle should be None after delete"
        
        print("✓ Vibe deleted successfully and cleared from profile")
    
    def test_vibe_full_flow(self, trainer_token, trainer_user_id):
        """Test complete vibe flow: search -> save -> verify -> delete"""
        # 1. Search for a song
        search_response = requests.get(f"{BASE_URL}/api/music/search", params={"q": "lose yourself eminem", "limit": 1})
        assert search_response.status_code == 200
        search_data = search_response.json()
        
        if len(search_data["results"]) > 0:
            track = search_data["results"][0]
            print(f"  Found track: {track['trackName']} by {track['artistName']}")
            
            # 2. Save the vibe
            save_response = requests.put(
                f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe",
                headers={"Authorization": f"Bearer {trainer_token}"},
                json={
                    "vibeTrackTitle": track["trackName"],
                    "vibeArtistName": track["artistName"],
                    "vibeArtworkUrl": track["artworkUrl"],
                    "vibePreviewUrl": track["previewUrl"],
                    "vibeAppleMusicUrl": track["trackViewUrl"],
                    "vibeTrackId": track["trackId"]
                }
            )
            assert save_response.status_code == 200, f"Save failed: {save_response.text}"
            print(f"  Saved vibe: {track['trackName']}")
            
            # 3. Verify in profile
            profile_response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}")
            profile_data = profile_response.json()
            assert profile_data.get("vibeTrackTitle") == track["trackName"], "Vibe not saved correctly"
            print(f"  Verified vibe in profile")
            
            # 4. Delete the vibe
            delete_response = requests.delete(
                f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe",
                headers={"Authorization": f"Bearer {trainer_token}"}
            )
            assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
            print(f"  Deleted vibe")
            
            # 5. Verify deletion
            profile_response2 = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}")
            profile_data2 = profile_response2.json()
            assert profile_data2.get("vibeTrackTitle") is None, "Vibe not deleted correctly"
            print(f"  Verified vibe deleted from profile")
        
        print("✓ Full vibe flow completed successfully")


class TestAuthenticationBasics:
    """Basic auth tests to ensure system is working"""
    
    def test_trainer_login(self):
        """Test trainer can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should have access_token"
        assert "user" in data, "Response should have user"
        assert "trainer" in data["user"]["roles"], "User should have trainer role"
        print(f"✓ Trainer login successful: {data['user']['email']}")
    
    def test_trainee_login(self):
        """Test trainee can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should have access_token"
        assert "trainee" in data["user"]["roles"], "User should have trainee role"
        print(f"✓ Trainee login successful: {data['user']['email']}")
    
    def test_admin_login(self):
        """Test admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert data["user"].get("isAdmin") == True, "User should be admin"
        print(f"✓ Admin login successful: {data['user']['email']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
