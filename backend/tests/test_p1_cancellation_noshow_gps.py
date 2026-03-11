"""
Test P1 Cancellation, No-Show, and GPS Tracking Features
=========================================================
Tests for:
- PATCH /api/sessions/{id}/cancel - Time-based trainee cancellation penalties (>12h=0%, 12-2h=25%, <2h=50%)
- PATCH /api/sessions/{id}/cancel - Trainer cancellation rules (>12h=no penalty, <=12h=strike+credit)
- PATCH /api/sessions/{id}/no-show?who=trainee - Trainee no-show: 50% payout to trainer (75% of that 50%)
- PATCH /api/sessions/{id}/no-show?who=trainer - Trainer no-show: 100% refund, $0 to trainer, strike
- Trainer 3-strike threshold: account flagged for review
- POST /api/sessions/{id}/start-en-route - Changes session to en_route status
- POST /api/sessions/{id}/gps-update - Real-time GPS with alerts
- GET /api/sessions/{id}/gps-track - Live positions with distance calculation
- POST /api/sessions/{id}/confirm-gps - Distance validation (0.25mi outdoor, 0.1mi at-home)
- POST /api/sessions/{id}/start-session - Changes to in_progress status
- GPS privacy: tracking returns false for completed/cancelled sessions
- Virtual session credit granted on trainer late cancellation
"""

import pytest
import requests
import os
import time
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://eas-cache-fix.preview.emergentagent.com"

# MongoDB connection for direct test session creation
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "rapidreps"

# Test user IDs from agent context
TRAINEE1_ID = "697c077500b22ded1af3509d"
TRAINER1_ID = "697c077500b22ded1af35097"


# ============================================================================
# SHARED AUTH SESSION - Cache tokens to avoid rate limiting
# ============================================================================
class AuthCache:
    """Cache authentication tokens to avoid rate limiting"""
    _tokens = {}
    
    @classmethod
    def get_token(cls, email: str, password: str = "test123") -> dict:
        """Get cached token or authenticate"""
        if email in cls._tokens:
            return cls._tokens[email]
        
        time.sleep(0.3)
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        
        if response.status_code == 429:
            time.sleep(5)
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": password
            })
        
        if response.status_code == 200:
            cls._tokens[email] = response.json()
            return cls._tokens[email]
        
        raise Exception(f"Auth failed for {email}: {response.status_code} - {response.text}")
    
    @classmethod
    def get_auth_header(cls, email: str) -> dict:
        """Get Authorization header for requests"""
        data = cls.get_token(email)
        return {"Authorization": f"Bearer {data['access_token']}"}
    
    @classmethod
    def clear_cache(cls):
        cls._tokens = {}


# ============================================================================
# MONGODB TEST DATA HELPER
# ============================================================================
class TestSessionHelper:
    """Helper to create test sessions directly in MongoDB"""
    
    @classmethod
    def get_mongo_client(cls):
        return MongoClient(MONGO_URL)
    
    @classmethod
    def create_test_session(cls, trainee_id: str, trainer_id: str, hours_from_now: float = 24,
                           session_type: str = "outdoor", price_cents: int = 5000,
                           trainee_lat: float = 40.7128, trainee_lon: float = -74.0060) -> str:
        """Create a confirmed test session directly in MongoDB"""
        client = cls.get_mongo_client()
        db = client[DB_NAME]
        
        session_start = datetime.utcnow() + timedelta(hours=hours_from_now)
        session_doc = {
            "traineeId": trainee_id,
            "trainerId": trainer_id,
            "sessionType": session_type,
            "status": "confirmed",
            "sessionDateTimeStart": session_start,
            "durationMinutes": 60,
            "finalSessionPriceCents": price_cents,
            "baseSessionPriceCents": price_cents,
            "paymentIntentId": f"mock_pi_{ObjectId()}",
            "traineeLatitude": trainee_lat,
            "traineeLongitude": trainee_lon,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }
        
        result = db.sessions.insert_one(session_doc)
        client.close()
        return str(result.inserted_id)
    
    @classmethod
    def get_session(cls, session_id: str) -> dict:
        """Get session from MongoDB"""
        client = cls.get_mongo_client()
        db = client[DB_NAME]
        session = db.sessions.find_one({"_id": ObjectId(session_id)})
        client.close()
        return session
    
    @classmethod
    def delete_test_session(cls, session_id: str):
        """Delete a test session"""
        client = cls.get_mongo_client()
        db = client[DB_NAME]
        db.sessions.delete_one({"_id": ObjectId(session_id)})
        db.session_gps_tracks.delete_many({"sessionId": session_id})
        client.close()
    
    @classmethod
    def reset_trainer_strikes(cls, trainer_id: str):
        """Reset trainer strikes for testing"""
        client = cls.get_mongo_client()
        db = client[DB_NAME]
        db.users.update_one(
            {"_id": ObjectId(trainer_id)},
            {"$set": {"performanceStrikes": 0, "strikeHistory": [], "accountUnderReview": False}}
        )
        client.close()
    
    @classmethod
    def get_user(cls, user_id: str) -> dict:
        """Get user from MongoDB"""
        client = cls.get_mongo_client()
        db = client[DB_NAME]
        user = db.users.find_one({"_id": ObjectId(user_id)})
        client.close()
        return user
    
    @classmethod
    def get_session_credits(cls, user_id: str) -> list:
        """Get session credits for a user"""
        client = cls.get_mongo_client()
        db = client[DB_NAME]
        credits = list(db.session_credits.find({"userId": user_id}))
        client.close()
        return credits
    
    @classmethod
    def delete_session_credits(cls, user_id: str):
        """Delete session credits for testing cleanup"""
        client = cls.get_mongo_client()
        db = client[DB_NAME]
        db.session_credits.delete_many({"userId": user_id})
        client.close()


# ============================================================================
# HEALTH AND AUTH TESTS
# ============================================================================
class TestHealthAndAuth:
    """Health check and authentication tests"""
    
    def test_health_endpoint(self):
        """Test GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ Health check passed: {data}")
    
    def test_login_trainee_success(self):
        """Test trainee login"""
        data = AuthCache.get_token("trainee1@test.com")
        assert "access_token" in data
        assert data["user"]["email"] == "trainee1@test.com"
        print(f"✓ Trainee login successful")
    
    def test_login_trainer_success(self):
        """Test trainer login"""
        data = AuthCache.get_token("trainer1@test.com")
        assert "access_token" in data
        assert data["user"]["email"] == "trainer1@test.com"
        print(f"✓ Trainer login successful")


# ============================================================================
# TRAINEE CANCELLATION TESTS - Time-based penalties
# ============================================================================
class TestTraineeCancellation:
    """
    Test trainee cancellation with time-based penalties:
    - >12h before → 0% penalty
    - 12-2h before → 25% penalty
    - <2h before → 50% penalty
    """
    
    def test_trainee_cancel_more_than_12h_no_penalty(self):
        """PATCH /api/sessions/{id}/cancel - Trainee cancels >12h before: 0% penalty"""
        # Create session 24 hours from now
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=24,
            price_cents=5000
        )
        
        try:
            headers = AuthCache.get_auth_header("trainee1@test.com")
            response = requests.patch(f"{BASE_URL}/api/sessions/{session_id}/cancel", headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["success"] == True
            assert data["cancelledBy"] == "trainee"
            assert data["penaltyPercent"] == 0
            assert data["penaltyCents"] == 0
            assert data["refundCents"] == 5000  # Full refund
            assert data["hoursUntilSession"] > 12
            print(f"✓ Trainee cancel >12h: 0% penalty, full refund: ${data['refundCents']/100:.2f}")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)
    
    def test_trainee_cancel_12_to_2h_25_percent_penalty(self):
        """PATCH /api/sessions/{id}/cancel - Trainee cancels 12-2h before: 25% penalty"""
        # Create session 6 hours from now (within 12-2h window)
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=6,
            price_cents=10000  # $100
        )
        
        try:
            headers = AuthCache.get_auth_header("trainee1@test.com")
            response = requests.patch(f"{BASE_URL}/api/sessions/{session_id}/cancel", headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["success"] == True
            assert data["cancelledBy"] == "trainee"
            assert data["penaltyPercent"] == 25
            assert data["penaltyCents"] == 2500  # 25% of $100
            assert data["refundCents"] == 7500   # 75% refund
            assert 2 < data["hoursUntilSession"] <= 12
            print(f"✓ Trainee cancel 12-2h: 25% penalty (${data['penaltyCents']/100:.2f}), refund: ${data['refundCents']/100:.2f}")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)
    
    def test_trainee_cancel_less_than_2h_50_percent_penalty(self):
        """PATCH /api/sessions/{id}/cancel - Trainee cancels <2h before: 50% penalty"""
        # Create session 1 hour from now
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=1,
            price_cents=8000  # $80
        )
        
        try:
            headers = AuthCache.get_auth_header("trainee1@test.com")
            response = requests.patch(f"{BASE_URL}/api/sessions/{session_id}/cancel", headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["success"] == True
            assert data["cancelledBy"] == "trainee"
            assert data["penaltyPercent"] == 50
            assert data["penaltyCents"] == 4000  # 50% of $80
            assert data["refundCents"] == 4000   # 50% refund
            assert data["hoursUntilSession"] <= 2
            print(f"✓ Trainee cancel <2h: 50% penalty (${data['penaltyCents']/100:.2f}), refund: ${data['refundCents']/100:.2f}")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)


# ============================================================================
# TRAINER CANCELLATION TESTS - Strikes and credits
# ============================================================================
class TestTrainerCancellation:
    """
    Test trainer cancellation rules:
    - >12h before → no penalty, no strike
    - ≤12h before → full refund, strike, virtual credit
    """
    
    def setup_method(self):
        """Reset trainer strikes before each test"""
        TestSessionHelper.reset_trainer_strikes(TRAINER1_ID)
        TestSessionHelper.delete_session_credits(TRAINEE1_ID)
    
    def test_trainer_cancel_more_than_12h_no_strike(self):
        """PATCH /api/sessions/{id}/cancel - Trainer cancels >12h: no penalty, no strike"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=24,
            price_cents=5000
        )
        
        try:
            headers = AuthCache.get_auth_header("trainer1@test.com")
            response = requests.patch(f"{BASE_URL}/api/sessions/{session_id}/cancel", headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["success"] == True
            assert data["cancelledBy"] == "trainer"
            assert data["penaltyPercent"] == 0
            assert data["refundCents"] == 5000  # Full refund to trainee
            assert data["trainerStrike"] == False
            assert data["virtualCredit"] == False
            assert data["hoursUntilSession"] > 12
            print(f"✓ Trainer cancel >12h: No strike, full refund: ${data['refundCents']/100:.2f}")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)
    
    def test_trainer_cancel_within_12h_gets_strike_and_credit(self):
        """PATCH /api/sessions/{id}/cancel - Trainer cancels ≤12h: full refund + strike + credit"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=6,
            price_cents=6000
        )
        
        try:
            headers = AuthCache.get_auth_header("trainer1@test.com")
            response = requests.patch(f"{BASE_URL}/api/sessions/{session_id}/cancel", headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["success"] == True
            assert data["cancelledBy"] == "trainer"
            assert data["refundCents"] == 6000  # Full refund
            assert data["trainerStrike"] == True
            assert data["virtualCredit"] == True
            assert data["hoursUntilSession"] <= 12
            
            # Verify strike was applied to trainer
            trainer = TestSessionHelper.get_user(TRAINER1_ID)
            assert trainer.get("performanceStrikes", 0) >= 1
            
            # Verify virtual credit was granted to trainee
            credits = TestSessionHelper.get_session_credits(TRAINEE1_ID)
            assert len(credits) >= 1
            credit = credits[-1]
            assert credit["type"] == "virtual_session"
            assert credit["isUsed"] == False
            
            print(f"✓ Trainer cancel ≤12h: Strike applied, credit granted, full refund: ${data['refundCents']/100:.2f}")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)
            TestSessionHelper.delete_session_credits(TRAINEE1_ID)


# ============================================================================
# NO-SHOW TESTS
# ============================================================================
class TestNoShow:
    """
    Test no-show rules:
    - Trainee no-show: trainer gets 50% payout (platform keeps 25% of that)
    - Trainer no-show: 100% refund, $0 to trainer, strike
    """
    
    def setup_method(self):
        """Reset trainer strikes before each test"""
        TestSessionHelper.reset_trainer_strikes(TRAINER1_ID)
    
    def test_trainee_no_show_trainer_gets_50_percent(self):
        """PATCH /api/sessions/{id}/no-show?who=trainee - Trainer gets 50% payout"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=-0.5,  # Past session
            price_cents=10000  # $100
        )
        
        try:
            # Can be called by either party or admin
            headers = AuthCache.get_auth_header("trainer1@test.com")
            response = requests.patch(
                f"{BASE_URL}/api/sessions/{session_id}/no-show?who=trainee",
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["success"] == True
            assert data["noShowParty"] == "trainee"
            
            # 50% of $100 = $50 charged
            half_price = 5000
            # Platform keeps 25% of $50 = $12.50
            expected_platform_fee = int(half_price * 25 / 100)  # 1250
            expected_trainer_payout = half_price - expected_platform_fee  # 3750
            
            assert data["trainerEarningsCents"] == expected_trainer_payout
            assert data["platformFeeCents"] == expected_platform_fee
            assert data["trainerStrike"] == False
            
            print(f"✓ Trainee no-show: Trainer gets ${data['trainerEarningsCents']/100:.2f}, platform fee: ${data['platformFeeCents']/100:.2f}")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)
    
    def test_trainer_no_show_full_refund_and_strike(self):
        """PATCH /api/sessions/{id}/no-show?who=trainer - 100% refund, $0 to trainer, strike"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=-0.5,
            price_cents=8000  # $80
        )
        
        try:
            headers = AuthCache.get_auth_header("trainee1@test.com")
            response = requests.patch(
                f"{BASE_URL}/api/sessions/{session_id}/no-show?who=trainer",
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["success"] == True
            assert data["noShowParty"] == "trainer"
            assert data["traineeRefundCents"] == 8000  # Full refund
            assert data["trainerEarningsCents"] == 0    # $0 to trainer
            assert data["platformFeeCents"] == 0
            assert data["trainerStrike"] == True
            
            # Verify strike was applied
            trainer = TestSessionHelper.get_user(TRAINER1_ID)
            assert trainer.get("performanceStrikes", 0) >= 1
            
            print(f"✓ Trainer no-show: Full refund ${data['traineeRefundCents']/100:.2f}, trainer $0, strike applied")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)


# ============================================================================
# STRIKE THRESHOLD TEST
# ============================================================================
class TestStrikeThreshold:
    """Test 3-strike threshold triggers account review"""
    
    def setup_method(self):
        """Reset trainer strikes before test"""
        TestSessionHelper.reset_trainer_strikes(TRAINER1_ID)
    
    def test_three_strikes_triggers_account_review(self):
        """After 3 strikes, trainer account flagged for review"""
        session_ids = []
        
        try:
            # Create 3 sessions and mark trainer as no-show for each
            for i in range(3):
                session_id = TestSessionHelper.create_test_session(
                    TRAINEE1_ID, TRAINER1_ID,
                    hours_from_now=-0.5,
                    price_cents=5000
                )
                session_ids.append(session_id)
                
                headers = AuthCache.get_auth_header("trainee1@test.com")
                response = requests.patch(
                    f"{BASE_URL}/api/sessions/{session_id}/no-show?who=trainer",
                    headers=headers
                )
                assert response.status_code == 200
                time.sleep(0.2)  # Small delay
            
            # Check trainer account is under review
            trainer = TestSessionHelper.get_user(TRAINER1_ID)
            assert trainer.get("performanceStrikes", 0) >= 3
            assert trainer.get("accountUnderReview") == True
            
            print(f"✓ 3-strike threshold: Account under review (strikes: {trainer.get('performanceStrikes')})")
            
        finally:
            for sid in session_ids:
                TestSessionHelper.delete_test_session(sid)
            TestSessionHelper.reset_trainer_strikes(TRAINER1_ID)


# ============================================================================
# GPS TRACKING TESTS
# ============================================================================
class TestGPSTracking:
    """Test GPS tracking endpoints"""
    
    def test_start_en_route(self):
        """POST /api/sessions/{id}/start-en-route - Changes status to en_route"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=1,
            price_cents=5000
        )
        
        try:
            headers = AuthCache.get_auth_header("trainer1@test.com")
            response = requests.post(
                f"{BASE_URL}/api/sessions/{session_id}/start-en-route",
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["success"] == True
            assert data["status"] == "en_route"
            assert "GPS tracking activated" in data["message"]
            
            # Verify session status in DB
            session = TestSessionHelper.get_session(session_id)
            assert session["status"] == "en_route"
            assert "enRouteStartedAt" in session
            
            print(f"✓ Start en-route: status={data['status']}")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)
    
    def test_gps_update_success(self):
        """POST /api/sessions/{id}/gps-update - Records GPS and returns alerts"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=1,
            price_cents=5000
        )
        
        try:
            # Start en-route first
            headers = AuthCache.get_auth_header("trainer1@test.com")
            requests.post(f"{BASE_URL}/api/sessions/{session_id}/start-en-route", headers=headers)
            
            # Send GPS update
            response = requests.post(
                f"{BASE_URL}/api/sessions/{session_id}/gps-update",
                params={"latitude": 40.7128, "longitude": -74.0060, "accuracy": 10},
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["success"] == True
            assert data["role"] == "trainer"
            assert data["sessionStatus"] == "en_route"
            assert "alerts" in data
            
            print(f"✓ GPS update: role={data['role']}, status={data['sessionStatus']}, alerts={len(data['alerts'])}")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)
    
    def test_gps_update_low_accuracy_alert(self):
        """POST /api/sessions/{id}/gps-update - Low accuracy triggers alert"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=1,
            price_cents=5000
        )
        
        try:
            headers = AuthCache.get_auth_header("trainer1@test.com")
            requests.post(f"{BASE_URL}/api/sessions/{session_id}/start-en-route", headers=headers)
            
            # Send GPS with low accuracy (>50m)
            response = requests.post(
                f"{BASE_URL}/api/sessions/{session_id}/gps-update",
                params={"latitude": 40.7128, "longitude": -74.0060, "accuracy": 100},
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Should have low_accuracy alert
            alert_types = [a["type"] for a in data.get("alerts", [])]
            assert "low_accuracy" in alert_types
            
            print(f"✓ GPS low accuracy alert: {data['alerts']}")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)
    
    def test_get_gps_track_active_session(self):
        """GET /api/sessions/{id}/gps-track - Returns live positions during active session"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=1,
            price_cents=5000
        )
        
        try:
            trainer_headers = AuthCache.get_auth_header("trainer1@test.com")
            trainee_headers = AuthCache.get_auth_header("trainee1@test.com")
            
            # Start en-route
            requests.post(f"{BASE_URL}/api/sessions/{session_id}/start-en-route", headers=trainer_headers)
            
            # Both parties send GPS
            requests.post(
                f"{BASE_URL}/api/sessions/{session_id}/gps-update",
                params={"latitude": 40.7128, "longitude": -74.0060, "accuracy": 10},
                headers=trainer_headers
            )
            requests.post(
                f"{BASE_URL}/api/sessions/{session_id}/gps-update",
                params={"latitude": 40.7130, "longitude": -74.0062, "accuracy": 10},
                headers=trainee_headers
            )
            
            # Get GPS track
            response = requests.get(
                f"{BASE_URL}/api/sessions/{session_id}/gps-track",
                headers=trainer_headers
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["tracking"] == True
            assert data["sessionStatus"] == "en_route"
            assert "trainer" in data
            assert "trainee" in data
            assert "distanceMiles" in data
            
            print(f"✓ GPS track: trainer={data['trainer']}, trainee={data['trainee']}, distance={data['distanceMiles']} mi")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)
    
    def test_gps_track_privacy_cancelled_session(self):
        """GET /api/sessions/{id}/gps-track - Returns tracking=false for cancelled sessions"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=24,
            price_cents=5000
        )
        
        try:
            headers = AuthCache.get_auth_header("trainee1@test.com")
            
            # Cancel session
            requests.patch(f"{BASE_URL}/api/sessions/{session_id}/cancel", headers=headers)
            
            # Try to get GPS track
            response = requests.get(
                f"{BASE_URL}/api/sessions/{session_id}/gps-track",
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["tracking"] == False
            
            print(f"✓ GPS privacy: cancelled session returns tracking=false")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)


# ============================================================================
# GPS CONFIRM DISTANCE TESTS
# ============================================================================
class TestGPSConfirmDistance:
    """Test GPS confirm with distance thresholds"""
    
    def test_confirm_gps_outdoor_within_025_miles(self):
        """POST /api/sessions/{id}/confirm-gps - Outdoor session within 0.25mi succeeds"""
        # Create session at specific location
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=1,
            session_type="outdoor",
            price_cents=5000,
            trainee_lat=40.7128,
            trainee_lon=-74.0060
        )
        
        try:
            headers = AuthCache.get_auth_header("trainer1@test.com")
            
            # Trainer at same location (within 0.25mi)
            response = requests.post(
                f"{BASE_URL}/api/sessions/{session_id}/confirm-gps",
                params={"latitude": 40.7128, "longitude": -74.0060},
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["success"] == True
            assert "Location confirmed" in data["message"]
            
            print(f"✓ GPS confirm outdoor: success (within 0.25mi)")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)
    
    def test_confirm_gps_outdoor_too_far(self):
        """POST /api/sessions/{id}/confirm-gps - Outdoor session >0.25mi fails"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=1,
            session_type="outdoor",
            price_cents=5000,
            trainee_lat=40.7128,
            trainee_lon=-74.0060
        )
        
        try:
            headers = AuthCache.get_auth_header("trainer1@test.com")
            
            # Trainer far away (~1 mile)
            response = requests.post(
                f"{BASE_URL}/api/sessions/{session_id}/confirm-gps",
                params={"latitude": 40.7260, "longitude": -74.0060},  # ~1 mile north
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["success"] == False
            assert "away" in data["message"]
            assert data["requiredMiles"] == 0.25
            
            print(f"✓ GPS confirm outdoor too far: {data['distanceMiles']:.2f}mi (need ≤0.25mi)")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)
    
    def test_confirm_gps_at_home_stricter_threshold(self):
        """POST /api/sessions/{id}/confirm-gps - At-home session threshold is 0.1mi"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=1,
            session_type="trainee_home",  # At-home session
            price_cents=6000,
            trainee_lat=40.7128,
            trainee_lon=-74.0060
        )
        
        try:
            headers = AuthCache.get_auth_header("trainer1@test.com")
            
            # Trainer ~0.15 miles away (should fail for at-home, would pass for outdoor)
            response = requests.post(
                f"{BASE_URL}/api/sessions/{session_id}/confirm-gps",
                params={"latitude": 40.7150, "longitude": -74.0060},
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # For at-home, must be within 0.1 miles
            assert data["requiredMiles"] == 0.1
            
            print(f"✓ GPS confirm at-home: threshold=0.1mi, distance={data.get('distanceMiles', 0):.3f}mi")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)


# ============================================================================
# SESSION STATUS TRANSITIONS
# ============================================================================
class TestSessionStatusTransitions:
    """Test session status transitions"""
    
    def test_start_session_in_progress(self):
        """POST /api/sessions/{id}/start-session - Changes to in_progress"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=1,
            price_cents=5000
        )
        
        try:
            headers = AuthCache.get_auth_header("trainer1@test.com")
            
            # Start session (can go directly from confirmed)
            response = requests.post(
                f"{BASE_URL}/api/sessions/{session_id}/start-session",
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["success"] == True
            assert data["status"] == "in_progress"
            
            # Verify in DB
            session = TestSessionHelper.get_session(session_id)
            assert session["status"] == "in_progress"
            
            print(f"✓ Start session: status=in_progress")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)
    
    def test_full_session_flow_en_route_to_in_progress(self):
        """Full flow: confirmed → en_route → in_progress"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=1,
            price_cents=5000
        )
        
        try:
            headers = AuthCache.get_auth_header("trainer1@test.com")
            
            # 1. Confirmed → En Route
            response = requests.post(f"{BASE_URL}/api/sessions/{session_id}/start-en-route", headers=headers)
            assert response.status_code == 200
            assert response.json()["status"] == "en_route"
            
            # 2. En Route → In Progress
            response = requests.post(f"{BASE_URL}/api/sessions/{session_id}/start-session", headers=headers)
            assert response.status_code == 200
            assert response.json()["status"] == "in_progress"
            
            print(f"✓ Full flow: confirmed → en_route → in_progress")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)


# ============================================================================
# EDGE CASES AND ERROR HANDLING
# ============================================================================
class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_cancel_already_cancelled_session(self):
        """Cannot cancel an already cancelled session"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=24,
            price_cents=5000
        )
        
        try:
            headers = AuthCache.get_auth_header("trainee1@test.com")
            
            # First cancel
            response = requests.patch(f"{BASE_URL}/api/sessions/{session_id}/cancel", headers=headers)
            assert response.status_code == 200
            
            # Second cancel should fail
            response = requests.patch(f"{BASE_URL}/api/sessions/{session_id}/cancel", headers=headers)
            assert response.status_code == 400
            assert "already cancelled" in response.json()["detail"].lower()
            
            print(f"✓ Cannot cancel already cancelled session")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)
    
    def test_unauthorized_cancel(self):
        """Cannot cancel someone else's session"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=24,
            price_cents=5000
        )
        
        try:
            # Try to cancel with trainer2 (not a participant)
            headers = AuthCache.get_auth_header("trainer2@test.com")
            response = requests.patch(f"{BASE_URL}/api/sessions/{session_id}/cancel", headers=headers)
            
            assert response.status_code == 403
            
            print(f"✓ Unauthorized cancel blocked: 403")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)
    
    def test_invalid_no_show_who_parameter(self):
        """Invalid 'who' parameter returns 400"""
        session_id = TestSessionHelper.create_test_session(
            TRAINEE1_ID, TRAINER1_ID,
            hours_from_now=-0.5,
            price_cents=5000
        )
        
        try:
            headers = AuthCache.get_auth_header("trainer1@test.com")
            response = requests.patch(
                f"{BASE_URL}/api/sessions/{session_id}/no-show?who=invalid",
                headers=headers
            )
            
            assert response.status_code == 400
            
            print(f"✓ Invalid 'who' parameter returns 400")
            
        finally:
            TestSessionHelper.delete_test_session(session_id)


# ============================================================================
# CLEANUP
# ============================================================================
@pytest.fixture(scope="session", autouse=True)
def cleanup_after_tests():
    """Cleanup after all tests"""
    yield
    TestSessionHelper.reset_trainer_strikes(TRAINER1_ID)
    TestSessionHelper.delete_session_credits(TRAINEE1_ID)
    AuthCache.clear_cache()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
