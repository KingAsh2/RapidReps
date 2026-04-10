"""
Iteration 58: Dark Theme UI Fixes - Backend API Tests
Tests authentication and core endpoints after dark theme migration
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vibe-highlight-cards.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["isAdmin"] == True
        print(f"✓ Admin login successful: {data['user']['fullName']}")
    
    def test_trainer_login_success(self):
        """Test trainer login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TRAINER_EMAIL, "password": TRAINER_PASSWORD}
        )
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TRAINER_EMAIL
        print(f"✓ Trainer login successful: {data['user']['fullName']}")
    
    def test_trainee_login_success(self):
        """Test trainee login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TRAINEE_EMAIL, "password": TRAINEE_PASSWORD}
        )
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TRAINEE_EMAIL
        print(f"✓ Trainee login successful: {data['user']['fullName']}")
    
    def test_invalid_credentials_rejected(self):
        """Test that invalid credentials are rejected"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")


class TestAuthMe:
    """GET /api/auth/me endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        return response.json().get("access_token")
    
    @pytest.fixture
    def trainer_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TRAINER_EMAIL, "password": TRAINER_PASSWORD}
        )
        return response.json().get("access_token")
    
    @pytest.fixture
    def trainee_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TRAINEE_EMAIL, "password": TRAINEE_PASSWORD}
        )
        return response.json().get("access_token")
    
    def test_auth_me_admin(self, admin_token):
        """Test GET /api/auth/me returns admin user data"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["isAdmin"] == True
        print(f"✓ Auth me (admin) successful: {data['fullName']}")
    
    def test_auth_me_trainer(self, trainer_token):
        """Test GET /api/auth/me returns trainer user data"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        data = response.json()
        assert data["email"] == TRAINER_EMAIL
        assert "trainer" in data.get("roles", [])
        print(f"✓ Auth me (trainer) successful: {data['fullName']}")
    
    def test_auth_me_trainee(self, trainee_token):
        """Test GET /api/auth/me returns trainee user data"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        data = response.json()
        assert data["email"] == TRAINEE_EMAIL
        assert "trainee" in data.get("roles", [])
        print(f"✓ Auth me (trainee) successful: {data['fullName']}")
    
    def test_auth_me_requires_token(self):
        """Test GET /api/auth/me requires authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Auth me correctly requires authentication")
    
    def test_auth_me_invalid_token(self):
        """Test GET /api/auth/me rejects invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Auth me correctly rejects invalid token")


class TestTrainerProfiles:
    """Trainer profile endpoint tests"""
    
    @pytest.fixture
    def trainer_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TRAINER_EMAIL, "password": TRAINER_PASSWORD}
        )
        data = response.json()
        return data.get("access_token"), data.get("user", {}).get("id")
    
    def test_get_trainer_profile(self, trainer_token):
        """Test GET /api/trainer-profiles/{userId}"""
        token, user_id = trainer_token
        if not user_id:
            pytest.skip("No trainer user ID available")
        
        response = requests.get(
            f"{BASE_URL}/api/trainer-profiles/{user_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        # Profile may or may not exist
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Trainer profile retrieved: {data.get('userId', 'N/A')}")
        else:
            print("✓ Trainer profile endpoint working (no profile exists)")


class TestAdminEndpoints:
    """Admin-only endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        return response.json().get("access_token")
    
    @pytest.fixture
    def trainer_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TRAINER_EMAIL, "password": TRAINER_PASSWORD}
        )
        return response.json().get("access_token")
    
    def test_admin_earnings_summary(self, admin_token):
        """Test GET /api/admin/earnings-summary requires admin"""
        response = requests.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin earnings failed: {response.text}"
        print("✓ Admin earnings summary accessible")
    
    def test_admin_earnings_requires_admin(self, trainer_token):
        """Test GET /api/admin/earnings-summary rejects non-admin"""
        response = requests.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Admin earnings correctly restricted to admin only")
    
    def test_admin_earnings_requires_auth(self):
        """Test GET /api/admin/earnings-summary requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/earnings-summary")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Admin earnings correctly requires authentication")


class TestHealthEndpoints:
    """Health check and basic endpoint tests"""
    
    def test_health_check(self):
        """Test basic health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        # Health endpoint may or may not exist
        if response.status_code == 200:
            print("✓ Health endpoint available")
        else:
            print(f"ℹ Health endpoint returned {response.status_code}")
    
    def test_api_root(self):
        """Test API root responds"""
        response = requests.get(f"{BASE_URL}/api/")
        # Root may redirect or return various status codes
        assert response.status_code in [200, 307, 404], f"Unexpected status: {response.status_code}"
        print(f"✓ API root responds with status {response.status_code}")


class TestTrainerSessions:
    """Trainer session endpoint tests"""
    
    @pytest.fixture
    def trainer_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TRAINER_EMAIL, "password": TRAINER_PASSWORD}
        )
        return response.json().get("access_token")
    
    def test_get_trainer_sessions(self, trainer_token):
        """Test GET /api/trainer/sessions"""
        response = requests.get(
            f"{BASE_URL}/api/trainer/sessions",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Get sessions failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Trainer sessions retrieved: {len(data)} sessions")


class TestTraineeSessions:
    """Trainee session endpoint tests"""
    
    @pytest.fixture
    def trainee_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TRAINEE_EMAIL, "password": TRAINEE_PASSWORD}
        )
        return response.json().get("access_token")
    
    def test_get_trainee_sessions(self, trainee_token):
        """Test GET /api/trainee/sessions"""
        response = requests.get(
            f"{BASE_URL}/api/trainee/sessions",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200, f"Get sessions failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Trainee sessions retrieved: {len(data)} sessions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
