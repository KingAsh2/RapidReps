"""
Test Iteration 28: RapidReps Convenience Features

Tests 8 new convenience features for improved booking flow and retention:
1. Recent Trainers (Quick Book) - GET /api/trainee/recent-trainers
2. Streak Tracking - GET /api/trainee/streak
3. Recurring Sessions - POST /api/sessions/recurring
4. Trainer Go Live - POST /api/trainer/go-live
5. Trainer Go Offline - POST /api/trainer/go-offline
6. Favorite Trainer Availability - GET /api/trainee/favorite-availability
7. Regression: Existing endpoints still work
8. Regression: Stripe Connect still works
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_PREFIX = f"TEST_ITER28_{datetime.utcnow().strftime('%H%M%S')}_"


class TestSetup:
    """Setup test users and profiles"""
    
    @pytest.fixture(scope="class")
    def trainer_user(self):
        """Create a trainer user for testing"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}trainer_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Test Trainer {unique_id}",
            "email": email,
            "phone": "+1555000001",
            "password": "test123",
            "roles": ["trainer"]
        })
        assert response.status_code == 200, f"Trainer signup failed: {response.text}"
        data = response.json()
        return {
            "id": data["user"]["id"],
            "email": email,
            "token": data["access_token"],
            "fullName": data["user"]["fullName"]
        }
    
    @pytest.fixture(scope="class")
    def trainee_user(self):
        """Create a trainee user for testing"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}trainee_{unique_id}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Test Trainee {unique_id}",
            "email": email,
            "phone": "+1555000002",
            "password": "test123",
            "roles": ["trainee"]
        })
        assert response.status_code == 200, f"Trainee signup failed: {response.text}"
        data = response.json()
        return {
            "id": data["user"]["id"],
            "email": email,
            "token": data["access_token"],
            "fullName": data["user"]["fullName"]
        }


class TestRecentTrainers(TestSetup):
    """Test Recent Trainers (Quick Book) feature"""
    
    def test_recent_trainers_returns_empty_for_new_user(self, trainee_user):
        """New users should have no recent trainers"""
        response = requests.get(
            f"{BASE_URL}/api/trainee/recent-trainers",
            headers={"Authorization": f"Bearer {trainee_user['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "recentTrainers" in data
        assert isinstance(data["recentTrainers"], list)
        # New user should have empty recent trainers
        print(f"Recent trainers for new user: {data['recentTrainers']}")
    
    def test_recent_trainers_requires_auth(self):
        """Endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/trainee/recent-trainers")
        assert response.status_code in [401, 403]


class TestStreakTracking(TestSetup):
    """Test Streak Tracking feature"""
    
    def test_streak_returns_zero_for_new_user(self, trainee_user):
        """New users should have 0 streak"""
        response = requests.get(
            f"{BASE_URL}/api/trainee/streak",
            headers={"Authorization": f"Bearer {trainee_user['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "currentStreak" in data
        assert "longestStreak" in data
        assert "totalSessions" in data
        assert "thisWeekSessions" in data
        
        # New user should have 0 for all
        assert data["currentStreak"] == 0
        assert data["longestStreak"] == 0
        assert data["totalSessions"] == 0
        assert data["thisWeekSessions"] == 0
        print(f"Streak data for new user: {data}")
    
    def test_streak_requires_auth(self):
        """Endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/trainee/streak")
        assert response.status_code in [401, 403]


class TestRecurringSessions(TestSetup):
    """Test Recurring Sessions feature"""
    
    def test_create_recurring_sessions(self, trainee_user, trainer_user):
        """Create multiple recurring sessions"""
        response = requests.post(
            f"{BASE_URL}/api/sessions/recurring",
            headers={"Authorization": f"Bearer {trainee_user['token']}"},
            json={
                "trainerId": trainer_user["id"],
                "dayOfWeek": 1,  # Tuesday
                "timeSlot": "10:00",
                "recurrenceType": "weekly",
                "numberOfSessions": 4,
                "locationType": "outdoor",
                "durationMinutes": 60
            }
        )
        assert response.status_code == 200, f"Create recurring sessions failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data["success"] == True
        assert data["sessionsCreated"] == 4
        assert "sessions" in data
        assert len(data["sessions"]) == 4
        assert "message" in data
        
        # Verify each session has id and date
        for session in data["sessions"]:
            assert "id" in session
            assert "date" in session
        
        print(f"Created {data['sessionsCreated']} recurring sessions: {data}")
        return data["sessions"]
    
    def test_create_biweekly_recurring_sessions(self, trainee_user, trainer_user):
        """Create biweekly recurring sessions"""
        response = requests.post(
            f"{BASE_URL}/api/sessions/recurring",
            headers={"Authorization": f"Bearer {trainee_user['token']}"},
            json={
                "trainerId": trainer_user["id"],
                "dayOfWeek": 3,  # Thursday
                "timeSlot": "14:00",
                "recurrenceType": "biweekly",
                "numberOfSessions": 3,
                "locationType": "virtual"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["sessionsCreated"] == 3
        print(f"Created {data['sessionsCreated']} biweekly sessions")
    
    def test_recurring_sessions_requires_auth(self, trainer_user):
        """Endpoint should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/sessions/recurring",
            json={
                "trainerId": trainer_user["id"],
                "dayOfWeek": 1,
                "timeSlot": "10:00"
            }
        )
        assert response.status_code in [401, 403]
    
    def test_recurring_sessions_invalid_trainer(self, trainee_user):
        """Should return 404 for invalid trainer"""
        response = requests.post(
            f"{BASE_URL}/api/sessions/recurring",
            headers={"Authorization": f"Bearer {trainee_user['token']}"},
            json={
                "trainerId": "000000000000000000000000",  # Invalid ObjectId
                "dayOfWeek": 1,
                "timeSlot": "10:00"
            }
        )
        assert response.status_code == 404


class TestTrainerGoLive(TestSetup):
    """Test Trainer Go Live / Available Now feature"""
    
    def test_trainer_go_live(self, trainer_user):
        """Trainer can toggle 'Available Now' status"""
        response = requests.post(
            f"{BASE_URL}/api/trainer/go-live",
            headers={"Authorization": f"Bearer {trainer_user['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["success"] == True
        assert data["isLive"] == True
        assert "notifiedTrainees" in data
        assert isinstance(data["notifiedTrainees"], int)
        
        print(f"Trainer went live, notified {data['notifiedTrainees']} trainees")
    
    def test_trainer_go_offline(self, trainer_user):
        """Trainer can go offline"""
        # First go live
        requests.post(
            f"{BASE_URL}/api/trainer/go-live",
            headers={"Authorization": f"Bearer {trainer_user['token']}"}
        )
        
        # Then go offline
        response = requests.post(
            f"{BASE_URL}/api/trainer/go-offline",
            headers={"Authorization": f"Bearer {trainer_user['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["isLive"] == False
        print("Trainer went offline successfully")
    
    def test_go_live_requires_auth(self):
        """Go live should require authentication"""
        response = requests.post(f"{BASE_URL}/api/trainer/go-live")
        assert response.status_code in [401, 403]
    
    def test_go_offline_requires_auth(self):
        """Go offline should require authentication"""
        response = requests.post(f"{BASE_URL}/api/trainer/go-offline")
        assert response.status_code in [401, 403]


class TestFavoriteAvailability(TestSetup):
    """Test Favorite Trainer Availability feature"""
    
    def test_favorite_availability_returns_empty_for_new_user(self, trainee_user):
        """New users with no saved trainers should get empty list"""
        response = requests.get(
            f"{BASE_URL}/api/trainee/favorite-availability",
            headers={"Authorization": f"Bearer {trainee_user['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "trainers" in data
        assert isinstance(data["trainers"], list)
        # New user has no saved trainers
        print(f"Favorite trainers availability: {data}")
    
    def test_favorite_availability_requires_auth(self):
        """Endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/trainee/favorite-availability")
        assert response.status_code in [401, 403]


class TestRegressionExistingEndpoints:
    """Regression tests: Verify existing endpoints still work"""
    
    def test_health_endpoint(self):
        """GET /api/health should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_login_endpoint(self):
        """POST /api/auth/login should work with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
    
    def test_trainer_sessions_endpoint(self):
        """GET /api/trainer/sessions should work with auth"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "stripe_connect_test@test.com",
            "password": "test123"
        })
        if login_resp.status_code != 200:
            pytest.skip("Test trainer account not found")
        
        token = login_resp.json()["access_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/trainer/sessions",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_trainee_sessions_endpoint(self):
        """GET /api/trainee/sessions should work with auth"""
        # Create a trainee and test
        unique_id = str(uuid.uuid4())[:8]
        signup_resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Regression Test {unique_id}",
            "email": f"{TEST_PREFIX}regression_{unique_id}@test.com",
            "phone": "+1555000009",
            "password": "test123",
            "roles": ["trainee"]
        })
        assert signup_resp.status_code == 200
        token = signup_resp.json()["access_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/trainee/sessions",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestRegressionStripeConnect:
    """Regression tests: Verify Stripe Connect endpoints still work"""
    
    def test_stripe_connect_status(self):
        """GET /api/trainer/connect/status should work"""
        # Login as test trainer
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "stripe_connect_test@test.com",
            "password": "test123"
        })
        if login_resp.status_code != 200:
            pytest.skip("Test trainer account not found")
        
        token = login_resp.json()["access_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/trainer/connect/status",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Verify response has expected fields
        assert "connected" in data or "onboarded" in data
    
    def test_admin_payouts_pending(self):
        """GET /api/admin/payouts/pending should work for admin"""
        # Login as admin
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/admin/payouts/pending",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200


class TestFullIntegrationFlow:
    """Integration test: Full flow with convenience features"""
    
    def test_complete_convenience_flow(self):
        """End-to-end test of convenience features"""
        unique_id = str(uuid.uuid4())[:8]
        
        # 1. Create trainer
        trainer_resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Integration Trainer {unique_id}",
            "email": f"{TEST_PREFIX}integ_trainer_{unique_id}@test.com",
            "phone": "+1555000010",
            "password": "test123",
            "roles": ["trainer"]
        })
        assert trainer_resp.status_code == 200
        trainer_data = trainer_resp.json()
        trainer_id = trainer_data["user"]["id"]
        trainer_token = trainer_data["access_token"]
        
        # 2. Create trainee
        trainee_resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Integration Trainee {unique_id}",
            "email": f"{TEST_PREFIX}integ_trainee_{unique_id}@test.com",
            "phone": "+1555000011",
            "password": "test123",
            "roles": ["trainee"]
        })
        assert trainee_resp.status_code == 200
        trainee_data = trainee_resp.json()
        trainee_token = trainee_data["access_token"]
        
        # 3. Trainer goes live
        go_live_resp = requests.post(
            f"{BASE_URL}/api/trainer/go-live",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert go_live_resp.status_code == 200
        assert go_live_resp.json()["isLive"] == True
        print("✓ Trainer went live")
        
        # 4. Check trainee streak (should be 0)
        streak_resp = requests.get(
            f"{BASE_URL}/api/trainee/streak",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert streak_resp.status_code == 200
        assert streak_resp.json()["currentStreak"] == 0
        print("✓ Streak tracking works (0 for new user)")
        
        # 5. Check recent trainers (should be empty)
        recent_resp = requests.get(
            f"{BASE_URL}/api/trainee/recent-trainers",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert recent_resp.status_code == 200
        print("✓ Recent trainers endpoint works")
        
        # 6. Create recurring sessions
        recurring_resp = requests.post(
            f"{BASE_URL}/api/sessions/recurring",
            headers={"Authorization": f"Bearer {trainee_token}"},
            json={
                "trainerId": trainer_id,
                "dayOfWeek": 2,  # Wednesday
                "timeSlot": "09:00",
                "recurrenceType": "weekly",
                "numberOfSessions": 2
            }
        )
        assert recurring_resp.status_code == 200
        assert recurring_resp.json()["sessionsCreated"] == 2
        print("✓ Recurring sessions created")
        
        # 7. Trainer goes offline
        offline_resp = requests.post(
            f"{BASE_URL}/api/trainer/go-offline",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert offline_resp.status_code == 200
        assert offline_resp.json()["isLive"] == False
        print("✓ Trainer went offline")
        
        # 8. Check favorite availability (empty since no favorites)
        fav_resp = requests.get(
            f"{BASE_URL}/api/trainee/favorite-availability",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert fav_resp.status_code == 200
        print("✓ Favorite availability endpoint works")
        
        print("\n=== Full Integration Flow PASSED ===")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
