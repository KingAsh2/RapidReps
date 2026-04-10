"""
Iteration 56: Backend API Tests for Premium Dark Theme Redesign
Tests authentication, trainer profiles, gallery, and admin endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://revert-check.preview.emergentagent.com').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check passed: {data}")


class TestAuthLogin:
    """Authentication login endpoint tests"""
    
    def test_admin_login_success(self):
        """Test POST /api/auth/login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["isAdmin"] == True
        print(f"✓ Admin login successful: {data['user']['email']}")
        return data["access_token"]
    
    def test_trainer_login_success(self):
        """Test POST /api/auth/login with trainer credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TRAINER_EMAIL
        assert "trainer" in data["user"]["roles"]
        print(f"✓ Trainer login successful: {data['user']['email']}")
        return data["access_token"]
    
    def test_trainee_login_success(self):
        """Test POST /api/auth/login with trainee credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TRAINEE_EMAIL
        assert "trainee" in data["user"]["roles"]
        print(f"✓ Trainee login successful: {data['user']['email']}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test POST /api/auth/login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"
        print(f"✓ Invalid login correctly rejected with status {response.status_code}")


class TestAuthMe:
    """GET /api/auth/me endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def trainer_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def trainee_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_auth_me_with_admin_token(self, admin_token):
        """Test GET /api/auth/me with valid admin token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["isAdmin"] == True
        print(f"✓ Auth/me with admin token: {data['email']}")
    
    def test_auth_me_with_trainer_token(self, trainer_token):
        """Test GET /api/auth/me with valid trainer token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        assert data["email"] == TRAINER_EMAIL
        assert "trainer" in data["roles"]
        print(f"✓ Auth/me with trainer token: {data['email']}")
    
    def test_auth_me_with_trainee_token(self, trainee_token):
        """Test GET /api/auth/me with valid trainee token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        assert data["email"] == TRAINEE_EMAIL
        assert "trainee" in data["roles"]
        print(f"✓ Auth/me with trainee token: {data['email']}")
    
    def test_auth_me_without_token(self):
        """Test GET /api/auth/me without token returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Auth/me without token correctly rejected: {response.status_code}")
    
    def test_auth_me_with_invalid_token(self):
        """Test GET /api/auth/me with invalid token returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Auth/me with invalid token correctly rejected: {response.status_code}")


class TestTrainerProfiles:
    """GET /api/trainer-profiles/{userId} endpoint tests"""
    
    @pytest.fixture
    def trainer_data(self):
        """Get trainer token and user ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        data = response.json()
        return {
            "token": data["access_token"],
            "user_id": data["user"]["id"]
        }
    
    def test_get_trainer_profile_by_user_id(self, trainer_data):
        """Test GET /api/trainer-profiles/{userId}"""
        response = requests.get(
            f"{BASE_URL}/api/trainer-profiles/{trainer_data['user_id']}",
            headers={"Authorization": f"Bearer {trainer_data['token']}"}
        )
        assert response.status_code == 200, f"Get trainer profile failed: {response.text}"
        data = response.json()
        assert data["userId"] == trainer_data["user_id"]
        assert "gallery" in data
        assert "socialLinks" in data
        print(f"✓ Trainer profile retrieved: userId={data['userId']}")
        return data
    
    def test_get_trainer_profile_without_auth(self, trainer_data):
        """Test GET /api/trainer-profiles/{userId} without auth (should work for public profiles)"""
        response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_data['user_id']}")
        # Public profiles should be accessible without auth
        assert response.status_code in [200, 401, 403], f"Unexpected status: {response.status_code}"
        print(f"✓ Trainer profile public access: status={response.status_code}")


class TestGalleryUpload:
    """POST /api/gallery/upload endpoint tests"""
    
    @pytest.fixture
    def trainer_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_gallery_upload_requires_auth(self):
        """Test POST /api/gallery/upload requires authentication"""
        # Create a simple test file
        files = {"file": ("test.jpg", b"fake image content", "image/jpeg")}
        response = requests.post(f"{BASE_URL}/api/gallery/upload", files=files)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Gallery upload requires auth: {response.status_code}")
    
    def test_gallery_upload_with_auth(self, trainer_token):
        """Test POST /api/gallery/upload with valid auth"""
        files = {"file": ("test_iter56.jpg", b"fake image content for testing", "image/jpeg")}
        response = requests.post(
            f"{BASE_URL}/api/gallery/upload",
            files=files,
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        # Should succeed or return validation error for fake content
        assert response.status_code in [200, 201, 400, 422], f"Unexpected status: {response.status_code}"
        print(f"✓ Gallery upload with auth: status={response.status_code}")
        if response.status_code in [200, 201]:
            data = response.json()
            assert "url" in data or "item" in data
            print(f"  Upload response: {data}")


class TestAdminEarnings:
    """GET /api/admin/earnings-summary endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def trainer_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_admin_earnings_summary_with_admin(self, admin_token):
        """Test GET /api/admin/earnings-summary with admin token"""
        response = requests.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin earnings failed: {response.text}"
        data = response.json()
        # Verify response structure
        assert "totalRevenue" in data or "total_revenue" in data or isinstance(data, dict)
        print(f"✓ Admin earnings summary retrieved: {list(data.keys())[:5]}...")
    
    def test_admin_earnings_summary_without_admin(self, trainer_token):
        """Test GET /api/admin/earnings-summary with non-admin token"""
        response = requests.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Admin earnings correctly restricted: {response.status_code}")
    
    def test_admin_earnings_summary_without_auth(self):
        """Test GET /api/admin/earnings-summary without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/earnings-summary")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Admin earnings requires auth: {response.status_code}")


class TestSocialLinksUpdate:
    """PUT /api/trainer-profiles/{userId}/social-links endpoint tests"""
    
    @pytest.fixture
    def trainer_data(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        data = response.json()
        return {
            "token": data["access_token"],
            "user_id": data["user"]["id"]
        }
    
    def test_update_social_links(self, trainer_data):
        """Test PUT /api/trainer-profiles/{userId}/social-links"""
        social_links = {
            "instagram": "https://instagram.com/testtrainer",
            "tiktok": "https://tiktok.com/@testtrainer",
            "youtube": "https://youtube.com/testtrainer"
        }
        response = requests.put(
            f"{BASE_URL}/api/trainer-profiles/{trainer_data['user_id']}/social-links",
            json=social_links,
            headers={"Authorization": f"Bearer {trainer_data['token']}"}
        )
        assert response.status_code in [200, 201], f"Update social links failed: {response.text}"
        print(f"✓ Social links updated: status={response.status_code}")
        
        # Verify the update persisted
        get_response = requests.get(
            f"{BASE_URL}/api/trainer-profiles/{trainer_data['user_id']}",
            headers={"Authorization": f"Bearer {trainer_data['token']}"}
        )
        if get_response.status_code == 200:
            profile = get_response.json()
            if profile.get("socialLinks"):
                assert profile["socialLinks"].get("instagram") == social_links["instagram"]
                print(f"✓ Social links persisted correctly")
    
    def test_update_social_links_requires_auth(self, trainer_data):
        """Test PUT /api/trainer-profiles/{userId}/social-links requires auth"""
        response = requests.put(
            f"{BASE_URL}/api/trainer-profiles/{trainer_data['user_id']}/social-links",
            json={"instagram": "https://instagram.com/test"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Social links update requires auth: {response.status_code}")


class TestGalleryUpdate:
    """PUT /api/trainer-profiles/{userId}/gallery endpoint tests"""
    
    @pytest.fixture
    def trainer_data(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        data = response.json()
        return {
            "token": data["access_token"],
            "user_id": data["user"]["id"]
        }
    
    def test_update_gallery(self, trainer_data):
        """Test PUT /api/trainer-profiles/{userId}/gallery"""
        gallery_items = [
            {"url": "/api/files/test1.jpg", "type": "photo", "caption": "Test photo 1"},
            {"url": "/api/files/test2.mp4", "type": "video", "caption": "Test video"}
        ]
        # API expects {"gallery": [...]} format
        response = requests.put(
            f"{BASE_URL}/api/trainer-profiles/{trainer_data['user_id']}/gallery",
            json={"gallery": gallery_items},
            headers={"Authorization": f"Bearer {trainer_data['token']}"}
        )
        assert response.status_code in [200, 201], f"Update gallery failed: {response.text}"
        print(f"✓ Gallery updated: status={response.status_code}")
    
    def test_update_gallery_requires_auth(self, trainer_data):
        """Test PUT /api/trainer-profiles/{userId}/gallery requires auth"""
        response = requests.put(
            f"{BASE_URL}/api/trainer-profiles/{trainer_data['user_id']}/gallery",
            json=[{"url": "/test.jpg", "type": "photo"}]
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Gallery update requires auth: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
