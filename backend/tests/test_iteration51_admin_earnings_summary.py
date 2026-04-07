"""
Iteration 51: Admin Earnings Summary Endpoint Tests
Tests the NEW /api/admin/earnings-summary endpoint and verifies /api/trainer/earnings still works.

Features tested:
1. GET /api/admin/earnings-summary returns correct revenue data with breakdowns
2. GET /api/admin/earnings-summary requires admin authentication (non-admin gets 403)
3. Response includes totalRevenueCents, platformRevenueCents, trainerPayoutsCents
4. Response includes weekRevenueCents, lastWeekRevenueCents, monthRevenueCents, lastMonthRevenueCents
5. Response includes dailyBreakdown array with 7 days (Mon-Sun)
6. Response includes weeklyBreakdown array with weeks
7. Response includes monthlyBreakdown array with 6 months
8. Platform cut is correctly 20% of total revenue
9. Trainer earnings endpoint GET /api/trainer/earnings still works correctly
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def trainer_token(api_client):
    """Get trainer authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINER_EMAIL,
        "password": TRAINER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Trainer authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def trainee_token(api_client):
    """Get trainee authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TRAINEE_EMAIL,
        "password": TRAINEE_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Trainee authentication failed: {response.status_code} - {response.text}")


class TestAdminEarningsSummaryAuthentication:
    """Test authentication requirements for admin earnings-summary endpoint"""

    def test_admin_earnings_summary_requires_auth(self, api_client):
        """Test that endpoint returns 403 without authentication"""
        response = api_client.get(f"{BASE_URL}/api/admin/earnings-summary")
        assert response.status_code == 403, f"Expected 403 without auth, got {response.status_code}"
        print("PASS: Admin earnings-summary requires authentication (403 without token)")

    def test_admin_earnings_summary_rejects_trainee(self, api_client, trainee_token):
        """Test that non-admin (trainee) gets 403"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for trainee, got {response.status_code}"
        print("PASS: Admin earnings-summary rejects trainee (403)")

    def test_admin_earnings_summary_rejects_trainer(self, api_client, trainer_token):
        """Test that non-admin (trainer) gets 403"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for trainer, got {response.status_code}"
        print("PASS: Admin earnings-summary rejects trainer (403)")


class TestAdminEarningsSummaryResponse:
    """Test admin earnings-summary endpoint response structure and data"""

    def test_admin_earnings_summary_success(self, api_client, admin_token):
        """Test that admin can access earnings-summary endpoint"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Admin can access earnings-summary endpoint (200)")

    def test_response_includes_total_revenue_fields(self, api_client, admin_token):
        """Test response includes totalRevenueCents, platformRevenueCents, trainerPayoutsCents"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields exist
        assert "totalRevenueCents" in data, "Missing totalRevenueCents"
        assert "platformRevenueCents" in data, "Missing platformRevenueCents"
        assert "trainerPayoutsCents" in data, "Missing trainerPayoutsCents"
        
        # Verify they are integers
        assert isinstance(data["totalRevenueCents"], int), "totalRevenueCents should be int"
        assert isinstance(data["platformRevenueCents"], int), "platformRevenueCents should be int"
        assert isinstance(data["trainerPayoutsCents"], int), "trainerPayoutsCents should be int"
        
        print(f"PASS: Response includes total revenue fields - total: {data['totalRevenueCents']}, platform: {data['platformRevenueCents']}, trainer: {data['trainerPayoutsCents']}")

    def test_response_includes_period_revenue_fields(self, api_client, admin_token):
        """Test response includes weekRevenueCents, lastWeekRevenueCents, monthRevenueCents, lastMonthRevenueCents"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required period fields exist
        assert "weekRevenueCents" in data, "Missing weekRevenueCents"
        assert "lastWeekRevenueCents" in data, "Missing lastWeekRevenueCents"
        assert "monthRevenueCents" in data, "Missing monthRevenueCents"
        assert "lastMonthRevenueCents" in data, "Missing lastMonthRevenueCents"
        
        # Verify they are integers
        assert isinstance(data["weekRevenueCents"], int), "weekRevenueCents should be int"
        assert isinstance(data["lastWeekRevenueCents"], int), "lastWeekRevenueCents should be int"
        assert isinstance(data["monthRevenueCents"], int), "monthRevenueCents should be int"
        assert isinstance(data["lastMonthRevenueCents"], int), "lastMonthRevenueCents should be int"
        
        print(f"PASS: Response includes period revenue fields - week: {data['weekRevenueCents']}, lastWeek: {data['lastWeekRevenueCents']}, month: {data['monthRevenueCents']}, lastMonth: {data['lastMonthRevenueCents']}")

    def test_response_includes_daily_breakdown(self, api_client, admin_token):
        """Test response includes dailyBreakdown array with 7 days (Mon-Sun)"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check dailyBreakdown exists and is a list
        assert "dailyBreakdown" in data, "Missing dailyBreakdown"
        assert isinstance(data["dailyBreakdown"], list), "dailyBreakdown should be a list"
        assert len(data["dailyBreakdown"]) == 7, f"dailyBreakdown should have 7 days, got {len(data['dailyBreakdown'])}"
        
        # Check each day has required fields
        expected_days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        for i, day_data in enumerate(data["dailyBreakdown"]):
            assert "day" in day_data, f"Day {i} missing 'day' field"
            assert "date" in day_data, f"Day {i} missing 'date' field"
            assert "revenueCents" in day_data, f"Day {i} missing 'revenueCents' field"
            assert "sessions" in day_data, f"Day {i} missing 'sessions' field"
            assert "platformCents" in day_data, f"Day {i} missing 'platformCents' field"
            assert day_data["day"] == expected_days[i], f"Expected day {expected_days[i]}, got {day_data['day']}"
        
        print(f"PASS: dailyBreakdown has 7 days (Mon-Sun) with correct structure")

    def test_response_includes_weekly_breakdown(self, api_client, admin_token):
        """Test response includes weeklyBreakdown array with weeks"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check weeklyBreakdown exists and is a list
        assert "weeklyBreakdown" in data, "Missing weeklyBreakdown"
        assert isinstance(data["weeklyBreakdown"], list), "weeklyBreakdown should be a list"
        
        # Check each week has required fields
        for i, week_data in enumerate(data["weeklyBreakdown"]):
            assert "week" in week_data, f"Week {i} missing 'week' field"
            assert "startDate" in week_data, f"Week {i} missing 'startDate' field"
            assert "revenueCents" in week_data, f"Week {i} missing 'revenueCents' field"
            assert "sessions" in week_data, f"Week {i} missing 'sessions' field"
            assert "platformCents" in week_data, f"Week {i} missing 'platformCents' field"
        
        print(f"PASS: weeklyBreakdown has {len(data['weeklyBreakdown'])} weeks with correct structure")

    def test_response_includes_monthly_breakdown(self, api_client, admin_token):
        """Test response includes monthlyBreakdown array with 6 months"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check monthlyBreakdown exists and is a list
        assert "monthlyBreakdown" in data, "Missing monthlyBreakdown"
        assert isinstance(data["monthlyBreakdown"], list), "monthlyBreakdown should be a list"
        assert len(data["monthlyBreakdown"]) == 6, f"monthlyBreakdown should have 6 months, got {len(data['monthlyBreakdown'])}"
        
        # Check each month has required fields
        for i, month_data in enumerate(data["monthlyBreakdown"]):
            assert "month" in month_data, f"Month {i} missing 'month' field"
            assert "year" in month_data, f"Month {i} missing 'year' field"
            assert "revenueCents" in month_data, f"Month {i} missing 'revenueCents' field"
            assert "sessions" in month_data, f"Month {i} missing 'sessions' field"
            assert "platformCents" in month_data, f"Month {i} missing 'platformCents' field"
        
        print(f"PASS: monthlyBreakdown has 6 months with correct structure")

    def test_platform_cut_is_20_percent(self, api_client, admin_token):
        """Test that platform cut is correctly 20% of total revenue"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        total_revenue = data["totalRevenueCents"]
        platform_revenue = data["platformRevenueCents"]
        trainer_payouts = data["trainerPayoutsCents"]
        
        # Platform should be 20% of total
        expected_platform = int(total_revenue * 0.20)
        assert platform_revenue == expected_platform, f"Platform cut should be 20% ({expected_platform}), got {platform_revenue}"
        
        # Trainer should be 80% (total - platform)
        expected_trainer = total_revenue - platform_revenue
        assert trainer_payouts == expected_trainer, f"Trainer payouts should be {expected_trainer}, got {trainer_payouts}"
        
        # Verify 80/20 split
        if total_revenue > 0:
            platform_percent = (platform_revenue / total_revenue) * 100
            trainer_percent = (trainer_payouts / total_revenue) * 100
            assert abs(platform_percent - 20) < 0.1, f"Platform should be ~20%, got {platform_percent:.2f}%"
            assert abs(trainer_percent - 80) < 0.1, f"Trainer should be ~80%, got {trainer_percent:.2f}%"
        
        print(f"PASS: Platform cut is correctly 20% - total: ${total_revenue/100:.2f}, platform: ${platform_revenue/100:.2f} (20%), trainer: ${trainer_payouts/100:.2f} (80%)")


class TestTrainerEarningsStillWorks:
    """Verify that trainer earnings endpoint still works correctly"""

    def test_trainer_earnings_requires_auth(self, api_client):
        """Test that trainer earnings requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/trainer/earnings")
        assert response.status_code == 403, f"Expected 403 without auth, got {response.status_code}"
        print("PASS: Trainer earnings requires authentication (403 without token)")

    def test_trainer_earnings_success(self, api_client, trainer_token):
        """Test that trainer can access their earnings"""
        response = api_client.get(
            f"{BASE_URL}/api/trainer/earnings",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Trainer can access earnings endpoint (200)")

    def test_trainer_earnings_response_structure(self, api_client, trainer_token):
        """Test trainer earnings response has expected structure"""
        response = api_client.get(
            f"{BASE_URL}/api/trainer/earnings",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        required_fields = [
            "totalEarningsCents",
            "monthEarningsCents",
            "lastMonthEarningsCents",
            "weekEarningsCents",
            "lastWeekEarningsCents",
            "totalSessions",
            "monthSessions",
            "weekSessions",
            "pendingBalanceCents",
            "totalPaidOutCents",
            "dailyBreakdown",
            "weeklyBreakdown",
            "recentSessions",
            "payouts",
            "payoutRequests"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify dailyBreakdown structure
        assert isinstance(data["dailyBreakdown"], list), "dailyBreakdown should be a list"
        assert len(data["dailyBreakdown"]) == 7, f"dailyBreakdown should have 7 days, got {len(data['dailyBreakdown'])}"
        
        for day_data in data["dailyBreakdown"]:
            assert "day" in day_data, "Day missing 'day' field"
            assert "date" in day_data, "Day missing 'date' field"
            assert "earningsCents" in day_data, "Day missing 'earningsCents' field"
            assert "sessions" in day_data, "Day missing 'sessions' field"
        
        print(f"PASS: Trainer earnings response has correct structure with all required fields")
        print(f"  - Total earnings: ${data['totalEarningsCents']/100:.2f}")
        print(f"  - Week earnings: ${data['weekEarningsCents']/100:.2f}")
        print(f"  - Month earnings: ${data['monthEarningsCents']/100:.2f}")
        print(f"  - Total sessions: {data['totalSessions']}")


class TestAdminEarningsSummaryDataIntegrity:
    """Test data integrity and calculations in admin earnings summary"""

    def test_daily_breakdown_platformcents_is_20_percent(self, api_client, admin_token):
        """Test that platformCents in daily breakdown is 20% of revenueCents"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        for day_data in data["dailyBreakdown"]:
            revenue = day_data["revenueCents"]
            platform = day_data["platformCents"]
            expected_platform = int(revenue * 0.20)
            assert platform == expected_platform, f"Day {day_data['day']}: platformCents should be {expected_platform}, got {platform}"
        
        print("PASS: All daily breakdown platformCents are correctly 20% of revenueCents")

    def test_weekly_breakdown_platformcents_is_20_percent(self, api_client, admin_token):
        """Test that platformCents in weekly breakdown is 20% of revenueCents"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        for week_data in data["weeklyBreakdown"]:
            revenue = week_data["revenueCents"]
            platform = week_data["platformCents"]
            expected_platform = int(revenue * 0.20)
            assert platform == expected_platform, f"Week {week_data['week']}: platformCents should be {expected_platform}, got {platform}"
        
        print("PASS: All weekly breakdown platformCents are correctly 20% of revenueCents")

    def test_monthly_breakdown_platformcents_is_20_percent(self, api_client, admin_token):
        """Test that platformCents in monthly breakdown is 20% of revenueCents"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/earnings-summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        for month_data in data["monthlyBreakdown"]:
            revenue = month_data["revenueCents"]
            platform = month_data["platformCents"]
            expected_platform = int(revenue * 0.20)
            assert platform == expected_platform, f"Month {month_data['month']}: platformCents should be {expected_platform}, got {platform}"
        
        print("PASS: All monthly breakdown platformCents are correctly 20% of revenueCents")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
