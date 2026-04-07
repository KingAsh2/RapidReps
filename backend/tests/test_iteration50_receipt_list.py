"""
Iteration 50: Receipt List Endpoints Testing
Tests the NEW /api/trainee/receipts and /api/trainer/receipts endpoints.

Features tested:
1. GET /api/trainee/receipts - returns list of verified receipts for logged-in trainee
2. GET /api/trainer/receipts - returns list of verified receipts with trainerPayoutCents for logged-in trainer
3. Empty list for users with no verified sessions
4. Authentication required (401 without token)
5. Trainee receipts include correct fields
6. Trainer receipts include correct fields
7. Pagination with limit and offset parameters
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"

# Known test session with verified Zelle payment
TEST_SESSION_ID = "69a9d9ef7f7a0df960c5cd54"


class TestTraineeReceiptsEndpoint:
    """Tests for GET /api/trainee/receipts endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_trainee_token(self):
        """Login as trainee and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_trainee_receipts_requires_auth(self):
        """Test that endpoint returns 401 without authentication"""
        response = self.session.get(f"{BASE_URL}/api/trainee/receipts")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Trainee receipts endpoint requires authentication")
    
    def test_trainee_receipts_returns_list(self):
        """Test that authenticated trainee gets list of receipts"""
        token = self.get_trainee_token()
        assert token, "Failed to get trainee token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/trainee/receipts")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "receipts" in data, "Response should contain 'receipts' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["receipts"], list), "receipts should be a list"
        assert isinstance(data["total"], int), "total should be an integer"
        
        print(f"PASS: Trainee receipts returns list with {len(data['receipts'])} receipts, total: {data['total']}")
    
    def test_trainee_receipts_correct_fields(self):
        """Test that trainee receipts include all required fields"""
        token = self.get_trainee_token()
        assert token, "Failed to get trainee token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/trainee/receipts")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data["receipts"]) > 0:
            receipt = data["receipts"][0]
            
            # Required fields for trainee receipts
            required_fields = [
                "receiptNumber",
                "sessionId",
                "trainerName",
                "sessionType",
                "durationMinutes",
                "totalCents",
                "date",
                "paymentVerifiedAt"
            ]
            
            for field in required_fields:
                assert field in receipt, f"Missing required field: {field}"
            
            # Verify field types
            assert receipt["receiptNumber"].startswith("RR-"), "receiptNumber should start with 'RR-'"
            assert isinstance(receipt["totalCents"], int), "totalCents should be an integer"
            assert isinstance(receipt["durationMinutes"], int), "durationMinutes should be an integer"
            
            print(f"PASS: Trainee receipt has all required fields: {list(receipt.keys())}")
            print(f"  Sample receipt: receiptNumber={receipt['receiptNumber']}, totalCents={receipt['totalCents']}")
        else:
            print("INFO: No receipts found for trainee - fields validation skipped")
    
    def test_trainee_receipts_pagination(self):
        """Test pagination with limit and offset parameters"""
        token = self.get_trainee_token()
        assert token, "Failed to get trainee token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Test with limit=1
        response = self.session.get(f"{BASE_URL}/api/trainee/receipts?limit=1&offset=0")
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["receipts"]) <= 1, "Limit=1 should return at most 1 receipt"
        
        # Test with offset
        response_offset = self.session.get(f"{BASE_URL}/api/trainee/receipts?limit=10&offset=100")
        assert response_offset.status_code == 200
        
        print(f"PASS: Pagination works - limit=1 returned {len(data['receipts'])} receipts")


class TestTrainerReceiptsEndpoint:
    """Tests for GET /api/trainer/receipts endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_trainer_token(self):
        """Login as trainer and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_trainer_receipts_requires_auth(self):
        """Test that endpoint returns 401 without authentication"""
        response = self.session.get(f"{BASE_URL}/api/trainer/receipts")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Trainer receipts endpoint requires authentication")
    
    def test_trainer_receipts_returns_list(self):
        """Test that authenticated trainer gets list of receipts"""
        token = self.get_trainer_token()
        assert token, "Failed to get trainer token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/trainer/receipts")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "receipts" in data, "Response should contain 'receipts' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["receipts"], list), "receipts should be a list"
        assert isinstance(data["total"], int), "total should be an integer"
        
        print(f"PASS: Trainer receipts returns list with {len(data['receipts'])} receipts, total: {data['total']}")
    
    def test_trainer_receipts_correct_fields(self):
        """Test that trainer receipts include all required fields including trainerPayoutCents"""
        token = self.get_trainer_token()
        assert token, "Failed to get trainer token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/trainer/receipts")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data["receipts"]) > 0:
            receipt = data["receipts"][0]
            
            # Required fields for trainer receipts (includes trainerPayoutCents)
            required_fields = [
                "receiptNumber",
                "sessionId",
                "traineeName",
                "sessionType",
                "durationMinutes",
                "totalCents",
                "trainerPayoutCents",  # Trainer-specific field
                "date",
                "paymentVerifiedAt"
            ]
            
            for field in required_fields:
                assert field in receipt, f"Missing required field: {field}"
            
            # Verify field types
            assert receipt["receiptNumber"].startswith("RR-"), "receiptNumber should start with 'RR-'"
            assert isinstance(receipt["totalCents"], int), "totalCents should be an integer"
            assert isinstance(receipt["trainerPayoutCents"], int), "trainerPayoutCents should be an integer"
            assert isinstance(receipt["durationMinutes"], int), "durationMinutes should be an integer"
            
            # Verify 80/20 split (trainer gets 80%)
            expected_payout = int(receipt["totalCents"] * 0.8)
            assert receipt["trainerPayoutCents"] == expected_payout, \
                f"trainerPayoutCents should be 80% of totalCents. Expected {expected_payout}, got {receipt['trainerPayoutCents']}"
            
            print(f"PASS: Trainer receipt has all required fields: {list(receipt.keys())}")
            print(f"  Sample receipt: receiptNumber={receipt['receiptNumber']}, totalCents={receipt['totalCents']}, trainerPayoutCents={receipt['trainerPayoutCents']}")
        else:
            print("INFO: No receipts found for trainer - fields validation skipped")
    
    def test_trainer_receipts_pagination(self):
        """Test pagination with limit and offset parameters"""
        token = self.get_trainer_token()
        assert token, "Failed to get trainer token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Test with limit=1
        response = self.session.get(f"{BASE_URL}/api/trainer/receipts?limit=1&offset=0")
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["receipts"]) <= 1, "Limit=1 should return at most 1 receipt"
        
        # Test with offset
        response_offset = self.session.get(f"{BASE_URL}/api/trainer/receipts?limit=10&offset=100")
        assert response_offset.status_code == 200
        
        print(f"PASS: Pagination works - limit=1 returned {len(data['receipts'])} receipts")


class TestEmptyReceiptsList:
    """Tests for users with no verified sessions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def create_test_user_and_get_token(self, role: str):
        """Create a new test user with no sessions and get token"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        email = f"test_empty_{role}_{unique_id}@test.com"
        
        # Signup
        signup_response = self.session.post(f"{BASE_URL}/api/auth/signup", json={
            "fullName": f"Test Empty {role.title()}",
            "email": email,
            "phone": "1234567890",
            "password": "Test123!",
            "roles": [role]
        })
        
        if signup_response.status_code == 200:
            return signup_response.json().get("access_token")
        return None
    
    def test_trainee_empty_receipts_list(self):
        """Test that new trainee with no sessions gets empty receipts list"""
        token = self.create_test_user_and_get_token("trainee")
        if not token:
            pytest.skip("Could not create test trainee user")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/trainee/receipts")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["receipts"] == [], "New trainee should have empty receipts list"
        assert data["total"] == 0, "New trainee should have total=0"
        
        print("PASS: New trainee with no sessions gets empty receipts list")
    
    def test_trainer_empty_receipts_list(self):
        """Test that new trainer with no sessions gets empty receipts list"""
        token = self.create_test_user_and_get_token("trainer")
        if not token:
            pytest.skip("Could not create test trainer user")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/trainer/receipts")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["receipts"] == [], "New trainer should have empty receipts list"
        assert data["total"] == 0, "New trainer should have total=0"
        
        print("PASS: New trainer with no sessions gets empty receipts list")


class TestReceiptsDataIntegrity:
    """Tests for data integrity and consistency"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_trainee_token(self):
        """Login as trainee and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def get_trainer_token(self):
        """Login as trainer and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_same_session_appears_in_both_lists(self):
        """Test that the same verified session appears in both trainee and trainer receipts"""
        trainee_token = self.get_trainee_token()
        trainer_token = self.get_trainer_token()
        
        assert trainee_token, "Failed to get trainee token"
        assert trainer_token, "Failed to get trainer token"
        
        # Get trainee receipts
        self.session.headers.update({"Authorization": f"Bearer {trainee_token}"})
        trainee_response = self.session.get(f"{BASE_URL}/api/trainee/receipts")
        assert trainee_response.status_code == 200
        trainee_data = trainee_response.json()
        
        # Get trainer receipts
        self.session.headers.update({"Authorization": f"Bearer {trainer_token}"})
        trainer_response = self.session.get(f"{BASE_URL}/api/trainer/receipts")
        assert trainer_response.status_code == 200
        trainer_data = trainer_response.json()
        
        # Find common session IDs
        trainee_session_ids = {r["sessionId"] for r in trainee_data["receipts"]}
        trainer_session_ids = {r["sessionId"] for r in trainer_data["receipts"]}
        
        # Check if test session appears in both (if it exists)
        if TEST_SESSION_ID in trainee_session_ids and TEST_SESSION_ID in trainer_session_ids:
            # Get the receipt from both lists
            trainee_receipt = next(r for r in trainee_data["receipts"] if r["sessionId"] == TEST_SESSION_ID)
            trainer_receipt = next(r for r in trainer_data["receipts"] if r["sessionId"] == TEST_SESSION_ID)
            
            # Verify same totalCents
            assert trainee_receipt["totalCents"] == trainer_receipt["totalCents"], \
                "totalCents should match between trainee and trainer receipts"
            
            # Verify same receiptNumber
            assert trainee_receipt["receiptNumber"] == trainer_receipt["receiptNumber"], \
                "receiptNumber should match between trainee and trainer receipts"
            
            print(f"PASS: Session {TEST_SESSION_ID} appears in both lists with matching data")
            print(f"  totalCents: {trainee_receipt['totalCents']}, trainerPayoutCents: {trainer_receipt['trainerPayoutCents']}")
        else:
            print(f"INFO: Test session {TEST_SESSION_ID} not found in both lists - cross-validation skipped")
            print(f"  Trainee has {len(trainee_data['receipts'])} receipts, Trainer has {len(trainer_data['receipts'])} receipts")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
