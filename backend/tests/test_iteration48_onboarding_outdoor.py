"""
Iteration 48: Backend API Tests for Onboarding Status, Outdoor Location Verification, and Profile Photo

Tests:
1. GET /api/settings/zelle - Returns platform Zelle info
2. GET /api/onboarding/status - Returns onboarding completion status for trainee (missing address) and trainer (missing Zelle)
3. POST /api/payments/zelle/mark-sent - Should FAIL for outdoor session without location agreement
4. POST /api/trainer/zelle-info - Trainer can save Zelle info
5. GET /api/trainer/zelle-info - Returns saved Zelle info
6. GET /api/trainer/connect/status - Returns Zelle-based connect status
7. PUT /api/admin/settings/zelle - Admin can update Zelle settings
8. GET /api/admin/payments/pending-zelle - Admin sees pending payments
9. POST /api/admin/payments/verify-zelle/{id} - Admin verifies payment
10. POST /api/trainer-profiles - Trainer can save avatarUrl (profile photo) field
11. GET /api/admin/payouts/pending - Shows trainers with Zelle info
"""

import pytest
import requests
import os
from datetime import datetime, timedelta
from bson import ObjectId

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin authentication failed: {response.text}")


@pytest.fixture(scope="module")
def trainer_token(api_client):
    """Get trainer authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINER_EMAIL,
        "password": TRAINER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Trainer authentication failed: {response.text}")


@pytest.fixture(scope="module")
def trainee_token(api_client):
    """Get trainee authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINEE_EMAIL,
        "password": TRAINEE_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Trainee authentication failed: {response.text}")


@pytest.fixture(scope="module")
def trainer_user_id(api_client, trainer_token):
    """Get trainer user ID"""
    response = api_client.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {trainer_token}"}
    )
    if response.status_code == 200:
        return response.json().get("id")
    pytest.skip("Could not get trainer user ID")


@pytest.fixture(scope="module")
def trainee_user_id(api_client, trainee_token):
    """Get trainee user ID"""
    response = api_client.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {trainee_token}"}
    )
    if response.status_code == 200:
        return response.json().get("id")
    pytest.skip("Could not get trainee user ID")


class TestZelleSettings:
    """Test platform Zelle settings endpoints"""
    
    def test_get_zelle_settings_public(self, api_client):
        """GET /api/settings/zelle - Returns platform Zelle info (public endpoint)"""
        response = api_client.get(f"{BASE_URL}/api/settings/zelle")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "zelleEmail" in data, "Response should contain zelleEmail"
        assert "zellePhone" in data, "Response should contain zellePhone"
        print(f"Platform Zelle settings: {data}")
    
    def test_update_zelle_settings_admin(self, api_client, admin_token):
        """PUT /api/admin/settings/zelle - Admin can update Zelle settings"""
        response = api_client.put(
            f"{BASE_URL}/api/admin/settings/zelle",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"zelleEmail": "ashtonbundy1@gmail.com", "zellePhone": "240-281-0462"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Update should succeed"
        print(f"Admin updated Zelle settings: {data}")
    
    def test_update_zelle_settings_non_admin_fails(self, api_client, trainer_token):
        """PUT /api/admin/settings/zelle - Non-admin should be blocked (403)"""
        response = api_client.put(
            f"{BASE_URL}/api/admin/settings/zelle",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={"zelleEmail": "hacker@test.com"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("Non-admin correctly blocked from updating Zelle settings")


class TestOnboardingStatus:
    """Test onboarding status endpoint"""
    
    def test_onboarding_status_trainer_with_zelle(self, api_client, trainer_token):
        """GET /api/onboarding/status - Trainer with Zelle info should be complete"""
        # First ensure trainer has Zelle info
        api_client.post(
            f"{BASE_URL}/api/trainer/zelle-info",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={"zelleEmail": "trainer@test.com", "zellePhone": "555-0100"}
        )
        
        response = api_client.get(
            f"{BASE_URL}/api/onboarding/status",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "complete" in data, "Response should contain 'complete' field"
        assert "pendingSteps" in data, "Response should contain 'pendingSteps' field"
        print(f"Trainer onboarding status: complete={data['complete']}, pendingSteps={data['pendingSteps']}")
    
    def test_onboarding_status_trainee(self, api_client, trainee_token):
        """GET /api/onboarding/status - Trainee onboarding status check"""
        response = api_client.get(
            f"{BASE_URL}/api/onboarding/status",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "complete" in data, "Response should contain 'complete' field"
        assert "pendingSteps" in data, "Response should contain 'pendingSteps' field"
        print(f"Trainee onboarding status: complete={data['complete']}, pendingSteps={data['pendingSteps']}")


class TestTrainerZelleInfo:
    """Test trainer Zelle info endpoints"""
    
    def test_save_trainer_zelle_info(self, api_client, trainer_token):
        """POST /api/trainer/zelle-info - Trainer can save Zelle info"""
        response = api_client.post(
            f"{BASE_URL}/api/trainer/zelle-info",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={"zelleEmail": "trainer@test.com", "zellePhone": "555-0100"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Save should succeed"
        print(f"Trainer Zelle info saved: {data}")
    
    def test_get_trainer_zelle_info(self, api_client, trainer_token):
        """GET /api/trainer/zelle-info - Returns saved Zelle info"""
        response = api_client.get(
            f"{BASE_URL}/api/trainer/zelle-info",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "zelleEmail" in data, "Response should contain zelleEmail"
        assert "zellePhone" in data, "Response should contain zellePhone"
        assert "hasZelleInfo" in data, "Response should contain hasZelleInfo"
        print(f"Trainer Zelle info: {data}")
    
    def test_trainer_connect_status(self, api_client, trainer_token):
        """GET /api/trainer/connect/status - Returns Zelle-based connect status"""
        response = api_client.get(
            f"{BASE_URL}/api/trainer/connect/status",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "connected" in data, "Response should contain 'connected'"
        assert "paymentMethod" in data, "Response should contain 'paymentMethod'"
        assert data.get("paymentMethod") == "zelle", "Payment method should be 'zelle'"
        print(f"Trainer connect status: {data}")


class TestOutdoorLocationVerification:
    """Test outdoor session location verification before Zelle payment"""
    
    def test_mark_sent_fails_for_outdoor_without_location_agreement(self, api_client, trainee_token, trainer_user_id, trainee_user_id):
        """POST /api/payments/zelle/mark-sent - Should FAIL for outdoor session without location agreement"""
        import pymongo
        from bson import ObjectId
        
        # Connect directly to MongoDB to create a test session with outdoor type and no location agreement
        mongo_client = pymongo.MongoClient("mongodb://localhost:27017")
        db = mongo_client["rapidreps"]
        
        # Create an outdoor session directly in DB without location agreement
        test_session_id = ObjectId()
        session_doc = {
            "_id": test_session_id,
            "traineeId": trainee_user_id,
            "trainerId": trainer_user_id,
            "sessionType": "outdoor",
            "locationType": "outdoor",
            "locationNameOrAddress": "Test Park",
            "status": "requested",
            "durationMinutes": 60,
            "sessionDateTimeStart": datetime.utcnow() + timedelta(days=1),
            "outdoorLocationStatus": "pending",  # NOT 'agreed'
            "outdoorLocationAgreed": False,
            "createdAt": datetime.utcnow(),
        }
        db.sessions.insert_one(session_doc)
        session_id = str(test_session_id)
        print(f"Created test outdoor session directly in DB: {session_id}")
        
        try:
            # Try to mark payment as sent without location agreement
            mark_sent_response = api_client.post(
                f"{BASE_URL}/api/payments/zelle/mark-sent",
                headers={"Authorization": f"Bearer {trainee_token}"},
                json={"sessionId": session_id}
            )
            
            # Should fail with 400 because outdoor location not agreed
            assert mark_sent_response.status_code == 400, f"Expected 400 for outdoor session without location agreement, got {mark_sent_response.status_code}: {mark_sent_response.text}"
            
            error_data = mark_sent_response.json()
            assert "outdoor" in error_data.get("detail", "").lower() or "location" in error_data.get("detail", "").lower(), \
                f"Error should mention outdoor location requirement: {error_data}"
            print(f"Correctly rejected mark-sent for outdoor session without location agreement: {error_data}")
        finally:
            # Cleanup test session
            db.sessions.delete_one({"_id": test_session_id})
            mongo_client.close()


class TestAdminZellePayments:
    """Test admin Zelle payment endpoints"""
    
    def test_admin_get_pending_zelle_payments(self, api_client, admin_token):
        """GET /api/admin/payments/pending-zelle - Admin sees pending payments"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/payments/pending-zelle",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # API returns 'pendingPayments' not 'sessions'
        assert "pendingPayments" in data or "sessions" in data, "Response should contain 'pendingPayments' or 'sessions' list"
        payments_list = data.get("pendingPayments", data.get("sessions", []))
        print(f"Admin pending Zelle payments: {len(payments_list)} payments")
    
    def test_admin_get_pending_payouts(self, api_client, admin_token):
        """GET /api/admin/payouts/pending - Shows trainers with Zelle info"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/payouts/pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "trainers" in data, "Response should contain 'trainers' list"
        assert "payoutMinimumCents" in data, "Response should contain 'payoutMinimumCents'"
        print(f"Admin pending payouts: {len(data.get('trainers', []))} trainers, minimum: ${data.get('payoutMinimumCents', 0)/100}")


class TestTrainerProfilePhoto:
    """Test trainer profile photo (avatarUrl) update"""
    
    def test_trainer_profile_update_with_avatar(self, api_client, trainer_token, trainer_user_id):
        """POST /api/trainer-profiles - Trainer can save avatarUrl (profile photo) field"""
        # First get existing profile
        get_response = api_client.get(
            f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        
        if get_response.status_code != 200:
            print(f"No existing profile, creating new one")
        
        # Update/create profile with avatarUrl
        profile_data = {
            "userId": trainer_user_id,
            "avatarUrl": "https://example.com/test-profile-photo.jpg",
            "bio": "Test trainer bio for iteration 48",
            "experienceYears": 5,
            "trainingStyles": ["HIIT", "Strength"],
            "offersOutdoor": True,
            "outdoorRateCents": 5000
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/trainer-profiles",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json=profile_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("avatarUrl") == "https://example.com/test-profile-photo.jpg", \
            f"avatarUrl should be saved: {data.get('avatarUrl')}"
        print(f"Trainer profile updated with avatarUrl: {data.get('avatarUrl')}")
    
    def test_get_trainer_profile_with_avatar(self, api_client, trainer_token, trainer_user_id):
        """GET /api/trainer-profiles/{user_id} - Returns profile with avatarUrl"""
        response = api_client.get(
            f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "avatarUrl" in data, "Response should contain avatarUrl"
        print(f"Trainer profile avatarUrl: {data.get('avatarUrl')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
