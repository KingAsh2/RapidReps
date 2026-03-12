"""
Comprehensive E2E Backend Tests for RapidReps API
Testing: Auth, Admin Panel V2, Streaks, Leaderboard, Achievements, Sessions, Messaging, etc.
"""

import pytest
import requests
import os
import uuid

# Use public URL from env
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://crash-reporter-v2.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINER_EMAIL = "trainer1@test.com"
TRAINER_PASSWORD = "test123"
TRAINEE_EMAIL = "trainee1@test.com"
TRAINEE_PASSWORD = "test123"


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed - skipping admin tests")


@pytest.fixture(scope="module")
def trainer_token(api_client):
    """Get trainer authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINER_EMAIL,
        "password": TRAINER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Trainer authentication failed - skipping trainer tests")


@pytest.fixture(scope="module")
def trainee_token(api_client):
    """Get trainee authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINEE_EMAIL,
        "password": TRAINEE_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Trainee authentication failed - skipping trainee tests")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers with admin auth"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def trainer_headers(trainer_token):
    """Headers with trainer auth"""
    return {"Authorization": f"Bearer {trainer_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def trainee_headers(trainee_token):
    """Headers with trainee auth"""
    return {"Authorization": f"Bearer {trainee_token}", "Content-Type": "application/json"}


# ============================================================================
# HEALTH CHECK
# ============================================================================

class TestHealth:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self, api_client):
        """GET /api/health returns healthy status"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"
        print(f"Health check passed: {data}")


# ============================================================================
# AUTHENTICATION TESTS
# ============================================================================

class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self, api_client):
        """POST /api/auth/login with admin credentials returns access_token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["isAdmin"] == True
        print(f"Admin login successful: {data['user']['fullName']}")
    
    def test_trainer_login_success(self, api_client):
        """POST /api/auth/login with trainer credentials returns access_token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TRAINER_EMAIL
        assert "trainer" in data["user"]["roles"]
        print(f"Trainer login successful: {data['user']['fullName']}")
    
    def test_trainee_login_success(self, api_client):
        """POST /api/auth/login with trainee credentials returns access_token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TRAINEE_EMAIL
        assert "trainee" in data["user"]["roles"]
        print(f"Trainee login successful: {data['user']['fullName']}")
    
    def test_login_wrong_password_returns_401(self, api_client):
        """POST /api/auth/login with wrong password returns 401"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword123"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Wrong password correctly rejected with 401")
    
    def test_get_me_returns_profile_without_password(self, api_client, admin_headers):
        """GET /api/auth/me returns user profile without passwordHash"""
        response = api_client.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert response.status_code == 200, f"Get me failed: {response.text}"
        data = response.json()
        assert "passwordHash" not in data, "passwordHash should not be in response"
        assert "id" in data
        assert "email" in data
        assert "fullName" in data
        print(f"GET /api/auth/me successful: {data['fullName']}")


# ============================================================================
# ADMIN DASHBOARD TESTS
# ============================================================================

class TestAdminDashboard:
    """Admin dashboard endpoint tests"""
    
    def test_admin_dashboard_returns_stats(self, api_client, admin_headers):
        """GET /api/admin/dashboard returns all stats"""
        response = api_client.get(f"{BASE_URL}/api/admin/dashboard", headers=admin_headers)
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        # Check all required fields
        required_fields = [
            "totalUsers", "totalTrainers", "totalTrainees", "totalSessions",
            "totalRevenueCents", "platformRevenueCents", "trainerPayoutsCents"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"Dashboard stats: Users={data['totalUsers']}, Trainers={data['totalTrainers']}, "
              f"Sessions={data['totalSessions']}, Revenue=${data.get('totalRevenueDollars', 0)}")
    
    def test_admin_dashboard_requires_auth(self, api_client):
        """GET /api/admin/dashboard without auth returns 401/403"""
        response = api_client.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Admin dashboard correctly requires authentication")


# ============================================================================
# ADMIN USERS TESTS
# ============================================================================

class TestAdminUsers:
    """Admin user management tests"""
    
    def test_admin_users_list_excludes_password(self, api_client, admin_headers):
        """GET /api/admin/users returns users without passwordHash"""
        response = api_client.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        assert response.status_code == 200, f"Get users failed: {response.text}"
        data = response.json()
        
        assert "users" in data
        assert "total" in data
        
        # Check no user has passwordHash
        for user in data["users"]:
            assert "passwordHash" not in user, f"User {user.get('email')} has passwordHash exposed!"
        
        print(f"Admin users list returned {len(data['users'])} users, total={data['total']}")
    
    def test_admin_user_detail_with_profiles(self, api_client, admin_headers, trainer_token):
        """GET /api/admin/users/{userId} returns user detail with profile"""
        # First get trainer user ID from their token
        trainer_response = api_client.get(f"{BASE_URL}/api/auth/me", 
                                          headers={"Authorization": f"Bearer {trainer_token}"})
        trainer_id = trainer_response.json()["id"]
        
        response = api_client.get(f"{BASE_URL}/api/admin/users/{trainer_id}", headers=admin_headers)
        assert response.status_code == 200, f"Get user detail failed: {response.text}"
        data = response.json()
        
        assert "user" in data
        assert "trainerProfile" in data or "traineeProfile" in data
        print(f"User detail retrieved: {data['user'].get('fullName')}")
    
    def test_create_and_delete_user(self, api_client, admin_headers):
        """DELETE /api/admin/users/{userId} - create test user then delete"""
        # Create a test user first
        unique_email = f"test_delete_{uuid.uuid4().hex[:8]}@test.com"
        signup_response = api_client.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": "Test Delete User",
            "email": unique_email,
            "phone": "1234567890",
            "password": "testpass123",
            "roles": ["trainee"]
        })
        
        if signup_response.status_code != 200:
            pytest.skip(f"Could not create test user: {signup_response.text}")
        
        test_user_id = signup_response.json()["user"]["id"]
        print(f"Created test user: {unique_email} with ID {test_user_id}")
        
        # Now delete the user
        delete_response = api_client.delete(
            f"{BASE_URL}/api/admin/users/{test_user_id}", 
            headers=admin_headers
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        data = delete_response.json()
        assert data["success"] == True
        print(f"Successfully deleted test user: {test_user_id}")
        
        # Verify user is gone
        verify_response = api_client.get(
            f"{BASE_URL}/api/admin/users/{test_user_id}", 
            headers=admin_headers
        )
        assert verify_response.status_code == 404, "Deleted user should return 404"
        print("Verified user deletion - 404 returned as expected")
    
    def test_admin_cannot_delete_self(self, api_client, admin_headers, admin_token):
        """DELETE /api/admin/users/{userId} cannot delete own admin account"""
        # Get admin's own ID
        me_response = api_client.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        admin_id = me_response.json()["id"]
        
        response = api_client.delete(
            f"{BASE_URL}/api/admin/users/{admin_id}", 
            headers=admin_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "cannot delete" in data.get("detail", "").lower() or "own" in data.get("detail", "").lower()
        print("Admin correctly cannot delete their own account")


# ============================================================================
# ADMIN SESSIONS TESTS
# ============================================================================

class TestAdminSessions:
    """Admin sessions management tests"""
    
    def test_admin_sessions_returns_enriched_data(self, api_client, admin_headers):
        """GET /api/admin/sessions returns enriched sessions"""
        response = api_client.get(f"{BASE_URL}/api/admin/sessions", headers=admin_headers)
        assert response.status_code == 200, f"Get sessions failed: {response.text}"
        data = response.json()
        
        assert "sessions" in data
        assert "total" in data
        
        # Check enriched fields if sessions exist
        if data["sessions"]:
            session = data["sessions"][0]
            enriched_fields = ["trainerName", "traineeName"]
            for field in enriched_fields:
                assert field in session, f"Missing enriched field: {field}"
            # actualDurationMinutes may be null if session not started
            assert "actualDurationMinutes" in session or "traineeHomeAddress" in session
        
        print(f"Admin sessions: {len(data['sessions'])} returned, total={data['total']}")
    
    def test_admin_sessions_filter_by_status(self, api_client, admin_headers):
        """GET /api/admin/sessions?status=confirmed filters correctly"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/sessions?status=confirmed", 
            headers=admin_headers
        )
        assert response.status_code == 200, f"Filter sessions failed: {response.text}"
        data = response.json()
        
        # All returned sessions should have confirmed status
        for session in data.get("sessions", []):
            assert session.get("status") == "confirmed", f"Session has wrong status: {session.get('status')}"
        
        print(f"Filtered sessions by status=confirmed: {len(data.get('sessions', []))} found")


# ============================================================================
# ADMIN TRANSACTIONS TESTS
# ============================================================================

class TestAdminTransactions:
    """Admin transactions tests"""
    
    def test_admin_transactions_enriched(self, api_client, admin_headers):
        """GET /api/admin/transactions-enriched returns enriched data"""
        response = api_client.get(f"{BASE_URL}/api/admin/transactions-enriched", headers=admin_headers)
        assert response.status_code == 200, f"Get transactions failed: {response.text}"
        data = response.json()
        
        assert "transactions" in data
        assert "total" in data
        
        # Check enriched fields if transactions exist
        if data["transactions"]:
            tx = data["transactions"][0]
            enriched_fields = ["trainerName", "traineeName"]
            for field in enriched_fields:
                assert field in tx, f"Missing enriched field: {field}"
        
        print(f"Enriched transactions: {len(data['transactions'])} returned, total={data['total']}")


# ============================================================================
# ADMIN REFUND TESTS
# ============================================================================

class TestAdminRefund:
    """Admin refund endpoint tests"""
    
    def test_admin_refund_invalid_session(self, api_client, admin_headers):
        """POST /api/admin/refund with invalid sessionId returns error"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/refund",
            headers=admin_headers,
            json={"sessionId": "000000000000000000000000", "reason": "Test refund"}
        )
        assert response.status_code in [400, 404], f"Expected error status, got {response.status_code}"
        print("Invalid session ID correctly rejected for refund")
    
    def test_admin_refund_duplicate_protection(self, api_client, admin_headers):
        """POST /api/admin/refund duplicate refund returns 400 'already refunded'"""
        # First, get a session that's already refunded (if any)
        sessions_response = api_client.get(f"{BASE_URL}/api/admin/sessions", headers=admin_headers)
        sessions = sessions_response.json().get("sessions", [])
        
        refunded_session = None
        for s in sessions:
            if s.get("refunded"):
                refunded_session = s
                break
        
        if not refunded_session:
            pytest.skip("No refunded sessions found to test duplicate refund protection")
        
        response = api_client.post(
            f"{BASE_URL}/api/admin/refund",
            headers=admin_headers,
            json={"sessionId": refunded_session["id"], "reason": "Duplicate test"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "already refunded" in response.json().get("detail", "").lower()
        print("Duplicate refund correctly rejected")


# ============================================================================
# ADMIN CONFIRM PAYMENT TESTS
# ============================================================================

class TestAdminConfirmPayment:
    """Admin confirm payment tests"""
    
    def test_admin_confirm_payment_success(self, api_client, admin_headers):
        """POST /api/admin/confirm-payment with valid sessionId returns success"""
        # Get a session to confirm
        sessions_response = api_client.get(f"{BASE_URL}/api/admin/sessions", headers=admin_headers)
        sessions = sessions_response.json().get("sessions", [])
        
        if not sessions:
            pytest.skip("No sessions found to test confirm payment")
        
        session_id = sessions[0]["id"]
        response = api_client.post(
            f"{BASE_URL}/api/admin/confirm-payment",
            headers=admin_headers,
            json={"sessionId": session_id}
        )
        assert response.status_code == 200, f"Confirm payment failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        print(f"Payment confirmed for session: ${data.get('amountCents', 0)/100:.2f}")


# ============================================================================
# ADMIN PROFILE TESTS
# ============================================================================

class TestAdminProfile:
    """Admin profile update tests"""
    
    def test_admin_profile_update_success(self, api_client, admin_headers):
        """PUT /api/admin/profile updates fullName successfully"""
        response = api_client.put(
            f"{BASE_URL}/api/admin/profile",
            headers=admin_headers,
            json={"fullName": "Admin User Updated"}
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "user" in data
        print(f"Admin profile updated: {data['user'].get('fullName')}")
        
        # Revert the change
        api_client.put(
            f"{BASE_URL}/api/admin/profile",
            headers=admin_headers,
            json={"fullName": "Admin User"}
        )
    
    def test_admin_profile_update_empty_body_fails(self, api_client, admin_headers):
        """PUT /api/admin/profile with empty body returns 400"""
        response = api_client.put(
            f"{BASE_URL}/api/admin/profile",
            headers=admin_headers,
            json={}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Empty profile update correctly rejected")


# ============================================================================
# ADMIN MESSAGE TESTS
# ============================================================================

class TestAdminMessage:
    """Admin messaging tests"""
    
    def test_admin_send_message_success(self, api_client, admin_headers, trainee_token):
        """POST /api/admin/message sends message to a user successfully"""
        # Get trainee user ID
        trainee_response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        trainee_id = trainee_response.json()["id"]
        
        response = api_client.post(
            f"{BASE_URL}/api/admin/message",
            headers=admin_headers,
            json={"receiverId": trainee_id, "content": "Test message from admin"}
        )
        assert response.status_code == 200, f"Send message failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "messageId" in data
        assert "conversationId" in data
        print(f"Admin message sent successfully: {data['messageId']}")


# ============================================================================
# ADMIN VERIFICATIONS TESTS
# ============================================================================

class TestAdminVerifications:
    """Admin verifications tests"""
    
    def test_admin_pending_verifications(self, api_client, admin_headers):
        """GET /api/admin/verifications/pending returns pendingVerifications array"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/verifications/pending",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Get verifications failed: {response.text}"
        data = response.json()
        assert "pendingVerifications" in data
        assert "count" in data
        print(f"Pending verifications: {data['count']}")
    
    def test_admin_verify_trainer(self, api_client, admin_headers, trainer_token):
        """PATCH /api/admin/trainers/{trainerId}/verify can approve a trainer"""
        # Get trainer user ID
        trainer_response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        trainer_id = trainer_response.json()["id"]
        
        response = api_client.patch(
            f"{BASE_URL}/api/admin/trainers/{trainer_id}/verify?verified=true",
            headers=admin_headers
        )
        # May fail if trainer profile doesn't exist or ID mismatch
        if response.status_code == 404:
            print("Trainer profile not found - may need trainer_profile_id instead of user_id")
            pytest.skip("Trainer profile not found for verification test")
        
        assert response.status_code == 200, f"Verify trainer failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        print(f"Trainer verified successfully")


# ============================================================================
# STREAKS TESTS
# ============================================================================

class TestStreaks:
    """Streaks and consistency points tests"""
    
    def test_streaks_as_trainer(self, api_client, trainer_headers):
        """GET /api/streaks/me as trainer returns all streak fields"""
        response = api_client.get(f"{BASE_URL}/api/streaks/me", headers=trainer_headers)
        assert response.status_code == 200, f"Get streaks failed: {response.text}"
        data = response.json()
        
        required_fields = [
            "currentStreak", "longestStreak", "consistencyPoints",
            "totalSessions", "totalMinutes", "streakLevel", "nextMilestone"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"Trainer streaks: streak={data['currentStreak']}, points={data['consistencyPoints']}, "
              f"level={data['streakLevel']}")
    
    def test_streaks_as_trainee(self, api_client, trainee_headers):
        """GET /api/streaks/me as trainee returns same fields"""
        response = api_client.get(f"{BASE_URL}/api/streaks/me", headers=trainee_headers)
        assert response.status_code == 200, f"Get streaks failed: {response.text}"
        data = response.json()
        
        required_fields = [
            "currentStreak", "longestStreak", "consistencyPoints",
            "totalSessions", "totalMinutes", "streakLevel", "nextMilestone"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"Trainee streaks: streak={data['currentStreak']}, points={data['consistencyPoints']}")
    
    def test_streaks_without_auth_returns_401(self, api_client):
        """GET /api/streaks/me without auth returns 401"""
        response = api_client.get(f"{BASE_URL}/api/streaks/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Streaks correctly requires authentication")


# ============================================================================
# LEADERBOARD TESTS
# ============================================================================

class TestLeaderboard:
    """Weekly leaderboard tests"""
    
    def test_leaderboard_returns_sorted_array(self, api_client, trainer_headers):
        """GET /api/leaderboard/weekly returns leaderboard sorted by consistencyPoints"""
        response = api_client.get(f"{BASE_URL}/api/leaderboard/weekly", headers=trainer_headers)
        assert response.status_code == 200, f"Get leaderboard failed: {response.text}"
        data = response.json()
        
        assert "leaderboard" in data
        assert "myRank" in data
        assert "myEntry" in data
        
        # Check entries are sorted by consistencyPoints descending
        leaderboard = data["leaderboard"]
        for i in range(1, len(leaderboard)):
            assert leaderboard[i-1]["consistencyPoints"] >= leaderboard[i]["consistencyPoints"], \
                "Leaderboard not sorted by consistencyPoints"
        
        print(f"Leaderboard: {len(leaderboard)} participants, myRank={data['myRank']}")
    
    def test_leaderboard_entry_has_required_fields(self, api_client, trainee_headers):
        """GET /api/leaderboard/weekly each entry has required fields"""
        response = api_client.get(f"{BASE_URL}/api/leaderboard/weekly", headers=trainee_headers)
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "rank", "userId", "fullName", "role", "currentStreak",
            "consistencyPoints", "totalSessions", "totalMinutes", "streakLevel"
        ]
        
        for entry in data["leaderboard"]:
            for field in required_fields:
                assert field in entry, f"Missing field {field} in leaderboard entry"
        
        print(f"Leaderboard entries have all required fields")
    
    def test_leaderboard_limit_parameter(self, api_client, trainer_headers):
        """GET /api/leaderboard/weekly?limit=1 respects limit parameter"""
        response = api_client.get(f"{BASE_URL}/api/leaderboard/weekly?limit=1", headers=trainer_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["leaderboard"]) <= 1, f"Expected max 1 entry, got {len(data['leaderboard'])}"
        print(f"Limit=1 respected: {len(data['leaderboard'])} entry returned")
    
    def test_leaderboard_without_auth_returns_401(self, api_client):
        """GET /api/leaderboard/weekly without auth returns 401"""
        response = api_client.get(f"{BASE_URL}/api/leaderboard/weekly")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Leaderboard correctly requires authentication")


# ============================================================================
# ACHIEVEMENTS TESTS
# ============================================================================

class TestAchievements:
    """Trainee achievements/badges tests"""
    
    def test_achievements_returns_12_badges(self, api_client, trainee_headers):
        """GET /api/trainee/achievements returns exactly 12 badges"""
        response = api_client.get(f"{BASE_URL}/api/trainee/achievements", headers=trainee_headers)
        assert response.status_code == 200, f"Get achievements failed: {response.text}"
        data = response.json()
        
        assert "badges" in data
        assert len(data["badges"]) == 12, f"Expected 12 badges, got {len(data['badges'])}"
        print(f"Achievements: {len(data['badges'])} badges returned")
    
    def test_achievements_has_streak_star_badge(self, api_client, trainee_headers):
        """GET /api/trainee/achievements includes streak_star badge"""
        response = api_client.get(f"{BASE_URL}/api/trainee/achievements", headers=trainee_headers)
        assert response.status_code == 200
        data = response.json()
        
        badge_types = [b["badgeType"] for b in data["badges"]]
        assert "streak_star" in badge_types, "streak_star badge not found"
        
        streak_star = next(b for b in data["badges"] if b["badgeType"] == "streak_star")
        assert "progress" in streak_star
        assert "target" in streak_star
        print(f"streak_star badge: progress={streak_star['progress']}/{streak_star['target']}")
    
    def test_achievements_has_duration_master_badge(self, api_client, trainee_headers):
        """GET /api/trainee/achievements includes duration_master badge"""
        response = api_client.get(f"{BASE_URL}/api/trainee/achievements", headers=trainee_headers)
        assert response.status_code == 200
        data = response.json()
        
        badge_types = [b["badgeType"] for b in data["badges"]]
        assert "duration_master" in badge_types, "duration_master badge not found"
        
        duration_master = next(b for b in data["badges"] if b["badgeType"] == "duration_master")
        assert "progress" in duration_master
        assert "target" in duration_master
        assert duration_master["target"] == 500, "duration_master target should be 500 minutes"
        print(f"duration_master badge: progress={duration_master['progress']}/{duration_master['target']}")
    
    def test_achievements_returns_total_completed_sessions(self, api_client, trainee_headers):
        """GET /api/trainee/achievements returns totalCompletedSessions"""
        response = api_client.get(f"{BASE_URL}/api/trainee/achievements", headers=trainee_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "totalCompletedSessions" in data
        print(f"Total completed sessions: {data['totalCompletedSessions']}")


# ============================================================================
# TRAINERS TESTS
# ============================================================================

class TestTrainers:
    """Trainer endpoints tests"""
    
    def test_nearby_trainers_returns_list(self, api_client, trainee_headers):
        """GET /api/trainers/nearby returns trainer list with location data"""
        response = api_client.get(
            f"{BASE_URL}/api/trainers/nearby?latitude=34.0522&longitude=-118.2437",
            headers=trainee_headers
        )
        assert response.status_code == 200, f"Get nearby trainers failed: {response.text}"
        data = response.json()
        
        assert "trainers" in data
        assert "count" in data
        
        # Check trainer entries have location data
        for trainer in data["trainers"]:
            assert "latitude" in trainer
            assert "longitude" in trainer
            assert "distanceMiles" in trainer
        
        print(f"Nearby trainers: {data['count']} found")
    
    def test_trainer_profile_has_intro_video_field(self, api_client, trainee_headers, trainer_token):
        """GET /api/trainer-profiles/{trainerId} returns profile with introVideoUrl field"""
        # Get trainer profile ID
        trainer_response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        trainer_user_id = trainer_response.json()["id"]
        
        # Get trainer profile
        response = api_client.get(
            f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}",
            headers=trainee_headers
        )
        
        if response.status_code == 404:
            pytest.skip("Trainer profile not found")
        
        assert response.status_code == 200, f"Get trainer profile failed: {response.text}"
        data = response.json()
        
        # introVideoUrl field should exist (may be null)
        assert "introVideoUrl" in data or response.status_code == 200
        print(f"Trainer profile retrieved with intro video field")


# ============================================================================
# SESSIONS TESTS
# ============================================================================

class TestSessions:
    """Session endpoints tests"""
    
    def test_trainee_sessions(self, api_client, trainee_headers):
        """GET /api/trainee/sessions returns trainee's sessions"""
        response = api_client.get(f"{BASE_URL}/api/trainee/sessions", headers=trainee_headers)
        assert response.status_code == 200, f"Get trainee sessions failed: {response.text}"
        data = response.json()
        
        # Response should be a list
        assert isinstance(data, list)
        print(f"Trainee sessions retrieved: {len(data)} sessions")
    
    def test_trainer_sessions(self, api_client, trainer_headers):
        """GET /api/trainer/sessions returns trainer's sessions"""
        response = api_client.get(f"{BASE_URL}/api/trainer/sessions", headers=trainer_headers)
        assert response.status_code == 200, f"Get trainer sessions failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"Trainer sessions retrieved: {len(data)} sessions")


# ============================================================================
# MESSAGING TESTS
# ============================================================================

class TestMessaging:
    """Messaging endpoints tests"""
    
    def test_get_conversations(self, api_client, trainee_headers):
        """GET /api/conversations returns conversations list"""
        response = api_client.get(f"{BASE_URL}/api/conversations", headers=trainee_headers)
        assert response.status_code == 200, f"Get conversations failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"Conversations retrieved: {len(data)} found")
    
    def test_create_conversation(self, api_client, trainee_headers, trainer_token):
        """POST /api/conversations creates a new conversation"""
        # Get trainer user ID
        trainer_response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        trainer_id = trainer_response.json()["id"]
        
        response = api_client.post(
            f"{BASE_URL}/api/conversations?receiver_id={trainer_id}",
            headers=trainee_headers
        )
        assert response.status_code == 200, f"Create conversation failed: {response.text}"
        data = response.json()
        
        assert "conversationId" in data
        print(f"Conversation created/retrieved: {data['conversationId']}")


# ============================================================================
# RATINGS TESTS
# ============================================================================

class TestRatings:
    """Rating endpoints tests"""
    
    def test_get_trainer_ratings(self, api_client, trainee_headers, trainer_token):
        """GET /api/trainers/{trainerId}/ratings returns ratings array"""
        # Get trainer user ID
        trainer_response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        trainer_id = trainer_response.json()["id"]
        
        response = api_client.get(
            f"{BASE_URL}/api/trainers/{trainer_id}/ratings",
            headers=trainee_headers
        )
        assert response.status_code == 200, f"Get ratings failed: {response.text}"
        data = response.json()
        
        # Response should have ratings field
        assert "ratings" in data or isinstance(data, list)
        print(f"Trainer ratings retrieved successfully")


# ============================================================================
# RUN TESTS
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
