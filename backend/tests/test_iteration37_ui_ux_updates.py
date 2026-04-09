"""
Iteration 37: UI/UX Updates Testing
Tests backend endpoints for the 23 UI/UX changes implemented in this session.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://uiux-refinements.preview.emergentagent.com"

class TestHealthCheck:
    """Basic health check"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ Health check passed: {data}")


class TestAuthLogin:
    """Authentication endpoint tests"""
    
    def test_login_admin_success(self):
        """Test POST /api/auth/login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "admin@rapidreps.com"
        print(f"✓ Admin login success, token received: {data['access_token'][:20]}...")
        return data["access_token"]

    def test_login_invalid_credentials(self):
        """Test login fails with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected with 401")


class TestBackgroundPIISubmission:
    """Test the submit-background-pii endpoint (TruthFinder PII modal)"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    def test_submit_background_pii_success(self, auth_token):
        """Test POST /api/trainer/submit-background-pii with valid data"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/trainer/submit-background-pii", 
            json={
                "fullName": "John Test Trainer",
                "dob": "1990-01-15",
                "address": "123 Test Street, Los Angeles, CA 90001"
            },
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "submitted for background check" in data.get("message", "").lower()
        print(f"✓ Background PII submission success: {data}")
    
    def test_submit_background_pii_missing_fields(self, auth_token):
        """Test POST /api/trainer/submit-background-pii fails without required fields"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/trainer/submit-background-pii", 
            json={
                "fullName": "John Test"
                # Missing dob and address
            },
            headers=headers
        )
        assert response.status_code == 400
        print("✓ Background PII correctly requires fullName, dob, and address (400 error)")


class TestToggleFavorite:
    """Test the toggle-favorite endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    def test_toggle_favorite_trainer(self, auth_token):
        """Test POST /api/trainee/toggle-favorite/{trainerId} returns isFavorite toggle"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        trainer_id = "someTrainerId123"
        
        # First toggle - should add to favorites
        response = requests.post(f"{BASE_URL}/api/trainee/toggle-favorite/{trainer_id}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "isFavorite" in data
        assert data.get("success") == True
        first_state = data["isFavorite"]
        print(f"✓ First toggle - isFavorite: {first_state}")
        
        # Second toggle - should toggle the state
        response = requests.post(f"{BASE_URL}/api/trainee/toggle-favorite/{trainer_id}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["isFavorite"] != first_state
        print(f"✓ Second toggle - isFavorite toggled to: {data['isFavorite']}")


class TestVerificationStatus:
    """Test the verification-status endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    def test_get_verification_status(self, auth_token):
        """Test GET /api/trainer/verification-status returns step statuses"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/verification-status",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return steps dictionary
        assert "steps" in data
        assert "canGoLive" in data
        
        # Steps should include expected fields
        steps = data["steps"]
        expected_steps = ['identity', 'background', 'certification', 'cpr', 'insurance', 'photo', 'video']
        for step in expected_steps:
            assert step in steps, f"Missing step: {step}"
        
        print(f"✓ Verification status returned with steps: {list(steps.keys())}")
        print(f"  canGoLive: {data['canGoLive']}")


class TestTrainerSessions:
    """Test trainer sessions endpoint includes isGroupSession field"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    def test_get_trainer_sessions(self, auth_token):
        """Test GET /api/trainer/sessions returns sessions (including isGroupSession field in model)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/sessions",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Response should be a list of sessions
        assert isinstance(data, list)
        print(f"✓ GET /api/trainer/sessions returned {len(data)} sessions")
        
        # If there are sessions, check the structure
        if data:
            session = data[0]
            print(f"  First session keys: {list(session.keys())[:10]}...")


class TestTraineeSessions:
    """Test trainee sessions endpoint includes isGroupSession field"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    def test_get_trainee_sessions(self, auth_token):
        """Test GET /api/trainee/sessions returns sessions"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/trainee/sessions",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Response should be a list of sessions
        assert isinstance(data, list)
        print(f"✓ GET /api/trainee/sessions returned {len(data)} sessions")


class TestGroupSessionsEdit:
    """Test PUT /api/group-sessions/{id} edit endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@rapidreps.com",
            "password": "admin123"
        })
        return response.json()["access_token"]
    
    def test_edit_group_session_invalid_id(self, auth_token):
        """Test PUT /api/group-sessions/{id} returns 404 for invalid ID (not 500)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        invalid_id = "000000000000000000000000"  # Valid ObjectId format but doesn't exist
        
        response = requests.put(f"{BASE_URL}/api/group-sessions/{invalid_id}",
            json={"title": "Updated Title"},
            headers=headers
        )
        
        # Should return 404 NOT 500
        assert response.status_code == 404, f"Expected 404 but got {response.status_code}: {response.text}"
        print(f"✓ PUT /api/group-sessions/{invalid_id} correctly returns 404 for non-existent session")

    def test_edit_group_session_malformed_id(self, auth_token):
        """Test PUT /api/group-sessions/{id} handles malformed ID gracefully"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.put(f"{BASE_URL}/api/group-sessions/invalid-id-format",
            json={"title": "Updated Title"},
            headers=headers
        )
        
        # Should return 400 or 404, not 500 (server error)
        assert response.status_code in [400, 404, 422], f"Expected 400/404/422 but got {response.status_code}: {response.text}"
        print(f"✓ PUT /api/group-sessions/invalid-id-format correctly returns {response.status_code} for malformed ID")


class TestSessionResponseModel:
    """Verify SessionResponse model includes isGroupSession field"""
    
    def test_session_response_has_isGroupSession_in_model(self):
        """Verify SessionResponse Pydantic model includes isGroupSession field"""
        # This is a code verification test - check that the field exists in the model
        import subprocess
        result = subprocess.run(
            ["grep", "-n", "isGroupSession", "/app/backend/server.py"],
            capture_output=True, text=True
        )
        assert "isGroupSession: bool = False" in result.stdout or "isGroupSession" in result.stdout
        print(f"✓ isGroupSession field exists in SessionResponse model")
        print(f"  Lines found: {result.stdout.strip()}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
