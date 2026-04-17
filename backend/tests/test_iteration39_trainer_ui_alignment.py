"""
Iteration 39: Trainer UI/UX Alignment Testing
- Tests backend API endpoints to ensure backend is still functional
- Focus: health check, auth login, trainer sessions, trainer earnings, trainer profiles
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://highlight-vibe-bugs.preview.emergentagent.com"


class TestHealthCheck:
    """Test API health endpoint"""
    
    def test_health_endpoint(self):
        """GET /api/health should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ Health check passed: {data}")


class TestAuthLogin:
    """Test authentication endpoints"""
    
    def test_admin_login_success(self):
        """POST /api/auth/login with admin credentials should return token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "admin@rapidreps.com"
        assert data["user"]["isAdmin"] == True
        print(f"✓ Admin login successful: roles={data['user']['roles']}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login with wrong password should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected with 401")


class TestTrainerSessions:
    """Test trainer session listing API"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for trainer tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not authenticate")
    
    def test_trainer_sessions_endpoint(self, auth_token):
        """GET /api/trainer/sessions should return sessions list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/sessions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Trainer sessions endpoint returns list with {len(data)} sessions")


class TestTrainerEarnings:
    """Test trainer earnings API"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not authenticate")
    
    def test_trainer_earnings_endpoint(self, auth_token):
        """GET /api/trainer/earnings should return earnings data"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/earnings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Check for expected fields
        expected_fields = ["totalEarningsCents", "weekEarningsCents", "monthEarningsCents", "pendingBalanceCents"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        print(f"✓ Trainer earnings endpoint returns data: totalEarnings=${data['totalEarningsCents']/100:.2f}")


class TestTrainerProfiles:
    """Test trainer profile API"""
    
    @pytest.fixture
    def auth_token_and_user(self):
        """Get auth token and user ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            data = response.json()
            return data["access_token"], data["user"]["id"]
        pytest.skip("Could not authenticate")
    
    def test_trainer_profile_endpoint(self, auth_token_and_user):
        """GET /api/trainer-profiles/{userId} should return profile"""
        token, user_id = auth_token_and_user
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/trainer-profiles/{user_id}", headers=headers)
        # Profile may not exist for admin, which is okay
        if response.status_code == 404:
            print(f"✓ Trainer profile endpoint returns 404 for user without trainer profile (expected)")
        else:
            assert response.status_code == 200
            data = response.json()
            assert "userId" in data
            print(f"✓ Trainer profile endpoint returns data for user {user_id}")


class TestAuthMe:
    """Test auth/me endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not authenticate")
    
    def test_auth_me_endpoint(self, auth_token):
        """GET /api/auth/me should return current user"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "fullName" in data
        assert "roles" in data
        print(f"✓ Auth/me endpoint returns user data: {data['email']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
