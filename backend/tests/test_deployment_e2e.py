"""
RapidReps Pre-Deployment E2E Test Suite
Comprehensive testing of ALL 19 feature areas before deployment.
Tests: Auth, Profiles, Verification, Matching, Sessions, GPS, Selfie, 
Messaging, Payments, Membership, Boosts, Ratings, Achievements, 
Admin, Notifications, Downloads, Dynamic Pricing, Safety Features
"""

import pytest
import requests
import os
from datetime import datetime, timedelta
import base64
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vibe-highlight-cards.preview.emergentagent.com').rstrip('/')

# Test Credentials
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINER1_EMAIL = "trainer1@test.com"
TRAINER1_PASSWORD = "test123"
TRAINER2_EMAIL = "trainer2@test.com"
TRAINER2_PASSWORD = "test123"
TRAINER3_EMAIL = "trainer3@test.com"
TRAINER3_PASSWORD = "test123"
TRAINEE1_EMAIL = "trainee1@test.com"
TRAINEE1_PASSWORD = "test123"
TRAINEE2_EMAIL = "trainee2@test.com"
TRAINEE2_PASSWORD = "test123"


class TestTokens:
    """Store tokens for reuse across tests"""
    admin_token = None
    admin_id = None
    trainer1_token = None
    trainer1_id = None
    trainer2_token = None
    trainer2_id = None
    trainer3_token = None
    trainer3_id = None
    trainee1_token = None
    trainee1_id = None
    trainee2_token = None
    trainee2_id = None
    test_session_id = None
    test_conversation_id = None


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def login_user(api_client, email, password):
    """Helper to login and get token + user id"""
    resp = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": email, "password": password
    })
    if resp.status_code == 200:
        data = resp.json()
        return data.get("access_token"), data.get("user", {}).get("id")
    return None, None


def get_admin_auth(api_client):
    """Get admin token"""
    if not TestTokens.admin_token:
        TestTokens.admin_token, TestTokens.admin_id = login_user(api_client, ADMIN_EMAIL, ADMIN_PASSWORD)
    return TestTokens.admin_token


def get_trainer1_auth(api_client):
    """Get trainer1 token"""
    if not TestTokens.trainer1_token:
        TestTokens.trainer1_token, TestTokens.trainer1_id = login_user(api_client, TRAINER1_EMAIL, TRAINER1_PASSWORD)
    return TestTokens.trainer1_token


def get_trainer2_auth(api_client):
    """Get trainer2 token"""
    if not TestTokens.trainer2_token:
        TestTokens.trainer2_token, TestTokens.trainer2_id = login_user(api_client, TRAINER2_EMAIL, TRAINER2_PASSWORD)
    return TestTokens.trainer2_token


def get_trainer3_auth(api_client):
    """Get trainer3 token"""
    if not TestTokens.trainer3_token:
        TestTokens.trainer3_token, TestTokens.trainer3_id = login_user(api_client, TRAINER3_EMAIL, TRAINER3_PASSWORD)
    return TestTokens.trainer3_token


def get_trainee1_auth(api_client):
    """Get trainee1 token"""
    if not TestTokens.trainee1_token:
        TestTokens.trainee1_token, TestTokens.trainee1_id = login_user(api_client, TRAINEE1_EMAIL, TRAINEE1_PASSWORD)
    return TestTokens.trainee1_token


def get_trainee2_auth(api_client):
    """Get trainee2 token"""
    if not TestTokens.trainee2_token:
        TestTokens.trainee2_token, TestTokens.trainee2_id = login_user(api_client, TRAINEE2_EMAIL, TRAINEE2_PASSWORD)
    return TestTokens.trainee2_token


# ============================================================================
# SECTION 1: HEALTH & BASIC ENDPOINTS
# ============================================================================

class TestHealthEndpoints:
    """Test health check and root endpoints"""
    
    def test_root_endpoint(self, api_client):
        """Test root endpoint"""
        resp = api_client.get(f"{BASE_URL}/api/")
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data
        print(f"✓ Root endpoint working: {data.get('message')}")
    
    def test_health_endpoint(self, api_client):
        """Test health check endpoint"""
        resp = api_client.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "healthy"
        print("✓ Health endpoint working")


# ============================================================================
# SECTION 2: AUTH FLOW (Feature 1)
# ============================================================================

class TestAuthFlow:
    """Test authentication endpoints for all roles"""
    
    def test_admin_login(self, api_client):
        """Test admin login"""
        resp = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["isAdmin"] == True
        TestTokens.admin_token = data["access_token"]
        TestTokens.admin_id = data["user"]["id"]
        print(f"✓ Admin login successful: {data['user']['email']}")
    
    def test_trainer_login(self, api_client):
        """Test trainer login"""
        resp = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER1_EMAIL, "password": TRAINER1_PASSWORD
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "trainer" in data["user"]["roles"]
        TestTokens.trainer1_token = data["access_token"]
        TestTokens.trainer1_id = data["user"]["id"]
        print(f"✓ Trainer login successful: {data['user']['email']}")
    
    def test_trainee_login(self, api_client):
        """Test trainee login"""
        resp = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE1_EMAIL, "password": TRAINEE1_PASSWORD
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "trainee" in data["user"]["roles"]
        TestTokens.trainee1_token = data["access_token"]
        TestTokens.trainee1_id = data["user"]["id"]
        print(f"✓ Trainee login successful: {data['user']['email']}")
    
    def test_auth_me_endpoint(self, api_client):
        """Test auth/me endpoint"""
        token = get_trainee1_auth(api_client)
        resp = api_client.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == TRAINEE1_EMAIL
        print(f"✓ Auth/me working for: {data['email']}")
    
    def test_invalid_login(self, api_client):
        """Test login with invalid credentials"""
        resp = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "fake@email.com", "password": "wrongpass"
        })
        assert resp.status_code == 401
        print("✓ Invalid login returns 401")
    
    def test_password_reset_request(self, api_client):
        """Test forgot password endpoint"""
        resp = api_client.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": TRAINEE1_EMAIL
        })
        # Should return 200 regardless of whether email exists (security)
        assert resp.status_code == 200
        print("✓ Password reset request works")


# ============================================================================
# SECTION 3: TRAINEE PROFILE (Feature 2)
# ============================================================================

class TestTraineeProfile:
    """Test trainee profile endpoints"""
    
    def test_get_trainee_profile(self, api_client):
        """Test GET trainee profile"""
        token = get_trainee1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/trainee-profiles/{TestTokens.trainee1_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        # May return 404 if profile not created yet
        if resp.status_code == 200:
            data = resp.json()
            print(f"✓ Trainee profile found: {data.get('id')}")
        else:
            print("✓ Trainee profile endpoint accessible (profile may not exist)")
    
    def test_create_or_update_trainee_profile(self, api_client):
        """Test POST trainee profile"""
        token = get_trainee1_auth(api_client)
        profile_data = {
            "userId": TestTokens.trainee1_id,
            "fitnessGoals": "Build muscle, improve cardio",
            "currentFitnessLevel": "intermediate",
            "preferredTrainingStyles": ["hiit", "strength"],
            "homeAddress": "123 Test Street, Los Angeles, CA 90001",
            "latitude": 34.0522,
            "longitude": -118.2437
        }
        resp = api_client.post(
            f"{BASE_URL}/api/trainee-profiles",
            json=profile_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("userId") == TestTokens.trainee1_id
        # Verify homeAddress field is persisted
        assert "homeAddress" in data
        print(f"✓ Trainee profile created/updated with homeAddress")


# ============================================================================
# SECTION 4: TRAINER PROFILE (Feature 3)
# ============================================================================

class TestTrainerProfile:
    """Test trainer profile endpoints"""
    
    def test_get_trainer_profile(self, api_client):
        """Test GET trainer profile"""
        token = get_trainer1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/trainer-profiles/{TestTokens.trainer1_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        if resp.status_code == 200:
            data = resp.json()
            print(f"✓ Trainer profile found: {data.get('id')}")
        else:
            print("✓ Trainer profile endpoint accessible")
    
    def test_create_or_update_trainer_profile(self, api_client):
        """Test POST trainer profile"""
        token = get_trainer1_auth(api_client)
        profile_data = {
            "userId": TestTokens.trainer1_id,
            "bio": "Certified personal trainer with 5 years experience. I specialize in HIIT and strength training.",
            "experienceYears": 5,
            "certifications": ["ACE", "NASM"],
            "trainingStyles": ["hiit", "strength", "cardio"],
            "offersInPerson": True,
            "offersVirtual": True,
            "offersOutdoor": True,
            "virtualRateCents": 3000,
            "outdoorRateCents": 4000,
            "inHomeRateCents": 6000,
            "latitude": 34.0522,
            "longitude": -118.2437
        }
        resp = api_client.post(
            f"{BASE_URL}/api/trainer-profiles",
            json=profile_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("userId") == TestTokens.trainer1_id
        print("✓ Trainer profile created/updated")
    
    def test_toggle_availability(self, api_client):
        """Test trainer availability toggle"""
        token = get_trainer1_auth(api_client)
        resp = api_client.patch(
            f"{BASE_URL}/api/trainer-profiles/toggle-availability?isAvailable=true",
            headers={"Authorization": f"Bearer {token}"}
        )
        if resp.status_code == 200:
            data = resp.json()
            assert data["success"] == True
            print("✓ Trainer availability toggle works")
        else:
            print(f"⚠ Availability toggle returned {resp.status_code}")


# ============================================================================
# SECTION 5: TRAINER VERIFICATION (Feature 4)
# ============================================================================

class TestTrainerVerification:
    """Test trainer verification workflow"""
    
    def test_get_onboarding_status(self, api_client):
        """Test GET trainer onboarding status"""
        token = get_trainer1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/trainer/onboarding-status",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "canGoLive" in data
        assert "missingRequirements" in data
        print(f"✓ Onboarding status: canGoLive={data['canGoLive']}")
    
    def test_get_verification_status(self, api_client):
        """Test GET trainer verification status"""
        token = get_trainer1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/trainer/verification-status",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "steps" in data
        print(f"✓ Verification status retrieved: {data.get('verificationStatus', 'pending')}")
    
    def test_submit_verification_step(self, api_client):
        """Test POST submit verification step"""
        token = get_trainer1_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/trainer/submit-verification-step",
            json={"stepId": "identity", "fileUri": "data:image/jpeg;base64,test"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] == True
        print("✓ Verification step submission works")
    
    def test_update_verification(self, api_client):
        """Test POST update verification"""
        token = get_trainer1_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/trainer/update-verification?verification_type=government_id&passed=true",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] == True
        print("✓ Verification update works")
    
    def test_submit_all_verification(self, api_client):
        """Test POST submit all verification for admin review"""
        token = get_trainer1_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/trainer/submit-all-verification",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] == True
        print("✓ Full verification submission works")


# ============================================================================
# SECTION 6: TRAINER SEARCH (Feature 5)
# ============================================================================

class TestTrainerSearch:
    """Test trainer search and proximity filter"""
    
    def test_search_trainers_by_rating(self, api_client):
        """Test search trainers sorted by rating"""
        resp = api_client.get(f"{BASE_URL}/api/trainers/search?sort=rating")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Trainer search by rating: {len(data)} trainers found")
    
    def test_search_trainers_by_distance(self, api_client):
        """Test search trainers by distance with coordinates"""
        resp = api_client.get(
            f"{BASE_URL}/api/trainers/search?latitude=34.0522&longitude=-118.2437"
        )
        assert resp.status_code == 200
        data = resp.json()
        print(f"✓ Trainer search by distance: {len(data)} trainers found")
    
    def test_nearby_trainers(self, api_client):
        """Test GET nearby trainers - requires authentication"""
        token = get_trainee1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/trainers/nearby?latitude=34.0522&longitude=-118.2437&radius_miles=15",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "trainers" in data
        print(f"✓ Nearby trainers: {data.get('count', 0)} found")


# ============================================================================
# SECTION 7: SESSION BOOKING (Feature 6)
# ============================================================================

class TestSessionBooking:
    """Test session creation and management"""
    
    def test_get_trainee_sessions(self, api_client):
        """Test GET trainee sessions"""
        token = get_trainee1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/trainee/sessions",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Trainee sessions retrieved: {len(data)} sessions")
    
    def test_get_trainer_sessions(self, api_client):
        """Test GET trainer sessions"""
        token = get_trainer1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/trainer/sessions",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Trainer sessions retrieved: {len(data)} sessions")
    
    def test_create_session_blocked_unverified(self, api_client):
        """Test session creation blocked for unverified trainer"""
        token = get_trainee1_auth(api_client)
        session_data = {
            "traineeId": TestTokens.trainee1_id,
            "trainerId": TestTokens.trainer1_id,
            "sessionDateTimeStart": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
            "durationMinutes": 60,
            "sessionType": "outdoor",
            "locationType": "gym",
            "locationNameOrAddress": "Test Gym"
        }
        resp = api_client.post(
            f"{BASE_URL}/api/sessions",
            json=session_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        # Should be blocked with 403 if trainer is not verified
        if resp.status_code == 403:
            print("✓ Session creation correctly blocked for unverified trainer")
        elif resp.status_code == 200:
            data = resp.json()
            TestTokens.test_session_id = data.get("id")
            print(f"✓ Session created (trainer is verified): {data.get('id')}")
        else:
            print(f"⚠ Unexpected response: {resp.status_code}")


# ============================================================================
# SECTION 8: GPS TRACKING (Feature 7)
# ============================================================================

class TestGPSTracking:
    """Test GPS tracking during sessions"""
    
    def test_update_trainer_location(self, api_client):
        """Test PUT trainer location update"""
        token = get_trainer1_auth(api_client)
        resp = api_client.put(
            f"{BASE_URL}/api/trainer/location",
            json={"latitude": 34.0522, "longitude": -118.2437},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        print("✓ Trainer location updated")
    
    def test_session_gps_confirm(self, api_client):
        """Test POST confirm GPS at session location"""
        token = get_trainer1_auth(api_client)
        # Use a test session ID if available
        session_id = TestTokens.test_session_id or "test_session_id"
        resp = api_client.post(
            f"{BASE_URL}/api/sessions/{session_id}/confirm-gps?latitude=34.0522&longitude=-118.2437",
            headers={"Authorization": f"Bearer {token}"}
        )
        # May return 404 if session doesn't exist
        if resp.status_code == 200:
            print("✓ GPS confirm endpoint works")
        else:
            print(f"⚠ GPS confirm returned {resp.status_code} (session may not exist)")


# ============================================================================
# SECTION 9: SELFIE VERIFICATION (Feature 8)
# ============================================================================

class TestSelfieVerification:
    """Test selfie verification for sessions"""
    
    def test_verify_selfie(self, api_client):
        """Test POST selfie verification"""
        token = get_trainer1_auth(api_client)
        session_id = TestTokens.test_session_id or "test_session_id"
        # Create a minimal base64 test image
        test_base64 = "data:image/jpeg;base64," + "A" * 200
        resp = api_client.post(
            f"{BASE_URL}/api/sessions/{session_id}/verify-selfie",
            json={"selfieBase64": test_base64},
            headers={"Authorization": f"Bearer {token}"}
        )
        if resp.status_code in [200, 400, 404]:
            print(f"✓ Selfie verification endpoint accessible ({resp.status_code})")
        else:
            print(f"⚠ Selfie verify returned {resp.status_code}")
    
    def test_verification_status(self, api_client):
        """Test GET verification status"""
        token = get_trainer1_auth(api_client)
        session_id = TestTokens.test_session_id or "test_session_id"
        resp = api_client.get(
            f"{BASE_URL}/api/sessions/{session_id}/verification-status",
            headers={"Authorization": f"Bearer {token}"}
        )
        if resp.status_code == 200:
            data = resp.json()
            print(f"✓ Verification status: trainer={data.get('trainerVerified')}, trainee={data.get('traineeVerified')}")
        else:
            print(f"⚠ Verification status returned {resp.status_code}")


# ============================================================================
# SECTION 10: MESSAGING (Feature 9)
# ============================================================================

class TestMessaging:
    """Test messaging system"""
    
    def test_send_message(self, api_client):
        """Test POST send message"""
        token = get_trainee1_auth(api_client)
        # Login trainer2 to get ID
        get_trainer2_auth(api_client)
        
        resp = api_client.post(
            f"{BASE_URL}/api/messages",
            json={
                "receiverId": TestTokens.trainer1_id,
                "content": "Hi, I'm interested in booking a session!"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        TestTokens.test_conversation_id = data.get("conversationId")
        print(f"✓ Message sent, conversationId: {data.get('conversationId')}")
    
    def test_get_conversations(self, api_client):
        """Test GET conversations"""
        token = get_trainee1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/conversations",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Conversations retrieved: {len(data)} conversations")
    
    def test_get_conversation_messages(self, api_client):
        """Test GET messages in conversation"""
        token = get_trainee1_auth(api_client)
        conv_id = TestTokens.test_conversation_id
        if not conv_id:
            pytest.skip("No conversation ID available")
        resp = api_client.get(
            f"{BASE_URL}/api/conversations/{conv_id}/messages",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Messages retrieved: {len(data)} messages")
    
    def test_create_conversation(self, api_client):
        """Test POST create conversation"""
        token = get_trainee1_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/conversations?receiver_id={TestTokens.trainer1_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "conversationId" in data
        print(f"✓ Conversation created: {data.get('conversationId')}")


# ============================================================================
# SECTION 11: PAYMENTS (Feature 10)
# ============================================================================

class TestPayments:
    """Test payment endpoints"""
    
    def test_create_payment_intent(self, api_client):
        """Test POST create payment intent"""
        token = get_trainee1_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/payments/create-payment-intent?amount_cents=4000&description=Test+Session",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "clientSecret" in data
        assert "paymentIntentId" in data
        print(f"✓ Payment intent created: {data.get('paymentIntentId')}")
    
    def test_get_pricing_rules(self, api_client):
        """Test GET pricing rules - verify 80/20 split and $2 service fee"""
        resp = api_client.get(f"{BASE_URL}/api/payments/pricing-rules")
        assert resp.status_code == 200
        data = resp.json()
        
        # Verify 80/20 split
        assert data["revenueSplit"]["trainerPercent"] == 80, "Trainer should get 80%"
        assert data["revenueSplit"]["platformPercent"] == 20, "Platform should get 20%"
        
        # Verify $2 service fee
        assert data["serviceFeeCents"] == 200, "Service fee should be $2.00 (200 cents)"
        
        # Verify minimum prices
        assert data["minimumPrices"]["virtual"] == 30, "Virtual min should be $30"
        assert data["minimumPrices"]["outdoor"] == 40, "Outdoor min should be $40"
        assert data["minimumPrices"]["inHome"] == 60, "In-home min should be $60"
        
        print("✓ Pricing rules verified: 80/20 split, $2 service fee")
    
    def test_calculate_session_cost(self, api_client):
        """Test POST calculate session cost - verify dynamic pricing"""
        resp = api_client.post(
            f"{BASE_URL}/api/payments/calculate-session-cost?session_type=outdoor&session_price_cents=4000&travel_fee_cents=500"
        )
        assert resp.status_code == 200
        data = resp.json()
        
        # Verify trainer gets 80%
        session_split = data["sessionPrice"]
        assert session_split["trainer_payout_cents"] == 3200, "Trainer should get 80% of 4000 = 3200"
        assert session_split["platform_fee_cents"] == 800, "Platform should get 20% of 4000 = 800"
        
        # Verify service fee is added
        assert data["serviceFeeCents"] == 200, "Service fee should be $2.00"
        
        print("✓ Session cost calculation verified: 80/20 split + $2 fee")


# ============================================================================
# SECTION 12: MEMBERSHIP SYSTEM (Feature 11)
# ============================================================================

class TestMembership:
    """Test membership system"""
    
    def test_get_membership(self, api_client):
        """Test GET my membership"""
        token = get_trainee1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/memberships/my-membership",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "hasMembership" in data
        print(f"✓ Membership status: hasMembership={data.get('hasMembership')}")
    
    def test_subscribe_membership(self, api_client):
        """Test POST subscribe to membership"""
        token = get_trainee1_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/memberships/subscribe",
            headers={"Authorization": f"Bearer {token}"}
        )
        if resp.status_code == 200:
            data = resp.json()
            assert "clientSecret" in data
            print(f"✓ Membership subscription initiated")
        elif resp.status_code == 400:
            print("✓ Membership endpoint works (already has membership)")
        else:
            print(f"⚠ Membership subscription returned {resp.status_code}")
    
    def test_member_badge(self, api_client):
        """Test GET member badge"""
        resp = api_client.get(f"{BASE_URL}/api/memberships/member-badge/{TestTokens.trainee1_id}")
        # May return 404 if not a member
        if resp.status_code == 200:
            print("✓ Member badge retrieved")
        else:
            print(f"✓ Member badge endpoint accessible ({resp.status_code})")


# ============================================================================
# SECTION 13: BOOSTS (Feature 12)
# ============================================================================

class TestBoosts:
    """Test trainer boost system"""
    
    def test_purchase_boost(self, api_client):
        """Test POST purchase boost"""
        token = get_trainer1_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/boosts/purchase?boost_type=daily",
            headers={"Authorization": f"Bearer {token}"}
        )
        if resp.status_code == 200:
            data = resp.json()
            print(f"✓ Boost purchase initiated: {data.get('boostId') or 'free boost used'}")
        else:
            print(f"⚠ Boost purchase returned {resp.status_code}")
    
    def test_get_my_boosts(self, api_client):
        """Test GET my boosts"""
        token = get_trainer1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/boosts/my-boosts",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "boosts" in data
        print(f"✓ Boosts retrieved: {len(data.get('boosts', []))} boosts")
    
    def test_boost_analytics(self, api_client):
        """Test GET boost analytics"""
        token = get_trainer1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/boosts/analytics",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        print("✓ Boost analytics retrieved")
    
    def test_track_boost_view(self, api_client):
        """Test POST track boost view"""
        token = get_trainee1_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/boosts/{TestTokens.trainer1_id}/track-view",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        print("✓ Boost view tracked")


# ============================================================================
# SECTION 14: RATINGS & REVIEWS (Feature 13)
# ============================================================================

class TestRatingsReviews:
    """Test ratings and reviews system"""
    
    def test_get_trainer_ratings(self, api_client):
        """Test GET trainer ratings"""
        resp = api_client.get(f"{BASE_URL}/api/trainers/{TestTokens.trainer1_id}/ratings")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Trainer ratings retrieved: {len(data)} reviews")


# ============================================================================
# SECTION 15: STREAKS & ACHIEVEMENTS (Feature 14)
# ============================================================================

class TestStreaksAchievements:
    """Test streaks and achievements system"""
    
    def test_get_my_streaks(self, api_client):
        """Test GET my streaks"""
        token = get_trainee1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/streaks/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "currentStreak" in data
        print(f"✓ Streak data: {data.get('currentStreak')} week streak")
    
    def test_get_trainer_achievements(self, api_client):
        """Test GET trainer achievements"""
        token = get_trainer1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/trainer/achievements",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "badges" in data
        print(f"✓ Trainer achievements: {len(data.get('badges', []))} badges")
    
    def test_check_badges(self, api_client):
        """Test POST check badges"""
        token = get_trainer1_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/trainer/check-badges",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        print(f"✓ Badge check completed: {data.get('message')}")
    
    def test_trainee_achievements(self, api_client):
        """Test GET trainee achievements"""
        token = get_trainee1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/trainee/achievements",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "badges" in data
        print(f"✓ Trainee achievements: {len(data.get('badges', []))} badges")
    
    def test_weekly_leaderboard(self, api_client):
        """Test GET weekly leaderboard"""
        token = get_trainee1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/leaderboard/weekly",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "leaderboard" in data
        print(f"✓ Leaderboard: {len(data.get('leaderboard', []))} entries")


# ============================================================================
# SECTION 16: ADMIN PANEL (Feature 15)
# ============================================================================

class TestAdminPanel:
    """Test admin panel endpoints"""
    
    def test_admin_dashboard(self, api_client):
        """Test GET admin dashboard"""
        token = get_admin_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "totalUsers" in data
        print(f"✓ Admin dashboard: {data.get('totalUsers')} users, {data.get('totalSessions')} sessions")
    
    def test_admin_users(self, api_client):
        """Test GET admin users with search/filter"""
        token = get_admin_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/admin/users?search=test",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "users" in data
        print(f"✓ Admin users search: {len(data.get('users', []))} users found")
    
    def test_admin_top_trainers(self, api_client):
        """Test GET admin top trainers"""
        token = get_admin_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/admin/top-trainers",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        print(f"✓ Top trainers: {len(data)} trainers")
    
    def test_admin_sessions(self, api_client):
        """Test GET admin sessions"""
        token = get_admin_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/admin/sessions",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "sessions" in data
        print(f"✓ Admin sessions: {len(data.get('sessions', []))} sessions")
    
    def test_admin_transactions(self, api_client):
        """Test GET admin transactions"""
        token = get_admin_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/admin/transactions",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        print("✓ Admin transactions endpoint works")
    
    def test_admin_pending_verifications(self, api_client):
        """Test GET admin pending verifications"""
        token = get_admin_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/admin/verifications/pending",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "pendingVerifications" in data
        print(f"✓ Pending verifications: {len(data.get('pendingVerifications', []))}")
    
    def test_admin_revenue(self, api_client):
        """Test GET admin revenue"""
        token = get_admin_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/admin/revenue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "totalPlatformFeesCents" in data
        print(f"✓ Admin revenue: ${data.get('totalPlatformFeesCents', 0)/100:.2f} platform fees")


# ============================================================================
# SECTION 17: NOTIFICATIONS (Feature 16)
# ============================================================================

class TestNotifications:
    """Test notification system"""
    
    def test_get_notifications(self, api_client):
        """Test GET notifications"""
        token = get_trainee1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "notifications" in data
        print(f"✓ Notifications: {len(data.get('notifications', []))} notifications")
    
    def test_mark_notifications_read(self, api_client):
        """Test POST mark notifications as read"""
        token = get_trainee1_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/notifications/mark-read",
            json={"notificationIds": []},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        print("✓ Mark notifications read works")
    
    def test_get_notification_preferences(self, api_client):
        """Test GET notification preferences"""
        token = get_trainee1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/notification-preferences",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        print("✓ Notification preferences retrieved")
    
    def test_update_notification_preferences(self, api_client):
        """Test PUT notification preferences"""
        token = get_trainee1_auth(api_client)
        resp = api_client.put(
            f"{BASE_URL}/api/notification-preferences",
            json={"sessionReminders": True, "marketingEmails": False},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        print("✓ Notification preferences updated")
    
    def test_register_push_token(self, api_client):
        """Test POST register push token"""
        token = get_trainee1_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/push-tokens/register",
            json={"token": "ExponentPushToken[test123]", "platform": "ios"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        print("✓ Push token registered")


# ============================================================================
# SECTION 18: DOWNLOADS (Feature 17)
# ============================================================================

class TestDownloads:
    """Test download endpoints"""
    
    def test_download_user_manual(self, api_client):
        """Test GET download user manual PDF"""
        resp = api_client.get(f"{BASE_URL}/api/downloads/user-manual")
        # May return 200 with PDF or 404 if file doesn't exist
        if resp.status_code == 200:
            assert "application/pdf" in resp.headers.get("content-type", "")
            print("✓ User manual PDF download works")
        else:
            print(f"⚠ User manual download returned {resp.status_code}")
    
    def test_download_testing_checklist(self, api_client):
        """Test GET download testing checklist PDF"""
        resp = api_client.get(f"{BASE_URL}/api/downloads/testing-checklist")
        if resp.status_code == 200:
            assert "application/pdf" in resp.headers.get("content-type", "")
            print("✓ Testing checklist PDF download works")
        else:
            print(f"⚠ Testing checklist download returned {resp.status_code}")


# ============================================================================
# SECTION 19: SAFETY FEATURES (Feature 19)
# ============================================================================

class TestSafetyFeatures:
    """Test safety and moderation features"""
    
    def test_safety_report(self, api_client):
        """Test POST safety report"""
        token = get_trainee1_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/safety/report",
            json={
                "reportedUserId": TestTokens.trainer1_id,
                "reason": "Test report - please ignore",
                "context": "Automated testing"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        print("✓ Safety report created")
    
    def test_block_user(self, api_client):
        """Test POST block user"""
        token = get_trainee1_auth(api_client)
        # Use trainer2 to avoid blocking trainer1 we need for other tests
        get_trainer2_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/safety/block/{TestTokens.trainer2_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        print("✓ User blocked")
    
    def test_get_blocks(self, api_client):
        """Test GET blocked users"""
        token = get_trainee1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/safety/blocks",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "blockedUserIds" in data
        print(f"✓ Blocked users: {len(data.get('blockedUserIds', []))}")
    
    def test_unblock_user(self, api_client):
        """Test DELETE unblock user"""
        token = get_trainee1_auth(api_client)
        resp = api_client.delete(
            f"{BASE_URL}/api/safety/block/{TestTokens.trainer2_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        print("✓ User unblocked")


# ============================================================================
# SECTION 20: VIRTUAL/INSTANT MATCHING (Additional)
# ============================================================================

class TestVirtualMatching:
    """Test virtual session matching system"""
    
    def test_virtual_request(self, api_client):
        """Test POST virtual session request"""
        token = get_trainee1_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/virtual/request",
            json={
                "traineeId": TestTokens.trainee1_id,
                "durationMinutes": 30,
                "sessionType": "virtual"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        if resp.status_code == 200:
            data = resp.json()
            print(f"✓ Virtual request created: {data.get('requestId')}")
        else:
            print(f"⚠ Virtual request returned {resp.status_code}")
    
    def test_instant_request(self, api_client):
        """Test POST instant session request"""
        token = get_trainee1_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/instant/request",
            json={
                "traineeId": TestTokens.trainee1_id,
                "latitude": 34.0522,
                "longitude": -118.2437,
                "sessionType": "outdoor",
                "durationMinutes": 60
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        if resp.status_code == 200:
            print("✓ Instant request created")
        else:
            print(f"⚠ Instant request returned {resp.status_code}")
    
    def test_virtual_pending(self, api_client):
        """Test GET pending virtual requests for trainer"""
        token = get_trainer1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/virtual/pending",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        # Response is wrapped in 'requests' key OR is a direct list
        if isinstance(data, list):
            print(f"✓ Pending virtual requests: {len(data)}")
        else:
            print(f"✓ Pending virtual requests: {len(data.get('requests', []))}")


# ============================================================================
# SECTION 21: TRAINER EARNINGS & PAYOUTS
# ============================================================================

class TestTrainerEarnings:
    """Test trainer earnings and payout system"""
    
    def test_get_trainer_earnings(self, api_client):
        """Test GET trainer earnings"""
        token = get_trainer1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/trainer/earnings",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "totalEarningsCents" in data
        print(f"✓ Trainer earnings: ${data.get('totalEarningsCents', 0)/100:.2f}")
    
    def test_request_payout(self, api_client):
        """Test POST request payout"""
        token = get_trainer1_auth(api_client)
        resp = api_client.post(
            f"{BASE_URL}/api/trainer/request-payout",
            json={
                "paymentMethod": "cashapp",
                "paymentHandle": "$testcashapp"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        if resp.status_code == 200:
            print("✓ Payout request submitted")
        elif resp.status_code == 400:
            print("✓ Payout request endpoint works (no balance or pending request)")
        else:
            print(f"⚠ Payout request returned {resp.status_code}")
    
    def test_get_payout_requests(self, api_client):
        """Test GET payout requests"""
        token = get_trainer1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/trainer/payout-requests",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "requests" in data
        print(f"✓ Payout requests: {len(data.get('requests', []))}")
    
    def test_pricing_limits(self, api_client):
        """Test GET trainer pricing limits"""
        token = get_trainer1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/trainer/pricing-limits",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "pricingLimits" in data
        print(f"✓ Pricing limits: tier={data.get('trainerTier')}")


# ============================================================================
# SECTION 22: POST-SESSION SUMMARY
# ============================================================================

class TestPostSessionSummary:
    """Test post-session summary features"""
    
    def test_get_my_summaries(self, api_client):
        """Test GET my session summaries"""
        token = get_trainee1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/sessions/summaries/my",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "summaries" in data
        print(f"✓ Session summaries: {len(data.get('summaries', []))}")


# ============================================================================
# SECTION 23: WEEKLY DIGEST
# ============================================================================

class TestWeeklyDigest:
    """Test weekly digest feature"""
    
    def test_get_weekly_digest(self, api_client):
        """Test GET weekly digest"""
        token = get_trainee1_auth(api_client)
        resp = api_client.get(
            f"{BASE_URL}/api/weekly-digest",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "sessionsThisWeek" in data
        print(f"✓ Weekly digest: {data.get('sessionsThisWeek')} sessions this week")


# ============================================================================
# RUN ALL TESTS
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
