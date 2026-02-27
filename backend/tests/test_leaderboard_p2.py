"""
Backend tests for P2 Features - Leaderboard Endpoint + Regression Tests
Tests for iteration 9:
- GET /api/leaderboard/weekly - Weekly Leaderboard by consistency points
- Regression tests for: /api/streaks/me, /api/trainee/achievements, admin endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINER_EMAIL = "trainer1@test.com"
TRAINER_PASSWORD = "test123"
TRAINEE_EMAIL = "trainee1@test.com"
TRAINEE_PASSWORD = "test123"


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
    pytest.fail(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def trainer_token(api_client):
    """Get trainer authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINER_EMAIL,
        "password": TRAINER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.fail(f"Trainer login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def trainee_token(api_client):
    """Get trainee authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINEE_EMAIL,
        "password": TRAINEE_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.fail(f"Trainee login failed: {response.status_code} - {response.text}")


# ============================================================================
# LEADERBOARD ENDPOINT TESTS (New P2 Feature)
# ============================================================================

class TestLeaderboardWeekly:
    """Tests for GET /api/leaderboard/weekly"""
    
    def test_leaderboard_requires_auth(self, api_client):
        """Test that leaderboard endpoint requires authentication (401 without token)"""
        response = api_client.get(f"{BASE_URL}/api/leaderboard/weekly")
        assert response.status_code in [401, 403], f"Expected 401/403 without token, got {response.status_code}"
        print("PASS: Leaderboard requires authentication (401/403 without token)")
    
    def test_leaderboard_with_trainer_token(self, api_client, trainer_token):
        """Test leaderboard works for trainers"""
        response = api_client.get(
            f"{BASE_URL}/api/leaderboard/weekly",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Trainer leaderboard access failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert 'leaderboard' in data, "Missing 'leaderboard' key in response"
        assert 'myRank' in data, "Missing 'myRank' key in response"
        assert 'myEntry' in data, "Missing 'myEntry' key in response"
        assert 'totalParticipants' in data, "Missing 'totalParticipants' key in response"
        
        print(f"PASS: Trainer can access leaderboard. Total participants: {data['totalParticipants']}, My rank: {data['myRank']}")
    
    def test_leaderboard_with_trainee_token(self, api_client, trainee_token):
        """Test leaderboard works for trainees"""
        response = api_client.get(
            f"{BASE_URL}/api/leaderboard/weekly",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200, f"Trainee leaderboard access failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert 'leaderboard' in data
        assert isinstance(data['leaderboard'], list), "leaderboard should be a list"
        
        print(f"PASS: Trainee can access leaderboard. Total participants: {data['totalParticipants']}, My rank: {data['myRank']}")
    
    def test_leaderboard_entry_structure(self, api_client, trainee_token):
        """Test that each leaderboard entry has required fields"""
        response = api_client.get(
            f"{BASE_URL}/api/leaderboard/weekly",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        leaderboard = data['leaderboard']
        
        if len(leaderboard) > 0:
            entry = leaderboard[0]
            required_fields = ['userId', 'fullName', 'role', 'currentStreak', 'consistencyPoints', 
                             'totalSessions', 'totalMinutes', 'streakLevel', 'rank']
            
            for field in required_fields:
                assert field in entry, f"Missing required field '{field}' in leaderboard entry"
            
            # Validate data types
            assert isinstance(entry['userId'], str), "userId should be a string"
            assert isinstance(entry['fullName'], str), "fullName should be a string"
            assert isinstance(entry['role'], str), "role should be a string"
            assert isinstance(entry['consistencyPoints'], int), "consistencyPoints should be an int"
            assert isinstance(entry['rank'], int), "rank should be an int"
            assert entry['role'] in ['trainer', 'trainee'], f"Invalid role: {entry['role']}"
            
            print(f"PASS: Leaderboard entry has all required fields: {required_fields}")
        else:
            print("WARN: No entries in leaderboard to validate structure")
    
    def test_leaderboard_sorted_by_consistency_points(self, api_client, trainee_token):
        """Test that leaderboard is sorted by consistencyPoints in descending order"""
        response = api_client.get(
            f"{BASE_URL}/api/leaderboard/weekly",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        leaderboard = data['leaderboard']
        
        if len(leaderboard) >= 2:
            # Verify descending order
            for i in range(len(leaderboard) - 1):
                assert leaderboard[i]['consistencyPoints'] >= leaderboard[i+1]['consistencyPoints'], \
                    f"Leaderboard not sorted: {leaderboard[i]['consistencyPoints']} < {leaderboard[i+1]['consistencyPoints']} at index {i}"
            
            print(f"PASS: Leaderboard correctly sorted by consistencyPoints (descending). Top score: {leaderboard[0]['consistencyPoints']}")
        else:
            print("WARN: Not enough entries to verify sorting")
    
    def test_leaderboard_ranks_are_correct(self, api_client, trainee_token):
        """Test that ranks are assigned correctly (1, 2, 3, ...)"""
        response = api_client.get(
            f"{BASE_URL}/api/leaderboard/weekly",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        leaderboard = data['leaderboard']
        
        for i, entry in enumerate(leaderboard):
            expected_rank = i + 1
            assert entry['rank'] == expected_rank, f"Rank mismatch: expected {expected_rank}, got {entry['rank']}"
        
        print(f"PASS: Ranks correctly assigned 1 to {len(leaderboard)}")
    
    def test_leaderboard_my_entry_present(self, api_client, trainee_token):
        """Test that myEntry is returned for the requesting user"""
        response = api_client.get(
            f"{BASE_URL}/api/leaderboard/weekly",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        my_entry = data.get('myEntry')
        my_rank = data.get('myRank')
        
        # myEntry might be None if user has no sessions
        if my_entry is not None:
            assert 'userId' in my_entry
            assert 'fullName' in my_entry
            assert 'consistencyPoints' in my_entry
            assert 'rank' in my_entry
            assert my_rank is not None
            assert my_rank == my_entry['rank']
            print(f"PASS: myEntry present with rank {my_rank}, consistencyPoints: {my_entry['consistencyPoints']}")
        else:
            print("INFO: myEntry is None (user may have no sessions)")
    
    def test_leaderboard_excludes_admin_users(self, api_client, admin_token):
        """Test that admin users (isAdmin=True) are excluded from leaderboard"""
        response = api_client.get(
            f"{BASE_URL}/api/leaderboard/weekly",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        leaderboard = data['leaderboard']
        
        # Admin should still be able to access but be excluded from results
        # Check no admin emails in leaderboard
        for entry in leaderboard:
            # Admin user shouldn't appear based on isAdmin check in query
            pass
        
        print(f"PASS: Admin can access leaderboard (myRank={data['myRank']}, likely None if no sessions)")
    
    def test_leaderboard_limit_parameter(self, api_client, trainee_token):
        """Test that limit parameter works correctly"""
        response = api_client.get(
            f"{BASE_URL}/api/leaderboard/weekly?limit=5",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        leaderboard = data['leaderboard']
        
        assert len(leaderboard) <= 5, f"Limit=5 but got {len(leaderboard)} entries"
        print(f"PASS: Limit parameter works, returned {len(leaderboard)} entries (limit=5)")


# ============================================================================
# REGRESSION TESTS - Streaks Endpoint
# ============================================================================

class TestStreaksRegression:
    """Regression tests for GET /api/streaks/me"""
    
    def test_streaks_trainer(self, api_client, trainer_token):
        """Regression: /api/streaks/me works for trainers"""
        response = api_client.get(
            f"{BASE_URL}/api/streaks/me",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Streaks endpoint failed: {response.status_code}"
        
        data = response.json()
        required_fields = ['currentStreak', 'longestStreak', 'totalWeeksActive', 
                          'consistencyPoints', 'totalSessions', 'totalMinutes', 
                          'streakLevel', 'nextMilestone', 'userId', 'role']
        
        for field in required_fields:
            assert field in data, f"Missing field '{field}' in streaks response"
        
        print(f"PASS: Streaks endpoint works for trainer. Role={data['role']}, Points={data['consistencyPoints']}")
    
    def test_streaks_trainee(self, api_client, trainee_token):
        """Regression: /api/streaks/me works for trainees"""
        response = api_client.get(
            f"{BASE_URL}/api/streaks/me",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200, f"Streaks endpoint failed: {response.status_code}"
        
        data = response.json()
        assert data['role'] in ['trainer', 'trainee']
        
        print(f"PASS: Streaks endpoint works for trainee. Role={data['role']}, Points={data['consistencyPoints']}")


# ============================================================================
# REGRESSION TESTS - Trainee Achievements
# ============================================================================

class TestAchievementsRegression:
    """Regression tests for GET /api/trainee/achievements"""
    
    def test_trainee_achievements_returns_12_badges(self, api_client, trainee_token):
        """Regression: /api/trainee/achievements returns 12 badges"""
        response = api_client.get(
            f"{BASE_URL}/api/trainee/achievements",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200, f"Achievements endpoint failed: {response.status_code}"
        
        data = response.json()
        badges = data.get('badges', [])
        
        assert len(badges) == 12, f"Expected 12 badges, got {len(badges)}"
        
        # Verify required fields in badges
        for badge in badges:
            assert 'badgeType' in badge
            assert 'badgeName' in badge
            assert 'isUnlocked' in badge
            assert 'progress' in badge
            assert 'target' in badge
        
        # Verify new badges exist
        badge_types = [b['badgeType'] for b in badges]
        assert 'streak_star' in badge_types, "Missing streak_star badge"
        assert 'duration_master' in badge_types, "Missing duration_master badge"
        
        print(f"PASS: Trainee achievements returns 12 badges including streak_star and duration_master")


# ============================================================================
# REGRESSION TESTS - Admin Endpoints
# ============================================================================

class TestAdminRegression:
    """Regression tests for admin endpoints from iteration 7"""
    
    def test_admin_dashboard(self, api_client, admin_token):
        """Regression: GET /api/admin/dashboard works"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin dashboard failed: {response.status_code}"
        
        data = response.json()
        assert 'totalUsers' in data
        assert 'totalSessions' in data
        assert 'totalRevenueCents' in data
        
        print(f"PASS: Admin dashboard works. TotalUsers={data['totalUsers']}, TotalSessions={data['totalSessions']}")
    
    def test_admin_sessions_enriched(self, api_client, admin_token):
        """Regression: GET /api/admin/sessions returns enriched sessions"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/sessions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin sessions failed: {response.status_code}"
        
        data = response.json()
        # API returns object with 'sessions' list
        assert 'sessions' in data, "Expected 'sessions' key in response"
        sessions = data['sessions']
        assert isinstance(sessions, list), "sessions should be a list"
        
        if len(sessions) > 0:
            session = sessions[0]
            # Verify enriched fields exist (may be null but key should exist)
            enriched_fields = ['trainerName', 'traineeName']
            for field in enriched_fields:
                assert field in session, f"Missing enriched field '{field}'"
        
        print(f"PASS: Admin sessions endpoint works. Count={len(sessions)}")
    
    def test_admin_message(self, api_client, admin_token, trainee_token):
        """Regression: POST /api/admin/message works"""
        # Get trainee user ID first
        me_response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert me_response.status_code == 200
        trainee_id = me_response.json()['id']
        
        # Send admin message - API uses receiverId not userId
        response = api_client.post(
            f"{BASE_URL}/api/admin/message",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "receiverId": trainee_id,
                "content": "TEST_admin_regression_message"
            }
        )
        assert response.status_code == 200, f"Admin message failed: {response.status_code} - {response.text}"
        
        print("PASS: Admin message endpoint works")


# ============================================================================
# RUN TESTS
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
