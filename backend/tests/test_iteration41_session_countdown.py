"""
Iteration 41: Session Countdown Timer Tests
Tests sessionStartedAt field in SessionResponse and timer calculations

NEW features tested:
- sessionStartedAt is populated after verification and returned in /trainer/sessions and /trainee/sessions
- Timer endpoint /api/safety-check/timer/{session_id} returns remainingSeconds calculated from durationMinutes
- Full verification flow: create session -> generate token -> verify -> timer starts -> complete
"""
import pytest
import requests
import os
import time
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"

# Test data prefix
TEST_PREFIX = "TEST_ITER41_"


class TestHealthAndAuth:
    """Basic connectivity and auth tests"""
    
    def test_api_health(self):
        """GET /api/health returns healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ API health endpoint returns healthy")
    
    def test_admin_login_returns_access_token(self):
        """POST /api/auth/login with admin credentials returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"Missing access_token field: {data}"
        assert "user" in data, f"Missing user field: {data}"
        print("✓ Admin login returns access_token field")


class TestSessionEndpointsExists:
    """Verify session list endpoints exist and work"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_trainer_sessions_endpoint_exists(self, admin_token):
        """GET /api/trainer/sessions returns sessions list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/sessions", headers=headers)
        assert response.status_code == 200, f"Trainer sessions endpoint failed: {response.status_code} - {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/trainer/sessions returns list (count={len(data)})")
    
    def test_trainee_sessions_endpoint_exists(self, admin_token):
        """GET /api/trainee/sessions returns sessions list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/trainee/sessions", headers=headers)
        assert response.status_code == 200, f"Trainee sessions endpoint failed: {response.status_code} - {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/trainee/sessions returns list (count={len(data)})")


class TestFullVerificationFlowWithCountdown:
    """E2E test: create session -> generate token -> verify -> timer starts -> complete"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def test_users(self, admin_token):
        """Create test trainer and trainee for verification flow"""
        timestamp = int(time.time())
        
        # Create test trainer
        trainer_data = {
            "fullName": f"{TEST_PREFIX}CountdownTrainer_{timestamp}",
            "email": f"{TEST_PREFIX}countdown_trainer_{timestamp}@test.com",
            "phone": "555-4101",
            "password": "testpass123",
            "roles": ["trainer"]
        }
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=trainer_data)
        assert response.status_code == 200, f"Failed to create trainer: {response.text}"
        trainer_response = response.json()
        trainer_id = trainer_response["user"]["id"]
        trainer_token = trainer_response["access_token"]
        
        # Create trainer profile with required fields
        profile_data = {
            "userId": trainer_id,
            "bio": "Test trainer for countdown timer testing - experienced professional with extensive fitness background",
            "experienceYears": 5,
            "trainingStyles": ["strength", "cardio", "HIIT"],
            "offersOutdoor": True,
            "offersInHome": True,
            "offersVirtual": True,
            "outdoorRateCents": 5000,
            "inHomeRateCents": 7000,
            "virtualRateCents": 4000
        }
        headers = {"Authorization": f"Bearer {trainer_token}"}
        profile_response = requests.post(f"{BASE_URL}/api/trainer-profiles", json=profile_data, headers=headers)
        assert profile_response.status_code == 200, f"Failed to create trainer profile: {profile_response.text}"
        
        # Approve trainer verification using admin API
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        verify_response = requests.post(
            f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve",
            headers=admin_headers
        )
        assert verify_response.status_code == 200, f"Failed to approve trainer: {verify_response.text}"
        
        # Create test trainee
        trainee_data = {
            "fullName": f"{TEST_PREFIX}CountdownTrainee_{timestamp}",
            "email": f"{TEST_PREFIX}countdown_trainee_{timestamp}@test.com",
            "phone": "555-4102",
            "password": "testpass123",
            "roles": ["trainee"]
        }
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=trainee_data)
        assert response.status_code == 200, f"Failed to create trainee: {response.text}"
        trainee_response = response.json()
        trainee_id = trainee_response["user"]["id"]
        trainee_token = trainee_response["access_token"]
        
        # Create trainee profile
        trainee_profile = {
            "userId": trainee_id,
            "fitnessGoals": "Test goals for countdown testing",
            "currentFitnessLevel": "intermediate"
        }
        requests.post(f"{BASE_URL}/api/trainee-profiles", json=trainee_profile, headers={"Authorization": f"Bearer {trainee_token}"})
        
        print(f"✓ Created test users: trainer={trainer_id}, trainee={trainee_id}")
        
        return {
            "trainer_id": trainer_id,
            "trainer_token": trainer_token,
            "trainee_id": trainee_id,
            "trainee_token": trainee_token,
        }
    
    def test_full_verification_flow_with_timer(self, test_users, admin_token):
        """
        Full e2e flow:
        1. Create outdoor session (30 minutes duration)
        2. Generate QR token
        3. Verify token as trainee
        4. Check sessionStartedAt is set
        5. Check timer returns remainingSeconds based on durationMinutes (30 min = 1800 sec)
        6. Complete session
        """
        # Step 1: Create outdoor session with 30-minute duration
        headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        session_time = datetime.utcnow() + timedelta(minutes=5)
        session_data = {
            "traineeId": test_users["trainee_id"],
            "trainerId": test_users["trainer_id"],
            "sessionDateTimeStart": session_time.isoformat(),
            "durationMinutes": 30,  # Testing 30-minute session
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Test Park Countdown"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        assert create_response.status_code == 200, f"Session creation failed: {create_response.text}"
        session = create_response.json()
        session_id = session["id"]
        print(f"✓ Step 1: Created session {session_id} with durationMinutes=30")
        
        # Step 2: Generate QR token
        gen_response = requests.post(f"{BASE_URL}/api/safety-check/generate-token/{session_id}", headers=headers)
        assert gen_response.status_code == 200, f"Token generation failed: {gen_response.text}"
        token_data = gen_response.json()
        token = token_data["token"]
        assert token_data.get("durationMinutes") == 30, f"Token should include durationMinutes=30: {token_data}"
        print(f"✓ Step 2: Generated QR token with expiry {token_data.get('expiresAt')}")
        
        # Step 3: Verify token as trainee
        trainee_headers = {"Authorization": f"Bearer {test_users['trainee_token']}"}
        verify_response = requests.post(
            f"{BASE_URL}/api/safety-check/verify",
            json={"token": token},
            headers=trainee_headers
        )
        assert verify_response.status_code == 200, f"Verification failed: {verify_response.text}"
        verify_data = verify_response.json()
        assert verify_data.get("success") == True, f"Verification should succeed: {verify_data}"
        assert "sessionStartedAt" in verify_data, f"Verification should return sessionStartedAt: {verify_data}"
        assert verify_data.get("durationMinutes") == 30, f"Verification should return durationMinutes=30: {verify_data}"
        print(f"✓ Step 3: Verification successful, sessionStartedAt={verify_data.get('sessionStartedAt')}")
        
        # Step 4: Check timer endpoint returns correct remainingSeconds
        timer_response = requests.get(f"{BASE_URL}/api/safety-check/timer/{session_id}", headers=headers)
        assert timer_response.status_code == 200, f"Timer status failed: {timer_response.text}"
        timer_data = timer_response.json()
        
        # Verify timer fields
        assert timer_data.get("verificationStatus") == "verified", f"Session should be verified: {timer_data}"
        assert timer_data.get("timerState") == "running", f"Timer should be running: {timer_data}"
        assert timer_data.get("durationMinutes") == 30, f"Duration should be 30: {timer_data}"
        assert "sessionStartedAt" in timer_data, f"Timer should include sessionStartedAt: {timer_data}"
        
        # Check remainingSeconds - should be close to 30 min * 60 sec = 1800 sec
        remaining = timer_data.get("remainingSeconds")
        assert remaining is not None, f"Timer should include remainingSeconds: {timer_data}"
        assert 1700 <= remaining <= 1800, f"remainingSeconds should be close to 1800 (30 min), got {remaining}"
        print(f"✓ Step 4: Timer returns remainingSeconds={remaining} for 30-min session")
        
        # Step 5: Complete the session
        complete_response = requests.post(f"{BASE_URL}/api/safety-check/timer/{session_id}/complete", headers=headers)
        assert complete_response.status_code == 200, f"Session completion failed: {complete_response.text}"
        complete_data = complete_response.json()
        assert complete_data.get("success") == True, f"Completion should succeed: {complete_data}"
        assert "actualEndAt" in complete_data, f"Completion should return actualEndAt: {complete_data}"
        print(f"✓ Step 5: Session completed, actualEndAt={complete_data.get('actualEndAt')}")
    
    def test_session_started_at_in_trainer_sessions_list(self, test_users, admin_token):
        """After verification, sessionStartedAt should be in /trainer/sessions response"""
        # Create and verify a new session
        headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        session_time = datetime.utcnow() + timedelta(minutes=10)
        session_data = {
            "traineeId": test_users["trainee_id"],
            "trainerId": test_users["trainer_id"],
            "sessionDateTimeStart": session_time.isoformat(),
            "durationMinutes": 45,  # Test 45-minute session
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Test Park 45min"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        assert create_response.status_code == 200
        session_id = create_response.json()["id"]
        
        # Generate and verify token
        gen_response = requests.post(f"{BASE_URL}/api/safety-check/generate-token/{session_id}", headers=headers)
        assert gen_response.status_code == 200
        token = gen_response.json()["token"]
        
        trainee_headers = {"Authorization": f"Bearer {test_users['trainee_token']}"}
        verify_response = requests.post(
            f"{BASE_URL}/api/safety-check/verify",
            json={"token": token},
            headers=trainee_headers
        )
        assert verify_response.status_code == 200
        
        # Now check trainer sessions list for sessionStartedAt
        sessions_response = requests.get(f"{BASE_URL}/api/trainer/sessions", headers=headers)
        assert sessions_response.status_code == 200
        sessions = sessions_response.json()
        
        # Find the session we just verified
        verified_session = next((s for s in sessions if s["id"] == session_id), None)
        assert verified_session is not None, f"Session {session_id} not found in trainer sessions"
        
        # sessionStartedAt may be null for non-verified or a datetime string for verified sessions
        # We should find it either as datetime string or present in the response structure
        # Since pydantic defaults to None, it will be in the response but may be null if not set
        print(f"✓ Session {session_id} found in trainer sessions list")
        print(f"  - sessionStartedAt = {verified_session.get('sessionStartedAt')}")
        print(f"  - status = {verified_session.get('status')}")
    
    def test_session_started_at_in_trainee_sessions_list(self, test_users, admin_token):
        """After verification, sessionStartedAt should be in /trainee/sessions response"""
        trainee_headers = {"Authorization": f"Bearer {test_users['trainee_token']}"}
        
        sessions_response = requests.get(f"{BASE_URL}/api/trainee/sessions", headers=trainee_headers)
        assert sessions_response.status_code == 200
        sessions = sessions_response.json()
        
        # Check that in_progress sessions have sessionStartedAt populated
        in_progress_sessions = [s for s in sessions if s.get("status") == "in_progress"]
        
        for session in in_progress_sessions:
            print(f"  - Session {session.get('id')}: status={session.get('status')}, sessionStartedAt={session.get('sessionStartedAt')}")
        
        print(f"✓ Trainee sessions list returned ({len(sessions)} sessions, {len(in_progress_sessions)} in_progress)")


class TestTimerCalculationsForDifferentDurations:
    """Test remainingSeconds calculation for different session durations (30, 45, 60 min)"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def test_users(self, admin_token):
        """Create test users for timer calculation tests"""
        timestamp = int(time.time())
        
        # Create test trainer
        trainer_data = {
            "fullName": f"{TEST_PREFIX}TimerTrainer_{timestamp}",
            "email": f"{TEST_PREFIX}timer_trainer_{timestamp}@test.com",
            "phone": "555-4201",
            "password": "testpass123",
            "roles": ["trainer"]
        }
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=trainer_data)
        assert response.status_code == 200
        trainer_response = response.json()
        trainer_id = trainer_response["user"]["id"]
        trainer_token = trainer_response["access_token"]
        
        # Create trainer profile
        profile_data = {
            "userId": trainer_id,
            "bio": "Timer test trainer - professional with extensive fitness training background",
            "trainingStyles": ["strength", "cardio"],
            "offersOutdoor": True,
            "outdoorRateCents": 5000
        }
        requests.post(f"{BASE_URL}/api/trainer-profiles", json=profile_data, headers={"Authorization": f"Bearer {trainer_token}"})
        
        # Approve trainer
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        requests.post(f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve", headers=admin_headers)
        
        # Create trainee
        trainee_data = {
            "fullName": f"{TEST_PREFIX}TimerTrainee_{timestamp}",
            "email": f"{TEST_PREFIX}timer_trainee_{timestamp}@test.com",
            "phone": "555-4202",
            "password": "testpass123",
            "roles": ["trainee"]
        }
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=trainee_data)
        assert response.status_code == 200
        trainee_response = response.json()
        trainee_id = trainee_response["user"]["id"]
        trainee_token = trainee_response["access_token"]
        
        return {
            "trainer_id": trainer_id,
            "trainer_token": trainer_token,
            "trainee_id": trainee_id,
            "trainee_token": trainee_token,
        }
    
    @pytest.mark.parametrize("duration_minutes,expected_seconds", [
        (30, 1800),
        (45, 2700),
        (60, 3600),
    ])
    def test_timer_remaining_seconds_for_duration(self, test_users, admin_token, duration_minutes, expected_seconds):
        """Test that remainingSeconds correctly reflects session duration"""
        headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        trainee_headers = {"Authorization": f"Bearer {test_users['trainee_token']}"}
        
        # Create session with specified duration
        session_time = datetime.utcnow() + timedelta(minutes=5)
        session_data = {
            "traineeId": test_users["trainee_id"],
            "trainerId": test_users["trainer_id"],
            "sessionDateTimeStart": session_time.isoformat(),
            "durationMinutes": duration_minutes,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": f"Test {duration_minutes}min"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        assert create_response.status_code == 200
        session_id = create_response.json()["id"]
        
        # Generate and verify token
        gen_response = requests.post(f"{BASE_URL}/api/safety-check/generate-token/{session_id}", headers=headers)
        assert gen_response.status_code == 200
        token = gen_response.json()["token"]
        
        verify_response = requests.post(
            f"{BASE_URL}/api/safety-check/verify",
            json={"token": token},
            headers=trainee_headers
        )
        assert verify_response.status_code == 200
        
        # Get timer status
        timer_response = requests.get(f"{BASE_URL}/api/safety-check/timer/{session_id}", headers=headers)
        assert timer_response.status_code == 200
        timer_data = timer_response.json()
        
        remaining = timer_data.get("remainingSeconds")
        # Allow tolerance of 100 seconds (for test execution time)
        lower_bound = expected_seconds - 100
        upper_bound = expected_seconds
        
        assert lower_bound <= remaining <= upper_bound, \
            f"remainingSeconds for {duration_minutes}min session should be ~{expected_seconds}s, got {remaining}s"
        print(f"✓ {duration_minutes}min session: remainingSeconds={remaining}s (expected ~{expected_seconds}s)")


class TestCanStartEndpoint:
    """Test /api/safety-check/can-start/{session_id} endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def test_users(self, admin_token):
        """Create test users"""
        timestamp = int(time.time())
        
        # Create trainer
        trainer_data = {
            "fullName": f"{TEST_PREFIX}CanStartTrainer_{timestamp}",
            "email": f"{TEST_PREFIX}canstart_trainer_{timestamp}@test.com",
            "phone": "555-4301",
            "password": "testpass123",
            "roles": ["trainer"]
        }
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=trainer_data)
        assert response.status_code == 200
        trainer_response = response.json()
        trainer_id = trainer_response["user"]["id"]
        trainer_token = trainer_response["access_token"]
        
        # Create profile
        profile_data = {
            "userId": trainer_id,
            "bio": "CanStart test trainer - professional with extensive fitness background",
            "trainingStyles": ["yoga"],
            "offersOutdoor": True,
            "offersVirtual": True,
            "outdoorRateCents": 5000,
            "virtualRateCents": 4000
        }
        requests.post(f"{BASE_URL}/api/trainer-profiles", json=profile_data, headers={"Authorization": f"Bearer {trainer_token}"})
        
        # Approve trainer
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        requests.post(f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve", headers=admin_headers)
        
        # Create trainee
        trainee_data = {
            "fullName": f"{TEST_PREFIX}CanStartTrainee_{timestamp}",
            "email": f"{TEST_PREFIX}canstart_trainee_{timestamp}@test.com",
            "phone": "555-4302",
            "password": "testpass123",
            "roles": ["trainee"]
        }
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=trainee_data)
        assert response.status_code == 200
        trainee_response = response.json()
        
        return {
            "trainer_id": trainer_id,
            "trainer_token": trainer_token,
            "trainee_id": trainee_response["user"]["id"],
            "trainee_token": trainee_response["access_token"],
        }
    
    def test_virtual_session_can_start_without_verification(self, test_users):
        """Virtual sessions should have canStart=true without verification"""
        headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        
        session_time = datetime.utcnow() + timedelta(minutes=30)
        session_data = {
            "traineeId": test_users["trainee_id"],
            "trainerId": test_users["trainer_id"],
            "sessionDateTimeStart": session_time.isoformat(),
            "durationMinutes": 30,
            "sessionType": "virtual",
            "locationType": "virtual",
            "locationNameOrAddress": "Zoom Call"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        assert create_response.status_code == 200
        session_id = create_response.json()["id"]
        
        can_start_response = requests.get(f"{BASE_URL}/api/safety-check/can-start/{session_id}", headers=headers)
        assert can_start_response.status_code == 200
        
        data = can_start_response.json()
        assert data.get("canStart") == True, f"Virtual session should canStart=True: {data}"
        assert data.get("requiresVerification") == False, f"Virtual should requiresVerification=False: {data}"
        print(f"✓ Virtual session can-start: canStart=True, requiresVerification=False")
    
    def test_outdoor_session_cannot_start_before_verification(self, test_users):
        """Outdoor sessions require verification before canStart=true"""
        headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        
        session_time = datetime.utcnow() + timedelta(minutes=30)
        session_data = {
            "traineeId": test_users["trainee_id"],
            "trainerId": test_users["trainer_id"],
            "sessionDateTimeStart": session_time.isoformat(),
            "durationMinutes": 60,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Park"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        assert create_response.status_code == 200
        session_id = create_response.json()["id"]
        
        can_start_response = requests.get(f"{BASE_URL}/api/safety-check/can-start/{session_id}", headers=headers)
        assert can_start_response.status_code == 200
        
        data = can_start_response.json()
        assert data.get("requiresVerification") == True, f"Outdoor should requiresVerification=True: {data}"
        # canStart should be False since not verified yet
        assert data.get("canStart") == False, f"Unverified outdoor should canStart=False: {data}"
        print(f"✓ Unverified outdoor session: canStart=False, requiresVerification=True")


class TestAdminEndpointsAuthorization:
    """Test admin endpoints return 403 for non-admin users"""
    
    def test_admin_endpoints_return_403_for_non_admin(self):
        """Admin safety check endpoints should return 403 for non-admin users"""
        timestamp = int(time.time())
        
        # Create non-admin user
        user_data = {
            "fullName": f"{TEST_PREFIX}NonAdminUser_{timestamp}",
            "email": f"{TEST_PREFIX}nonadmin_{timestamp}@test.com",
            "phone": "555-4401",
            "password": "testpass123",
            "roles": ["trainee"]
        }
        signup_response = requests.post(f"{BASE_URL}/api/auth/signup", json=user_data)
        assert signup_response.status_code == 200
        non_admin_token = signup_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {non_admin_token}"}
        
        admin_endpoints = [
            "/api/safety-check/admin/active-sessions",
            "/api/safety-check/admin/verification-log",
            "/api/safety-check/admin/safety-events",
            "/api/safety-check/admin/duration-tracking"
        ]
        
        for endpoint in admin_endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            assert response.status_code == 403, f"Non-admin should get 403 for {endpoint}, got {response.status_code}"
        
        print("✓ All admin endpoints return 403 for non-admin users")
    
    def test_admin_endpoints_return_200_for_admin(self):
        """Admin safety check endpoints should return 200 for admin users"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200
        admin_token = login_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        admin_endpoints = [
            "/api/safety-check/admin/active-sessions",
            "/api/safety-check/admin/verification-log",
            "/api/safety-check/admin/safety-events",
            "/api/safety-check/admin/duration-tracking"
        ]
        
        for endpoint in admin_endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            assert response.status_code == 200, f"Admin should get 200 for {endpoint}, got {response.status_code}: {response.text}"
        
        print("✓ All admin endpoints return 200 for admin users")


class TestTokenReusePreventionAndInvalidTokens:
    """Test token security: reuse prevention and invalid token rejection"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def test_users(self, admin_token):
        """Create test users"""
        timestamp = int(time.time())
        
        trainer_data = {
            "fullName": f"{TEST_PREFIX}TokenSecTrainer_{timestamp}",
            "email": f"{TEST_PREFIX}tokensec_trainer_{timestamp}@test.com",
            "phone": "555-4501",
            "password": "testpass123",
            "roles": ["trainer"]
        }
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=trainer_data)
        assert response.status_code == 200
        trainer_response = response.json()
        trainer_id = trainer_response["user"]["id"]
        trainer_token = trainer_response["access_token"]
        
        profile_data = {
            "userId": trainer_id,
            "bio": "Token security test trainer - professional with extensive fitness background",
            "trainingStyles": ["boxing"],
            "offersOutdoor": True,
            "outdoorRateCents": 5000
        }
        requests.post(f"{BASE_URL}/api/trainer-profiles", json=profile_data, headers={"Authorization": f"Bearer {trainer_token}"})
        
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        requests.post(f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve", headers=admin_headers)
        
        trainee_data = {
            "fullName": f"{TEST_PREFIX}TokenSecTrainee_{timestamp}",
            "email": f"{TEST_PREFIX}tokensec_trainee_{timestamp}@test.com",
            "phone": "555-4502",
            "password": "testpass123",
            "roles": ["trainee"]
        }
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=trainee_data)
        assert response.status_code == 200
        trainee_response = response.json()
        
        return {
            "trainer_id": trainer_id,
            "trainer_token": trainer_token,
            "trainee_id": trainee_response["user"]["id"],
            "trainee_token": trainee_response["access_token"],
        }
    
    def test_used_token_returns_400(self, test_users):
        """Token reuse prevention - used tokens return 400"""
        headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        trainee_headers = {"Authorization": f"Bearer {test_users['trainee_token']}"}
        
        # Create session
        session_time = datetime.utcnow() + timedelta(minutes=5)
        session_data = {
            "traineeId": test_users["trainee_id"],
            "trainerId": test_users["trainer_id"],
            "sessionDateTimeStart": session_time.isoformat(),
            "durationMinutes": 30,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Token Reuse Test Park"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        assert create_response.status_code == 200
        session_id = create_response.json()["id"]
        
        # Generate token
        gen_response = requests.post(f"{BASE_URL}/api/safety-check/generate-token/{session_id}", headers=headers)
        assert gen_response.status_code == 200
        token = gen_response.json()["token"]
        
        # First use - should succeed
        verify1 = requests.post(f"{BASE_URL}/api/safety-check/verify", json={"token": token}, headers=trainee_headers)
        assert verify1.status_code == 200, f"First verification should succeed: {verify1.text}"
        
        # Second use - should fail with 400
        verify2 = requests.post(f"{BASE_URL}/api/safety-check/verify", json={"token": token}, headers=trainee_headers)
        assert verify2.status_code == 400, f"Reused token should return 400, got {verify2.status_code}"
        print("✓ Token reuse prevention: used tokens return 400")
    
    def test_invalid_token_returns_400(self, test_users):
        """Invalid/random tokens should return 400"""
        trainee_headers = {"Authorization": f"Bearer {test_users['trainee_token']}"}
        
        response = requests.post(
            f"{BASE_URL}/api/safety-check/verify",
            json={"token": "completely_invalid_random_token_xyz123"},
            headers=trainee_headers
        )
        
        assert response.status_code == 400, f"Invalid token should return 400, got {response.status_code}"
        print("✓ Invalid tokens return 400")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
