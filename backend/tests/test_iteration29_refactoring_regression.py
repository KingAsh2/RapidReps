"""
Test Iteration 29: RapidReps Refactoring Regression Tests

Tests for verifying all API endpoints still work correctly after the frontend refactoring.
This is a backend-only test as the main agent clarified this is a React Native/Expo app.

Endpoints tested:
- Admin login: POST /api/auth/login (admin@rapidreps.com)
- Admin dashboard: GET /api/admin/dashboard
- Admin users list: GET /api/admin/users
- Admin verifications: GET /api/admin/verifications/pending
- Admin sessions: GET /api/admin/sessions
- Admin transactions: GET /api/admin/transactions-enriched
- Admin payouts: GET /api/admin/payouts/pending, GET /api/admin/payouts/history
- Admin top trainers: GET /api/admin/top-trainers
- Trainee features: GET /api/trainee/recent-trainers, GET /api/trainee/streak, GET /api/trainee/favorite-availability
- Trainer go-live: POST /api/trainer/go-live
- Stripe connect: GET /api/trainer/connect/status
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_PREFIX = f"TEST_ITER29_{datetime.utcnow().strftime('%H%M%S')}_"


class TestAdminAuthentication:
    """Test admin login flow"""
    
    def test_admin_login_success(self):
        """POST /api/auth/login should work with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        
        # Verify token field (note: it's access_token, not token)
        assert "access_token" in data, "Response should contain access_token field"
        assert "user" in data, "Response should contain user field"
        assert data["user"]["isAdmin"] == True, "Admin user should have isAdmin=True"
        assert data["user"]["email"] == "admin@rapidreps.com"
        
        print(f"✓ Admin login successful: {data['user']['fullName']}")
        return data["access_token"]
    
    def test_admin_login_invalid_credentials(self):
        """Login with wrong password should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestAdminDashboard:
    """Test admin dashboard statistics endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_admin_dashboard_returns_stats(self, admin_token):
        """GET /api/admin/dashboard should return dashboard statistics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        # Verify expected fields
        expected_fields = [
            "totalUsers", "totalTrainers", "totalTrainees", "totalSessions",
            "completedSessions", "totalRevenueCents", "platformRevenueCents",
            "trainerPayoutsCents", "activeMemberships", "activeBoosts", "pendingVerifications"
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
            assert isinstance(data[field], int), f"Field {field} should be an integer"
        
        print(f"✓ Dashboard stats: {data['totalUsers']} users, {data['totalSessions']} sessions, ${data['totalRevenueCents']/100:.2f} revenue")
    
    def test_admin_dashboard_requires_auth(self):
        """Dashboard should require authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code in [401, 403]
    
    def test_admin_dashboard_requires_admin_role(self):
        """Dashboard should require admin role"""
        # Create a regular user
        unique_id = str(uuid.uuid4())[:8]
        signup_resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Regular User {unique_id}",
            "email": f"{TEST_PREFIX}regular_{unique_id}@test.com",
            "phone": "+1555000100",
            "password": "test123",
            "roles": ["trainee"]
        })
        if signup_resp.status_code != 200:
            pytest.skip("Could not create test user")
        
        token = signup_resp.json()["access_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, "Non-admin should get 403"


class TestAdminUsersList:
    """Test admin users list endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_admin_users_list(self, admin_token):
        """GET /api/admin/users should return users with pagination"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Users list failed: {response.text}"
        data = response.json()
        
        # Verify pagination structure
        assert "users" in data, "Response should contain users array"
        assert "total" in data, "Response should contain total count"
        assert isinstance(data["users"], list)
        assert isinstance(data["total"], int)
        
        if len(data["users"]) > 0:
            user = data["users"][0]
            assert "id" in user or "_id" in user
            assert "email" in user
            assert "fullName" in user
            assert "roles" in user
        
        print(f"✓ Users list returned {len(data['users'])} users, total: {data['total']}")
    
    def test_admin_users_list_with_pagination(self, admin_token):
        """Users list should support skip and limit parameters"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users?skip=0&limit=5",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["users"]) <= 5
    
    def test_admin_users_list_with_role_filter(self, admin_token):
        """Users list should support role filtering"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users?role=trainer",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned users should have trainer role
        for user in data["users"]:
            assert "trainer" in user.get("roles", [])
        
        print(f"✓ Trainer filter returned {len(data['users'])} trainers")


class TestAdminVerifications:
    """Test admin verifications endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_admin_pending_verifications(self, admin_token):
        """GET /api/admin/verifications/pending should return pending verifications"""
        response = requests.get(
            f"{BASE_URL}/api/admin/verifications/pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Pending verifications failed: {response.text}"
        data = response.json()
        
        # Response format: {"pendingVerifications": [...], "count": N}
        assert "pendingVerifications" in data, "Response should contain pendingVerifications array"
        assert "count" in data, "Response should contain count"
        assert isinstance(data["pendingVerifications"], list)
        
        print(f"✓ Pending verifications: {data['count']} trainers")
    
    def test_admin_verifications_requires_admin(self):
        """Verifications endpoint should require admin role"""
        response = requests.get(f"{BASE_URL}/api/admin/verifications/pending")
        assert response.status_code in [401, 403]


class TestAdminSessions:
    """Test admin sessions endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_admin_sessions_list(self, admin_token):
        """GET /api/admin/sessions should return sessions with filters"""
        response = requests.get(
            f"{BASE_URL}/api/admin/sessions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Sessions list failed: {response.text}"
        data = response.json()
        
        # Response should have sessions array
        assert "sessions" in data, "Response should contain sessions array"
        assert isinstance(data["sessions"], list)
        
        if len(data["sessions"]) > 0:
            session = data["sessions"][0]
            # Verify session has required fields
            assert "id" in session or "_id" in session
        
        print(f"✓ Sessions list returned {len(data['sessions'])} sessions")
    
    def test_admin_sessions_with_status_filter(self, admin_token):
        """Sessions list should support status filtering"""
        response = requests.get(
            f"{BASE_URL}/api/admin/sessions?status=completed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200


class TestAdminTransactions:
    """Test admin transactions endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_admin_transactions_enriched(self, admin_token):
        """GET /api/admin/transactions-enriched should return transactions with user names"""
        response = requests.get(
            f"{BASE_URL}/api/admin/transactions-enriched",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Transactions failed: {response.text}"
        data = response.json()
        
        # Response should have transactions array
        assert "transactions" in data, "Response should contain transactions array"
        assert isinstance(data["transactions"], list)
        
        print(f"✓ Transactions returned {len(data['transactions'])} records")


class TestAdminPayouts:
    """Test admin payouts endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_admin_pending_payouts(self, admin_token):
        """GET /api/admin/payouts/pending should return trainers eligible for payout"""
        response = requests.get(
            f"{BASE_URL}/api/admin/payouts/pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Pending payouts failed: {response.text}"
        data = response.json()
        
        # Response should be a list or have results array
        if isinstance(data, list):
            print(f"✓ Pending payouts: {len(data)} trainers")
        elif isinstance(data, dict):
            # Some endpoints wrap in object
            if "results" in data:
                print(f"✓ Pending payouts: {len(data['results'])} trainers")
            else:
                print(f"✓ Pending payouts endpoint returned: {list(data.keys())}")
    
    def test_admin_payout_history(self, admin_token):
        """GET /api/admin/payouts/history should return payout history"""
        response = requests.get(
            f"{BASE_URL}/api/admin/payouts/history",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Payout history failed: {response.text}"
        data = response.json()
        
        # Response should be a list
        if isinstance(data, list):
            print(f"✓ Payout history: {len(data)} records")
        elif isinstance(data, dict) and "payouts" in data:
            print(f"✓ Payout history: {len(data['payouts'])} records")


class TestAdminTopTrainers:
    """Test admin top trainers endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_admin_top_trainers(self, admin_token):
        """GET /api/admin/top-trainers should return top trainers by sessions"""
        response = requests.get(
            f"{BASE_URL}/api/admin/top-trainers?days=7&limit=5",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Top trainers failed: {response.text}"
        data = response.json()
        
        # Response format: {"leaderboard": [...], "periodDays": N}
        assert "leaderboard" in data, "Response should contain leaderboard array"
        assert "periodDays" in data, "Response should contain periodDays"
        assert isinstance(data["leaderboard"], list)
        assert len(data["leaderboard"]) <= 5, "Should return at most 5 trainers"
        
        print(f"✓ Top trainers: {len(data['leaderboard'])} trainers in past {data['periodDays']} days")
    
    def test_admin_top_trainers_different_periods(self, admin_token):
        """Top trainers should work with different day ranges"""
        for days in [7, 30]:
            response = requests.get(
                f"{BASE_URL}/api/admin/top-trainers?days={days}&limit=10",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200, f"Top trainers for {days} days failed"


class TestTraineeConvenienceFeatures:
    """Test trainee convenience features"""
    
    @pytest.fixture(scope="class")
    def trainee_token(self):
        """Create a trainee user for testing"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}trainee_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Test Trainee {unique_id}",
            "email": email,
            "phone": "+1555000200",
            "password": "test123",
            "roles": ["trainee"]
        })
        if response.status_code != 200:
            pytest.skip(f"Could not create trainee: {response.text}")
        return response.json()["access_token"]
    
    def test_trainee_recent_trainers(self, trainee_token):
        """GET /api/trainee/recent-trainers should return recent trainers"""
        response = requests.get(
            f"{BASE_URL}/api/trainee/recent-trainers",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200, f"Recent trainers failed: {response.text}"
        data = response.json()
        
        assert "recentTrainers" in data, "Response should contain recentTrainers array"
        assert isinstance(data["recentTrainers"], list)
        
        print(f"✓ Recent trainers: {len(data['recentTrainers'])} trainers")
    
    def test_trainee_streak(self, trainee_token):
        """GET /api/trainee/streak should return streak information"""
        response = requests.get(
            f"{BASE_URL}/api/trainee/streak",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200, f"Streak failed: {response.text}"
        data = response.json()
        
        # Verify required fields
        assert "currentStreak" in data, "Response should contain currentStreak"
        assert "longestStreak" in data, "Response should contain longestStreak"
        assert "totalSessions" in data, "Response should contain totalSessions"
        assert "thisWeekSessions" in data, "Response should contain thisWeekSessions"
        
        # Values should be integers
        assert isinstance(data["currentStreak"], int)
        assert isinstance(data["longestStreak"], int)
        
        print(f"✓ Streak: current={data['currentStreak']}, longest={data['longestStreak']}, total={data['totalSessions']}")
    
    def test_trainee_favorite_availability(self, trainee_token):
        """GET /api/trainee/favorite-availability should return favorite trainers"""
        response = requests.get(
            f"{BASE_URL}/api/trainee/favorite-availability",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200, f"Favorite availability failed: {response.text}"
        data = response.json()
        
        assert "trainers" in data, "Response should contain trainers array"
        assert isinstance(data["trainers"], list)
        
        print(f"✓ Favorite trainers: {len(data['trainers'])} trainers")


class TestTrainerGoLive:
    """Test trainer go-live endpoint"""
    
    @pytest.fixture(scope="class")
    def trainer_token(self):
        """Create a trainer user for testing"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}trainer_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Test Trainer {unique_id}",
            "email": email,
            "phone": "+1555000300",
            "password": "test123",
            "roles": ["trainer"]
        })
        if response.status_code != 200:
            pytest.skip(f"Could not create trainer: {response.text}")
        return response.json()["access_token"]
    
    def test_trainer_go_live(self, trainer_token):
        """POST /api/trainer/go-live should mark trainer as available"""
        response = requests.post(
            f"{BASE_URL}/api/trainer/go-live",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Go live failed: {response.text}"
        data = response.json()
        
        assert "success" in data, "Response should contain success field"
        assert data["success"] == True
        assert "isLive" in data, "Response should contain isLive field"
        assert data["isLive"] == True
        assert "notifiedTrainees" in data, "Response should contain notifiedTrainees count"
        
        print(f"✓ Trainer went live, notified {data['notifiedTrainees']} trainees")
    
    def test_trainer_go_offline(self, trainer_token):
        """POST /api/trainer/go-offline should mark trainer as offline"""
        # First go live
        requests.post(
            f"{BASE_URL}/api/trainer/go-live",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        
        # Then go offline
        response = requests.post(
            f"{BASE_URL}/api/trainer/go-offline",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Go offline failed: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert data["isLive"] == False
        
        print("✓ Trainer went offline")


class TestStripeConnect:
    """Test Stripe Connect status endpoint"""
    
    @pytest.fixture(scope="class")
    def trainer_token(self):
        """Get or create trainer for testing"""
        # Try existing test trainer first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "stripe_connect_test@test.com",
            "password": "test123"
        })
        if login_resp.status_code == 200:
            return login_resp.json()["access_token"]
        
        # Create new trainer
        unique_id = str(uuid.uuid4())[:8]
        signup_resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Stripe Test Trainer {unique_id}",
            "email": f"{TEST_PREFIX}stripe_trainer_{unique_id}@test.com",
            "phone": "+1555000400",
            "password": "test123",
            "roles": ["trainer"]
        })
        if signup_resp.status_code != 200:
            pytest.skip(f"Could not create trainer: {signup_resp.text}")
        return signup_resp.json()["access_token"]
    
    def test_stripe_connect_status(self, trainer_token):
        """GET /api/trainer/connect/status should return connection status"""
        response = requests.get(
            f"{BASE_URL}/api/trainer/connect/status",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Connect status failed: {response.text}"
        data = response.json()
        
        # Verify expected fields
        assert "connected" in data, "Response should contain connected field"
        assert "onboarded" in data, "Response should contain onboarded field"
        
        print(f"✓ Stripe Connect status: connected={data['connected']}, onboarded={data['onboarded']}")


class TestHealthEndpoint:
    """Test health check endpoints"""
    
    def test_root_health(self):
        """GET / should return healthy status"""
        # The root URL is the frontend, check /api/ instead
        response = requests.get(f"{BASE_URL}/api/")
        # Root may redirect or return frontend content
        assert response.status_code in [200, 307, 308] or response.ok
    
    def test_api_health(self):
        """GET /api/health should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
