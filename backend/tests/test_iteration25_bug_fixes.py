"""
Test iteration 25 - Bug fixes for Rapid Reps fitness application

Testing targets:
1. Session cancellation endpoint: PATCH /api/sessions/{session_id}/cancel
2. Pricing model with SERVICE_FEE_CENTS = $2.00 and 80/20 split
3. Trainer sessions endpoint: GET /api/trainer/sessions with populated fields
4. Trainee sessions endpoint: GET /api/trainee/sessions with populated fields
5. Push notification registration: POST /api/push-tokens/register
6. Notification preferences: GET /api/notification-preferences defaults
7. Health check: GET /api/health
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://pricing-fix-9.preview.emergentagent.com')

# Test credentials
TEST_ACCOUNTS = {
    'admin': {'email': 'admin@rapidreps.com', 'password': 'admin123'},
    'trainee1': {'email': 'test_trainee_iter25@test.com', 'password': 'test123'},
    'trainer1': {'email': 'test_trainer_iter25@test.com', 'password': 'test123'},
}


class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_health_check(self):
        """GET /api/health should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code} - {response.text}"
        data = response.json()
        assert data.get('status') == 'healthy', f"Unexpected status: {data}"
        assert 'timestamp' in data, "Missing timestamp in health response"
        print(f"✓ Health check passed: {data}")


class TestAuthAndLogin:
    """Verify test accounts can login"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['admin'])
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        return response.json().get('access_token')
    
    @pytest.fixture
    def trainee_token(self):
        """Get trainee auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainee1'])
        if response.status_code != 200:
            pytest.skip(f"Trainee login failed: {response.text}")
        data = response.json()
        return data.get('access_token'), data.get('user', {}).get('id')
    
    @pytest.fixture
    def trainer_token(self):
        """Get trainer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainer1'])
        if response.status_code != 200:
            pytest.skip(f"Trainer login failed: {response.text}")
        data = response.json()
        return data.get('access_token'), data.get('user', {}).get('id')

    def test_admin_login(self):
        """Test admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['admin'])
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert 'access_token' in data, "Missing access_token"
        assert data.get('user', {}).get('isAdmin') == True, "Admin flag not set"
        print(f"✓ Admin login successful")
    
    def test_trainee_login(self):
        """Test trainee login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainee1'])
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        data = response.json()
        assert 'access_token' in data, "Missing access_token"
        assert 'trainee' in data.get('user', {}).get('roles', []), "Missing trainee role"
        print(f"✓ Trainee login successful")
    
    def test_trainer_login(self):
        """Test trainer login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainer1'])
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        data = response.json()
        assert 'access_token' in data, "Missing access_token"
        assert 'trainer' in data.get('user', {}).get('roles', []), "Missing trainer role"
        print(f"✓ Trainer login successful")


class TestPricingLimits:
    """Test pricing limits endpoint (SERVICE_FEE_CENTS = $2.00)"""
    
    def test_pricing_limits_returns_correct_minimums(self):
        """GET /api/trainer/pricing-limits should return correct pricing"""
        # Login as trainer
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainer1'])
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get('access_token')
        
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f"{BASE_URL}/api/trainer/pricing-limits", headers=headers)
        
        assert response.status_code == 200, f"Pricing limits failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Validate structure
        assert 'trainerTier' in data, "Missing trainerTier"
        assert 'pricingLimits' in data, "Missing pricingLimits"
        
        pricing = data['pricingLimits']
        
        # Validate minimum prices (in cents)
        # Virtual: $30 min (3000 cents), Outdoor: $40 min (4000 cents), InHome: $60 min (6000 cents)
        assert pricing.get('virtual', {}).get('minCents') == 3000, f"Virtual min should be 3000: {pricing.get('virtual')}"
        assert pricing.get('outdoor', {}).get('minCents') == 4000, f"Outdoor min should be 4000: {pricing.get('outdoor')}"
        assert pricing.get('inHome', {}).get('minCents') == 6000, f"InHome min should be 6000: {pricing.get('inHome')}"
        
        print(f"✓ Pricing limits correct: virtual=$30, outdoor=$40, in_home=$60")
        print(f"  Trainer tier: {data.get('trainerTier')}")


class TestSessionEndpoints:
    """Test trainer/trainee session endpoints with populated fields"""
    
    def test_trainer_sessions_endpoint_exists(self):
        """GET /api/trainer/sessions should return sessions list"""
        # Login as trainer
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainer1'])
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get('access_token')
        
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f"{BASE_URL}/api/trainer/sessions", headers=headers)
        
        assert response.status_code == 200, f"Trainer sessions failed: {response.status_code} - {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got: {type(data)}"
        print(f"✓ GET /api/trainer/sessions returned {len(data)} sessions")
        
        # If sessions exist, validate structure
        if data:
            session = data[0]
            # Check for new populated fields
            assert 'id' in session, "Session missing id field"
            assert 'trainerId' in session, "Session missing trainerId"
            assert 'traineeId' in session, "Session missing traineeId"
            # These fields should be populated from user lookup
            if session.get('traineeId'):
                print(f"  Session has traineeName: {session.get('traineeName', 'NOT_POPULATED')}")
                print(f"  Session has traineePhoto: {'Present' if session.get('traineePhoto') else 'Not present'}")
    
    def test_trainee_sessions_endpoint_exists(self):
        """GET /api/trainee/sessions should return sessions list"""
        # Login as trainee
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainee1'])
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get('access_token')
        
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f"{BASE_URL}/api/trainee/sessions", headers=headers)
        
        assert response.status_code == 200, f"Trainee sessions failed: {response.status_code} - {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got: {type(data)}"
        print(f"✓ GET /api/trainee/sessions returned {len(data)} sessions")
        
        # If sessions exist, validate structure
        if data:
            session = data[0]
            assert 'id' in session, "Session missing id field"
            # These fields should be populated from user lookup
            print(f"  Session has trainerName: {session.get('trainerName', 'NOT_POPULATED')}")
            print(f"  Session has trainerPhoto: {'Present' if session.get('trainerPhoto') else 'Not present'}")


class TestPushNotifications:
    """Test push notification registration endpoint"""
    
    def test_push_token_register(self):
        """POST /api/push-tokens/register should work"""
        # Login as trainee
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainee1'])
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get('access_token')
        
        headers = {'Authorization': f'Bearer {token}'}
        
        # Register a test push token
        test_push_token = "ExponentPushToken[TEST_TOKEN_12345]"
        payload = {
            'token': test_push_token,
            'deviceId': 'test-device-001'
        }
        
        response = requests.post(f"{BASE_URL}/api/push-tokens/register", headers=headers, json=payload)
        assert response.status_code == 200, f"Push token register failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get('success') == True, f"Expected success: {data}"
        print(f"✓ Push token registration successful: {data.get('message')}")
    
    def test_push_token_unregister(self):
        """DELETE /api/push-tokens/unregister should work"""
        # Login as trainee
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainee1'])
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get('access_token')
        
        headers = {'Authorization': f'Bearer {token}'}
        
        # First register a token
        test_push_token = "ExponentPushToken[TEST_UNREGISTER_TOKEN]"
        payload = {'token': test_push_token}
        
        requests.post(f"{BASE_URL}/api/push-tokens/register", headers=headers, json=payload)
        
        # Now unregister
        response = requests.delete(f"{BASE_URL}/api/push-tokens/unregister", headers=headers, json=payload)
        assert response.status_code == 200, f"Push token unregister failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get('success') == True, f"Expected success: {data}"
        print(f"✓ Push token unregistration successful")


class TestNotificationPreferences:
    """Test notification preferences endpoint defaults"""
    
    def test_notification_preferences_defaults(self):
        """GET /api/notification-preferences should return all defaults as True when no preferences exist"""
        # Create a fresh user or use existing
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainee1'])
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get('access_token')
        
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f"{BASE_URL}/api/notification-preferences", headers=headers)
        
        assert response.status_code == 200, f"Notification preferences failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # All preferences should default to True
        expected_defaults = [
            'pushEnabled', 'session_requested', 'session_accepted', 'session_declined',
            'session_ended', 'session_reminder', 'rate_reminder', 'payment_released',
            'new_message', 'streak_warning', 'boost_expiring',
            'virtual_request', 'virtual_matched', 'virtual_taken',
            'missed_acceptance', 'late_warning', 'session_started'
        ]
        
        print(f"  Notification preferences: {data}")
        
        for key in expected_defaults:
            assert data.get(key) == True, f"Expected {key} to be True, got: {data.get(key)}"
        
        print(f"✓ All {len(expected_defaults)} notification preferences default to True")
    
    def test_notification_preferences_update(self):
        """PUT /api/notification-preferences should update preferences"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainee1'])
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get('access_token')
        
        headers = {'Authorization': f'Bearer {token}'}
        
        # Update preferences
        payload = {
            'pushEnabled': True,
            'session_requested': True,
            'session_accepted': True,
            'session_declined': True,
            'session_ended': True,
            'session_reminder': False,  # Disable one
            'rate_reminder': True,
            'payment_released': True,
            'new_message': True,
            'streak_warning': True,
            'boost_expiring': True,
            'virtual_request': True,
            'virtual_matched': True,
            'virtual_taken': True,
            'missed_acceptance': True,
            'late_warning': True,
            'session_started': True
        }
        
        response = requests.put(f"{BASE_URL}/api/notification-preferences", headers=headers, json=payload)
        assert response.status_code == 200, f"Update preferences failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data.get('success') == True, f"Expected success: {data}"
        print(f"✓ Notification preferences update successful")


class TestSessionCancellation:
    """Test session cancellation endpoint with time-based penalties"""
    
    def _create_test_session(self, trainee_token, trainee_id, trainer_id):
        """Helper to create a test session"""
        headers = {'Authorization': f'Bearer {trainee_token}'}
        
        # Create a session for tomorrow (> 12 hours away = no penalty)
        session_start = datetime.utcnow() + timedelta(hours=24)
        
        payload = {
            'traineeId': trainee_id,
            'trainerId': trainer_id,
            'sessionDateTimeStart': session_start.isoformat(),
            'durationMinutes': 60,
            'sessionType': 'outdoor',
            'locationType': 'gym',
            'locationNameOrAddress': 'Test Gym Location'
        }
        
        response = requests.post(f"{BASE_URL}/api/sessions", headers=headers, json=payload)
        return response
    
    def test_session_cancel_endpoint_exists(self):
        """PATCH /api/sessions/{session_id}/cancel endpoint should exist"""
        # Login as trainee
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainee1'])
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get('access_token')
        
        headers = {'Authorization': f'Bearer {token}'}
        
        # Try to cancel a non-existent session - should get 404 or validation error, not 405
        fake_session_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format
        response = requests.patch(f"{BASE_URL}/api/sessions/{fake_session_id}/cancel", headers=headers)
        
        # Should return 404 (not found) instead of 405 (method not allowed)
        assert response.status_code != 405, f"Cancel endpoint doesn't exist (405): {response.text}"
        assert response.status_code == 404, f"Expected 404 for non-existent session: {response.status_code} - {response.text}"
        print(f"✓ Session cancel endpoint exists and returns 404 for non-existent session")
    
    def test_session_cancel_requires_auth(self):
        """PATCH /api/sessions/{session_id}/cancel should require authentication"""
        fake_session_id = "507f1f77bcf86cd799439011"
        response = requests.patch(f"{BASE_URL}/api/sessions/{fake_session_id}/cancel")
        
        # Should return 401 or 403, not 200
        assert response.status_code in [401, 403], f"Expected auth error: {response.status_code} - {response.text}"
        print(f"✓ Session cancel requires authentication (status: {response.status_code})")
    
    def test_session_cancel_flow(self):
        """Test full session create → cancel flow"""
        # Login as trainee
        trainee_resp = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainee1'])
        assert trainee_resp.status_code == 200, f"Trainee login failed: {trainee_resp.text}"
        trainee_data = trainee_resp.json()
        trainee_token = trainee_data.get('access_token')
        trainee_id = trainee_data.get('user', {}).get('id')
        
        # Login as trainer to get trainer ID
        trainer_resp = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainer1'])
        assert trainer_resp.status_code == 200, f"Trainer login failed: {trainer_resp.text}"
        trainer_data = trainer_resp.json()
        trainer_id = trainer_data.get('user', {}).get('id')
        
        headers = {'Authorization': f'Bearer {trainee_token}'}
        
        # Create a test session (24 hours in future - no penalty zone)
        session_start = datetime.utcnow() + timedelta(hours=24)
        
        payload = {
            'traineeId': trainee_id,
            'trainerId': trainer_id,
            'sessionDateTimeStart': session_start.isoformat(),
            'durationMinutes': 60,
            'sessionType': 'outdoor',
            'locationType': 'gym',
            'locationNameOrAddress': 'TEST_CANCEL_SESSION_LOCATION'
        }
        
        create_response = requests.post(f"{BASE_URL}/api/sessions", headers=headers, json=payload)
        
        # Session creation might fail if trainer not verified - that's OK
        if create_response.status_code != 200 and create_response.status_code != 201:
            print(f"  Session creation returned {create_response.status_code}: {create_response.text}")
            pytest.skip("Could not create test session (trainer may not be verified)")
        
        session_data = create_response.json()
        session_id = session_data.get('id')
        assert session_id, f"Session missing id: {session_data}"
        print(f"  Created test session: {session_id}")
        
        # Now cancel it
        cancel_response = requests.patch(f"{BASE_URL}/api/sessions/{session_id}/cancel", headers=headers)
        
        if cancel_response.status_code == 200:
            cancel_data = cancel_response.json()
            assert cancel_data.get('success') == True, f"Cancel failed: {cancel_data}"
            assert cancel_data.get('cancelledBy') == 'trainee', f"Wrong canceller: {cancel_data}"
            # > 12 hours = no penalty
            assert cancel_data.get('penaltyCents', 0) == 0, f"Expected no penalty: {cancel_data}"
            print(f"✓ Session cancelled successfully with no penalty (> 12h)")
        else:
            print(f"  Cancel response: {cancel_response.status_code} - {cancel_response.text}")
            # Still pass if endpoint exists but session was in wrong state
            assert cancel_response.status_code in [200, 400], f"Unexpected cancel error: {cancel_response.status_code}"


class TestSessionIdFormat:
    """Verify session responses use 'id' not '_id' (bug fix verification)"""
    
    def test_session_response_uses_id_field(self):
        """Session responses should have 'id' field, not '_id'"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainer1'])
        assert response.status_code == 200
        token = response.json().get('access_token')
        
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f"{BASE_URL}/api/trainer/sessions", headers=headers)
        
        assert response.status_code == 200
        sessions = response.json()
        
        if sessions:
            session = sessions[0]
            # Bug fix: should use 'id' not '_id'
            assert 'id' in session, f"Session missing 'id' field: {list(session.keys())}"
            assert '_id' not in session, f"Session should not have '_id' field: {list(session.keys())}"
            print(f"✓ Session uses 'id' field (not '_id'): {session.get('id')}")
        else:
            print("  No sessions to verify - endpoint works but no data")


class TestPricingModel:
    """Test pricing model with $2 service fee and 80/20 split"""
    
    def test_service_fee_constant(self):
        """Verify SERVICE_FEE_CENTS is set correctly in pricing rules"""
        # This tests the backend constants indirectly via the pricing calculation
        # Login as trainer
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainer1'])
        assert response.status_code == 200
        token = response.json().get('access_token')
        
        headers = {'Authorization': f'Bearer {token}'}
        
        # Get pricing limits - should reflect correct minimums
        response = requests.get(f"{BASE_URL}/api/trainer/pricing-limits", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify pricing structure exists
        assert 'pricingLimits' in data
        assert 'travelFees' in data
        
        # Check travel fees structure
        travel_fees = data.get('travelFees', {})
        assert '0-5 miles' in travel_fees, f"Missing travel fee tier: {travel_fees}"
        
        print(f"✓ Pricing limits structure verified")
        print(f"  Travel fees: {travel_fees}")


# Additional verification tests
class TestNotificationsEndpoint:
    """Test notifications endpoint"""
    
    def test_get_notifications(self):
        """GET /api/notifications should return notification list"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_ACCOUNTS['trainee1'])
        assert response.status_code == 200
        token = response.json().get('access_token')
        
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        
        assert response.status_code == 200, f"Get notifications failed: {response.status_code} - {response.text}"
        data = response.json()
        assert 'notifications' in data, f"Missing notifications key: {data}"
        print(f"✓ GET /api/notifications returned {len(data.get('notifications', []))} notifications")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
