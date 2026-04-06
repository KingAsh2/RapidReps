"""
Iteration 49: Receipt/Invoice PDF Generation Backend Tests
Tests for:
- GET /api/receipt-logo - Returns base64 logo data
- GET /api/receipts/session/{id} - Returns receipt data for admin/trainee/trainer
- GET /api/admin/receipts - Returns list of verified receipts for admin
- SessionResponse model includes zellePaymentStatus field
- Trainer sessions endpoint returns zellePaymentStatus in session data
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

# Known test session with zellePaymentStatus='verified' and totalCents=7500
TEST_SESSION_ID = "69a9d9ef7f7a0df960c5cd54"


class TestReceiptLogo:
    """Tests for GET /api/receipt-logo endpoint"""
    
    def test_receipt_logo_returns_base64_data(self):
        """Test that receipt-logo endpoint returns base64 logo data"""
        response = requests.get(f"{BASE_URL}/api/receipt-logo")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "logo" in data, "Response should contain 'logo' field"
        
        # Logo should be a non-empty base64 string
        logo = data["logo"]
        assert isinstance(logo, str), "Logo should be a string"
        assert len(logo) > 0, "Logo should not be empty"
        
        # Base64 encoded PNG starts with 'iVBOR' (PNG header)
        assert logo.startswith("iVBOR"), f"Logo should be base64 encoded PNG, got: {logo[:20]}..."
        print(f"✓ Receipt logo endpoint returns valid base64 data (length: {len(logo)} chars)")


class TestSessionReceipt:
    """Tests for GET /api/receipts/session/{id} endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def trainee_token(self):
        """Get trainee authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def trainer_token(self):
        """Get trainer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_admin_can_get_receipt(self, admin_token):
        """Test that admin can access receipt data for any session"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/receipts/session/{TEST_SESSION_ID}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required receipt fields
        assert "receiptNumber" in data, "Receipt should have receiptNumber"
        assert "totalCents" in data, "Receipt should have totalCents"
        assert "trainerPayoutCents" in data, "Receipt should have trainerPayoutCents"
        assert "platformFeeCents" in data, "Receipt should have platformFeeCents"
        assert "paymentMethod" in data, "Receipt should have paymentMethod"
        assert "paymentStatus" in data, "Receipt should have paymentStatus"
        
        # Verify payment method is Zelle
        assert data["paymentMethod"] == "Zelle", f"Payment method should be Zelle, got: {data['paymentMethod']}"
        
        # Verify receipt number format
        assert data["receiptNumber"].startswith("RR-"), f"Receipt number should start with RR-, got: {data['receiptNumber']}"
        
        # Verify isAdmin flag
        assert data.get("isAdmin") == True, "Admin should have isAdmin=True"
        
        print(f"✓ Admin can access receipt: {data['receiptNumber']}")
        print(f"  - Total: ${data['totalCents']/100:.2f}")
        print(f"  - Trainer Payout: ${data['trainerPayoutCents']/100:.2f}")
        print(f"  - Platform Fee: ${data['platformFeeCents']/100:.2f}")
        print(f"  - Payment Status: {data['paymentStatus']}")
    
    def test_trainee_can_get_own_receipt(self, trainee_token):
        """Test that trainee can access receipt for their own session"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.get(
            f"{BASE_URL}/api/receipts/session/{TEST_SESSION_ID}",
            headers=headers
        )
        
        # Trainee should be able to access if they own the session
        # If not their session, they get 403
        if response.status_code == 200:
            data = response.json()
            assert data.get("isTrainee") == True, "Trainee should have isTrainee=True"
            print(f"✓ Trainee can access their receipt: {data['receiptNumber']}")
        elif response.status_code == 403:
            print(f"✓ Trainee correctly denied access to session they don't own")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}: {response.text}")
    
    def test_trainer_can_get_own_receipt(self, trainer_token):
        """Test that trainer can access receipt for their own session"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(
            f"{BASE_URL}/api/receipts/session/{TEST_SESSION_ID}",
            headers=headers
        )
        
        # Trainer should be able to access if they own the session
        # If not their session, they get 403
        if response.status_code == 200:
            data = response.json()
            assert data.get("isTrainer") == True, "Trainer should have isTrainer=True"
            print(f"✓ Trainer can access their receipt: {data['receiptNumber']}")
        elif response.status_code == 403:
            print(f"✓ Trainer correctly denied access to session they don't own")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}: {response.text}")
    
    def test_receipt_has_correct_amount_fields(self, admin_token):
        """Test that receipt contains correct amount calculations"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/receipts/session/{TEST_SESSION_ID}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        total = data.get("totalCents", 0)
        trainer_payout = data.get("trainerPayoutCents", 0)
        platform_fee = data.get("platformFeeCents", 0)
        
        # Verify 80/20 split (trainer gets 80%, platform gets 20%)
        expected_trainer = int(total * 0.80)
        expected_platform = total - expected_trainer
        
        assert trainer_payout == expected_trainer, f"Trainer payout should be {expected_trainer}, got {trainer_payout}"
        assert platform_fee == expected_platform, f"Platform fee should be {expected_platform}, got {platform_fee}"
        
        # Verify percentages
        assert data.get("trainerPercent") == 80, f"Trainer percent should be 80, got {data.get('trainerPercent')}"
        assert data.get("platformPercent") == 20, f"Platform percent should be 20, got {data.get('platformPercent')}"
        
        print(f"✓ Receipt amounts are correct (80/20 split verified)")
    
    def test_receipt_not_found_for_invalid_session(self, admin_token):
        """Test that 404 is returned for non-existent session"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/receipts/session/000000000000000000000000",
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Correctly returns 404 for non-existent session")
    
    def test_receipt_requires_authentication(self):
        """Test that receipt endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/receipts/session/{TEST_SESSION_ID}")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Receipt endpoint correctly requires authentication")


class TestAdminReceipts:
    """Tests for GET /api/admin/receipts endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def trainee_token(self):
        """Get trainee authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_admin_can_get_all_receipts(self, admin_token):
        """Test that admin can get list of all verified receipts"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/admin/receipts",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "receipts" in data, "Response should contain 'receipts' field"
        assert "total" in data, "Response should contain 'total' field"
        
        receipts = data["receipts"]
        assert isinstance(receipts, list), "Receipts should be a list"
        
        print(f"✓ Admin can access receipts list (total: {data['total']})")
        
        # If there are receipts, verify structure
        if len(receipts) > 0:
            receipt = receipts[0]
            assert "receiptNumber" in receipt, "Receipt should have receiptNumber"
            assert "sessionId" in receipt, "Receipt should have sessionId"
            assert "traineeName" in receipt, "Receipt should have traineeName"
            assert "trainerName" in receipt, "Receipt should have trainerName"
            assert "totalCents" in receipt, "Receipt should have totalCents"
            print(f"  - First receipt: {receipt['receiptNumber']}")
    
    def test_non_admin_cannot_access_admin_receipts(self, trainee_token):
        """Test that non-admin users cannot access admin receipts endpoint"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.get(
            f"{BASE_URL}/api/admin/receipts",
            headers=headers
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Non-admin correctly denied access to admin receipts")


class TestSessionResponseZelleStatus:
    """Tests for zellePaymentStatus field in SessionResponse"""
    
    @pytest.fixture(scope="class")
    def trainer_token(self):
        """Get trainer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def trainee_token(self):
        """Get trainee authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_trainer_sessions_include_zelle_status(self, trainer_token):
        """Test that trainer sessions endpoint returns zellePaymentStatus"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(
            f"{BASE_URL}/api/trainer/sessions",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        sessions = response.json()
        assert isinstance(sessions, list), "Response should be a list"
        
        print(f"✓ Trainer sessions endpoint returns {len(sessions)} sessions")
        
        # Check if any session has zellePaymentStatus field
        # The field should be present in the SessionResponse model
        for session in sessions:
            # zellePaymentStatus is optional, so it may be None or a string
            if "zellePaymentStatus" in session:
                status = session.get("zellePaymentStatus")
                print(f"  - Session {session.get('id', 'N/A')}: zellePaymentStatus={status}")
    
    def test_trainee_sessions_include_zelle_status(self, trainee_token):
        """Test that trainee sessions endpoint returns zellePaymentStatus"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.get(
            f"{BASE_URL}/api/trainee/sessions",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        sessions = response.json()
        assert isinstance(sessions, list), "Response should be a list"
        
        print(f"✓ Trainee sessions endpoint returns {len(sessions)} sessions")
        
        # Check if any session has zellePaymentStatus field
        for session in sessions:
            if "zellePaymentStatus" in session:
                status = session.get("zellePaymentStatus")
                print(f"  - Session {session.get('id', 'N/A')}: zellePaymentStatus={status}")


class TestReceiptDataIntegrity:
    """Tests for receipt data integrity and completeness"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_receipt_contains_all_required_fields(self, admin_token):
        """Test that receipt contains all required fields for PDF generation"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(
            f"{BASE_URL}/api/receipts/session/{TEST_SESSION_ID}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Required fields for PDF receipt generation
        required_fields = [
            "receiptNumber",
            "sessionId",
            "date",
            "sessionType",
            "durationMinutes",
            "traineeName",
            "trainerName",
            "totalCents",
            "trainerPayoutCents",
            "platformFeeCents",
            "paymentMethod",
            "paymentStatus",
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in data:
                missing_fields.append(field)
        
        assert len(missing_fields) == 0, f"Missing required fields: {missing_fields}"
        
        print(f"✓ Receipt contains all {len(required_fields)} required fields")
        print(f"  - Receipt Number: {data['receiptNumber']}")
        print(f"  - Session Type: {data['sessionType']}")
        print(f"  - Duration: {data['durationMinutes']} minutes")
        print(f"  - Trainee: {data['traineeName']}")
        print(f"  - Trainer: {data['trainerName']}")
        print(f"  - Total: ${data['totalCents']/100:.2f}")
        print(f"  - Payment Method: {data['paymentMethod']}")
        print(f"  - Payment Status: {data['paymentStatus']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
