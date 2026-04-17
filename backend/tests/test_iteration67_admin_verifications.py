"""
Iteration 67: Backend API Tests for Admin Verifications and Bug Fixes
Tests:
- POST /api/auth/login for admin and trainer
- GET /api/admin/verifications/unverified (requires admin auth)
- GET /api/admin/verifications/approved (requires admin auth)
- GET /api/admin/verifications/pending (requires admin auth)
- POST /api/admin/verifications/{trainer_id}/background-check-status (requires admin auth)
- GET /api/admin/dashboard (requires admin auth)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://highlight-vibe-bugs.preview.emergentagent.com"

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"


class TestAuthLogin:
    """Test authentication login endpoints"""
    
    def test_admin_login_returns_access_token(self):
        """POST /api/auth/login returns access_token for admin@rapidreps.com / admin123"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        print(f"Admin login response status: {response.status_code}")
        print(f"Admin login response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert len(data["access_token"]) > 0, "access_token should not be empty"
        assert "user" in data, "Response should contain user object"
        assert data["user"]["email"] == ADMIN_EMAIL, f"User email should be {ADMIN_EMAIL}"
        assert data["user"]["isAdmin"] == True, "User should be admin"
        print(f"PASSED: Admin login returns access_token with isAdmin=True")
    
    def test_trainer_login_returns_access_token(self):
        """POST /api/auth/login returns access_token for test_trainer_iter25@test.com / Test123!"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TRAINER_EMAIL, "password": TRAINER_PASSWORD}
        )
        print(f"Trainer login response status: {response.status_code}")
        print(f"Trainer login response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert len(data["access_token"]) > 0, "access_token should not be empty"
        assert "user" in data, "Response should contain user object"
        assert data["user"]["email"] == TRAINER_EMAIL, f"User email should be {TRAINER_EMAIL}"
        assert "trainer" in data["user"]["roles"], "User should have trainer role"
        print(f"PASSED: Trainer login returns access_token with trainer role")
    
    def test_invalid_credentials_returns_401(self):
        """POST /api/auth/login returns 401 for invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        print(f"Invalid login response status: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"PASSED: Invalid credentials return 401")


@pytest.fixture
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed - skipping admin tests")


@pytest.fixture
def trainer_token():
    """Get trainer authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TRAINER_EMAIL, "password": TRAINER_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Trainer authentication failed - skipping trainer tests")


@pytest.fixture
def trainer_user_id():
    """Get trainer user ID"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TRAINER_EMAIL, "password": TRAINER_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("user", {}).get("id")
    pytest.skip("Trainer authentication failed - skipping trainer tests")


class TestAdminVerificationsUnverified:
    """Test GET /api/admin/verifications/unverified endpoint"""
    
    def test_unverified_trainers_returns_array(self, admin_token):
        """GET /api/admin/verifications/unverified returns array of unverified trainers"""
        response = requests.get(
            f"{BASE_URL}/api/admin/verifications/unverified",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"Unverified trainers response status: {response.status_code}")
        print(f"Unverified trainers response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Response should be an array
        assert isinstance(data, list), f"Response should be an array, got {type(data)}"
        
        # If there are unverified trainers, check structure
        if len(data) > 0:
            trainer = data[0]
            assert "userId" in trainer, "Each trainer should have userId"
            assert "fullName" in trainer, "Each trainer should have fullName"
            assert "email" in trainer, "Each trainer should have email"
            print(f"PASSED: Unverified trainers returns array with {len(data)} trainers")
        else:
            print(f"PASSED: Unverified trainers returns empty array (no unverified trainers)")
    
    def test_unverified_trainers_requires_admin(self, trainer_token):
        """GET /api/admin/verifications/unverified returns 403 for non-admin"""
        response = requests.get(
            f"{BASE_URL}/api/admin/verifications/unverified",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        print(f"Non-admin unverified trainers response status: {response.status_code}")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"PASSED: Unverified trainers endpoint requires admin auth")


class TestAdminVerificationsApproved:
    """Test GET /api/admin/verifications/approved endpoint"""
    
    def test_approved_trainers_returns_array(self, admin_token):
        """GET /api/admin/verifications/approved returns array of approved trainers"""
        response = requests.get(
            f"{BASE_URL}/api/admin/verifications/approved",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"Approved trainers response status: {response.status_code}")
        print(f"Approved trainers response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Response should be an array
        assert isinstance(data, list), f"Response should be an array, got {type(data)}"
        
        # If there are approved trainers, check structure
        if len(data) > 0:
            trainer = data[0]
            assert "userId" in trainer, "Each trainer should have userId"
            assert "fullName" in trainer, "Each trainer should have fullName"
            assert "email" in trainer, "Each trainer should have email"
            print(f"PASSED: Approved trainers returns array with {len(data)} trainers")
        else:
            print(f"PASSED: Approved trainers returns empty array (no approved trainers)")
    
    def test_approved_trainers_requires_admin(self, trainer_token):
        """GET /api/admin/verifications/approved returns 403 for non-admin"""
        response = requests.get(
            f"{BASE_URL}/api/admin/verifications/approved",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        print(f"Non-admin approved trainers response status: {response.status_code}")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"PASSED: Approved trainers endpoint requires admin auth")


class TestAdminVerificationsPending:
    """Test GET /api/admin/verifications/pending endpoint"""
    
    def test_pending_verifications_returns_array(self, admin_token):
        """GET /api/admin/verifications/pending returns pendingVerifications array"""
        response = requests.get(
            f"{BASE_URL}/api/admin/verifications/pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"Pending verifications response status: {response.status_code}")
        print(f"Pending verifications response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Response should have pendingVerifications key
        assert "pendingVerifications" in data, "Response should have pendingVerifications key"
        assert isinstance(data["pendingVerifications"], list), "pendingVerifications should be an array"
        assert "count" in data, "Response should have count key"
        
        # If there are pending verifications, check structure
        if len(data["pendingVerifications"]) > 0:
            verification = data["pendingVerifications"][0]
            assert "profile" in verification, "Each verification should have profile"
            assert "user" in verification, "Each verification should have user"
            print(f"PASSED: Pending verifications returns array with {len(data['pendingVerifications'])} verifications")
        else:
            print(f"PASSED: Pending verifications returns empty array (no pending verifications)")
    
    def test_pending_verifications_requires_admin(self, trainer_token):
        """GET /api/admin/verifications/pending returns 403 for non-admin"""
        response = requests.get(
            f"{BASE_URL}/api/admin/verifications/pending",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        print(f"Non-admin pending verifications response status: {response.status_code}")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"PASSED: Pending verifications endpoint requires admin auth")


class TestAdminBackgroundCheckStatus:
    """Test POST /api/admin/verifications/{trainer_id}/background-check-status endpoint"""
    
    def test_set_background_check_passed(self, admin_token, trainer_user_id):
        """POST /api/admin/verifications/{trainer_id}/background-check-status with status='passed' works"""
        response = requests.post(
            f"{BASE_URL}/api/admin/verifications/{trainer_user_id}/background-check-status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"status": "passed"}
        )
        print(f"Background check status response: {response.status_code}")
        print(f"Background check status response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert data.get("status") == "passed", "Response should have status='passed'"
        print(f"PASSED: Background check status set to 'passed' successfully")
    
    def test_set_background_check_pending(self, admin_token, trainer_user_id):
        """POST /api/admin/verifications/{trainer_id}/background-check-status with status='pending' works"""
        response = requests.post(
            f"{BASE_URL}/api/admin/verifications/{trainer_user_id}/background-check-status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"status": "pending"}
        )
        print(f"Background check pending response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert data.get("status") == "pending", "Response should have status='pending'"
        print(f"PASSED: Background check status set to 'pending' successfully")
    
    def test_set_background_check_failed(self, admin_token, trainer_user_id):
        """POST /api/admin/verifications/{trainer_id}/background-check-status with status='failed' works"""
        response = requests.post(
            f"{BASE_URL}/api/admin/verifications/{trainer_user_id}/background-check-status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"status": "failed"}
        )
        print(f"Background check failed response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert data.get("status") == "failed", "Response should have status='failed'"
        print(f"PASSED: Background check status set to 'failed' successfully")
    
    def test_set_background_check_invalid_status(self, admin_token, trainer_user_id):
        """POST /api/admin/verifications/{trainer_id}/background-check-status with invalid status returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/admin/verifications/{trainer_user_id}/background-check-status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"status": "invalid_status"}
        )
        print(f"Background check invalid status response: {response.status_code}")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"PASSED: Invalid background check status returns 400")
    
    def test_background_check_requires_admin(self, trainer_token, trainer_user_id):
        """POST /api/admin/verifications/{trainer_id}/background-check-status returns 403 for non-admin"""
        response = requests.post(
            f"{BASE_URL}/api/admin/verifications/{trainer_user_id}/background-check-status",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={"status": "passed"}
        )
        print(f"Non-admin background check response: {response.status_code}")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"PASSED: Background check status endpoint requires admin auth")


class TestAdminDashboard:
    """Test GET /api/admin/dashboard endpoint"""
    
    def test_dashboard_returns_stats(self, admin_token):
        """GET /api/admin/dashboard returns totalUsers, totalTrainers stats"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"Admin dashboard response status: {response.status_code}")
        print(f"Admin dashboard response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Check required fields
        assert "totalUsers" in data, "Response should have totalUsers"
        assert "totalTrainers" in data, "Response should have totalTrainers"
        assert "totalTrainees" in data, "Response should have totalTrainees"
        assert "totalSessions" in data, "Response should have totalSessions"
        assert "completedSessions" in data, "Response should have completedSessions"
        
        # Validate data types
        assert isinstance(data["totalUsers"], int), "totalUsers should be an integer"
        assert isinstance(data["totalTrainers"], int), "totalTrainers should be an integer"
        assert isinstance(data["totalTrainees"], int), "totalTrainees should be an integer"
        
        print(f"PASSED: Admin dashboard returns stats - totalUsers={data['totalUsers']}, totalTrainers={data['totalTrainers']}, totalTrainees={data['totalTrainees']}")
    
    def test_dashboard_requires_admin(self, trainer_token):
        """GET /api/admin/dashboard returns 403 for non-admin"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        print(f"Non-admin dashboard response status: {response.status_code}")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"PASSED: Admin dashboard endpoint requires admin auth")


class TestHealthEndpoint:
    """Test health endpoint"""
    
    def test_health_endpoint(self):
        """GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        print(f"Health endpoint response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "healthy", "Health status should be 'healthy'"
        print(f"PASSED: Health endpoint returns healthy status")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
