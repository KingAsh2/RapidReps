"""
Iteration 47: Zelle Payment System Tests
Tests the NEW Zelle payment endpoints that replaced Stripe Connect.

Endpoints tested:
- GET /api/settings/zelle - Public platform Zelle info
- PUT /api/admin/settings/zelle - Admin updates Zelle settings
- POST /api/payments/zelle/mark-sent - Trainee marks payment sent
- POST /api/admin/payments/verify-zelle/{session_id} - Admin verifies payment
- GET /api/admin/payments/pending-zelle - Admin sees pending payments
- POST /api/trainer/zelle-info - Trainer saves Zelle info
- GET /api/trainer/zelle-info - Trainer gets Zelle info
- GET /api/trainer/connect/status - Zelle-based connect status
- GET /api/admin/payouts/pending - Trainers with Zelle info
- POST /api/admin/payouts/pay-trainer - Mark trainer as paid
- POST /api/trainer/request-payout - Trainer requests payout
- GET /api/trainer/earnings - Trainer earnings endpoint
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"


class TestZellePaymentSystem:
    """Tests for Zelle payment system endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def trainee_token(self):
        """Get trainee auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def trainer_token(self):
        """Get trainer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        return response.json()["access_token"]
    
    # ============================================================================
    # Platform Zelle Settings Tests
    # ============================================================================
    
    def test_get_zelle_settings_public(self):
        """GET /api/settings/zelle - Public endpoint returns platform Zelle info"""
        response = requests.get(f"{BASE_URL}/api/settings/zelle")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should return zelleEmail and zellePhone
        assert "zelleEmail" in data, "Missing zelleEmail field"
        assert "zellePhone" in data, "Missing zellePhone field"
        
        # Verify seeded values (ashtonbundy1@gmail.com / 240-281-0462)
        assert data["zelleEmail"] == "ashtonbundy1@gmail.com", f"Unexpected zelleEmail: {data['zelleEmail']}"
        assert data["zellePhone"] == "240-281-0462", f"Unexpected zellePhone: {data['zellePhone']}"
        print(f"✓ Platform Zelle settings: {data}")
    
    def test_update_zelle_settings_admin(self, admin_token):
        """PUT /api/admin/settings/zelle - Admin can update Zelle settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Update settings
        response = requests.put(
            f"{BASE_URL}/api/admin/settings/zelle",
            headers=headers,
            json={"zelleEmail": "test_update@rapidreps.com", "zellePhone": "555-123-4567"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Update failed: {data}"
        print(f"✓ Admin updated Zelle settings: {data}")
        
        # Verify update via GET
        verify_response = requests.get(f"{BASE_URL}/api/settings/zelle")
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["zelleEmail"] == "test_update@rapidreps.com"
        assert verify_data["zellePhone"] == "555-123-4567"
        print(f"✓ Verified updated settings: {verify_data}")
        
        # Restore original settings
        restore_response = requests.put(
            f"{BASE_URL}/api/admin/settings/zelle",
            headers=headers,
            json={"zelleEmail": "ashtonbundy1@gmail.com", "zellePhone": "240-281-0462"}
        )
        assert restore_response.status_code == 200
        print("✓ Restored original Zelle settings")
    
    def test_update_zelle_settings_requires_admin(self, trainee_token):
        """PUT /api/admin/settings/zelle - Non-admin cannot update"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.put(
            f"{BASE_URL}/api/admin/settings/zelle",
            headers=headers,
            json={"zelleEmail": "hacker@test.com"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ Non-admin correctly blocked from updating Zelle settings")
    
    # ============================================================================
    # Trainer Zelle Info Tests
    # ============================================================================
    
    def test_trainer_save_zelle_info(self, trainer_token):
        """POST /api/trainer/zelle-info - Trainer saves Zelle contact info"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.post(
            f"{BASE_URL}/api/trainer/zelle-info",
            headers=headers,
            json={"zelleEmail": "trainer_zelle@test.com", "zellePhone": "555-0100"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Save failed: {data}"
        print(f"✓ Trainer saved Zelle info: {data}")
    
    def test_trainer_get_zelle_info(self, trainer_token):
        """GET /api/trainer/zelle-info - Trainer gets their Zelle info"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/zelle-info", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "zelleEmail" in data, "Missing zelleEmail"
        assert "zellePhone" in data, "Missing zellePhone"
        assert "hasZelleInfo" in data, "Missing hasZelleInfo"
        assert data["hasZelleInfo"] == True, "hasZelleInfo should be True"
        print(f"✓ Trainer Zelle info: {data}")
    
    def test_trainer_connect_status_zelle(self, trainer_token):
        """GET /api/trainer/connect/status - Returns Zelle-based connect status"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/connect/status", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should return Zelle-based status
        assert "connected" in data, "Missing connected field"
        assert "onboarded" in data, "Missing onboarded field"
        assert "paymentMethod" in data, "Missing paymentMethod field"
        assert data["paymentMethod"] == "zelle", f"Expected paymentMethod=zelle, got {data['paymentMethod']}"
        assert data["connected"] == True, "Trainer should be connected (has Zelle info)"
        print(f"✓ Trainer connect status (Zelle): {data}")
    
    def test_trainer_zelle_info_requires_auth(self):
        """GET /api/trainer/zelle-info - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/trainer/zelle-info")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Trainer Zelle info correctly requires auth")
    
    # ============================================================================
    # Trainee Zelle Payment Flow Tests
    # ============================================================================
    
    def test_zelle_mark_sent_requires_auth(self):
        """POST /api/payments/zelle/mark-sent - Requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/payments/zelle/mark-sent",
            json={"sessionId": "invalid_session_id"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Mark payment sent correctly requires auth")
    
    def test_zelle_mark_sent_invalid_session(self, trainee_token):
        """POST /api/payments/zelle/mark-sent - Returns 404 for invalid session"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.post(
            f"{BASE_URL}/api/payments/zelle/mark-sent",
            headers=headers,
            json={"sessionId": "000000000000000000000000"}  # Valid ObjectId format but doesn't exist
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Mark payment sent returns 404 for invalid session")
    
    # ============================================================================
    # Admin Zelle Payment Verification Tests
    # ============================================================================
    
    def test_admin_get_pending_zelle_payments(self, admin_token):
        """GET /api/admin/payments/pending-zelle - Admin sees pending Zelle payments"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/payments/pending-zelle", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "pendingPayments" in data, "Missing pendingPayments field"
        assert "count" in data, "Missing count field"
        assert isinstance(data["pendingPayments"], list), "pendingPayments should be a list"
        print(f"✓ Admin pending Zelle payments: count={data['count']}")
        
        # If there are pending payments, verify structure
        if data["pendingPayments"]:
            payment = data["pendingPayments"][0]
            expected_fields = ["sessionId", "traineeName", "sessionType", "amountCents"]
            for field in expected_fields:
                assert field in payment, f"Missing field: {field}"
            print(f"  Sample payment: {payment}")
    
    def test_admin_verify_zelle_invalid_session(self, admin_token):
        """POST /api/admin/payments/verify-zelle/{session_id} - Returns 404 for invalid session"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(
            f"{BASE_URL}/api/admin/payments/verify-zelle/000000000000000000000000",
            headers=headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Admin verify Zelle returns 404 for invalid session")
    
    def test_admin_pending_zelle_requires_admin(self, trainee_token):
        """GET /api/admin/payments/pending-zelle - Requires admin"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/payments/pending-zelle", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Pending Zelle payments correctly requires admin")
    
    # ============================================================================
    # Admin Payout Tests
    # ============================================================================
    
    def test_admin_get_pending_payouts(self, admin_token):
        """GET /api/admin/payouts/pending - Shows trainers with Zelle info"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/payouts/pending", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "trainers" in data, "Missing trainers field"
        assert "payoutMinimumCents" in data, "Missing payoutMinimumCents field"
        assert data["payoutMinimumCents"] == 3500, f"Expected minimum $35 (3500 cents), got {data['payoutMinimumCents']}"
        
        print(f"✓ Admin pending payouts: {len(data['trainers'])} trainers, eligible={data.get('eligibleCount', 0)}")
        
        # Verify trainer structure includes Zelle info
        if data["trainers"]:
            trainer = data["trainers"][0]
            expected_fields = ["trainerId", "trainerName", "zelleEmail", "zellePhone", "pendingBalanceCents", "eligible"]
            for field in expected_fields:
                assert field in trainer, f"Missing field: {field}"
            print(f"  Sample trainer: {trainer['trainerName']}, zelleEmail={trainer['zelleEmail']}, pending=${trainer['pendingBalanceCents']/100:.2f}")
    
    def test_admin_pay_trainer_invalid_trainer(self, admin_token):
        """POST /api/admin/payouts/pay-trainer - Returns 404 for invalid trainer"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(
            f"{BASE_URL}/api/admin/payouts/pay-trainer",
            headers=headers,
            json={"trainerId": "000000000000000000000000"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Admin pay trainer returns 404 for invalid trainer")
    
    def test_admin_payouts_requires_admin(self, trainee_token):
        """GET /api/admin/payouts/pending - Requires admin"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/payouts/pending", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Pending payouts correctly requires admin")
    
    # ============================================================================
    # Trainer Earnings & Payout Request Tests
    # ============================================================================
    
    def test_trainer_earnings(self, trainer_token):
        """GET /api/trainer/earnings - Trainer earnings endpoint works"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/earnings", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify expected fields
        expected_fields = ["totalEarningsCents", "pendingBalanceCents", "totalPaidOutCents"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Trainer earnings: total=${data['totalEarningsCents']/100:.2f}, pending=${data['pendingBalanceCents']/100:.2f}, paid=${data['totalPaidOutCents']/100:.2f}")
    
    def test_trainer_request_payout(self, trainer_token):
        """POST /api/trainer/request-payout - Trainer can request payout"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.post(
            f"{BASE_URL}/api/trainer/request-payout",
            headers=headers,
            json={
                "paymentMethod": "zelle",
                "paymentHandle": "trainer_zelle@test.com"
            }
        )
        # May return 200 (success) or 400 (insufficient balance or already pending)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}: {response.text}"
        data = response.json()
        
        if response.status_code == 200:
            print(f"✓ Trainer payout request created: {data}")
        else:
            # 400 is expected if balance < $35 or request already pending
            print(f"✓ Trainer payout request returned expected 400: {data.get('detail', data)}")
    
    def test_trainer_earnings_requires_auth(self):
        """GET /api/trainer/earnings - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/trainer/earnings")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Trainer earnings correctly requires auth")


class TestZelleEndToEndFlow:
    """End-to-end flow tests for Zelle payment system"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def trainee_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def trainer_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_full_zelle_flow_visibility(self, admin_token, trainee_token, trainer_token):
        """Test that all Zelle endpoints are accessible with proper auth"""
        # 1. Public can see platform Zelle info
        public_response = requests.get(f"{BASE_URL}/api/settings/zelle")
        assert public_response.status_code == 200
        print("✓ Step 1: Public can see platform Zelle info")
        
        # 2. Trainer can save/get their Zelle info
        trainer_headers = {"Authorization": f"Bearer {trainer_token}"}
        save_response = requests.post(
            f"{BASE_URL}/api/trainer/zelle-info",
            headers=trainer_headers,
            json={"zelleEmail": "trainer_e2e@test.com", "zellePhone": "555-E2E-TEST"}
        )
        assert save_response.status_code == 200
        print("✓ Step 2: Trainer can save Zelle info")
        
        # 3. Trainer can check connect status
        status_response = requests.get(f"{BASE_URL}/api/trainer/connect/status", headers=trainer_headers)
        assert status_response.status_code == 200
        assert status_response.json()["paymentMethod"] == "zelle"
        print("✓ Step 3: Trainer connect status shows Zelle")
        
        # 4. Admin can see pending payouts
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        payouts_response = requests.get(f"{BASE_URL}/api/admin/payouts/pending", headers=admin_headers)
        assert payouts_response.status_code == 200
        print("✓ Step 4: Admin can see pending payouts")
        
        # 5. Admin can see pending Zelle payments
        pending_response = requests.get(f"{BASE_URL}/api/admin/payments/pending-zelle", headers=admin_headers)
        assert pending_response.status_code == 200
        print("✓ Step 5: Admin can see pending Zelle payments")
        
        # 6. Trainer can view earnings
        earnings_response = requests.get(f"{BASE_URL}/api/trainer/earnings", headers=trainer_headers)
        assert earnings_response.status_code == 200
        print("✓ Step 6: Trainer can view earnings")
        
        print("\n✓ Full Zelle flow visibility test PASSED")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
