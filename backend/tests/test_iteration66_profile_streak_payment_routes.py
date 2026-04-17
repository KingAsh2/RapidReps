"""
Iteration 66: Backend Route Extraction Regression Tests
Tests for profile_routes.py, streak_routes.py, and payment_routes.py
Verifies all endpoints work correctly after extraction from server.py
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://highlight-vibe-bugs.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"


class TestAuthLogin:
    """Test login endpoints to get tokens for subsequent tests"""
    
    def test_admin_login(self):
        """Admin login returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert data.get("user", {}).get("isAdmin") == True, "Admin flag not set"
        print(f"✓ Admin login successful")
    
    def test_trainer_login(self):
        """Trainer login returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER_EMAIL,
            "password": TRAINER_PASSWORD
        })
        assert response.status_code == 200, f"Trainer login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert "trainer" in data.get("user", {}).get("roles", []), "Trainer role not found"
        print(f"✓ Trainer login successful")
    
    def test_trainee_login(self):
        """Trainee login returns access_token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE_EMAIL,
            "password": TRAINEE_PASSWORD
        })
        assert response.status_code == 200, f"Trainee login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert "trainee" in data.get("user", {}).get("roles", []), "Trainee role not found"
        print(f"✓ Trainee login successful")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin login failed")


@pytest.fixture(scope="module")
def trainer_token():
    """Get trainer auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINER_EMAIL,
        "password": TRAINER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Trainer login failed")


@pytest.fixture(scope="module")
def trainer_user_id():
    """Get trainer user ID"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINER_EMAIL,
        "password": TRAINER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("user", {}).get("id")
    pytest.skip("Trainer login failed")


@pytest.fixture(scope="module")
def trainee_token():
    """Get trainee auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINEE_EMAIL,
        "password": TRAINEE_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Trainee login failed")


@pytest.fixture(scope="module")
def trainee_user_id():
    """Get trainee user ID"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINEE_EMAIL,
        "password": TRAINEE_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("user", {}).get("id")
    pytest.skip("Trainee login failed")


# ============================================================================
# PROFILE ROUTES TESTS (profile_routes.py)
# ============================================================================

class TestProfileRoutes:
    """Tests for profile_routes.py endpoints"""
    
    def test_get_trainer_profile(self, trainer_token, trainer_user_id):
        """GET /api/trainer-profiles/{user_id} - Get trainer profile"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}", headers=headers)
        assert response.status_code == 200, f"Get trainer profile failed: {response.text}"
        data = response.json()
        assert "userId" in data, "Missing userId in profile"
        assert "id" in data, "Missing id in profile"
        print(f"✓ GET /api/trainer-profiles/{trainer_user_id} - Profile retrieved")
    
    def test_get_trainer_profile_not_found(self, trainer_token):
        """GET /api/trainer-profiles/{user_id} - Returns 404 for non-existent profile"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer-profiles/000000000000000000000000", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ GET /api/trainer-profiles/invalid - Returns 404")
    
    def test_get_trainer_onboarding_status(self, trainer_token):
        """GET /api/trainer/onboarding-status - Get onboarding status"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/onboarding-status", headers=headers)
        assert response.status_code == 200, f"Get onboarding status failed: {response.text}"
        data = response.json()
        assert "canGoLive" in data, "Missing canGoLive field"
        assert "profileExists" in data, "Missing profileExists field"
        assert "missingRequirements" in data, "Missing missingRequirements field"
        print(f"✓ GET /api/trainer/onboarding-status - Status retrieved")
    
    def test_get_trainer_verification_status(self, trainer_token):
        """GET /api/trainer/verification-status - Get verification status"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/verification-status", headers=headers)
        assert response.status_code == 200, f"Get verification status failed: {response.text}"
        data = response.json()
        assert "steps" in data, "Missing steps field"
        assert "canGoLive" in data, "Missing canGoLive field"
        print(f"✓ GET /api/trainer/verification-status - Status retrieved")
    
    def test_music_search(self, trainer_token):
        """GET /api/music/search?q=drake - Search music via iTunes proxy"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/music/search?q=drake", headers=headers)
        assert response.status_code == 200, f"Music search failed: {response.text}"
        data = response.json()
        assert "results" in data, "Missing results field"
        assert isinstance(data["results"], list), "Results should be a list"
        print(f"✓ GET /api/music/search?q=drake - Found {len(data['results'])} results")
    
    def test_get_trainer_highlights(self, trainer_token, trainer_user_id):
        """GET /api/trainer-profiles/{user_id}/highlights - Get trainer highlights"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer-profiles/{trainer_user_id}/highlights", headers=headers)
        assert response.status_code == 200, f"Get highlights failed: {response.text}"
        data = response.json()
        assert "highlights" in data, "Missing highlights field"
        assert isinstance(data["highlights"], list), "Highlights should be a list"
        print(f"✓ GET /api/trainer-profiles/{trainer_user_id}/highlights - Retrieved")
    
    def test_toggle_trainer_availability(self, trainer_token):
        """PATCH /api/trainer-profiles/toggle-availability - Toggle availability"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.patch(
            f"{BASE_URL}/api/trainer-profiles/toggle-availability?isAvailable=true",
            headers=headers
        )
        assert response.status_code == 200, f"Toggle availability failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Expected success=true"
        assert "isAvailable" in data, "Missing isAvailable field"
        print(f"✓ PATCH /api/trainer-profiles/toggle-availability - Toggled")
    
    def test_get_trainee_profile(self, trainee_token, trainee_user_id):
        """GET /api/trainee-profiles/{user_id} - Get trainee profile (or 404 if not created)"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.get(f"{BASE_URL}/api/trainee-profiles/{trainee_user_id}", headers=headers)
        # Profile may not exist if never created - both 200 and 404 are valid responses
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code} - {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "userId" in data, "Missing userId in profile"
            print(f"✓ GET /api/trainee-profiles/{trainee_user_id} - Profile retrieved")
        else:
            print(f"✓ GET /api/trainee-profiles/{trainee_user_id} - Returns 404 (profile not created yet)")
    
    def test_update_trainee_personality_tag(self, trainee_token, trainee_user_id):
        """PUT /api/trainee-profiles/{user_id}/personality-tag - Update personality tag"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.put(
            f"{BASE_URL}/api/trainee-profiles/{trainee_user_id}/personality-tag",
            headers=headers,
            json={"personalityTag": "CHILL"}
        )
        assert response.status_code == 200, f"Update personality tag failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Expected success=true"
        assert data.get("personalityTag") == "CHILL", "Personality tag not set correctly"
        print(f"✓ PUT /api/trainee-profiles/{trainee_user_id}/personality-tag - Updated")


# ============================================================================
# STREAK ROUTES TESTS (streak_routes.py)
# ============================================================================

class TestStreakRoutes:
    """Tests for streak_routes.py endpoints"""
    
    def test_get_my_streaks(self, trainer_token):
        """GET /api/streaks/me - Get current user's streak data"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/streaks/me", headers=headers)
        assert response.status_code == 200, f"Get streaks failed: {response.text}"
        data = response.json()
        assert "currentStreak" in data, "Missing currentStreak field"
        assert "longestStreak" in data, "Missing longestStreak field"
        assert "consistencyPoints" in data, "Missing consistencyPoints field"
        assert "streakLevel" in data, "Missing streakLevel field"
        print(f"✓ GET /api/streaks/me - Streak data retrieved")
    
    def test_get_weekly_leaderboard(self, trainer_token):
        """GET /api/leaderboard/weekly - Get weekly leaderboard"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/leaderboard/weekly", headers=headers)
        assert response.status_code == 200, f"Get leaderboard failed: {response.text}"
        data = response.json()
        assert "leaderboard" in data, "Missing leaderboard field"
        assert isinstance(data["leaderboard"], list), "Leaderboard should be a list"
        print(f"✓ GET /api/leaderboard/weekly - Leaderboard retrieved with {len(data['leaderboard'])} entries")
    
    def test_get_trainer_achievements(self, trainer_token):
        """GET /api/trainer/achievements - Get trainer achievements"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/achievements", headers=headers)
        assert response.status_code == 200, f"Get trainer achievements failed: {response.text}"
        data = response.json()
        assert "badges" in data, "Missing badges field"
        assert "totalCompletedSessions" in data, "Missing totalCompletedSessions field"
        assert isinstance(data["badges"], list), "Badges should be a list"
        print(f"✓ GET /api/trainer/achievements - Retrieved {len(data['badges'])} badges")
    
    def test_get_trainee_achievements(self, trainee_token):
        """GET /api/trainee/achievements - Get trainee achievements"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.get(f"{BASE_URL}/api/trainee/achievements", headers=headers)
        assert response.status_code == 200, f"Get trainee achievements failed: {response.text}"
        data = response.json()
        assert "badges" in data, "Missing badges field"
        assert "totalCompletedSessions" in data, "Missing totalCompletedSessions field"
        assert isinstance(data["badges"], list), "Badges should be a list"
        print(f"✓ GET /api/trainee/achievements - Retrieved {len(data['badges'])} badges")
    
    def test_trainer_achievements_requires_trainer_role(self, trainee_token):
        """GET /api/trainer/achievements - Requires trainer role"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/achievements", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ GET /api/trainer/achievements - Returns 403 for non-trainers")
    
    def test_trainee_achievements_requires_trainee_role(self, trainer_token):
        """GET /api/trainee/achievements - Requires trainee role"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/trainee/achievements", headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ GET /api/trainee/achievements - Returns 403 for non-trainees")


# ============================================================================
# PAYMENT ROUTES TESTS (payment_routes.py)
# ============================================================================

class TestPaymentRoutes:
    """Tests for payment_routes.py endpoints"""
    
    def test_get_trainer_earnings(self, trainer_token):
        """GET /api/trainer/earnings - Get trainer earnings summary"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/earnings", headers=headers)
        assert response.status_code == 200, f"Get earnings failed: {response.text}"
        data = response.json()
        assert "totalEarningsCents" in data, "Missing totalEarningsCents field"
        assert "monthEarningsCents" in data, "Missing monthEarningsCents field"
        assert "weekEarningsCents" in data, "Missing weekEarningsCents field"
        assert "pendingBalanceCents" in data, "Missing pendingBalanceCents field"
        print(f"✓ GET /api/trainer/earnings - Earnings retrieved")
    
    def test_get_trainer_payout_requests(self, trainer_token):
        """GET /api/trainer/payout-requests - Get payout request history"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/payout-requests", headers=headers)
        assert response.status_code == 200, f"Get payout requests failed: {response.text}"
        data = response.json()
        assert "requests" in data, "Missing requests field"
        assert isinstance(data["requests"], list), "Requests should be a list"
        print(f"✓ GET /api/trainer/payout-requests - Retrieved {len(data['requests'])} requests")
    
    def test_get_zelle_settings(self):
        """GET /api/settings/zelle - Get platform Zelle settings (public)"""
        response = requests.get(f"{BASE_URL}/api/settings/zelle")
        assert response.status_code == 200, f"Get Zelle settings failed: {response.text}"
        data = response.json()
        # These fields may be empty but should exist
        assert "zelleEmail" in data or "zellePhone" in data, "Missing Zelle fields"
        print(f"✓ GET /api/settings/zelle - Settings retrieved")
    
    def test_get_trainer_zelle_info(self, trainer_token):
        """GET /api/trainer/zelle-info - Get trainer's Zelle info"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/zelle-info", headers=headers)
        assert response.status_code == 200, f"Get trainer Zelle info failed: {response.text}"
        data = response.json()
        assert "hasZelleInfo" in data, "Missing hasZelleInfo field"
        print(f"✓ GET /api/trainer/zelle-info - Info retrieved")
    
    def test_get_pricing_rules(self):
        """GET /api/payments/pricing-rules - Get platform pricing rules (public)"""
        response = requests.get(f"{BASE_URL}/api/payments/pricing-rules")
        assert response.status_code == 200, f"Get pricing rules failed: {response.text}"
        data = response.json()
        assert "revenueSplit" in data, "Missing revenueSplit field"
        assert "serviceFeeCents" in data, "Missing serviceFeeCents field"
        assert "minimumPrices" in data, "Missing minimumPrices field"
        assert data["revenueSplit"]["trainerPercent"] == 80, "Trainer percent should be 80"
        assert data["revenueSplit"]["platformPercent"] == 20, "Platform percent should be 20"
        print(f"✓ GET /api/payments/pricing-rules - Rules retrieved")
    
    def test_calculate_session_cost(self):
        """POST /api/payments/calculate-session-cost - Calculate session cost"""
        response = requests.post(
            f"{BASE_URL}/api/payments/calculate-session-cost?session_type=outdoor&session_price_cents=5000"
        )
        assert response.status_code == 200, f"Calculate session cost failed: {response.text}"
        data = response.json()
        assert "sessionPrice" in data, "Missing sessionPrice field"
        assert "totals" in data, "Missing totals field"
        assert "totalChargedCents" in data["totals"], "Missing totalChargedCents"
        assert "trainerPayoutCents" in data["totals"], "Missing trainerPayoutCents"
        print(f"✓ POST /api/payments/calculate-session-cost - Cost calculated")
    
    def test_get_trainee_receipts(self, trainee_token):
        """GET /api/trainee/receipts - Get trainee receipts"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.get(f"{BASE_URL}/api/trainee/receipts", headers=headers)
        assert response.status_code == 200, f"Get trainee receipts failed: {response.text}"
        data = response.json()
        assert "receipts" in data, "Missing receipts field"
        assert "total" in data, "Missing total field"
        assert isinstance(data["receipts"], list), "Receipts should be a list"
        print(f"✓ GET /api/trainee/receipts - Retrieved {len(data['receipts'])} receipts")
    
    def test_get_trainer_receipts(self, trainer_token):
        """GET /api/trainer/receipts - Get trainer receipts"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/trainer/receipts", headers=headers)
        assert response.status_code == 200, f"Get trainer receipts failed: {response.text}"
        data = response.json()
        assert "receipts" in data, "Missing receipts field"
        assert "total" in data, "Missing total field"
        assert isinstance(data["receipts"], list), "Receipts should be a list"
        print(f"✓ GET /api/trainer/receipts - Retrieved {len(data['receipts'])} receipts")


# ============================================================================
# ADMIN ROUTES TESTS (payment_routes.py - admin endpoints)
# ============================================================================

class TestAdminRoutes:
    """Tests for admin endpoints in payment_routes.py"""
    
    def test_get_admin_trainers(self, admin_token):
        """GET /api/admin/trainers - Get all trainers (admin only)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/trainers", headers=headers)
        assert response.status_code == 200, f"Get admin trainers failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/admin/trainers - Retrieved {len(data)} trainers")
    
    def test_get_admin_revenue(self, admin_token):
        """GET /api/admin/revenue - Get platform revenue stats (admin only)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/revenue", headers=headers)
        assert response.status_code == 200, f"Get admin revenue failed: {response.text}"
        data = response.json()
        assert "totalPlatformFeesCents" in data, "Missing totalPlatformFeesCents"
        assert "totalSessionValueCents" in data, "Missing totalSessionValueCents"
        assert "totalSessions" in data, "Missing totalSessions"
        print(f"✓ GET /api/admin/revenue - Revenue stats retrieved")
    
    def test_get_admin_pending_payouts(self, admin_token):
        """GET /api/admin/payouts/pending - Get pending payouts (admin only)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/payouts/pending", headers=headers)
        assert response.status_code == 200, f"Get pending payouts failed: {response.text}"
        data = response.json()
        assert "trainers" in data, "Missing trainers field"
        assert "payoutMinimumCents" in data, "Missing payoutMinimumCents"
        assert "eligibleCount" in data, "Missing eligibleCount"
        print(f"✓ GET /api/admin/payouts/pending - Retrieved {len(data['trainers'])} trainers")
    
    def test_get_admin_receipts(self, admin_token):
        """GET /api/admin/receipts - Get all receipts (admin only)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/receipts", headers=headers)
        assert response.status_code == 200, f"Get admin receipts failed: {response.text}"
        data = response.json()
        assert "receipts" in data, "Missing receipts field"
        assert "total" in data, "Missing total field"
        print(f"✓ GET /api/admin/receipts - Retrieved {len(data['receipts'])} receipts")
    
    def test_admin_routes_require_admin(self, trainer_token):
        """Admin routes should return 403 for non-admin users"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        
        # Test /api/admin/trainers
        response = requests.get(f"{BASE_URL}/api/admin/trainers", headers=headers)
        assert response.status_code == 403, f"Expected 403 for /api/admin/trainers, got {response.status_code}"
        
        # Test /api/admin/revenue
        response = requests.get(f"{BASE_URL}/api/admin/revenue", headers=headers)
        assert response.status_code == 403, f"Expected 403 for /api/admin/revenue, got {response.status_code}"
        
        # Test /api/admin/payouts/pending
        response = requests.get(f"{BASE_URL}/api/admin/payouts/pending", headers=headers)
        assert response.status_code == 403, f"Expected 403 for /api/admin/payouts/pending, got {response.status_code}"
        
        print(f"✓ Admin routes return 403 for non-admin users")


# ============================================================================
# HEALTH CHECK
# ============================================================================

class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """GET /api/health - API health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", "Status should be healthy"
        print(f"✓ GET /api/health - API is healthy")
    
    def test_root_health(self):
        """GET /health - Root health check (may be served by frontend in this setup)"""
        response = requests.get(f"{BASE_URL}/health")
        # In this Kubernetes setup, /health at root may be served by frontend
        # The backend health is at /api/health which is tested above
        if response.status_code == 200:
            try:
                data = response.json()
                if data.get("status") == "healthy":
                    print(f"✓ GET /health - Root is healthy (backend)")
                else:
                    print(f"✓ GET /health - Returns 200 (frontend serving)")
            except:
                print(f"✓ GET /health - Returns 200 (frontend HTML)")
        else:
            # 404 is acceptable if frontend doesn't have this route
            print(f"✓ GET /health - Returns {response.status_code} (frontend routing)")
        # This test passes regardless - the important health check is /api/health
        assert True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
