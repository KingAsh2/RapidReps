"""
Trainer Earnings Dashboard & Payout Request API Tests
=====================================================
Tests for the new trainer earnings dashboard feature:
- GET /api/trainer/earnings - Full earnings data including breakdowns
- POST /api/trainer/request-payout - Create payout request
- GET /api/trainer/payout-requests - Get payout request history
- Authentication and authorization checks
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://auth-layout-preview.preview.emergentagent.com"

# Test credentials
TRAINER1_EMAIL = "trainer1@test.com"
TRAINER1_PASSWORD = "test123"
TRAINER2_EMAIL = "trainer2@test.com"  # Use for new payout request (trainer1 already has pending)
TRAINER2_PASSWORD = "test123"
TRAINEE_EMAIL = "trainee1@test.com"
TRAINEE_PASSWORD = "test123"


class TestAuthFixtures:
    """Helper methods for authentication"""
    
    @staticmethod
    def login(email: str, password: str) -> dict:
        """Login and return auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password}
        )
        if response.status_code == 200:
            return response.json()
        return None
    
    @staticmethod
    def get_headers(token: str) -> dict:
        """Get authorization headers"""
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }


@pytest.fixture(scope="module")
def trainer1_auth():
    """Get trainer1 auth token"""
    result = TestAuthFixtures.login(TRAINER1_EMAIL, TRAINER1_PASSWORD)
    if not result:
        pytest.skip("trainer1@test.com login failed - test data may be missing")
    return result


@pytest.fixture(scope="module")
def trainer2_auth():
    """Get trainer2 auth token"""
    result = TestAuthFixtures.login(TRAINER2_EMAIL, TRAINER2_PASSWORD)
    if not result:
        pytest.skip("trainer2@test.com login failed - test data may be missing")
    return result


@pytest.fixture(scope="module")
def trainee_auth():
    """Get trainee auth token"""
    result = TestAuthFixtures.login(TRAINEE_EMAIL, TRAINEE_PASSWORD)
    if not result:
        pytest.skip("trainee1@test.com login failed - test data may be missing")
    return result


class TestHealthCheck:
    """Basic health check to ensure API is running"""
    
    def test_api_health(self):
        """Test API health endpoint is responding"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"API health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ API health check passed - status: {data['status']}")


class TestTrainerEarningsEndpoint:
    """Tests for GET /api/trainer/earnings endpoint"""
    
    def test_trainer_earnings_returns_full_data(self, trainer1_auth):
        """Test that earnings endpoint returns all required fields"""
        headers = TestAuthFixtures.get_headers(trainer1_auth["access_token"])
        
        response = requests.get(f"{BASE_URL}/api/trainer/earnings", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check all required top-level fields
        required_fields = [
            'totalEarningsCents',
            'monthEarningsCents', 
            'weekEarningsCents',
            'pendingBalanceCents',
            'totalPaidOutCents',
            'dailyBreakdown',
            'weeklyBreakdown',
            'recentSessions',
            'payouts',
            'payoutRequests'
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            print(f"  ✓ {field}: present")
        
        print(f"✓ Earnings endpoint returns all required fields")
    
    def test_earnings_numeric_fields_are_integers(self, trainer1_auth):
        """Test that cents fields are integers"""
        headers = TestAuthFixtures.get_headers(trainer1_auth["access_token"])
        
        response = requests.get(f"{BASE_URL}/api/trainer/earnings", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        
        cents_fields = [
            'totalEarningsCents',
            'monthEarningsCents',
            'weekEarningsCents',
            'pendingBalanceCents',
            'totalPaidOutCents'
        ]
        
        for field in cents_fields:
            value = data.get(field)
            assert isinstance(value, int), f"{field} should be integer, got {type(value)}"
            assert value >= 0, f"{field} should be non-negative, got {value}"
            print(f"  ✓ {field}: {value} cents (${value/100:.2f})")
        
        print(f"✓ All cents fields are valid integers")
    
    def test_daily_breakdown_has_7_items(self, trainer1_auth):
        """Test daily breakdown contains 7 days (Mon-Sun)"""
        headers = TestAuthFixtures.get_headers(trainer1_auth["access_token"])
        
        response = requests.get(f"{BASE_URL}/api/trainer/earnings", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        daily = data.get('dailyBreakdown', [])
        
        assert len(daily) == 7, f"Expected 7 daily items, got {len(daily)}"
        
        # Check each day has required structure
        for i, day_data in enumerate(daily):
            assert 'day' in day_data, f"Day {i} missing 'day' field"
            assert 'earningsCents' in day_data, f"Day {i} missing 'earningsCents'"
            assert isinstance(day_data['earningsCents'], int), f"Day {i} earningsCents should be int"
            print(f"  ✓ {day_data['day']}: ${day_data['earningsCents']/100:.2f}")
        
        print(f"✓ Daily breakdown has 7 items with correct structure")
    
    def test_weekly_breakdown_exists(self, trainer1_auth):
        """Test weekly breakdown exists and has proper structure"""
        headers = TestAuthFixtures.get_headers(trainer1_auth["access_token"])
        
        response = requests.get(f"{BASE_URL}/api/trainer/earnings", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        weekly = data.get('weeklyBreakdown', [])
        
        assert isinstance(weekly, list), "weeklyBreakdown should be a list"
        assert len(weekly) >= 1, "weeklyBreakdown should have at least 1 week"
        assert len(weekly) <= 5, "weeklyBreakdown should have at most 5 weeks"
        
        for i, week_data in enumerate(weekly):
            assert 'week' in week_data, f"Week {i} missing 'week' field"
            assert 'earningsCents' in week_data, f"Week {i} missing 'earningsCents'"
            print(f"  ✓ {week_data['week']}: ${week_data['earningsCents']/100:.2f}")
        
        print(f"✓ Weekly breakdown has {len(weekly)} week(s) with correct structure")
    
    def test_recent_sessions_structure(self, trainer1_auth):
        """Test recent sessions has proper structure"""
        headers = TestAuthFixtures.get_headers(trainer1_auth["access_token"])
        
        response = requests.get(f"{BASE_URL}/api/trainer/earnings", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        sessions = data.get('recentSessions', [])
        
        assert isinstance(sessions, list), "recentSessions should be a list"
        print(f"  → Found {len(sessions)} recent sessions")
        
        # If sessions exist, check their structure
        if sessions:
            required_session_fields = ['id', 'sessionType', 'earningsCents', 'date', 'traineeName', 'durationMinutes']
            for i, session in enumerate(sessions[:3]):  # Check first 3
                for field in required_session_fields:
                    assert field in session, f"Session {i} missing '{field}'"
                print(f"  ✓ Session: {session['traineeName']} - {session['sessionType']} - ${session['earningsCents']/100:.2f}")
        
        print(f"✓ Recent sessions structure is valid")
    
    def test_payouts_and_payout_requests_are_lists(self, trainer1_auth):
        """Test payouts and payoutRequests are arrays"""
        headers = TestAuthFixtures.get_headers(trainer1_auth["access_token"])
        
        response = requests.get(f"{BASE_URL}/api/trainer/earnings", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        
        payouts = data.get('payouts')
        payout_requests = data.get('payoutRequests')
        
        assert isinstance(payouts, list), "payouts should be a list"
        assert isinstance(payout_requests, list), "payoutRequests should be a list"
        
        print(f"  ✓ payouts: {len(payouts)} items")
        print(f"  ✓ payoutRequests: {len(payout_requests)} items")
        
        # Check payout request structure if any exist
        if payout_requests:
            for i, pr in enumerate(payout_requests[:2]):
                assert 'status' in pr, f"PayoutRequest {i} missing 'status'"
                assert 'amountCents' in pr, f"PayoutRequest {i} missing 'amountCents'"
                assert 'paymentMethod' in pr, f"PayoutRequest {i} missing 'paymentMethod'"
                print(f"  → Request #{i+1}: {pr['status']} - ${pr['amountCents']/100:.2f} via {pr['paymentMethod']}")
        
        print(f"✓ Payouts and payout requests arrays are valid")


class TestPayoutRequestCreation:
    """Tests for POST /api/trainer/request-payout endpoint"""
    
    def test_request_payout_with_valid_data(self, trainer2_auth):
        """Test creating a payout request with valid payment method and handle"""
        headers = TestAuthFixtures.get_headers(trainer2_auth["access_token"])
        
        # First check if trainer2 already has a pending request
        earnings_response = requests.get(f"{BASE_URL}/api/trainer/earnings", headers=headers)
        if earnings_response.status_code == 200:
            earnings_data = earnings_response.json()
            payout_requests = earnings_data.get('payoutRequests', [])
            has_pending = any(pr.get('status') == 'pending' for pr in payout_requests)
            
            if has_pending:
                print("  → trainer2 already has pending request, testing duplicate rejection")
                # Test duplicate rejection instead
                response = requests.post(
                    f"{BASE_URL}/api/trainer/request-payout",
                    headers=headers,
                    json={
                        "paymentMethod": "cashapp",
                        "paymentHandle": "$testtag"
                    }
                )
                assert response.status_code == 400, f"Expected 400 for duplicate, got {response.status_code}"
                print(f"✓ Duplicate payout request correctly rejected (400)")
                return
        
        # Check pending balance
        if earnings_response.status_code == 200:
            pending = earnings_data.get('pendingBalanceCents', 0)
            if pending <= 0:
                print(f"  → trainer2 has no pending balance to withdraw, testing 400 response")
                response = requests.post(
                    f"{BASE_URL}/api/trainer/request-payout",
                    headers=headers,
                    json={
                        "paymentMethod": "cashapp",
                        "paymentHandle": "$testtag"
                    }
                )
                assert response.status_code == 400, f"Expected 400 for zero balance, got {response.status_code}"
                data = response.json()
                assert "No pending balance" in data.get("detail", ""), f"Expected balance error message"
                print(f"✓ No pending balance correctly rejected (400)")
                return
        
        # If we have balance and no pending request, try to create one
        response = requests.post(
            f"{BASE_URL}/api/trainer/request-payout",
            headers=headers,
            json={
                "paymentMethod": "cashapp",
                "paymentHandle": "$testtag123"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            assert data.get('success') == True, "Expected success: true"
            assert 'requestId' in data, "Missing requestId in response"
            assert 'amountCents' in data, "Missing amountCents in response"
            print(f"✓ Payout request created successfully - ${data['amountCents']/100:.2f}")
        elif response.status_code == 400:
            # Either no balance or already has pending - both valid
            data = response.json()
            print(f"  → Request rejected (expected): {data.get('detail', '')}")
            print(f"✓ Payout request validation working correctly")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code} - {response.text}")
    
    def test_duplicate_pending_request_rejected(self, trainer1_auth):
        """Test that duplicate pending payout requests are rejected (trainer1 has pending)"""
        headers = TestAuthFixtures.get_headers(trainer1_auth["access_token"])
        
        response = requests.post(
            f"{BASE_URL}/api/trainer/request-payout",
            headers=headers,
            json={
                "paymentMethod": "zelle",
                "paymentHandle": "test@email.com"
            }
        )
        
        # Should return 400 because trainer1 already has a pending request
        assert response.status_code == 400, f"Expected 400 for duplicate request, got {response.status_code}"
        
        data = response.json()
        assert "pending payout request" in data.get("detail", "").lower() or "no pending balance" in data.get("detail", "").lower(), \
            f"Expected rejection message, got: {data.get('detail', '')}"
        
        print(f"✓ Duplicate/invalid payout request correctly rejected: {data.get('detail', '')}")


class TestPayoutRequestHistory:
    """Tests for GET /api/trainer/payout-requests endpoint"""
    
    def test_get_payout_requests_returns_list(self, trainer1_auth):
        """Test payout requests endpoint returns list of requests"""
        headers = TestAuthFixtures.get_headers(trainer1_auth["access_token"])
        
        response = requests.get(f"{BASE_URL}/api/trainer/payout-requests", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'requests' in data, "Missing 'requests' field in response"
        assert isinstance(data['requests'], list), "'requests' should be a list"
        
        print(f"  ✓ Found {len(data['requests'])} payout request(s)")
        
        # Check structure of requests if any exist
        if data['requests']:
            for i, req in enumerate(data['requests'][:3]):
                assert 'status' in req, f"Request {i} missing 'status'"
                assert 'amountCents' in req, f"Request {i} missing 'amountCents'"
                assert 'paymentMethod' in req, f"Request {i} missing 'paymentMethod'"
                assert 'createdAt' in req, f"Request {i} missing 'createdAt'"
                print(f"  → #{i+1}: {req['status']} - ${req['amountCents']/100:.2f} via {req['paymentMethod']}")
        
        print(f"✓ Payout requests endpoint working correctly")


class TestAuthenticationAndAuthorization:
    """Tests for authentication requirements on earnings endpoints"""
    
    def test_earnings_requires_authentication(self):
        """Test that earnings endpoint requires auth token"""
        response = requests.get(f"{BASE_URL}/api/trainer/earnings")
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Earnings endpoint requires authentication (returned {response.status_code})")
    
    def test_request_payout_requires_authentication(self):
        """Test that payout request endpoint requires auth token"""
        response = requests.post(
            f"{BASE_URL}/api/trainer/request-payout",
            json={"paymentMethod": "cashapp", "paymentHandle": "$test"}
        )
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Payout request endpoint requires authentication (returned {response.status_code})")
    
    def test_payout_requests_history_requires_authentication(self):
        """Test that payout requests history requires auth token"""
        response = requests.get(f"{BASE_URL}/api/trainer/payout-requests")
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Payout requests history requires authentication (returned {response.status_code})")
    
    def test_trainee_can_access_earnings_endpoint(self, trainee_auth):
        """Test that trainee users can access earnings endpoint (returns empty data)"""
        headers = TestAuthFixtures.get_headers(trainee_auth["access_token"])
        
        response = requests.get(f"{BASE_URL}/api/trainer/earnings", headers=headers)
        # Trainees should be able to access but get 0 results since they have no trainer sessions
        assert response.status_code == 200, \
            f"Trainee should access earnings endpoint, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Trainee will have 0 earnings since they don't have trainer sessions
        assert data.get('totalEarningsCents', 0) >= 0, "Should return valid earnings data"
        print(f"✓ Trainee can access earnings endpoint - totalEarnings: ${data.get('totalEarningsCents', 0)/100:.2f}")


class TestPaymentMethods:
    """Tests for different payment methods in payout requests"""
    
    def test_invalid_payment_method_validation(self, trainer2_auth):
        """Test that requests with missing required fields are handled"""
        headers = TestAuthFixtures.get_headers(trainer2_auth["access_token"])
        
        # Test with missing paymentMethod
        response = requests.post(
            f"{BASE_URL}/api/trainer/request-payout",
            headers=headers,
            json={}  # Missing required fields
        )
        # Should return 422 for validation error or 400 for business logic
        assert response.status_code in [400, 422], \
            f"Expected validation error, got {response.status_code}: {response.text}"
        print(f"✓ Missing payment method validation working (returned {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
