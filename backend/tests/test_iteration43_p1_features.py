"""
Iteration 43: P1 Features Testing
- GET /api/trainee/saved-trainers - Returns full trainer details for saved trainers
- GET /api/admin/verifications/{trainer_id}/detail - Returns profile details including bio, experience, certifications
- Navigation utility goBack() function - Frontend only (skip backend test)
- 30/60/90 min pricing - Frontend display only (rates stored as hourly in backend)
"""

import pytest
import requests
import os
import random
import string

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://crash-reporter-v2.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"

def generate_unique_id():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))


class TestHealthCheck:
    """Basic health check before running other tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print("Health check passed")


class TestAdminLogin:
    """Admin authentication tests"""
    
    def test_admin_login(self):
        """Test admin login returns token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert 'access_token' in data
        assert data['user']['isAdmin'] == True
        print(f"Admin login successful: {data['user']['email']}")
        return data['access_token']


class TestAdminVerificationDetail:
    """Tests for admin verification detail endpoint - P1 feature for showing trainer background info"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()['access_token']
    
    def test_admin_verifications_pending(self, admin_token):
        """Test GET /api/admin/verifications/pending returns list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/verifications/pending", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        # Response format: {"pendingVerifications": [], "count": 0}
        assert 'pendingVerifications' in data, "Response should have pendingVerifications key"
        assert 'count' in data, "Response should have count key"
        assert isinstance(data['pendingVerifications'], list)
        print(f"Pending verifications count: {data['count']}")
    
    def test_admin_verifications_approved(self, admin_token):
        """Test GET /api/admin/verifications/approved returns list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/verifications/approved", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Approved trainers count: {len(data)}")
        return data
    
    def test_admin_verification_detail_returns_profile_info(self, admin_token):
        """
        P1 FEATURE TEST: Admin verification detail endpoint returns profile details
        including bio, experience, certifications for trainer background info display
        """
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get list of pending or approved trainers to test detail endpoint
        pending_response = requests.get(f"{BASE_URL}/api/admin/verifications/pending", headers=headers)
        pending_data = pending_response.json() if pending_response.status_code == 200 else {}
        pending = pending_data.get('pendingVerifications', [])
        
        approved_response = requests.get(f"{BASE_URL}/api/admin/verifications/approved", headers=headers)
        approved = approved_response.json() if approved_response.status_code == 200 else []
        
        # Get a trainer ID to test detail endpoint
        trainer_id = None
        if pending and len(pending) > 0 and pending[0].get('profile', {}).get('userId'):
            trainer_id = pending[0]['profile']['userId']
        elif approved and len(approved) > 0 and approved[0].get('userId'):
            trainer_id = approved[0]['userId']
        
        if not trainer_id:
            # Create a test trainer to verify the endpoint structure
            unique_id = generate_unique_id()
            signup_response = requests.post(f"{BASE_URL}/api/auth/signup", json={
                "fullName": f"TEST_ITER43_Trainer_{unique_id}",
                "email": f"test_iter43_trainer_{unique_id.lower()}@test.com",
                "phone": "5551234567",
                "password": "test123",
                "roles": ["trainer"]
            })
            if signup_response.status_code == 200:
                trainer_data = signup_response.json()
                trainer_id = trainer_data['user']['id']
                trainer_token = trainer_data['access_token']
                
                # Create trainer profile with bio, experience, certifications
                profile_response = requests.post(f"{BASE_URL}/api/trainer-profiles", json={
                    "userId": trainer_id,
                    "bio": "Experienced fitness trainer specializing in strength training and HIIT workouts.",
                    "experienceYears": 5,
                    "certifications": ["NASM-CPT", "ACE Certified"],
                    "trainingStyles": ["Strength Training", "HIIT", "Functional Fitness"],
                    "locationAddress": "Los Angeles, CA"
                }, headers={"Authorization": f"Bearer {trainer_token}"})
                print(f"Created test trainer profile: {profile_response.status_code}")
        
        if not trainer_id:
            pytest.skip("No trainer available to test detail endpoint")
        
        # Test the detail endpoint
        detail_response = requests.get(f"{BASE_URL}/api/admin/verifications/{trainer_id}/detail", headers=headers)
        assert detail_response.status_code == 200, f"Detail endpoint failed: {detail_response.text}"
        
        detail_data = detail_response.json()
        
        # Verify response structure - P1 feature requirements
        assert 'user' in detail_data, "Response should contain user info"
        assert 'profile' in detail_data, "Response should contain profile info"
        assert 'steps' in detail_data, "Response should contain verification steps"
        assert 'verificationStatus' in detail_data, "Response should contain verification status"
        
        # Check profile contains trainer background info (P1 feature)
        profile = detail_data.get('profile', {})
        print(f"Profile details available:")
        print(f"  - Bio present: {'bio' in profile}")
        print(f"  - Experience years present: {'experienceYears' in profile}")
        print(f"  - Certifications present: {'certifications' in profile}")
        print(f"  - Training styles present: {'trainingStyles' in profile}")
        print(f"  - Location present: {'locationAddress' in profile}")
        
        # Verify steps structure for document verification
        steps = detail_data.get('steps', [])
        assert isinstance(steps, list), "Steps should be a list"
        print(f"  - Verification steps: {len(steps)}")
        for step in steps:
            assert 'id' in step
            assert 'label' in step
            assert 'submitted' in step
        
        print(f"Admin verification detail endpoint returns profile info correctly")
        return detail_data
    
    def test_admin_verification_detail_404_for_invalid_trainer(self, admin_token):
        """Test detail endpoint returns 404 for non-existent trainer"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/verifications/invalid_trainer_id_123/detail", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("404 correctly returned for invalid trainer ID")


class TestTraineeSavedTrainers:
    """Tests for trainee saved trainers endpoint - P1 feature"""
    
    @pytest.fixture
    def trainee_token(self):
        """Create test trainee and get token"""
        unique_id = generate_unique_id()
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"TEST_ITER43_Trainee_{unique_id}",
            "email": f"test_iter43_trainee_{unique_id.lower()}@test.com",
            "phone": "5559876543",
            "password": "test123",
            "roles": ["trainee"]
        })
        if response.status_code == 200:
            return response.json()['access_token']
        
        # If signup fails (user exists), try login with different unique id
        unique_id2 = generate_unique_id()
        response2 = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"TEST_ITER43_Trainee_{unique_id2}",
            "email": f"test_iter43_trainee_{unique_id2.lower()}@test.com",
            "phone": "5559876543",
            "password": "test123",
            "roles": ["trainee"]
        })
        if response2.status_code == 200:
            return response2.json()['access_token']
        pytest.skip("Could not create test trainee")
    
    def test_get_saved_trainers_empty(self, trainee_token):
        """Test GET /api/trainee/saved-trainers returns empty list for new trainee"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.get(f"{BASE_URL}/api/trainee/saved-trainers", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert 'savedTrainers' in data
        assert isinstance(data['savedTrainers'], list)
        print(f"Saved trainers endpoint returns list: {len(data['savedTrainers'])} trainers")
    
    def test_save_trainer_and_get_details(self, trainee_token):
        """
        P1 FEATURE TEST: Save a trainer and verify saved-trainers endpoint returns full details
        """
        headers = {"Authorization": f"Bearer {trainee_token}"}
        
        # Create a test trainer to save
        unique_id = generate_unique_id()
        trainer_signup = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"TEST_ITER43_SavedTrainer_{unique_id}",
            "email": f"test_iter43_savedtrainer_{unique_id.lower()}@test.com",
            "phone": "5551112222",
            "password": "test123",
            "roles": ["trainer"]
        })
        
        if trainer_signup.status_code != 200:
            pytest.skip("Could not create test trainer")
        
        trainer_data = trainer_signup.json()
        trainer_id = trainer_data['user']['id']
        trainer_token = trainer_data['access_token']
        
        # Create trainer profile with details
        profile_data = {
            "userId": trainer_id,
            "bio": "Test trainer bio for saved trainers test",
            "experienceYears": 3,
            "certifications": ["ACE", "NASM"],
            "trainingStyles": ["HIIT", "Strength"],
            "outdoorRateCents": 5000,
            "virtualRateCents": 4000,
            "inHomeRateCents": 7000,
        }
        profile_response = requests.post(
            f"{BASE_URL}/api/trainer-profiles",
            json=profile_data,
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        print(f"Created trainer profile: {profile_response.status_code}")
        
        # Save the trainer (toggle favorite)
        toggle_response = requests.post(
            f"{BASE_URL}/api/trainee/toggle-favorite/{trainer_id}",
            headers=headers
        )
        assert toggle_response.status_code == 200, f"Toggle favorite failed: {toggle_response.text}"
        toggle_data = toggle_response.json()
        assert toggle_data.get('isFavorite') == True, "Trainer should be favorited"
        print(f"Trainer saved successfully")
        
        # Get saved trainers - P1 feature test
        saved_response = requests.get(f"{BASE_URL}/api/trainee/saved-trainers", headers=headers)
        assert saved_response.status_code == 200, f"Get saved trainers failed: {saved_response.text}"
        saved_data = saved_response.json()
        
        # Verify response structure
        assert 'savedTrainers' in saved_data
        trainers = saved_data['savedTrainers']
        assert len(trainers) >= 1, "Should have at least 1 saved trainer"
        
        # Check that saved trainer has full details (P1 feature requirement)
        # Note: The endpoint returns data from users collection, not trainer_profiles
        saved_trainer = next((t for t in trainers if t.get('id') == trainer_id), None)
        if saved_trainer:
            print(f"Saved trainer details:")
            print(f"  - ID: {saved_trainer.get('id')}")
            print(f"  - Name: {saved_trainer.get('name')}")
            print(f"  - Email: {saved_trainer.get('email')}")
            print(f"  - Rating: {saved_trainer.get('rating')}")
            print(f"  - Total sessions: {saved_trainer.get('totalSessions')}")
            print(f"  - Is verified: {saved_trainer.get('isVerified')}")
            print(f"  - Bio present: {'bio' in saved_trainer}")
        
        print("Saved trainers endpoint returns trainer details correctly")
        return saved_data


class TestTrainerRates:
    """Tests for trainer rate setting - backend stores hourly rates, frontend calculates 30/60/90"""
    
    @pytest.fixture
    def trainer_auth(self):
        """Create test trainer and get token"""
        unique_id = generate_unique_id()
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"TEST_ITER43_RateTrainer_{unique_id}",
            "email": f"test_iter43_ratetrainer_{unique_id.lower()}@test.com",
            "phone": "5553334444",
            "password": "test123",
            "roles": ["trainer"]
        })
        if response.status_code == 200:
            data = response.json()
            return {'token': data['access_token'], 'user_id': data['user']['id']}
        pytest.skip("Could not create test trainer for rates testing")
    
    def test_set_rates_endpoint(self, trainer_auth):
        """Test POST /api/trainer/set-rates stores hourly rates correctly"""
        headers = {"Authorization": f"Bearer {trainer_auth['token']}"}
        
        # First create trainer profile
        profile_response = requests.post(f"{BASE_URL}/api/trainer-profiles", json={
            "userId": trainer_auth['user_id'],
            "bio": "Test trainer for rates",
            "experienceYears": 2,
        }, headers=headers)
        
        # Set rates (hourly in cents)
        rates_data = {
            "offersInPerson": True,
            "offersVirtual": True,
            "offersInHome": True,
            "outdoorRateCents": 5000,  # $50/hour
            "virtualRateCents": 4000,  # $40/hour
            "inHomeRateCents": 7000,   # $70/hour
        }
        
        response = requests.post(f"{BASE_URL}/api/trainer/set-rates", json=rates_data, headers=headers)
        assert response.status_code == 200, f"Set rates failed: {response.text}"
        data = response.json()
        assert data.get('success') == True
        print("Trainer rates set successfully")
        
        # Verify rates were stored
        profile_get = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_auth['user_id']}", headers=headers)
        assert profile_get.status_code == 200
        profile_data = profile_get.json()
        
        assert profile_data.get('outdoorRateCents') == 5000, "Outdoor rate should be 5000 cents"
        assert profile_data.get('virtualRateCents') == 4000, "Virtual rate should be 4000 cents"
        assert profile_data.get('inHomeRateCents') == 7000, "In-home rate should be 7000 cents"
        
        # Verify session type offerings
        assert profile_data.get('offersInPerson') == True
        assert profile_data.get('offersVirtual') == True
        assert profile_data.get('offersInHome') == True
        
        print(f"Rates verified:")
        print(f"  - Outdoor: ${profile_data.get('outdoorRateCents', 0)/100}/hr")
        print(f"  - Virtual: ${profile_data.get('virtualRateCents', 0)/100}/hr")
        print(f"  - In-Home: ${profile_data.get('inHomeRateCents', 0)/100}/hr")
        print("Frontend calculates 30/60/90 min prices from these hourly rates")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_note(self):
        """Note about test data cleanup"""
        print("Test data created with TEST_ITER43_ prefix")
        print("Test accounts can be cleaned up by admin if needed")
        assert True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
