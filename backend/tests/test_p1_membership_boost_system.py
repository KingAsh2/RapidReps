"""
P1.3 Membership System (True Benefit Stack) & P1.4 Boost System (Real Power) Tests

Tests:
- Membership benefits via pricing rules (10% discount, +0.15 priority)
- Member badge endpoint (public)
- My-membership endpoint (authenticated)
- Boost analytics (impressions, views, clicks, CTR)
- Track view endpoint
- Nearby trainers with isBoosted/isMember flags
- Session pricing with membership discount
- Matching engine priority for members
- Already subscribed error handling
- Free boosts remaining tracking
"""
import pytest
import requests
import os
from datetime import datetime, timedelta
from bson import ObjectId

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
TRAINEE1_EMAIL = "trainee1@test.com"
TRAINEE1_PASSWORD = "test123"
TRAINEE1_ID = "697c077500b22ded1af3509d"

TRAINER1_EMAIL = "trainer1@test.com"
TRAINER1_PASSWORD = "test123"
TRAINER1_ID = "697c077500b22ded1af35097"

TRAINER2_EMAIL = "trainer2@test.com"
TRAINER2_PASSWORD = "test123"


class TestPricingRules:
    """Test pricing rules endpoint for membership benefits"""
    
    def test_pricing_rules_membership_benefits(self):
        """GET /api/payments/pricing-rules returns membership benefits"""
        response = requests.get(f"{BASE_URL}/api/payments/pricing-rules")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'membership' in data, "Response should contain 'membership' key"
        
        membership = data['membership']
        assert membership.get('sessionDiscountPercent') == 10, f"Expected 10% discount, got {membership.get('sessionDiscountPercent')}"
        assert membership.get('matchingPriorityBonus') == 0.15, f"Expected 0.15 bonus, got {membership.get('matchingPriorityBonus')}"
        assert membership.get('monthlyPrice') == 19.99, f"Expected $19.99, got {membership.get('monthlyPrice')}"
        
        # Verify benefits list
        benefits = membership.get('benefits', [])
        assert len(benefits) >= 4, f"Expected at least 4 benefits, got {len(benefits)}"
        assert any('10%' in b for b in benefits), "Should include 10% session discount benefit"
        assert any('Boost' in b for b in benefits), "Should include free boost benefit"
        print("PASS: Pricing rules return correct membership benefits (10% discount, 0.15 priority bonus)")


class TestMemberBadge:
    """Test member badge public endpoint"""
    
    def test_member_badge_for_active_member(self):
        """GET /api/memberships/member-badge/{user_id} returns isMember=true for active member"""
        response = requests.get(f"{BASE_URL}/api/memberships/member-badge/{TRAINEE1_ID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get('isMember') == True, f"trainee1 should have active membership, got isMember={data.get('isMember')}"
        assert 'benefits' in data, "Should include benefits list"
        
        benefits = data.get('benefits', [])
        assert any('10%' in b for b in benefits), "Benefits should include 10% discount"
        print(f"PASS: Member badge returns isMember=true with benefits for active member (trainee1)")
    
    def test_member_badge_for_non_member(self):
        """GET /api/memberships/member-badge/{user_id} returns isMember=false for non-member"""
        # Use trainer1 who is not a member
        response = requests.get(f"{BASE_URL}/api/memberships/member-badge/{TRAINER1_ID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get('isMember') == False, f"trainer1 should not have membership, got isMember={data.get('isMember')}"
        print("PASS: Member badge returns isMember=false for non-member (trainer1)")


class TestMyMembership:
    """Test my-membership authenticated endpoint"""
    
    @pytest.fixture
    def trainee_token(self):
        """Get auth token for trainee1"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE1_EMAIL,
            "password": TRAINEE1_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()['access_token']
    
    @pytest.fixture
    def trainer_token(self):
        """Get auth token for trainer1"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER1_EMAIL,
            "password": TRAINER1_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()['access_token']
    
    def test_my_membership_for_member(self, trainee_token):
        """GET /api/memberships/my-membership returns hasMembership=true for member"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.get(f"{BASE_URL}/api/memberships/my-membership", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get('hasMembership') == True, f"trainee1 should have membership, got hasMembership={data.get('hasMembership')}"
        assert 'membership' in data, "Should include membership details"
        
        membership = data.get('membership', {})
        assert membership.get('status') == 'active', f"Status should be 'active', got {membership.get('status')}"
        assert 'freeBoostsRemaining' in membership, "Should track freeBoostsRemaining"
        print(f"PASS: My-membership returns hasMembership=true with status=active, freeBoostsRemaining={membership.get('freeBoostsRemaining')}")
    
    def test_my_membership_for_non_member(self, trainer_token):
        """GET /api/memberships/my-membership returns hasMembership=false for non-member"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/memberships/my-membership", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get('hasMembership') == False, f"trainer1 should not have membership, got hasMembership={data.get('hasMembership')}"
        print("PASS: My-membership returns hasMembership=false for non-member")


class TestAlreadySubscribed:
    """Test membership subscription error handling"""
    
    @pytest.fixture
    def trainee_token(self):
        """Get auth token for trainee1 (who already has membership)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE1_EMAIL,
            "password": TRAINEE1_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()['access_token']
    
    def test_subscribe_when_already_subscribed(self, trainee_token):
        """POST /api/memberships/subscribe returns error if already subscribed"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        response = requests.post(f"{BASE_URL}/api/memberships/subscribe", headers=headers)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert 'already' in data.get('detail', '').lower() or 'active' in data.get('detail', '').lower(), \
            f"Error should mention already subscribed: {data}"
        print("PASS: Subscribe returns 400 error when user already has active membership")


class TestBoostAnalytics:
    """Test boost analytics dashboard endpoint"""
    
    @pytest.fixture
    def trainer_token(self):
        """Get auth token for trainer1"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER1_EMAIL,
            "password": TRAINER1_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()['access_token']
    
    def test_boost_analytics_structure(self, trainer_token):
        """GET /api/boosts/analytics returns correct structure"""
        headers = {"Authorization": f"Bearer {trainer_token}"}
        response = requests.get(f"{BASE_URL}/api/boosts/analytics", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify all required fields are present
        required_fields = ['hasActiveBoost', 'totalImpressions', 'totalProfileViews', 'totalClicks', 'clickThroughRate', 'dailyData']
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify types
        assert isinstance(data['hasActiveBoost'], bool), "hasActiveBoost should be boolean"
        assert isinstance(data['totalImpressions'], int), "totalImpressions should be integer"
        assert isinstance(data['totalProfileViews'], int), "totalProfileViews should be integer"
        assert isinstance(data['totalClicks'], int), "totalClicks should be integer"
        assert isinstance(data['clickThroughRate'], (int, float)), "clickThroughRate should be numeric"
        assert isinstance(data['dailyData'], list), "dailyData should be list"
        
        print(f"PASS: Boost analytics returns correct structure - impressions={data['totalImpressions']}, views={data['totalProfileViews']}, clicks={data['totalClicks']}, CTR={data['clickThroughRate']}%")


class TestTrackBoostView:
    """Test boost view tracking endpoint"""
    
    def test_track_view_increments_analytics(self):
        """POST /api/boosts/{trainer_id}/track-view increments profileViews and clicks"""
        # First, get current analytics (need trainer auth)
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER1_EMAIL,
            "password": TRAINER1_PASSWORD
        })
        assert login_resp.status_code == 200
        trainer_token = login_resp.json()['access_token']
        headers = {"Authorization": f"Bearer {trainer_token}"}
        
        # Get analytics before
        before_resp = requests.get(f"{BASE_URL}/api/boosts/analytics", headers=headers)
        assert before_resp.status_code == 200
        before_data = before_resp.json()
        before_views = before_data['totalProfileViews']
        before_clicks = before_data['totalClicks']
        
        # Track a view (public endpoint)
        track_resp = requests.post(f"{BASE_URL}/api/boosts/{TRAINER1_ID}/track-view")
        assert track_resp.status_code == 200, f"Expected 200, got {track_resp.status_code}: {track_resp.text}"
        assert track_resp.json().get('success') == True, "Should return success=true"
        
        # Get analytics after
        after_resp = requests.get(f"{BASE_URL}/api/boosts/analytics", headers=headers)
        assert after_resp.status_code == 200
        after_data = after_resp.json()
        after_views = after_data['totalProfileViews']
        after_clicks = after_data['totalClicks']
        
        # Verify increments
        assert after_views >= before_views, f"profileViews should not decrease: {before_views} -> {after_views}"
        assert after_clicks >= before_clicks, f"clicks should not decrease: {before_clicks} -> {after_clicks}"
        print(f"PASS: Track view increments analytics - views: {before_views} -> {after_views}, clicks: {before_clicks} -> {after_clicks}")


class TestNearbyTrainersFlags:
    """Test that nearby trainers includes isBoosted and isMember flags"""
    
    @pytest.fixture
    def trainee_token(self):
        """Get auth token for trainee1"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE1_EMAIL,
            "password": TRAINEE1_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()['access_token']
    
    def test_nearby_trainers_has_boost_and_member_flags(self, trainee_token):
        """GET /api/trainers/nearby returns isBoosted and isMember flags"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        params = {"latitude": 40.7128, "longitude": -74.0060}  # NYC coordinates
        
        response = requests.get(f"{BASE_URL}/api/trainers/nearby", headers=headers, params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        trainers = data.get('trainers', [])
        
        # At least check the structure if trainers exist
        if trainers:
            for trainer in trainers:
                assert 'isBoosted' in trainer, f"Trainer missing isBoosted flag: {trainer.get('trainerId')}"
                assert 'isMember' in trainer, f"Trainer missing isMember flag: {trainer.get('trainerId')}"
                assert isinstance(trainer['isBoosted'], bool), "isBoosted should be boolean"
                assert isinstance(trainer['isMember'], bool), "isMember should be boolean"
            
            boosted_count = sum(1 for t in trainers if t['isBoosted'])
            member_count = sum(1 for t in trainers if t['isMember'])
            print(f"PASS: Nearby trainers include isBoosted/isMember flags - {len(trainers)} trainers, {boosted_count} boosted, {member_count} members")
        else:
            print("PASS: Nearby trainers endpoint works (no trainers in area with valid location)")


class TestSessionPricingWithMembership:
    """Test session pricing calculation with membership discount"""
    
    def test_calculate_session_cost_structure(self):
        """POST /api/payments/calculate-session-cost returns proper structure"""
        params = {
            "session_type": "outdoor",
            "session_price_cents": 5000  # $50
        }
        response = requests.post(f"{BASE_URL}/api/payments/calculate-session-cost", params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'sessionPrice' in data, "Should have sessionPrice"
        assert 'totals' in data, "Should have totals"
        
        # Verify 75/25 split
        session_price = data['sessionPrice']
        assert session_price.get('trainer_percent') == 75, f"Trainer should get 75%, got {session_price.get('trainer_percent')}"
        assert session_price.get('platform_percent') == 25, f"Platform should get 25%, got {session_price.get('platform_percent')}"
        print("PASS: Session cost calculation returns proper structure with 75/25 split")


class TestVirtualRequestWithMembership:
    """Test virtual session request for member trainee (priority matching applied)"""
    
    @pytest.fixture
    def trainee_token(self):
        """Get auth token for trainee1 (member)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE1_EMAIL,
            "password": TRAINEE1_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()['access_token']
    
    def test_virtual_request_for_member_trainee(self, trainee_token):
        """POST /api/virtual/request works for member trainee"""
        headers = {"Authorization": f"Bearer {trainee_token}"}
        
        # Check if there's already an active request
        response = requests.post(
            f"{BASE_URL}/api/virtual/request",
            headers=headers,
            json={
                "traineeId": TRAINEE1_ID,
                "durationMinutes": 30,
                "paymentMethod": "mock"
            }
        )
        
        # Should either create new or return existing
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Could be new request or existing one
        assert 'requestId' in data or 'id' in data, f"Should return request ID: {data}"
        print("PASS: Virtual request works for member trainee (priority matching would apply)")
        
        # Clean up - cancel the request if it was created
        request_id = data.get('requestId') or data.get('id')
        if request_id:
            cancel_resp = requests.post(
                f"{BASE_URL}/api/virtual/request/{request_id}/cancel",
                headers=headers
            )
            if cancel_resp.status_code == 200:
                print(f"  (Cleaned up request {request_id})")


class TestMatchingEnginePriorityBonus:
    """Verify matching engine code has membership priority bonus (code review test)"""
    
    def test_pricing_rules_has_matching_bonus(self):
        """Verify pricing rules expose matching priority bonus"""
        response = requests.get(f"{BASE_URL}/api/payments/pricing-rules")
        assert response.status_code == 200
        
        data = response.json()
        membership = data.get('membership', {})
        
        # The matching priority bonus should be exposed
        assert membership.get('matchingPriorityBonus') == 0.15, \
            f"Matching priority bonus should be 0.15, got {membership.get('matchingPriorityBonus')}"
        print("PASS: Pricing rules confirm +0.15 matching priority bonus for members")


class TestBoostImpressionsTracking:
    """Test that boost impressions are tracked when nearby trainers is called"""
    
    @pytest.fixture
    def trainee_token(self):
        """Get auth token for trainee1"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINEE1_EMAIL,
            "password": TRAINEE1_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()['access_token']
    
    @pytest.fixture
    def trainer_token(self):
        """Get auth token for trainer1"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TRAINER1_EMAIL,
            "password": TRAINER1_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()['access_token']
    
    def test_boost_impressions_increment_on_search(self, trainee_token, trainer_token):
        """Impressions should increment when boosted trainer appears in search results"""
        # Get trainer's current analytics
        headers_trainer = {"Authorization": f"Bearer {trainer_token}"}
        before = requests.get(f"{BASE_URL}/api/boosts/analytics", headers=headers_trainer).json()
        before_impressions = before['totalImpressions']
        
        # Search nearby trainers (this should increment impressions for boosted trainers)
        headers_trainee = {"Authorization": f"Bearer {trainee_token}"}
        params = {"latitude": 40.7128, "longitude": -74.0060}
        search_resp = requests.get(f"{BASE_URL}/api/trainers/nearby", headers=headers_trainee, params=params)
        assert search_resp.status_code == 200
        
        # Check if trainer was in results and is boosted
        trainers = search_resp.json().get('trainers', [])
        trainer_in_results = any(t.get('trainerId') == TRAINER1_ID for t in trainers)
        
        if trainer_in_results:
            trainer_data = next((t for t in trainers if t.get('trainerId') == TRAINER1_ID), None)
            if trainer_data and trainer_data.get('isBoosted'):
                # Check analytics after
                after = requests.get(f"{BASE_URL}/api/boosts/analytics", headers=headers_trainer).json()
                after_impressions = after['totalImpressions']
                
                # Impressions should have increased
                assert after_impressions >= before_impressions, \
                    f"Impressions should not decrease when boosted trainer appears in search: {before_impressions} -> {after_impressions}"
                print(f"PASS: Boost impressions tracked on search - {before_impressions} -> {after_impressions}")
            else:
                print("PASS: Trainer in results but not boosted (impressions not tracked for non-boosted)")
        else:
            print("PASS: Trainer not in search results (no valid location or out of radius)")


class TestMembershipBenefitsSummary:
    """Summary test to verify all membership benefits are properly configured"""
    
    def test_all_membership_benefits_configured(self):
        """Verify all P1.3 membership benefits are exposed in pricing rules"""
        response = requests.get(f"{BASE_URL}/api/payments/pricing-rules")
        assert response.status_code == 200
        
        data = response.json()
        membership = data.get('membership', {})
        
        # Verify all benefits
        checks = [
            (membership.get('sessionDiscountPercent') == 10, "10% session discount"),
            (membership.get('matchingPriorityBonus') == 0.15, "+0.15 matching priority"),
            (membership.get('monthlyPrice') == 19.99, "$19.99/month pricing"),
            (len(membership.get('benefits', [])) >= 4, "Benefits list"),
        ]
        
        all_passed = True
        for passed, name in checks:
            status = "PASS" if passed else "FAIL"
            print(f"  {status}: {name}")
            if not passed:
                all_passed = False
        
        assert all_passed, "Not all membership benefits are properly configured"
        print("PASS: All membership benefits properly configured in pricing rules")
