"""
Test file for Iteration 34 - UI/UX Updates (Safety Center, Report Issue, Share Profile)
Testing backend endpoints and verifying frontend code compliance.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "admin@rapidreps.com",
                "password": "admin123"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        user_data = data.get("user", {})
        # User may have 'roles' array instead of 'role' field
        user_roles = user_data.get("roles", [])
        is_admin = "admin" in user_roles or user_data.get("role") == "admin" or user_data.get("isAdmin") == True
        assert is_admin, f"User should be admin, got roles: {user_roles}"
        print(f"✓ Admin login successful")
        return data["access_token"]

    def test_admin_dashboard(self):
        """Test admin dashboard endpoint"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@rapidreps.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Get dashboard
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify dashboard contains expected fields
        expected_fields = ["totalUsers", "totalTrainers", "totalTrainees", "totalSessions"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        print(f"✓ Admin dashboard returns expected data")


class TestSafetyReportEndpoint:
    """Safety report endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: login as admin to get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@rapidreps.com", "password": "admin123"}
        )
        if response.status_code == 200:
            self.token = response.json()["access_token"]
        else:
            pytest.skip("Could not login as admin")
    
    def test_safety_report_submission(self):
        """Test safety report endpoint accepts required fields"""
        response = requests.post(
            f"{BASE_URL}/api/safety/report",
            json={
                "reportedUserId": "test-user-123",
                "reason": "safety",
                "context": "Test safety report from iteration 34 testing",
                "contentType": "session"
            },
            headers={"Authorization": f"Bearer {self.token}"}
        )
        # Should be 200 or 201 for successful report
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        print(f"✓ Safety report submission successful")

    def test_safety_report_missing_fields(self):
        """Test safety report rejects incomplete submissions"""
        response = requests.post(
            f"{BASE_URL}/api/safety/report",
            json={
                "reportedUserId": "test-user-123"
                # Missing reason, context
            },
            headers={"Authorization": f"Bearer {self.token}"}
        )
        # Should reject with 422 validation error
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print(f"✓ Safety report validation works correctly")


class TestChangePassword:
    """Change password endpoint tests"""
    
    def test_change_password_wrong_current(self):
        """Test change password rejects wrong current password"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@rapidreps.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Try to change password with wrong current password
        response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            json={
                "currentPassword": "wrongpassword",
                "newPassword": "newpassword123"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        # Should be rejected
        assert response.status_code in [400, 401, 403], f"Expected 400/401/403, got {response.status_code}"
        print(f"✓ Change password rejects wrong current password")

    def test_change_password_short_new_password(self):
        """Test change password rejects too short new password"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@rapidreps.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            json={
                "currentPassword": "admin123",
                "newPassword": "short"  # Too short
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        # Should be rejected for too short
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print(f"✓ Change password rejects short new password")


class TestHealthEndpoints:
    """Basic health and connectivity tests"""
    
    def test_api_health(self):
        """Test API is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print(f"✓ API health check passed")
    
    def test_auth_me_unauthorized(self):
        """Test /auth/me requires authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        # 401 or 403 are both valid unauthorized responses
        assert response.status_code in [401, 403]
        print(f"✓ Auth endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
