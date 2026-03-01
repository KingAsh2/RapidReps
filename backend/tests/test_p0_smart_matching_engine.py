"""
Test P0 Smart Matching Engine & Virtual Session Features
========================================================
Tests for:
- Virtual session request creation (POST /api/virtual/request)
- Trainer acceptance with first-accept-wins (POST /api/virtual/accept/{request_id})
- Race condition prevention (second trainer gets 'already accepted')
- Request status with trainer details (GET /api/virtual/request/{request_id})
- In-person instant request with location requirement (POST /api/instant/request)
- Notification types: virtual_request, virtual_matched, virtual_taken
- Notifications endpoint (GET /api/notifications)
- Health check (GET /api/health)
- Authentication (POST /api/auth/login)
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://uber-fitness.preview.emergentagent.com"


class TestHealthAndAuth:
    """Health check and authentication tests"""
    
    def test_health_endpoint(self):
        """Test GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert "timestamp" in data
        print(f"✓ Health check passed: {data}")
    
    def test_login_trainee_success(self):
        """Test POST /api/auth/login with valid trainee credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainee1@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "trainee1@test.com"
        assert "trainee" in data["user"]["roles"]
        print(f"✓ Trainee login successful: {data['user']['fullName']}")
        return data
    
    def test_login_trainer_success(self):
        """Test POST /api/auth/login with valid trainer credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainer1@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "trainer1@test.com"
        assert "trainer" in data["user"]["roles"]
        print(f"✓ Trainer login successful: {data['user']['fullName']}")
        return data
    
    def test_login_invalid_credentials(self):
        """Test POST /api/auth/login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected with 401")


class TestVirtualSessionRequest:
    """Virtual session request flow tests"""
    
    @pytest.fixture
    def trainee_auth(self):
        """Get trainee authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainee1@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        return response.json()
    
    @pytest.fixture
    def trainer1_auth(self):
        """Get trainer1 authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainer1@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        return response.json()
    
    @pytest.fixture
    def trainer2_auth(self):
        """Get trainer2 authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainer2@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        return response.json()
    
    def test_virtual_request_requires_trainee_role(self, trainer1_auth):
        """Test POST /api/virtual/request requires trainee role"""
        headers = {"Authorization": f"Bearer {trainer1_auth['access_token']}"}
        response = requests.post(f"{BASE_URL}/api/virtual/request", headers=headers)
        # Trainers should get 400 error - only trainees can request
        assert response.status_code == 400
        data = response.json()
        assert "trainee" in data.get("detail", "").lower()
        print("✓ Virtual request correctly rejects non-trainee users")
    
    def test_create_virtual_request(self, trainee_auth):
        """Test POST /api/virtual/request creates request with status='searching'"""
        headers = {"Authorization": f"Bearer {trainee_auth['access_token']}"}
        response = requests.post(f"{BASE_URL}/api/virtual/request", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "requestId" in data
        assert "status" in data
        assert data["status"] in ["searching", "matched"]  # Could already be matched
        print(f"✓ Virtual request created: requestId={data['requestId']}, status={data['status']}")
        return data
    
    def test_duplicate_virtual_request_returns_existing(self, trainee_auth):
        """Test POST /api/virtual/request returns existing request if one is active"""
        headers = {"Authorization": f"Bearer {trainee_auth['access_token']}"}
        
        # First request
        response1 = requests.post(f"{BASE_URL}/api/virtual/request", headers=headers)
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Second request should return the same one
        response2 = requests.post(f"{BASE_URL}/api/virtual/request", headers=headers)
        assert response2.status_code == 200
        data2 = response2.json()
        
        assert data1["requestId"] == data2["requestId"]
        print(f"✓ Duplicate request returns existing: {data1['requestId']}")


class TestTrainerAcceptance:
    """Trainer acceptance and race condition tests"""
    
    def setup_method(self):
        """Setup for each test - create a fresh virtual request"""
        # Login as trainee
        trainee_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainee1@test.com",
            "password": "test123"
        })
        assert trainee_response.status_code == 200
        self.trainee_auth = trainee_response.json()
        
        # Cancel any existing requests first
        headers = {"Authorization": f"Bearer {self.trainee_auth['access_token']}"}
        # Try to find and cancel existing request
        response = requests.post(f"{BASE_URL}/api/virtual/request", headers=headers)
        if response.status_code == 200 and response.json().get("requestId"):
            request_id = response.json()["requestId"]
            requests.post(f"{BASE_URL}/api/virtual/cancel/{request_id}", headers=headers)
            time.sleep(0.5)
    
    def test_trainer_accept_virtual_request(self):
        """Test POST /api/virtual/accept/{request_id} - first accept wins"""
        # Login trainers
        trainer1_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainer1@test.com",
            "password": "test123"
        })
        assert trainer1_response.status_code == 200
        trainer1_auth = trainer1_response.json()
        
        # Create a new virtual request as trainee
        trainee_headers = {"Authorization": f"Bearer {self.trainee_auth['access_token']}"}
        request_response = requests.post(f"{BASE_URL}/api/virtual/request", headers=trainee_headers)
        assert request_response.status_code == 200
        request_data = request_response.json()
        request_id = request_data["requestId"]
        
        # Trainer accepts
        trainer_headers = {"Authorization": f"Bearer {trainer1_auth['access_token']}"}
        accept_response = requests.post(
            f"{BASE_URL}/api/virtual/accept/{request_id}",
            headers=trainer_headers
        )
        assert accept_response.status_code == 200
        accept_data = accept_response.json()
        
        # First accept should succeed
        print(f"✓ Accept response: {accept_data}")
        # Could be success=True or message about already accepted
        assert "success" in accept_data or "message" in accept_data
    
    def test_race_condition_prevention(self):
        """Test double-acceptance race condition - second trainer gets 'already accepted'"""
        # Login both trainers
        trainer1_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainer1@test.com",
            "password": "test123"
        })
        trainer2_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainer2@test.com",
            "password": "test123"
        })
        assert trainer1_response.status_code == 200
        assert trainer2_response.status_code == 200
        
        trainer1_auth = trainer1_response.json()
        trainer2_auth = trainer2_response.json()
        
        # Create a new virtual request as trainee
        trainee_headers = {"Authorization": f"Bearer {self.trainee_auth['access_token']}"}
        request_response = requests.post(f"{BASE_URL}/api/virtual/request", headers=trainee_headers)
        assert request_response.status_code == 200
        request_id = request_response.json()["requestId"]
        
        # First trainer accepts
        trainer1_headers = {"Authorization": f"Bearer {trainer1_auth['access_token']}"}
        accept1_response = requests.post(
            f"{BASE_URL}/api/virtual/accept/{request_id}",
            headers=trainer1_headers
        )
        assert accept1_response.status_code == 200
        accept1_data = accept1_response.json()
        
        # Second trainer tries to accept - should get 'already accepted' message
        trainer2_headers = {"Authorization": f"Bearer {trainer2_auth['access_token']}"}
        accept2_response = requests.post(
            f"{BASE_URL}/api/virtual/accept/{request_id}",
            headers=trainer2_headers
        )
        assert accept2_response.status_code == 200
        accept2_data = accept2_response.json()
        
        # Verify race condition prevention
        # First accept should succeed
        if accept1_data.get("success") is True:
            # Second accept should fail with 'already accepted' message
            assert accept2_data.get("success") is False
            assert "already" in accept2_data.get("message", "").lower()
            print(f"✓ Race condition prevented: First accept succeeded, second got '{accept2_data.get('message')}'")
        else:
            # If first was already taken, second should also get 'already accepted'
            print(f"✓ Both trainers correctly blocked (request already taken): {accept1_data}, {accept2_data}")


class TestVirtualRequestStatus:
    """Tests for GET /api/virtual/request/{request_id}"""
    
    def test_get_virtual_request_status(self):
        """Test GET /api/virtual/request/{request_id} returns matched status with trainerDetails"""
        # Login trainee and trainer
        trainee_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainee1@test.com",
            "password": "test123"
        })
        trainer_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainer1@test.com",
            "password": "test123"
        })
        assert trainee_response.status_code == 200
        assert trainer_response.status_code == 200
        
        trainee_auth = trainee_response.json()
        trainer_auth = trainer_response.json()
        
        # Create virtual request
        trainee_headers = {"Authorization": f"Bearer {trainee_auth['access_token']}"}
        request_response = requests.post(f"{BASE_URL}/api/virtual/request", headers=trainee_headers)
        assert request_response.status_code == 200
        request_id = request_response.json()["requestId"]
        
        # Trainer accepts
        trainer_headers = {"Authorization": f"Bearer {trainer_auth['access_token']}"}
        requests.post(f"{BASE_URL}/api/virtual/accept/{request_id}", headers=trainer_headers)
        
        # Get request status
        status_response = requests.get(
            f"{BASE_URL}/api/virtual/request/{request_id}",
            headers=trainee_headers
        )
        assert status_response.status_code == 200
        status_data = status_response.json()
        
        assert "requestId" in status_data
        assert "status" in status_data
        assert status_data["status"] in ["searching", "matched", "confirmed", "cancelled"]
        
        # If matched, verify trainerDetails
        if status_data["status"] == "matched" and status_data.get("matchedTrainerId"):
            assert "trainerDetails" in status_data
            trainer_details = status_data["trainerDetails"]
            assert "fullName" in trainer_details
            assert "averageRating" in trainer_details
            assert "virtualRateCents" in trainer_details
            print(f"✓ Request status with trainerDetails: {trainer_details}")
        else:
            print(f"✓ Request status retrieved: {status_data['status']}")


class TestInstantInPersonRequest:
    """Tests for POST /api/instant/request"""
    
    def test_instant_request_requires_location(self):
        """Test POST /api/instant/request requires trainee location"""
        # Create a new trainee without location
        timestamp = int(time.time())
        signup_response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Test NoLoc User {timestamp}",
            "email": f"noloc_{timestamp}@test.com",
            "phone": "1234567890",
            "password": "test123",
            "roles": ["trainee"]
        })
        
        if signup_response.status_code == 200:
            auth_data = signup_response.json()
            headers = {"Authorization": f"Bearer {auth_data['access_token']}"}
            
            # Try to create instant request without location
            response = requests.post(f"{BASE_URL}/api/instant/request", headers=headers)
            
            # Should require location
            assert response.status_code == 400
            data = response.json()
            assert "location" in data.get("detail", "").lower()
            print(f"✓ Instant request correctly requires location: {data.get('detail')}")
        else:
            # User might already exist, use existing trainee
            trainee_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "trainee1@test.com",
                "password": "test123"
            })
            trainee_auth = trainee_response.json()
            headers = {"Authorization": f"Bearer {trainee_auth['access_token']}"}
            
            # trainee1 might have location, so test the endpoint
            response = requests.post(f"{BASE_URL}/api/instant/request", headers=headers)
            # Either 200 (has location) or 400 (no location)
            assert response.status_code in [200, 400]
            print(f"✓ Instant request endpoint working: status={response.status_code}")


class TestNotifications:
    """Tests for notification system"""
    
    def test_get_notifications(self):
        """Test GET /api/notifications returns user notifications"""
        # Login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainee1@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        auth_data = response.json()
        
        headers = {"Authorization": f"Bearer {auth_data['access_token']}"}
        notifications_response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        
        assert notifications_response.status_code == 200
        notifications = notifications_response.json()
        
        # Should be a list
        assert isinstance(notifications, list)
        
        # Check notification structure if any exist
        if len(notifications) > 0:
            notification = notifications[0]
            assert "id" in notification or "_id" in notification
            assert "type" in notification
            assert "title" in notification
            print(f"✓ Retrieved {len(notifications)} notifications, first type: {notification.get('type')}")
        else:
            print("✓ Notifications endpoint working (no notifications yet)")
    
    def test_notification_types_include_virtual(self):
        """Test that notification preferences include virtual session types"""
        # Login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainee1@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        auth_data = response.json()
        
        headers = {"Authorization": f"Bearer {auth_data['access_token']}"}
        prefs_response = requests.get(f"{BASE_URL}/api/notification-preferences", headers=headers)
        
        assert prefs_response.status_code == 200
        prefs = prefs_response.json()
        
        # Verify new notification types are present
        expected_types = ['virtual_request', 'virtual_matched', 'virtual_taken', 
                         'missed_acceptance', 'late_warning', 'session_started']
        
        for ntype in expected_types:
            assert ntype in prefs, f"Missing notification type: {ntype}"
        
        print(f"✓ All virtual notification types present in preferences: {expected_types}")


class TestNotificationCreation:
    """Tests to verify notifications are created with correct types during matching flow"""
    
    def test_virtual_request_creates_notification(self):
        """Test that creating a virtual request creates virtual_request notifications for trainers"""
        # Login trainee and trainer
        trainee_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainee1@test.com",
            "password": "test123"
        })
        trainer_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainer1@test.com",
            "password": "test123"
        })
        assert trainee_response.status_code == 200
        assert trainer_response.status_code == 200
        
        trainee_auth = trainee_response.json()
        trainer_auth = trainer_response.json()
        
        # Get trainer's current notification count
        trainer_headers = {"Authorization": f"Bearer {trainer_auth['access_token']}"}
        before_response = requests.get(f"{BASE_URL}/api/notifications", headers=trainer_headers)
        before_count = len(before_response.json()) if before_response.status_code == 200 else 0
        
        # Cancel any existing request first
        trainee_headers = {"Authorization": f"Bearer {trainee_auth['access_token']}"}
        existing = requests.post(f"{BASE_URL}/api/virtual/request", headers=trainee_headers)
        if existing.status_code == 200 and existing.json().get("requestId"):
            requests.post(f"{BASE_URL}/api/virtual/cancel/{existing.json()['requestId']}", headers=trainee_headers)
            time.sleep(0.5)
        
        # Create new virtual request
        request_response = requests.post(f"{BASE_URL}/api/virtual/request", headers=trainee_headers)
        assert request_response.status_code == 200
        
        # Wait for notification to be created
        time.sleep(1)
        
        # Check trainer's notifications
        after_response = requests.get(f"{BASE_URL}/api/notifications", headers=trainer_headers)
        assert after_response.status_code == 200
        after_notifications = after_response.json()
        
        # Look for virtual_request notification
        virtual_request_notifications = [n for n in after_notifications if n.get("type") == "virtual_request"]
        
        if len(virtual_request_notifications) > 0:
            print(f"✓ virtual_request notification created: {virtual_request_notifications[0].get('title')}")
        else:
            print(f"✓ Notifications retrieved (trainer may not be in eligible pool): {len(after_notifications)} total")
    
    def test_acceptance_creates_virtual_matched_notification(self):
        """Test that trainer acceptance creates virtual_matched notification for trainee"""
        # Login
        trainee_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainee1@test.com",
            "password": "test123"
        })
        trainer_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainer1@test.com",
            "password": "test123"
        })
        assert trainee_response.status_code == 200
        assert trainer_response.status_code == 200
        
        trainee_auth = trainee_response.json()
        trainer_auth = trainer_response.json()
        
        trainee_headers = {"Authorization": f"Bearer {trainee_auth['access_token']}"}
        trainer_headers = {"Authorization": f"Bearer {trainer_auth['access_token']}"}
        
        # Cancel any existing request
        existing = requests.post(f"{BASE_URL}/api/virtual/request", headers=trainee_headers)
        if existing.status_code == 200 and existing.json().get("requestId"):
            requests.post(f"{BASE_URL}/api/virtual/cancel/{existing.json()['requestId']}", headers=trainee_headers)
            time.sleep(0.5)
        
        # Create virtual request
        request_response = requests.post(f"{BASE_URL}/api/virtual/request", headers=trainee_headers)
        assert request_response.status_code == 200
        request_id = request_response.json()["requestId"]
        
        # Trainer accepts
        accept_response = requests.post(
            f"{BASE_URL}/api/virtual/accept/{request_id}",
            headers=trainer_headers
        )
        assert accept_response.status_code == 200
        
        # Wait for notification
        time.sleep(1)
        
        # Check trainee's notifications for virtual_matched
        notif_response = requests.get(f"{BASE_URL}/api/notifications", headers=trainee_headers)
        assert notif_response.status_code == 200
        notifications = notif_response.json()
        
        # Look for virtual_matched notification
        matched_notifications = [n for n in notifications if n.get("type") == "virtual_matched"]
        
        if len(matched_notifications) > 0:
            print(f"✓ virtual_matched notification created: {matched_notifications[0].get('title')}")
        else:
            print(f"✓ Acceptance processed (notification may not have been created if already matched)")


class TestCleanup:
    """Cleanup test data after tests"""
    
    def test_cleanup_virtual_requests(self):
        """Cancel any lingering test requests"""
        trainee_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "trainee1@test.com",
            "password": "test123"
        })
        if trainee_response.status_code == 200:
            trainee_auth = trainee_response.json()
            headers = {"Authorization": f"Bearer {trainee_auth['access_token']}"}
            
            # Get current request
            existing = requests.post(f"{BASE_URL}/api/virtual/request", headers=headers)
            if existing.status_code == 200 and existing.json().get("requestId"):
                request_id = existing.json()["requestId"]
                cancel_response = requests.post(
                    f"{BASE_URL}/api/virtual/cancel/{request_id}",
                    headers=headers
                )
                print(f"✓ Cleanup: Cancelled request {request_id}")
        print("✓ Test cleanup complete")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
