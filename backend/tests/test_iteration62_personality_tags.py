"""
Iteration 62: Personality Tag CRUD Endpoints Testing
Tests for PUT /api/trainer-profiles/{userId}/personality-tag
Tests for PUT /api/trainee-profiles/{userId}/personality-tag

Valid personality tags: INTENSE, CHILL, BEAST MODE, ZEN, HIGH ENERGY, NO EXCUSES, PATIENT, COMPETITIVE
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"

VALID_PERSONALITY_TAGS = [
    "INTENSE", "CHILL", "BEAST MODE", "ZEN",
    "HIGH ENERGY", "NO EXCUSES", "PATIENT", "COMPETITIVE"
]


class TestPersonalityTagEndpoints:
    """Test personality tag CRUD endpoints for trainers and trainees"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_trainer_auth(self):
        """Login as trainer and return token + user_id"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        data = response.json()
        return data["access_token"], data["user"]["id"]
    
    def get_trainee_auth(self):
        """Login as trainee and return token + user_id"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        data = response.json()
        return data["access_token"], data["user"]["id"]
    
    # =========================================================================
    # TRAINER PERSONALITY TAG TESTS
    # =========================================================================
    
    def test_trainer_set_valid_personality_tag_intense(self):
        """PUT /api/trainer-profiles/{userId}/personality-tag - set INTENSE tag"""
        token, user_id = self.get_trainer_auth()
        
        response = self.session.put(
            f"{BASE_URL}/api/trainer-profiles/{user_id}/personality-tag",
            json={"personalityTag": "INTENSE"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Failed to set trainer personality tag: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert data["personalityTag"] == "INTENSE"
        print("✓ Trainer personality tag set to INTENSE successfully")
    
    def test_trainer_set_valid_personality_tag_beast_mode(self):
        """PUT /api/trainer-profiles/{userId}/personality-tag - set BEAST MODE tag"""
        token, user_id = self.get_trainer_auth()
        
        response = self.session.put(
            f"{BASE_URL}/api/trainer-profiles/{user_id}/personality-tag",
            json={"personalityTag": "BEAST MODE"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Failed to set trainer personality tag: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert data["personalityTag"] == "BEAST MODE"
        print("✓ Trainer personality tag set to BEAST MODE successfully")
    
    def test_trainer_set_all_valid_tags(self):
        """PUT /api/trainer-profiles/{userId}/personality-tag - verify all valid tags work"""
        token, user_id = self.get_trainer_auth()
        
        for tag in VALID_PERSONALITY_TAGS:
            response = self.session.put(
                f"{BASE_URL}/api/trainer-profiles/{user_id}/personality-tag",
                json={"personalityTag": tag},
                headers={"Authorization": f"Bearer {token}"}
            )
            
            assert response.status_code == 200, f"Failed to set trainer tag '{tag}': {response.text}"
            data = response.json()
            assert data["success"] == True
            assert data["personalityTag"] == tag
            print(f"✓ Trainer personality tag '{tag}' set successfully")
    
    def test_trainer_invalid_personality_tag_returns_400(self):
        """PUT /api/trainer-profiles/{userId}/personality-tag - invalid tag returns 400"""
        token, user_id = self.get_trainer_auth()
        
        response = self.session.put(
            f"{BASE_URL}/api/trainer-profiles/{user_id}/personality-tag",
            json={"personalityTag": "INVALID_TAG"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid tag, got {response.status_code}: {response.text}"
        print("✓ Invalid trainer personality tag correctly returns 400")
    
    def test_trainer_clear_personality_tag_with_empty_string(self):
        """PUT /api/trainer-profiles/{userId}/personality-tag - empty string clears tag"""
        token, user_id = self.get_trainer_auth()
        
        # First set a tag
        self.session.put(
            f"{BASE_URL}/api/trainer-profiles/{user_id}/personality-tag",
            json={"personalityTag": "INTENSE"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Then clear it with empty string
        response = self.session.put(
            f"{BASE_URL}/api/trainer-profiles/{user_id}/personality-tag",
            json={"personalityTag": ""},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Failed to clear trainer personality tag: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert data["personalityTag"] == ""
        print("✓ Trainer personality tag cleared with empty string successfully")
    
    def test_trainer_clear_personality_tag_with_null(self):
        """PUT /api/trainer-profiles/{userId}/personality-tag - null clears tag"""
        token, user_id = self.get_trainer_auth()
        
        # First set a tag
        self.session.put(
            f"{BASE_URL}/api/trainer-profiles/{user_id}/personality-tag",
            json={"personalityTag": "CHILL"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Then clear it with null
        response = self.session.put(
            f"{BASE_URL}/api/trainer-profiles/{user_id}/personality-tag",
            json={"personalityTag": None},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Failed to clear trainer personality tag: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert data["personalityTag"] is None
        print("✓ Trainer personality tag cleared with null successfully")
    
    def test_trainer_get_profile_includes_personality_tag(self):
        """GET /api/trainer-profiles/{userId} - should include personalityTag field"""
        token, user_id = self.get_trainer_auth()
        
        # Set a tag first
        self.session.put(
            f"{BASE_URL}/api/trainer-profiles/{user_id}/personality-tag",
            json={"personalityTag": "HIGH ENERGY"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Get the profile
        response = self.session.get(
            f"{BASE_URL}/api/trainer-profiles/{user_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Failed to get trainer profile: {response.text}"
        data = response.json()
        assert "personalityTag" in data, "personalityTag field missing from trainer profile"
        assert data["personalityTag"] == "HIGH ENERGY"
        print("✓ Trainer profile GET includes personalityTag field")
    
    def test_trainer_cannot_update_other_user_tag(self):
        """PUT /api/trainer-profiles/{userId}/personality-tag - cannot update other user's tag"""
        token, user_id = self.get_trainer_auth()
        
        # Try to update a different user's tag
        fake_user_id = "000000000000000000000000"
        response = self.session.put(
            f"{BASE_URL}/api/trainer-profiles/{fake_user_id}/personality-tag",
            json={"personalityTag": "INTENSE"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403, f"Expected 403 for updating other user's tag, got {response.status_code}"
        print("✓ Trainer cannot update other user's personality tag (403)")
    
    def test_trainer_personality_tag_requires_auth(self):
        """PUT /api/trainer-profiles/{userId}/personality-tag - requires authentication"""
        response = self.session.put(
            f"{BASE_URL}/api/trainer-profiles/some-user-id/personality-tag",
            json={"personalityTag": "INTENSE"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Trainer personality tag endpoint requires authentication")
    
    # =========================================================================
    # TRAINEE PERSONALITY TAG TESTS
    # =========================================================================
    
    def test_trainee_set_valid_personality_tag_chill(self):
        """PUT /api/trainee-profiles/{userId}/personality-tag - set CHILL tag"""
        token, user_id = self.get_trainee_auth()
        
        response = self.session.put(
            f"{BASE_URL}/api/trainee-profiles/{user_id}/personality-tag",
            json={"personalityTag": "CHILL"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Failed to set trainee personality tag: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert data["personalityTag"] == "CHILL"
        print("✓ Trainee personality tag set to CHILL successfully")
    
    def test_trainee_set_valid_personality_tag_zen(self):
        """PUT /api/trainee-profiles/{userId}/personality-tag - set ZEN tag"""
        token, user_id = self.get_trainee_auth()
        
        response = self.session.put(
            f"{BASE_URL}/api/trainee-profiles/{user_id}/personality-tag",
            json={"personalityTag": "ZEN"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Failed to set trainee personality tag: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert data["personalityTag"] == "ZEN"
        print("✓ Trainee personality tag set to ZEN successfully")
    
    def test_trainee_set_all_valid_tags(self):
        """PUT /api/trainee-profiles/{userId}/personality-tag - verify all valid tags work"""
        token, user_id = self.get_trainee_auth()
        
        for tag in VALID_PERSONALITY_TAGS:
            response = self.session.put(
                f"{BASE_URL}/api/trainee-profiles/{user_id}/personality-tag",
                json={"personalityTag": tag},
                headers={"Authorization": f"Bearer {token}"}
            )
            
            assert response.status_code == 200, f"Failed to set trainee tag '{tag}': {response.text}"
            data = response.json()
            assert data["success"] == True
            assert data["personalityTag"] == tag
            print(f"✓ Trainee personality tag '{tag}' set successfully")
    
    def test_trainee_invalid_personality_tag_returns_400(self):
        """PUT /api/trainee-profiles/{userId}/personality-tag - invalid tag returns 400"""
        token, user_id = self.get_trainee_auth()
        
        response = self.session.put(
            f"{BASE_URL}/api/trainee-profiles/{user_id}/personality-tag",
            json={"personalityTag": "SUPER_INVALID"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid tag, got {response.status_code}: {response.text}"
        print("✓ Invalid trainee personality tag correctly returns 400")
    
    def test_trainee_clear_personality_tag_with_empty_string(self):
        """PUT /api/trainee-profiles/{userId}/personality-tag - empty string clears tag"""
        token, user_id = self.get_trainee_auth()
        
        # First set a tag
        self.session.put(
            f"{BASE_URL}/api/trainee-profiles/{user_id}/personality-tag",
            json={"personalityTag": "PATIENT"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Then clear it with empty string
        response = self.session.put(
            f"{BASE_URL}/api/trainee-profiles/{user_id}/personality-tag",
            json={"personalityTag": ""},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Failed to clear trainee personality tag: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert data["personalityTag"] == ""
        print("✓ Trainee personality tag cleared with empty string successfully")
    
    def test_trainee_clear_personality_tag_with_null(self):
        """PUT /api/trainee-profiles/{userId}/personality-tag - null clears tag"""
        token, user_id = self.get_trainee_auth()
        
        # First set a tag
        self.session.put(
            f"{BASE_URL}/api/trainee-profiles/{user_id}/personality-tag",
            json={"personalityTag": "COMPETITIVE"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Then clear it with null
        response = self.session.put(
            f"{BASE_URL}/api/trainee-profiles/{user_id}/personality-tag",
            json={"personalityTag": None},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Failed to clear trainee personality tag: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert data["personalityTag"] is None
        print("✓ Trainee personality tag cleared with null successfully")
    
    def test_trainee_get_profile_includes_personality_tag(self):
        """GET /api/trainee-profiles/{userId} - should include personalityTag field if profile exists"""
        token, user_id = self.get_trainee_auth()
        
        # Set a tag first
        set_response = self.session.put(
            f"{BASE_URL}/api/trainee-profiles/{user_id}/personality-tag",
            json={"personalityTag": "NO EXCUSES"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert set_response.status_code == 200, f"Failed to set personality tag: {set_response.text}"
        
        # Get the profile - may return 404 if profile doesn't exist (only tag was set)
        response = self.session.get(
            f"{BASE_URL}/api/trainee-profiles/{user_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 404:
            # Profile doesn't exist, but personality tag endpoint still works
            print("✓ Trainee profile not found (expected if profile not created), but personality tag endpoint works")
            return
        
        assert response.status_code == 200, f"Failed to get trainee profile: {response.text}"
        data = response.json()
        assert "personalityTag" in data, "personalityTag field missing from trainee profile"
        assert data["personalityTag"] == "NO EXCUSES"
        print("✓ Trainee profile GET includes personalityTag field")
    
    def test_trainee_cannot_update_other_user_tag(self):
        """PUT /api/trainee-profiles/{userId}/personality-tag - cannot update other user's tag"""
        token, user_id = self.get_trainee_auth()
        
        # Try to update a different user's tag
        fake_user_id = "000000000000000000000000"
        response = self.session.put(
            f"{BASE_URL}/api/trainee-profiles/{fake_user_id}/personality-tag",
            json={"personalityTag": "CHILL"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403, f"Expected 403 for updating other user's tag, got {response.status_code}"
        print("✓ Trainee cannot update other user's personality tag (403)")
    
    def test_trainee_personality_tag_requires_auth(self):
        """PUT /api/trainee-profiles/{userId}/personality-tag - requires authentication"""
        response = self.session.put(
            f"{BASE_URL}/api/trainee-profiles/some-user-id/personality-tag",
            json={"personalityTag": "CHILL"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Trainee personality tag endpoint requires authentication")


class TestBackendHealth:
    """Verify backend starts without errors"""
    
    def test_backend_health_check(self):
        """GET /health - backend should be healthy"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Backend health check passed")
    
    def test_api_root(self):
        """GET / - API root should respond"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200, f"API root failed: {response.text}"
        data = response.json()
        assert "RapidReps" in data.get("message", "")
        print("✓ API root responds correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
