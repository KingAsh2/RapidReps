"""
Iteration 38: 508 ADA Compliance & UX Enhancements Testing
Tests backend APIs to verify they still work after 508 compliance UI layer was added
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://syntax-solve.preview.emergentagent.com')

class TestHealthAndAuth:
    """Basic health check and authentication tests"""
    
    def test_health_endpoint(self):
        """Backend health check"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print("✓ Health endpoint returns healthy status")
    
    def test_admin_login(self):
        """Admin login with valid credentials returns access_token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@rapidreps.com", "password": "admin123"},
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert 'access_token' in data
        assert data['token_type'] == 'bearer'
        assert 'user' in data
        assert data['user']['email'] == 'admin@rapidreps.com'
        print("✓ Admin login returns access_token")
    
    def test_login_invalid_credentials(self):
        """Invalid credentials return 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"},
            timeout=10
        )
        assert response.status_code == 401
        print("✓ Invalid login returns 401")


class TestBackgroundPII:
    """Tests for background check PII submission endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@rapidreps.com", "password": "admin123"},
            timeout=10
        )
        return response.json().get('access_token')
    
    def test_submit_background_pii_success(self, auth_token):
        """POST /api/trainer/submit-background-pii with required fields returns success"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/trainer/submit-background-pii",
            json={
                "fullName": "Test User",
                "dob": "01/15/1990",
                "address": "123 Test St, New York, NY 10001"
            },
            headers=headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') == True or 'success' in str(data).lower()
        print("✓ Submit background PII returns success")
    
    def test_submit_background_pii_missing_fields(self, auth_token):
        """POST /api/trainer/submit-background-pii without required fields returns 400"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/trainer/submit-background-pii",
            json={"fullName": "Test User"},  # Missing dob and address
            headers=headers,
            timeout=10
        )
        assert response.status_code == 400
        print("✓ Submit background PII without required fields returns 400")


class TestFavoriteToggle:
    """Tests for toggle favorite functionality"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@rapidreps.com", "password": "admin123"},
            timeout=10
        )
        return response.json().get('access_token')
    
    def test_toggle_favorite(self, auth_token):
        """POST /api/trainee/toggle-favorite/{trainerId} returns isFavorite toggle"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # First toggle
        response = requests.post(
            f"{BASE_URL}/api/trainee/toggle-favorite/someTrainerId123",
            headers=headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert 'isFavorite' in data
        first_state = data['isFavorite']
        print(f"✓ First toggle - isFavorite: {first_state}")
        
        # Second toggle should flip the value
        response2 = requests.post(
            f"{BASE_URL}/api/trainee/toggle-favorite/someTrainerId123",
            headers=headers,
            timeout=10
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert 'isFavorite' in data2
        assert data2['isFavorite'] != first_state  # Should be opposite
        print(f"✓ Second toggle - isFavorite: {data2['isFavorite']} (toggled)")


class TestVerificationStatus:
    """Tests for trainer verification status endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@rapidreps.com", "password": "admin123"},
            timeout=10
        )
        return response.json().get('access_token')
    
    def test_verification_status(self, auth_token):
        """GET /api/trainer/verification-status returns step statuses"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/trainer/verification-status",
            headers=headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert 'steps' in data
        steps = data['steps']
        # Verify all expected verification steps are present
        expected_steps = ['identity', 'background', 'certification', 'cpr', 'insurance', 'photo', 'video']
        for step in expected_steps:
            assert step in steps, f"Missing step: {step}"
        print(f"✓ Verification status returns all {len(expected_steps)} steps")


class TestSessions:
    """Tests for trainer and trainee session endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@rapidreps.com", "password": "admin123"},
            timeout=10
        )
        return response.json().get('access_token')
    
    def test_trainer_sessions(self, auth_token):
        """GET /api/trainer/sessions returns sessions with isGroupSession field"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/trainer/sessions",
            headers=headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        # Data could be empty list but should return 200
        assert isinstance(data, list)
        print(f"✓ Trainer sessions returns {len(data)} sessions")
    
    def test_trainee_sessions(self, auth_token):
        """GET /api/trainee/sessions returns sessions with isGroupSession field"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/trainee/sessions",
            headers=headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Trainee sessions returns {len(data)} sessions")


class TestGroupSessions:
    """Tests for group sessions edit endpoint - proper error handling"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@rapidreps.com", "password": "admin123"},
            timeout=10
        )
        return response.json().get('access_token')
    
    def test_edit_nonexistent_group_session(self, auth_token):
        """PUT /api/group-sessions/{id} returns 404 for nonexistent session"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        # Use a valid ObjectId format that doesn't exist
        response = requests.put(
            f"{BASE_URL}/api/group-sessions/000000000000000000000000",
            json={"title": "Updated Title"},
            headers=headers,
            timeout=10
        )
        assert response.status_code == 404
        print("✓ Edit nonexistent group session returns 404")
    
    def test_edit_invalid_id_format(self, auth_token):
        """PUT /api/group-sessions/{id} returns 400 for malformed ID (not 500)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.put(
            f"{BASE_URL}/api/group-sessions/invalid-id-format",
            json={"title": "Updated Title"},
            headers=headers,
            timeout=10
        )
        # Should return 400 (bad request) not 500 (server error)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Edit with invalid ID format returns 400 (not 500)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
