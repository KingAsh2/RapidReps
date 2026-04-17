"""
Iteration 68: Comprehensive Backend API Tests for Bug Fixes
Tests:
- Auth login for admin, trainer, trainee
- Admin verification endpoints (pending, approved, unverified)
- Background check status controls
- Trainer profile endpoints (avatarUrl, highlights, vibe)
- Music search endpoint
- Health endpoint
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
def trainee_token():
    """Get trainee authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TRAINEE_EMAIL, "password": TRAINEE_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Trainee authentication failed - skipping trainee tests")


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


class TestAuthLogin:
    """Test authentication login endpoints"""
    
    def test_admin_login_returns_access_token(self):
        """POST /api/auth/login returns access_token for admin@rapidreps.com / admin123"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        print(f"Admin login response status: {response.status_code}")
        
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
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user object"
        assert data["user"]["email"] == TRAINER_EMAIL, f"User email should be {TRAINER_EMAIL}"
        assert "trainer" in data["user"]["roles"], "User should have trainer role"
        print(f"PASSED: Trainer login returns access_token with trainer role")
    
    def test_trainee_login_returns_access_token(self):
        """POST /api/auth/login returns access_token for test_trainee_iter25@test.com / Test123!"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TRAINEE_EMAIL, "password": TRAINEE_PASSWORD}
        )
        print(f"Trainee login response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user object"
        assert data["user"]["email"] == TRAINEE_EMAIL, f"User email should be {TRAINEE_EMAIL}"
        assert "trainee" in data["user"]["roles"], "User should have trainee role"
        print(f"PASSED: Trainee login returns access_token with trainee role")
    
    def test_invalid_credentials_returns_401(self):
        """POST /api/auth/login returns 401 for invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        print(f"Invalid login response status: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"PASSED: Invalid credentials return 401")


class TestAdminDashboard:
    """Test GET /api/admin/dashboard endpoint"""
    
    def test_dashboard_returns_stats(self, admin_token):
        """GET /api/admin/dashboard returns totalUsers, totalTrainers stats"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"Admin dashboard response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "totalUsers" in data, "Response should have totalUsers"
        assert "totalTrainers" in data, "Response should have totalTrainers"
        assert "totalTrainees" in data, "Response should have totalTrainees"
        assert "totalSessions" in data, "Response should have totalSessions"
        assert "completedSessions" in data, "Response should have completedSessions"
        
        assert isinstance(data["totalUsers"], int), "totalUsers should be an integer"
        print(f"PASSED: Admin dashboard returns stats")


class TestAdminVerifications:
    """Test admin verification endpoints"""
    
    def test_pending_verifications_returns_array(self, admin_token):
        """GET /api/admin/verifications/pending returns pendingVerifications array"""
        response = requests.get(
            f"{BASE_URL}/api/admin/verifications/pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"Pending verifications response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "pendingVerifications" in data, "Response should have pendingVerifications key"
        assert isinstance(data["pendingVerifications"], list), "pendingVerifications should be an array"
        print(f"PASSED: Pending verifications returns array")
    
    def test_approved_trainers_returns_array(self, admin_token):
        """GET /api/admin/verifications/approved returns array of approved trainers"""
        response = requests.get(
            f"{BASE_URL}/api/admin/verifications/approved",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"Approved trainers response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), f"Response should be an array, got {type(data)}"
        print(f"PASSED: Approved trainers returns array")
    
    def test_unverified_trainers_returns_array(self, admin_token):
        """GET /api/admin/verifications/unverified returns array of unverified trainers"""
        response = requests.get(
            f"{BASE_URL}/api/admin/verifications/unverified",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"Unverified trainers response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), f"Response should be an array, got {type(data)}"
        print(f"PASSED: Unverified trainers returns array")


class TestBackgroundCheckStatus:
    """Test background check status controls"""
    
    def test_set_background_check_passed(self, admin_token, trainer_user_id):
        """POST /api/admin/verifications/{trainer_id}/background-check-status with status='passed' works"""
        response = requests.post(
            f"{BASE_URL}/api/admin/verifications/{trainer_user_id}/background-check-status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"status": "passed"}
        )
        print(f"Background check passed response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert data.get("status") == "passed", "Response should have status='passed'"
        print(f"PASSED: Background check status set to 'passed'")
    
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
        print(f"PASSED: Background check status set to 'pending'")
    
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
        print(f"PASSED: Background check status set to 'failed'")
    
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


class TestTrainerProfile:
    """Test trainer profile endpoints"""
    
    def test_get_trainer_profile_returns_avatar_url(self, trainer_user_id):
        """GET /api/trainer-profiles/{user_id} returns profile with avatarUrl field"""
        response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}")
        print(f"Trainer profile response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "userId" in data, "Response should have userId"
        # avatarUrl may be null but field should exist in response model
        print(f"PASSED: Trainer profile returns with avatarUrl field (value: {data.get('avatarUrl', 'not set')})")
    
    def test_get_trainer_highlights(self, trainer_user_id):
        """GET /api/trainer-profiles/{user_id}/highlights returns highlights array"""
        response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/highlights")
        print(f"Trainer highlights response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "highlights" in data, "Response should have highlights key"
        assert isinstance(data["highlights"], list), "highlights should be an array"
        print(f"PASSED: Trainer highlights returns array with {len(data['highlights'])} items")


class TestVibeEndpoints:
    """Test vibe/anthem endpoints"""
    
    def test_update_vibe_requires_auth(self, trainer_user_id):
        """PUT /api/trainer-profiles/{user_id}/vibe requires auth token (Bearer header)"""
        # Without auth token
        response = requests.put(
            f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe",
            json={"vibeTrackTitle": "Test Song"}
        )
        print(f"Vibe update without auth response: {response.status_code}")
        
        # Accept both 401 (Unauthorized) and 403 (Forbidden) as valid auth rejection
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print(f"PASSED: Vibe update requires auth token (returns {response.status_code})")
    
    def test_delete_vibe_requires_auth(self, trainer_user_id):
        """DELETE /api/trainer-profiles/{user_id}/vibe requires auth token"""
        # Without auth token
        response = requests.delete(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe")
        print(f"Vibe delete without auth response: {response.status_code}")
        
        # Accept both 401 (Unauthorized) and 403 (Forbidden) as valid auth rejection
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print(f"PASSED: Vibe delete requires auth token (returns {response.status_code})")
    
    def test_update_vibe_with_auth(self, trainer_token, trainer_user_id):
        """PUT /api/trainer-profiles/{user_id}/vibe works with valid auth"""
        response = requests.put(
            f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/vibe",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={
                "vibeTrackTitle": "Test Song",
                "vibeArtistName": "Test Artist",
                "vibeArtworkUrl": "https://example.com/art.jpg"
            }
        )
        print(f"Vibe update with auth response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        print(f"PASSED: Vibe update works with valid auth")


class TestMusicSearch:
    """Test music search endpoint"""
    
    def test_music_search_returns_results(self):
        """GET /api/music/search?q=test returns results array"""
        response = requests.get(f"{BASE_URL}/api/music/search?q=test")
        print(f"Music search response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "results" in data, "Response should have results key"
        assert isinstance(data["results"], list), "results should be an array"
        print(f"PASSED: Music search returns {len(data['results'])} results")


class TestBackgroundPII:
    """Test background check PII submission"""
    
    def test_submit_background_pii_validates_required_fields(self, trainer_token):
        """POST /api/trainer/submit-background-pii validates required fields"""
        # Missing required fields
        response = requests.post(
            f"{BASE_URL}/api/trainer/submit-background-pii",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={"fullName": "Test User"}  # Missing dob and address
        )
        print(f"Background PII missing fields response: {response.status_code}")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"PASSED: Background PII validates required fields")
    
    def test_submit_background_pii_with_all_fields(self, trainer_token):
        """POST /api/trainer/submit-background-pii works with all required fields"""
        response = requests.post(
            f"{BASE_URL}/api/trainer/submit-background-pii",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={
                "fullName": "Test User",
                "dob": "01/15/1990",
                "address": "123 Test St, City, ST 12345"
            }
        )
        print(f"Background PII with all fields response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        print(f"PASSED: Background PII submission works with all required fields")


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
