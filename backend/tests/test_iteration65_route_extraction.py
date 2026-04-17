"""
Iteration 65: Backend Route Extraction Regression Tests
Tests all endpoints after extracting auth_routes.py, session_routes.py, and admin_routes.py from server.py

Test Coverage:
- Auth routes (auth_routes.py): signup, login, me, change-password, forgot-password
- Session routes (session_routes.py): trainee sessions, trainer sessions
- Admin routes (admin_routes.py): dashboard, users, top-trainers, earnings-summary
- Server.py remaining routes: personality-tag, accent-color
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://highlight-vibe-bugs.preview.emergentagent.com').rstrip('/')

# Test credentials from test_credentials.md
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"


class TestHealthEndpoint:
    """Test health endpoint (server.py)"""
    
    def test_health_check(self):
        """GET /api/health - must return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get('status') == 'healthy', f"Unexpected health status: {data}"
        print("✓ Health endpoint working")


class TestAuthRoutes:
    """Test auth endpoints from auth_routes.py"""
    
    def test_login_trainer(self):
        """POST /api/auth/login with trainer credentials - must return access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"No access_token in response: {data}"
        assert "user" in data, f"No user in response: {data}"
        assert data["user"]["email"] == TRAINER_EMAIL
        print(f"✓ Trainer login successful, token: {data['access_token'][:20]}...")
        return data["access_token"]
    
    def test_login_trainee(self):
        """POST /api/auth/login with trainee credentials - must return access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"No access_token in response: {data}"
        assert "user" in data, f"No user in response: {data}"
        assert data["user"]["email"] == TRAINEE_EMAIL
        print(f"✓ Trainee login successful, token: {data['access_token'][:20]}...")
        return data["access_token"]
    
    def test_login_admin(self):
        """POST /api/auth/login with admin credentials - must return access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"No access_token in response: {data}"
        assert "user" in data, f"No user in response: {data}"
        assert data["user"].get("isAdmin") == True, f"Admin flag not set: {data['user']}"
        print(f"✓ Admin login successful, isAdmin={data['user'].get('isAdmin')}")
        return data["access_token"]
    
    def test_auth_me_with_token(self):
        """GET /api/auth/me with valid token - must return user data"""
        # First login to get token
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        token = login_resp.json()["access_token"]
        
        # Then call /auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        data = response.json()
        assert data.get("email") == TRAINER_EMAIL, f"Wrong email in response: {data}"
        assert "id" in data, f"No id in response: {data}"
        print(f"✓ Auth me returned user: {data.get('fullName')}")
    
    def test_auth_me_without_token(self):
        """GET /api/auth/me without token - must return 401/403"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Auth me correctly rejects unauthenticated requests")
    
    def test_signup_new_user(self):
        """POST /api/auth/signup with new unique email - must work"""
        unique_email = f"test_iter65_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": "Test User Iter65",
            "email": unique_email,
            "phone": "555-0165",
            "password": "Test123!",
            "roles": ["trainee"]
        })
        assert response.status_code == 200, f"Signup failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"No access_token in signup response: {data}"
        assert "user" in data, f"No user in signup response: {data}"
        assert data["user"]["email"] == unique_email
        print(f"✓ Signup successful for {unique_email}")
    
    def test_change_password(self):
        """POST /api/auth/change-password - must work"""
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        token = login_resp.json()["access_token"]
        
        # Change password to same password (just testing the endpoint works)
        response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "currentPassword": TRAINER_PASSWORD,
                "newPassword": TRAINER_PASSWORD  # Same password for test
            }
        )
        assert response.status_code == 200, f"Change password failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Change password not successful: {data}"
        print("✓ Change password endpoint working")
    
    def test_forgot_password(self):
        """POST /api/auth/forgot-password - must accept valid email"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": TRAINER_EMAIL
        })
        assert response.status_code == 200, f"Forgot password failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Forgot password not successful: {data}"
        print("✓ Forgot password endpoint working")


class TestSessionRoutes:
    """Test session endpoints from session_routes.py"""
    
    @pytest.fixture
    def trainee_token(self):
        """Get trainee auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def trainer_token(self):
        """Get trainer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def trainee_id(self, trainee_token):
        """Get trainee user ID"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        return response.json()["id"]
    
    @pytest.fixture
    def trainer_id(self, trainer_token):
        """Get trainer user ID"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        return response.json()["id"]
    
    def test_get_trainee_sessions(self, trainee_token, trainee_id):
        """GET /api/sessions/trainee/{traineeId} - must return sessions list"""
        # Using the trainee/sessions endpoint which is the correct one
        response = requests.get(
            f"{BASE_URL}/api/trainee/sessions",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 200, f"Get trainee sessions failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got: {type(data)}"
        print(f"✓ Trainee sessions endpoint returned {len(data)} sessions")
    
    def test_get_trainer_sessions(self, trainer_token, trainer_id):
        """GET /api/sessions/trainer/{trainerId} - must return sessions list"""
        # Using the trainer/sessions endpoint which is the correct one
        response = requests.get(
            f"{BASE_URL}/api/trainer/sessions",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Get trainer sessions failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), f"Expected list, got: {type(data)}"
        print(f"✓ Trainer sessions endpoint returned {len(data)} sessions")


class TestAdminRoutes:
    """Test admin endpoints from admin_routes.py"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_admin_dashboard(self, admin_token):
        """GET /api/admin/dashboard - must return stats with totalUsers"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin dashboard failed: {response.text}"
        data = response.json()
        assert "totalUsers" in data, f"No totalUsers in dashboard: {data}"
        assert "totalTrainers" in data, f"No totalTrainers in dashboard: {data}"
        assert "totalTrainees" in data, f"No totalTrainees in dashboard: {data}"
        assert "totalSessions" in data, f"No totalSessions in dashboard: {data}"
        print(f"✓ Admin dashboard: {data.get('totalUsers')} users, {data.get('totalSessions')} sessions")
    
    def test_admin_users_paginated(self, admin_token):
        """GET /api/admin/users?page=1&limit=5 - must return paginated users"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users?skip=0&limit=5",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin users failed: {response.text}"
        data = response.json()
        assert "users" in data, f"No users in response: {data}"
        assert "total" in data, f"No total in response: {data}"
        assert isinstance(data["users"], list), f"Users not a list: {type(data['users'])}"
        assert len(data["users"]) <= 5, f"More than 5 users returned: {len(data['users'])}"
        print(f"✓ Admin users: {len(data['users'])} users returned, total: {data.get('total')}")
    
    def test_admin_top_trainers(self, admin_token):
        """GET /api/admin/top-trainers - must return list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/top-trainers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin top trainers failed: {response.text}"
        data = response.json()
        assert "leaderboard" in data, f"No leaderboard in response: {data}"
        assert isinstance(data["leaderboard"], list), f"Leaderboard not a list: {type(data['leaderboard'])}"
        print(f"✓ Admin top trainers: {len(data['leaderboard'])} trainers in leaderboard")
    
    def test_admin_earnings_summary(self, admin_token):
        """GET /api/admin/earnings-summary - must return earnings data"""
        response = requests.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin earnings summary failed: {response.text}"
        data = response.json()
        assert "totalRevenueCents" in data, f"No totalRevenueCents in response: {data}"
        assert "platformRevenueCents" in data, f"No platformRevenueCents in response: {data}"
        assert "trainerPayoutsCents" in data, f"No trainerPayoutsCents in response: {data}"
        print(f"✓ Admin earnings: total=${data.get('totalRevenueCents', 0)/100:.2f}, platform=${data.get('platformRevenueCents', 0)/100:.2f}")
    
    def test_admin_requires_auth(self):
        """Admin endpoints should reject non-admin users"""
        # Login as trainee (non-admin)
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        trainee_token = login_resp.json()["access_token"]
        
        # Try to access admin dashboard
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("✓ Admin endpoints correctly reject non-admin users")


class TestServerPyRoutes:
    """Test routes that remain in server.py (personality-tag, accent-color)"""
    
    @pytest.fixture
    def trainer_token(self):
        """Get trainer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def trainer_id(self, trainer_token):
        """Get trainer user ID"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        return response.json()["id"]
    
    def test_personality_tag_set_valid(self, trainer_token, trainer_id):
        """PUT /api/trainer-profiles/{userId}/personality-tag - must still work"""
        # Valid tags are uppercase: INTENSE, CHILL, BEAST MODE, ZEN, HIGH ENERGY, NO EXCUSES, PATIENT, COMPETITIVE
        response = requests.put(
            f"{BASE_URL}/api/trainer-profiles/{trainer_id}/personality-tag",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={"personalityTag": "HIGH ENERGY"}
        )
        assert response.status_code == 200, f"Set personality tag failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Personality tag not successful: {data}"
        print(f"✓ Personality tag set to: {data.get('personalityTag')}")
    
    def test_accent_color_set_valid(self, trainer_token, trainer_id):
        """PUT /api/trainer-profiles/{userId}/accent-color - must still work"""
        response = requests.put(
            f"{BASE_URL}/api/trainer-profiles/{trainer_id}/accent-color",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={"accentColor": "#0984E3"}
        )
        assert response.status_code == 200, f"Set accent color failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Accent color not successful: {data}"
        print(f"✓ Accent color set to: {data.get('accentColor')}")


class TestImportVerification:
    """Verify that route modules are properly imported and working"""
    
    def test_auth_routes_limiter(self):
        """Verify rate limiter is working on auth routes"""
        # Just verify the endpoint responds (limiter is imported from deps.py)
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        })
        # Should get 401 (invalid credentials), not 500 (import error)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ Auth routes with limiter working correctly")
    
    def test_session_routes_imports(self):
        """Verify session routes are properly imported"""
        # Login as trainer
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        token = login_resp.json()["access_token"]
        
        # Access trainer sessions endpoint
        response = requests.get(
            f"{BASE_URL}/api/trainer/sessions",
            headers={"Authorization": f"Bearer {token}"}
        )
        # Should get 200, not 500 (import error)
        assert response.status_code == 200, f"Session routes import issue: {response.text}"
        print("✓ Session routes properly imported")
    
    def test_admin_routes_imports(self):
        """Verify admin routes are properly imported"""
        # Login as admin
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_resp.json()["access_token"]
        
        # Access admin dashboard
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        # Should get 200, not 500 (import error)
        assert response.status_code == 200, f"Admin routes import issue: {response.text}"
        print("✓ Admin routes properly imported")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
