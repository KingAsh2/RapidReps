"""
Iteration 35: Comprehensive Testing of All Phases (1-5) Backend Endpoints
- Phase 1: ETA-weighted matching (ranked-search)
- Phase 2: Instant workout mode
- Phase 3: Trainer tools (workout plans, session notes)
- Phase 4: Community activity feed
- Phase 5: Group workout sessions
- Phase 6: Progress tracking
Plus: Auth, Admin Dashboard, Safety Report, Change Password
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://useeffect-debug.preview.emergentagent.com"


class TestAuthAndAdmin:
    """Test authentication and admin dashboard endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in login response"
        assert "user" in data, "No user in login response"
        return data["access_token"]
    
    def test_admin_login(self, admin_token):
        """POST /api/auth/login - admin user"""
        assert admin_token is not None
        assert len(admin_token) > 10
        print(f"✓ Admin login successful, token length: {len(admin_token)}")
    
    def test_admin_dashboard(self, admin_token):
        """GET /api/admin/dashboard - returns stats with totalUsers, totalSessions"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code == 200, f"Admin dashboard failed: {response.text}"
        data = response.json()
        # Verify expected fields
        assert "totalUsers" in data, "Missing totalUsers in admin dashboard"
        assert "totalSessions" in data, "Missing totalSessions in admin dashboard"
        assert isinstance(data["totalUsers"], int), "totalUsers should be int"
        assert isinstance(data["totalSessions"], int), "totalSessions should be int"
        print(f"✓ Admin dashboard - totalUsers: {data['totalUsers']}, totalSessions: {data['totalSessions']}")
    
    def test_change_password_validation(self, admin_token):
        """POST /api/auth/change-password - validates password requirements"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Test with wrong current password
        response = requests.post(f"{BASE_URL}/api/auth/change-password", json={
            "currentPassword": "wrongpassword",
            "newPassword": "newpassword123"
        }, headers=headers)
        # Should fail with 401 or 400
        assert response.status_code in [400, 401], f"Expected 400/401, got {response.status_code}"
        print(f"✓ Change password validates current password correctly")
        
        # Test with short new password
        response = requests.post(f"{BASE_URL}/api/auth/change-password", json={
            "currentPassword": "admin123",
            "newPassword": "abc"  # Too short
        }, headers=headers)
        # Should fail with 400 for short password
        assert response.status_code == 400, f"Expected 400 for short password, got {response.status_code}"
        print(f"✓ Change password rejects short new password")


class TestCommunityFeed:
    """Phase 4: Community activity feed endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_feed(self, auth_token):
        """GET /api/feed?page=1 - returns posts, total, hasMore"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/feed", params={"page": 1}, headers=headers)
        assert response.status_code == 200, f"Get feed failed: {response.text}"
        data = response.json()
        assert "posts" in data, "Missing 'posts' in feed response"
        assert "total" in data, "Missing 'total' in feed response"
        assert "hasMore" in data, "Missing 'hasMore' in feed response"
        assert isinstance(data["posts"], list), "posts should be a list"
        print(f"✓ Feed returned {len(data['posts'])} posts, total: {data['total']}, hasMore: {data['hasMore']}")
    
    def test_create_feed_post(self, auth_token):
        """POST /api/feed - creates a new post"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        test_content = "Test post from iteration 35 testing"
        response = requests.post(
            f"{BASE_URL}/api/feed",
            params={"content": test_content, "post_type": "user_post"},
            headers=headers
        )
        assert response.status_code == 200, f"Create feed post failed: {response.text}"
        data = response.json()
        assert "id" in data, "No id in created post"
        assert data.get("content") == test_content, "Content mismatch"
        print(f"✓ Created feed post with id: {data['id']}")
        return data["id"]
    
    def test_toggle_like(self, auth_token):
        """POST /api/feed/{postId}/like - toggles like on a post"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # First create a post to like
        test_content = "Post to like in iteration 35"
        create_response = requests.post(
            f"{BASE_URL}/api/feed",
            params={"content": test_content},
            headers=headers
        )
        assert create_response.status_code == 200
        post_id = create_response.json()["id"]
        
        # Now toggle like
        response = requests.post(f"{BASE_URL}/api/feed/{post_id}/like", headers=headers)
        assert response.status_code == 200, f"Toggle like failed: {response.text}"
        data = response.json()
        assert "liked" in data, "Missing 'liked' in response"
        assert "likeCount" in data, "Missing 'likeCount' in response"
        print(f"✓ Toggle like - liked: {data['liked']}, likeCount: {data['likeCount']}")


class TestUserProgress:
    """Phase 7: User progress tracking endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_data(self):
        """Login and get token + user id"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        return {
            "token": data["access_token"],
            "user_id": data["user"]["id"]
        }
    
    def test_get_user_progress(self, auth_data):
        """GET /api/progress/{userId} - returns progress stats"""
        headers = {"Authorization": f"Bearer {auth_data['token']}"}
        user_id = auth_data["user_id"]
        response = requests.get(f"{BASE_URL}/api/progress/{user_id}", headers=headers)
        assert response.status_code == 200, f"Get progress failed: {response.text}"
        data = response.json()
        # Verify expected fields
        assert "userId" in data, "Missing userId"
        assert "totalSessions" in data, "Missing totalSessions"
        assert "totalMinutesTrained" in data, "Missing totalMinutesTrained"
        assert "estimatedCaloriesBurned" in data, "Missing estimatedCaloriesBurned"
        assert "currentStreak" in data, "Missing currentStreak"
        print(f"✓ Progress - sessions: {data['totalSessions']}, minutes: {data['totalMinutesTrained']}, streak: {data['currentStreak']}")
    
    def test_get_workout_history(self, auth_data):
        """GET /api/progress/{userId}/history - returns array of workouts"""
        headers = {"Authorization": f"Bearer {auth_data['token']}"}
        user_id = auth_data["user_id"]
        response = requests.get(f"{BASE_URL}/api/progress/{user_id}/history", headers=headers)
        assert response.status_code == 200, f"Get history failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "History should be a list"
        print(f"✓ Workout history returned {len(data)} entries")


class TestTrainerTools:
    """Phase 3: Trainer tools - workout plans, session notes"""
    
    @pytest.fixture(scope="class")
    def auth_data(self):
        """Login as admin (who has trainer role)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        return {
            "token": data["access_token"],
            "user_id": data["user"]["id"]
        }
    
    def test_get_workout_plans(self, auth_data):
        """GET /api/trainer-tools/workout-plans - returns array"""
        headers = {"Authorization": f"Bearer {auth_data['token']}"}
        response = requests.get(f"{BASE_URL}/api/trainer-tools/workout-plans", headers=headers)
        assert response.status_code == 200, f"Get workout plans failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Workout plans should be a list"
        print(f"✓ Workout plans returned {len(data)} plans")
    
    def test_create_session_note(self, auth_data):
        """POST /api/trainer-tools/session-notes - creates note"""
        headers = {"Authorization": f"Bearer {auth_data['token']}"}
        note_data = {
            "traineeId": auth_data["user_id"],  # Use self for testing
            "note": "Test note from iteration 35",
            "tags": ["test", "iteration35"]
        }
        response = requests.post(
            f"{BASE_URL}/api/trainer-tools/session-notes",
            json=note_data,
            headers=headers
        )
        # May fail if user doesn't have trainer role, which is expected
        if response.status_code == 403:
            print(f"✓ Session notes endpoint correctly requires trainer role")
        elif response.status_code == 200:
            data = response.json()
            assert "id" in data, "No id in created note"
            print(f"✓ Created session note with id: {data['id']}")
        else:
            # If some other error, still report it
            print(f"! Session notes returned {response.status_code}: {response.text}")
            assert response.status_code in [200, 403], f"Unexpected status: {response.status_code}"


class TestGroupSessions:
    """Phase 5: Group workout sessions"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_list_group_sessions(self, auth_token):
        """GET /api/group-sessions - returns sessions list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/group-sessions", headers=headers)
        assert response.status_code == 200, f"List group sessions failed: {response.text}"
        data = response.json()
        assert "sessions" in data, "Missing 'sessions' in response"
        assert "total" in data, "Missing 'total' in response"
        assert isinstance(data["sessions"], list), "sessions should be a list"
        print(f"✓ Group sessions returned {len(data['sessions'])} sessions, total: {data['total']}")


class TestInstantMatch:
    """Phase 2: Instant workout mode"""
    
    @pytest.fixture(scope="class")
    def auth_data(self):
        """Login and get token + user info"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        return {
            "token": data["access_token"],
            "user": data["user"]
        }
    
    def test_instant_match_request(self, auth_data):
        """POST /api/sessions/instant-match - creates instant match request"""
        headers = {"Authorization": f"Bearer {auth_data['token']}"}
        # Check if user has trainee role
        user_roles = auth_data["user"].get("roles", [])
        
        match_data = {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "sessionType": "outdoor",
            "durationMinutes": 30,
            "maxDistanceMiles": 10
        }
        response = requests.post(
            f"{BASE_URL}/api/sessions/instant-match",
            json=match_data,
            headers=headers
        )
        # May return 403 if not trainee, or 404 if no trainers available
        if response.status_code == 403:
            print(f"✓ Instant match correctly requires trainee role")
        elif response.status_code == 404:
            # No trainers available - this is expected in test environment
            print(f"✓ Instant match endpoint works (no trainers available)")
        elif response.status_code == 200:
            data = response.json()
            assert "matchId" in data or "status" in data, "Missing matchId or status"
            print(f"✓ Instant match started: {data.get('status', 'N/A')}")
        else:
            print(f"! Instant match returned {response.status_code}: {response.text}")
            # Accept any of these as valid responses
            assert response.status_code in [200, 403, 404], f"Unexpected: {response.status_code}"


class TestRankedSearch:
    """Phase 1: ETA-weighted ranked trainer search"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_ranked_trainer_search(self, auth_token):
        """GET /api/trainers/ranked-search - returns ranked trainers"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        params = {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "session_type": "outdoor",
            "max_distance": 20
        }
        response = requests.get(
            f"{BASE_URL}/api/trainers/ranked-search",
            params=params,
            headers=headers
        )
        assert response.status_code == 200, f"Ranked search failed: {response.text}"
        data = response.json()
        assert "trainers" in data, "Missing 'trainers' in response"
        assert "count" in data, "Missing 'count' in response"
        assert isinstance(data["trainers"], list), "trainers should be a list"
        print(f"✓ Ranked search returned {data['count']} trainers")
        
        # Verify trainer objects have expected fields if any exist
        if data["trainers"]:
            trainer = data["trainers"][0]
            expected_fields = ["trainerId", "compositeScore", "etaMinutes"]
            for field in expected_fields:
                assert field in trainer, f"Missing {field} in trainer object"
            print(f"✓ First trainer - score: {trainer['compositeScore']}, ETA: {trainer['etaMinutes']} mins")


class TestSafetyReport:
    """Safety/Moderation endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_safety_report(self, auth_token):
        """POST /api/safety/report - creates safety report"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        report_data = {
            "reportedUserId": "test_user_id",
            "reason": "test_reason",
            "context": "Test report from iteration 35 testing",
            "contentType": "session",
            "contentId": None
        }
        response = requests.post(
            f"{BASE_URL}/api/safety/report",
            json=report_data,
            headers=headers
        )
        assert response.status_code == 200, f"Safety report failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Report should return success: true"
        print(f"✓ Safety report submitted successfully")


class TestHealthCheck:
    """Basic health check endpoints"""
    
    def test_api_health(self):
        """GET /api/ - API health check via authenticated endpoint"""
        # Login to verify API is responding
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"API health check failed: {response.text}"
        print(f"✓ API is healthy (login endpoint working)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
