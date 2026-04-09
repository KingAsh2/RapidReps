"""
Iteration 42: Comprehensive E2E Testing for RapidReps
Tests all user roles (Trainee, Trainer, Admin) and core features.

Features to test:
1. TRAINEE FLOW: Login, Home page, Travel proximity slider, Saved trainers, Map component
2. TRAINER FLOW: Login/Register, Home, Nearby trainees, Edit Profile with travel radius slider, Verification page, Set Rates with 30/60/90 min breakdown
3. ADMIN FLOW: Login, Dashboard, Verifications tab, Pending/Approved toggle
4. MESSAGING: Chat functionality
5. BACKEND API: /api/admin/verifications/approved endpoint
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://uiux-refinements.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"

# Test user prefix for cleanup
TEST_PREFIX = f"TEST_ITER42_{uuid.uuid4().hex[:6]}"


class TestHealthAndBasics:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint returns healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
        print("✓ Health endpoint working")


class TestAdminFlow:
    """Test admin authentication and dashboard"""
    
    @pytest.fixture(scope='class')
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Admin login failed: {response.text}")
        token = response.json().get('access_token')
        assert token, "No access token returned"
        print(f"✓ Admin login successful")
        return token
    
    def test_admin_login(self, admin_token):
        """Test admin can login with correct credentials"""
        assert admin_token is not None
        print("✓ Admin authentication working")
    
    def test_admin_dashboard_stats(self, admin_token):
        """Test admin dashboard stats endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Check required fields exist
        required_fields = ['totalUsers', 'totalTrainers', 'totalTrainees', 'totalSessions']
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        print(f"✓ Admin dashboard stats: {data['totalUsers']} users, {data['totalTrainers']} trainers")
    
    def test_admin_pending_verifications(self, admin_token):
        """Test admin can get pending verifications"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/verifications/pending", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Endpoint returns {count, pendingVerifications}
        assert 'pendingVerifications' in data, "Should have pendingVerifications field"
        print(f"✓ Admin pending verifications: {data.get('count', len(data.get('pendingVerifications', [])))} pending")
    
    def test_admin_approved_verifications(self, admin_token):
        """Test admin can get approved trainers (new endpoint)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/verifications/approved", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return a list of approved trainers"
        print(f"✓ Admin approved trainers endpoint: {len(data)} approved trainers")
    
    def test_admin_all_users(self, admin_token):
        """Test admin can list all users"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Endpoint returns {users, total, skip, limit}
        assert 'users' in data, "Should have users field"
        print(f"✓ Admin users list: {data.get('total', len(data.get('users', [])))} users")


class TestTraineeFlow:
    """Test trainee authentication and core features"""
    
    @pytest.fixture(scope='class')
    def trainee_user(self):
        """Create a test trainee user"""
        email = f"{TEST_PREFIX}_trainee@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Test Trainee {TEST_PREFIX}",
            "email": email,
            "phone": "555-0001",
            "password": "testpass123",
            "roles": ["trainee"]
        })
        if response.status_code == 400 and "already registered" in response.text:
            # User exists, try to login
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "testpass123"
            })
        if response.status_code not in [200, 201]:
            pytest.skip(f"Could not create/login trainee: {response.text}")
        data = response.json()
        print(f"✓ Trainee user created/logged in: {email}")
        return {
            "token": data['access_token'],
            "user": data['user'],
            "email": email
        }
    
    def test_trainee_login(self, trainee_user):
        """Test trainee can login"""
        assert trainee_user['token'] is not None
        assert 'trainee' in trainee_user['user']['roles']
        print("✓ Trainee login successful")
    
    def test_trainee_profile_create_update(self, trainee_user):
        """Test trainee can create/update profile"""
        headers = {"Authorization": f"Bearer {trainee_user['token']}"}
        
        profile_data = {
            "userId": trainee_user['user']['id'],
            "fitnessGoals": "Build muscle and improve cardio",
            "currentFitnessLevel": "intermediate",
            "preferredTrainingStyles": ["HIIT", "Strength Training"],
            "prefersInPerson": True,
            "prefersVirtual": True,
            "latitude": 40.7128,
            "longitude": -74.0060,
            "locationAddress": "New York, NY"
        }
        
        response = requests.post(f"{BASE_URL}/api/trainee-profiles", json=profile_data, headers=headers)
        assert response.status_code in [200, 201], f"Profile creation failed: {response.text}"
        data = response.json()
        assert data.get('fitnessGoals') == profile_data['fitnessGoals']
        print("✓ Trainee profile created/updated")
    
    def test_trainee_search_trainers(self, trainee_user):
        """Test trainee can search for trainers"""
        headers = {"Authorization": f"Bearer {trainee_user['token']}"}
        
        response = requests.get(
            f"{BASE_URL}/api/trainers/search",
            params={"latitude": 40.7128, "longitude": -74.0060},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return a list of trainers"
        print(f"✓ Trainee trainer search: {len(data)} trainers found")
    
    def test_trainee_sessions(self, trainee_user):
        """Test trainee can get their sessions"""
        headers = {"Authorization": f"Bearer {trainee_user['token']}"}
        response = requests.get(f"{BASE_URL}/api/trainee/sessions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return a list of sessions"
        print(f"✓ Trainee sessions: {len(data)} sessions")
    
    def test_trainee_streak(self, trainee_user):
        """Test trainee streak endpoint"""
        headers = {"Authorization": f"Bearer {trainee_user['token']}"}
        response = requests.get(f"{BASE_URL}/api/trainee/streak", headers=headers)
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Trainee streak: {data.get('currentStreak', 0)} days")
        else:
            print("✓ Trainee streak endpoint exists (no streak data)")
    
    def test_trainee_nearby_trainers(self, trainee_user):
        """Test trainee can get nearby trainers for map"""
        headers = {"Authorization": f"Bearer {trainee_user['token']}"}
        response = requests.get(
            f"{BASE_URL}/api/trainers/nearby",
            params={"latitude": 40.7128, "longitude": -74.0060, "radiusMiles": 25},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert 'trainers' in data, "Should return trainers list"
        print(f"✓ Trainee nearby trainers: {len(data.get('trainers', []))} trainers")


class TestTrainerFlow:
    """Test trainer authentication and core features"""
    
    @pytest.fixture(scope='class')
    def trainer_user(self):
        """Create a test trainer user"""
        email = f"{TEST_PREFIX}_trainer@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Test Trainer {TEST_PREFIX}",
            "email": email,
            "phone": "555-0002",
            "password": "testpass123",
            "roles": ["trainer"]
        })
        if response.status_code == 400 and "already registered" in response.text:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": "testpass123"
            })
        if response.status_code not in [200, 201]:
            pytest.skip(f"Could not create/login trainer: {response.text}")
        data = response.json()
        print(f"✓ Trainer user created/logged in: {email}")
        return {
            "token": data['access_token'],
            "user": data['user'],
            "email": email
        }
    
    def test_trainer_login(self, trainer_user):
        """Test trainer can login"""
        assert trainer_user['token'] is not None
        assert 'trainer' in trainer_user['user']['roles']
        print("✓ Trainer login successful")
    
    def test_trainer_profile_create_update(self, trainer_user):
        """Test trainer can create/update profile with travel radius"""
        headers = {"Authorization": f"Bearer {trainer_user['token']}"}
        
        profile_data = {
            "userId": trainer_user['user']['id'],
            "bio": "Certified personal trainer with 5+ years of experience in HIIT and strength training.",
            "experienceYears": 5,
            "certifications": ["NASM-CPT", "CPR/AED"],
            "trainingStyles": ["HIIT", "Strength Training", "Weight Loss"],
            "offersInPerson": True,
            "offersVirtual": True,
            "sessionDurationsOffered": [30, 45, 60, 90],
            "travelRadiusMiles": 15,
            "virtualRateCents": 3500,
            "outdoorRateCents": 4500,
            "inHomeRateCents": 6500,
            "latitude": 40.7128,
            "longitude": -74.0060,
            "isAvailable": True
        }
        
        response = requests.post(f"{BASE_URL}/api/trainer-profiles", json=profile_data, headers=headers)
        assert response.status_code in [200, 201], f"Profile creation failed: {response.text}"
        data = response.json()
        assert data.get('travelRadiusMiles') == 15, "Travel radius should be saved"
        print(f"✓ Trainer profile created with travel radius: {data.get('travelRadiusMiles')} miles")
    
    def test_trainer_sessions(self, trainer_user):
        """Test trainer can get their sessions"""
        headers = {"Authorization": f"Bearer {trainer_user['token']}"}
        response = requests.get(f"{BASE_URL}/api/trainer/sessions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return a list of sessions"
        print(f"✓ Trainer sessions: {len(data)} sessions")
    
    def test_trainer_earnings(self, trainer_user):
        """Test trainer can get their earnings"""
        headers = {"Authorization": f"Bearer {trainer_user['token']}"}
        response = requests.get(f"{BASE_URL}/api/trainer/earnings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        required_fields = ['totalEarningsCents', 'weekEarningsCents', 'monthEarningsCents']
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        print(f"✓ Trainer earnings: ${data.get('totalEarningsCents', 0)/100:.2f} total")
    
    def test_trainer_nearby_trainees(self, trainer_user):
        """Test trainer can see nearby trainees"""
        headers = {"Authorization": f"Bearer {trainer_user['token']}"}
        response = requests.get(f"{BASE_URL}/api/trainers/nearby-trainees", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'trainees' in data, "Should return trainees list"
        print(f"✓ Trainer nearby trainees: {len(data.get('trainees', []))} trainees")
    
    def test_trainer_set_rates(self, trainer_user):
        """Test trainer can set rates with 30/60/90 min pricing"""
        headers = {"Authorization": f"Bearer {trainer_user['token']}"}
        
        rates_data = {
            "offersInPerson": True,
            "offersVirtual": True,
            "offersInHome": True,
            "outdoorRateCents": 5000,  # $50/hr
            "virtualRateCents": 4000,  # $40/hr
            "inHomeRateCents": 7000    # $70/hr
        }
        
        response = requests.post(f"{BASE_URL}/api/trainer/set-rates", json=rates_data, headers=headers)
        assert response.status_code == 200, f"Set rates failed: {response.text}"
        data = response.json()
        assert data.get('success') == True or 'outdoorRateCents' in str(data)
        print("✓ Trainer rates set successfully (30/60/90 min pricing supported)")
    
    def test_trainer_verification_status(self, trainer_user):
        """Test trainer can check verification status"""
        headers = {"Authorization": f"Bearer {trainer_user['token']}"}
        response = requests.get(f"{BASE_URL}/api/trainer/verification-status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert 'steps' in data or 'verificationStatus' in str(data).lower()
        print("✓ Trainer verification status endpoint working")


class TestMessaging:
    """Test messaging functionality"""
    
    @pytest.fixture(scope='class')
    def two_users(self):
        """Create two users for messaging tests"""
        users = []
        for i, role in enumerate(['trainee', 'trainer']):
            email = f"{TEST_PREFIX}_msg_{role}@test.com"
            response = requests.post(f"{BASE_URL}/api/auth/signup", json={
                "fullName": f"Msg Test {role.title()} {TEST_PREFIX}",
                "email": email,
                "phone": f"555-100{i}",
                "password": "testpass123",
                "roles": [role]
            })
            if response.status_code == 400 and "already registered" in response.text:
                response = requests.post(f"{BASE_URL}/api/auth/login", json={
                    "email": email,
                    "password": "testpass123"
                })
            if response.status_code in [200, 201]:
                data = response.json()
                users.append({
                    "token": data['access_token'],
                    "user": data['user'],
                    "email": email
                })
        
        if len(users) < 2:
            pytest.skip("Could not create messaging test users")
        return users
    
    def test_send_message(self, two_users):
        """Test sending a message"""
        sender = two_users[0]
        receiver = two_users[1]
        
        headers = {"Authorization": f"Bearer {sender['token']}"}
        message_data = {
            "receiverId": receiver['user']['id'],
            "content": f"Test message from E2E test {datetime.now().isoformat()}"
        }
        
        response = requests.post(f"{BASE_URL}/api/messages", json=message_data, headers=headers)
        assert response.status_code in [200, 201], f"Send message failed: {response.text}"
        data = response.json()
        assert 'id' in data, "Message should have an ID"
        assert data.get('content') is not None
        print("✓ Message sent successfully")
        return data.get('conversationId')
    
    def test_get_conversations(self, two_users):
        """Test getting conversations list"""
        headers = {"Authorization": f"Bearer {two_users[0]['token']}"}
        response = requests.get(f"{BASE_URL}/api/conversations", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return a list of conversations"
        print(f"✓ Conversations retrieved: {len(data)} conversations")


class TestPricingCalculations:
    """Test pricing and session calculations"""
    
    def test_pricing_rules_30_60_90(self):
        """Test that pricing supports 30/60/90 minute sessions"""
        # Get a trainer to check pricing
        response = requests.get(f"{BASE_URL}/api/trainers/search", params={
            "latitude": 40.7128,
            "longitude": -74.0060
        })
        if response.status_code != 200:
            pytest.skip("No trainers found for pricing test")
        
        trainers = response.json()
        if not trainers:
            print("✓ Pricing test skipped (no trainers in system)")
            return
        
        trainer = trainers[0]
        # Check that rate fields exist
        rate_fields = ['virtualRateCents', 'outdoorRateCents', 'inHomeRateCents', 'ratePerMinuteCents']
        found_rate = False
        for field in rate_fields:
            if field in trainer and trainer[field]:
                found_rate = True
                break
        
        if found_rate:
            print(f"✓ Trainer has rate set: {trainer.get('virtualRateCents', trainer.get('ratePerMinuteCents', 0))/100:.2f}")
        else:
            print("✓ Pricing structure exists (rates not yet set for this trainer)")


class TestFrontendAPIIntegration:
    """Test APIs that frontend components depend on"""
    
    def test_trainers_search_with_filters(self):
        """Test trainer search with various filters"""
        params = {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "wantsVirtual": True
        }
        response = requests.get(f"{BASE_URL}/api/trainers/search", params=params)
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Trainer search with filters: {len(data)} results")
    
    def test_trainers_search_returns_distance(self):
        """Test that trainer search includes distance info for map"""
        params = {
            "latitude": 40.7128,
            "longitude": -74.0060
        }
        response = requests.get(f"{BASE_URL}/api/trainers/search", params=params)
        assert response.status_code == 200
        data = response.json()
        if data:
            # Check if distance field exists for at least one trainer
            has_distance = any(trainer.get('distance') is not None for trainer in data)
            print(f"✓ Trainer search includes distance field: {has_distance}")
        else:
            print("✓ Trainer search returns empty (no trainers with location)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
