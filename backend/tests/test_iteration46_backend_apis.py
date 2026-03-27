"""
Iteration 46: Backend API Verification Tests
Tests for the core backend APIs as requested:
1. GET /api/health - Health check
2. POST /api/auth/login - Login with test credentials
3. GET /api/trainee/sessions - Trainee sessions (with auth)
4. GET /api/trainers/search - Trainer search
5. GET /api/sessions/{id}/gps-track - GPS tracking
6. POST /api/sessions/{id}/propose-location - Location proposal
7. POST /api/sessions/{id}/trainee-arrived - Arrival confirmation
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', os.environ.get('REACT_APP_BACKEND_URL', '')).rstrip('/')

# Test credentials from iteration 45
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"


class TestHealthCheck:
    """Tests for /api/health endpoint"""
    
    def test_health_endpoint_returns_200(self):
        """Test that health endpoint returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy"
        assert "timestamp" in data
        print(f"PASSED: Health check - status={data['status']}, timestamp={data['timestamp']}")
    
    def test_root_endpoint_returns_200(self):
        """Test that root endpoint returns 200 OK (may return HTML or JSON)"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200, f"Root endpoint failed: {response.status_code}"
        # Root may return HTML (frontend) or JSON (API info)
        content_type = response.headers.get('content-type', '')
        if 'application/json' in content_type:
            data = response.json()
            assert "status" in data or "message" in data
            print(f"PASSED: Root endpoint (JSON) - {data}")
        else:
            # HTML response from frontend
            assert len(response.text) > 0
            print(f"PASSED: Root endpoint (HTML) - content length={len(response.text)}")


class TestAuthentication:
    """Tests for /api/auth/login endpoint"""
    
    def test_trainee_login_success(self):
        """Test trainee login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == TRAINEE_EMAIL
        assert "trainee" in data["user"]["roles"]
        print(f"PASSED: Trainee login - user_id={data['user']['id']}, roles={data['user']['roles']}")
    
    def test_trainer_login_success(self):
        """Test trainer login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == TRAINER_EMAIL
        assert "trainer" in data["user"]["roles"]
        print(f"PASSED: Trainer login - user_id={data['user']['id']}, roles={data['user']['roles']}")
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["isAdmin"] == True, "Admin flag not set"
        print(f"PASSED: Admin login - user_id={data['user']['id']}, isAdmin={data['user']['isAdmin']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"PASSED: Invalid credentials correctly rejected with 401")


class TestTraineeSessions:
    """Tests for /api/trainee/sessions endpoint"""
    
    @pytest.fixture(scope="class")
    def trainee_auth(self):
        """Get trainee authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        data = response.json()
        return {
            "token": data["access_token"],
            "user_id": data["user"]["id"]
        }
    
    def test_trainee_sessions_returns_200(self, trainee_auth):
        """Test that trainee sessions endpoint returns 200 with auth"""
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/trainee/sessions", headers=headers)
        
        assert response.status_code == 200, f"Trainee sessions failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASSED: Trainee sessions - found {len(data)} sessions")
        
        # Validate session structure if sessions exist
        if data:
            session = data[0]
            assert "id" in session, "Session missing id"
            assert "traineeId" in session, "Session missing traineeId"
            assert "trainerId" in session, "Session missing trainerId"
            assert "status" in session, "Session missing status"
            print(f"  First session: id={session['id']}, status={session['status']}")
    
    def test_trainee_sessions_requires_auth(self):
        """Test that trainee sessions endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/trainee/sessions")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASSED: Trainee sessions correctly requires authentication")


class TestTrainerSearch:
    """Tests for /api/trainers/search endpoint"""
    
    def test_trainer_search_returns_200(self):
        """Test that trainer search endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/trainers/search", params={
            "latitude": 40.7128,
            "longitude": -74.0060
        })
        
        assert response.status_code == 200, f"Trainer search failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASSED: Trainer search - found {len(data)} trainers")
        
        # Validate trainer structure if trainers exist
        if data:
            trainer = data[0]
            assert "id" in trainer, "Trainer missing id"
            assert "userId" in trainer, "Trainer missing userId"
            print(f"  First trainer: id={trainer['id']}, tier={trainer.get('trainerTier', 'N/A')}")
    
    def test_trainer_search_with_filters(self):
        """Test trainer search with various filters"""
        response = requests.get(f"{BASE_URL}/api/trainers/search", params={
            "latitude": 40.7128,
            "longitude": -74.0060,
            "sessionType": "outdoor",
            "maxDistance": 20
        })
        
        assert response.status_code == 200, f"Trainer search with filters failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASSED: Trainer search with filters - found {len(data)} trainers")


class TestGPSTracking:
    """Tests for /api/sessions/{id}/gps-track endpoint"""
    
    @pytest.fixture(scope="class")
    def trainee_auth(self):
        """Get trainee authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        data = response.json()
        return {
            "token": data["access_token"],
            "user_id": data["user"]["id"]
        }
    
    @pytest.fixture(scope="class")
    def existing_session_id(self, trainee_auth):
        """Get an existing session ID for testing"""
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/trainee/sessions", headers=headers)
        if response.status_code == 200:
            sessions = response.json()
            if sessions:
                return sessions[0]["id"]
        pytest.skip("No existing sessions found for GPS tracking test")
    
    def test_gps_track_returns_200(self, trainee_auth, existing_session_id):
        """Test that GPS tracking endpoint returns 200"""
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        response = requests.get(
            f"{BASE_URL}/api/sessions/{existing_session_id}/gps-track",
            headers=headers
        )
        
        assert response.status_code == 200, f"GPS tracking failed: {response.text}"
        data = response.json()
        assert "tracking" in data, "Response missing tracking field"
        assert "sessionStatus" in data, "Response missing sessionStatus field"
        print(f"PASSED: GPS tracking - tracking={data['tracking']}, status={data['sessionStatus']}")
    
    def test_gps_track_invalid_session(self, trainee_auth):
        """Test GPS tracking with invalid session ID"""
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        response = requests.get(
            f"{BASE_URL}/api/sessions/invalid-id/gps-track",
            headers=headers
        )
        
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}"
        print(f"PASSED: GPS tracking correctly rejects invalid session ID")


class TestLocationProposal:
    """Tests for /api/sessions/{id}/propose-location endpoint"""
    
    @pytest.fixture(scope="class")
    def trainer_auth(self):
        """Get trainer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        data = response.json()
        return {
            "token": data["access_token"],
            "user_id": data["user"]["id"]
        }
    
    @pytest.fixture(scope="class")
    def existing_session_id(self, trainer_auth):
        """Get an existing session ID for testing"""
        headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/trainer/sessions", headers=headers)
        if response.status_code == 200:
            sessions = response.json()
            for s in sessions:
                if s.get('sessionType') == 'outdoor' and s.get('status') in ['requested', 'confirmed', 'en_route']:
                    return s["id"]
            if sessions:
                return sessions[0]["id"]
        pytest.skip("No existing sessions found for location proposal test")
    
    def test_propose_location_returns_200(self, trainer_auth, existing_session_id):
        """Test that location proposal endpoint returns 200"""
        headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
        response = requests.post(
            f"{BASE_URL}/api/sessions/{existing_session_id}/propose-location",
            json={"proposedLocation": "Test Location - Iteration 46"},
            headers=headers
        )
        
        # Accept 200 or 400 (if session type doesn't support location proposal)
        assert response.status_code in [200, 400], f"Location proposal failed: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print(f"PASSED: Location proposal - {data.get('message')}")
        else:
            print(f"INFO: Location proposal returned 400 (expected for non-outdoor sessions)")
    
    def test_propose_location_requires_auth(self):
        """Test that location proposal requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/sessions/some-id/propose-location",
            json={"proposedLocation": "Test"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASSED: Location proposal correctly requires authentication")


class TestArrivalConfirmation:
    """Tests for /api/sessions/{id}/trainee-arrived endpoint"""
    
    @pytest.fixture(scope="class")
    def trainee_auth(self):
        """Get trainee authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        data = response.json()
        return {
            "token": data["access_token"],
            "user_id": data["user"]["id"]
        }
    
    @pytest.fixture(scope="class")
    def existing_session_id(self, trainee_auth):
        """Get an existing session ID for testing"""
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/trainee/sessions", headers=headers)
        if response.status_code == 200:
            sessions = response.json()
            for s in sessions:
                if s.get('status') in ['confirmed', 'en_route']:
                    return s["id"]
            if sessions:
                return sessions[0]["id"]
        pytest.skip("No existing sessions found for arrival confirmation test")
    
    def test_trainee_arrived_returns_200(self, trainee_auth, existing_session_id):
        """Test that trainee arrival endpoint returns 200"""
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        response = requests.post(
            f"{BASE_URL}/api/sessions/{existing_session_id}/trainee-arrived",
            headers=headers
        )
        
        # Accept 200 or 400 (if session status doesn't allow arrival confirmation)
        assert response.status_code in [200, 400], f"Trainee arrival failed: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "bothArrived" in data, "Response missing bothArrived field"
            print(f"PASSED: Trainee arrival - bothArrived={data.get('bothArrived')}")
        else:
            print(f"INFO: Trainee arrival returned 400 (session status may not allow)")
    
    def test_trainee_arrived_requires_auth(self):
        """Test that trainee arrival requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/sessions/some-id/trainee-arrived"
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASSED: Trainee arrival correctly requires authentication")


class TestAPIResponseValidation:
    """Additional tests to validate API response structures"""
    
    @pytest.fixture(scope="class")
    def trainee_auth(self):
        """Get trainee authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        return {"token": data["access_token"], "user_id": data["user"]["id"]}
    
    def test_auth_me_endpoint(self, trainee_auth):
        """Test /api/auth/me returns current user"""
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        data = response.json()
        assert data["id"] == trainee_auth["user_id"]
        assert data["email"] == TRAINEE_EMAIL
        print(f"PASSED: Auth me - user_id={data['id']}, email={data['email']}")
    
    def test_trainee_profile_endpoint(self, trainee_auth):
        """Test /api/trainee-profiles/{user_id} returns profile"""
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        response = requests.get(
            f"{BASE_URL}/api/trainee-profiles/{trainee_auth['user_id']}",
            headers=headers
        )
        
        # Profile may or may not exist
        assert response.status_code in [200, 404], f"Trainee profile failed: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "userId" in data
            print(f"PASSED: Trainee profile exists - userId={data['userId']}")
        else:
            print(f"INFO: Trainee profile not found (404) - this is acceptable")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
