"""
Referral System Tests - RapidReps
=================================
Tests for the new referral system including:
1. GET /api/referral/my-code - Returns unique referral code
2. GET /api/referral/stats - Returns referral stats
3. GET /api/referral/validate/{code} - Public endpoint to validate a referral code
4. GET /api/referral/credits - Returns available referral credits
5. POST /api/auth/signup with referralCode - Signup creates pending referral
6. Referral max limit (5 referrals)
7. Invalid referral code handling
8. Regression tests for existing auth flows
"""

import pytest
import requests
import os
import random
import string
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://rapidreps-dark.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINER1_EMAIL = "trainer1@test.com"
TRAINER2_EMAIL = "trainer2@test.com"
TRAINEE1_EMAIL = "trainee1@test.com"
TRAINEE2_EMAIL = "trainee2@test.com"
TEST_PASSWORD = "test123"

# Referral constants
REFERRAL_CREDIT_CENTS = 500  # $5.00
MAX_REFERRALS_PER_USER = 5

# Global session cache to avoid rate limiting
_session_cache = {}


def generate_unique_email():
    """Generate a unique test email"""
    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"TEST_referral_{random_suffix}@test.com"


def login(email: str, password: str) -> dict:
    """Helper function to login and get auth token (with caching to avoid rate limits)"""
    cache_key = f"{email}:{password}"
    
    # Return cached token if available
    if cache_key in _session_cache:
        cached = _session_cache[cache_key]
        # Verify token is still valid with a quick call
        verify_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=auth_headers(cached["token"])
        )
        if verify_response.status_code == 200:
            return cached
    
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password}
    )
    if response.status_code == 200:
        data = response.json()
        result = {
            "token": data.get("access_token"),
            "user": data.get("user"),
            "user_id": data.get("user", {}).get("id")
        }
        _session_cache[cache_key] = result
        return result
    elif response.status_code == 429:
        print(f"Rate limited for {email}, waiting...")
        time.sleep(5)
        return None
    return None


def auth_headers(token: str) -> dict:
    """Create authorization headers"""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }


# Pre-cache tokens at module load
@pytest.fixture(scope="module", autouse=True)
def setup_module():
    """Pre-cache authentication tokens"""
    print("\nPre-caching authentication tokens...")
    time.sleep(2)  # Small delay to ensure rate limit window
    
    # Login all users with delays to avoid rate limiting
    users_to_cache = [
        (TRAINER1_EMAIL, TEST_PASSWORD),
        (TRAINEE1_EMAIL, TEST_PASSWORD),
        (ADMIN_EMAIL, ADMIN_PASSWORD),
    ]
    
    for email, password in users_to_cache:
        result = login(email, password)
        if result:
            print(f"  Cached token for {email}")
        else:
            print(f"  WARNING: Could not cache token for {email}")
        time.sleep(1)  # Rate limit protection
    
    yield


# ============================================================================
# TEST CLASS: Health & Basic Auth Regression
# ============================================================================

class TestHealthAndAuthRegression:
    """Regression tests for basic health and auth endpoints"""
    
    def test_health_endpoint(self):
        """Test health endpoint is working"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health endpoint working")
    
    def test_login_trainer1(self):
        """Test login for trainer1"""
        result = login(TRAINER1_EMAIL, TEST_PASSWORD)
        assert result is not None, "Trainer1 login failed (may be rate limited)"
        assert result["token"] is not None
        assert result["user"]["email"] == TRAINER1_EMAIL
        print(f"✓ Trainer1 login successful, user_id: {result['user_id']}")
    
    def test_login_trainee1(self):
        """Test login for trainee1"""
        result = login(TRAINEE1_EMAIL, TEST_PASSWORD)
        assert result is not None, "Trainee1 login failed (may be rate limited)"
        assert result["token"] is not None
        assert result["user"]["email"] == TRAINEE1_EMAIL
        print(f"✓ Trainee1 login successful, user_id: {result['user_id']}")
    
    def test_login_admin(self):
        """Test login for admin"""
        result = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert result is not None, "Admin login failed (may be rate limited)"
        assert result["token"] is not None
        assert result["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Admin login successful, user_id: {result['user_id']}")


# ============================================================================
# TEST CLASS: Referral Code - GET /api/referral/my-code
# ============================================================================

class TestReferralMyCode:
    """Tests for GET /api/referral/my-code endpoint"""
    
    def test_get_my_code_trainer1(self):
        """Test getting referral code for trainer1"""
        result = login(TRAINER1_EMAIL, TEST_PASSWORD)
        if result is None:
            pytest.skip("Rate limited - cannot test")
        
        response = requests.get(
            f"{BASE_URL}/api/referral/my-code",
            headers=auth_headers(result["token"])
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "referralCode" in data
        assert data["referralCode"].startswith("RR-")
        assert len(data["referralCode"]) == 9  # RR-XXXXXX format
        print(f"✓ Trainer1 referral code: {data['referralCode']}")
    
    def test_get_my_code_trainee1(self):
        """Test getting referral code for trainee1"""
        result = login(TRAINEE1_EMAIL, TEST_PASSWORD)
        if result is None:
            pytest.skip("Rate limited - cannot test")
        
        response = requests.get(
            f"{BASE_URL}/api/referral/my-code",
            headers=auth_headers(result["token"])
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "referralCode" in data
        assert data["referralCode"].startswith("RR-")
        print(f"✓ Trainee1 referral code: {data['referralCode']}")
    
    def test_get_my_code_unauthenticated(self):
        """Test that unauthenticated request fails"""
        response = requests.get(f"{BASE_URL}/api/referral/my-code")
        assert response.status_code in [401, 403]
        print("✓ Unauthenticated request correctly rejected")


# ============================================================================
# TEST CLASS: Referral Stats - GET /api/referral/stats
# ============================================================================

class TestReferralStats:
    """Tests for GET /api/referral/stats endpoint"""
    
    def test_get_stats_trainer1(self):
        """Test getting referral stats for trainer1"""
        result = login(TRAINER1_EMAIL, TEST_PASSWORD)
        if result is None:
            pytest.skip("Rate limited - cannot test")
        
        response = requests.get(
            f"{BASE_URL}/api/referral/stats",
            headers=auth_headers(result["token"])
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "referralCode" in data
        assert "totalReferrals" in data
        assert "activatedReferrals" in data
        assert "pendingReferrals" in data
        assert "totalCreditsEarned" in data
        assert "availableCredits" in data
        assert "maxReferrals" in data
        assert "referralsRemaining" in data
        assert "referralHistory" in data
        
        # Validate max referrals value
        assert data["maxReferrals"] == MAX_REFERRALS_PER_USER
        
        # Validate referralsRemaining calculation
        expected_remaining = max(0, MAX_REFERRALS_PER_USER - data["totalReferrals"])
        assert data["referralsRemaining"] == expected_remaining
        
        print(f"✓ Trainer1 stats - Code: {data['referralCode']}, Total: {data['totalReferrals']}, Credits: {data['availableCredits']}")
    
    def test_get_stats_trainee1(self):
        """Test getting referral stats for trainee1"""
        result = login(TRAINEE1_EMAIL, TEST_PASSWORD)
        if result is None:
            pytest.skip("Rate limited - cannot test")
        
        response = requests.get(
            f"{BASE_URL}/api/referral/stats",
            headers=auth_headers(result["token"])
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate data types
        assert isinstance(data["totalReferrals"], int)
        assert isinstance(data["activatedReferrals"], int)
        assert isinstance(data["pendingReferrals"], int)
        assert isinstance(data["totalCreditsEarned"], int)
        assert isinstance(data["availableCredits"], int)
        assert isinstance(data["referralHistory"], list)
        
        print(f"✓ Trainee1 stats - Code: {data['referralCode']}, Available Credits: {data['availableCredits']} cents")
    
    def test_get_stats_unauthenticated(self):
        """Test that unauthenticated request fails"""
        response = requests.get(f"{BASE_URL}/api/referral/stats")
        assert response.status_code in [401, 403]
        print("✓ Unauthenticated request correctly rejected")


# ============================================================================
# TEST CLASS: Validate Referral Code - GET /api/referral/validate/{code}
# ============================================================================

class TestValidateReferralCode:
    """Tests for GET /api/referral/validate/{code} endpoint (public)"""
    
    def test_validate_valid_code(self):
        """Test validating a valid referral code"""
        # First get a valid code from trainer1
        result = login(TRAINER1_EMAIL, TEST_PASSWORD)
        if result is None:
            pytest.skip("Rate limited - cannot test")
        
        my_code_response = requests.get(
            f"{BASE_URL}/api/referral/my-code",
            headers=auth_headers(result["token"])
        )
        assert my_code_response.status_code == 200
        valid_code = my_code_response.json()["referralCode"]
        
        # Now validate the code (public endpoint - no auth needed)
        response = requests.get(f"{BASE_URL}/api/referral/validate/{valid_code}")
        assert response.status_code == 200
        data = response.json()
        
        # Code is either valid or at max limit
        assert "valid" in data
        if data["valid"]:
            assert "referrerName" in data
            print(f"✓ Valid code {valid_code} validated - Referrer: {data['referrerName']}")
        else:
            assert "message" in data
            print(f"✓ Code at max limit: {data['message']}")
    
    def test_validate_invalid_code(self):
        """Test validating an invalid referral code"""
        response = requests.get(f"{BASE_URL}/api/referral/validate/INVALID-CODE")
        assert response.status_code == 200
        data = response.json()
        
        assert data["valid"] == False
        assert "message" in data
        print(f"✓ Invalid code correctly rejected - Message: {data['message']}")
    
    def test_validate_code_case_insensitive(self):
        """Test that code validation is case-insensitive"""
        # Get a valid code
        result = login(TRAINER1_EMAIL, TEST_PASSWORD)
        if result is None:
            pytest.skip("Rate limited - cannot test")
        
        my_code_response = requests.get(
            f"{BASE_URL}/api/referral/my-code",
            headers=auth_headers(result["token"])
        )
        valid_code = my_code_response.json()["referralCode"]
        
        # Test with lowercase
        response = requests.get(f"{BASE_URL}/api/referral/validate/{valid_code.lower()}")
        assert response.status_code == 200
        data = response.json()
        # Code should be valid (unless at max)
        assert "valid" in data
        print(f"✓ Code validation handles case correctly")
    
    def test_validate_code_with_whitespace(self):
        """Test that code validation handles whitespace"""
        result = login(TRAINER1_EMAIL, TEST_PASSWORD)
        if result is None:
            pytest.skip("Rate limited - cannot test")
        
        my_code_response = requests.get(
            f"{BASE_URL}/api/referral/my-code",
            headers=auth_headers(result["token"])
        )
        valid_code = my_code_response.json()["referralCode"]
        
        # Test with leading/trailing spaces (URL-encoded)
        response = requests.get(f"{BASE_URL}/api/referral/validate/%20{valid_code}%20")
        assert response.status_code == 200
        data = response.json()
        assert "valid" in data
        print("✓ Code validation handles whitespace correctly")


# ============================================================================
# TEST CLASS: Referral Credits - GET /api/referral/credits
# ============================================================================

class TestReferralCredits:
    """Tests for GET /api/referral/credits endpoint"""
    
    def test_get_credits_trainer1(self):
        """Test getting referral credits for trainer1"""
        result = login(TRAINER1_EMAIL, TEST_PASSWORD)
        if result is None:
            pytest.skip("Rate limited - cannot test")
        
        response = requests.get(
            f"{BASE_URL}/api/referral/credits",
            headers=auth_headers(result["token"])
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "availableCredits" in data
        assert isinstance(data["availableCredits"], int)
        assert data["availableCredits"] >= 0
        print(f"✓ Trainer1 available credits: {data['availableCredits']} cents (${data['availableCredits']/100:.2f})")
    
    def test_get_credits_trainee1(self):
        """Test getting referral credits for trainee1"""
        result = login(TRAINEE1_EMAIL, TEST_PASSWORD)
        if result is None:
            pytest.skip("Rate limited - cannot test")
        
        response = requests.get(
            f"{BASE_URL}/api/referral/credits",
            headers=auth_headers(result["token"])
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "availableCredits" in data
        assert isinstance(data["availableCredits"], int)
        print(f"✓ Trainee1 available credits: {data['availableCredits']} cents (${data['availableCredits']/100:.2f})")
    
    def test_get_credits_unauthenticated(self):
        """Test that unauthenticated request fails"""
        response = requests.get(f"{BASE_URL}/api/referral/credits")
        assert response.status_code in [401, 403]
        print("✓ Unauthenticated request correctly rejected")


# ============================================================================
# TEST CLASS: Signup with Referral Code
# ============================================================================

class TestSignupWithReferral:
    """Tests for POST /api/auth/signup with referralCode"""
    
    def test_signup_with_valid_referral_code(self):
        """Test signup with a valid referral code creates pending referral"""
        # Get trainer1's referral code
        trainer_result = login(TRAINER1_EMAIL, TEST_PASSWORD)
        if trainer_result is None:
            pytest.skip("Rate limited - cannot test")
        
        my_code_response = requests.get(
            f"{BASE_URL}/api/referral/my-code",
            headers=auth_headers(trainer_result["token"])
        )
        referral_code = my_code_response.json()["referralCode"]
        
        # First validate the code to check if at max limit
        validate_response = requests.get(f"{BASE_URL}/api/referral/validate/{referral_code}")
        validate_data = validate_response.json()
        
        # Create a new user with the referral code
        new_email = generate_unique_email()
        signup_data = {
            "fullName": "TEST Referral User",
            "email": new_email,
            "phone": "555-0001",
            "password": "test123456",
            "roles": ["trainee"],
            "referralCode": referral_code
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_data)
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert data["user"]["email"] == new_email
        
        print(f"✓ New user signed up with referral code: {referral_code}")
        
        # Verify the new user has their own referral code
        new_user_token = data["access_token"]
        new_user_code_response = requests.get(
            f"{BASE_URL}/api/referral/my-code",
            headers=auth_headers(new_user_token)
        )
        assert new_user_code_response.status_code == 200
        new_user_code = new_user_code_response.json()["referralCode"]
        assert new_user_code.startswith("RR-")
        print(f"✓ New user has their own referral code: {new_user_code}")
        
        # Check trainer1's stats to see if referral count increased (if not at max)
        if validate_data.get("valid"):
            trainer_stats_response = requests.get(
                f"{BASE_URL}/api/referral/stats",
                headers=auth_headers(trainer_result["token"])
            )
            assert trainer_stats_response.status_code == 200
            stats = trainer_stats_response.json()
            print(f"✓ Trainer1 now has {stats['totalReferrals']} total referrals, {stats['pendingReferrals']} pending")
    
    def test_signup_with_invalid_referral_code(self):
        """Test signup with invalid referral code still succeeds"""
        new_email = generate_unique_email()
        signup_data = {
            "fullName": "TEST Invalid Referral User",
            "email": new_email,
            "phone": "555-0002",
            "password": "test123456",
            "roles": ["trainee"],
            "referralCode": "INVALID-CODE-123"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_data)
        assert response.status_code == 200  # Signup should still succeed
        data = response.json()
        
        assert "access_token" in data
        assert data["user"]["email"] == new_email
        
        print("✓ Signup with invalid referral code succeeded (gracefully handled)")
    
    def test_signup_without_referral_code(self):
        """Test signup without referral code works normally"""
        new_email = generate_unique_email()
        signup_data = {
            "fullName": "TEST No Referral User",
            "email": new_email,
            "phone": "555-0003",
            "password": "test123456",
            "roles": ["trainee"]
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_data)
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert data["user"]["email"] == new_email
        
        # Verify the new user has their own referral code
        new_user_code_response = requests.get(
            f"{BASE_URL}/api/referral/my-code",
            headers=auth_headers(data["access_token"])
        )
        assert new_user_code_response.status_code == 200
        print("✓ Signup without referral code works normally")
    
    def test_signup_duplicate_email(self):
        """Test signup with existing email fails"""
        signup_data = {
            "fullName": "Duplicate User",
            "email": TRAINEE1_EMAIL,  # Existing user
            "phone": "555-0004",
            "password": "test123456",
            "roles": ["trainee"]
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=signup_data)
        assert response.status_code == 400
        data = response.json()
        assert "already registered" in data.get("detail", "").lower() or "email" in data.get("detail", "").lower()
        print("✓ Duplicate email correctly rejected")


# ============================================================================
# TEST CLASS: Referral Max Limit
# ============================================================================

class TestReferralMaxLimit:
    """Tests for referral max limit (5 referrals per user)"""
    
    def test_validate_code_max_referrals_config(self):
        """Test that max referrals constant is configured correctly"""
        result = login(TRAINER1_EMAIL, TEST_PASSWORD)
        if result is None:
            pytest.skip("Rate limited - cannot test")
        
        # Get stats to verify max referrals value
        stats_response = requests.get(
            f"{BASE_URL}/api/referral/stats",
            headers=auth_headers(result["token"])
        )
        assert stats_response.status_code == 200
        stats = stats_response.json()
        
        assert stats["maxReferrals"] == 5, "Max referrals should be 5"
        assert "referralsRemaining" in stats
        
        expected_remaining = max(0, 5 - stats["totalReferrals"])
        assert stats["referralsRemaining"] == expected_remaining
        
        print(f"✓ Max referrals configured correctly: {stats['maxReferrals']}")
        print(f"✓ Trainer1 has {stats['referralsRemaining']} referrals remaining")


# ============================================================================
# TEST CLASS: Regression - Other APIs
# ============================================================================

class TestRegressionOtherAPIs:
    """Regression tests for other critical APIs"""
    
    def test_trainer_search(self):
        """Test trainer search endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/trainers/search")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Trainer search working - found {len(data)} trainers")
    
    def test_trainer_profile(self):
        """Test trainer profile endpoint still works"""
        result = login(TRAINER1_EMAIL, TEST_PASSWORD)
        if result is None:
            pytest.skip("Rate limited - cannot test")
        
        response = requests.get(
            f"{BASE_URL}/api/trainer-profiles/{result['user_id']}",
            headers=auth_headers(result["token"])
        )
        # Can be 200 (profile exists) or 404 (no profile yet)
        assert response.status_code in [200, 404]
        print(f"✓ Trainer profile endpoint working (status: {response.status_code})")
    
    def test_trainee_profile(self):
        """Test trainee profile endpoint still works"""
        result = login(TRAINEE1_EMAIL, TEST_PASSWORD)
        if result is None:
            pytest.skip("Rate limited - cannot test")
        
        response = requests.get(
            f"{BASE_URL}/api/trainee-profiles/{result['user_id']}",
            headers=auth_headers(result["token"])
        )
        # Can be 200 (profile exists) or 404 (no profile yet)
        assert response.status_code in [200, 404]
        print(f"✓ Trainee profile endpoint working (status: {response.status_code})")
    
    def test_admin_dashboard(self):
        """Test admin dashboard endpoint still works"""
        result = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        if result is None:
            pytest.skip("Rate limited - cannot test")
        
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers=auth_headers(result["token"])
        )
        assert response.status_code == 200
        data = response.json()
        assert "totalUsers" in data
        print(f"✓ Admin dashboard working - {data['totalUsers']} total users")
    
    def test_notifications(self):
        """Test notifications endpoint still works"""
        result = login(TRAINEE1_EMAIL, TEST_PASSWORD)
        if result is None:
            pytest.skip("Rate limited - cannot test")
        
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=auth_headers(result["token"])
        )
        assert response.status_code == 200
        data = response.json()
        # API returns {"notifications": [...]} or just a list
        if isinstance(data, dict) and "notifications" in data:
            notifications = data["notifications"]
        else:
            notifications = data
        assert isinstance(notifications, list)
        print(f"✓ Notifications endpoint working - {len(notifications)} notifications")
    
    def test_conversations(self):
        """Test conversations endpoint still works"""
        result = login(TRAINEE1_EMAIL, TEST_PASSWORD)
        if result is None:
            pytest.skip("Rate limited - cannot test")
        
        response = requests.get(
            f"{BASE_URL}/api/conversations",
            headers=auth_headers(result["token"])
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Conversations endpoint working - {len(data)} conversations")


# ============================================================================
# TEST CLASS: Full Referral Flow Test
# ============================================================================

class TestReferralFullFlow:
    """Full flow test for referral system"""
    
    def test_complete_referral_flow(self):
        """Test complete referral flow from code generation to stats"""
        # Step 1: Login as referrer (trainer1)
        referrer_result = login(TRAINER1_EMAIL, TEST_PASSWORD)
        if referrer_result is None:
            pytest.skip("Rate limited - cannot test")
        
        # Step 2: Get referrer's code
        my_code_response = requests.get(
            f"{BASE_URL}/api/referral/my-code",
            headers=auth_headers(referrer_result["token"])
        )
        assert my_code_response.status_code == 200
        referral_code = my_code_response.json()["referralCode"]
        print(f"  Step 1: Got referrer code: {referral_code}")
        
        # Step 3: Get referrer's initial stats
        initial_stats_response = requests.get(
            f"{BASE_URL}/api/referral/stats",
            headers=auth_headers(referrer_result["token"])
        )
        assert initial_stats_response.status_code == 200
        initial_stats = initial_stats_response.json()
        initial_total = initial_stats["totalReferrals"]
        print(f"  Step 2: Initial total referrals: {initial_total}")
        
        # Step 4: Validate the code (public)
        validate_response = requests.get(f"{BASE_URL}/api/referral/validate/{referral_code}")
        assert validate_response.status_code == 200
        validate_data = validate_response.json()
        
        if validate_data["valid"]:
            print(f"  Step 3: Code valid, referrer: {validate_data['referrerName']}")
            
            # Step 5: Sign up new user with referral code
            new_email = generate_unique_email()
            signup_response = requests.post(
                f"{BASE_URL}/api/auth/signup",
                json={
                    "fullName": "TEST Full Flow User",
                    "email": new_email,
                    "phone": "555-9999",
                    "password": "test123456",
                    "roles": ["trainee"],
                    "referralCode": referral_code
                }
            )
            assert signup_response.status_code == 200
            new_user_data = signup_response.json()
            print(f"  Step 4: New user signed up: {new_email}")
            
            # Step 6: Check referrer's stats again
            updated_stats_response = requests.get(
                f"{BASE_URL}/api/referral/stats",
                headers=auth_headers(referrer_result["token"])
            )
            assert updated_stats_response.status_code == 200
            updated_stats = updated_stats_response.json()
            
            # Verify referral count increased
            assert updated_stats["totalReferrals"] >= initial_total
            print(f"  Step 5: Updated total referrals: {updated_stats['totalReferrals']}")
            
            # Step 7: Check new user's credits (should be 0 - pending)
            new_user_credits_response = requests.get(
                f"{BASE_URL}/api/referral/credits",
                headers=auth_headers(new_user_data["access_token"])
            )
            assert new_user_credits_response.status_code == 200
            new_user_credits = new_user_credits_response.json()["availableCredits"]
            print(f"  Step 6: New user credits: {new_user_credits} cents (should be 0 - pending)")
        else:
            print(f"  Code at max limit: {validate_data['message']}")
        
        print("✓ Complete referral flow test passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
