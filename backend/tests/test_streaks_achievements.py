"""
Test suite for RapidReps Streaks and Achievements System (Iteration 8)

Tests:
1. GET /api/streaks/me - streak data for trainer
2. GET /api/streaks/me - streak data for trainee
3. GET /api/streaks/me - requires authentication (401 without token)
4. GET /api/trainee/achievements - returns 12 badges including new streak_star and duration_master
5. GET /api/trainee/achievements - Streak Star badge progress matches streak data
6. GET /api/trainee/achievements - Duration Master badge tracks total minutes

Regression tests for admin endpoints from iteration 7:
7. GET /api/admin/dashboard
8. GET /api/admin/sessions
9. GET /api/admin/users
10. POST /api/admin/refund
11. PUT /api/admin/profile
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

# Base URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/') or os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://safety-check-deploy.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINER_EMAIL = "trainer1@test.com"
TRAINER_PASSWORD = "test123"
TRAINEE_EMAIL = "trainee1@test.com"
TRAINEE_PASSWORD = "test123"


class TestAuthentication:
    """Helper class for authentication"""
    
    @staticmethod
    def login(email: str, password: str) -> str:
        """Login and return token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        return None

    @staticmethod
    def get_auth_header(token: str) -> dict:
        """Return auth header dict"""
        return {"Authorization": f"Bearer {token}"}


# ============================================================================
# STREAKS SYSTEM TESTS
# ============================================================================

class TestStreaksEndpoint:
    """Tests for GET /api/streaks/me endpoint"""
    
    def test_streaks_requires_authentication(self):
        """Test that /api/streaks/me returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/streaks/me")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: /api/streaks/me requires authentication (401 without token)")
    
    def test_trainer_streaks_data(self):
        """Test that trainer can get streak data with all required fields"""
        token = TestAuthentication.login(TRAINER_EMAIL, TRAINER_PASSWORD)
        assert token is not None, "Failed to login as trainer"
        
        response = requests.get(
            f"{BASE_URL}/api/streaks/me",
            headers=TestAuthentication.get_auth_header(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify all required fields are present
        required_fields = [
            'currentStreak', 'longestStreak', 'totalWeeksActive',
            'consistencyPoints', 'totalSessions', 'totalMinutes',
            'streakLevel', 'nextMilestone', 'userId', 'role'
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify role is trainer
        assert data['role'] == 'trainer', f"Expected role 'trainer', got {data['role']}"
        
        # Verify data types
        assert isinstance(data['currentStreak'], int), "currentStreak should be int"
        assert isinstance(data['longestStreak'], int), "longestStreak should be int"
        assert isinstance(data['totalWeeksActive'], int), "totalWeeksActive should be int"
        assert isinstance(data['consistencyPoints'], int), "consistencyPoints should be int"
        assert isinstance(data['totalSessions'], int), "totalSessions should be int"
        assert isinstance(data['totalMinutes'], int), "totalMinutes should be int"
        assert data['streakLevel'] in ['none', 'warming', 'fire', 'blazing', 'legend'], f"Invalid streakLevel: {data['streakLevel']}"
        assert isinstance(data['nextMilestone'], int), "nextMilestone should be int"
        
        print(f"PASS: Trainer streaks data returned correctly")
        print(f"  - currentStreak: {data['currentStreak']}")
        print(f"  - longestStreak: {data['longestStreak']}")
        print(f"  - totalSessions: {data['totalSessions']}")
        print(f"  - totalMinutes: {data['totalMinutes']}")
        print(f"  - consistencyPoints: {data['consistencyPoints']}")
        print(f"  - streakLevel: {data['streakLevel']}")
    
    def test_trainee_streaks_data(self):
        """Test that trainee can get streak data with all required fields"""
        token = TestAuthentication.login(TRAINEE_EMAIL, TRAINEE_PASSWORD)
        assert token is not None, "Failed to login as trainee"
        
        response = requests.get(
            f"{BASE_URL}/api/streaks/me",
            headers=TestAuthentication.get_auth_header(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify all required fields are present
        required_fields = [
            'currentStreak', 'longestStreak', 'totalWeeksActive',
            'consistencyPoints', 'totalSessions', 'totalMinutes',
            'streakLevel', 'nextMilestone', 'userId', 'role'
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify role is trainee
        assert data['role'] == 'trainee', f"Expected role 'trainee', got {data['role']}"
        
        print(f"PASS: Trainee streaks data returned correctly")
        print(f"  - currentStreak: {data['currentStreak']}")
        print(f"  - totalSessions: {data['totalSessions']}")
        print(f"  - totalMinutes: {data['totalMinutes']}")
        print(f"  - consistencyPoints: {data['consistencyPoints']}")
        
        # Store for later comparison
        return data


# ============================================================================
# TRAINEE ACHIEVEMENTS TESTS
# ============================================================================

class TestTraineeAchievements:
    """Tests for GET /api/trainee/achievements endpoint"""
    
    def test_achievements_returns_12_badges(self):
        """Test that achievements endpoint returns exactly 12 badges including new ones"""
        token = TestAuthentication.login(TRAINEE_EMAIL, TRAINEE_PASSWORD)
        assert token is not None, "Failed to login as trainee"
        
        response = requests.get(
            f"{BASE_URL}/api/trainee/achievements",
            headers=TestAuthentication.get_auth_header(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify badges array exists
        assert 'badges' in data, "Response should contain 'badges' array"
        badges = data['badges']
        
        # Verify we have 12 badges
        assert len(badges) == 12, f"Expected 12 badges, got {len(badges)}"
        
        # Get badge types
        badge_types = [b['badgeType'] for b in badges]
        
        # Verify new badges are present
        assert 'streak_star' in badge_types, "streak_star badge should be present"
        assert 'duration_master' in badge_types, "duration_master badge should be present"
        
        print(f"PASS: Achievements endpoint returns 12 badges")
        print(f"  Badge types: {badge_types}")
        
        return data
    
    def test_streak_star_badge_structure(self):
        """Test Streak Star badge has correct structure and description"""
        token = TestAuthentication.login(TRAINEE_EMAIL, TRAINEE_PASSWORD)
        assert token is not None, "Failed to login as trainee"
        
        response = requests.get(
            f"{BASE_URL}/api/trainee/achievements",
            headers=TestAuthentication.get_auth_header(token)
        )
        
        assert response.status_code == 200
        
        data = response.json()
        badges = data['badges']
        
        # Find streak_star badge
        streak_star = next((b for b in badges if b['badgeType'] == 'streak_star'), None)
        
        assert streak_star is not None, "streak_star badge not found"
        
        # Verify structure
        assert streak_star['badgeName'] == 'Streak Star', f"Expected 'Streak Star', got {streak_star.get('badgeName')}"
        assert 'description' in streak_star, "Badge should have description"
        assert 'isUnlocked' in streak_star, "Badge should have isUnlocked"
        assert 'progress' in streak_star, "Badge should have progress"
        assert 'target' in streak_star, "Badge should have target"
        assert streak_star['target'] == 4, f"Streak Star target should be 4 weeks, got {streak_star['target']}"
        
        print(f"PASS: Streak Star badge has correct structure")
        print(f"  - Name: {streak_star['badgeName']}")
        print(f"  - Description: {streak_star['description']}")
        print(f"  - Progress: {streak_star['progress']}/{streak_star['target']}")
        print(f"  - Unlocked: {streak_star['isUnlocked']}")
    
    def test_duration_master_badge_structure(self):
        """Test Duration Master badge has correct structure and tracks minutes"""
        token = TestAuthentication.login(TRAINEE_EMAIL, TRAINEE_PASSWORD)
        assert token is not None, "Failed to login as trainee"
        
        response = requests.get(
            f"{BASE_URL}/api/trainee/achievements",
            headers=TestAuthentication.get_auth_header(token)
        )
        
        assert response.status_code == 200
        
        data = response.json()
        badges = data['badges']
        
        # Find duration_master badge
        duration_master = next((b for b in badges if b['badgeType'] == 'duration_master'), None)
        
        assert duration_master is not None, "duration_master badge not found"
        
        # Verify structure
        assert duration_master['badgeName'] == 'Duration Master', f"Expected 'Duration Master', got {duration_master.get('badgeName')}"
        assert 'description' in duration_master, "Badge should have description"
        assert 'isUnlocked' in duration_master, "Badge should have isUnlocked"
        assert 'progress' in duration_master, "Badge should have progress"
        assert 'target' in duration_master, "Badge should have target"
        assert duration_master['target'] == 500, f"Duration Master target should be 500 minutes, got {duration_master['target']}"
        
        print(f"PASS: Duration Master badge has correct structure")
        print(f"  - Name: {duration_master['badgeName']}")
        print(f"  - Description: {duration_master['description']}")
        print(f"  - Progress: {duration_master['progress']}/{duration_master['target']} minutes")
        print(f"  - Unlocked: {duration_master['isUnlocked']}")
    
    def test_streak_star_matches_streak_data(self):
        """Test that Streak Star badge progress matches streak data from /api/streaks/me"""
        token = TestAuthentication.login(TRAINEE_EMAIL, TRAINEE_PASSWORD)
        assert token is not None, "Failed to login as trainee"
        
        headers = TestAuthentication.get_auth_header(token)
        
        # Get streak data
        streaks_response = requests.get(f"{BASE_URL}/api/streaks/me", headers=headers)
        assert streaks_response.status_code == 200, f"Failed to get streaks: {streaks_response.text}"
        streaks_data = streaks_response.json()
        
        # Get achievements
        achievements_response = requests.get(f"{BASE_URL}/api/trainee/achievements", headers=headers)
        assert achievements_response.status_code == 200, f"Failed to get achievements: {achievements_response.text}"
        achievements_data = achievements_response.json()
        
        # Find streak_star badge
        badges = achievements_data['badges']
        streak_star = next((b for b in badges if b['badgeType'] == 'streak_star'), None)
        
        assert streak_star is not None, "streak_star badge not found"
        
        # The badge progress should be based on longestStreak (max 4)
        longest_streak = streaks_data.get('longestStreak', 0)
        expected_progress = min(longest_streak, 4)
        
        assert streak_star['progress'] == expected_progress, \
            f"Streak Star progress ({streak_star['progress']}) should match longestStreak ({longest_streak}) capped at 4"
        
        # If longest streak >= 4, badge should be unlocked
        if longest_streak >= 4:
            assert streak_star['isUnlocked'] == True, "Badge should be unlocked with longestStreak >= 4"
        
        print(f"PASS: Streak Star badge progress matches streak data")
        print(f"  - longestStreak from /api/streaks/me: {longest_streak}")
        print(f"  - Streak Star progress: {streak_star['progress']}")
        print(f"  - Badge unlocked: {streak_star['isUnlocked']}")
    
    def test_duration_master_matches_streak_data(self):
        """Test that Duration Master badge progress matches totalMinutes from /api/streaks/me"""
        token = TestAuthentication.login(TRAINEE_EMAIL, TRAINEE_PASSWORD)
        assert token is not None, "Failed to login as trainee"
        
        headers = TestAuthentication.get_auth_header(token)
        
        # Get streak data
        streaks_response = requests.get(f"{BASE_URL}/api/streaks/me", headers=headers)
        assert streaks_response.status_code == 200, f"Failed to get streaks: {streaks_response.text}"
        streaks_data = streaks_response.json()
        
        # Get achievements
        achievements_response = requests.get(f"{BASE_URL}/api/trainee/achievements", headers=headers)
        assert achievements_response.status_code == 200, f"Failed to get achievements: {achievements_response.text}"
        achievements_data = achievements_response.json()
        
        # Find duration_master badge
        badges = achievements_data['badges']
        duration_master = next((b for b in badges if b['badgeType'] == 'duration_master'), None)
        
        assert duration_master is not None, "duration_master badge not found"
        
        # The badge progress should be based on totalMinutes (max 500)
        total_minutes = streaks_data.get('totalMinutes', 0)
        expected_progress = min(total_minutes, 500)
        
        assert duration_master['progress'] == expected_progress, \
            f"Duration Master progress ({duration_master['progress']}) should match totalMinutes ({total_minutes}) capped at 500"
        
        # If total minutes >= 500, badge should be unlocked
        if total_minutes >= 500:
            assert duration_master['isUnlocked'] == True, "Badge should be unlocked with totalMinutes >= 500"
        
        print(f"PASS: Duration Master badge progress matches streak data")
        print(f"  - totalMinutes from /api/streaks/me: {total_minutes}")
        print(f"  - Duration Master progress: {duration_master['progress']}")
        print(f"  - Badge unlocked: {duration_master['isUnlocked']}")


# ============================================================================
# ADMIN ENDPOINTS REGRESSION TESTS (from iteration 7)
# ============================================================================

class TestAdminEndpointsRegression:
    """Quick regression tests for admin endpoints from iteration 7"""
    
    def test_admin_dashboard(self):
        """Test GET /api/admin/dashboard still works"""
        token = TestAuthentication.login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to login as admin"
        
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers=TestAuthentication.get_auth_header(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify key fields
        assert 'totalUsers' in data, "Should have totalUsers"
        assert 'totalTrainers' in data, "Should have totalTrainers"
        assert 'totalTrainees' in data, "Should have totalTrainees"
        assert 'totalSessions' in data, "Should have totalSessions"
        
        print(f"PASS: Admin dashboard working")
        print(f"  - totalUsers: {data.get('totalUsers')}")
        print(f"  - totalTrainers: {data.get('totalTrainers')}")
        print(f"  - totalTrainees: {data.get('totalTrainees')}")
    
    def test_admin_sessions(self):
        """Test GET /api/admin/sessions still works with enriched fields"""
        token = TestAuthentication.login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to login as admin"
        
        response = requests.get(
            f"{BASE_URL}/api/admin/sessions",
            headers=TestAuthentication.get_auth_header(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify it's paginated response with sessions list
        assert 'sessions' in data, "Should return paginated object with 'sessions'"
        assert isinstance(data['sessions'], list), "sessions should be a list"
        
        print(f"PASS: Admin sessions endpoint working ({len(data['sessions'])} sessions, total: {data.get('total')})")
    
    def test_admin_users(self):
        """Test GET /api/admin/users still works"""
        token = TestAuthentication.login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to login as admin"
        
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers=TestAuthentication.get_auth_header(token)
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify it's paginated response with users list
        assert 'users' in data, "Should return paginated object with 'users'"
        assert isinstance(data['users'], list), "users should be a list"
        
        # Verify passwordHash is excluded
        if len(data['users']) > 0:
            assert 'passwordHash' not in data['users'][0], "passwordHash should be excluded from response"
        
        print(f"PASS: Admin users endpoint working ({len(data['users'])} users, total: {data.get('total')})")
    
    def test_admin_dashboard_requires_auth(self):
        """Test that admin endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Admin dashboard requires authentication")
    
    def test_admin_dashboard_requires_admin_role(self):
        """Test that admin endpoints reject non-admin users"""
        # Login as regular trainee
        token = TestAuthentication.login(TRAINEE_EMAIL, TRAINEE_PASSWORD)
        assert token is not None, "Failed to login as trainee"
        
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers=TestAuthentication.get_auth_header(token)
        )
        
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("PASS: Admin dashboard rejects non-admin users")


# ============================================================================
# ADDITIONAL VALIDATION TESTS
# ============================================================================

class TestAllBadgesStructure:
    """Validate all 12 badges have proper structure"""
    
    def test_all_badges_have_required_fields(self):
        """Test all badges have required fields"""
        token = TestAuthentication.login(TRAINEE_EMAIL, TRAINEE_PASSWORD)
        assert token is not None, "Failed to login as trainee"
        
        response = requests.get(
            f"{BASE_URL}/api/trainee/achievements",
            headers=TestAuthentication.get_auth_header(token)
        )
        
        assert response.status_code == 200
        data = response.json()
        badges = data['badges']
        
        required_fields = ['badgeType', 'badgeName', 'description', 'isUnlocked', 'progress', 'target']
        
        for badge in badges:
            for field in required_fields:
                assert field in badge, f"Badge {badge.get('badgeType', 'unknown')} missing field: {field}"
        
        print("PASS: All 12 badges have required fields")
        
        # Print summary of all badges
        print("\nAll badges:")
        for i, badge in enumerate(badges, 1):
            print(f"  {i}. {badge['badgeType']}: {badge['badgeName']} - {badge['progress']}/{badge['target']} {'[UNLOCKED]' if badge['isUnlocked'] else ''}")


# ============================================================================
# RUN TESTS
# ============================================================================

if __name__ == "__main__":
    # Run all tests
    pytest.main([__file__, "-v", "--tb=short"])
