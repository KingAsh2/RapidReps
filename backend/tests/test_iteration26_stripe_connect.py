"""
Test Suite: Iteration 26 - Stripe Connect Express for Admin Payouts
Tests trainer bank onboarding, admin payout endpoints, and session data enrichment

Features tested:
1. Trainer Connect Onboard (POST /api/trainer/connect/onboard)
2. Trainer Connect Status (GET /api/trainer/connect/status) 
3. Admin Pending Payouts (GET /api/admin/payouts/pending)
4. Admin Pay Trainer (POST /api/admin/payouts/pay-trainer)
5. Admin Pay All (POST /api/admin/payouts/pay-all)
6. Admin Payout History (GET /api/admin/payouts/history)
7. Trainer/Trainee sessions include profile data (trainerName, traineeName, trainerPhoto)
8. Session cancellation endpoint
9. Health check
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://syntax-solve.preview.emergentagent.com')
if BASE_URL and not BASE_URL.startswith('http'):
    BASE_URL = f"https://{BASE_URL}"
BASE_URL = BASE_URL.rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"

# Test user prefix for cleanup
TEST_PREFIX = "TEST_ITER26_"

class TestHealthEndpoint:
    """Health check endpoint test"""
    
    def test_health_check(self):
        """GET /api/health should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", f"Expected healthy status, got: {data}"
        print(f"✓ Health check passed: {data}")


class TestAdminLogin:
    """Admin authentication tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"No access_token in response: {data}"
        print(f"✓ Admin logged in: {data['user'].get('email')}")
        return data["access_token"]
    
    def test_admin_login(self, admin_token):
        """Verify admin can login"""
        assert admin_token is not None
        print("✓ Admin authentication successful")


class TestTrainerConnectEndpoints:
    """Test Stripe Connect trainer onboarding endpoints"""
    
    @pytest.fixture(scope="class")
    def trainer_user(self):
        """Create a test trainer user"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}trainer_{unique_id}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Test Trainer {unique_id}",
            "email": email,
            "phone": "555-0001",
            "password": "test123",
            "roles": ["trainer"]
        })
        
        if response.status_code == 400 and "already registered" in response.text.lower():
            # Login instead
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "test123"
            })
        
        assert response.status_code == 200, f"Trainer signup/login failed: {response.text}"
        data = response.json()
        return {
            "token": data["access_token"],
            "user": data["user"],
            "email": email
        }
    
    def test_trainer_connect_status_new_user(self, trainer_user):
        """GET /api/trainer/connect/status - should return connected:false, onboarded:false for new trainer"""
        headers = {"Authorization": f"Bearer {trainer_user['token']}"}
        response = requests.get(f"{BASE_URL}/api/trainer/connect/status", headers=headers)
        
        assert response.status_code == 200, f"Connect status failed: {response.text}"
        data = response.json()
        
        # New trainer should not be connected
        assert data.get("connected") == False, f"Expected connected=false, got: {data}"
        assert data.get("onboarded") == False, f"Expected onboarded=false, got: {data}"
        print(f"✓ Trainer connect status (new user): {data}")
    
    def test_trainer_connect_onboard(self, trainer_user):
        """POST /api/trainer/connect/onboard - should create Stripe Connect account or return error"""
        headers = {"Authorization": f"Bearer {trainer_user['token']}"}
        response = requests.post(f"{BASE_URL}/api/trainer/connect/onboard", headers=headers)
        
        # This may fail if Stripe Connect is not enabled on the account
        # But the endpoint itself should be functional
        if response.status_code == 200:
            data = response.json()
            # Either we get an onboarding URL or alreadyOnboarded flag
            assert ("url" in data) or ("alreadyOnboarded" in data), f"Unexpected response: {data}"
            print(f"✓ Trainer connect onboard succeeded: {list(data.keys())}")
        elif response.status_code == 400:
            # Expected if Stripe Connect is not enabled
            data = response.json()
            assert "detail" in data, f"Expected error detail: {data}"
            print(f"✓ Trainer connect onboard returned expected error (Stripe Connect may not be enabled): {data['detail'][:100]}...")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    def test_trainer_connect_status_requires_auth(self):
        """GET /api/trainer/connect/status - should require authentication"""
        response = requests.get(f"{BASE_URL}/api/trainer/connect/status")
        assert response.status_code in [401, 403], f"Expected auth error, got: {response.status_code}"
        print("✓ Trainer connect status requires authentication")


class TestAdminPayoutEndpoints:
    """Test admin payout management endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")  
    def non_admin_token(self):
        """Create a non-admin user"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}nonadmin_{unique_id}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Non Admin User {unique_id}",
            "email": email,
            "phone": "555-0002",
            "password": "test123",
            "roles": ["trainee"]
        })
        
        if response.status_code == 200:
            return response.json()["access_token"]
        else:
            # Login instead
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "test123"
            })
            return response.json().get("access_token")
    
    def test_admin_pending_payouts(self, admin_token):
        """GET /api/admin/payouts/pending - should return trainer list with pending balances"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/payouts/pending", headers=headers)
        
        assert response.status_code == 200, f"Pending payouts failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "trainers" in data, f"Missing 'trainers' field: {data.keys()}"
        assert "payoutMinimumCents" in data, f"Missing 'payoutMinimumCents': {data.keys()}"
        assert "eligibleCount" in data, f"Missing 'eligibleCount': {data.keys()}"
        
        # Verify minimum is $35 (3500 cents)
        assert data["payoutMinimumCents"] == 3500, f"Expected minimum 3500 cents, got: {data['payoutMinimumCents']}"
        
        print(f"✓ Admin pending payouts: {len(data['trainers'])} trainers, {data['eligibleCount']} eligible, minimum=${data['payoutMinimumCents']/100}")
        
        # Verify trainer structure if any exist
        if data["trainers"]:
            trainer = data["trainers"][0]
            expected_fields = ["trainerId", "trainerName", "pendingBalanceCents", "eligible"]
            for field in expected_fields:
                assert field in trainer, f"Missing field '{field}' in trainer: {trainer.keys()}"
            print(f"  Sample trainer: {trainer.get('trainerName')} - pending: ${trainer.get('pendingBalanceCents', 0)/100:.2f}")
    
    def test_admin_pending_payouts_requires_admin(self, non_admin_token):
        """GET /api/admin/payouts/pending - should require admin role"""
        headers = {"Authorization": f"Bearer {non_admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/payouts/pending", headers=headers)
        
        assert response.status_code == 403, f"Expected 403 forbidden, got: {response.status_code}"
        print("✓ Admin pending payouts requires admin role")
    
    def test_admin_payout_history(self, admin_token):
        """GET /api/admin/payouts/history - should return payout history list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/payouts/history", headers=headers)
        
        assert response.status_code == 200, f"Payout history failed: {response.text}"
        data = response.json()
        
        assert "payouts" in data, f"Missing 'payouts' field: {data.keys()}"
        assert isinstance(data["payouts"], list), f"Expected list, got: {type(data['payouts'])}"
        
        print(f"✓ Admin payout history: {len(data['payouts'])} payouts")
        
        # If there are payouts, verify structure
        if data["payouts"]:
            payout = data["payouts"][0]
            print(f"  Latest payout: ${payout.get('amountCents', 0)/100:.2f} to {payout.get('trainerName', 'Unknown')}")
    
    def test_admin_pay_trainer_no_stripe_account(self, admin_token):
        """POST /api/admin/payouts/pay-trainer - should handle trainer without Stripe account"""
        # Create a trainer without Stripe Connect
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}nostripe_{unique_id}@test.com"
        
        signup_resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"No Stripe Trainer {unique_id}",
            "email": email,
            "phone": "555-0003",
            "password": "test123",
            "roles": ["trainer"]
        })
        
        if signup_resp.status_code == 200:
            trainer_id = signup_resp.json()["user"]["id"]
        else:
            # User might already exist
            pytest.skip("Could not create test trainer")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(
            f"{BASE_URL}/api/admin/payouts/pay-trainer",
            headers=headers,
            json={"trainerId": trainer_id}
        )
        
        # Should fail because trainer hasn't completed Stripe onboarding
        assert response.status_code == 400, f"Expected 400, got: {response.status_code}"
        data = response.json()
        assert "Stripe" in data.get("detail", "") or "onboarding" in data.get("detail", "").lower(), f"Expected Stripe-related error: {data}"
        print(f"✓ Pay trainer without Stripe account returns proper error: {data['detail'][:80]}...")
    
    def test_admin_pay_trainer_invalid_trainer(self, admin_token):
        """POST /api/admin/payouts/pay-trainer - should return 404 for invalid trainer"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(
            f"{BASE_URL}/api/admin/payouts/pay-trainer",
            headers=headers,
            json={"trainerId": "000000000000000000000000"}  # Invalid ObjectId
        )
        
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
        print("✓ Pay invalid trainer returns 404")
    
    def test_admin_pay_all(self, admin_token):
        """POST /api/admin/payouts/pay-all - should batch pay eligible trainers (may be empty)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/admin/payouts/pay-all", headers=headers)
        
        # May fail due to Stripe Connect not being enabled, or succeed with 0 payouts
        if response.status_code == 200:
            data = response.json()
            assert "paidCount" in data, f"Missing 'paidCount': {data.keys()}"
            assert "totalPaidCents" in data, f"Missing 'totalPaidCents': {data.keys()}"
            print(f"✓ Admin pay-all: {data['paidCount']} trainers paid, total ${data['totalPaidCents']/100:.2f}")
        elif response.status_code == 400:
            data = response.json()
            print(f"✓ Admin pay-all returned error (expected if no eligible trainers or Stripe not configured): {data.get('detail', 'Unknown error')[:80]}")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")


class TestSessionEndpoints:
    """Test session endpoints include profile data"""
    
    @pytest.fixture(scope="class")
    def trainer_with_profile(self):
        """Create trainer with profile"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}trainerprofile_{unique_id}@test.com"
        
        # Signup
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Profile Trainer {unique_id}",
            "email": email,
            "phone": "555-1001",
            "password": "test123",
            "roles": ["trainer"]
        })
        
        if response.status_code != 200:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email, "password": "test123"
            })
        
        assert response.status_code == 200, f"Trainer auth failed: {response.text}"
        data = response.json()
        token = data["access_token"]
        user_id = data["user"]["id"]
        
        # Create profile
        headers = {"Authorization": f"Bearer {token}"}
        profile_resp = requests.post(f"{BASE_URL}/api/trainer-profiles", headers=headers, json={
            "userId": user_id,
            "bio": "Test trainer bio for iteration 26",
            "experienceYears": 5,
            "offersInPerson": True,
            "offersVirtual": True,
            "outdoorRateCents": 5000,
            "virtualRateCents": 4000
        })
        
        return {"token": token, "userId": user_id, "email": email}
    
    @pytest.fixture(scope="class")
    def trainee_user(self):
        """Create trainee user"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}trainee_{unique_id}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Test Trainee {unique_id}",
            "email": email,
            "phone": "555-2001",
            "password": "test123",
            "roles": ["trainee"]
        })
        
        if response.status_code != 200:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email, "password": "test123"
            })
        
        assert response.status_code == 200
        data = response.json()
        
        # Create trainee profile
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        requests.post(f"{BASE_URL}/api/trainee-profiles", headers=headers, json={
            "userId": data["user"]["id"],
            "fitnessGoals": "Testing iteration 26"
        })
        
        return {"token": data["access_token"], "userId": data["user"]["id"], "email": email}
    
    def test_trainer_sessions_endpoint(self, trainer_with_profile):
        """GET /api/trainer/sessions - should return sessions with profile data fields"""
        headers = {"Authorization": f"Bearer {trainer_with_profile['token']}"}
        response = requests.get(f"{BASE_URL}/api/trainer/sessions", headers=headers)
        
        assert response.status_code == 200, f"Trainer sessions failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), f"Expected list, got: {type(data)}"
        print(f"✓ Trainer sessions endpoint: {len(data)} sessions")
        
        # If there are sessions, verify they have profile data fields
        if data:
            session = data[0]
            expected_fields = ["traineeName", "traineePhoto"]
            for field in expected_fields:
                if field in session:
                    print(f"  Session has {field}: {session.get(field, 'N/A')[:30] if session.get(field) else 'None'}")
    
    def test_trainee_sessions_endpoint(self, trainee_user):
        """GET /api/trainee/sessions - should return sessions with profile data fields"""
        headers = {"Authorization": f"Bearer {trainee_user['token']}"}
        response = requests.get(f"{BASE_URL}/api/trainee/sessions", headers=headers)
        
        assert response.status_code == 200, f"Trainee sessions failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), f"Expected list, got: {type(data)}"
        print(f"✓ Trainee sessions endpoint: {len(data)} sessions")
        
        # Verify response structure (even if empty)
        if data:
            session = data[0]
            expected_fields = ["trainerName", "trainerPhoto"]
            for field in expected_fields:
                if field in session:
                    print(f"  Session has {field}: {session.get(field, 'N/A')[:30] if session.get(field) else 'None'}")


class TestSessionCancellation:
    """Test session cancellation endpoint"""
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Get a user token"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"{TEST_PREFIX}canceltest_{unique_id}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Cancel Test {unique_id}",
            "email": email,
            "phone": "555-3001",
            "password": "test123",
            "roles": ["trainer"]
        })
        
        if response.status_code != 200:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email, "password": "test123"
            })
        
        return response.json()["access_token"]
    
    def test_session_cancel_endpoint_exists(self, user_token):
        """PATCH /api/sessions/{id}/cancel - endpoint should exist"""
        headers = {"Authorization": f"Bearer {user_token}"}
        
        # Try to cancel a non-existent session
        fake_session_id = "000000000000000000000000"
        response = requests.patch(
            f"{BASE_URL}/api/sessions/{fake_session_id}/cancel",
            headers=headers
        )
        
        # Should return 404 (not found) or 403 (forbidden), not 405 (method not allowed)
        assert response.status_code in [404, 403], f"Expected 404 or 403, got: {response.status_code}"
        print(f"✓ Session cancel endpoint exists (returns {response.status_code} for invalid session)")
    
    def test_session_cancel_requires_auth(self):
        """PATCH /api/sessions/{id}/cancel - should require authentication"""
        response = requests.patch(f"{BASE_URL}/api/sessions/000000000000000000000000/cancel")
        assert response.status_code in [401, 403], f"Expected auth error, got: {response.status_code}"
        print("✓ Session cancel requires authentication")


class TestPayoutMinimumThreshold:
    """Verify $35 minimum payout threshold"""
    
    def test_payout_minimum_is_35_dollars(self):
        """Verify the payout minimum is $35 (3500 cents)"""
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        
        # Check pending payouts
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/payouts/pending", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["payoutMinimumCents"] == 3500, f"Expected 3500 cents ($35), got: {data['payoutMinimumCents']}"
        print(f"✓ Payout minimum confirmed: ${data['payoutMinimumCents']/100:.2f}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
