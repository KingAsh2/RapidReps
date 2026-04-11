"""
RapidReps Backend API Tests
Tests the following features as per review request:
- Health check
- Auth login (trainer, trainee, admin)
- Trainer verification endpoints
- Admin dashboard and user management
- Admin verification approval/rejection
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://auth-layout-preview.preview.emergentagent.com').rstrip('/')

# Test credentials
TRAINER_EMAIL = "trainer1@test.com"
TRAINER_PASSWORD = "test123"
TRAINEE_EMAIL = "trainee1@test.com"
TRAINEE_PASSWORD = "test123"
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"


class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_api_health_returns_healthy(self):
        """GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print(f"Health check passed: {data}")


class TestAuthLogin:
    """Test authentication login for different user types"""
    
    def test_trainer_login_success(self):
        """POST /api/auth/login works for trainer"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TRAINER_EMAIL
        assert "trainer" in data["user"]["roles"]
        assert data["user"]["isAdmin"] == False
        print(f"Trainer login success: {data['user']['fullName']}")
    
    def test_trainee_login_success(self):
        """POST /api/auth/login works for trainee"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TRAINEE_EMAIL
        assert "trainee" in data["user"]["roles"]
        assert data["user"]["isAdmin"] == False
        print(f"Trainee login success: {data['user']['fullName']}")
    
    def test_admin_login_success(self):
        """POST /api/auth/login works for admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["isAdmin"] == True
        print(f"Admin login success: {data['user']['fullName']}")
    
    def test_invalid_credentials_fail(self):
        """POST /api/auth/login fails with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("Invalid credentials correctly rejected")


@pytest.fixture
def trainer_token():
    """Get trainer auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINER_EMAIL,
        "password": TRAINER_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Trainer login failed")
    return response.json()["access_token"]


@pytest.fixture
def trainer_id():
    """Get trainer user ID"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINER_EMAIL,
        "password": TRAINER_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Trainer login failed")
    return response.json()["user"]["id"]


@pytest.fixture
def trainee_token():
    """Get trainee auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINEE_EMAIL,
        "password": TRAINEE_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Trainee login failed")
    return response.json()["access_token"]


@pytest.fixture
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Admin login failed")
    return response.json()["access_token"]


class TestTrainerVerification:
    """Test trainer verification status and step submission endpoints"""
    
    def test_get_verification_status_returns_all_steps(self, trainer_token):
        """GET /api/trainer/verification-status returns steps object with all 7 step IDs"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/verification-status", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "steps" in data
        
        # Check all 7 required step IDs are present
        required_steps = ['identity', 'background', 'certification', 'cpr', 'insurance', 'photo', 'video']
        for step in required_steps:
            assert step in data["steps"], f"Missing step: {step}"
            assert data["steps"][step] in ['pending', 'submitted'], f"Invalid status for {step}"
        
        assert "canGoLive" in data
        print(f"Verification status retrieved: {len(data['steps'])} steps found")
        print(f"Steps: {data['steps']}")
    
    def test_submit_verification_step_identity(self, trainer_token):
        """POST /api/trainer/submit-verification-step works for identity step"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.post(f"{BASE_URL}/api/trainer/submit-verification-step", 
            headers=headers,
            json={
                "stepId": "identity",
                "fileUri": "https://example.com/id_doc.jpg",
                "fileName": "government_id.jpg"
            })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["stepId"] == "identity"
        print(f"Identity step submitted successfully")
    
    def test_submit_verification_step_background(self, trainer_token):
        """POST /api/trainer/submit-verification-step works for background step"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.post(f"{BASE_URL}/api/trainer/submit-verification-step", 
            headers=headers,
            json={
                "stepId": "background",
                "fileUri": "https://example.com/background.pdf",
                "fileName": "background_check.pdf"
            })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["stepId"] == "background"
        print(f"Background step submitted successfully")
    
    def test_submit_verification_step_certification(self, trainer_token):
        """POST /api/trainer/submit-verification-step works for certification step"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.post(f"{BASE_URL}/api/trainer/submit-verification-step", 
            headers=headers,
            json={
                "stepId": "certification",
                "fileUri": "https://example.com/cert.pdf",
                "fileName": "fitness_cert.pdf"
            })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["stepId"] == "certification"
        print(f"Certification step submitted successfully")
    
    def test_submit_verification_step_cpr(self, trainer_token):
        """POST /api/trainer/submit-verification-step works for cpr step"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.post(f"{BASE_URL}/api/trainer/submit-verification-step", 
            headers=headers,
            json={
                "stepId": "cpr",
                "fileUri": "https://example.com/cpr.pdf",
                "fileName": "cpr_aed_cert.pdf"
            })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["stepId"] == "cpr"
        print(f"CPR step submitted successfully")
    
    def test_submit_verification_step_insurance(self, trainer_token):
        """POST /api/trainer/submit-verification-step works for insurance step"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.post(f"{BASE_URL}/api/trainer/submit-verification-step", 
            headers=headers,
            json={
                "stepId": "insurance",
                "fileUri": "https://example.com/insurance.pdf",
                "fileName": "insurance.pdf"
            })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["stepId"] == "insurance"
        print(f"Insurance step submitted successfully")
    
    def test_submit_verification_step_photo(self, trainer_token):
        """POST /api/trainer/submit-verification-step works for photo step"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.post(f"{BASE_URL}/api/trainer/submit-verification-step", 
            headers=headers,
            json={
                "stepId": "photo",
                "fileUri": "https://example.com/profile.jpg",
                "fileName": "profile_photo.jpg"
            })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["stepId"] == "photo"
        print(f"Photo step submitted successfully")
    
    def test_submit_verification_step_video(self, trainer_token):
        """POST /api/trainer/submit-verification-step works for video step"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.post(f"{BASE_URL}/api/trainer/submit-verification-step", 
            headers=headers,
            json={
                "stepId": "video",
                "fileUri": "https://example.com/intro_video.mp4",
                "fileName": "intro_video.mp4"
            })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["stepId"] == "video"
        print(f"Video step submitted successfully")
    
    def test_submit_invalid_step_fails(self, trainer_token):
        """POST /api/trainer/submit-verification-step fails with invalid step ID"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.post(f"{BASE_URL}/api/trainer/submit-verification-step", 
            headers=headers,
            json={
                "stepId": "invalid_step",
                "fileUri": "https://example.com/test.pdf"
            })
        
        assert response.status_code == 400
        print(f"Invalid step correctly rejected with 400")
    
    def test_submit_all_verification(self, trainer_token):
        """POST /api/trainer/submit-all-verification works after steps are submitted"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.post(f"{BASE_URL}/api/trainer/submit-all-verification", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "message" in data
        print(f"All verification submitted: {data['message']}")


class TestAdminDashboard:
    """Test admin dashboard endpoints"""
    
    def test_admin_dashboard_returns_stats(self, admin_token):
        """GET /api/admin/dashboard returns totalUsers, totalTrainers, totalTrainees, totalSessions"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields exist
        assert "totalUsers" in data
        assert "totalTrainers" in data
        assert "totalTrainees" in data
        assert "totalSessions" in data
        assert "platformRevenueCents" in data
        assert "platformRevenueDollars" in data
        
        # Verify values are integers
        assert isinstance(data["totalUsers"], int)
        assert isinstance(data["totalTrainers"], int)
        assert isinstance(data["totalTrainees"], int)
        assert isinstance(data["totalSessions"], int)
        
        print(f"Dashboard stats - Users: {data['totalUsers']}, Trainers: {data['totalTrainers']}, Trainees: {data['totalTrainees']}, Sessions: {data['totalSessions']}")
        print(f"Platform Revenue: ${data['platformRevenueDollars']:.2f}")


class TestAdminUsers:
    """Test admin user management endpoints"""
    
    def test_admin_users_returns_paginated_list(self, admin_token):
        """GET /api/admin/users returns paginated user list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "users" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert isinstance(data["users"], list)
        
        # Check user objects have required fields
        if len(data["users"]) > 0:
            user = data["users"][0]
            assert "id" in user
            assert "fullName" in user
            assert "email" in user
        
        print(f"Admin users: {data['total']} total users, showing {len(data['users'])}")
    
    def test_admin_users_with_role_filter(self, admin_token):
        """GET /api/admin/users filters by role"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users?role=trainer", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned users should have trainer role
        for user in data["users"]:
            assert "trainer" in user.get("roles", []), f"User {user.get('email')} doesn't have trainer role"
        
        print(f"Filtered trainers: {len(data['users'])} trainers found")
    
    def test_admin_user_detail_returns_profiles(self, admin_token, trainer_id):
        """GET /api/admin/users/{user_id} returns detailed user info with profiles"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users/{trainer_id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "user" in data
        assert data["user"]["id"] == trainer_id
        assert "trainerProfile" in data or data.get("trainerProfile") is None
        assert "traineeProfile" in data or data.get("traineeProfile") is None
        assert "recentSessions" in data
        assert "recentTransactions" in data
        
        print(f"User detail retrieved for: {data['user']['fullName']}")
        print(f"Has trainer profile: {data.get('trainerProfile') is not None}")


class TestAdminVerifications:
    """Test admin verification approval/rejection endpoints"""
    
    def test_admin_verifications_pending_returns_list(self, admin_token):
        """GET /api/admin/verifications/pending returns pending verifications list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/verifications/pending", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "pendingVerifications" in data
        assert "count" in data
        assert isinstance(data["pendingVerifications"], list)
        
        print(f"Pending verifications: {data['count']} found")
    
    def test_admin_approve_verification_works(self, admin_token, trainer_id):
        """POST /api/admin/verifications/{trainer_id}/approve works"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "message" in data
        print(f"Verification approved: {data['message']}")
    
    def test_admin_reject_verification_works(self, admin_token, trainer_id):
        """POST /api/admin/verifications/{trainer_id}/reject works"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/admin/verifications/{trainer_id}/reject?reason=Test+rejection", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "message" in data
        print(f"Verification rejected: {data['message']}")


class TestAdminSessions:
    """Test admin sessions endpoint"""
    
    def test_admin_sessions_returns_paginated_list(self, admin_token):
        """GET /api/admin/sessions returns paginated sessions"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/sessions", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "sessions" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert isinstance(data["sessions"], list)
        
        print(f"Admin sessions: {data['total']} total, showing {len(data['sessions'])}")


class TestAdminTransactions:
    """Test admin transactions endpoint"""
    
    def test_admin_transactions_returns_paginated_list(self, admin_token):
        """GET /api/admin/transactions returns paginated transactions"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/transactions", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "transactions" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert isinstance(data["transactions"], list)
        
        print(f"Admin transactions: {data['total']} total, showing {len(data['transactions'])}")


class TestAdminAccessControl:
    """Test that non-admin users cannot access admin endpoints"""
    
    def test_trainer_cannot_access_admin_dashboard(self, trainer_token):
        """Non-admin users cannot access /api/admin/* endpoints"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        
        assert response.status_code == 403
        print("Trainer correctly denied access to admin dashboard")
    
    def test_trainee_cannot_access_admin_users(self, trainee_token):
        """Trainee cannot access admin users endpoint"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        
        assert response.status_code == 403
        print("Trainee correctly denied access to admin users")
    
    def test_trainer_cannot_access_admin_verifications(self, trainer_token):
        """Trainer cannot access admin verifications"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/verifications/pending", headers=headers)
        
        assert response.status_code == 403
        print("Trainer correctly denied access to admin verifications")
    
    def test_unauthenticated_cannot_access_admin(self):
        """Unauthenticated users cannot access admin endpoints"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard")
        
        assert response.status_code in [401, 403]
        print("Unauthenticated request correctly denied")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
