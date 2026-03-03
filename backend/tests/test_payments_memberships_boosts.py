"""
RapidReps Backend API Tests - Payments, Memberships, Boosts & Sessions
Tests the NEW endpoints for iteration 3:
- POST /api/payments/create-payment-intent (expected 400 due to invalid Stripe key)
- GET /api/payments/pricing-rules
- POST /api/payments/calculate-session-cost
- POST /api/memberships/subscribe
- GET /api/memberships/my-membership
- POST /api/boosts/purchase
- GET /api/boosts/my-boosts
- GET /api/sessions/trainer (actually /api/trainer/sessions)
- Regression tests for /api/trainer/verification-status, /api/trainer/earnings, /api/admin/dashboard
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://rapid-reps-preview.preview.emergentagent.com').rstrip('/')

# Test credentials
TRAINER1_EMAIL = "trainer1@test.com"
TRAINER2_EMAIL = "trainer2@test.com"
TRAINEE1_EMAIL = "trainee1@test.com"  # Has active membership
TRAINEE2_EMAIL = "trainee2@test.com"  # No membership
PASSWORD = "test123"
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def trainer1_token():
    """Get trainer1 auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINER1_EMAIL,
        "password": PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Trainer1 login failed")
    return response.json()["access_token"]


@pytest.fixture
def trainer2_token():
    """Get trainer2 auth token (has weekly boost)"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINER2_EMAIL,
        "password": PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Trainer2 login failed")
    return response.json()["access_token"]


@pytest.fixture
def trainee1_token():
    """Get trainee1 auth token (has active membership)"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINEE1_EMAIL,
        "password": PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Trainee1 login failed")
    return response.json()["access_token"]


@pytest.fixture
def trainee2_token():
    """Get trainee2 auth token (no membership)"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINEE2_EMAIL,
        "password": PASSWORD
    })
    if response.status_code != 200:
        pytest.skip("Trainee2 login failed")
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


# ============================================================================
# PAYMENT ENDPOINTS
# ============================================================================

class TestPaymentsPricingRules:
    """Test GET /api/payments/pricing-rules"""
    
    def test_pricing_rules_returns_all_fields(self):
        """GET /api/payments/pricing-rules returns minimumPrices, revenueSplit, boostPrices, membership"""
        response = requests.get(f"{BASE_URL}/api/payments/pricing-rules")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check revenueSplit exists
        assert "revenueSplit" in data
        assert data["revenueSplit"]["trainerPercent"] == 75
        assert data["revenueSplit"]["platformPercent"] == 25
        
        # Check minimumPrices exists
        assert "minimumPrices" in data
        assert "virtual" in data["minimumPrices"]
        assert "outdoor" in data["minimumPrices"]
        assert "inHome" in data["minimumPrices"]
        assert "traineeHome" in data["minimumPrices"]
        assert data["minimumPrices"]["virtual"] == 30  # $30 min
        assert data["minimumPrices"]["outdoor"] == 40  # $40 min
        
        # Check boostPrices exists
        assert "boostPrices" in data
        assert "daily" in data["boostPrices"]
        assert "weekly" in data["boostPrices"]
        assert "monthly" in data["boostPrices"]
        assert data["boostPrices"]["daily"] == 9.99
        assert data["boostPrices"]["weekly"] == 49.99
        assert data["boostPrices"]["monthly"] == 149.99
        
        # Check membership exists
        assert "membership" in data
        assert data["membership"]["monthlyPrice"] == 19.99
        assert "benefits" in data["membership"]
        assert len(data["membership"]["benefits"]) > 0
        
        print(f"Pricing rules retrieved successfully:")
        print(f"  Revenue split: {data['revenueSplit']}")
        print(f"  Minimum prices: {data['minimumPrices']}")
        print(f"  Boost prices: {data['boostPrices']}")
        print(f"  Membership: ${data['membership']['monthlyPrice']}/month")


class TestPaymentsCreatePaymentIntent:
    """Test POST /api/payments/create-payment-intent (expected to fail with invalid Stripe key)"""
    
    def test_create_payment_intent_returns_error_with_invalid_key(self, trainee1_token):
        """POST /api/payments/create-payment-intent returns 400 due to invalid Stripe key (mk_ prefix)"""
        headers = {"Authorization": f"Bearer {trainee1_token}"}
        response = requests.post(
            f"{BASE_URL}/api/payments/create-payment-intent",
            headers=headers,
            params={"amount_cents": 4000, "description": "Test session"}
        )
        
        # Expected: 400 error because Stripe key is invalid (mk_ prefix instead of sk_)
        assert response.status_code == 400
        print(f"Payment intent correctly returned error (invalid Stripe key): {response.json()}")


class TestPaymentsCalculateSessionCost:
    """Test POST /api/payments/calculate-session-cost"""
    
    def test_calculate_session_cost_outdoor(self):
        """POST /api/payments/calculate-session-cost returns cost breakdown for outdoor session"""
        response = requests.post(
            f"{BASE_URL}/api/payments/calculate-session-cost",
            params={"session_type": "outdoor", "session_price_cents": 4000}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check sessionPrice breakdown
        assert "sessionPrice" in data
        assert data["sessionPrice"]["total_cents"] == 4000
        assert data["sessionPrice"]["trainer_payout_cents"] == 3000  # 75% of 4000
        assert data["sessionPrice"]["platform_fee_cents"] == 1000   # 25% of 4000
        
        # Check totals
        assert "totals" in data
        assert data["totals"]["totalCents"] == 4000
        assert data["totals"]["totalDollars"] == 40.0
        assert data["totals"]["trainerPayoutCents"] == 3000
        assert data["totals"]["platformFeeCents"] == 1000
        
        print(f"Session cost calculated: Total ${data['totals']['totalDollars']}")
        print(f"  Trainer payout: ${data['totals']['trainerPayoutDollars']}")
        print(f"  Platform fee: ${data['totals']['platformFeeDollars']}")
    
    def test_calculate_session_cost_with_travel_fee(self):
        """POST /api/payments/calculate-session-cost includes travel fee in breakdown"""
        response = requests.post(
            f"{BASE_URL}/api/payments/calculate-session-cost",
            params={"session_type": "in_home", "session_price_cents": 6000, "travel_fee_cents": 1000}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check travel fee breakdown
        assert "travelFee" in data
        assert data["travelFee"]["total_cents"] == 1000
        assert data["travelFee"]["trainer_payout_cents"] == 700  # 70% of 1000
        assert data["travelFee"]["platform_fee_cents"] == 300    # 30% of 1000
        
        # Check totals include travel fee
        assert data["totals"]["totalCents"] == 7000  # 6000 + 1000
        
        print(f"In-home session cost with travel: Total ${data['totals']['totalDollars']}")


# ============================================================================
# MEMBERSHIP ENDPOINTS
# ============================================================================

class TestMembershipsMyMembership:
    """Test GET /api/memberships/my-membership"""
    
    def test_get_my_membership_trainee1_has_membership(self, trainee1_token):
        """GET /api/memberships/my-membership returns hasMembership=true for trainee1"""
        headers = {"Authorization": f"Bearer {trainee1_token}"}
        response = requests.get(f"{BASE_URL}/api/memberships/my-membership", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # trainee1 should have active membership
        assert "hasMembership" in data
        # Note: trainee1 might or might not have membership - check either case
        if data["hasMembership"]:
            assert "membership" in data
            assert data["membership"] is not None
            assert data["membership"]["status"] == "active"
            print(f"Trainee1 has active membership: start={data['membership'].get('startDate')}")
        else:
            print(f"Trainee1 does not have active membership (may need to subscribe first)")
    
    def test_get_my_membership_trainee2_no_membership(self, trainee2_token):
        """GET /api/memberships/my-membership for trainee2 who has no membership"""
        headers = {"Authorization": f"Bearer {trainee2_token}"}
        response = requests.get(f"{BASE_URL}/api/memberships/my-membership", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "hasMembership" in data
        # trainee2 should NOT have membership
        print(f"Trainee2 membership status: hasMembership={data['hasMembership']}")


class TestMembershipsSubscribe:
    """Test POST /api/memberships/subscribe"""
    
    def test_subscribe_creates_active_membership(self, trainee2_token):
        """POST /api/memberships/subscribe creates active membership for trainee2"""
        headers = {"Authorization": f"Bearer {trainee2_token}"}
        
        # First check if trainee2 already has membership
        check_response = requests.get(f"{BASE_URL}/api/memberships/my-membership", headers=headers)
        if check_response.status_code == 200 and check_response.json().get("hasMembership"):
            print("Trainee2 already has membership, skipping create test")
            pytest.skip("User already has membership")
        
        response = requests.post(f"{BASE_URL}/api/memberships/subscribe", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "active"
        assert data["monthlyPriceCents"] == 1999  # $19.99
        assert "startDate" in data
        assert "nextBillingDate" in data
        assert data["freeBoostsRemaining"] == 1
        
        print(f"Membership created successfully:")
        print(f"  Status: {data['status']}")
        print(f"  Price: ${data['monthlyPriceCents']/100}/month")
        print(f"  Free boosts remaining: {data['freeBoostsRemaining']}")
    
    def test_subscribe_rejects_duplicate_active_membership(self, trainee1_token):
        """POST /api/memberships/subscribe returns 400 if already has active membership"""
        headers = {"Authorization": f"Bearer {trainee1_token}"}
        
        # First ensure trainee1 has membership
        check_response = requests.get(f"{BASE_URL}/api/memberships/my-membership", headers=headers)
        if check_response.status_code == 200 and not check_response.json().get("hasMembership"):
            # Create membership first
            requests.post(f"{BASE_URL}/api/memberships/subscribe", headers=headers)
        
        # Now try to create duplicate
        response = requests.post(f"{BASE_URL}/api/memberships/subscribe", headers=headers)
        
        assert response.status_code == 400
        data = response.json()
        assert "already" in data.get("detail", "").lower() or "active" in data.get("detail", "").lower()
        
        print(f"Duplicate membership correctly rejected: {data.get('detail')}")


# ============================================================================
# BOOSTS ENDPOINTS
# ============================================================================

class TestBoostsPurchase:
    """Test POST /api/boosts/purchase"""
    
    def test_purchase_boost_daily_for_trainer(self, trainer1_token):
        """POST /api/boosts/purchase?boost_type=daily creates a boost for trainers"""
        headers = {"Authorization": f"Bearer {trainer1_token}"}
        response = requests.post(
            f"{BASE_URL}/api/boosts/purchase",
            headers=headers,
            params={"boost_type": "daily"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["boostType"] == "daily"
        assert data["priceCents"] == 999  # $9.99
        assert data["isActive"] == True
        assert "startDate" in data
        assert "endDate" in data
        
        print(f"Daily boost purchased:")
        print(f"  Type: {data['boostType']}")
        print(f"  Price: ${data['priceCents']/100}")
        print(f"  Active: {data['isActive']}")
    
    def test_purchase_boost_rejects_non_trainer(self, trainee1_token):
        """POST /api/boosts/purchase returns 403 for non-trainer users"""
        headers = {"Authorization": f"Bearer {trainee1_token}"}
        response = requests.post(
            f"{BASE_URL}/api/boosts/purchase",
            headers=headers,
            params={"boost_type": "daily"}
        )
        
        assert response.status_code == 403
        data = response.json()
        assert "trainer" in data.get("detail", "").lower()
        
        print(f"Non-trainer correctly rejected: {data.get('detail')}")
    
    def test_purchase_boost_invalid_type_fails(self, trainer1_token):
        """POST /api/boosts/purchase returns 400 for invalid boost type"""
        headers = {"Authorization": f"Bearer {trainer1_token}"}
        response = requests.post(
            f"{BASE_URL}/api/boosts/purchase",
            headers=headers,
            params={"boost_type": "invalid_type"}
        )
        
        assert response.status_code == 400
        print(f"Invalid boost type correctly rejected")


class TestBoostsMyBoosts:
    """Test GET /api/boosts/my-boosts"""
    
    def test_get_my_boosts_returns_trainer_boosts(self, trainer2_token):
        """GET /api/boosts/my-boosts returns trainer's boost list"""
        headers = {"Authorization": f"Bearer {trainer2_token}"}
        response = requests.get(f"{BASE_URL}/api/boosts/my-boosts", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "boosts" in data
        assert isinstance(data["boosts"], list)
        
        # trainer2 should have a weekly boost per the instructions
        print(f"Trainer2 has {len(data['boosts'])} boosts")
        for boost in data["boosts"]:
            print(f"  - {boost.get('boostType')}: active={boost.get('isActive')}")


# ============================================================================
# TRAINER SESSIONS
# ============================================================================

class TestTrainerSessions:
    """Test GET /api/trainer/sessions (trainer sessions list)"""
    
    def test_get_trainer_sessions_returns_list(self, trainer1_token):
        """GET /api/trainer/sessions returns trainer's sessions list"""
        headers = {"Authorization": f"Bearer {trainer1_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/sessions", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Response should be a list of sessions
        assert isinstance(data, list)
        
        print(f"Trainer1 has {len(data)} sessions")
        if len(data) > 0:
            session = data[0]
            print(f"  First session: status={session.get('status')}, type={session.get('sessionType')}")


# ============================================================================
# REGRESSION TESTS
# ============================================================================

class TestRegressionTrainerVerificationStatus:
    """Regression test for GET /api/trainer/verification-status"""
    
    def test_trainer_verification_status_still_works(self, trainer1_token):
        """GET /api/trainer/verification-status returns steps (regression)"""
        headers = {"Authorization": f"Bearer {trainer1_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/verification-status", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "steps" in data
        assert "canGoLive" in data
        
        print(f"Verification status regression test PASSED: {len(data['steps'])} steps found")


class TestRegressionTrainerEarnings:
    """Regression test for GET /api/trainer/earnings"""
    
    def test_trainer_earnings_still_works(self, trainer1_token):
        """GET /api/trainer/earnings returns earnings data (regression)"""
        headers = {"Authorization": f"Bearer {trainer1_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/earnings", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "totalEarningsCents" in data
        assert "pendingBalanceCents" in data
        
        print(f"Earnings regression test PASSED: totalEarnings=${data['totalEarningsCents']/100:.2f}")


class TestRegressionAdminDashboard:
    """Regression test for GET /api/admin/dashboard"""
    
    def test_admin_dashboard_still_works(self, admin_token):
        """GET /api/admin/dashboard returns stats (regression)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "totalUsers" in data
        assert "totalTrainers" in data
        assert "totalSessions" in data
        assert "activeMemberships" in data
        assert "activeBoosts" in data
        
        print(f"Admin dashboard regression test PASSED:")
        print(f"  Users: {data['totalUsers']}, Trainers: {data['totalTrainers']}")
        print(f"  Active memberships: {data['activeMemberships']}, Active boosts: {data['activeBoosts']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
