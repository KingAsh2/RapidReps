"""
Iteration 52: Test verify-zelle endpoint creates notifications for trainee and trainer
Tests:
1. POST /api/admin/payments/verify-zelle/{session_id} creates notifications for both trainee and trainer
2. Trainee notification includes 'receipt' in body text
3. Trainer notification includes 'receipt' in body text
4. Notifications include data.action='view_receipt' and data.sessionId
5. Verify-zelle endpoint updates zellePaymentStatus to 'verified'
6. Verify-zelle endpoint creates a transaction record with paymentMethod='zelle'
7. Verify-zelle endpoint returns success response with newStatus
"""

import pytest
import requests
import os
from datetime import datetime, timedelta
from bson import ObjectId

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"


class TestVerifyZelleNotifications:
    """Test verify-zelle endpoint notification creation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        admin_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert admin_resp.status_code == 200, f"Admin login failed: {admin_resp.text}"
        self.admin_token = admin_resp.json()['access_token']
        self.admin_id = admin_resp.json()['user']['id']
        
        # Login as trainee
        trainee_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert trainee_resp.status_code == 200, f"Trainee login failed: {trainee_resp.text}"
        self.trainee_token = trainee_resp.json()['access_token']
        self.trainee_id = trainee_resp.json()['user']['id']
        
        # Login as trainer
        trainer_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert trainer_resp.status_code == 200, f"Trainer login failed: {trainer_resp.text}"
        self.trainer_token = trainer_resp.json()['access_token']
        self.trainer_id = trainer_resp.json()['user']['id']
        
        yield
        
        # Cleanup: Delete test session if created
        if hasattr(self, 'test_session_id'):
            self._cleanup_test_session()
    
    def _cleanup_test_session(self):
        """Cleanup test session from database"""
        # We'll leave cleanup to MongoDB TTL or manual cleanup
        pass
    
    def _create_test_session_with_zelle_sent(self):
        """Create a test session with zellePaymentStatus='sent' directly via MongoDB"""
        import pymongo
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.environ.get('DB_NAME', 'rapidreps')
        client = pymongo.MongoClient(mongo_url)
        db = client[db_name]
        
        session_doc = {
            'traineeId': self.trainee_id,
            'trainerId': self.trainer_id,
            'status': 'payment_pending',
            'sessionType': 'outdoor',
            'durationMinutes': 60,
            'priceCents': 5000,
            'totalCents': 5000,
            'zellePaymentStatus': 'sent',
            'zellePaymentSentAt': datetime.utcnow(),
            'zellePaymentSenderName': 'Test Trainee',
            'zellePaymentNotes': 'Test payment for iteration 52',
            'sessionDateTimeStart': datetime.utcnow() + timedelta(days=1),
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
        }
        
        result = db.sessions.insert_one(session_doc)
        self.test_session_id = str(result.inserted_id)
        client.close()
        return self.test_session_id
    
    def _get_notifications_for_user(self, user_token):
        """Get notifications for a user"""
        resp = self.session.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        if resp.status_code == 200:
            return resp.json().get('notifications', [])
        return []
    
    def _get_notification_count_before(self, user_token):
        """Get notification count before test"""
        notifs = self._get_notifications_for_user(user_token)
        return len(notifs)
    
    def test_01_verify_zelle_creates_trainee_notification(self):
        """Test that verify-zelle creates notification for trainee with 'receipt' in body"""
        # Create test session
        session_id = self._create_test_session_with_zelle_sent()
        
        # Get trainee notification count before
        trainee_notifs_before = self._get_notification_count_before(self.trainee_token)
        
        # Call verify-zelle endpoint
        resp = self.session.post(
            f"{BASE_URL}/api/admin/payments/verify-zelle/{session_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        assert resp.status_code == 200, f"Verify-zelle failed: {resp.text}"
        
        # Wait a moment for async notification creation
        import time
        time.sleep(1)
        
        # Get trainee notifications after
        trainee_notifs_after = self._get_notifications_for_user(self.trainee_token)
        
        # Find the new notification
        new_notifs = [n for n in trainee_notifs_after if n.get('data', {}).get('sessionId') == session_id]
        
        assert len(new_notifs) >= 1, f"Expected at least 1 new notification for trainee, got {len(new_notifs)}"
        
        # Check notification body contains 'receipt'
        notif = new_notifs[0]
        assert 'receipt' in notif.get('body', '').lower(), f"Trainee notification body should contain 'receipt': {notif.get('body')}"
        
        print(f"PASSED: Trainee notification created with body: {notif.get('body')}")
    
    def test_02_verify_zelle_creates_trainer_notification(self):
        """Test that verify-zelle creates notification for trainer with 'receipt' in body"""
        # Create test session
        session_id = self._create_test_session_with_zelle_sent()
        
        # Get trainer notification count before
        trainer_notifs_before = self._get_notification_count_before(self.trainer_token)
        
        # Call verify-zelle endpoint
        resp = self.session.post(
            f"{BASE_URL}/api/admin/payments/verify-zelle/{session_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        assert resp.status_code == 200, f"Verify-zelle failed: {resp.text}"
        
        # Wait a moment for async notification creation
        import time
        time.sleep(1)
        
        # Get trainer notifications after
        trainer_notifs_after = self._get_notifications_for_user(self.trainer_token)
        
        # Find the new notification
        new_notifs = [n for n in trainer_notifs_after if n.get('data', {}).get('sessionId') == session_id]
        
        assert len(new_notifs) >= 1, f"Expected at least 1 new notification for trainer, got {len(new_notifs)}"
        
        # Check notification body contains 'receipt'
        notif = new_notifs[0]
        assert 'receipt' in notif.get('body', '').lower(), f"Trainer notification body should contain 'receipt': {notif.get('body')}"
        
        print(f"PASSED: Trainer notification created with body: {notif.get('body')}")
    
    def test_03_notification_data_contains_view_receipt_action(self):
        """Test that notifications include data.action='view_receipt' and data.sessionId"""
        # Create test session
        session_id = self._create_test_session_with_zelle_sent()
        
        # Call verify-zelle endpoint
        resp = self.session.post(
            f"{BASE_URL}/api/admin/payments/verify-zelle/{session_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        assert resp.status_code == 200, f"Verify-zelle failed: {resp.text}"
        
        # Wait a moment for async notification creation
        import time
        time.sleep(1)
        
        # Check trainee notification data
        trainee_notifs = self._get_notifications_for_user(self.trainee_token)
        trainee_notif = next((n for n in trainee_notifs if n.get('data', {}).get('sessionId') == session_id), None)
        
        assert trainee_notif is not None, "Trainee notification not found"
        assert trainee_notif.get('data', {}).get('action') == 'view_receipt', f"Trainee notification should have action='view_receipt': {trainee_notif.get('data')}"
        assert trainee_notif.get('data', {}).get('sessionId') == session_id, f"Trainee notification should have sessionId: {trainee_notif.get('data')}"
        
        # Check trainer notification data
        trainer_notifs = self._get_notifications_for_user(self.trainer_token)
        trainer_notif = next((n for n in trainer_notifs if n.get('data', {}).get('sessionId') == session_id), None)
        
        assert trainer_notif is not None, "Trainer notification not found"
        assert trainer_notif.get('data', {}).get('action') == 'view_receipt', f"Trainer notification should have action='view_receipt': {trainer_notif.get('data')}"
        assert trainer_notif.get('data', {}).get('sessionId') == session_id, f"Trainer notification should have sessionId: {trainer_notif.get('data')}"
        
        print(f"PASSED: Both notifications have action='view_receipt' and sessionId={session_id}")
    
    def test_04_verify_zelle_updates_status_to_verified(self):
        """Test that verify-zelle updates zellePaymentStatus to 'verified'"""
        # Create test session
        session_id = self._create_test_session_with_zelle_sent()
        
        # Call verify-zelle endpoint
        resp = self.session.post(
            f"{BASE_URL}/api/admin/payments/verify-zelle/{session_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        assert resp.status_code == 200, f"Verify-zelle failed: {resp.text}"
        
        # Check session in database
        import pymongo
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.environ.get('DB_NAME', 'rapidreps')
        client = pymongo.MongoClient(mongo_url)
        db = client[db_name]
        
        session = db.sessions.find_one({"_id": ObjectId(session_id)})
        client.close()
        
        assert session is not None, "Session not found in database"
        assert session.get('zellePaymentStatus') == 'verified', f"zellePaymentStatus should be 'verified': {session.get('zellePaymentStatus')}"
        
        print(f"PASSED: zellePaymentStatus updated to 'verified'")
    
    def test_05_verify_zelle_creates_transaction_record(self):
        """Test that verify-zelle creates a transaction record with paymentMethod='zelle'"""
        # Create test session
        session_id = self._create_test_session_with_zelle_sent()
        
        # Call verify-zelle endpoint
        resp = self.session.post(
            f"{BASE_URL}/api/admin/payments/verify-zelle/{session_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        assert resp.status_code == 200, f"Verify-zelle failed: {resp.text}"
        
        # Check transaction in database
        import pymongo
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.environ.get('DB_NAME', 'rapidreps')
        client = pymongo.MongoClient(mongo_url)
        db = client[db_name]
        
        transaction = db.transactions.find_one({"sessionId": session_id})
        client.close()
        
        assert transaction is not None, "Transaction not found in database"
        assert transaction.get('paymentMethod') == 'zelle', f"paymentMethod should be 'zelle': {transaction.get('paymentMethod')}"
        assert transaction.get('transactionType') == 'session_payment', f"transactionType should be 'session_payment': {transaction.get('transactionType')}"
        assert transaction.get('status') == 'completed', f"status should be 'completed': {transaction.get('status')}"
        assert transaction.get('amountCents') == 5000, f"amountCents should be 5000: {transaction.get('amountCents')}"
        
        print(f"PASSED: Transaction record created with paymentMethod='zelle'")
    
    def test_06_verify_zelle_returns_success_with_new_status(self):
        """Test that verify-zelle returns success response with newStatus"""
        # Create test session
        session_id = self._create_test_session_with_zelle_sent()
        
        # Call verify-zelle endpoint
        resp = self.session.post(
            f"{BASE_URL}/api/admin/payments/verify-zelle/{session_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        assert resp.status_code == 200, f"Verify-zelle failed: {resp.text}"
        
        data = resp.json()
        assert data.get('success') == True, f"Response should have success=True: {data}"
        assert 'newStatus' in data, f"Response should have newStatus field: {data}"
        assert data.get('newStatus') == 'confirmed', f"newStatus should be 'confirmed': {data.get('newStatus')}"
        
        print(f"PASSED: Response has success=True and newStatus='confirmed'")
    
    def test_07_verify_zelle_requires_admin_auth(self):
        """Test that verify-zelle requires admin authentication"""
        # Create test session
        session_id = self._create_test_session_with_zelle_sent()
        
        # Try without auth
        resp = self.session.post(f"{BASE_URL}/api/admin/payments/verify-zelle/{session_id}")
        assert resp.status_code == 403, f"Should return 403 without auth: {resp.status_code}"
        
        # Try with trainee auth
        resp = self.session.post(
            f"{BASE_URL}/api/admin/payments/verify-zelle/{session_id}",
            headers={"Authorization": f"Bearer {self.trainee_token}"}
        )
        assert resp.status_code == 403, f"Should return 403 for trainee: {resp.status_code}"
        
        # Try with trainer auth
        resp = self.session.post(
            f"{BASE_URL}/api/admin/payments/verify-zelle/{session_id}",
            headers={"Authorization": f"Bearer {self.trainer_token}"}
        )
        assert resp.status_code == 403, f"Should return 403 for trainer: {resp.status_code}"
        
        print(f"PASSED: verify-zelle requires admin authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
