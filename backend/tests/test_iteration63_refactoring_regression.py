"""
Iteration 63: Backend Refactoring Regression Tests
Tests that all existing endpoints still work after models.py and deps.py extraction from server.py.
"""
import pytest
import requests
import os
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vibe-highlight-cards.preview.emergentagent.com').rstrip('/')

# Test credentials from test_credentials.md
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"

# Valid personality tags from models.py
VALID_PERSONALITY_TAGS = [
    "INTENSE", "CHILL", "BEAST MODE", "ZEN",
    "HIGH ENERGY", "NO EXCUSES", "PATIENT", "COMPETITIVE"
]


class TestHealthEndpoints:
    """Test health check endpoints"""
    
    def test_health_endpoint(self):
        """GET /api/health must return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", f"Unexpected health status: {data}"
        print(f"✓ Health endpoint returned: {data}")
    
    def test_api_health_endpoint(self):
        """GET /api/health must return healthy status (via API prefix)"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"API health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", f"Unexpected health status: {data}"
        print(f"✓ API health endpoint returned: {data}")


class TestAuthEndpoints:
    """Test authentication endpoints after refactoring"""
    
    def test_trainer_login(self):
        """POST /api/auth/login with trainer credentials - must return access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"Missing access_token in response: {data}"
        assert "user" in data, f"Missing user in response: {data}"
        assert data["user"]["email"] == TRAINER_EMAIL
        assert "trainer" in data["user"]["roles"]
        print(f"✓ Trainer login successful, got access_token")
        return data["access_token"], data["user"]["id"]
    
    def test_trainee_login(self):
        """POST /api/auth/login with trainee credentials - must return access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"Missing access_token in response: {data}"
        assert "user" in data, f"Missing user in response: {data}"
        assert data["user"]["email"] == TRAINEE_EMAIL
        assert "trainee" in data["user"]["roles"]
        print(f"✓ Trainee login successful, got access_token")
        return data["access_token"], data["user"]["id"]
    
    def test_admin_login(self):
        """POST /api/auth/login with admin credentials - must return access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"Missing access_token in response: {data}"
        assert "user" in data, f"Missing user in response: {data}"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["isAdmin"] == True, f"Admin user should have isAdmin=True: {data}"
        print(f"✓ Admin login successful, got access_token")
        return data["access_token"], data["user"]["id"]
    
    def test_get_me_with_valid_token(self):
        """GET /api/auth/me with valid token - must return user data"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Now test /auth/me
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Get me failed: {response.text}"
        data = response.json()
        assert data["email"] == TRAINER_EMAIL
        assert "id" in data
        assert "fullName" in data
        assert "roles" in data
        print(f"✓ GET /auth/me returned user data: {data['email']}")
    
    def test_get_me_without_token(self):
        """GET /api/auth/me without token - must return 401/403"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ GET /auth/me without token correctly returned {response.status_code}")
    
    def test_signup_new_user(self):
        """POST /api/auth/signup - new user registration must still work"""
        # Generate unique email to avoid duplicates
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        unique_email = f"test_iter63_{random_suffix}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": "Test User Iter63",
            "email": unique_email,
            "phone": "555-123-4567",
            "password": "Test123!",
            "roles": ["trainee"]
        })
        assert response.status_code == 200, f"Signup failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"Missing access_token in signup response: {data}"
        assert "user" in data, f"Missing user in signup response: {data}"
        assert data["user"]["email"] == unique_email
        print(f"✓ Signup successful for {unique_email}")


class TestPersonalityTagEndpoints:
    """Test personality tag CRUD endpoints"""
    
    @pytest.fixture
    def trainer_auth(self):
        """Get trainer authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        return data["access_token"], data["user"]["id"]
    
    @pytest.fixture
    def trainee_auth(self):
        """Get trainee authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        return data["access_token"], data["user"]["id"]
    
    def test_trainer_set_valid_personality_tag(self, trainer_auth):
        """PUT /api/trainer-profiles/{userId}/personality-tag with valid tag - must succeed"""
        token, user_id = trainer_auth
        tag = random.choice(VALID_PERSONALITY_TAGS)
        
        response = requests.put(
            f"{BASE_URL}/api/trainer-profiles/{user_id}/personality-tag",
            json={"personalityTag": tag},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Set trainer personality tag failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("personalityTag") == tag
        print(f"✓ Trainer personality tag set to: {tag}")
    
    def test_trainee_set_valid_personality_tag(self, trainee_auth):
        """PUT /api/trainee-profiles/{userId}/personality-tag with valid tag - must succeed"""
        token, user_id = trainee_auth
        tag = random.choice(VALID_PERSONALITY_TAGS)
        
        response = requests.put(
            f"{BASE_URL}/api/trainee-profiles/{user_id}/personality-tag",
            json={"personalityTag": tag},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Set trainee personality tag failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("personalityTag") == tag
        print(f"✓ Trainee personality tag set to: {tag}")
    
    def test_trainer_invalid_personality_tag(self, trainer_auth):
        """PUT /api/trainer-profiles/{userId}/personality-tag with invalid tag - must return 400"""
        token, user_id = trainer_auth
        
        response = requests.put(
            f"{BASE_URL}/api/trainer-profiles/{user_id}/personality-tag",
            json={"personalityTag": "INVALID_TAG_XYZ"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid tag, got {response.status_code}: {response.text}"
        print(f"✓ Invalid trainer personality tag correctly rejected with 400")
    
    def test_trainee_invalid_personality_tag(self, trainee_auth):
        """PUT /api/trainee-profiles/{userId}/personality-tag with invalid tag - must return 400"""
        token, user_id = trainee_auth
        
        response = requests.put(
            f"{BASE_URL}/api/trainee-profiles/{user_id}/personality-tag",
            json={"personalityTag": "INVALID_TAG_XYZ"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid tag, got {response.status_code}: {response.text}"
        print(f"✓ Invalid trainee personality tag correctly rejected with 400")


class TestTrainerProfileEndpoints:
    """Test trainer profile endpoints"""
    
    @pytest.fixture
    def trainer_auth(self):
        """Get trainer authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        return data["access_token"], data["user"]["id"]
    
    def test_get_trainer_profile_includes_personality_tag(self, trainer_auth):
        """GET /api/trainer-profiles/{userId} - must include personalityTag field in response"""
        token, user_id = trainer_auth
        
        response = requests.get(f"{BASE_URL}/api/trainer-profiles/{user_id}")
        assert response.status_code == 200, f"Get trainer profile failed: {response.text}"
        data = response.json()
        
        # Verify personalityTag field exists (can be null)
        assert "personalityTag" in data, f"personalityTag field missing from trainer profile: {data.keys()}"
        print(f"✓ Trainer profile includes personalityTag: {data.get('personalityTag')}")
        
        # Verify other essential fields
        assert "userId" in data
        assert "averageRating" in data
        assert "totalReviews" in data
        print(f"✓ Trainer profile has all expected fields")


class TestMusicSearchEndpoint:
    """Test iTunes music search proxy"""
    
    def test_music_search(self):
        """GET /api/music/search?term=test - iTunes proxy must work"""
        response = requests.get(f"{BASE_URL}/api/music/search", params={"q": "test"})
        assert response.status_code == 200, f"Music search failed: {response.text}"
        data = response.json()
        assert "results" in data, f"Missing results in music search response: {data}"
        print(f"✓ Music search returned {len(data.get('results', []))} results")


class TestImportsAndDependencies:
    """Test that imports from models.py and deps.py work correctly"""
    
    def test_pricing_rules_work(self):
        """Verify pricing calculations still work (uses PricingRules from models.py)"""
        # Login as trainer
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Get pricing limits (uses PricingRules constants)
        response = requests.get(f"{BASE_URL}/api/trainer/pricing-limits", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Pricing limits failed: {response.text}"
        data = response.json()
        
        # Verify pricing data structure
        assert "pricingLimits" in data
        assert "virtual" in data["pricingLimits"]
        assert "outdoor" in data["pricingLimits"]
        assert "inHome" in data["pricingLimits"]
        print(f"✓ Pricing rules work correctly: {data['pricingLimits']}")
    
    def test_verification_status_works(self):
        """Verify verification status endpoint works (uses VerificationStatus from models.py)"""
        # Login as trainer
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Get verification status
        response = requests.get(f"{BASE_URL}/api/trainer/verification-status", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Verification status failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "steps" in data
        assert "canGoLive" in data
        print(f"✓ Verification status works correctly: canGoLive={data['canGoLive']}")


class TestDepsModuleFunctions:
    """Test that functions from deps.py work correctly"""
    
    def test_password_hashing_works(self):
        """Verify password hashing works (hash_password, verify_password from deps.py)"""
        # Test by attempting login with correct and incorrect passwords
        # Correct password
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200, "Correct password should work"
        
        # Incorrect password
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": "WrongPassword123!"
        })
        assert response.status_code == 401, "Incorrect password should fail"
        print(f"✓ Password hashing/verification works correctly")
    
    def test_jwt_token_works(self):
        """Verify JWT token creation/validation works (create_access_token, decode_token from deps.py)"""
        # Login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Use token to access protected endpoint
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, "Valid token should work"
        
        # Use invalid token
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": "Bearer invalid_token_xyz"
        })
        assert response.status_code == 401, "Invalid token should fail"
        print(f"✓ JWT token creation/validation works correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
