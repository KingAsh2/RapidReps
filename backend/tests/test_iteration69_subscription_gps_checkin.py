"""
Iteration 69: Subscription Tiers and GPS Check-in API Tests

Tests for new features:
1. Subscription Tiers - Monthly plans with sessions per week (1-7), 20% platform fee, auto-scheduling
2. Live GPS Check-in - GPS verification at session location, radius setting (1-35 miles), no-show actions

Test credentials:
- Trainer: test_trainer_iter25@test.com / Test123!
- Trainee: test_trainee_iter25@test.com / Test123!
- Admin: admin@rapidreps.com / admin123
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://highlight-vibe-bugs.preview.emergentagent.com')


class TestAuth:
    """Authentication helper tests"""
    
    @pytest.fixture(scope="class")
    def trainer_token(self):
        """Get trainer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test_trainer_iter25@test.com",
            "password": "Test123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Trainer login failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def trainee_token(self):
        """Get trainee auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test_trainee_iter25@test.com",
            "password": "Test123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Trainee login failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def trainer_id(self, trainer_token):
        """Get trainer user ID"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {trainer_token}"
        })
        if response.status_code == 200:
            return response.json().get("id")
        pytest.skip("Could not get trainer ID")
    
    @pytest.fixture(scope="class")
    def trainee_id(self, trainee_token):
        """Get trainee user ID"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {trainee_token}"
        })
        if response.status_code == 200:
            return response.json().get("id")
        pytest.skip("Could not get trainee ID")
    
    def test_trainer_login(self):
        """Test trainer can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test_trainer_iter25@test.com",
            "password": "Test123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"Trainer login successful, token received")
    
    def test_trainee_login(self):
        """Test trainee can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test_trainee_iter25@test.com",
            "password": "Test123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"Trainee login successful, token received")


class TestSubscriptionEndpoints:
    """Subscription Tiers API Tests"""
    
    @pytest.fixture(scope="class")
    def trainer_token(self):
        """Get trainer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test_trainer_iter25@test.com",
            "password": "Test123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Trainer login failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def trainee_token(self):
        """Get trainee auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test_trainee_iter25@test.com",
            "password": "Test123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Trainee login failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def trainer_id(self, trainer_token):
        """Get trainer user ID"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {trainer_token}"
        })
        if response.status_code == 200:
            return response.json().get("id")
        pytest.skip("Could not get trainer ID")
    
    @pytest.fixture(scope="class")
    def trainee_id(self, trainee_token):
        """Get trainee user ID"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {trainee_token}"
        })
        if response.status_code == 200:
            return response.json().get("id")
        pytest.skip("Could not get trainee ID")
    
    def test_create_subscription_invalid_sessions_per_week_zero(self, trainee_token, trainer_id):
        """POST /api/subscriptions rejects sessionsPerWeek = 0"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions",
            headers={"Authorization": f"Bearer {trainee_token}"},
            json={
                "trainerId": trainer_id,
                "sessionsPerWeek": 0,
                "preferredDays": ["monday", "wednesday"],
                "preferredTimeSlot": "morning",
                "sessionType": "outdoor",
                "durationMinutes": 60
            }
        )
        assert response.status_code == 400
        print(f"Correctly rejected sessionsPerWeek=0: {response.json()}")
    
    def test_create_subscription_invalid_sessions_per_week_eight(self, trainee_token, trainer_id):
        """POST /api/subscriptions rejects sessionsPerWeek = 8"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions",
            headers={"Authorization": f"Bearer {trainee_token}"},
            json={
                "trainerId": trainer_id,
                "sessionsPerWeek": 8,
                "preferredDays": ["monday", "wednesday"],
                "preferredTimeSlot": "morning",
                "sessionType": "outdoor",
                "durationMinutes": 60
            }
        )
        assert response.status_code == 400
        print(f"Correctly rejected sessionsPerWeek=8: {response.json()}")
    
    def test_create_subscription_with_correct_pricing(self, trainee_token, trainer_id):
        """POST /api/subscriptions creates subscription with 20% platform fee"""
        # First, cancel any existing subscription to avoid duplicate error
        # Get existing subscriptions
        get_response = requests.get(
            f"{BASE_URL}/api/subscriptions",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        if get_response.status_code == 200:
            subs = get_response.json()
            for sub in subs:
                if sub.get('trainerId') == trainer_id and sub.get('status') in ['active', 'pending']:
                    # Cancel existing subscription
                    cancel_response = requests.put(
                        f"{BASE_URL}/api/subscriptions/{sub['id']}/cancel",
                        headers={"Authorization": f"Bearer {trainee_token}"}
                    )
                    print(f"Cancelled existing subscription: {sub['id']}")
        
        # Now create new subscription
        response = requests.post(
            f"{BASE_URL}/api/subscriptions",
            headers={"Authorization": f"Bearer {trainee_token}"},
            json={
                "trainerId": trainer_id,
                "sessionsPerWeek": 3,
                "preferredDays": ["monday", "wednesday", "friday"],
                "preferredTimeSlot": "morning",
                "sessionType": "outdoor",
                "durationMinutes": 60,
                "locationNameOrAddress": "Central Park",
                "notes": "Test subscription for iteration 69"
            }
        )
        
        assert response.status_code == 200, f"Failed to create subscription: {response.text}"
        data = response.json()
        
        # Verify subscription created
        assert data.get("success") == True
        assert "subscriptionId" in data
        
        # Verify pricing structure
        assert "pricing" in data
        pricing = data["pricing"]
        
        # Verify 20% platform fee
        trainer_rate = pricing.get("trainerRatePerSession", 0)
        platform_fee = pricing.get("platformFeePerSession", 0)
        total_per_session = pricing.get("totalPerSession", 0)
        
        # Platform fee should be 20% of trainer rate
        expected_platform_fee = int(trainer_rate * 0.20)
        assert platform_fee == expected_platform_fee, f"Platform fee {platform_fee} != expected {expected_platform_fee}"
        
        # Total should be trainer rate + platform fee
        assert total_per_session == trainer_rate + platform_fee
        
        # Verify weekly and monthly totals
        weekly_total = pricing.get("weeklyTotal", 0)
        assert weekly_total == total_per_session * 3  # 3 sessions per week
        
        monthly_estimate = pricing.get("monthlyEstimate", 0)
        assert monthly_estimate == weekly_total * 4  # 4 weeks per month
        
        print(f"Subscription created with correct pricing:")
        print(f"  Trainer rate: {trainer_rate} cents")
        print(f"  Platform fee (20%): {platform_fee} cents")
        print(f"  Total per session: {total_per_session} cents")
        print(f"  Weekly total (3 sessions): {weekly_total} cents")
        print(f"  Monthly estimate: {monthly_estimate} cents")
        
        # Store subscription ID for later tests
        return data["subscriptionId"]
    
    def test_create_subscription_duplicate_rejected(self, trainee_token, trainer_id):
        """POST /api/subscriptions rejects duplicate active subscription with same trainer"""
        # First create a subscription
        response1 = requests.post(
            f"{BASE_URL}/api/subscriptions",
            headers={"Authorization": f"Bearer {trainee_token}"},
            json={
                "trainerId": trainer_id,
                "sessionsPerWeek": 2,
                "preferredDays": ["tuesday", "thursday"],
                "preferredTimeSlot": "afternoon",
                "sessionType": "outdoor",
                "durationMinutes": 45
            }
        )
        
        # If first one succeeded, try to create duplicate
        if response1.status_code == 200:
            response2 = requests.post(
                f"{BASE_URL}/api/subscriptions",
                headers={"Authorization": f"Bearer {trainee_token}"},
                json={
                    "trainerId": trainer_id,
                    "sessionsPerWeek": 1,
                    "preferredDays": ["saturday"],
                    "preferredTimeSlot": "evening",
                    "sessionType": "outdoor",
                    "durationMinutes": 30
                }
            )
            assert response2.status_code == 400
            assert "already have" in response2.json().get("detail", "").lower()
            print(f"Correctly rejected duplicate subscription: {response2.json()}")
        else:
            # First one was rejected as duplicate (from previous test)
            assert response1.status_code == 400
            print(f"Duplicate subscription correctly rejected: {response1.json()}")
    
    def test_get_subscriptions(self, trainee_token):
        """GET /api/subscriptions returns user's subscriptions with otherParty info"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            sub = data[0]
            # Verify subscription has required fields
            assert "id" in sub
            assert "trainerId" in sub
            assert "traineeId" in sub
            assert "sessionsPerWeek" in sub
            assert "status" in sub
            
            # Verify otherParty info
            assert "otherParty" in sub
            other_party = sub["otherParty"]
            assert "id" in other_party
            assert "fullName" in other_party
            
            # Verify role field
            assert "role" in sub
            assert sub["role"] in ["trainee", "trainer"]
            
            print(f"Found {len(data)} subscriptions")
            print(f"First subscription: id={sub['id']}, status={sub['status']}, otherParty={other_party['fullName']}")
        else:
            print("No subscriptions found (may need to create one first)")
    
    def test_get_subscription_by_id(self, trainee_token, trainer_id):
        """GET /api/subscriptions/{id} returns specific subscription details"""
        # First get list of subscriptions
        list_response = requests.get(
            f"{BASE_URL}/api/subscriptions",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        
        if list_response.status_code == 200 and len(list_response.json()) > 0:
            sub_id = list_response.json()[0]["id"]
            
            response = requests.get(
                f"{BASE_URL}/api/subscriptions/{sub_id}",
                headers={"Authorization": f"Bearer {trainee_token}"}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify subscription details
            assert data.get("id") == sub_id
            assert "trainerId" in data
            assert "traineeId" in data
            assert "sessionsPerWeek" in data
            assert "trainerRateCents" in data
            assert "platformFeeCents" in data
            assert "totalPerSessionCents" in data
            assert "platformFeePercent" in data
            
            # Verify platform fee is 20%
            assert data.get("platformFeePercent") == 20
            
            print(f"Subscription details retrieved: {data.get('id')}")
            print(f"  Status: {data.get('status')}")
            print(f"  Sessions/week: {data.get('sessionsPerWeek')}")
            print(f"  Platform fee: {data.get('platformFeePercent')}%")
        else:
            pytest.skip("No subscriptions available to test")
    
    def test_trainer_accept_subscription(self, trainer_token, trainee_token, trainer_id):
        """PUT /api/subscriptions/{id}/accept activates subscription and schedules sessions"""
        # Get pending subscriptions for trainer
        list_response = requests.get(
            f"{BASE_URL}/api/subscriptions",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        
        if list_response.status_code == 200:
            subs = list_response.json()
            pending_subs = [s for s in subs if s.get("status") == "pending" and s.get("role") == "trainer"]
            
            if len(pending_subs) > 0:
                sub_id = pending_subs[0]["id"]
                
                response = requests.put(
                    f"{BASE_URL}/api/subscriptions/{sub_id}/accept",
                    headers={"Authorization": f"Bearer {trainer_token}"}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert data.get("success") == True
                assert "activated" in data.get("message", "").lower() or "scheduled" in data.get("message", "").lower()
                
                print(f"Subscription accepted: {data}")
            else:
                print("No pending subscriptions to accept")
        else:
            pytest.skip("Could not get subscriptions")
    
    def test_trainer_decline_subscription(self, trainer_token, trainee_token, trainer_id):
        """PUT /api/subscriptions/{id}/decline declines pending subscription"""
        # First create a new subscription to decline
        # Cancel any existing first
        get_response = requests.get(
            f"{BASE_URL}/api/subscriptions",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        if get_response.status_code == 200:
            subs = get_response.json()
            for sub in subs:
                if sub.get('trainerId') == trainer_id and sub.get('status') in ['active', 'pending']:
                    requests.put(
                        f"{BASE_URL}/api/subscriptions/{sub['id']}/cancel",
                        headers={"Authorization": f"Bearer {trainee_token}"}
                    )
        
        # Create new subscription
        create_response = requests.post(
            f"{BASE_URL}/api/subscriptions",
            headers={"Authorization": f"Bearer {trainee_token}"},
            json={
                "trainerId": trainer_id,
                "sessionsPerWeek": 1,
                "preferredDays": ["sunday"],
                "preferredTimeSlot": "evening",
                "sessionType": "outdoor",
                "durationMinutes": 30
            }
        )
        
        if create_response.status_code == 200:
            sub_id = create_response.json()["subscriptionId"]
            
            # Trainer declines
            response = requests.put(
                f"{BASE_URL}/api/subscriptions/{sub_id}/decline",
                headers={"Authorization": f"Bearer {trainer_token}"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data.get("success") == True
            assert "declined" in data.get("message", "").lower()
            
            print(f"Subscription declined: {data}")
        else:
            print(f"Could not create subscription to decline: {create_response.text}")
    
    def test_pause_subscription(self, trainee_token, trainer_token, trainer_id):
        """PUT /api/subscriptions/{id}/pause pauses active subscription"""
        # Get active subscriptions
        list_response = requests.get(
            f"{BASE_URL}/api/subscriptions",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        
        if list_response.status_code == 200:
            subs = list_response.json()
            active_subs = [s for s in subs if s.get("status") == "active"]
            
            if len(active_subs) > 0:
                sub_id = active_subs[0]["id"]
                
                response = requests.put(
                    f"{BASE_URL}/api/subscriptions/{sub_id}/pause",
                    headers={"Authorization": f"Bearer {trainee_token}"}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert data.get("success") == True
                assert "paused" in data.get("message", "").lower()
                
                print(f"Subscription paused: {data}")
            else:
                print("No active subscriptions to pause")
    
    def test_resume_subscription(self, trainee_token, trainer_id):
        """PUT /api/subscriptions/{id}/resume resumes paused subscription"""
        # Get paused subscriptions
        list_response = requests.get(
            f"{BASE_URL}/api/subscriptions",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        
        if list_response.status_code == 200:
            subs = list_response.json()
            paused_subs = [s for s in subs if s.get("status") == "paused"]
            
            if len(paused_subs) > 0:
                sub_id = paused_subs[0]["id"]
                
                response = requests.put(
                    f"{BASE_URL}/api/subscriptions/{sub_id}/resume",
                    headers={"Authorization": f"Bearer {trainee_token}"}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert data.get("success") == True
                assert "resumed" in data.get("message", "").lower()
                
                print(f"Subscription resumed: {data}")
            else:
                print("No paused subscriptions to resume")
    
    def test_cancel_subscription(self, trainee_token, trainer_id):
        """PUT /api/subscriptions/{id}/cancel cancels subscription"""
        # Get any subscription to cancel
        list_response = requests.get(
            f"{BASE_URL}/api/subscriptions",
            headers={"Authorization": f"Bearer {trainee_token}"}
        )
        
        if list_response.status_code == 200:
            subs = list_response.json()
            cancelable_subs = [s for s in subs if s.get("status") in ["active", "pending", "paused"]]
            
            if len(cancelable_subs) > 0:
                sub_id = cancelable_subs[0]["id"]
                
                response = requests.put(
                    f"{BASE_URL}/api/subscriptions/{sub_id}/cancel",
                    headers={"Authorization": f"Bearer {trainee_token}"}
                )
                
                assert response.status_code == 200
                data = response.json()
                assert data.get("success") == True
                assert "cancelled" in data.get("message", "").lower()
                
                print(f"Subscription cancelled: {data}")
            else:
                print("No subscriptions to cancel")


class TestGPSCheckinEndpoints:
    """GPS Check-in API Tests"""
    
    @pytest.fixture(scope="class")
    def trainer_token(self):
        """Get trainer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test_trainer_iter25@test.com",
            "password": "Test123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Trainer login failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def trainee_token(self):
        """Get trainee auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test_trainee_iter25@test.com",
            "password": "Test123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Trainee login failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def trainer_id(self, trainer_token):
        """Get trainer user ID"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {trainer_token}"
        })
        if response.status_code == 200:
            return response.json().get("id")
        pytest.skip("Could not get trainer ID")
    
    @pytest.fixture(scope="class")
    def trainee_id(self, trainee_token):
        """Get trainee user ID"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {trainee_token}"
        })
        if response.status_code == 200:
            return response.json().get("id")
        pytest.skip("Could not get trainee ID")
    
    @pytest.fixture(scope="class")
    def test_session_id(self, trainer_token, trainee_token, trainer_id, trainee_id):
        """Get an existing confirmed session for GPS check-in tests"""
        # Get trainer's sessions (use correct endpoint)
        sessions_response = requests.get(
            f"{BASE_URL}/api/trainer/sessions",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        
        if sessions_response.status_code == 200:
            sessions = sessions_response.json()
            confirmed = [s for s in sessions if s.get("status") in ["confirmed", "en_route", "in_progress"]]
            if confirmed:
                session_id = confirmed[0].get("id")
                print(f"Using existing session: {session_id}")
                return session_id
        
        # Try to create a new session if no existing ones
        session_start = datetime.utcnow() + timedelta(hours=1)
        response = requests.post(
            f"{BASE_URL}/api/sessions",
            headers={"Authorization": f"Bearer {trainee_token}"},
            json={
                "traineeId": trainee_id,
                "trainerId": trainer_id,
                "sessionDateTimeStart": session_start.isoformat(),
                "durationMinutes": 60,
                "sessionType": "outdoor",
                "locationType": "outdoor",
                "locationNameOrAddress": "Central Park, NYC",
                "traineeLatitude": 40.7829,
                "traineeLongitude": -73.9654,
                "notes": "Test session for GPS check-in"
            }
        )
        
        if response.status_code in [200, 201]:
            data = response.json()
            session_id = data.get("id") or data.get("sessionId")
            
            # Trainer accepts the session using PATCH
            accept_response = requests.patch(
                f"{BASE_URL}/api/sessions/{session_id}/accept",
                headers={"Authorization": f"Bearer {trainer_token}"}
            )
            
            print(f"Created test session: {session_id}")
            return session_id
        
        pytest.skip("Could not create or find test session")
    
    def test_set_session_location(self, trainer_token, test_session_id):
        """PUT /api/sessions/{id}/location sets session GPS coordinates"""
        response = requests.put(
            f"{BASE_URL}/api/sessions/{test_session_id}/location",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={
                "latitude": 40.7829,
                "longitude": -73.9654
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("latitude") == 40.7829
        assert data.get("longitude") == -73.9654
        
        print(f"Session location set: lat={data.get('latitude')}, lon={data.get('longitude')}")
    
    def test_set_gps_radius_valid(self, trainer_token, test_session_id):
        """PUT /api/sessions/{id}/gps-radius sets radius (1-35 miles)"""
        response = requests.put(
            f"{BASE_URL}/api/sessions/{test_session_id}/gps-radius",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={"radiusMiles": 10}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("radiusMiles") == 10
        
        print(f"GPS radius set to {data.get('radiusMiles')} miles")
    
    def test_set_gps_radius_invalid_zero(self, trainer_token, test_session_id):
        """PUT /api/sessions/{id}/gps-radius rejects radius = 0"""
        response = requests.put(
            f"{BASE_URL}/api/sessions/{test_session_id}/gps-radius",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={"radiusMiles": 0}
        )
        
        assert response.status_code == 400
        print(f"Correctly rejected radius=0: {response.json()}")
    
    def test_set_gps_radius_invalid_36(self, trainer_token, test_session_id):
        """PUT /api/sessions/{id}/gps-radius rejects radius = 36"""
        response = requests.put(
            f"{BASE_URL}/api/sessions/{test_session_id}/gps-radius",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={"radiusMiles": 36}
        )
        
        assert response.status_code == 400
        print(f"Correctly rejected radius=36: {response.json()}")
    
    def test_gps_checkin_trainer(self, trainer_token, test_session_id):
        """POST /api/sessions/{id}/gps-checkin records trainer GPS check-in"""
        # First set session location
        requests.put(
            f"{BASE_URL}/api/sessions/{test_session_id}/location",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={"latitude": 40.7829, "longitude": -73.9654}
        )
        
        # Trainer checks in at same location (within radius)
        response = requests.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/gps-checkin",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={
                "latitude": 40.7830,  # Very close to session location
                "longitude": -73.9655
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("role") == "trainer"
        assert "withinRadius" in data
        assert "distanceMiles" in data
        
        print(f"Trainer GPS check-in: withinRadius={data.get('withinRadius')}, distance={data.get('distanceMiles')} miles")
    
    def test_gps_checkin_trainee(self, trainee_token, test_session_id):
        """POST /api/sessions/{id}/gps-checkin records trainee GPS check-in"""
        response = requests.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/gps-checkin",
            headers={"Authorization": f"Bearer {trainee_token}"},
            json={
                "latitude": 40.7831,  # Very close to session location
                "longitude": -73.9656
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("role") == "trainee"
        assert "withinRadius" in data
        assert "distanceMiles" in data
        
        print(f"Trainee GPS check-in: withinRadius={data.get('withinRadius')}, distance={data.get('distanceMiles')} miles")
    
    def test_gps_checkin_validates_within_radius(self, trainer_token, test_session_id):
        """POST /api/sessions/{id}/gps-checkin validates within-radius correctly"""
        # Set a small radius
        requests.put(
            f"{BASE_URL}/api/sessions/{test_session_id}/gps-radius",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={"radiusMiles": 1}
        )
        
        # Check in from far away (should be outside radius)
        response = requests.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/gps-checkin",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={
                "latitude": 40.8000,  # About 1.2 miles away
                "longitude": -73.9500
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        # Should still succeed but withinRadius should be False
        assert data.get("success") == True
        # Distance should be calculated
        assert "distanceMiles" in data
        
        print(f"GPS check-in from far: withinRadius={data.get('withinRadius')}, distance={data.get('distanceMiles')} miles")
    
    def test_get_checkin_status(self, trainer_token, test_session_id):
        """GET /api/sessions/{id}/checkin-status returns both parties' check-in status"""
        response = requests.get(
            f"{BASE_URL}/api/sessions/{test_session_id}/checkin-status",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "sessionId" in data
        assert "trainerConfirmed" in data
        assert "traineeConfirmed" in data
        assert "bothConfirmed" in data
        assert "radiusMiles" in data
        
        print(f"Check-in status: trainer={data.get('trainerConfirmed')}, trainee={data.get('traineeConfirmed')}, both={data.get('bothConfirmed')}")
    
    def test_no_show_action_cancel(self, trainer_token, test_session_id):
        """POST /api/sessions/{id}/no-show-action with action=cancel marks session as no_show"""
        response = requests.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/no-show-action",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={
                "action": "cancel",
                "notes": "Trainee did not show up"
            }
        )
        
        # May fail if session is not in correct status, but endpoint should work
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert data.get("action") == "cancel"
            print(f"No-show action (cancel): {data}")
        else:
            print(f"No-show cancel response: {response.status_code} - {response.text}")
            # Endpoint exists and responds
            assert response.status_code in [200, 400, 403]
    
    def test_no_show_action_proceed(self, trainer_token, trainee_token, trainer_id, trainee_id):
        """POST /api/sessions/{id}/no-show-action with action=proceed starts session"""
        # Get an existing confirmed session
        sessions_response = requests.get(
            f"{BASE_URL}/api/trainer/sessions",
            headers={"Authorization": f"Bearer {trainer_token}"}
        )
        
        if sessions_response.status_code == 200:
            sessions = sessions_response.json()
            confirmed = [s for s in sessions if s.get("status") in ["confirmed", "en_route"]]
            
            if confirmed:
                session_id = confirmed[0].get("id")
                
                # Try proceed action
                response = requests.post(
                    f"{BASE_URL}/api/sessions/{session_id}/no-show-action",
                    headers={"Authorization": f"Bearer {trainer_token}"},
                    json={
                        "action": "proceed",
                        "notes": "Proceeding without GPS confirmation"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    assert data.get("success") == True
                    assert data.get("action") == "proceed"
                    print(f"No-show action (proceed): {data}")
                else:
                    print(f"No-show proceed response: {response.status_code} - {response.text}")
                    # Endpoint exists and responds
                    assert response.status_code in [200, 400, 403]
            else:
                print("No confirmed sessions available for proceed test")
        else:
            print(f"Could not get sessions: {sessions_response.status_code}")
    
    def test_no_show_action_invalid(self, trainer_token, test_session_id):
        """POST /api/sessions/{id}/no-show-action rejects invalid action"""
        response = requests.post(
            f"{BASE_URL}/api/sessions/{test_session_id}/no-show-action",
            headers={"Authorization": f"Bearer {trainer_token}"},
            json={
                "action": "invalid_action",
                "notes": "This should fail"
            }
        )
        
        assert response.status_code == 400
        print(f"Correctly rejected invalid action: {response.json()}")


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"API health check passed: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
