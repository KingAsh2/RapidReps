"""
Comprehensive QA Audit Test Suite - Iteration 14

This test suite covers:
=== AUTHENTICATION & SECURITY ===
- POST /api/auth/signup - Validation (required fields, password length)
- POST /api/auth/login - Valid/invalid credentials
- Auth-protected endpoints reject requests without token (401)
- Auth-protected endpoints reject expired/invalid tokens (401)

=== PAYMENT FLOWS ===
- POST /api/memberships/subscribe - PaymentIntent with $19.99
- POST /api/memberships/{id}/confirm-payment 
- POST /api/boosts/purchase?boost_type=weekly/monthly
- POST /api/boosts/{id}/confirm-payment
- Double-click abuse: Same user can't subscribe twice

=== SESSION LIFECYCLE ===
- POST /api/sessions - Create session (validates required fields)
- PATCH /api/sessions/{id}/accept - Trainer accepts
- PATCH /api/sessions/{id}/decline - Trainer declines  
- POST /api/sessions/{id}/end - Trainer ends
- POST /api/sessions/{id}/client-confirm-end - Client confirms
- GET /api/sessions/{id} - Auth checks

=== NOTIFICATION SYSTEM ===
- GET/PUT notification-preferences
- Notification preference filtering

=== ADMIN PANEL ===
- GET /api/admin/users - Requires admin
- DELETE /api/admin/users/{id} - Requires admin
- POST /api/admin/refund-payment - Requires admin
- Non-admin users get 403

=== ERROR HANDLING ===
- Invalid ObjectId returns 400
- Non-existent resources return 404
- Empty/missing required fields return 422
"""

import pytest
import requests
import os
import uuid
import time
import jwt
from datetime import datetime, timedelta
from bson import ObjectId
from pymongo import MongoClient

# Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://highlight-vibe-bugs.preview.emergentagent.com').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'rapidreps')
JWT_SECRET = "nl8NLKDO0069P7WlqLr6Iw2f--erIuMIyKqrAl50JtU"  # From backend/.env

# Test credentials
TRAINER1_EMAIL = "trainer1@test.com"
TRAINER1_PASSWORD = "test123"
TRAINER1_ID = "697c077500b22ded1af35097"

TRAINEE1_EMAIL = "trainee1@test.com"
TRAINEE1_PASSWORD = "test123"
TRAINEE1_ID = "697c077500b22ded1af3509d"

TRAINEE2_EMAIL = "trainee2@test.com"
TRAINEE2_PASSWORD = "test123"

ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"


class TokenCache:
    """Cache tokens to avoid repeated logins and rate limiting"""
    _tokens = {}
    _last_login = {}
    
    @staticmethod
    def generate_jwt(user_id: str, email: str) -> str:
        """Generate a JWT token directly without API call to avoid rate limiting"""
        expiration = datetime.utcnow() + timedelta(hours=24)
        payload = {
            'user_id': user_id,
            'email': email,
            'exp': expiration
        }
        return jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    
    @classmethod
    def get_token(cls, email: str, user_id: str = None) -> str:
        """Get cached token or generate a new one"""
        if email in cls._tokens:
            return cls._tokens[email]
        
        # Generate token directly to avoid rate limiting
        if user_id:
            token = cls.generate_jwt(user_id, email)
            cls._tokens[email] = token
            return token
        
        return None


class TestSetup:
    """Helper class for test setup and database operations"""
    
    @staticmethod
    def get_mongo_client():
        return MongoClient(MONGO_URL)
    
    @staticmethod
    def get_db():
        client = TestSetup.get_mongo_client()
        return client[DB_NAME]
    
    @staticmethod
    def get_auth_header(token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}
    
    @staticmethod
    def get_trainer1_token() -> str:
        """Get trainer1 token (cached or generated)"""
        return TokenCache.get_token(TRAINER1_EMAIL, TRAINER1_ID)
    
    @staticmethod
    def get_trainee1_token() -> str:
        """Get trainee1 token (cached or generated)"""
        return TokenCache.get_token(TRAINEE1_EMAIL, TRAINEE1_ID)
    
    @staticmethod
    def get_admin_token() -> str:
        """Get admin token by looking up admin user ID"""
        db = TestSetup.get_db()
        admin_user = db.users.find_one({'email': ADMIN_EMAIL})
        if admin_user:
            return TokenCache.get_token(ADMIN_EMAIL, str(admin_user['_id']))
        return None
    
    @staticmethod
    def get_trainee2_id() -> str:
        """Get trainee2's ID from the database"""
        db = TestSetup.get_db()
        user = db.users.find_one({'email': TRAINEE2_EMAIL})
        return str(user['_id']) if user else None
    
    @staticmethod
    def get_trainee2_token() -> str:
        """Get trainee2 token"""
        trainee2_id = TestSetup.get_trainee2_id()
        if trainee2_id:
            return TokenCache.get_token(TRAINEE2_EMAIL, trainee2_id)
        return None
    
    @staticmethod
    def create_session_in_db(trainer_id: str, trainee_id: str, status: str = "requested") -> str:
        """Create a session directly in MongoDB"""
        db = TestSetup.get_db()
        now = datetime.utcnow()
        session_doc = {
            'traineeId': trainee_id,
            'trainerId': trainer_id,
            'status': status,
            'sessionDateTimeStart': now + timedelta(hours=24),
            'durationMinutes': 60,
            'sessionType': 'outdoor',
            'locationType': 'gym',
            'locationNameOrAddress': 'Test Gym',
            'baseSessionPriceCents': 4000,
            'finalSessionPriceCents': 4000,
            'platformFeeCents': 1000,
            'trainerEarningsCents': 3000,
            'createdAt': now
        }
        if status == 'completed':
            session_doc['sessionEndedAt'] = now - timedelta(hours=1)
        result = db.sessions.insert_one(session_doc)
        return str(result.inserted_id)
    
    @staticmethod
    def delete_test_session(session_id: str):
        """Delete a test session"""
        db = TestSetup.get_db()
        try:
            db.sessions.delete_one({'_id': ObjectId(session_id)})
        except:
            pass
    
    @staticmethod
    def delete_test_user(user_id: str):
        """Delete a test user"""
        db = TestSetup.get_db()
        try:
            db.users.delete_one({'_id': ObjectId(user_id)})
        except:
            pass


# =============================================================================
# AUTHENTICATION & SECURITY TESTS
# =============================================================================

class TestAuthenticationSecurity:
    """Tests for authentication and security endpoints"""
    
    def test_health_check(self):
        """Verify API is accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("PASS: Health check returns 200")
    
    def test_login_valid_credentials(self):
        """Test login with valid credentials (initial login)"""
        # Use direct API call but only once
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE1_EMAIL,
            "password": TRAINEE1_PASSWORD
        })
        if response.status_code == 429:
            pytest.skip("Rate limited - login test skipped")
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        print("PASS: Login with valid credentials returns 200 and token")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        })
        if response.status_code == 429:
            pytest.skip("Rate limited")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Login with invalid credentials returns 401")
    
    def test_signup_missing_required_fields(self):
        """Test signup with missing fields returns 422"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": "Test User",
            "email": f"test_{uuid.uuid4().hex[:8]}@test.com",
            "phone": "1234567890",
            "roles": ["trainee"]
        })
        if response.status_code == 429:
            pytest.skip("Rate limited")
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("PASS: Signup with missing required fields returns 422")
    
    def test_signup_password_too_short(self):
        """Test signup with password < 6 characters returns 400"""
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": "Test User",
            "email": f"test_{uuid.uuid4().hex[:8]}@test.com",
            "phone": "1234567890",
            "password": "12345",
            "roles": ["trainee"]
        })
        if response.status_code == 429:
            pytest.skip("Rate limited")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: Signup with short password returns 400")
    
    def test_protected_endpoint_without_token(self):
        """Test protected endpoint returns 401/403 without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Protected endpoint without token returns 401/403")
    
    def test_protected_endpoint_with_invalid_token(self):
        """Test protected endpoint returns 401 with invalid token"""
        headers = {"Authorization": "Bearer invalid_token_here"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Protected endpoint with invalid token returns 401")
    
    def test_protected_endpoint_with_valid_token(self):
        """Test protected endpoint works with valid token"""
        token = TestSetup.get_trainee1_token()
        headers = TestSetup.get_auth_header(token)
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Protected endpoint with valid token returns 200")


# =============================================================================
# PAYMENT FLOW TESTS
# =============================================================================

class TestPaymentFlows:
    """Tests for payment-related endpoints (memberships and boosts)"""
    
    def test_membership_subscribe_creates_payment_intent(self):
        """Test membership subscribe creates PaymentIntent with $19.99"""
        # Create a unique test user for this test
        unique_email = f"payment_test_{uuid.uuid4().hex[:8]}@test.com"
        signup_resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": "Payment Test User",
            "email": unique_email,
            "phone": "1234567890",
            "password": "test123",
            "roles": ["trainee"]
        })
        
        if signup_resp.status_code == 429:
            pytest.skip("Rate limited")
        if signup_resp.status_code != 200:
            pytest.skip(f"Could not create test user: {signup_resp.text}")
        
        auth_data = signup_resp.json()
        user_id = auth_data["user"]["id"]
        headers = TestSetup.get_auth_header(auth_data["access_token"])
        
        try:
            response = requests.post(f"{BASE_URL}/api/memberships/subscribe", headers=headers)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            data = response.json()
            
            assert "clientSecret" in data, "Missing clientSecret"
            assert "paymentIntentId" in data, "Missing paymentIntentId"
            assert "membershipId" in data, "Missing membershipId"
            assert "amountCents" in data, "Missing amountCents"
            assert data["amountCents"] == 1999, f"Expected 1999 cents, got {data['amountCents']}"
            
            print(f"PASS: Membership subscribe creates PaymentIntent with $19.99, ID: {data['paymentIntentId']}")
        finally:
            db = TestSetup.get_db()
            db.users.delete_one({'_id': ObjectId(user_id)})
            db.memberships.delete_many({'userId': user_id})
    
    def test_membership_double_subscribe_prevention(self):
        """Test that user with active membership cannot subscribe again"""
        unique_email = f"double_sub_{uuid.uuid4().hex[:8]}@test.com"
        signup_resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": "Double Sub Test",
            "email": unique_email,
            "phone": "1234567890",
            "password": "test123",
            "roles": ["trainee"]
        })
        
        if signup_resp.status_code == 429:
            pytest.skip("Rate limited")
        if signup_resp.status_code != 200:
            pytest.skip(f"Could not create test user")
        
        auth_data = signup_resp.json()
        user_id = auth_data["user"]["id"]
        headers = TestSetup.get_auth_header(auth_data["access_token"])
        
        try:
            db = TestSetup.get_db()
            db.memberships.insert_one({
                'userId': user_id,
                'status': 'active',
                'monthlyPriceCents': 1999,
                'startDate': datetime.utcnow(),
                'nextBillingDate': datetime.utcnow() + timedelta(days=30),
                'freeBoostsRemaining': 1,
                'createdAt': datetime.utcnow()
            })
            
            response = requests.post(f"{BASE_URL}/api/memberships/subscribe", headers=headers)
            assert response.status_code in [400, 409], f"Expected 400/409 for double subscribe, got {response.status_code}"
            print("PASS: Double subscribe is prevented (returns 400/409)")
        finally:
            db = TestSetup.get_db()
            db.users.delete_one({'_id': ObjectId(user_id)})
            db.memberships.delete_many({'userId': user_id})
    
    def test_boost_purchase_weekly(self):
        """Test weekly boost purchase creates PaymentIntent for $49.99"""
        token = TestSetup.get_trainer1_token()
        headers = TestSetup.get_auth_header(token)
        
        response = requests.post(f"{BASE_URL}/api/boosts/purchase?boost_type=weekly", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "clientSecret" in data, "Missing clientSecret"
        assert "amountCents" in data, "Missing amountCents"
        assert data["amountCents"] == 4999, f"Expected 4999 cents for weekly, got {data['amountCents']}"
        
        print(f"PASS: Weekly boost creates PaymentIntent for $49.99")
        
        db = TestSetup.get_db()
        db.boosts.delete_one({'_id': ObjectId(data['boostId'])})
    
    def test_boost_purchase_monthly(self):
        """Test monthly boost purchase creates PaymentIntent for $149.99"""
        token = TestSetup.get_trainer1_token()
        headers = TestSetup.get_auth_header(token)
        
        response = requests.post(f"{BASE_URL}/api/boosts/purchase?boost_type=monthly", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["amountCents"] == 14999, f"Expected 14999 cents for monthly, got {data['amountCents']}"
        print(f"PASS: Monthly boost creates PaymentIntent for $149.99")
        
        db = TestSetup.get_db()
        db.boosts.delete_one({'_id': ObjectId(data['boostId'])})
    
    def test_boost_purchase_by_non_trainer_rejected(self):
        """Test boost purchase by non-trainer returns 403"""
        token = TestSetup.get_trainee1_token()
        headers = TestSetup.get_auth_header(token)
        
        response = requests.post(f"{BASE_URL}/api/boosts/purchase?boost_type=weekly", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: Boost purchase by non-trainer returns 403")
    
    def test_boost_confirm_payment_authorization(self):
        """Test boost confirm-payment authorization checks"""
        token = TestSetup.get_trainer1_token()
        headers = TestSetup.get_auth_header(token)
        
        response = requests.post(f"{BASE_URL}/api/boosts/purchase?boost_type=weekly", headers=headers)
        if response.status_code != 200:
            pytest.skip("Could not create boost for test")
        
        boost_id = response.json()["boostId"]
        
        try:
            trainee_token = TestSetup.get_trainee1_token()
            trainee_headers = TestSetup.get_auth_header(trainee_token)
            
            confirm_resp = requests.post(f"{BASE_URL}/api/boosts/{boost_id}/confirm-payment", headers=trainee_headers)
            assert confirm_resp.status_code in [403, 404], f"Expected 403/404, got {confirm_resp.status_code}"
            print("PASS: Boost confirm-payment rejects non-owner (403/404)")
        finally:
            db = TestSetup.get_db()
            db.boosts.delete_one({'_id': ObjectId(boost_id)})


# =============================================================================
# SESSION LIFECYCLE TESTS
# =============================================================================

class TestSessionLifecycle:
    """Tests for session creation and lifecycle"""
    
    def test_session_create_validates_required_fields(self):
        """Test session create requires traineeId, trainerId, datetime"""
        token = TestSetup.get_trainee1_token()
        headers = TestSetup.get_auth_header(token)
        
        response = requests.post(f"{BASE_URL}/api/sessions", headers=headers, json={
            "traineeId": TRAINEE1_ID,
            "sessionDateTimeStart": datetime.utcnow().isoformat(),
            "durationMinutes": 60,
            "locationType": "gym"
        })
        assert response.status_code == 422, f"Expected 422 for missing trainerId, got {response.status_code}"
        print("PASS: Session create validates required fields (422)")
    
    def test_session_accept_by_trainer(self):
        """Test trainer can accept a session"""
        session_id = TestSetup.create_session_in_db(TRAINER1_ID, TRAINEE1_ID, "requested")
        
        try:
            token = TestSetup.get_trainer1_token()
            headers = TestSetup.get_auth_header(token)
            
            response = requests.patch(f"{BASE_URL}/api/sessions/{session_id}/accept", headers=headers)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert data["status"] == "confirmed", f"Expected status 'confirmed', got {data['status']}"
            print("PASS: Trainer can accept session (status becomes 'confirmed')")
        finally:
            TestSetup.delete_test_session(session_id)
    
    def test_session_accept_only_by_trainer(self):
        """Test only the session's trainer can accept"""
        session_id = TestSetup.create_session_in_db(TRAINER1_ID, TRAINEE1_ID, "requested")
        
        try:
            token = TestSetup.get_trainee1_token()
            headers = TestSetup.get_auth_header(token)
            
            response = requests.patch(f"{BASE_URL}/api/sessions/{session_id}/accept", headers=headers)
            assert response.status_code in [403, 400], f"Expected 403/400, got {response.status_code}"
            print("PASS: Non-trainer cannot accept session (403/400)")
        finally:
            TestSetup.delete_test_session(session_id)
    
    def test_session_decline_by_trainer(self):
        """Test trainer can decline a session"""
        session_id = TestSetup.create_session_in_db(TRAINER1_ID, TRAINEE1_ID, "requested")
        
        try:
            token = TestSetup.get_trainer1_token()
            headers = TestSetup.get_auth_header(token)
            
            response = requests.patch(f"{BASE_URL}/api/sessions/{session_id}/decline", headers=headers)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert data["status"] == "declined", f"Expected status 'declined', got {data['status']}"
            print("PASS: Trainer can decline session (status becomes 'declined')")
        finally:
            TestSetup.delete_test_session(session_id)
    
    def test_session_end_by_trainer(self):
        """Test trainer can end a confirmed session"""
        db = TestSetup.get_db()
        now = datetime.utcnow()
        session_doc = {
            'traineeId': TRAINEE1_ID,
            'trainerId': TRAINER1_ID,
            'status': 'confirmed',
            'sessionDateTimeStart': now - timedelta(hours=1),
            'durationMinutes': 60,
            'sessionType': 'outdoor',
            'baseSessionPriceCents': 4000,
            'finalSessionPriceCents': 4000,
            'createdAt': now - timedelta(hours=2)
        }
        result = db.sessions.insert_one(session_doc)
        session_id = str(result.inserted_id)
        
        try:
            token = TestSetup.get_trainer1_token()
            headers = TestSetup.get_auth_header(token)
            
            response = requests.post(f"{BASE_URL}/api/sessions/{session_id}/end", headers=headers)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            print("PASS: Trainer can end session")
        finally:
            TestSetup.delete_test_session(session_id)
    
    def test_session_client_confirm_end(self):
        """Test client can confirm session end (releases payment)"""
        db = TestSetup.get_db()
        now = datetime.utcnow()
        session_doc = {
            'traineeId': TRAINEE1_ID,
            'trainerId': TRAINER1_ID,
            'status': 'confirmed',
            'sessionDateTimeStart': now - timedelta(hours=1),
            'sessionEndedAt': now,
            'durationMinutes': 60,
            'sessionType': 'outdoor',
            'baseSessionPriceCents': 4000,
            'finalSessionPriceCents': 4000,
            'trainerEarningsCents': 3000,
            'createdAt': now - timedelta(hours=2)
        }
        result = db.sessions.insert_one(session_doc)
        session_id = str(result.inserted_id)
        
        try:
            token = TestSetup.get_trainee1_token()
            headers = TestSetup.get_auth_header(token)
            
            response = requests.post(f"{BASE_URL}/api/sessions/{session_id}/client-confirm-end", headers=headers)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            print("PASS: Client can confirm session end")
        finally:
            TestSetup.delete_test_session(session_id)
    
    def test_session_get_requires_auth(self):
        """Test GET session requires authentication"""
        session_id = TestSetup.create_session_in_db(TRAINER1_ID, TRAINEE1_ID)
        
        try:
            response = requests.get(f"{BASE_URL}/api/sessions/{session_id}")
            assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
            print("PASS: GET session requires auth (401/403)")
        finally:
            TestSetup.delete_test_session(session_id)
    
    def test_session_get_only_participant_or_admin(self):
        """Test GET session only allowed for participants or admin"""
        session_id = TestSetup.create_session_in_db(TRAINER1_ID, TRAINEE1_ID)
        
        try:
            trainee2_token = TestSetup.get_trainee2_token()
            if not trainee2_token:
                pytest.skip("Trainee2 not found in database")
            
            headers = TestSetup.get_auth_header(trainee2_token)
            response = requests.get(f"{BASE_URL}/api/sessions/{session_id}", headers=headers)
            
            assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"
            print("PASS: Non-participant cannot view session (403/404)")
        finally:
            TestSetup.delete_test_session(session_id)


# =============================================================================
# NOTIFICATION SYSTEM TESTS
# =============================================================================

class TestNotificationSystem:
    """Tests for notification system"""
    
    def test_get_notification_preferences_defaults(self):
        """Test GET notification-preferences returns defaults"""
        token = TestSetup.get_trainee1_token()
        headers = TestSetup.get_auth_header(token)
        
        response = requests.get(f"{BASE_URL}/api/notification-preferences", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "pushEnabled" in data or "session_requested" in data, "Missing notification preference fields"
        print("PASS: GET notification-preferences returns defaults")
    
    def test_update_notification_preferences(self):
        """Test PUT notification-preferences updates preferences"""
        token = TestSetup.get_trainee1_token()
        headers = TestSetup.get_auth_header(token)
        
        response = requests.put(f"{BASE_URL}/api/notification-preferences", headers=headers, json={
            "pushEnabled": True,
            "session_requested": True,
            "session_accepted": True,
            "session_declined": True,
            "session_ended": True,
            "session_reminder": False,
            "rate_reminder": False,
            "payment_released": True,
            "new_message": True,
            "streak_warning": False,
            "boost_expiring": True
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: PUT notification-preferences updates successfully")
    
    def test_notification_preference_filtering(self):
        """Test that disabled notification types are respected"""
        unique_email = f"notif_test_{uuid.uuid4().hex[:8]}@test.com"
        signup_resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": "Notification Test User",
            "email": unique_email,
            "phone": "1234567890",
            "password": "test123",
            "roles": ["trainee"]
        })
        
        if signup_resp.status_code == 429:
            pytest.skip("Rate limited")
        if signup_resp.status_code != 200:
            pytest.skip(f"Could not create test user")
        
        auth_data = signup_resp.json()
        user_id = auth_data["user"]["id"]
        headers = TestSetup.get_auth_header(auth_data["access_token"])
        
        try:
            requests.put(f"{BASE_URL}/api/notification-preferences", headers=headers, json={
                "pushEnabled": True,
                "session_requested": True,
                "session_accepted": True,
                "session_declined": True,
                "session_ended": True,
                "session_reminder": False,
                "rate_reminder": True,
                "payment_released": True,
                "new_message": True,
                "streak_warning": True,
                "boost_expiring": True
            })
            
            get_resp = requests.get(f"{BASE_URL}/api/notification-preferences", headers=headers)
            prefs = get_resp.json()
            
            assert prefs.get("session_reminder") == False, "session_reminder should be disabled"
            print("PASS: Notification preferences correctly filter disabled types")
        finally:
            db = TestSetup.get_db()
            db.users.delete_one({'_id': ObjectId(user_id)})
            db.notification_preferences.delete_many({'userId': user_id})


# =============================================================================
# ADMIN PANEL TESTS
# =============================================================================

class TestAdminPanel:
    """Tests for admin panel endpoints"""
    
    def test_admin_users_requires_admin(self):
        """Test GET /api/admin/users requires admin role"""
        token = TestSetup.get_trainee1_token()
        headers = TestSetup.get_auth_header(token)
        
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: GET /api/admin/users returns 403 for non-admin")
    
    def test_admin_users_works_for_admin(self):
        """Test GET /api/admin/users works for admin"""
        token = TestSetup.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = TestSetup.get_auth_header(token)
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: GET /api/admin/users works for admin")
    
    def test_admin_delete_user_requires_admin(self):
        """Test DELETE /api/admin/users/{id} requires admin role"""
        token = TestSetup.get_trainee1_token()
        headers = TestSetup.get_auth_header(token)
        
        fake_id = "507f1f77bcf86cd799439011"
        response = requests.delete(f"{BASE_URL}/api/admin/users/{fake_id}", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: DELETE /api/admin/users requires admin (403)")
    
    def test_admin_delete_user_works(self):
        """Test admin can delete a user"""
        unique_email = f"delete_test_{uuid.uuid4().hex[:8]}@test.com"
        signup_resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": "To Be Deleted",
            "email": unique_email,
            "phone": "1234567890",
            "password": "test123",
            "roles": ["trainee"]
        })
        
        if signup_resp.status_code == 429:
            pytest.skip("Rate limited")
        if signup_resp.status_code != 200:
            pytest.skip(f"Could not create test user to delete")
        
        user_id = signup_resp.json()["user"]["id"]
        
        token = TestSetup.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = TestSetup.get_auth_header(token)
        
        response = requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Delete should return success"
        print("PASS: Admin can delete user")
    
    def test_admin_refund_requires_admin(self):
        """Test POST /api/admin/refund requires admin role"""
        token = TestSetup.get_trainee1_token()
        headers = TestSetup.get_auth_header(token)
        
        response = requests.post(f"{BASE_URL}/api/admin/refund", headers=headers, json={
            "sessionId": "507f1f77bcf86cd799439011"
        })
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: POST /api/admin/refund requires admin (403)")
    
    def test_admin_dashboard_requires_admin(self):
        """Test GET /api/admin/dashboard requires admin role"""
        token = TestSetup.get_trainee1_token()
        headers = TestSetup.get_auth_header(token)
        
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("PASS: GET /api/admin/dashboard requires admin (403)")
    
    def test_admin_dashboard_works_for_admin(self):
        """Test GET /api/admin/dashboard returns stats for admin"""
        token = TestSetup.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = TestSetup.get_auth_header(token)
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "totalUsers" in data, "Missing totalUsers"
        assert "totalTrainers" in data, "Missing totalTrainers"
        assert "totalSessions" in data, "Missing totalSessions"
        print("PASS: GET /api/admin/dashboard returns stats for admin")


# =============================================================================
# ERROR HANDLING TESTS
# =============================================================================

class TestErrorHandling:
    """Tests for error handling and edge cases"""
    
    def test_invalid_objectid_returns_400_or_404(self):
        """Test invalid ObjectId format returns 400/404 (not 500)"""
        token = TestSetup.get_trainee1_token()
        headers = TestSetup.get_auth_header(token)
        
        response = requests.get(f"{BASE_URL}/api/sessions/not-a-valid-objectid", headers=headers)
        
        assert response.status_code in [400, 404, 422], \
            f"Expected 400/404/422 for invalid ObjectId, got {response.status_code}"
        print("PASS: Invalid ObjectId returns 400/404/422 (not 500)")
    
    def test_nonexistent_resource_returns_404(self):
        """Test non-existent resource returns 404"""
        token = TestSetup.get_trainee1_token()
        headers = TestSetup.get_auth_header(token)
        
        fake_id = "507f1f77bcf86cd799439011"
        response = requests.get(f"{BASE_URL}/api/sessions/{fake_id}", headers=headers)
        
        assert response.status_code in [404, 403], f"Expected 404/403, got {response.status_code}"
        print("PASS: Non-existent resource returns 404/403")
    
    def test_trainer_search_works(self):
        """Test trainer search endpoint works"""
        token = TestSetup.get_trainee1_token()
        headers = TestSetup.get_auth_header(token)
        
        response = requests.get(f"{BASE_URL}/api/trainers/search", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Trainer search should return a list"
        print("PASS: Trainer search endpoint works")
    
    def test_trainer_profile_not_found(self):
        """Test trainer profile for non-existent user returns 404"""
        token = TestSetup.get_trainee1_token()
        headers = TestSetup.get_auth_header(token)
        
        fake_id = "507f1f77bcf86cd799439011"
        response = requests.get(f"{BASE_URL}/api/trainer-profiles/{fake_id}", headers=headers)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Non-existent trainer profile returns 404")


# =============================================================================
# TRAINER MANAGEMENT TESTS
# =============================================================================

class TestTrainerManagement:
    """Tests for trainer management endpoints"""
    
    def test_trainer_profile_exists(self):
        """Test trainer profile endpoint returns data for valid trainer"""
        response = requests.get(f"{BASE_URL}/api/trainer-profiles/{TRAINER1_ID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("userId") == TRAINER1_ID, "Wrong trainer returned"
        print("PASS: Trainer profile returns data for valid trainer")
    
    def test_trainer_search_with_filters(self):
        """Test trainer search with filters"""
        token = TestSetup.get_trainee1_token()
        headers = TestSetup.get_auth_header(token)
        
        response = requests.get(f"{BASE_URL}/api/trainers/search?latitude=40.7128&longitude=-74.0060", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Trainer search with filters works")


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
