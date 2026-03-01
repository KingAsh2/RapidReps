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
"""

import pytest
import requests
import os
import time
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

TRAINER1_EMAIL = "trainer1@test.com"
TRAINER1_PASSWORD = "test123"
TRAINER1_ID = "697c077500b22ded1af35097"

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'rapidreps')

# Generate valid base64 selfie data (>100 chars)
VALID_SELFIE_DATA = "data:image/jpeg;base64," + "A" * 500
SHORT_SELFIE_DATA = "ABC"
LARGE_SELFIE_DATA = "data:image/jpeg;base64," + "A" * 7_500_000


# Module-level setup - login once and reuse tokens
@pytest.fixture(scope="module")
def mongo_db():
    """MongoDB database instance"""
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def auth_tokens():
    """Get all auth tokens once at module level to avoid rate limiting"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    tokens = {}
    
    # Login trainer
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINER1_EMAIL,
        "password": TRAINER1_PASSWORD
    })
    if resp.status_code == 200:
        tokens['trainer'] = resp.json().get('access_token')
    else:
        pytest.skip(f"Trainer login failed: {resp.status_code}")
    
    time.sleep(0.5)  # Small delay between logins
    
    # Login trainee1
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINEE1_EMAIL,
        "password": TRAINEE1_PASSWORD
    })
    if resp.status_code == 200:
        tokens['trainee'] = resp.json().get('access_token')
    else:
        pytest.skip(f"Trainee login failed: {resp.status_code}")
    
    time.sleep(0.5)
    
    # Login trainee2 (non-participant)
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINEE2_EMAIL,
        "password": TRAINEE2_PASSWORD
    })
    if resp.status_code == 200:
        tokens['non_participant'] = resp.json().get('access_token')
    else:
        pytest.skip(f"Trainee2 login failed: {resp.status_code}")
    
    return tokens


def create_test_session(mongo_db):
    """Create a fresh test session in MongoDB"""
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
    result = mongo_db.sessions.insert_one(session_doc)
    return str(result.inserted_id)


def cleanup_test_session(mongo_db, session_id):
    """Remove test session and related selfie records"""
    try:
        mongo_db.sessions.delete_one({'_id': ObjectId(session_id)})
        mongo_db.session_selfies.delete_many({'sessionId': session_id})
    except Exception:
        pass


# ============================================================================
# TEST: Trainer submits selfie
# ============================================================================
def test_trainer_submit_selfie_success(auth_tokens, mongo_db):
    """Test trainer can submit selfie successfully"""
    session_id = create_test_session(mongo_db)
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA},
            headers={"Authorization": f"Bearer {auth_tokens['trainer']}", "Content-Type": "application/json"}
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert data.get('success') == True
        assert data.get('role') == 'trainer'
        assert data.get('bothVerified') == False
        assert 'message' in data
        
        # Verify database records
        selfie_record = mongo_db.session_selfies.find_one({'sessionId': session_id, 'userId': TRAINER1_ID})
        assert selfie_record is not None
        assert selfie_record.get('role') == 'trainer'
        assert selfie_record.get('verified') == True
        
        session = mongo_db.sessions.find_one({'_id': ObjectId(session_id)})
        assert session.get('trainerSelfieVerified') == True
        
        print("✓ Trainer selfie submitted successfully")
    finally:
        cleanup_test_session(mongo_db, session_id)


# ============================================================================
# TEST: Trainee submits selfie - both verified
# ============================================================================
def test_trainee_submit_selfie_both_verified(auth_tokens, mongo_db):
    """Test trainee submits selfie after trainer - both verified"""
    session_id = create_test_session(mongo_db)
    
    try:
        # Trainer submits first
        requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA},
            headers={"Authorization": f"Bearer {auth_tokens['trainer']}", "Content-Type": "application/json"}
        )
        
        # Trainee submits
        resp = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA},
            headers={"Authorization": f"Bearer {auth_tokens['trainee']}", "Content-Type": "application/json"}
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        assert data.get('success') == True
        assert data.get('role') == 'trainee'
        assert data.get('bothVerified') == True
        
        # Verify session document
        session = mongo_db.sessions.find_one({'_id': ObjectId(session_id)})
        assert session.get('traineeSelfieVerified') == True
        assert session.get('selfieVerificationComplete') == True
        assert session.get('selfieVerifiedAt') is not None
        
        print("✓ Both parties verified - session can start")
    finally:
        cleanup_test_session(mongo_db, session_id)


# ============================================================================
# TEST: Reject short selfie data (<100 chars)
# ============================================================================
def test_reject_short_selfie_data(auth_tokens, mongo_db):
    """Test selfie data <100 chars is rejected"""
    session_id = create_test_session(mongo_db)
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/verify-selfie",
            json={"selfieBase64": SHORT_SELFIE_DATA},
            headers={"Authorization": f"Bearer {auth_tokens['trainer']}", "Content-Type": "application/json"}
        )
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        print("✓ Short selfie data correctly rejected")
    finally:
        cleanup_test_session(mongo_db, session_id)


# ============================================================================
# TEST: Reject large selfie data (>5MB)
# ============================================================================
def test_reject_large_selfie_data(auth_tokens, mongo_db):
    """Test selfie data >5MB is rejected"""
    session_id = create_test_session(mongo_db)
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/verify-selfie",
            json={"selfieBase64": LARGE_SELFIE_DATA},
            headers={"Authorization": f"Bearer {auth_tokens['trainer']}", "Content-Type": "application/json"}
        )
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        print("✓ Large selfie data correctly rejected")
    finally:
        cleanup_test_session(mongo_db, session_id)


# ============================================================================
# TEST: Reject empty selfie data
# ============================================================================
def test_reject_empty_selfie_data(auth_tokens, mongo_db):
    """Test empty selfie data is rejected"""
    session_id = create_test_session(mongo_db)
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/verify-selfie",
            json={"selfieBase64": ""},
            headers={"Authorization": f"Bearer {auth_tokens['trainer']}", "Content-Type": "application/json"}
        )
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        print("✓ Empty selfie data correctly rejected")
    finally:
        cleanup_test_session(mongo_db, session_id)


# ============================================================================
# TEST: Non-participant cannot submit selfie (403)
# ============================================================================
def test_non_participant_cannot_submit_selfie(auth_tokens, mongo_db):
    """Test non-participant gets 403"""
    session_id = create_test_session(mongo_db)
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA},
            headers={"Authorization": f"Bearer {auth_tokens['non_participant']}", "Content-Type": "application/json"}
        )
        
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print("✓ Non-participant correctly blocked (403)")
    finally:
        cleanup_test_session(mongo_db, session_id)


# ============================================================================
# TEST: Non-participant cannot view verification status (403)
# ============================================================================
def test_non_participant_cannot_view_status(auth_tokens, mongo_db):
    """Test non-participant gets 403 when checking status"""
    session_id = create_test_session(mongo_db)
    
    try:
        resp = requests.get(
            f"{BASE_URL}/api/sessions/{session_id}/verification-status",
            headers={"Authorization": f"Bearer {auth_tokens['non_participant']}"}
        )
        
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        print("✓ Non-participant cannot view status (403)")
    finally:
        cleanup_test_session(mongo_db, session_id)


# ============================================================================
# TEST: Initial verification status shows all false
# ============================================================================
def test_initial_verification_status(auth_tokens, mongo_db):
    """Test initial verification status shows all false"""
    session_id = create_test_session(mongo_db)
    
    try:
        resp = requests.get(
            f"{BASE_URL}/api/sessions/{session_id}/verification-status",
            headers={"Authorization": f"Bearer {auth_tokens['trainer']}"}
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        
        assert 'trainerVerified' in data
        assert 'traineeVerified' in data
        assert 'bothVerified' in data
        assert data.get('trainerVerified') == False
        assert data.get('traineeVerified') == False
        assert data.get('bothVerified') == False
        
        print("✓ Initial status shows all false")
    finally:
        cleanup_test_session(mongo_db, session_id)


# ============================================================================
# TEST: Verification status after trainer selfie
# ============================================================================
def test_verification_status_after_trainer_selfie(auth_tokens, mongo_db):
    """Test verification status shows trainer verified"""
    session_id = create_test_session(mongo_db)
    
    try:
        # Submit trainer selfie
        requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA},
            headers={"Authorization": f"Bearer {auth_tokens['trainer']}", "Content-Type": "application/json"}
        )
        
        # Check status
        resp = requests.get(
            f"{BASE_URL}/api/sessions/{session_id}/verification-status",
            headers={"Authorization": f"Bearer {auth_tokens['trainer']}"}
        )
        
        assert resp.status_code == 200
        data = resp.json()
        
        assert data.get('trainerVerified') == True
        assert data.get('traineeVerified') == False
        assert data.get('bothVerified') == False
        assert data.get('trainerSelfieAt') is not None
        
        print("✓ Status correctly shows trainer verified with timestamp")
    finally:
        cleanup_test_session(mongo_db, session_id)


# ============================================================================
# TEST: Verification status after both selfies
# ============================================================================
def test_verification_status_after_both_selfies(auth_tokens, mongo_db):
    """Test verification status shows both verified"""
    session_id = create_test_session(mongo_db)
    
    try:
        # Trainer submits
        requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA},
            headers={"Authorization": f"Bearer {auth_tokens['trainer']}", "Content-Type": "application/json"}
        )
        
        # Trainee submits
        requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA},
            headers={"Authorization": f"Bearer {auth_tokens['trainee']}", "Content-Type": "application/json"}
        )
        
        # Check status
        resp = requests.get(
            f"{BASE_URL}/api/sessions/{session_id}/verification-status",
            headers={"Authorization": f"Bearer {auth_tokens['trainer']}"}
        )
        
        assert resp.status_code == 200
        data = resp.json()
        
        assert data.get('trainerVerified') == True
        assert data.get('traineeVerified') == True
        assert data.get('bothVerified') == True
        assert data.get('trainerSelfieAt') is not None
        assert data.get('traineeSelfieAt') is not None
        
        print("✓ Status correctly shows both verified with timestamps")
    finally:
        cleanup_test_session(mongo_db, session_id)


# ============================================================================
# TEST: Invalid session ID format
# ============================================================================
def test_invalid_session_id_format(auth_tokens):
    """Test invalid session ID returns 400"""
    resp = requests.post(
        f"{BASE_URL}/api/sessions/invalid-format/verify-selfie",
        json={"selfieBase64": VALID_SELFIE_DATA},
        headers={"Authorization": f"Bearer {auth_tokens['trainer']}", "Content-Type": "application/json"}
    )
    
    assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
    print("✓ Invalid session ID format returns 400")


# ============================================================================
# TEST: Nonexistent session ID
# ============================================================================
def test_nonexistent_session_id(auth_tokens):
    """Test nonexistent session ID returns 404"""
    fake_id = str(ObjectId())
    
    resp = requests.post(
        f"{BASE_URL}/api/sessions/{fake_id}/verify-selfie",
        json={"selfieBase64": VALID_SELFIE_DATA},
        headers={"Authorization": f"Bearer {auth_tokens['trainer']}", "Content-Type": "application/json"}
    )
    
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
    print("✓ Nonexistent session ID returns 404")


# ============================================================================
# TEST: Trainee can view verification status
# ============================================================================
def test_trainee_can_view_status(auth_tokens, mongo_db):
    """Test trainee can also view verification status"""
    session_id = create_test_session(mongo_db)
    
    try:
        resp = requests.get(
            f"{BASE_URL}/api/sessions/{session_id}/verification-status",
            headers={"Authorization": f"Bearer {auth_tokens['trainee']}"}
        )
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        data = resp.json()
        
        assert 'trainerVerified' in data
        assert 'traineeVerified' in data
        assert 'bothVerified' in data
        
        print("✓ Trainee can view verification status")
    finally:
        cleanup_test_session(mongo_db, session_id)


# ============================================================================
# TEST: Selfie data stored correctly (truncated)
# ============================================================================
def test_selfie_stored_truncated(auth_tokens, mongo_db):
    """Test selfie data is truncated to first 200 chars + '...'"""
    session_id = create_test_session(mongo_db)
    
    try:
        requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA},
            headers={"Authorization": f"Bearer {auth_tokens['trainer']}", "Content-Type": "application/json"}
        )
        
        selfie_doc = mongo_db.session_selfies.find_one({'sessionId': session_id, 'userId': TRAINER1_ID})
        
        assert selfie_doc is not None
        stored_selfie = selfie_doc.get('selfieBase64', '')
        assert stored_selfie.endswith('...')
        assert len(stored_selfie) <= 210  # 200 + '...'
        
        print("✓ Selfie data correctly truncated for storage efficiency")
    finally:
        cleanup_test_session(mongo_db, session_id)


# ============================================================================
# TEST: Selfie resubmission updates record (upsert)
# ============================================================================
def test_selfie_resubmission(auth_tokens, mongo_db):
    """Test submitting selfie again updates existing record"""
    session_id = create_test_session(mongo_db)
    
    try:
        # First submission
        requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA},
            headers={"Authorization": f"Bearer {auth_tokens['trainer']}", "Content-Type": "application/json"}
        )
        
        # Count records
        count1 = mongo_db.session_selfies.count_documents({'sessionId': session_id, 'userId': TRAINER1_ID})
        
        # Second submission
        new_selfie = "data:image/jpeg;base64," + "B" * 500
        requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/verify-selfie",
            json={"selfieBase64": new_selfie},
            headers={"Authorization": f"Bearer {auth_tokens['trainer']}", "Content-Type": "application/json"}
        )
        
        # Count should still be 1 (upsert)
        count2 = mongo_db.session_selfies.count_documents({'sessionId': session_id, 'userId': TRAINER1_ID})
        
        assert count1 == 1
        assert count2 == 1  # Should not create duplicate
        
        print("✓ Selfie resubmission correctly updates existing record")
    finally:
        cleanup_test_session(mongo_db, session_id)


# ============================================================================
# TEST: Unauthenticated request blocked
# ============================================================================
def test_unauthenticated_blocked(mongo_db):
    """Test unauthenticated request gets 401/403"""
    session_id = create_test_session(mongo_db)
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/sessions/{session_id}/verify-selfie",
            json={"selfieBase64": VALID_SELFIE_DATA},
            headers={"Content-Type": "application/json"}  # No auth header
        )
        
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("✓ Unauthenticated request correctly blocked")
    finally:
        cleanup_test_session(mongo_db, session_id)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
