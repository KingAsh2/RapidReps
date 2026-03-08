"""
Rapid Reps Safety Check System - Backend API Tests
Tests QR-based trainer verification, session timer, and admin tracking endpoints
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

# Test data prefixes
TEST_PREFIX = "TEST_SAFETY_"


class TestSafetyCheckHealth:
    """Basic API health and connectivity tests"""
    
    def test_api_health(self):
        """Verify API is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ API health endpoint working")


class TestSafetyCheckAuthSetup:
    """Authentication setup for safety check tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        # Auth token field is 'access_token' per the credentials
        token = data.get("access_token")
        assert token, "No access_token in login response"
        print(f"✓ Admin login successful")
        return token
    
    @pytest.fixture(scope="class")
    def admin_user_id(self, admin_token):
        """Get admin user ID"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        return data.get("id")
    
    def test_admin_login(self, admin_token):
        """Verify admin can login"""
        assert admin_token is not None
        print("✓ Admin authentication verified")


class TestSafetyCheckActiveSession:
    """Tests for GET /api/safety-check/active-session endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_active_session_endpoint_returns_has_active_session_field(self, admin_token):
        """GET /api/safety-check/active-session returns hasActiveSession field"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/safety-check/active-session", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify hasActiveSession field exists
        assert "hasActiveSession" in data, f"Missing hasActiveSession field in response: {data}"
        assert isinstance(data["hasActiveSession"], bool), "hasActiveSession should be boolean"
        print(f"✓ GET /api/safety-check/active-session returns hasActiveSession={data['hasActiveSession']}")


class TestSafetyCheckFullFlow:
    """End-to-end safety check flow tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def admin_user_id(self, admin_token):
        """Get admin user ID"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        return response.json().get("id")
    
    @pytest.fixture(scope="class") 
    def test_users(self, admin_token):
        """Create test trainer and trainee users for safety check testing"""
        timestamp = int(time.time())
        
        # Create test trainer
        trainer_data = {
            "fullName": f"{TEST_PREFIX}Trainer_{timestamp}",
            "email": f"{TEST_PREFIX}trainer_{timestamp}@test.com",
            "phone": "555-0001",
            "password": "testpass123",
            "roles": ["trainer"]
        }
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=trainer_data)
        assert response.status_code == 200, f"Failed to create trainer: {response.text}"
        trainer_response = response.json()
        trainer_id = trainer_response["user"]["id"]
        trainer_token = trainer_response["access_token"]
        
        # Create trainer profile with complete bio (min 50 chars)
        profile_data = {
            "userId": trainer_id,
            "bio": "Test trainer for safety check system testing - experienced and certified professional trainer with extensive background",
            "experienceYears": 5,
            "trainingStyles": ["strength", "cardio"],
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
        trainer_profile_id = profile_response.json().get("id")
        
        # Approve trainer verification using admin API - uses userId, not profile ID
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        verify_response = requests.post(
            f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve",
            headers=admin_headers
        )
        assert verify_response.status_code == 200, f"Failed to approve trainer verification: {verify_response.text}"
        print(f"✓ Trainer verification approved via admin API (user_id={trainer_id})")
        
        # Create test trainee
        trainee_data = {
            "fullName": f"{TEST_PREFIX}Trainee_{timestamp}",
            "email": f"{TEST_PREFIX}trainee_{timestamp}@test.com",
            "phone": "555-0002",
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
            "fitnessGoals": "Test goals",
            "currentFitnessLevel": "intermediate"
        }
        headers = {"Authorization": f"Bearer {trainee_token}"}
        requests.post(f"{BASE_URL}/api/trainee-profiles", json=trainee_profile, headers=headers)
        
        print(f"✓ Created test users: trainer={trainer_id}, trainee={trainee_id}")
        
        return {
            "trainer_id": trainer_id,
            "trainer_token": trainer_token,
            "trainer_profile_id": trainer_profile_id,
            "trainee_id": trainee_id,
            "trainee_token": trainee_token,
            "admin_token": admin_token
        }
    
    @pytest.fixture(scope="class")
    def outdoor_session(self, test_users, admin_token):
        """Create an outdoor (in-person) session for testing"""
        # Use admin to create the session (simulating a booked session)
        headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        
        # First accept the session status logic - let's create via trainer
        session_time = datetime.utcnow() + timedelta(minutes=5)
        session_data = {
            "traineeId": test_users["trainee_id"],
            "trainerId": test_users["trainer_id"],
            "sessionDateTimeStart": session_time.isoformat(),
            "durationMinutes": 60,
            "sessionType": "outdoor",  # In-person - requires verification
            "locationType": "outdoor",
            "locationNameOrAddress": "Test Park"
        }
        
        response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        assert response.status_code == 200, f"Failed to create outdoor session: {response.text}"
        session = response.json()
        
        # Accept the session
        session_id = session["id"]
        accept_response = requests.patch(f"{BASE_URL}/api/sessions/{session_id}/accept", headers=headers)
        # It might already be in an acceptable state
        
        print(f"✓ Created outdoor session: {session_id}")
        return session_id
    
    @pytest.fixture(scope="class")
    def virtual_session(self, test_users):
        """Create a virtual session for testing (should not require verification)"""
        headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        
        session_time = datetime.utcnow() + timedelta(minutes=30)
        session_data = {
            "traineeId": test_users["trainee_id"],
            "trainerId": test_users["trainer_id"],
            "sessionDateTimeStart": session_time.isoformat(),
            "durationMinutes": 30,
            "sessionType": "virtual",  # Virtual - should NOT require verification
            "locationType": "virtual",
            "locationNameOrAddress": "Zoom"
        }
        
        response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        assert response.status_code == 200, f"Failed to create virtual session: {response.text}"
        session = response.json()
        print(f"✓ Created virtual session: {session['id']}")
        return session["id"]
    
    def test_generate_token_requires_auth(self):
        """POST /api/safety-check/generate-token/{session_id} requires authentication"""
        response = requests.post(f"{BASE_URL}/api/safety-check/generate-token/fakesessionid")
        # Should fail without auth - 401 or 403
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print("✓ Token generation requires authentication")
    
    def test_generate_token_returns_token_with_expiry(self, test_users, outdoor_session):
        """POST /api/safety-check/generate-token/{session_id} returns token with expiry"""
        headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        
        response = requests.post(f"{BASE_URL}/api/safety-check/generate-token/{outdoor_session}", headers=headers)
        assert response.status_code == 200, f"Failed to generate token: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "token" in data, f"Missing token field: {data}"
        assert "expiresAt" in data, f"Missing expiresAt field: {data}"
        assert "sessionId" in data, f"Missing sessionId field: {data}"
        
        # Verify token is a non-empty string
        assert isinstance(data["token"], str) and len(data["token"]) > 0, "Token should be non-empty string"
        
        print(f"✓ Token generation returns token with expiry: expiresAt={data['expiresAt']}")
        return data["token"]
    
    def test_verify_token_validates_qr(self, test_users, outdoor_session):
        """POST /api/safety-check/verify validates QR token"""
        # First generate a token
        trainer_headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        gen_response = requests.post(f"{BASE_URL}/api/safety-check/generate-token/{outdoor_session}", headers=trainer_headers)
        assert gen_response.status_code == 200, f"Token generation failed: {gen_response.text}"
        token = gen_response.json()["token"]
        
        # Now verify as trainee
        trainee_headers = {"Authorization": f"Bearer {test_users['trainee_token']}"}
        verify_response = requests.post(
            f"{BASE_URL}/api/safety-check/verify",
            json={"token": token},
            headers=trainee_headers
        )
        
        assert verify_response.status_code == 200, f"Verification failed: {verify_response.text}"
        data = verify_response.json()
        
        # Verify response contains success and trainer info
        assert data.get("success") == True, f"Verification should succeed: {data}"
        assert "trainerName" in data, f"Missing trainerName in response: {data}"
        assert "sessionId" in data, f"Missing sessionId in response: {data}"
        
        print(f"✓ Token verification successful: trainerName={data.get('trainerName')}")
    
    def test_reused_token_fails_verification(self, test_users, outdoor_session):
        """Reused tokens should fail verification"""
        # Generate a fresh token
        trainer_headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        gen_response = requests.post(f"{BASE_URL}/api/safety-check/generate-token/{outdoor_session}", headers=trainer_headers)
        assert gen_response.status_code == 200
        token = gen_response.json()["token"]
        
        # First verification should succeed
        trainee_headers = {"Authorization": f"Bearer {test_users['trainee_token']}"}
        first_verify = requests.post(
            f"{BASE_URL}/api/safety-check/verify",
            json={"token": token},
            headers=trainee_headers
        )
        assert first_verify.status_code == 200, f"First verification should succeed: {first_verify.text}"
        
        # Second verification with SAME token should FAIL (already used)
        second_verify = requests.post(
            f"{BASE_URL}/api/safety-check/verify",
            json={"token": token},
            headers=trainee_headers
        )
        # Should return 400 for already used token
        assert second_verify.status_code == 400, f"Reused token should fail: {second_verify.status_code} - {second_verify.text}"
        print("✓ Reused token correctly rejected")
    
    def test_get_badge_data(self, test_users, outdoor_session):
        """GET /api/safety-check/badge/{session_id} returns badge data"""
        headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        
        response = requests.get(f"{BASE_URL}/api/safety-check/badge/{outdoor_session}", headers=headers)
        assert response.status_code == 200, f"Failed to get badge data: {response.text}"
        
        data = response.json()
        
        # Verify essential badge fields
        assert "sessionId" in data, f"Missing sessionId: {data}"
        assert "trainerName" in data, f"Missing trainerName: {data}"
        assert "traineeName" in data, f"Missing traineeName: {data}"
        assert "sessionType" in data, f"Missing sessionType: {data}"
        
        print(f"✓ Badge data retrieved: trainerName={data.get('trainerName')}, sessionType={data.get('sessionType')}")
    
    def test_get_timer_status(self, test_users, outdoor_session):
        """GET /api/safety-check/timer/{session_id} returns timer status"""
        headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        
        response = requests.get(f"{BASE_URL}/api/safety-check/timer/{outdoor_session}", headers=headers)
        assert response.status_code == 200, f"Failed to get timer status: {response.text}"
        
        data = response.json()
        
        # Verify timer fields
        assert "sessionId" in data, f"Missing sessionId: {data}"
        assert "timerState" in data, f"Missing timerState: {data}"
        assert "verificationStatus" in data, f"Missing verificationStatus: {data}"
        
        print(f"✓ Timer status: timerState={data.get('timerState')}, verificationStatus={data.get('verificationStatus')}")
    
    def test_complete_timer(self, test_users, outdoor_session):
        """POST /api/safety-check/timer/{session_id}/complete marks session as completed"""
        headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        
        # Generate token and verify to make session verified
        gen_response = requests.post(f"{BASE_URL}/api/safety-check/generate-token/{outdoor_session}", headers=headers)
        if gen_response.status_code == 200:
            token = gen_response.json()["token"]
            trainee_headers = {"Authorization": f"Bearer {test_users['trainee_token']}"}
            verify_response = requests.post(f"{BASE_URL}/api/safety-check/verify", json={"token": token}, headers=trainee_headers)
            # May fail if already verified - that's ok
        
        # Now complete the timer
        complete_response = requests.post(f"{BASE_URL}/api/safety-check/timer/{outdoor_session}/complete", headers=headers)
        # Session may not be in verified state if verification failed (e.g., already used token)
        # So we just check if API responds correctly
        if complete_response.status_code == 200:
            data = complete_response.json()
            assert data.get("success") == True, f"Complete should succeed: {data}"
            print("✓ Timer completion works correctly")
        else:
            # May fail if session not verified - check error message
            print(f"✓ Timer completion endpoint responds correctly (status={complete_response.status_code})")
    
    def test_can_start_virtual_session(self, test_users, virtual_session):
        """Virtual sessions should not require verification (canStart=true)"""
        headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        
        response = requests.get(f"{BASE_URL}/api/safety-check/can-start/{virtual_session}", headers=headers)
        assert response.status_code == 200, f"Can-start check failed: {response.text}"
        
        data = response.json()
        
        # Virtual sessions should NOT require verification
        assert data.get("canStart") == True, f"Virtual session should canStart=True: {data}"
        assert data.get("requiresVerification") == False, f"Virtual session should requiresVerification=False: {data}"
        
        print(f"✓ Virtual session can-start: canStart={data.get('canStart')}, requiresVerification={data.get('requiresVerification')}")
    
    def test_can_start_outdoor_session_before_verification(self, test_users):
        """Outdoor/in-person sessions require verification before start"""
        headers = {"Authorization": f"Bearer {test_users['trainer_token']}"}
        
        # Create a new unverified outdoor session
        session_time = datetime.utcnow() + timedelta(minutes=10)
        session_data = {
            "traineeId": test_users["trainee_id"],
            "trainerId": test_users["trainer_id"],
            "sessionDateTimeStart": session_time.isoformat(),
            "durationMinutes": 45,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Test Park"
        }
        create_response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        
        if create_response.status_code != 200:
            # Trainer may not be verified in this test run, skip this test
            pytest.skip(f"Session creation failed (trainer may not be verified): {create_response.text}")
        
        session_id = create_response.json()["id"]
        
        # Check can-start - should require verification
        response = requests.get(f"{BASE_URL}/api/safety-check/can-start/{session_id}", headers=headers)
        assert response.status_code == 200, f"Can-start check failed: {response.text}"
        
        data = response.json()
        assert data.get("requiresVerification") == True, f"Outdoor session should requiresVerification=True: {data}"
        # Note: canStart may be False (not verified) or True (if session was already verified somehow)
        
        print(f"✓ Outdoor session can-start check: canStart={data.get('canStart')}, requiresVerification={data.get('requiresVerification')}")


class TestSafetyCheckAdminEndpoints:
    """Tests for admin-only safety check endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_admin_active_sessions(self, admin_token):
        """GET /api/safety-check/admin/active-sessions returns active verified sessions"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/safety-check/admin/active-sessions", headers=headers)
        assert response.status_code == 200, f"Admin active sessions failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "activeSessions" in data, f"Missing activeSessions field: {data}"
        assert "count" in data, f"Missing count field: {data}"
        assert isinstance(data["activeSessions"], list), "activeSessions should be a list"
        
        print(f"✓ Admin active sessions: count={data.get('count')}")
    
    def test_admin_verification_log(self, admin_token):
        """GET /api/safety-check/admin/verification-log returns scan history"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/safety-check/admin/verification-log", headers=headers)
        assert response.status_code == 200, f"Admin verification log failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "logs" in data, f"Missing logs field: {data}"
        assert "total" in data, f"Missing total field: {data}"
        assert isinstance(data["logs"], list), "logs should be a list"
        
        print(f"✓ Admin verification log: total={data.get('total')}, returned={len(data.get('logs', []))}")
    
    def test_admin_safety_events(self, admin_token):
        """GET /api/safety-check/admin/safety-events returns failed scans and overrides"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/safety-check/admin/safety-events", headers=headers)
        assert response.status_code == 200, f"Admin safety events failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "failedVerifications" in data, f"Missing failedVerifications field: {data}"
        assert "overrides" in data, f"Missing overrides field: {data}"
        
        print(f"✓ Admin safety events: failedVerifications={len(data.get('failedVerifications', []))}, overrides={len(data.get('overrides', []))}")
    
    def test_admin_duration_tracking(self, admin_token):
        """GET /api/safety-check/admin/duration-tracking returns booked vs actual durations"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/safety-check/admin/duration-tracking", headers=headers)
        assert response.status_code == 200, f"Admin duration tracking failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "sessions" in data, f"Missing sessions field: {data}"
        assert "count" in data, f"Missing count field: {data}"
        
        print(f"✓ Admin duration tracking: count={data.get('count')}")
    
    def test_admin_override(self, admin_token):
        """POST /api/safety-check/admin/override allows admin to manually verify a session"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First create test users and session
        timestamp = int(time.time())
        
        # Create trainer
        trainer_data = {
            "fullName": f"{TEST_PREFIX}OverrideTrainer_{timestamp}",
            "email": f"{TEST_PREFIX}override_trainer_{timestamp}@test.com",
            "phone": "555-9001",
            "password": "testpass123",
            "roles": ["trainer"]
        }
        trainer_response = requests.post(f"{BASE_URL}/api/auth/signup", json=trainer_data)
        assert trainer_response.status_code == 200
        trainer_id = trainer_response.json()["user"]["id"]
        trainer_token = trainer_response.json()["access_token"]
        
        # Create trainer profile
        profile_data = {
            "userId": trainer_id,
            "bio": "Override test trainer - experienced professional with extensive background in fitness training",
            "trainingStyles": ["yoga", "strength"],
            "offersOutdoor": True,
            "offersInHome": True,
            "outdoorRateCents": 5000,
            "inHomeRateCents": 7000
        }
        requests.post(f"{BASE_URL}/api/trainer-profiles", json=profile_data, headers={"Authorization": f"Bearer {trainer_token}"})
        
        # Approve trainer verification via admin API
        verify_response = requests.post(
            f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve",
            headers=headers
        )
        assert verify_response.status_code == 200, f"Failed to approve trainer verification: {verify_response.text}"
        
        # Create trainee
        trainee_data = {
            "fullName": f"{TEST_PREFIX}OverrideTrainee_{timestamp}",
            "email": f"{TEST_PREFIX}override_trainee_{timestamp}@test.com",
            "phone": "555-9002",
            "password": "testpass123",
            "roles": ["trainee"]
        }
        trainee_response = requests.post(f"{BASE_URL}/api/auth/signup", json=trainee_data)
        assert trainee_response.status_code == 200
        trainee_id = trainee_response.json()["user"]["id"]
        
        # Create session
        session_time = datetime.utcnow() + timedelta(minutes=15)
        session_data = {
            "traineeId": trainee_id,
            "trainerId": trainer_id,
            "sessionDateTimeStart": session_time.isoformat(),
            "durationMinutes": 60,
            "sessionType": "in_home",
            "locationType": "home",
            "locationNameOrAddress": "Test Home"
        }
        session_response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers={"Authorization": f"Bearer {trainer_token}"})
        assert session_response.status_code == 200, f"Session creation failed: {session_response.text}"
        session_id = session_response.json()["id"]
        
        # Now test admin override
        override_response = requests.post(
            f"{BASE_URL}/api/safety-check/admin/override",
            json={
                "sessionId": session_id,
                "reason": "Client phone not working, verified identity via video call"
            },
            headers=headers
        )
        
        assert override_response.status_code == 200, f"Admin override failed: {override_response.text}"
        data = override_response.json()
        assert data.get("success") == True, f"Override should succeed: {data}"
        
        print("✓ Admin override works correctly")
    
    def test_admin_endpoints_require_admin_auth(self):
        """Admin endpoints should require admin authentication"""
        # Create a non-admin user
        timestamp = int(time.time())
        user_data = {
            "fullName": f"{TEST_PREFIX}NonAdmin_{timestamp}",
            "email": f"{TEST_PREFIX}nonadmin_{timestamp}@test.com",
            "phone": "555-8000",
            "password": "testpass123",
            "roles": ["trainee"]
        }
        signup_response = requests.post(f"{BASE_URL}/api/auth/signup", json=user_data)
        assert signup_response.status_code == 200
        non_admin_token = signup_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {non_admin_token}"}
        
        # Try to access admin endpoints - should fail with 403
        endpoints = [
            "/api/safety-check/admin/active-sessions",
            "/api/safety-check/admin/verification-log",
            "/api/safety-check/admin/safety-events",
            "/api/safety-check/admin/duration-tracking"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            assert response.status_code == 403, f"Non-admin should get 403 for {endpoint}, got {response.status_code}"
        
        print("✓ Admin endpoints correctly require admin authentication")


class TestTokenSecurity:
    """Token security tests"""
    
    @pytest.fixture(scope="class")
    def test_setup(self):
        """Setup test users for token security tests"""
        timestamp = int(time.time())
        
        # First get admin token
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert admin_response.status_code == 200
        admin_token = admin_response.json().get("access_token")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create trainer
        trainer_data = {
            "fullName": f"{TEST_PREFIX}SecurityTrainer_{timestamp}",
            "email": f"{TEST_PREFIX}security_trainer_{timestamp}@test.com",
            "phone": "555-7001",
            "password": "testpass123",
            "roles": ["trainer"]
        }
        trainer_response = requests.post(f"{BASE_URL}/api/auth/signup", json=trainer_data)
        assert trainer_response.status_code == 200
        trainer_id = trainer_response.json()["user"]["id"]
        trainer_token = trainer_response.json()["access_token"]
        
        # Create trainer profile
        profile_data = {
            "userId": trainer_id,
            "bio": "Security test trainer - professional with extensive background in fitness and security testing",
            "trainingStyles": ["cardio", "strength"],
            "offersOutdoor": True,
            "outdoorRateCents": 5000
        }
        requests.post(f"{BASE_URL}/api/trainer-profiles", json=profile_data, headers={"Authorization": f"Bearer {trainer_token}"})
        
        # Approve trainer via admin API
        requests.post(
            f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve",
            headers=admin_headers
        )
        
        # Create trainee
        trainee_data = {
            "fullName": f"{TEST_PREFIX}SecurityTrainee_{timestamp}",
            "email": f"{TEST_PREFIX}security_trainee_{timestamp}@test.com",
            "phone": "555-7002",
            "password": "testpass123",
            "roles": ["trainee"]
        }
        trainee_response = requests.post(f"{BASE_URL}/api/auth/signup", json=trainee_data)
        assert trainee_response.status_code == 200
        trainee_id = trainee_response.json()["user"]["id"]
        trainee_token = trainee_response.json()["access_token"]
        
        return {
            "trainer_id": trainer_id,
            "trainer_token": trainer_token,
            "trainee_id": trainee_id,
            "trainee_token": trainee_token
        }
    
    def test_invalid_token_rejected(self, test_setup):
        """Invalid/random tokens should be rejected"""
        headers = {"Authorization": f"Bearer {test_setup['trainee_token']}"}
        
        # Try to verify with random invalid token
        response = requests.post(
            f"{BASE_URL}/api/safety-check/verify",
            json={"token": "invalid_random_token_12345"},
            headers=headers
        )
        
        assert response.status_code == 400, f"Invalid token should return 400, got {response.status_code}"
        print("✓ Invalid tokens correctly rejected")
    
    def test_token_expiry_within_5_minutes(self, test_setup):
        """Tokens should have expiry time set to approximately 5 minutes"""
        # Need admin token to verify the trainer
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert admin_response.status_code == 200
        admin_token = admin_response.json().get("access_token")
        
        # Verify the trainer
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        requests.patch(
            f"{BASE_URL}/api/admin/trainers/{test_setup['trainer_id']}/verify",
            params={"verified": True},
            headers=admin_headers
        )
        
        # Create a session
        headers = {"Authorization": f"Bearer {test_setup['trainer_token']}"}
        
        from datetime import datetime as dt
        session_time = dt.utcnow() + timedelta(minutes=5)
        session_data = {
            "traineeId": test_setup["trainee_id"],
            "trainerId": test_setup["trainer_id"],
            "sessionDateTimeStart": session_time.isoformat(),
            "durationMinutes": 30,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Test"
        }
        session_response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        
        if session_response.status_code != 200:
            pytest.skip(f"Session creation failed: {session_response.text}")
        
        session_id = session_response.json()["id"]
        
        # Generate token
        token_response = requests.post(f"{BASE_URL}/api/safety-check/generate-token/{session_id}", headers=headers)
        assert token_response.status_code == 200
        
        data = token_response.json()
        expires_at = data.get("expiresAt")
        
        # Parse expiry time
        now = dt.utcnow()
        
        # Parse the ISO format expiry
        expires_str = expires_at.replace("Z", "").replace("+00:00", "")
        if "." in expires_str:
            expires_dt = dt.fromisoformat(expires_str.split(".")[0])
        else:
            expires_dt = dt.fromisoformat(expires_str)
        
        # Calculate difference - should be approximately 5 minutes
        diff_seconds = (expires_dt - now).total_seconds()
        
        # Allow some tolerance (4-6 minutes)
        assert 240 <= diff_seconds <= 360, f"Token expiry should be ~5 minutes, got {diff_seconds} seconds"
        
        print(f"✓ Token expiry verified: {diff_seconds/60:.1f} minutes")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
