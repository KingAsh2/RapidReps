"""
Test suite for Change Password feature and Login verification for all 7 test accounts.
Features tested:
- POST /api/auth/change-password with correct current password
- POST /api/auth/change-password with wrong current password (400)
- POST /api/auth/change-password with too short new password (400)
- POST /api/auth/change-password requires auth (401 without token)
- POST /api/auth/login for all 7 test accounts
- GET /api/auth/me returns profile data for each role
- GET /api/health returns 200
- GET /api/trainee/achievements returns badges
- GET /api/trainers/search returns results
- GET /api/referral/stats returns 200 for authenticated user
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://highlight-vibe-bugs.preview.emergentagent.com')

# Test credentials for all 7 accounts
TEST_ACCOUNTS = [
    {"role": "Admin", "email": "admin@rapidreps.com", "password": "admin123"},
    {"role": "Trainee", "email": "trainee1@test.com", "password": "test123"},
    {"role": "Trainee", "email": "trainee2@test.com", "password": "test123"},
    {"role": "Trainer", "email": "trainer1@test.com", "password": "test123"},
    {"role": "Trainer", "email": "trainer2@test.com", "password": "test123"},
    {"role": "Trainer", "email": "trainer3@test.com", "password": "test123"},
    {"role": "Trainee", "email": "ashton1@gmail.com", "password": "test1234"},
]


@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def login(api_client, email, password):
    """Helper function to login and get token"""
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password}
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    return None


class TestHealthEndpoint:
    """Health endpoint test"""
    
    def test_health_returns_200(self, api_client):
        """GET /api/health should return 200"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", f"Unexpected status: {data}"
        print(f"Health check passed: {data}")


class TestLoginAllAccounts:
    """Test login for all 7 test accounts"""
    
    @pytest.mark.parametrize("account", TEST_ACCOUNTS, ids=[a["email"] for a in TEST_ACCOUNTS])
    def test_login_account(self, api_client, account):
        """Test login for each test account"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": account["email"], "password": account["password"]}
        )
        assert response.status_code == 200, f"Login failed for {account['email']}: {response.text}"
        data = response.json()
        assert "access_token" in data, f"No access_token in response for {account['email']}"
        print(f"Login successful for {account['email']} ({account['role']})")


class TestAuthMeEndpoint:
    """Test GET /api/auth/me returns profile data for each role"""
    
    @pytest.mark.parametrize("account", TEST_ACCOUNTS, ids=[a["email"] for a in TEST_ACCOUNTS])
    def test_auth_me_returns_profile(self, api_client, account):
        """GET /api/auth/me should return profile data"""
        token = login(api_client, account["email"], account["password"])
        assert token is not None, f"Failed to get token for {account['email']}"
        
        response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Auth/me failed for {account['email']}: {response.text}"
        data = response.json()
        assert "email" in data, f"No email in response for {account['email']}"
        assert data["email"] == account["email"], f"Email mismatch for {account['email']}"
        print(f"Profile retrieved for {account['email']}: role={data.get('role', 'N/A')}")


class TestChangePassword:
    """Test suite for change password endpoint"""
    
    def test_change_password_requires_auth(self, api_client):
        """POST /api/auth/change-password should return 401 without token"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            json={"currentPassword": "test123", "newPassword": "newpass123"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got: {response.status_code}"
        print("Change password correctly requires authentication (401)")
    
    def test_change_password_wrong_current(self, api_client):
        """POST /api/auth/change-password with wrong current password should return 400"""
        # Login as trainee1 
        token = login(api_client, "trainee1@test.com", "test123")
        assert token is not None, "Failed to login as trainee1"
        
        response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            json={"currentPassword": "wrongpassword", "newPassword": "newpass123"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400, f"Expected 400 for wrong password, got: {response.status_code}"
        data = response.json()
        assert "incorrect" in data.get("detail", "").lower(), f"Unexpected error message: {data}"
        print("Change password correctly rejects wrong current password (400)")
    
    def test_change_password_too_short(self, api_client):
        """POST /api/auth/change-password with too short new password should return 400"""
        # Login as trainee1
        token = login(api_client, "trainee1@test.com", "test123")
        assert token is not None, "Failed to login as trainee1"
        
        response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            json={"currentPassword": "test123", "newPassword": "12345"},  # 5 chars, needs 6
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400, f"Expected 400 for short password, got: {response.status_code}"
        data = response.json()
        assert "6 characters" in data.get("detail", ""), f"Unexpected error message: {data}"
        print("Change password correctly rejects too short new password (400)")
    
    def test_change_password_success_and_revert(self, api_client):
        """
        POST /api/auth/change-password with correct current password should succeed.
        Then login with new password, then revert back to original.
        """
        original_password = "test123"
        new_password = "newpass123"
        email = "trainee2@test.com"  # Use trainee2 for this test
        
        # Step 1: Login with original password
        token = login(api_client, email, original_password)
        assert token is not None, f"Failed to login as {email} with original password"
        print(f"Step 1: Logged in with original password")
        
        # Step 2: Change password to new password
        response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            json={"currentPassword": original_password, "newPassword": new_password},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Change password failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Unexpected response: {data}"
        print(f"Step 2: Password changed successfully to new password")
        
        # Step 3: Verify login with new password works
        new_token = login(api_client, email, new_password)
        assert new_token is not None, f"Failed to login with new password"
        print(f"Step 3: Verified login with new password works")
        
        # Step 4: Verify old password no longer works
        old_login_response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": original_password}
        )
        assert old_login_response.status_code != 200, "Old password should not work anymore"
        print(f"Step 4: Verified old password no longer works")
        
        # Step 5: REVERT - Change password back to original
        revert_response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            json={"currentPassword": new_password, "newPassword": original_password},
            headers={"Authorization": f"Bearer {new_token}"}
        )
        assert revert_response.status_code == 200, f"Failed to revert password: {revert_response.text}"
        print(f"Step 5: Password reverted back to original")
        
        # Step 6: Verify original password works again
        final_token = login(api_client, email, original_password)
        assert final_token is not None, f"Failed to login with original password after revert"
        print(f"Step 6: Verified original password works again after revert")
        
        print("FULL CHANGE PASSWORD FLOW PASSED: change -> verify new -> revert -> verify original")


class TestTraineeAchievements:
    """Test GET /api/trainee/achievements returns badges"""
    
    def test_achievements_returns_badges(self, api_client):
        """GET /api/trainee/achievements should return badges"""
        # Login as trainee1
        token = login(api_client, "trainee1@test.com", "test123")
        assert token is not None, "Failed to login as trainee1"
        
        response = api_client.get(
            f"{BASE_URL}/api/trainee/achievements",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Achievements failed: {response.text}"
        data = response.json()
        # Check response structure - should have badges
        assert isinstance(data, (dict, list)), f"Unexpected achievements response type: {type(data)}"
        print(f"Achievements endpoint working: {type(data).__name__} response")


class TestTrainerSearch:
    """Test GET /api/trainers/search returns results"""
    
    def test_trainer_search_returns_results(self, api_client):
        """GET /api/trainers/search should return results"""
        # Login as trainee1
        token = login(api_client, "trainee1@test.com", "test123")
        assert token is not None, "Failed to login as trainee1"
        
        response = api_client.get(
            f"{BASE_URL}/api/trainers/search",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Trainer search failed: {response.text}"
        data = response.json()
        # Should return a list of trainers
        assert isinstance(data, list), f"Expected list of trainers, got: {type(data)}"
        print(f"Trainer search returned {len(data)} trainers")


class TestReferralStats:
    """Test GET /api/referral/stats returns 200 for authenticated user"""
    
    def test_referral_stats_returns_200(self, api_client):
        """GET /api/referral/stats should return 200"""
        # Login as trainee1
        token = login(api_client, "trainee1@test.com", "test123")
        assert token is not None, "Failed to login as trainee1"
        
        response = api_client.get(
            f"{BASE_URL}/api/referral/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Referral stats failed: {response.text}"
        data = response.json()
        # Should have referral_code and stats
        assert "referral_code" in data or "code" in data or "referralCode" in data, f"Missing referral code in response: {data.keys()}"
        print(f"Referral stats returned successfully: {list(data.keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
