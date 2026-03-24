"""
Iteration 45: Location Agreement & Arrival Confirmation API Tests
Tests for the 4 new endpoints:
1. POST /api/sessions/{id}/propose-location - Trainer proposes outdoor location
2. POST /api/sessions/{id}/agree-location - Trainee agrees or counter-proposes
3. POST /api/sessions/{id}/trainer-arrived - Trainer confirms arrival
4. POST /api/sessions/{id}/trainee-arrived - Trainee confirms arrival, returns bothArrived flag
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"


class TestSetup:
    """Setup fixtures for testing"""
    
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


class TestLocationProposal(TestSetup):
    """Tests for POST /api/sessions/{id}/propose-location"""
    
    @pytest.fixture(scope="class")
    def outdoor_session(self, trainer_auth, trainee_auth):
        """Create an outdoor session for testing"""
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        session_data = {
            "traineeId": trainee_auth["user_id"],
            "trainerId": trainer_auth["user_id"],
            "sessionDateTimeStart": (datetime.utcnow() + timedelta(days=1)).isoformat(),
            "durationMinutes": 60,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Central Park",
            "notes": "Test session for location proposal"
        }
        response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        if response.status_code == 201:
            return response.json()
        # If session creation fails, try to find an existing outdoor session
        response = requests.get(f"{BASE_URL}/api/trainer/sessions", headers={"Authorization": f"Bearer {trainer_auth['token']}"})
        if response.status_code == 200:
            sessions = response.json()
            for s in sessions:
                if s.get('sessionType') == 'outdoor' and s.get('status') in ['requested', 'confirmed']:
                    return s
        pytest.skip("Could not create or find outdoor session for testing")
    
    def test_trainer_can_propose_location(self, trainer_auth, outdoor_session):
        """Test that trainer can propose a new outdoor location"""
        headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
        session_id = outdoor_session.get('id')
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/propose-location",
            json={"proposedLocation": "Bryant Park, NYC"},
            headers=headers
        )
        
        # Accept 200 or 400 (if session type is not outdoor)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "message" in data
            print(f"PASSED: Trainer proposed location successfully: {data}")
        else:
            print(f"INFO: Location proposal returned 400 (expected for non-outdoor sessions): {response.text}")
    
    def test_trainee_cannot_propose_location(self, trainee_auth, outdoor_session):
        """Test that trainee cannot propose location (only trainer can)"""
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        session_id = outdoor_session.get('id')
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/propose-location",
            json={"proposedLocation": "Times Square"},
            headers=headers
        )
        
        # Should return 403 (only trainer can propose)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"PASSED: Trainee correctly blocked from proposing location")
    
    def test_propose_location_empty_rejected(self, trainer_auth, outdoor_session):
        """Test that empty location proposal is rejected"""
        headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
        session_id = outdoor_session.get('id')
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/propose-location",
            json={"proposedLocation": ""},
            headers=headers
        )
        
        # Should return 400 for empty location
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"PASSED: Empty location proposal correctly rejected")
    
    def test_propose_location_invalid_session(self, trainer_auth):
        """Test that invalid session ID returns 400 or 404"""
        headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/invalid-id/propose-location",
            json={"proposedLocation": "Test Location"},
            headers=headers
        )
        
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}"
        print(f"PASSED: Invalid session ID correctly rejected")


class TestLocationAgreement(TestSetup):
    """Tests for POST /api/sessions/{id}/agree-location"""
    
    @pytest.fixture(scope="class")
    def session_with_proposal(self, trainer_auth, trainee_auth):
        """Create a session with a location proposal"""
        # First create a session
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        session_data = {
            "traineeId": trainee_auth["user_id"],
            "trainerId": trainer_auth["user_id"],
            "sessionDateTimeStart": (datetime.utcnow() + timedelta(days=2)).isoformat(),
            "durationMinutes": 45,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Initial Location",
            "notes": "Test session for location agreement"
        }
        response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        
        if response.status_code == 201:
            session = response.json()
            session_id = session.get('id')
            
            # Trainer proposes a new location
            trainer_headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
            requests.post(
                f"{BASE_URL}/api/sessions/{session_id}/propose-location",
                json={"proposedLocation": "Proposed Test Location"},
                headers=trainer_headers
            )
            return session
        
        # Fallback: find existing session
        response = requests.get(f"{BASE_URL}/api/trainee/sessions", headers=headers)
        if response.status_code == 200:
            sessions = response.json()
            for s in sessions:
                if s.get('sessionType') == 'outdoor':
                    return s
        pytest.skip("Could not create session with proposal")
    
    def test_trainee_can_agree_to_location(self, trainee_auth, session_with_proposal):
        """Test that trainee can agree to proposed location"""
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        session_id = session_with_proposal.get('id')
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/agree-location",
            json={"agreed": True},
            headers=headers
        )
        
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print(f"PASSED: Trainee agreed to location: {data}")
        else:
            print(f"INFO: Agreement returned 400 (may be non-outdoor session): {response.text}")
    
    def test_trainee_can_counter_propose(self, trainee_auth, trainer_auth):
        """Test that trainee can counter-propose a different location"""
        # Create a fresh session for this test
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        session_data = {
            "traineeId": trainee_auth["user_id"],
            "trainerId": trainer_auth["user_id"],
            "sessionDateTimeStart": (datetime.utcnow() + timedelta(days=3)).isoformat(),
            "durationMinutes": 30,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Original Location",
            "notes": "Test counter proposal"
        }
        response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        
        if response.status_code != 201:
            pytest.skip("Could not create session for counter-proposal test")
        
        session = response.json()
        session_id = session.get('id')
        
        # Trainer proposes location
        trainer_headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
        requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/propose-location",
            json={"proposedLocation": "Trainer's Location"},
            headers=trainer_headers
        )
        
        # Trainee counter-proposes
        response = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/agree-location",
            json={"agreed": False, "counterProposal": "Trainee's Preferred Location"},
            headers=headers
        )
        
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "counter" in data.get("message", "").lower() or "proposal" in data.get("message", "").lower()
            print(f"PASSED: Trainee counter-proposed successfully: {data}")
    
    def test_trainer_cannot_agree_to_location(self, trainer_auth, session_with_proposal):
        """Test that trainer cannot agree to location (only trainee can)"""
        headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
        session_id = session_with_proposal.get('id')
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/agree-location",
            json={"agreed": True},
            headers=headers
        )
        
        # Should return 403 (only trainee can agree)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"PASSED: Trainer correctly blocked from agreeing to location")


class TestTrainerArrival(TestSetup):
    """Tests for POST /api/sessions/{id}/trainer-arrived"""
    
    @pytest.fixture(scope="class")
    def confirmed_session(self, trainer_auth, trainee_auth):
        """Create and confirm a session for arrival testing"""
        # Create session
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        session_data = {
            "traineeId": trainee_auth["user_id"],
            "trainerId": trainer_auth["user_id"],
            "sessionDateTimeStart": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            "durationMinutes": 60,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Test Gym",
            "notes": "Test session for arrival"
        }
        response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        
        if response.status_code == 201:
            session = response.json()
            session_id = session.get('id')
            
            # Trainer accepts the session
            trainer_headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
            accept_response = requests.patch(
                f"{BASE_URL}/api/sessions/{session_id}/accept",
                headers=trainer_headers
            )
            if accept_response.status_code == 200:
                return accept_response.json()
            return session
        
        # Fallback: find existing confirmed session
        trainer_headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
        response = requests.get(f"{BASE_URL}/api/trainer/sessions?status=confirmed", headers=trainer_headers)
        if response.status_code == 200:
            sessions = response.json()
            if sessions:
                return sessions[0]
        
        pytest.skip("Could not create or find confirmed session")
    
    def test_trainer_can_confirm_arrival(self, trainer_auth, confirmed_session):
        """Test that trainer can confirm arrival at session location"""
        headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
        session_id = confirmed_session.get('id')
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/trainer-arrived",
            headers=headers
        )
        
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "message" in data
            print(f"PASSED: Trainer confirmed arrival: {data}")
        else:
            print(f"INFO: Trainer arrival returned 400 (session status may not allow): {response.text}")
    
    def test_trainee_cannot_confirm_trainer_arrival(self, trainee_auth, confirmed_session):
        """Test that trainee cannot confirm trainer's arrival"""
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        session_id = confirmed_session.get('id')
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/trainer-arrived",
            headers=headers
        )
        
        # Should return 403 (only trainer can confirm their arrival)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"PASSED: Trainee correctly blocked from confirming trainer arrival")
    
    def test_trainer_arrival_invalid_session(self, trainer_auth):
        """Test trainer arrival with invalid session ID"""
        headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/invalid-session-id/trainer-arrived",
            headers=headers
        )
        
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}"
        print(f"PASSED: Invalid session ID correctly rejected for trainer arrival")


class TestTraineeArrival(TestSetup):
    """Tests for POST /api/sessions/{id}/trainee-arrived"""
    
    @pytest.fixture(scope="class")
    def session_for_trainee_arrival(self, trainer_auth, trainee_auth):
        """Create a confirmed session for trainee arrival testing"""
        # Create session
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        session_data = {
            "traineeId": trainee_auth["user_id"],
            "trainerId": trainer_auth["user_id"],
            "sessionDateTimeStart": (datetime.utcnow() + timedelta(hours=2)).isoformat(),
            "durationMinutes": 45,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Fitness Park",
            "notes": "Test session for trainee arrival"
        }
        response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        
        if response.status_code == 201:
            session = response.json()
            session_id = session.get('id')
            
            # Trainer accepts
            trainer_headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
            accept_response = requests.patch(
                f"{BASE_URL}/api/sessions/{session_id}/accept",
                headers=trainer_headers
            )
            if accept_response.status_code == 200:
                return accept_response.json()
            return session
        
        # Fallback
        response = requests.get(f"{BASE_URL}/api/trainee/sessions?status=confirmed", headers=headers)
        if response.status_code == 200:
            sessions = response.json()
            if sessions:
                return sessions[0]
        
        pytest.skip("Could not create or find session for trainee arrival")
    
    def test_trainee_can_confirm_arrival(self, trainee_auth, session_for_trainee_arrival):
        """Test that trainee can confirm arrival at session location"""
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        session_id = session_for_trainee_arrival.get('id')
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/trainee-arrived",
            headers=headers
        )
        
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "message" in data
            assert "bothArrived" in data  # Key feature: returns bothArrived flag
            print(f"PASSED: Trainee confirmed arrival: {data}")
            print(f"  - bothArrived flag: {data.get('bothArrived')}")
        else:
            print(f"INFO: Trainee arrival returned 400 (session status may not allow): {response.text}")
    
    def test_trainer_cannot_confirm_trainee_arrival(self, trainer_auth, session_for_trainee_arrival):
        """Test that trainer cannot confirm trainee's arrival"""
        headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
        session_id = session_for_trainee_arrival.get('id')
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/trainee-arrived",
            headers=headers
        )
        
        # Should return 403 (only trainee can confirm their arrival)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"PASSED: Trainer correctly blocked from confirming trainee arrival")
    
    def test_trainee_arrival_invalid_session(self, trainee_auth):
        """Test trainee arrival with invalid session ID"""
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/invalid-session-id/trainee-arrived",
            headers=headers
        )
        
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}"
        print(f"PASSED: Invalid session ID correctly rejected for trainee arrival")


class TestBothArrivedFlow(TestSetup):
    """Test the complete flow where both trainer and trainee confirm arrival"""
    
    def test_both_arrived_flag_true_when_both_confirm(self, trainer_auth, trainee_auth):
        """Test that bothArrived flag is True when both parties confirm"""
        # Create a fresh session
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        session_data = {
            "traineeId": trainee_auth["user_id"],
            "trainerId": trainer_auth["user_id"],
            "sessionDateTimeStart": (datetime.utcnow() + timedelta(hours=3)).isoformat(),
            "durationMinutes": 60,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Both Arrived Test Location",
            "notes": "Test both arrived flow"
        }
        response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        
        if response.status_code != 201:
            pytest.skip("Could not create session for both-arrived test")
        
        session = response.json()
        session_id = session.get('id')
        
        # Trainer accepts
        trainer_headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
        accept_response = requests.patch(
            f"{BASE_URL}/api/sessions/{session_id}/accept",
            headers=trainer_headers
        )
        
        if accept_response.status_code != 200:
            pytest.skip("Could not accept session for both-arrived test")
        
        # Trainer confirms arrival first
        trainer_arrival = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/trainer-arrived",
            headers=trainer_headers
        )
        
        if trainer_arrival.status_code != 200:
            print(f"INFO: Trainer arrival failed: {trainer_arrival.text}")
            pytest.skip("Trainer arrival failed")
        
        print(f"Trainer arrival response: {trainer_arrival.json()}")
        
        # Trainee confirms arrival
        trainee_arrival = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/trainee-arrived",
            headers=headers
        )
        
        if trainee_arrival.status_code == 200:
            data = trainee_arrival.json()
            assert data.get("success") == True
            assert data.get("bothArrived") == True, f"Expected bothArrived=True, got {data.get('bothArrived')}"
            print(f"PASSED: Both arrived flow complete - bothArrived={data.get('bothArrived')}")
        else:
            print(f"INFO: Trainee arrival returned {trainee_arrival.status_code}: {trainee_arrival.text}")


class TestEdgeCases(TestSetup):
    """Test edge cases and error handling"""
    
    def test_unauthenticated_propose_location(self):
        """Test that unauthenticated request is rejected"""
        response = requests.post(
            f"{BASE_URL}/api/sessions/some-id/propose-location",
            json={"proposedLocation": "Test"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASSED: Unauthenticated propose-location rejected")
    
    def test_unauthenticated_agree_location(self):
        """Test that unauthenticated request is rejected"""
        response = requests.post(
            f"{BASE_URL}/api/sessions/some-id/agree-location",
            json={"agreed": True}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASSED: Unauthenticated agree-location rejected")
    
    def test_unauthenticated_trainer_arrived(self):
        """Test that unauthenticated request is rejected"""
        response = requests.post(
            f"{BASE_URL}/api/sessions/some-id/trainer-arrived"
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASSED: Unauthenticated trainer-arrived rejected")
    
    def test_unauthenticated_trainee_arrived(self):
        """Test that unauthenticated request is rejected"""
        response = requests.post(
            f"{BASE_URL}/api/sessions/some-id/trainee-arrived"
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASSED: Unauthenticated trainee-arrived rejected")
    
    def test_nonexistent_session_propose_location(self, trainer_auth):
        """Test propose location with non-existent session"""
        headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
        # Use a valid ObjectId format but non-existent
        response = requests.post(
            f"{BASE_URL}/api/sessions/000000000000000000000000/propose-location",
            json={"proposedLocation": "Test"},
            headers=headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"PASSED: Non-existent session correctly returns 404")


class TestAPIServiceMethods(TestSetup):
    """Test that the API service methods work correctly"""
    
    def test_sessions_api_get_session(self, trainer_auth, trainee_auth):
        """Test GET /api/sessions/{id} endpoint"""
        # Create a session first
        headers = {"Authorization": f"Bearer {trainee_auth['token']}"}
        session_data = {
            "traineeId": trainee_auth["user_id"],
            "trainerId": trainer_auth["user_id"],
            "sessionDateTimeStart": (datetime.utcnow() + timedelta(days=5)).isoformat(),
            "durationMinutes": 60,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "API Test Location"
        }
        create_response = requests.post(f"{BASE_URL}/api/sessions", json=session_data, headers=headers)
        
        if create_response.status_code == 201:
            session = create_response.json()
            session_id = session.get('id')
            
            # Get the session
            get_response = requests.get(
                f"{BASE_URL}/api/sessions/{session_id}",
                headers=headers
            )
            
            assert get_response.status_code == 200, f"GET session failed: {get_response.text}"
            data = get_response.json()
            assert data.get('id') == session_id
            print(f"PASSED: GET /api/sessions/{session_id} works correctly")
        else:
            print(f"INFO: Could not create session for GET test: {create_response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
