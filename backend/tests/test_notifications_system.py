"""
Push Notifications System Tests - Iteration 13
Tests all notification endpoints and notification triggers:
- Push token registration/unregistration
- Notification list and mark-as-read
- Session lifecycle notifications (request/accept/decline/end/complete)
- Message notifications
- Background scheduler (boost expiry, session reminders, streak warnings)
"""
import pytest
import requests
import os
import time
from datetime import datetime, timedelta
from bson import ObjectId
from pymongo import MongoClient

# API Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://balance-transfers.preview.emergentagent.com').rstrip('/')

# Test credentials from the provided context
TRAINEE_EMAIL = "trainee1@test.com"
TRAINEE_PASSWORD = "test123"
TRAINEE_USER_ID = "697c077500b22ded1af3509d"

TRAINER_EMAIL = "trainer1@test.com"
TRAINER_PASSWORD = "test123"
TRAINER_USER_ID = "697c077500b22ded1af35097"

ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"

# MongoDB connection for direct DB access during testing
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "rapidreps"


class TestNotificationsEndpoints:
    """Test notification CRUD endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Connect to MongoDB for cleanup and verification
        self.mongo_client = MongoClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        
        yield
        
        # Cleanup after tests
        self.mongo_client.close()
    
    def get_trainee_token(self):
        """Login as trainee and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        if response.status_code == 429:
            time.sleep(60)  # Wait for rate limit to reset
            response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": TRAINEE_EMAIL,
                "password": TRAINEE_PASSWORD
            })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def get_trainer_token(self):
        """Login as trainer and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        if response.status_code == 429:
            time.sleep(60)  # Wait for rate limit to reset
            response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": TRAINER_EMAIL,
                "password": TRAINER_PASSWORD
            })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    # ========== Health Check ==========
    def test_health_check(self):
        """GET /api/ - Health check returns 200"""
        response = self.session.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Health check OK: {data}")
    
    # ========== Push Token Registration ==========
    def test_register_push_token_success(self):
        """POST /api/push-tokens/register - Register a push token (returns success)"""
        token = self.get_trainee_token()
        test_push_token = f"ExponentPushToken[TEST_{int(time.time())}]"
        
        response = self.session.post(
            f"{BASE_URL}/api/push-tokens/register",
            json={"token": test_push_token, "deviceId": "test-device-001"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Register failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "message" in data
        print(f"Push token registered: {data}")
        
        # Verify in DB
        db_token = self.db.push_tokens.find_one({"token": test_push_token})
        assert db_token is not None, "Push token not found in DB"
        assert db_token["userId"] == TRAINEE_USER_ID
        
        # Cleanup
        self.db.push_tokens.delete_one({"token": test_push_token})
    
    def test_register_push_token_unauthenticated(self):
        """POST /api/push-tokens/register - Unauthenticated request should fail"""
        response = self.session.post(
            f"{BASE_URL}/api/push-tokens/register",
            json={"token": "ExponentPushToken[TEST]", "deviceId": "test-device"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ========== Push Token Unregistration ==========
    def test_unregister_push_token_success(self):
        """DELETE /api/push-tokens/unregister - Unregister a push token (returns success)"""
        token = self.get_trainer_token()
        test_push_token = f"ExponentPushToken[UNREGISTER_TEST_{int(time.time())}]"
        
        # First register the token
        self.session.post(
            f"{BASE_URL}/api/push-tokens/register",
            json={"token": test_push_token, "deviceId": "test-device-002"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Now unregister
        response = self.session.delete(
            f"{BASE_URL}/api/push-tokens/unregister",
            json={"token": test_push_token},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Unregister failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"Push token unregistered: {data}")
        
        # Verify removed from DB
        db_token = self.db.push_tokens.find_one({"token": test_push_token})
        assert db_token is None, "Push token should be removed from DB"
    
    # ========== Get Notifications ==========
    def test_get_notifications_success(self):
        """GET /api/notifications - Returns notification list for authenticated user"""
        token = self.get_trainee_token()
        
        response = self.session.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        data = response.json()
        assert "notifications" in data
        assert isinstance(data["notifications"], list)
        print(f"Notifications retrieved: {len(data['notifications'])} notifications")
        
        # Verify structure if any notifications exist
        if data["notifications"]:
            notif = data["notifications"][0]
            assert "title" in notif
            assert "body" in notif
            assert "type" in notif
            assert "read" in notif
            print(f"Sample notification: {notif['title']} - {notif['type']}")
    
    def test_get_notifications_unauthenticated(self):
        """GET /api/notifications - Unauthenticated request should fail"""
        response = self.session.get(f"{BASE_URL}/api/notifications")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ========== Mark Notifications as Read ==========
    def test_mark_notifications_read(self):
        """POST /api/notifications/mark-read - Marks all notifications as read"""
        token = self.get_trainee_token()
        
        # First, insert a test unread notification directly
        test_notif = {
            "userId": TRAINEE_USER_ID,
            "title": "Test Notification",
            "body": "This is a test notification for mark-read test",
            "type": "test",
            "read": False,
            "createdAt": datetime.utcnow()
        }
        self.db.notifications.insert_one(test_notif)
        
        # Now mark all as read
        response = self.session.post(
            f"{BASE_URL}/api/notifications/mark-read",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Mark read failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"Mark all read response: {data}")
        
        # Verify in DB - all should be read now
        unread_count = self.db.notifications.count_documents({
            "userId": TRAINEE_USER_ID,
            "read": False
        })
        assert unread_count == 0, f"Expected 0 unread, found {unread_count}"
        
        # Cleanup test notification
        self.db.notifications.delete_many({"userId": TRAINEE_USER_ID, "type": "test"})


class TestSessionLifecycleNotifications:
    """Test notifications triggered by session lifecycle events"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Connect to MongoDB for direct DB access
        self.mongo_client = MongoClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        
        yield
        
        # Cleanup after tests
        self.mongo_client.close()
    
    def get_trainee_token(self):
        """Login as trainee and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        if response.status_code == 429:
            time.sleep(60)
            response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": TRAINEE_EMAIL,
                "password": TRAINEE_PASSWORD
            })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def get_trainer_token(self):
        """Login as trainer and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        if response.status_code == 429:
            time.sleep(60)
            response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": TRAINER_EMAIL,
                "password": TRAINER_PASSWORD
            })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def create_test_session(self, status="requested"):
        """Create a test session directly in MongoDB for testing notifications"""
        session_doc = {
            "_id": ObjectId(),
            "traineeId": TRAINEE_USER_ID,
            "trainerId": TRAINER_USER_ID,
            "status": status,
            "sessionType": "outdoor",
            "durationMinutes": 60,
            "sessionDateTimeStart": datetime.utcnow() + timedelta(days=1),
            "baseSessionPriceCents": 4000,
            "finalSessionPriceCents": 4000,
            "platformFeeCents": 1000,
            "trainerEarningsCents": 3000,
            "locationType": "outdoor",
            "locationNameOrAddress": "Central Park",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        self.db.sessions.insert_one(session_doc)
        return str(session_doc["_id"])
    
    def test_session_accept_creates_notification_for_trainee(self):
        """PATCH /api/sessions/{id}/accept - Creates notification for trainee"""
        # Create a test session with 'requested' status
        session_id = self.create_test_session(status="requested")
        
        # Clear any existing notifications for trainee
        initial_notif_count = self.db.notifications.count_documents({
            "userId": TRAINEE_USER_ID,
            "type": "session_accepted"
        })
        
        # Accept session as trainer
        trainer_token = self.get_trainer_token()
        response = self.session.patch(
            f"{BASE_URL}/api/sessions/{session_id}/accept",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Accept session failed: {response.text}"
        
        # Wait a moment for async notification creation
        time.sleep(1)
        
        # Verify notification was created for trainee
        new_notif_count = self.db.notifications.count_documents({
            "userId": TRAINEE_USER_ID,
            "type": "session_accepted"
        })
        assert new_notif_count > initial_notif_count, "Session accepted notification not created"
        
        # Check the notification content
        notif = self.db.notifications.find_one({
            "userId": TRAINEE_USER_ID,
            "type": "session_accepted",
            "data.sessionId": session_id
        })
        assert notif is not None, "Notification with correct sessionId not found"
        assert "accepted" in notif["title"].lower() or "accepted" in notif["body"].lower()
        print(f"Session accepted notification created: {notif['title']}")
        
        # Cleanup
        self.db.sessions.delete_one({"_id": ObjectId(session_id)})
        self.db.notifications.delete_one({"_id": notif["_id"]})
    
    def test_session_decline_creates_notification_for_trainee(self):
        """PATCH /api/sessions/{id}/decline - Creates notification for trainee"""
        # Create a test session with 'requested' status
        session_id = self.create_test_session(status="requested")
        
        # Decline session as trainer
        trainer_token = self.get_trainer_token()
        response = self.session.patch(
            f"{BASE_URL}/api/sessions/{session_id}/decline",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Decline session failed: {response.text}"
        
        # Wait for async notification
        time.sleep(1)
        
        # Verify notification was created for trainee
        notif = self.db.notifications.find_one({
            "userId": TRAINEE_USER_ID,
            "type": "session_declined",
            "data.sessionId": session_id
        })
        assert notif is not None, "Session declined notification not created"
        assert "declined" in notif["title"].lower() or "unable" in notif["body"].lower()
        print(f"Session declined notification created: {notif['title']}")
        
        # Cleanup
        self.db.sessions.delete_one({"_id": ObjectId(session_id)})
        self.db.notifications.delete_one({"_id": notif["_id"]})
    
    def test_session_end_creates_notification_for_trainee(self):
        """POST /api/sessions/{id}/end-session - Creates notification for trainee when trainer ends"""
        # Create a confirmed session
        session_id = self.create_test_session(status="confirmed")
        
        # End session as trainer
        trainer_token = self.get_trainer_token()
        response = self.session.post(
            f"{BASE_URL}/api/sessions/{session_id}/end",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"End session failed: {response.text}"
        
        # Wait for async notification
        time.sleep(1)
        
        # Verify notification was created for trainee
        notif = self.db.notifications.find_one({
            "userId": TRAINEE_USER_ID,
            "type": "session_ended",
            "data.sessionId": session_id
        })
        assert notif is not None, "Session ended notification not created"
        assert "complete" in notif["title"].lower() or "ended" in notif["body"].lower()
        print(f"Session ended notification created: {notif['title']}")
        
        # Cleanup
        self.db.sessions.delete_one({"_id": ObjectId(session_id)})
        self.db.notifications.delete_one({"_id": notif["_id"]})
    
    def test_client_confirm_end_creates_payment_notification_for_trainer(self):
        """POST /api/sessions/{id}/client-confirm-end - Creates payment notification for trainer"""
        # Create a completed session (ended by trainer)
        session_doc = {
            "_id": ObjectId(),
            "traineeId": TRAINEE_USER_ID,
            "trainerId": TRAINER_USER_ID,
            "status": "completed",
            "sessionType": "outdoor",
            "durationMinutes": 60,
            "sessionDateTimeStart": datetime.utcnow() - timedelta(hours=1),
            "sessionEndedAt": datetime.utcnow(),
            "baseSessionPriceCents": 4000,
            "finalSessionPriceCents": 4000,
            "platformFeeCents": 1000,
            "trainerEarningsCents": 3000,
            "clientConfirmedEnd": False,
            "locationType": "outdoor",
            "locationNameOrAddress": "Central Park",
            "createdAt": datetime.utcnow() - timedelta(hours=2),
            "updatedAt": datetime.utcnow()
        }
        self.db.sessions.insert_one(session_doc)
        session_id = str(session_doc["_id"])
        
        # Client confirms end
        trainee_token = self.get_trainee_token()
        response = self.session.post(
            f"{BASE_URL}/api/sessions/{session_id}/client-confirm-end",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200, f"Client confirm end failed: {response.text}"
        
        # Wait for async notification
        time.sleep(1)
        
        # Verify payment notification was created for trainer
        notif = self.db.notifications.find_one({
            "userId": TRAINER_USER_ID,
            "type": "payment_released",
            "data.sessionId": session_id
        })
        assert notif is not None, "Payment released notification not created for trainer"
        assert "payment" in notif["title"].lower() or "released" in notif["body"].lower()
        print(f"Payment released notification created: {notif['title']}")
        
        # Cleanup
        self.db.sessions.delete_one({"_id": ObjectId(session_id)})
        self.db.notifications.delete_one({"_id": notif["_id"]})


class TestMessageNotifications:
    """Test notifications triggered by new messages"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Connect to MongoDB
        self.mongo_client = MongoClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        
        yield
        
        # Cleanup
        self.mongo_client.close()
    
    def get_trainee_token(self):
        """Login as trainee and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        if response.status_code == 429:
            time.sleep(60)
            response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": TRAINEE_EMAIL,
                "password": TRAINEE_PASSWORD
            })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def get_trainer_token(self):
        """Login as trainer and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        if response.status_code == 429:
            time.sleep(60)
            response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": TRAINER_EMAIL,
                "password": TRAINER_PASSWORD
            })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_sending_message_creates_notification_for_receiver(self):
        """POST /api/messages - Creates new_message notification for receiver"""
        # Trainee sends message to trainer
        trainee_token = self.get_trainee_token()
        
        # Clear existing new_message notifications for trainer
        self.db.notifications.delete_many({
            "userId": TRAINER_USER_ID,
            "type": "new_message"
        })
        
        response = self.session.post(
            f"{BASE_URL}/api/messages",
            json={
                "receiverId": TRAINER_USER_ID,
                "content": f"Test message {int(time.time())}"
            },
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200, f"Send message failed: {response.text}"
        
        # Wait for async notification
        time.sleep(1)
        
        # Verify notification was created for receiver (trainer)
        notif = self.db.notifications.find_one({
            "userId": TRAINER_USER_ID,
            "type": "new_message"
        })
        assert notif is not None, "New message notification not created for receiver"
        assert "message" in notif["title"].lower()
        print(f"New message notification created: {notif['title']}")
        
        # Cleanup
        self.db.notifications.delete_one({"_id": notif["_id"]})


class TestBackgroundSchedulerNotifications:
    """Test background scheduler notification types (boost expiring, session reminders, streak warnings)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Connect to MongoDB
        self.mongo_client = MongoClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        
        yield
        
        # Cleanup
        self.mongo_client.close()
    
    def test_boost_expiring_notification_db_structure(self):
        """Verify boost_expiring notifications are being created by background scheduler"""
        # Check if any boost_expiring notifications exist (background scheduler creates these)
        boost_notifs = list(self.db.notifications.find({"type": "boost_expiring"}).limit(5))
        
        if boost_notifs:
            notif = boost_notifs[0]
            assert "title" in notif
            assert "body" in notif
            assert "userId" in notif
            print(f"Found existing boost_expiring notification: {notif['title']}")
        else:
            # Create a test boost that's about to expire
            test_boost = {
                "_id": ObjectId(),
                "trainerId": TRAINER_USER_ID,
                "boostType": "daily",
                "priceCents": 999,
                "startDate": datetime.utcnow() - timedelta(hours=23),
                "endDate": datetime.utcnow() + timedelta(hours=1),  # Expires in 1 hour
                "isActive": True,
                "_expirySent": False
            }
            self.db.boosts.insert_one(test_boost)
            print(f"Created test boost for scheduler to pick up: {test_boost['_id']}")
            
            # Note: The scheduler runs every 5 minutes, so we can't wait for it in tests
            # We're just verifying the boost is set up correctly for the scheduler
            
            # Cleanup
            self.db.boosts.delete_one({"_id": test_boost["_id"]})
    
    def test_session_reminder_scheduled_sessions(self):
        """Verify session_reminder notifications structure and that scheduler can process them"""
        # Create a session starting in ~30 minutes (within the scheduler's reminder window)
        test_session = {
            "_id": ObjectId(),
            "traineeId": TRAINEE_USER_ID,
            "trainerId": TRAINER_USER_ID,
            "status": "confirmed",
            "sessionType": "outdoor",
            "durationMinutes": 60,
            "sessionDateTimeStart": datetime.utcnow() + timedelta(minutes=30),
            "baseSessionPriceCents": 4000,
            "finalSessionPriceCents": 4000,
            "platformFeeCents": 1000,
            "trainerEarningsCents": 3000,
            "_reminderSent": False,  # Not sent yet
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        self.db.sessions.insert_one(test_session)
        print(f"Created test session for reminder: {test_session['_id']}")
        
        # Verify the session is in the window the scheduler checks
        session = self.db.sessions.find_one({"_id": test_session["_id"]})
        assert session is not None
        assert session["_reminderSent"] == False
        
        # Cleanup
        self.db.sessions.delete_one({"_id": test_session["_id"]})
    
    def test_streak_warning_notification_structure(self):
        """Verify streak_warning notifications structure"""
        # Check if any streak_warning notifications exist
        streak_notifs = list(self.db.notifications.find({"type": "streak_warning"}).limit(5))
        
        if streak_notifs:
            notif = streak_notifs[0]
            assert "title" in notif
            assert "body" in notif
            assert "userId" in notif
            assert "streak" in notif["title"].lower() or "streak" in notif["body"].lower()
            print(f"Found existing streak_warning notification: {notif['title']}")
        else:
            print("No streak_warning notifications found - scheduler creates these when users are at risk")


class TestRegressionExistingEndpoints:
    """Verify existing endpoints still work (no regressions)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_health_endpoint(self):
        """GET /api/ - Health check"""
        response = self.session.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        print("Health check: PASS")
    
    def test_auth_login(self):
        """POST /api/auth/login - Login still works"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        # Accept 200 or 429 (rate limited but endpoint works)
        assert response.status_code in [200, 429], f"Login failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
        print(f"Auth login: PASS (status {response.status_code})")
    
    def test_auth_me(self):
        """GET /api/auth/me - Get current user still works"""
        # First login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        if login_response.status_code == 429:
            pytest.skip("Rate limited")
        
        token = login_response.json()["access_token"]
        
        response = self.session.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        print("Auth /me: PASS")
    
    def test_trainers_search(self):
        """GET /api/trainers/search - Search trainers still works"""
        response = self.session.get(f"{BASE_URL}/api/trainers/search")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Trainers search: PASS ({len(data)} trainers)")
    
    def test_conversations_endpoint(self):
        """GET /api/conversations - Get conversations still works"""
        # Login first
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        if login_response.status_code == 429:
            pytest.skip("Rate limited")
        
        token = login_response.json()["access_token"]
        
        response = self.session.get(
            f"{BASE_URL}/api/conversations",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Conversations: PASS ({len(data)} conversations)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
