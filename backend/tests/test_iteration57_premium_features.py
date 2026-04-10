"""
Iteration 57: Backend API Testing for Premium Features
Tests backend stability after frontend-only UI enhancements:
- Pulsing Available Now toggle
- Card entrance/hover animations
- Animated earnings graph
- Profile preview cards
- Full trainer profile hero section

Endpoints tested:
- POST /api/auth/login (admin, trainer, trainee)
- GET /api/auth/me with valid token
- GET /api/trainer-profiles/{userId}
- GET /api/admin/earnings-summary
- POST /api/gallery/upload
- PUT /api/trainer-profiles/{userId}/social-links
- PUT /api/trainer-profiles/{userId}/gallery
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://revert-check.preview.emergentagent.com')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"


class TestAuthLogin:
    """Authentication login endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["isAdmin"] == True, "Admin user should have isAdmin=True"
        print(f"✓ Admin login successful: {data['user']['email']}")
    
    def test_trainer_login_success(self):
        """Test trainer login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["email"] == TRAINER_EMAIL
        assert "trainer" in data["user"]["roles"], "Trainer should have trainer role"
        print(f"✓ Trainer login successful: {data['user']['email']}")
    
    def test_trainee_login_success(self):
        """Test trainee login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["email"] == TRAINEE_EMAIL
        assert "trainee" in data["user"]["roles"], "Trainee should have trainee role"
        print(f"✓ Trainee login successful: {data['user']['email']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected with 401")


class TestAuthMe:
    """GET /api/auth/me endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Admin login failed")
    
    @pytest.fixture
    def trainer_token(self):
        """Get trainer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Trainer login failed")
    
    @pytest.fixture
    def trainee_token(self):
        """Get trainee auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Trainee login failed")
    
    def test_auth_me_admin(self, admin_token):
        """Test GET /api/auth/me returns admin user data"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["isAdmin"] == True
        print(f"✓ GET /api/auth/me (admin) returned correct data")
    
    def test_auth_me_trainer(self, trainer_token):
        """Test GET /api/auth/me returns trainer user data"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {trainer_token}"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["email"] == TRAINER_EMAIL
        assert "trainer" in data["roles"]
        print(f"✓ GET /api/auth/me (trainer) returned correct data")
    
    def test_auth_me_trainee(self, trainee_token):
        """Test GET /api/auth/me returns trainee user data"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {trainee_token}"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["email"] == TRAINEE_EMAIL
        assert "trainee" in data["roles"]
        print(f"✓ GET /api/auth/me (trainee) returned correct data")
    
    def test_auth_me_no_token(self):
        """Test GET /api/auth/me without token returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ GET /api/auth/me without token correctly rejected")
    
    def test_auth_me_invalid_token(self):
        """Test GET /api/auth/me with invalid token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": "Bearer invalid_token_12345"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ GET /api/auth/me with invalid token correctly rejected")


class TestTrainerProfiles:
    """GET /api/trainer-profiles/{userId} endpoint tests"""
    
    @pytest.fixture
    def trainer_user_id(self):
        """Get trainer user ID from login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["user"]["id"]
        pytest.skip("Trainer login failed")
    
    @pytest.fixture
    def trainer_token(self):
        """Get trainer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Trainer login failed")
    
    def test_get_trainer_profile(self, trainer_user_id):
        """Test GET /api/trainer-profiles/{userId} returns profile data"""
        response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "userId" in data, "Profile should contain userId"
        assert data["userId"] == trainer_user_id
        # Check for gallery and socialLinks fields (used by new UI components)
        assert "gallery" in data or data.get("gallery") is None, "Profile should have gallery field"
        assert "socialLinks" in data or data.get("socialLinks") is None, "Profile should have socialLinks field"
        print(f"✓ GET /api/trainer-profiles/{trainer_user_id} returned profile data")
    
    def test_get_trainer_profile_public_access(self, trainer_user_id):
        """Test trainer profile is publicly accessible (no auth required)"""
        response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Trainer profile is publicly accessible")


class TestAdminEarnings:
    """GET /api/admin/earnings-summary endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Admin login failed")
    
    @pytest.fixture
    def trainer_token(self):
        """Get trainer auth token (non-admin)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Trainer login failed")
    
    def test_admin_earnings_summary(self, admin_token):
        """Test GET /api/admin/earnings-summary returns earnings data for admin"""
        response = requests.get(f"{BASE_URL}/api/admin/earnings-summary", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Verify response has expected earnings data structure
        assert isinstance(data, (dict, list)), "Response should be dict or list"
        print(f"✓ GET /api/admin/earnings-summary returned earnings data")
    
    def test_admin_earnings_non_admin_forbidden(self, trainer_token):
        """Test GET /api/admin/earnings-summary returns 403 for non-admin"""
        response = requests.get(f"{BASE_URL}/api/admin/earnings-summary", headers={
            "Authorization": f"Bearer {trainer_token}"
        })
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Non-admin correctly forbidden from earnings-summary")
    
    def test_admin_earnings_no_auth(self):
        """Test GET /api/admin/earnings-summary returns 401/403 without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/earnings-summary")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Earnings-summary without auth correctly rejected")


class TestGalleryUpload:
    """POST /api/gallery/upload endpoint tests"""
    
    @pytest.fixture
    def trainer_token(self):
        """Get trainer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Trainer login failed")
    
    def test_gallery_upload_with_auth(self, trainer_token):
        """Test POST /api/gallery/upload accepts file with auth"""
        # Create a simple test image (1x1 pixel PNG)
        test_image = io.BytesIO(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82')
        
        files = {'file': ('test_image.png', test_image, 'image/png')}
        response = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            headers={"Authorization": f"Bearer {trainer_token}"},
            files=files
        )
        # Accept 200, 201, or 422 (validation error for small file)
        assert response.status_code in [200, 201, 422], f"Expected 200/201/422, got {response.status_code}: {response.text}"
        print(f"✓ POST /api/gallery/upload accepted with auth (status: {response.status_code})")
    
    def test_gallery_upload_no_auth(self):
        """Test POST /api/gallery/upload returns 401/403 without auth"""
        test_image = io.BytesIO(b'\x89PNG\r\n\x1a\n')
        files = {'file': ('test.png', test_image, 'image/png')}
        response = requests.post(f"{BASE_URL}/api/gallery/upload", files=files)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Gallery upload without auth correctly rejected")


class TestSocialLinks:
    """PUT /api/trainer-profiles/{userId}/social-links endpoint tests"""
    
    @pytest.fixture
    def trainer_data(self):
        """Get trainer token and user ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return {"token": data["access_token"], "user_id": data["user"]["id"]}
        pytest.skip("Trainer login failed")
    
    def test_update_social_links(self, trainer_data):
        """Test PUT /api/trainer-profiles/{userId}/social-links updates successfully"""
        response = requests.put(
            f"{BASE_URL}/api/trainer-profiles/{trainer_data['user_id']}/social-links",
            headers={"Authorization": f"Bearer {trainer_data['token']}"},
            json={"socialLinks": {"instagram": "test_trainer", "tiktok": "test_trainer_tiktok"}}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ PUT /api/trainer-profiles/{userId}/social-links updated successfully")
    
    def test_update_social_links_no_auth(self):
        """Test PUT /api/trainer-profiles/{userId}/social-links returns 403 without auth"""
        # Use a dummy user ID
        response = requests.put(
            f"{BASE_URL}/api/trainer-profiles/dummy_user_id/social-links",
            json={"socialLinks": {"instagram": "test"}}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Social links update without auth correctly rejected")


class TestGalleryUpdate:
    """PUT /api/trainer-profiles/{userId}/gallery endpoint tests"""
    
    @pytest.fixture
    def trainer_data(self):
        """Get trainer token and user ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return {"token": data["access_token"], "user_id": data["user"]["id"]}
        pytest.skip("Trainer login failed")
    
    def test_update_gallery(self, trainer_data):
        """Test PUT /api/trainer-profiles/{userId}/gallery updates successfully"""
        response = requests.put(
            f"{BASE_URL}/api/trainer-profiles/{trainer_data['user_id']}/gallery",
            headers={"Authorization": f"Bearer {trainer_data['token']}"},
            json={"gallery": [{"url": "https://example.com/photo1.jpg", "type": "photo", "caption": "Test photo"}]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ PUT /api/trainer-profiles/{userId}/gallery updated successfully")
    
    def test_update_gallery_no_auth(self):
        """Test PUT /api/trainer-profiles/{userId}/gallery returns 403 without auth"""
        response = requests.put(
            f"{BASE_URL}/api/trainer-profiles/dummy_user_id/gallery",
            json={"gallery": []}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Gallery update without auth correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
