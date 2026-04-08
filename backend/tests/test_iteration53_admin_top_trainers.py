"""
Iteration 53: Admin Top Trainers - Unknown Trainer Filter Tests
Tests that GET /api/admin/top-trainers does NOT return trainers with fullName='Unknown Trainer'
Also tests admin dashboard and earnings-summary endpoints, plus auth for all roles.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', os.environ.get('REACT_APP_BACKEND_URL', '')).rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"


class TestAuthEndpoints:
    """Test authentication for all user roles"""
    
    def test_admin_login_success(self):
        """Admin login should succeed with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        user = data.get("user", {})
        # Check for admin role - could be in 'role' or 'roles' array or 'isAdmin' flag
        is_admin = user.get("isAdmin", False) or "admin" in user.get("roles", []) or user.get("role") == "admin"
        assert is_admin, f"User should be admin, got: {user}"
        print(f"✓ Admin login successful, user: {user.get('email')}")
    
    def test_trainee_login_success(self):
        """Trainee login should succeed with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        user = data.get("user", {})
        # Check for trainee role - could be in 'role' or 'roles' array
        is_trainee = "trainee" in user.get("roles", []) or user.get("role") == "trainee"
        assert is_trainee, f"User should be trainee, got: {user}"
        print(f"✓ Trainee login successful, user: {user.get('email')}")
    
    def test_trainer_login_success(self):
        """Trainer login should succeed with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        user = data.get("user", {})
        # Check for trainer role - could be in 'role' or 'roles' array
        is_trainer = "trainer" in user.get("roles", []) or user.get("role") == "trainer"
        assert is_trainer, f"User should be trainer, got: {user}"
        print(f"✓ Trainer login successful, user: {user.get('email')}")


class TestAdminTopTrainers:
    """Test GET /api/admin/top-trainers endpoint - Unknown Trainer filter"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_top_trainers_returns_valid_data(self, admin_token):
        """GET /api/admin/top-trainers should return valid leaderboard data"""
        response = requests.get(
            f"{BASE_URL}/api/admin/top-trainers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get top trainers: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "leaderboard" in data, "Response should contain 'leaderboard' key"
        assert "periodDays" in data, "Response should contain 'periodDays' key"
        assert isinstance(data["leaderboard"], list), "Leaderboard should be a list"
        
        print(f"✓ Top trainers endpoint returned {len(data['leaderboard'])} trainers for {data['periodDays']} days")
    
    def test_top_trainers_no_unknown_trainer(self, admin_token):
        """GET /api/admin/top-trainers should NOT return any trainer with fullName='Unknown Trainer'"""
        response = requests.get(
            f"{BASE_URL}/api/admin/top-trainers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get top trainers: {response.text}"
        data = response.json()
        
        leaderboard = data.get("leaderboard", [])
        
        # Check that no trainer has fullName='Unknown Trainer'
        unknown_trainers = [t for t in leaderboard if t.get("fullName") == "Unknown Trainer"]
        assert len(unknown_trainers) == 0, f"Found {len(unknown_trainers)} trainers with 'Unknown Trainer' name - should be filtered out"
        
        # Also check for empty/null names
        invalid_names = [t for t in leaderboard if not t.get("fullName")]
        assert len(invalid_names) == 0, f"Found {len(invalid_names)} trainers with empty/null names"
        
        print(f"✓ No 'Unknown Trainer' entries found in leaderboard (total: {len(leaderboard)} trainers)")
        
        # Print trainer names for verification
        for trainer in leaderboard:
            print(f"  - {trainer.get('fullName')} (sessions: {trainer.get('sessionCount')}, rating: {trainer.get('averageRating')})")
    
    def test_top_trainers_with_custom_params(self, admin_token):
        """GET /api/admin/top-trainers with custom days and limit parameters"""
        response = requests.get(
            f"{BASE_URL}/api/admin/top-trainers?days=30&limit=10",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get top trainers: {response.text}"
        data = response.json()
        
        assert data.get("periodDays") == 30, "Period days should be 30"
        
        # Verify no Unknown Trainer in extended results
        leaderboard = data.get("leaderboard", [])
        unknown_trainers = [t for t in leaderboard if t.get("fullName") == "Unknown Trainer"]
        assert len(unknown_trainers) == 0, "No 'Unknown Trainer' should appear even with extended params"
        
        print(f"✓ Top trainers with days=30, limit=10 returned {len(leaderboard)} trainers, no Unknown Trainer")
    
    def test_top_trainers_requires_admin_auth(self):
        """GET /api/admin/top-trainers should require admin authentication"""
        # Test without auth
        response = requests.get(f"{BASE_URL}/api/admin/top-trainers")
        assert response.status_code in [401, 403], f"Should reject unauthenticated request, got {response.status_code}"
        print("✓ Endpoint correctly rejects unauthenticated requests")
    
    def test_top_trainers_rejects_trainee(self):
        """GET /api/admin/top-trainers should reject trainee users"""
        # Login as trainee
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        if login_resp.status_code != 200:
            pytest.skip("Trainee login failed")
        
        trainee_token = login_resp.json().get("access_token")
        
        response = requests.get(
            f"{BASE_URL}/api/admin/top-trainers",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 403, f"Should reject trainee, got {response.status_code}"
        print("✓ Endpoint correctly rejects trainee users")
    
    def test_top_trainers_rejects_trainer(self):
        """GET /api/admin/top-trainers should reject trainer users"""
        # Login as trainer
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        if login_resp.status_code != 200:
            pytest.skip("Trainer login failed")
        
        trainer_token = login_resp.json().get("access_token")
        
        response = requests.get(
            f"{BASE_URL}/api/admin/top-trainers",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 403, f"Should reject trainer, got {response.status_code}"
        print("✓ Endpoint correctly rejects trainer users")


class TestAdminDashboard:
    """Test GET /api/admin/dashboard endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_dashboard_returns_valid_data(self, admin_token):
        """GET /api/admin/dashboard should return correct dashboard data"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get dashboard: {response.text}"
        data = response.json()
        
        # Verify expected fields
        expected_fields = [
            "totalUsers", "totalTrainers", "totalTrainees", "totalSessions",
            "completedSessions", "totalRevenueCents", "totalRevenueDollars",
            "platformRevenueCents", "platformRevenueDollars",
            "trainerPayoutsCents", "trainerPayoutsDollars",
            "activeMemberships", "activeBoosts", "pendingVerifications"
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify data types
        assert isinstance(data["totalUsers"], int), "totalUsers should be int"
        assert isinstance(data["totalTrainers"], int), "totalTrainers should be int"
        assert isinstance(data["totalTrainees"], int), "totalTrainees should be int"
        assert isinstance(data["totalSessions"], int), "totalSessions should be int"
        
        print(f"✓ Dashboard data valid: {data['totalUsers']} users, {data['totalTrainers']} trainers, {data['totalTrainees']} trainees")


class TestAdminEarningsSummary:
    """Test GET /api/admin/earnings-summary endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_earnings_summary_returns_valid_data(self, admin_token):
        """GET /api/admin/earnings-summary should return correct earnings data"""
        response = requests.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get earnings summary: {response.text}"
        data = response.json()
        
        # Verify expected fields (actual field names from API)
        expected_fields = [
            "totalRevenueCents", "platformRevenueCents", "trainerPayoutsCents",
            "monthRevenueCents", "lastMonthRevenueCents",
            "weekRevenueCents", "lastWeekRevenueCents",
            "dailyBreakdown", "weeklyBreakdown"
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify breakdowns are lists
        assert isinstance(data["dailyBreakdown"], list), "dailyBreakdown should be a list"
        assert isinstance(data["weeklyBreakdown"], list), "weeklyBreakdown should be a list"
        
        print(f"✓ Earnings summary valid: total revenue ${data['totalRevenueCents']/100:.2f}, platform cut ${data['platformRevenueCents']/100:.2f}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
