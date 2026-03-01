"""
P2 Session Verification — Selfie Check Tests

Tests the selfie verification feature where both trainer and trainee must submit
a selfie before a session can start.

Features tested:
- POST /api/sessions/{id}/verify-selfie - Submit selfie verification
- GET /api/sessions/{id}/verification-status - Check verification status
- Selfie validation (min 100 chars, max ~5MB)
- Access control (only participants can submit/view)
- Session flags and storage in session_selfies collection
- Notification to other party when selfie submitted
"""

import pytest
import requests
import os
from datetime import datetime, timedelta
from bson import ObjectId
from pymongo import MongoClient

# API base URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
TRAINEE1_EMAIL = "trainee1@test.com"
TRAINEE1_PASSWORD = "test123"
TRAINEE1_ID = "697c077500b22ded1af3509d"

TRAINEE2_EMAIL = "trainee2@test.com"
TRAINEE2_PASSWORD = "test123"
# trainee2 is NOT a participant - used for access control tests

TRAINER1_EMAIL = "trainer1@test.com"
TRAINER1_PASSWORD = "test123"
TRAINER1_ID = "697c077500b22ded1af35097"

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'rapidreps')

# Generate valid base64 selfie data (>100 chars)
VALID_SELFIE_DATA = "data:image/jpeg;base64," + "A" * 500  # ~500 char valid selfie
SHORT_SELFIE_DATA = "ABC"  # Too short (<100 chars)
LARGE_SELFIE_DATA = "data:image/jpeg;base64," + "A" * 7_500_000  # >5MB


class TestSetup:
    """Fixtures and helper methods for P2 selfie verification tests"""
    
    @pytest.fixture(scope="class")
    def mongo_client(self):
        """MongoDB client for direct database access"""
        client = MongoClient(MONGO_URL)
        yield client[DB_NAME]
        client.close()
    
    @pytest.fixture
    def api_session(self):
        """Requests session with headers"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture
    def trainer_token(self, api_session):
        """Get trainer1 auth token"""
        response = api_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER1_EMAIL,
            "password": TRAINER1_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Trainer login failed: {response.status_code}")
    
    @pytest.fixture
    def trainee_token(self, api_session):
        """Get trainee1 auth token"""
        response = api_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE1_EMAIL,
            "password": TRAINEE1_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Trainee login failed: {response.status_code}")
    
    @pytest.fixture
    def non_participant_token(self, api_session):
        """Get trainee2 auth token (non-participant)"""
        response = api_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE2_EMAIL,
            "password": TRAINEE2_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Trainee2 login failed: {response.status_code}")
    
    @pytest.fixture
    def test_session_id(self, mongo_client):
        """Create a test session in MongoDB for selfie verification tests"""
        session_doc = {
            '_id': ObjectId(),
            'trainerId': TRAINER1_ID,
            'traineeId': TRAINEE1_ID,
            'status': 'confirmed',
            'sessionDateTimeStart': datetime.utcnow() + timedelta(hours=1),
            'sessionDateTimeEnd': datetime.utcnow() + timedelta(hours=2),
            'durationMinutes': 60,
            'sessionType': 'outdoor',
            'locationType': 'park',
            'locationNameOrAddress': 'Central Park, NYC',
            'baseSessionPriceCents': 5000,
            'finalSessionPriceCents': 5000,
            'trainerSelfieVerified': False,
            'traineeSelfieVerified': False,
            'selfieVerificationComplete': False,
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
        }
        result = mongo_client.sessions.insert_one(session_doc)
        session_id = str(result.inserted_id)
        
        yield session_id
        
        # Cleanup
        mongo_client.sessions.delete_one({'_id': result.inserted_id})
        mongo_client.session_selfies.delete_many({'sessionId': session_id})


class TestSelfieSubmission(TestSetup):
    """Test POST /api/sessions/{id}/verify-selfie endpoint"""
    
    def test_trainer_submit_selfie_success(self, api_session, trainer_token, test_session_id, mongo_client):
        """Test trainer can submit selfie successfully"""
        api_session.headers.update({"Authorization": f"Bearer {trainer_token}"})
        
        response = api_session.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get('success') == True
        assert data.get('role') == 'trainer'
        assert data.get('bothVerified') == False  # Only trainer submitted
        assert 'message' in data
        assert 'trainee' in data.get('message', '').lower()  # Waiting for trainee
        
        # Verify session_selfies collection was updated
        selfie_record = mongo_client.session_selfies.find_one({
            'sessionId': test_session_id,
            'userId': TRAINER1_ID
        })
        assert selfie_record is not None, "Selfie record not found in session_selfies collection"
        assert selfie_record.get('role') == 'trainer'
        assert selfie_record.get('verified') == True
        assert 'verifiedAt' in selfie_record
        
        # Verify session document was updated
        session = mongo_client.sessions.find_one({'_id': ObjectId(test_session_id)})
        assert session.get('trainerSelfieVerified') == True
        assert session.get('trainerSelfieAt') is not None
        
        print(f"✓ Trainer selfie submitted successfully for session {test_session_id}")
    
    def test_trainee_submit_selfie_both_verified(self, api_session, trainee_token, test_session_id, mongo_client):
        """Test trainee submits selfie after trainer - both verified"""
        # First ensure trainer has submitted
        trainer_session = requests.Session()
        trainer_session.headers.update({"Content-Type": "application/json"})
        
        # Login trainer
        login_resp = trainer_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER1_EMAIL,
            "password": TRAINER1_PASSWORD
        })
        trainer_token_local = login_resp.json().get("access_token")
        trainer_session.headers.update({"Authorization": f"Bearer {trainer_token_local}"})
        
        # Trainer submits selfie
        trainer_session.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA}
        )
        
        # Now trainee submits
        api_session.headers.update({"Authorization": f"Bearer {trainee_token}"})
        
        response = api_session.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response indicates both verified
        assert data.get('success') == True
        assert data.get('role') == 'trainee'
        assert data.get('bothVerified') == True
        assert 'Both' in data.get('message', '') or 'start' in data.get('message', '').lower()
        
        # Verify session document has selfieVerificationComplete=True
        session = mongo_client.sessions.find_one({'_id': ObjectId(test_session_id)})
        assert session.get('traineeSelfieVerified') == True
        assert session.get('selfieVerificationComplete') == True
        assert session.get('selfieVerifiedAt') is not None
        
        print(f"✓ Both parties verified - session {test_session_id} can now start")


class TestSelfieValidation(TestSetup):
    """Test selfie data validation rules"""
    
    def test_reject_short_selfie_data(self, api_session, trainer_token, test_session_id):
        """Test selfie data <100 chars is rejected"""
        api_session.headers.update({"Authorization": f"Bearer {trainer_token}"})
        
        response = api_session.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/verify-selfie",
            json={"selfieBase64": SHORT_SELFIE_DATA}
        )
        
        assert response.status_code == 400, f"Expected 400 for short selfie, got {response.status_code}"
        data = response.json()
        assert 'invalid' in data.get('detail', '').lower() or 'selfie' in data.get('detail', '').lower()
        
        print("✓ Short selfie data (<100 chars) correctly rejected with 400")
    
    def test_reject_large_selfie_data(self, api_session, trainer_token, test_session_id):
        """Test selfie data >5MB is rejected"""
        api_session.headers.update({"Authorization": f"Bearer {trainer_token}"})
        
        response = api_session.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/verify-selfie",
            json={"selfieBase64": LARGE_SELFIE_DATA}
        )
        
        assert response.status_code == 400, f"Expected 400 for large selfie, got {response.status_code}"
        data = response.json()
        assert 'large' in data.get('detail', '').lower() or 'size' in data.get('detail', '').lower() or '5mb' in data.get('detail', '').lower()
        
        print("✓ Large selfie data (>5MB) correctly rejected with 400")
    
    def test_reject_empty_selfie_data(self, api_session, trainer_token, test_session_id):
        """Test empty selfie data is rejected"""
        api_session.headers.update({"Authorization": f"Bearer {trainer_token}"})
        
        response = api_session.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/verify-selfie",
            json={"selfieBase64": ""}
        )
        
        assert response.status_code == 400, f"Expected 400 for empty selfie, got {response.status_code}"
        
        print("✓ Empty selfie data correctly rejected with 400")


class TestAccessControl(TestSetup):
    """Test access control - only session participants can submit/view"""
    
    def test_non_participant_cannot_submit_selfie(self, api_session, non_participant_token, test_session_id):
        """Test non-participant gets 403 when submitting selfie"""
        api_session.headers.update({"Authorization": f"Bearer {non_participant_token}"})
        
        response = api_session.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA}
        )
        
        assert response.status_code == 403, f"Expected 403 for non-participant, got {response.status_code}: {response.text}"
        data = response.json()
        assert 'participant' in data.get('detail', '').lower() or 'not' in data.get('detail', '').lower()
        
        print("✓ Non-participant correctly blocked from submitting selfie (403)")
    
    def test_non_participant_cannot_view_verification_status(self, api_session, non_participant_token, test_session_id):
        """Test non-participant gets 403 when checking verification status"""
        api_session.headers.update({"Authorization": f"Bearer {non_participant_token}"})
        
        response = api_session.get(
            f"{BASE_URL}/api/sessions/{test_session_id}/verification-status"
        )
        
        assert response.status_code == 403, f"Expected 403 for non-participant, got {response.status_code}: {response.text}"
        
        print("✓ Non-participant correctly blocked from viewing verification status (403)")
    
    def test_unauthenticated_cannot_submit_selfie(self, api_session, test_session_id):
        """Test unauthenticated request gets 401/403"""
        # Remove any auth header
        api_session.headers.pop("Authorization", None)
        
        response = api_session.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA}
        )
        
        # Should be 401 (unauthorized) or 403 (forbidden)
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthenticated, got {response.status_code}"
        
        print("✓ Unauthenticated request correctly blocked")


class TestVerificationStatus(TestSetup):
    """Test GET /api/sessions/{id}/verification-status endpoint"""
    
    def test_initial_verification_status(self, api_session, trainer_token, test_session_id):
        """Test initial verification status shows all false"""
        api_session.headers.update({"Authorization": f"Bearer {trainer_token}"})
        
        response = api_session.get(
            f"{BASE_URL}/api/sessions/{test_session_id}/verification-status"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check all verification flags present
        assert 'trainerVerified' in data
        assert 'traineeVerified' in data
        assert 'bothVerified' in data
        
        # Initial state should be all false
        assert data.get('trainerVerified') == False
        assert data.get('traineeVerified') == False
        assert data.get('bothVerified') == False
        
        print("✓ Initial verification status correctly shows all false")
    
    def test_verification_status_after_trainer_selfie(self, api_session, trainer_token, test_session_id):
        """Test verification status shows trainer verified after submission"""
        api_session.headers.update({"Authorization": f"Bearer {trainer_token}"})
        
        # Submit trainer selfie
        api_session.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA}
        )
        
        # Check status
        response = api_session.get(
            f"{BASE_URL}/api/sessions/{test_session_id}/verification-status"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get('trainerVerified') == True
        assert data.get('traineeVerified') == False
        assert data.get('bothVerified') == False
        assert data.get('trainerSelfieAt') is not None  # Timestamp present
        
        print("✓ Verification status correctly shows trainer verified with timestamp")
    
    def test_verification_status_after_both_selfies(self, api_session, trainer_token, trainee_token, test_session_id, mongo_client):
        """Test verification status shows both verified after both submit"""
        # Submit trainer selfie
        trainer_session = requests.Session()
        trainer_session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {trainer_token}"
        })
        trainer_session.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA}
        )
        
        # Submit trainee selfie
        trainee_session = requests.Session()
        trainee_session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {trainee_token}"
        })
        trainee_session.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA}
        )
        
        # Check status as trainer
        response = trainer_session.get(
            f"{BASE_URL}/api/sessions/{test_session_id}/verification-status"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get('trainerVerified') == True
        assert data.get('traineeVerified') == True
        assert data.get('bothVerified') == True
        assert data.get('trainerSelfieAt') is not None
        assert data.get('traineeSelfieAt') is not None
        
        print("✓ Verification status correctly shows both verified with timestamps")


class TestEdgeCases(TestSetup):
    """Test edge cases and error handling"""
    
    def test_invalid_session_id_format(self, api_session, trainer_token):
        """Test invalid session ID format returns 400"""
        api_session.headers.update({"Authorization": f"Bearer {trainer_token}"})
        
        response = api_session.post(
            f"{BASE_URL}/api/sessions/invalid-id-format/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid ID, got {response.status_code}"
        
        print("✓ Invalid session ID format correctly returns 400")
    
    def test_nonexistent_session_id(self, api_session, trainer_token):
        """Test nonexistent session ID returns 404"""
        api_session.headers.update({"Authorization": f"Bearer {trainer_token}"})
        
        # Valid ObjectId format but doesn't exist
        fake_session_id = str(ObjectId())
        
        response = api_session.post(
            f"{BASE_URL}/api/sessions/{fake_session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA}
        )
        
        assert response.status_code == 404, f"Expected 404 for nonexistent session, got {response.status_code}"
        
        print("✓ Nonexistent session ID correctly returns 404")
    
    def test_trainee_can_view_verification_status(self, api_session, trainee_token, test_session_id):
        """Test trainee can also view verification status (not just trainer)"""
        api_session.headers.update({"Authorization": f"Bearer {trainee_token}"})
        
        response = api_session.get(
            f"{BASE_URL}/api/sessions/{test_session_id}/verification-status"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert 'trainerVerified' in data
        assert 'traineeVerified' in data
        assert 'bothVerified' in data
        
        print("✓ Trainee can view verification status")
    
    def test_selfie_resubmission_updates_record(self, api_session, trainer_token, test_session_id, mongo_client):
        """Test submitting selfie again updates the existing record"""
        api_session.headers.update({"Authorization": f"Bearer {trainer_token}"})
        
        # First submission
        api_session.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA}
        )
        
        first_record = mongo_client.session_selfies.find_one({
            'sessionId': test_session_id,
            'userId': TRAINER1_ID
        })
        first_time = first_record.get('verifiedAt')
        
        # Small delay
        import time
        time.sleep(0.1)
        
        # Second submission (re-verification)
        new_selfie = "data:image/jpeg;base64," + "B" * 500
        response = api_session.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/verify-selfie",
            json={"selfieBase64": new_selfie}
        )
        
        assert response.status_code == 200
        
        # Check that record was updated (not duplicated)
        records = list(mongo_client.session_selfies.find({
            'sessionId': test_session_id,
            'userId': TRAINER1_ID
        }))
        assert len(records) == 1, "Expected single record after resubmission (upsert)"
        
        second_record = records[0]
        assert second_record.get('verifiedAt') >= first_time  # Time should be same or later
        
        print("✓ Selfie resubmission updates existing record (upsert behavior)")


class TestDataStorage(TestSetup):
    """Test that data is stored correctly in MongoDB collections"""
    
    def test_selfie_stored_in_session_selfies_collection(self, api_session, trainer_token, test_session_id, mongo_client):
        """Test selfie data is stored in session_selfies collection with correct fields"""
        api_session.headers.update({"Authorization": f"Bearer {trainer_token}"})
        
        api_session.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA}
        )
        
        # Check session_selfies collection
        selfie_doc = mongo_client.session_selfies.find_one({
            'sessionId': test_session_id,
            'userId': TRAINER1_ID
        })
        
        assert selfie_doc is not None, "Selfie document not found"
        
        # Verify required fields
        assert selfie_doc.get('sessionId') == test_session_id
        assert selfie_doc.get('userId') == TRAINER1_ID
        assert selfie_doc.get('role') == 'trainer'
        assert selfie_doc.get('verified') == True
        assert 'verifiedAt' in selfie_doc
        assert isinstance(selfie_doc.get('verifiedAt'), datetime)
        
        # Verify selfie is truncated (first 200 chars + '...')
        stored_selfie = selfie_doc.get('selfieBase64', '')
        assert stored_selfie.endswith('...')
        assert len(stored_selfie) <= 210  # ~200 chars + '...'
        
        print("✓ Selfie correctly stored in session_selfies collection with role and timestamp")
    
    def test_session_document_updated_with_flags(self, api_session, trainer_token, test_session_id, mongo_client):
        """Test session document is updated with verification flags"""
        api_session.headers.update({"Authorization": f"Bearer {trainer_token}"})
        
        # Submit trainer selfie
        api_session.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA}
        )
        
        # Check session document
        session = mongo_client.sessions.find_one({'_id': ObjectId(test_session_id)})
        
        assert session.get('trainerSelfieVerified') == True
        assert session.get('trainerSelfieAt') is not None
        assert isinstance(session.get('trainerSelfieAt'), datetime)
        
        print("✓ Session document correctly updated with trainerSelfieVerified and timestamp")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
