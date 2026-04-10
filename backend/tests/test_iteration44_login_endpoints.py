"""
Iteration 44: Backend API Tests for Login and Critical Endpoints
Tests focus on:
1. Login API for admin, trainer, trainee accounts
2. Group sessions endpoint
3. Trainer profile endpoint
4. Admin dashboard
5. Trainee home page APIs (nearby trainers, sessions, streak)
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://reps-qa-preview.preview.emergentagent.com"

# Test credentials
ADMIN_CREDENTIALS = {"email": "admin@rapidreps.com", "password": "admin123"}
TRAINEE_CREDENTIALS = {"email": "test_trainee_iter25@test.com", "password": "Test123!"}
TRAINER_CREDENTIALS = {"email": "test_trainer_iter25@test.com", "password": "Test123!"}

class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_api_health(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", f"Expected healthy status, got: {data}"
        assert "timestamp" in data, "Timestamp missing from health response"
        print(f"PASS: Health check returned: {data}")


class TestLoginAPI:
    """Login API tests for all account types"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=ADMIN_CREDENTIALS
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == ADMIN_CREDENTIALS["email"], "Email mismatch"
        assert data["user"]["isAdmin"] == True, "Admin flag should be True"
        assert "admin" in data["user"]["roles"], "Admin role missing"
        print(f"PASS: Admin login successful - user_id: {data['user']['id']}, isAdmin: {data['user']['isAdmin']}")
        return data["access_token"]
    
    def test_trainee_login_success(self):
        """Test trainee login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=TRAINEE_CREDENTIALS
        )
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == TRAINEE_CREDENTIALS["email"], "Email mismatch"
        assert "trainee" in data["user"]["roles"], "Trainee role missing"
        print(f"PASS: Trainee login successful - user_id: {data['user']['id']}, roles: {data['user']['roles']}")
        return data["access_token"]
    
    def test_trainer_login_success(self):
        """Test trainer login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=TRAINER_CREDENTIALS
        )
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == TRAINER_CREDENTIALS["email"], "Email mismatch"
        assert "trainer" in data["user"]["roles"], "Trainer role missing"
        print(f"PASS: Trainer login successful - user_id: {data['user']['id']}, roles: {data['user']['roles']}")
        return data["access_token"]
    
    def test_login_invalid_email(self):
        """Test login with non-existent email returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent@test.com", "password": "wrong123"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: Login with invalid email correctly returns 401")
    
    def test_login_wrong_password(self):
        """Test login with wrong password returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_CREDENTIALS["email"], "password": "wrongpassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: Login with wrong password correctly returns 401")


class TestAdminDashboard:
    """Admin dashboard endpoint tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Admin authentication failed")
    
    def test_admin_dashboard_loads(self, admin_token):
        """Test admin dashboard returns statistics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin dashboard failed: {response.text}"
        data = response.json()
        
        # Verify dashboard structure
        assert "totalUsers" in data, "Missing totalUsers"
        assert "totalTrainers" in data, "Missing totalTrainers"
        assert "totalTrainees" in data, "Missing totalTrainees"
        assert "totalSessions" in data, "Missing totalSessions"
        
        # Verify data types
        assert isinstance(data["totalUsers"], int), "totalUsers should be int"
        assert isinstance(data["totalTrainers"], int), "totalTrainers should be int"
        assert data["totalUsers"] >= data["totalTrainers"], "Total users should be >= trainers"
        
        print(f"PASS: Admin dashboard - Users: {data['totalUsers']}, Trainers: {data['totalTrainers']}, Trainees: {data['totalTrainees']}, Sessions: {data['totalSessions']}")
    
    def test_admin_dashboard_unauthorized(self):
        """Test admin dashboard requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Admin dashboard correctly requires authentication")


class TestGroupSessions:
    """Group sessions endpoint tests"""
    
    @pytest.fixture
    def trainee_token(self):
        """Get trainee auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TRAINEE_CREDENTIALS)
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Trainee authentication failed")
    
    def test_group_sessions_list(self, trainee_token):
        """Test group sessions endpoint returns data"""
        response = requests.get(
            f"{BASE_URL}/api/group-sessions",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200, f"Group sessions failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "sessions" in data, "Missing sessions array"
        assert "total" in data, "Missing total count"
        assert "page" in data, "Missing page number"
        assert isinstance(data["sessions"], list), "Sessions should be a list"
        
        # If there are sessions, verify structure
        if data["sessions"]:
            session = data["sessions"][0]
            assert "title" in session, "Session missing title"
            assert "trainerId" in session, "Session missing trainerId"
            assert "status" in session, "Session missing status"
            assert "spotsRemaining" in session, "Session missing spotsRemaining"
        
        print(f"PASS: Group sessions returned {data['total']} sessions")


class TestTrainerProfile:
    """Trainer profile endpoint tests"""
    
    @pytest.fixture
    def trainer_user_id(self):
        """Get trainer user ID from login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TRAINER_CREDENTIALS)
        if response.status_code == 200:
            return response.json()["user"]["id"]
        pytest.skip("Trainer authentication failed")
    
    def test_trainer_profile_public(self, trainer_user_id):
        """Test trainer profile endpoint returns data (public)"""
        response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}")
        assert response.status_code == 200, f"Trainer profile failed: {response.text}"
        data = response.json()
        
        # Verify profile structure
        assert "id" in data, "Missing profile id"
        assert "userId" in data, "Missing userId"
        assert "bio" in data, "Missing bio"
        assert "experienceYears" in data, "Missing experienceYears"
        assert "certifications" in data, "Missing certifications"
        assert "trainingStyles" in data, "Missing trainingStyles"
        assert "averageRating" in data, "Missing averageRating"
        
        # Verify data consistency
        assert data["userId"] == trainer_user_id, "User ID mismatch"
        print(f"PASS: Trainer profile - bio: {data['bio'][:50] if data['bio'] else 'None'}..., rating: {data['averageRating']}")
    
    def test_trainer_profile_not_found(self):
        """Test trainer profile returns 404 for invalid user"""
        response = requests.get(f"{BASE_URL}/api/trainer-profiles/000000000000000000000000")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Trainer profile correctly returns 404 for invalid user")


class TestTraineeHomeAPIs:
    """Trainee home page related API tests"""
    
    @pytest.fixture
    def trainee_auth(self):
        """Get trainee auth token and user_id"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TRAINEE_CREDENTIALS)
        if response.status_code == 200:
            data = response.json()
            return {"token": data["access_token"], "user_id": data["user"]["id"]}
        pytest.skip("Trainee authentication failed")
    
    def test_nearby_trainers(self, trainee_auth):
        """Test nearby trainers endpoint returns trainer list"""
        response = requests.get(
            f"{BASE_URL}/api/trainers/nearby",
            params={"latitude": 33.749, "longitude": -84.388},
            headers={"Authorization": f"Bearer {trainee_auth['token']}"}
        )
        assert response.status_code == 200, f"Nearby trainers failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "trainers" in data, "Missing trainers array"
        assert "count" in data, "Missing count"
        assert "searchLocation" in data, "Missing searchLocation"
        
        # Verify trainers have required fields
        if data["trainers"]:
            trainer = data["trainers"][0]
            assert "fullName" in trainer, "Trainer missing fullName"
            assert "averageRating" in trainer, "Trainer missing averageRating"
            assert "distanceMiles" in trainer, "Trainer missing distanceMiles"
        
        print(f"PASS: Nearby trainers returned {data['count']} trainers")
    
    def test_trainee_sessions(self, trainee_auth):
        """Test trainee sessions endpoint returns session list"""
        response = requests.get(
            f"{BASE_URL}/api/trainee/sessions",
            headers={"Authorization": f"Bearer {trainee_auth['token']}"}
        )
        assert response.status_code == 200, f"Trainee sessions failed: {response.text}"
        data = response.json()
        
        # Response should be a list
        assert isinstance(data, list), "Sessions should be a list"
        
        # If there are sessions, verify structure
        if data:
            session = data[0]
            assert "id" in session, "Session missing id"
            assert "trainerId" in session, "Session missing trainerId"
            assert "status" in session, "Session missing status"
        
        print(f"PASS: Trainee sessions returned {len(data)} sessions")
    
    def test_trainee_streak(self, trainee_auth):
        """Test trainee streak endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/trainee/streak",
            headers={"Authorization": f"Bearer {trainee_auth['token']}"}
        )
        assert response.status_code == 200, f"Trainee streak failed: {response.text}"
        data = response.json()
        
        # Verify streak data structure
        assert "currentStreak" in data, "Missing currentStreak"
        assert "longestStreak" in data, "Missing longestStreak"
        assert isinstance(data["currentStreak"], int), "currentStreak should be int"
        
        print(f"PASS: Trainee streak - current: {data['currentStreak']}, longest: {data['longestStreak']}")
    
    def test_trainee_recent_trainers(self, trainee_auth):
        """Test recent trainers endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/trainee/recent-trainers",
            headers={"Authorization": f"Bearer {trainee_auth['token']}"}
        )
        assert response.status_code == 200, f"Recent trainers failed: {response.text}"
        data = response.json()
        
        # Response is an object with recentTrainers key
        assert "recentTrainers" in data, "Missing recentTrainers key"
        assert isinstance(data["recentTrainers"], list), "recentTrainers should be a list"
        print(f"PASS: Recent trainers returned {len(data['recentTrainers'])} trainers")
    
    def test_trainee_saved_trainers(self, trainee_auth):
        """Test saved trainers endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/trainee/saved-trainers",
            headers={"Authorization": f"Bearer {trainee_auth['token']}"}
        )
        assert response.status_code == 200, f"Saved trainers failed: {response.text}"
        data = response.json()
        
        # Response is an object with savedTrainers key
        assert "savedTrainers" in data, "Missing savedTrainers key"
        assert isinstance(data["savedTrainers"], list), "savedTrainers should be a list"
        print(f"PASS: Saved trainers returned {len(data['savedTrainers'])} trainers")


class TestAuthMe:
    """Auth /me endpoint tests"""
    
    def test_auth_me_with_token(self):
        """Test /api/auth/me returns current user"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=TRAINEE_CREDENTIALS)
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Call /auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        data = response.json()
        
        # Verify user data
        assert data["email"] == TRAINEE_CREDENTIALS["email"], "Email mismatch"
        assert "id" in data, "Missing user id"
        assert "roles" in data, "Missing roles"
        print(f"PASS: Auth/me returns correct user: {data['email']}")
    
    def test_auth_me_unauthorized(self):
        """Test /api/auth/me without token returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Auth/me correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
