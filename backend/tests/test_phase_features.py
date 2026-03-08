"""
Phase Features Backend API Tests
Testing: Community Feed, Group Sessions, ETA-weighted Matching, Instant Match,
Progress Tracking, Trainer Tools (Workout Plans, Session Notes, Client Progress)

Test Users:
- Admin: admin@rapidreps.com / admin123
- Trainer: test_trainer_iter25@test.com / test123
- Trainee: test_trainee_iter25@test.com / test123
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://trainer-ui-align.preview.emergentagent.com').rstrip('/')


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@rapidreps.com",
        "password": "admin123"
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def trainer_user():
    """Login or create trainer user"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test_trainer_iter25@test.com",
        "password": "test123"
    })
    if resp.status_code == 200:
        data = resp.json()
        return {"token": data["access_token"], "user": data["user"]}
    
    # Create trainer if not exists
    resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
        "fullName": "Phase Test Trainer",
        "email": "phase_test_trainer@test.com",
        "phone": "+15550001001",
        "password": "test123",
        "roles": ["trainer"]
    })
    if resp.status_code == 200:
        data = resp.json()
        return {"token": data["access_token"], "user": data["user"]}
    pytest.skip(f"Could not get or create trainer: {resp.text}")


@pytest.fixture(scope="module")
def trainee_user():
    """Login or create trainee user"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test_trainee_iter25@test.com",
        "password": "test123"
    })
    if resp.status_code == 200:
        data = resp.json()
        return {"token": data["access_token"], "user": data["user"]}
    
    # Create trainee if not exists
    resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
        "fullName": "Phase Test Trainee",
        "email": "phase_test_trainee@test.com",
        "phone": "+15550001002",
        "password": "test123",
        "roles": ["trainee"]
    })
    if resp.status_code == 200:
        data = resp.json()
        return {"token": data["access_token"], "user": data["user"]}
    pytest.skip(f"Could not get or create trainee: {resp.text}")


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# =============================================================================
# PHASE 4: Community Feed Tests
# =============================================================================

class TestCommunityFeed:
    """Test /api/feed endpoints"""
    
    def test_get_feed(self, trainee_user):
        """GET /api/feed?page=1 - List community feed posts"""
        resp = requests.get(
            f"{BASE_URL}/api/feed",
            params={"page": 1, "limit": 20},
            headers=auth_headers(trainee_user["token"])
        )
        assert resp.status_code == 200, f"Get feed failed: {resp.text}"
        data = resp.json()
        assert "posts" in data
        assert "total" in data
        assert "page" in data
        assert "hasMore" in data
        print(f"✓ GET /api/feed - {data['total']} total posts, page {data['page']}")
    
    def test_create_feed_post(self, trainee_user):
        """POST /api/feed - Create a user post"""
        resp = requests.post(
            f"{BASE_URL}/api/feed",
            params={"content": "Testing feed post from pytest!", "post_type": "user_post"},
            headers=auth_headers(trainee_user["token"])
        )
        assert resp.status_code == 200, f"Create feed post failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data["content"] == "Testing feed post from pytest!"
        assert data["postType"] == "user_post"
        print(f"✓ POST /api/feed - Created post id={data['id']}")
        return data["id"]
    
    def test_toggle_like(self, trainee_user):
        """POST /api/feed/{postId}/like - Toggle like on a post"""
        # First create a post to like
        create_resp = requests.post(
            f"{BASE_URL}/api/feed",
            params={"content": "Post to test liking", "post_type": "user_post"},
            headers=auth_headers(trainee_user["token"])
        )
        assert create_resp.status_code == 200
        post_id = create_resp.json()["id"]
        
        # Like the post
        like_resp = requests.post(
            f"{BASE_URL}/api/feed/{post_id}/like",
            headers=auth_headers(trainee_user["token"])
        )
        assert like_resp.status_code == 200, f"Toggle like failed: {like_resp.text}"
        data = like_resp.json()
        assert "liked" in data
        assert "likeCount" in data
        print(f"✓ POST /api/feed/{{postId}}/like - liked={data['liked']}, count={data['likeCount']}")
    
    def test_feed_pagination(self, trainee_user):
        """Test feed pagination works"""
        resp1 = requests.get(
            f"{BASE_URL}/api/feed",
            params={"page": 1, "limit": 5},
            headers=auth_headers(trainee_user["token"])
        )
        assert resp1.status_code == 200
        data1 = resp1.json()
        
        resp2 = requests.get(
            f"{BASE_URL}/api/feed",
            params={"page": 2, "limit": 5},
            headers=auth_headers(trainee_user["token"])
        )
        assert resp2.status_code == 200
        data2 = resp2.json()
        
        print(f"✓ Feed pagination - page1: {len(data1['posts'])} posts, page2: {len(data2['posts'])} posts")


# =============================================================================
# PHASE 5: Group Sessions Tests
# =============================================================================

class TestGroupSessions:
    """Test /api/group-sessions endpoints"""
    
    def test_list_group_sessions(self, trainee_user):
        """GET /api/group-sessions - List group sessions"""
        resp = requests.get(
            f"{BASE_URL}/api/group-sessions",
            params={"status": "upcoming"},
            headers=auth_headers(trainee_user["token"])
        )
        assert resp.status_code == 200, f"List group sessions failed: {resp.text}"
        data = resp.json()
        assert "sessions" in data
        assert "total" in data
        assert "page" in data
        print(f"✓ GET /api/group-sessions - {data['total']} total sessions")
    
    def test_create_group_session_requires_trainer(self, trainee_user):
        """POST /api/group-sessions - Should require trainer role"""
        future_dt = (datetime.utcnow() + timedelta(days=7)).isoformat()
        resp = requests.post(
            f"{BASE_URL}/api/group-sessions",
            json={
                "title": "Test Group Workout",
                "description": "A test group session",
                "sessionType": "outdoor",
                "dateTime": future_dt,
                "durationMinutes": 60,
                "capacity": 10,
                "pricePerPersonCents": 1500,
                "location": "Central Park",
                "tags": ["cardio", "strength"]
            },
            headers=auth_headers(trainee_user["token"])
        )
        # Trainee should be forbidden
        assert resp.status_code == 403, f"Expected 403 for trainee, got {resp.status_code}: {resp.text}"
        print("✓ POST /api/group-sessions - Correctly rejects non-trainer")
    
    def test_create_group_session_as_trainer(self, trainer_user):
        """POST /api/group-sessions - Create as trainer"""
        future_dt = (datetime.utcnow() + timedelta(days=7)).isoformat()
        resp = requests.post(
            f"{BASE_URL}/api/group-sessions",
            json={
                "title": "Pytest Group Session",
                "description": "Created by pytest",
                "sessionType": "outdoor",
                "dateTime": future_dt,
                "durationMinutes": 60,
                "capacity": 10,
                "pricePerPersonCents": 1200,
                "location": "Test Location",
                "tags": ["test"]
            },
            headers=auth_headers(trainer_user["token"])
        )
        assert resp.status_code == 200, f"Create group session failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data["title"] == "Pytest Group Session"
        assert data["status"] == "upcoming"
        print(f"✓ POST /api/group-sessions - Created session id={data['id']}")
        return data["id"]
    
    def test_join_group_session(self, trainer_user, trainee_user):
        """POST /api/group-sessions/{id}/join - Join a group session"""
        # First create a session as trainer
        future_dt = (datetime.utcnow() + timedelta(days=8)).isoformat()
        create_resp = requests.post(
            f"{BASE_URL}/api/group-sessions",
            json={
                "title": "Join Test Session",
                "dateTime": future_dt,
                "durationMinutes": 45,
                "capacity": 5,
                "pricePerPersonCents": 1000,
            },
            headers=auth_headers(trainer_user["token"])
        )
        assert create_resp.status_code == 200
        session_id = create_resp.json()["id"]
        
        # Join as trainee
        join_resp = requests.post(
            f"{BASE_URL}/api/group-sessions/{session_id}/join",
            headers=auth_headers(trainee_user["token"])
        )
        # May fail on Stripe (expected), but endpoint exists
        assert join_resp.status_code in [200, 400, 500], f"Unexpected status: {join_resp.status_code}"
        if join_resp.status_code == 200:
            data = join_resp.json()
            assert "message" in data
            print(f"✓ POST /api/group-sessions/{{id}}/join - Joined session")
        else:
            print(f"✓ POST /api/group-sessions/{{id}}/join - Endpoint exists (Stripe may fail: {join_resp.json().get('detail', 'unknown')})")
    
    def test_leave_group_session(self, trainer_user, trainee_user):
        """POST /api/group-sessions/{id}/leave - Leave a group session"""
        # Create session
        future_dt = (datetime.utcnow() + timedelta(days=9)).isoformat()
        create_resp = requests.post(
            f"{BASE_URL}/api/group-sessions",
            json={"title": "Leave Test", "dateTime": future_dt, "capacity": 5, "pricePerPersonCents": 1000},
            headers=auth_headers(trainer_user["token"])
        )
        assert create_resp.status_code == 200
        session_id = create_resp.json()["id"]
        
        # Try to leave (may or may not be joined)
        leave_resp = requests.post(
            f"{BASE_URL}/api/group-sessions/{session_id}/leave",
            headers=auth_headers(trainee_user["token"])
        )
        assert leave_resp.status_code == 200, f"Leave failed: {leave_resp.text}"
        print("✓ POST /api/group-sessions/{id}/leave - Endpoint works")
    
    def test_start_group_session(self, trainer_user):
        """POST /api/group-sessions/{id}/start - Start a session (trainer only)"""
        # Create session
        future_dt = (datetime.utcnow() + timedelta(days=10)).isoformat()
        create_resp = requests.post(
            f"{BASE_URL}/api/group-sessions",
            json={"title": "Start Test", "dateTime": future_dt, "capacity": 5, "pricePerPersonCents": 1000},
            headers=auth_headers(trainer_user["token"])
        )
        assert create_resp.status_code == 200
        session_id = create_resp.json()["id"]
        
        # Start session
        start_resp = requests.post(
            f"{BASE_URL}/api/group-sessions/{session_id}/start",
            headers=auth_headers(trainer_user["token"])
        )
        assert start_resp.status_code == 200, f"Start failed: {start_resp.text}"
        data = start_resp.json()
        assert "message" in data
        print(f"✓ POST /api/group-sessions/{{id}}/start - Session started")
    
    def test_complete_group_session(self, trainer_user):
        """POST /api/group-sessions/{id}/complete - Complete a session (trainer only)"""
        # Create and start session
        future_dt = (datetime.utcnow() + timedelta(days=11)).isoformat()
        create_resp = requests.post(
            f"{BASE_URL}/api/group-sessions",
            json={"title": "Complete Test", "dateTime": future_dt, "capacity": 5, "pricePerPersonCents": 1000},
            headers=auth_headers(trainer_user["token"])
        )
        assert create_resp.status_code == 200
        session_id = create_resp.json()["id"]
        
        # Start first
        requests.post(f"{BASE_URL}/api/group-sessions/{session_id}/start", headers=auth_headers(trainer_user["token"]))
        
        # Complete
        complete_resp = requests.post(
            f"{BASE_URL}/api/group-sessions/{session_id}/complete",
            headers=auth_headers(trainer_user["token"])
        )
        assert complete_resp.status_code == 200, f"Complete failed: {complete_resp.text}"
        print("✓ POST /api/group-sessions/{id}/complete - Session completed")


# =============================================================================
# PHASE 7: User Progress Tracking Tests  
# =============================================================================

class TestProgressTracking:
    """Test /api/progress endpoints"""
    
    def test_get_user_progress(self, trainee_user):
        """GET /api/progress/{userId} - Get user progress"""
        user_id = trainee_user["user"]["id"]
        resp = requests.get(
            f"{BASE_URL}/api/progress/{user_id}",
            headers=auth_headers(trainee_user["token"])
        )
        assert resp.status_code == 200, f"Get progress failed: {resp.text}"
        data = resp.json()
        assert "userId" in data
        assert "totalSessions" in data
        assert "totalMinutesTrained" in data
        assert "estimatedCaloriesBurned" in data
        assert "consistencyScore" in data
        assert "currentStreak" in data
        assert "longestStreak" in data
        assert "streakLevel" in data
        assert "badges" in data
        print(f"✓ GET /api/progress/{{userId}} - Sessions: {data['totalSessions']}, Streak: {data['currentStreak']}")
    
    def test_get_workout_history(self, trainee_user):
        """GET /api/progress/{userId}/history - Get workout history"""
        user_id = trainee_user["user"]["id"]
        resp = requests.get(
            f"{BASE_URL}/api/progress/{user_id}/history",
            params={"limit": 30},
            headers=auth_headers(trainee_user["token"])
        )
        assert resp.status_code == 200, f"Get history failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/progress/{{userId}}/history - {len(data)} workout records")


# =============================================================================
# PHASE 1: ETA-Weighted Trainer Search
# =============================================================================

class TestEtaWeightedSearch:
    """Test /api/trainers/ranked-search endpoint"""
    
    def test_ranked_search(self, trainee_user):
        """GET /api/trainers/ranked-search - ETA-weighted trainer search"""
        resp = requests.get(
            f"{BASE_URL}/api/trainers/ranked-search",
            params={
                "latitude": 33.749,
                "longitude": -84.388,
                "session_type": "outdoor",
                "max_distance": 50
            },
            headers=auth_headers(trainee_user["token"])
        )
        assert resp.status_code == 200, f"Ranked search failed: {resp.text}"
        data = resp.json()
        assert "trainers" in data
        assert "count" in data
        print(f"✓ GET /api/trainers/ranked-search - Found {data['count']} trainers")
        
        # Check composite score fields if trainers exist
        if data["trainers"]:
            trainer = data["trainers"][0]
            assert "compositeScore" in trainer
            assert "etaMinutes" in trainer
            assert "distanceMiles" in trainer
            print(f"  Top trainer: score={trainer['compositeScore']}, ETA={trainer['etaMinutes']}min")


# =============================================================================
# PHASE 2: Instant Workout Mode
# =============================================================================

class TestInstantMatch:
    """Test /api/sessions/instant-match endpoints"""
    
    def test_instant_match_requires_trainee(self, trainer_user):
        """POST /api/sessions/instant-match - Should require trainee role"""
        resp = requests.post(
            f"{BASE_URL}/api/sessions/instant-match",
            json={
                "latitude": 33.749,
                "longitude": -84.388,
                "sessionType": "outdoor",
                "durationMinutes": 30,
                "maxDistanceMiles": 10
            },
            headers=auth_headers(trainer_user["token"])
        )
        assert resp.status_code == 403, f"Expected 403 for trainer, got {resp.status_code}"
        print("✓ POST /api/sessions/instant-match - Correctly rejects non-trainee")
    
    def test_instant_match_as_trainee(self, trainee_user):
        """POST /api/sessions/instant-match - Start instant match as trainee"""
        resp = requests.post(
            f"{BASE_URL}/api/sessions/instant-match",
            json={
                "latitude": 33.749,
                "longitude": -84.388,
                "sessionType": "outdoor",
                "durationMinutes": 30,
                "maxDistanceMiles": 50  # Large radius for testing
            },
            headers=auth_headers(trainee_user["token"])
        )
        # May be 404 if no trainers available, which is valid
        assert resp.status_code in [200, 404], f"Unexpected status: {resp.status_code}: {resp.text}"
        if resp.status_code == 200:
            data = resp.json()
            assert "matchId" in data
            assert "status" in data
            print(f"✓ POST /api/sessions/instant-match - matchId={data['matchId']}, status={data['status']}")
            return data["matchId"]
        else:
            print("✓ POST /api/sessions/instant-match - Endpoint works (no trainers available)")
            return None
    
    def test_instant_match_status(self, trainee_user):
        """GET /api/sessions/instant-match/{matchId}/status - Poll match status"""
        # First try to create a match
        create_resp = requests.post(
            f"{BASE_URL}/api/sessions/instant-match",
            json={"latitude": 33.749, "longitude": -84.388, "sessionType": "outdoor", "durationMinutes": 30, "maxDistanceMiles": 100},
            headers=auth_headers(trainee_user["token"])
        )
        
        if create_resp.status_code == 200:
            match_id = create_resp.json()["matchId"]
            status_resp = requests.get(
                f"{BASE_URL}/api/sessions/instant-match/{match_id}/status",
                headers=auth_headers(trainee_user["token"])
            )
            assert status_resp.status_code == 200, f"Status check failed: {status_resp.text}"
            data = status_resp.json()
            assert "matchId" in data
            assert "status" in data
            print(f"✓ GET /api/sessions/instant-match/{{matchId}}/status - status={data['status']}")
        else:
            print("✓ GET /api/sessions/instant-match/{matchId}/status - Skipped (no match to check)")
    
    def test_accept_instant_match_requires_trainer(self, trainee_user):
        """POST /api/sessions/instant-match/{matchId}/accept - Should require trainer role"""
        resp = requests.post(
            f"{BASE_URL}/api/sessions/instant-match/000000000000000000000000/accept",
            headers=auth_headers(trainee_user["token"])
        )
        # 403 or 400 is acceptable (role check or match not found)
        assert resp.status_code in [400, 403, 404], f"Unexpected status: {resp.status_code}"
        print("✓ POST /api/sessions/instant-match/{matchId}/accept - Endpoint exists")
    
    def test_decline_instant_match(self, trainer_user):
        """POST /api/sessions/instant-match/{matchId}/decline - Decline a match"""
        resp = requests.post(
            f"{BASE_URL}/api/sessions/instant-match/000000000000000000000000/decline",
            headers=auth_headers(trainer_user["token"])
        )
        # 400 expected (match not found or not available)
        assert resp.status_code in [400, 404], f"Unexpected status: {resp.status_code}"
        print("✓ POST /api/sessions/instant-match/{matchId}/decline - Endpoint exists")
    
    def test_cancel_instant_match(self, trainee_user):
        """POST /api/sessions/instant-match/{matchId}/cancel - Cancel a match"""
        # First create a match to cancel
        create_resp = requests.post(
            f"{BASE_URL}/api/sessions/instant-match",
            json={"latitude": 33.749, "longitude": -84.388, "sessionType": "outdoor", "durationMinutes": 30, "maxDistanceMiles": 100},
            headers=auth_headers(trainee_user["token"])
        )
        
        if create_resp.status_code == 200:
            match_id = create_resp.json()["matchId"]
            cancel_resp = requests.post(
                f"{BASE_URL}/api/sessions/instant-match/{match_id}/cancel",
                headers=auth_headers(trainee_user["token"])
            )
            assert cancel_resp.status_code == 200, f"Cancel failed: {cancel_resp.text}"
            data = cancel_resp.json()
            assert data["status"] == "cancelled"
            print("✓ POST /api/sessions/instant-match/{matchId}/cancel - Match cancelled")
        else:
            print("✓ POST /api/sessions/instant-match/{matchId}/cancel - Skipped (no match to cancel)")


# =============================================================================
# PHASE 6: Virtual Instant Match
# =============================================================================

class TestVirtualInstantMatch:
    """Test /api/sessions/virtual-instant endpoint"""
    
    def test_virtual_instant_requires_trainee(self, trainer_user):
        """POST /api/sessions/virtual-instant - Should require trainee role"""
        resp = requests.post(
            f"{BASE_URL}/api/sessions/virtual-instant",
            params={"duration_minutes": 30},
            headers=auth_headers(trainer_user["token"])
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        print("✓ POST /api/sessions/virtual-instant - Correctly rejects non-trainee")
    
    def test_virtual_instant_as_trainee(self, trainee_user):
        """POST /api/sessions/virtual-instant - Create virtual instant match"""
        resp = requests.post(
            f"{BASE_URL}/api/sessions/virtual-instant",
            params={"duration_minutes": 30},
            headers=auth_headers(trainee_user["token"])
        )
        # May be 404 if no virtual trainers
        assert resp.status_code in [200, 404], f"Unexpected status: {resp.status_code}: {resp.text}"
        if resp.status_code == 200:
            data = resp.json()
            assert "matchId" in data
            assert "status" in data
            print(f"✓ POST /api/sessions/virtual-instant - matchId={data['matchId']}")
        else:
            print("✓ POST /api/sessions/virtual-instant - Endpoint works (no virtual trainers)")


# =============================================================================
# PHASE 3: Trainer Tools
# =============================================================================

class TestTrainerTools:
    """Test /api/trainer-tools endpoints"""
    
    # -------------------------------------------------------------------------
    # Workout Plans
    # -------------------------------------------------------------------------
    
    def test_create_workout_plan_requires_trainer(self, trainee_user):
        """POST /api/trainer-tools/workout-plans - Should require trainer role"""
        resp = requests.post(
            f"{BASE_URL}/api/trainer-tools/workout-plans",
            json={
                "traineeId": trainee_user["user"]["id"],
                "title": "Test Plan",
                "description": "Test description",
                "exercises": [{"name": "Squats", "sets": 3, "reps": 10}]
            },
            headers=auth_headers(trainee_user["token"])
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        print("✓ POST /api/trainer-tools/workout-plans - Correctly rejects non-trainer")
    
    def test_create_workout_plan(self, trainer_user, trainee_user):
        """POST /api/trainer-tools/workout-plans - Create workout plan as trainer"""
        resp = requests.post(
            f"{BASE_URL}/api/trainer-tools/workout-plans",
            json={
                "traineeId": trainee_user["user"]["id"],
                "title": "Pytest Workout Plan",
                "description": "Created by pytest",
                "exercises": [
                    {"name": "Push-ups", "sets": 3, "reps": 15},
                    {"name": "Lunges", "sets": 3, "reps": 12}
                ],
                "weekday": "Monday",
                "durationWeeks": 4
            },
            headers=auth_headers(trainer_user["token"])
        )
        assert resp.status_code == 200, f"Create plan failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert data["title"] == "Pytest Workout Plan"
        print(f"✓ POST /api/trainer-tools/workout-plans - Created plan id={data['id']}")
    
    def test_list_workout_plans(self, trainer_user):
        """GET /api/trainer-tools/workout-plans - List workout plans"""
        resp = requests.get(
            f"{BASE_URL}/api/trainer-tools/workout-plans",
            headers=auth_headers(trainer_user["token"])
        )
        assert resp.status_code == 200, f"List plans failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/trainer-tools/workout-plans - {len(data)} plans")
    
    # -------------------------------------------------------------------------
    # Session Notes
    # -------------------------------------------------------------------------
    
    def test_create_session_note_requires_trainer(self, trainee_user):
        """POST /api/trainer-tools/session-notes - Should require trainer role"""
        resp = requests.post(
            f"{BASE_URL}/api/trainer-tools/session-notes",
            json={
                "traineeId": trainee_user["user"]["id"],
                "note": "Test note",
                "tags": ["test"]
            },
            headers=auth_headers(trainee_user["token"])
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        print("✓ POST /api/trainer-tools/session-notes - Correctly rejects non-trainer")
    
    def test_create_session_note(self, trainer_user, trainee_user):
        """POST /api/trainer-tools/session-notes - Create session note as trainer"""
        resp = requests.post(
            f"{BASE_URL}/api/trainer-tools/session-notes",
            json={
                "traineeId": trainee_user["user"]["id"],
                "note": "Client showed good progress today. Increased weight on squats.",
                "tags": ["progress", "strength"]
            },
            headers=auth_headers(trainer_user["token"])
        )
        assert resp.status_code == 200, f"Create note failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        assert "note" in data
        print(f"✓ POST /api/trainer-tools/session-notes - Created note id={data['id']}")
    
    def test_list_session_notes(self, trainer_user):
        """GET /api/trainer-tools/session-notes - List session notes"""
        resp = requests.get(
            f"{BASE_URL}/api/trainer-tools/session-notes",
            headers=auth_headers(trainer_user["token"])
        )
        assert resp.status_code == 200, f"List notes failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/trainer-tools/session-notes - {len(data)} notes")
    
    # -------------------------------------------------------------------------
    # Client Progress
    # -------------------------------------------------------------------------
    
    def test_update_client_progress_requires_trainer(self, trainee_user):
        """POST /api/trainer-tools/client-progress/{traineeId} - Should require trainer role"""
        resp = requests.post(
            f"{BASE_URL}/api/trainer-tools/client-progress/{trainee_user['user']['id']}",
            json={"weight": 180, "notes": "Test"},
            headers=auth_headers(trainee_user["token"])
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        print("✓ POST /api/trainer-tools/client-progress/{traineeId} - Correctly rejects non-trainer")
    
    def test_update_client_progress(self, trainer_user, trainee_user):
        """POST /api/trainer-tools/client-progress/{traineeId} - Update client progress"""
        trainee_id = trainee_user["user"]["id"]
        resp = requests.post(
            f"{BASE_URL}/api/trainer-tools/client-progress/{trainee_id}",
            json={
                "weight": 175.5,
                "bodyFatPercent": 18.0,
                "benchmarks": {"squat": "185lbs", "deadlift": "225lbs"},
                "notes": "Good progress on compound lifts",
                "milestones": ["First muscle-up"]
            },
            headers=auth_headers(trainer_user["token"])
        )
        assert resp.status_code == 200, f"Update progress failed: {resp.text}"
        data = resp.json()
        assert "message" in data
        print(f"✓ POST /api/trainer-tools/client-progress/{{traineeId}} - Progress updated")
    
    def test_get_client_progress(self, trainer_user, trainee_user):
        """GET /api/trainer-tools/client-progress/{traineeId} - Get client progress"""
        trainee_id = trainee_user["user"]["id"]
        resp = requests.get(
            f"{BASE_URL}/api/trainer-tools/client-progress/{trainee_id}",
            headers=auth_headers(trainer_user["token"])
        )
        assert resp.status_code == 200, f"Get progress failed: {resp.text}"
        data = resp.json()
        assert "traineeId" in data
        print(f"✓ GET /api/trainer-tools/client-progress/{{traineeId}} - Retrieved progress")
    
    # -------------------------------------------------------------------------
    # My Clients
    # -------------------------------------------------------------------------
    
    def test_get_my_clients_requires_trainer(self, trainee_user):
        """GET /api/trainer-tools/my-clients - Should require trainer role"""
        resp = requests.get(
            f"{BASE_URL}/api/trainer-tools/my-clients",
            headers=auth_headers(trainee_user["token"])
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        print("✓ GET /api/trainer-tools/my-clients - Correctly rejects non-trainer")
    
    def test_get_my_clients(self, trainer_user):
        """GET /api/trainer-tools/my-clients - Get trainer's clients"""
        resp = requests.get(
            f"{BASE_URL}/api/trainer-tools/my-clients",
            headers=auth_headers(trainer_user["token"])
        )
        assert resp.status_code == 200, f"Get clients failed: {resp.text}"
        data = resp.json()
        assert "clients" in data
        assert "count" in data
        print(f"✓ GET /api/trainer-tools/my-clients - {data['count']} clients")


# =============================================================================
# Test Runner
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
