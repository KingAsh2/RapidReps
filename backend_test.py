#!/usr/bin/env python3
"""
RapidReps Backend API Test Suite - Proximity Matching & Trainer Availability Features
Tests the newly implemented features for proximity matching and trainer availability.
"""

import requests
import json
import base64
from datetime import datetime, timedelta
import time

# Configuration
BASE_URL = "https://workout-match-4.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def add_pass(self, test_name):
        self.passed += 1
        print(f"✅ {test_name}")
    
    def add_fail(self, test_name, error):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print(f"❌ {test_name}: {error}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} tests passed")
        if self.errors:
            print(f"\nFAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        print(f"{'='*60}")

# Global test results
results = TestResults()

class RapidRepsProximityTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = HEADERS.copy()
        self.test_users = []  # Store created users for cleanup
    def make_request(self, method, endpoint, data=None, headers=None, params=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        request_headers = self.headers.copy()
        if headers:
            request_headers.update(headers)
        
        try:
            if method == "GET":
                response = requests.get(url, headers=request_headers, params=params)
            elif method == "POST":
                response = requests.post(url, headers=request_headers, json=data)
            elif method == "PATCH":
                response = requests.patch(url, headers=request_headers, json=data, params=params)
            elif method == "PUT":
                response = requests.put(url, headers=request_headers, json=data)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
            return None
    def test_health_check(self):
        """Test API health check"""
        response = self.make_request("GET", "/health")
        if response and response.status_code == 200:
            results.add_pass("API Health Check")
            return True
        else:
            results.add_fail("API Health Check", f"Status: {response.status_code if response else 'No response'}")
            return False

    def create_test_user(self, role="trainee", suffix=""):
        """Create a test user and return auth token"""
        user_data = {
            "fullName": f"Test {role.title()} {suffix}",
            "email": f"test{role}{suffix}@example.com",
            "phone": f"555-000-{1000 + len(suffix)}",
            "password": "testpass123",
            "roles": [role]
        }
        
        response = self.make_request("POST", "/auth/signup", user_data)
        if response and response.status_code == 200:
            data = response.json()
            self.test_users.append(data["user"]["id"])
            return data["access_token"], data["user"]["id"]
        return None, None
    
    def test_signup_trainer(self):
        """Test trainer signup"""
        signup_data = {
            "fullName": "John Trainer",
            "email": "test-trainer@test.com",
            "phone": "+1234567890",
            "password": "test123",
            "roles": ["trainer"]
        }
        
        success, data, status = self.make_request("POST", "/auth/signup", signup_data)
        
        if success and "access_token" in data:
            self.trainer_token = data["access_token"]
            self.trainer_user_id = data["user"]["id"]
            self.log_test("Trainer Signup", True, f"User ID: {self.trainer_user_id}")
        else:
            self.log_test("Trainer Signup", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_signup_trainee(self):
        """Test trainee signup"""
        signup_data = {
            "fullName": "Jane Trainee",
            "email": "test-trainee@test.com",
            "phone": "+1234567891",
            "password": "test123",
            "roles": ["trainee"]
        }
        
        success, data, status = self.make_request("POST", "/auth/signup", signup_data)
        
        if success and "access_token" in data:
            self.trainee_token = data["access_token"]
            self.trainee_user_id = data["user"]["id"]
            self.log_test("Trainee Signup", True, f"User ID: {self.trainee_user_id}")
        else:
            self.log_test("Trainee Signup", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_login_trainer(self):
        """Test trainer login"""
        login_data = {
            "email": "test-trainer@test.com",
            "password": "test123"
        }
        
        success, data, status = self.make_request("POST", "/auth/login", login_data)
        
        if success and "access_token" in data:
            # Update token in case it's different
            self.trainer_token = data["access_token"]
            self.log_test("Trainer Login", True, "Login successful")
        else:
            self.log_test("Trainer Login", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_login_trainee(self):
        """Test trainee login"""
        login_data = {
            "email": "test-trainee@test.com",
            "password": "test123"
        }
        
        success, data, status = self.make_request("POST", "/auth/login", login_data)
        
        if success and "access_token" in data:
            # Update token in case it's different
            self.trainee_token = data["access_token"]
            self.log_test("Trainee Login", True, "Login successful")
        else:
            self.log_test("Trainee Login", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_jwt_verification_trainer(self):
        """Test JWT token verification for trainer"""
        success, data, status = self.make_request("GET", "/auth/me", token=self.trainer_token)
        
        if success and "id" in data:
            self.log_test("Trainer JWT Verification", True, f"User: {data.get('fullName')}")
        else:
            self.log_test("Trainer JWT Verification", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_jwt_verification_trainee(self):
        """Test JWT token verification for trainee"""
        success, data, status = self.make_request("GET", "/auth/me", token=self.trainee_token)
        
        if success and "id" in data:
            self.log_test("Trainee JWT Verification", True, f"User: {data.get('fullName')}")
        else:
            self.log_test("Trainee JWT Verification", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_create_trainer_profile(self):
        """Test trainer profile creation"""
        profile_data = {
            "userId": self.trainer_user_id,
            "bio": "Experienced personal trainer with 5+ years",
            "experienceYears": 5,
            "certifications": ["NASM-CPT", "ACSM"],
            "trainingStyles": ["strength", "cardio", "functional"],
            "gymsWorkedAt": ["Gold's Gym", "LA Fitness"],
            "primaryGym": "Gold's Gym Downtown",
            "offersInPerson": True,
            "offersVirtual": True,
            "sessionDurationsOffered": [30, 45, 60, 90],
            "ratePerMinuteCents": 100,
            "travelRadiusMiles": 15,
            "cancellationPolicy": "Free cancellation before 24 hours"
        }
        
        success, data, status = self.make_request("POST", "/trainer-profiles", profile_data, self.trainer_token)
        
        if success and "id" in data:
            self.trainer_profile_id = data["id"]
            self.log_test("Trainer Profile Creation", True, f"Profile ID: {self.trainer_profile_id}")
        else:
            self.log_test("Trainer Profile Creation", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_create_trainee_profile(self):
        """Test trainee profile creation"""
        profile_data = {
            "userId": self.trainee_user_id,
            "fitnessGoals": "Lose weight and build muscle",
            "currentFitnessLevel": "beginner",
            "preferredTrainingStyles": ["strength", "cardio"],
            "injuriesOrLimitations": "Previous knee injury",
            "homeGymOrZipCode": "90210",
            "prefersInPerson": True,
            "prefersVirtual": False,
            "budgetMinPerMinuteCents": 80,
            "budgetMaxPerMinuteCents": 150
        }
        
        success, data, status = self.make_request("POST", "/trainee-profiles", profile_data, self.trainee_token)
        
        if success and "id" in data:
            self.trainee_profile_id = data["id"]
            self.log_test("Trainee Profile Creation", True, f"Profile ID: {self.trainee_profile_id}")
        else:
            self.log_test("Trainee Profile Creation", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_get_trainer_profile(self):
        """Test retrieving trainer profile"""
        success, data, status = self.make_request("GET", f"/trainer-profiles/{self.trainer_user_id}")
        
        if success and "id" in data:
            self.log_test("Get Trainer Profile", True, f"Bio: {data.get('bio', 'N/A')}")
        else:
            self.log_test("Get Trainer Profile", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_get_trainee_profile(self):
        """Test retrieving trainee profile"""
        success, data, status = self.make_request("GET", f"/trainee-profiles/{self.trainee_user_id}")
        
        if success and "id" in data:
            self.log_test("Get Trainee Profile", True, f"Goals: {data.get('fitnessGoals', 'N/A')}")
        else:
            self.log_test("Get Trainee Profile", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_verify_trainer(self):
        """Manually verify trainer for search testing (simulating admin action)"""
        # Since we don't have admin credentials, we'll need to check if trainer appears in search
        # First, let's try searching without verification
        success, data, status = self.make_request("GET", "/trainers/search")
        
        if success:
            trainer_found = any(t.get('userId') == self.trainer_user_id for t in data)
            if trainer_found:
                self.log_test("Trainer Search (Unverified)", True, "Trainer appears in search (may be auto-verified)")
            else:
                self.log_test("Trainer Search (Unverified)", True, "Trainer not in search (verification required)")
        else:
            self.log_test("Trainer Search (Unverified)", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_trainer_search_no_filters(self):
        """Test trainer search without filters"""
        success, data, status = self.make_request("GET", "/trainers/search")
        
        if success:
            trainer_count = len(data) if isinstance(data, list) else 0
            self.log_test("Trainer Search (No Filters)", True, f"Found {trainer_count} trainers")
        else:
            self.log_test("Trainer Search (No Filters)", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_trainer_search_with_filters(self):
        """Test trainer search with filters"""
        # Test with style filter
        success, data, status = self.make_request("GET", "/trainers/search?styles=strength,cardio")
        
        if success:
            trainer_count = len(data) if isinstance(data, list) else 0
            self.log_test("Trainer Search (With Filters)", True, f"Found {trainer_count} trainers with strength/cardio")
        else:
            self.log_test("Trainer Search (With Filters)", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_create_first_session(self):
        """Test creating first session (base price)"""
        session_start = datetime.utcnow() + timedelta(days=1)
        session_data = {
            "traineeId": self.trainee_user_id,
            "trainerId": self.trainer_user_id,
            "sessionDateTimeStart": session_start.isoformat(),
            "durationMinutes": 60,
            "locationType": "gym",
            "locationNameOrAddress": "Gold's Gym Downtown",
            "notes": "First session - assessment and basic workout"
        }
        
        success, data, status = self.make_request("POST", "/sessions", session_data, self.trainee_token)
        
        if success and "id" in data:
            session_id = data["id"]
            self.session_ids.append(session_id)
            
            # Verify pricing
            expected_base_price = 100 * 60  # $1/min * 60 min = 6000 cents
            actual_base_price = data.get("baseSessionPriceCents", 0)
            discount = data.get("discountAmountCents", 0)
            final_price = data.get("finalSessionPriceCents", 0)
            platform_fee = data.get("platformFeeCents", 0)
            trainer_earnings = data.get("trainerEarningsCents", 0)
            
            pricing_correct = (
                actual_base_price == expected_base_price and
                discount == 0 and  # No discount on first session
                final_price == expected_base_price and
                platform_fee == int(final_price * 0.10) and
                trainer_earnings == final_price - platform_fee
            )
            
            details = f"Session ID: {session_id}, Base: {actual_base_price}¢, Final: {final_price}¢, Fee: {platform_fee}¢, Earnings: {trainer_earnings}¢"
            self.log_test("Create First Session", pricing_correct, details)
        else:
            self.log_test("Create First Session", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_create_second_session(self):
        """Test creating second session (still base price)"""
        session_start = datetime.utcnow() + timedelta(days=2)
        session_data = {
            "traineeId": self.trainee_user_id,
            "trainerId": self.trainer_user_id,
            "sessionDateTimeStart": session_start.isoformat(),
            "durationMinutes": 45,
            "locationType": "home",
            "locationNameOrAddress": "Client's home gym",
            "notes": "Second session - strength training focus"
        }
        
        success, data, status = self.make_request("POST", "/sessions", session_data, self.trainee_token)
        
        if success and "id" in data:
            session_id = data["id"]
            self.session_ids.append(session_id)
            
            # Verify pricing
            expected_base_price = 100 * 45  # $1/min * 45 min = 4500 cents
            actual_base_price = data.get("baseSessionPriceCents", 0)
            discount = data.get("discountAmountCents", 0)
            final_price = data.get("finalSessionPriceCents", 0)
            
            pricing_correct = (
                actual_base_price == expected_base_price and
                discount == 0 and  # No discount on second session
                final_price == expected_base_price
            )
            
            details = f"Session ID: {session_id}, Base: {actual_base_price}¢, Discount: {discount}¢, Final: {final_price}¢"
            self.log_test("Create Second Session", pricing_correct, details)
        else:
            self.log_test("Create Second Session", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_create_third_session_with_discount(self):
        """Test creating third session (should have 5% discount)"""
        session_start = datetime.utcnow() + timedelta(days=3)
        session_data = {
            "traineeId": self.trainee_user_id,
            "trainerId": self.trainer_user_id,
            "sessionDateTimeStart": session_start.isoformat(),
            "durationMinutes": 60,
            "locationType": "virtual",
            "notes": "Third session - should have multi-session discount"
        }
        
        success, data, status = self.make_request("POST", "/sessions", session_data, self.trainee_token)
        
        if success and "id" in data:
            session_id = data["id"]
            self.session_ids.append(session_id)
            
            # Verify pricing with discount
            expected_base_price = 100 * 60  # $1/min * 60 min = 6000 cents
            expected_discount = int(expected_base_price * 0.05)  # 5% discount = 300 cents
            expected_final_price = expected_base_price - expected_discount
            expected_platform_fee = int(expected_final_price * 0.10)
            expected_trainer_earnings = expected_final_price - expected_platform_fee
            
            actual_base_price = data.get("baseSessionPriceCents", 0)
            actual_discount = data.get("discountAmountCents", 0)
            actual_final_price = data.get("finalSessionPriceCents", 0)
            actual_platform_fee = data.get("platformFeeCents", 0)
            actual_trainer_earnings = data.get("trainerEarningsCents", 0)
            discount_type = data.get("discountType")
            
            pricing_correct = (
                actual_base_price == expected_base_price and
                actual_discount == expected_discount and
                actual_final_price == expected_final_price and
                actual_platform_fee == expected_platform_fee and
                actual_trainer_earnings == expected_trainer_earnings and
                discount_type == "multi_session"
            )
            
            details = f"Session ID: {session_id}, Base: {actual_base_price}¢, Discount: {actual_discount}¢ ({discount_type}), Final: {actual_final_price}¢, Fee: {actual_platform_fee}¢, Earnings: {actual_trainer_earnings}¢"
            self.log_test("Create Third Session (With Discount)", pricing_correct, details)
        else:
            self.log_test("Create Third Session (With Discount)", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_get_trainer_sessions(self):
        """Test getting trainer's sessions"""
        success, data, status = self.make_request("GET", "/trainer/sessions", token=self.trainer_token)
        
        if success and isinstance(data, list):
            session_count = len(data)
            pending_sessions = [s for s in data if s.get("status") == "requested"]
            self.log_test("Get Trainer Sessions", True, f"Total: {session_count}, Pending: {len(pending_sessions)}")
        else:
            self.log_test("Get Trainer Sessions", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_accept_session(self):
        """Test trainer accepting a session"""
        if not self.session_ids:
            self.log_test("Accept Session", False, "No sessions available to accept")
            return False
        
        session_id = self.session_ids[0]
        success, data, status = self.make_request("PATCH", f"/sessions/{session_id}/accept", token=self.trainer_token)
        
        if success and data.get("status") == "confirmed":
            self.log_test("Accept Session", True, f"Session {session_id} accepted")
        else:
            self.log_test("Accept Session", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_decline_session(self):
        """Test trainer declining a session"""
        if len(self.session_ids) < 2:
            self.log_test("Decline Session", False, "No second session available to decline")
            return False
        
        session_id = self.session_ids[1]
        success, data, status = self.make_request("PATCH", f"/sessions/{session_id}/decline", token=self.trainer_token)
        
        if success and data.get("status") == "declined":
            self.log_test("Decline Session", True, f"Session {session_id} declined")
        else:
            self.log_test("Decline Session", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_complete_session(self):
        """Test completing a session"""
        if not self.session_ids:
            self.log_test("Complete Session", False, "No sessions available to complete")
            return False
        
        session_id = self.session_ids[0]  # Use the accepted session
        success, data, status = self.make_request("PATCH", f"/sessions/{session_id}/complete", token=self.trainer_token)
        
        if success and data.get("status") == "completed":
            self.log_test("Complete Session", True, f"Session {session_id} completed")
        else:
            self.log_test("Complete Session", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_create_rating(self):
        """Test creating a rating for completed session"""
        if not self.session_ids:
            self.log_test("Create Rating", False, "No sessions available to rate")
            return False
        
        session_id = self.session_ids[0]  # Use the completed session
        rating_data = {
            "sessionId": session_id,
            "traineeId": self.trainee_user_id,
            "trainerId": self.trainer_user_id,
            "rating": 5,
            "reviewText": "Excellent trainer! Very knowledgeable and motivating."
        }
        
        success, data, status = self.make_request("POST", "/ratings", rating_data, self.trainee_token)
        
        if success and "id" in data:
            rating_id = data["id"]
            self.log_test("Create Rating", True, f"Rating ID: {rating_id}, Score: {data.get('rating')}")
        else:
            self.log_test("Create Rating", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_get_trainer_ratings(self):
        """Test getting trainer's ratings"""
        success, data, status = self.make_request("GET", f"/trainers/{self.trainer_user_id}/ratings")
        
        if success and isinstance(data, list):
            rating_count = len(data)
            avg_rating = sum(r.get("rating", 0) for r in data) / rating_count if rating_count > 0 else 0
            self.log_test("Get Trainer Ratings", True, f"Count: {rating_count}, Average: {avg_rating:.1f}")
        else:
            self.log_test("Get Trainer Ratings", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def test_get_trainer_earnings(self):
        """Test getting trainer earnings"""
        success, data, status = self.make_request("GET", "/trainer/earnings", token=self.trainer_token)
        
        if success and "totalEarningsCents" in data:
            total_earnings = data.get("totalEarningsCents", 0)
            total_sessions = data.get("totalSessions", 0)
            self.log_test("Get Trainer Earnings", True, f"Total: {total_earnings}¢, Sessions: {total_sessions}")
        else:
            self.log_test("Get Trainer Earnings", False, f"Status: {status}, Error: {data}")
        
        return success
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting RapidReps Backend API Tests")
        print("=" * 60)
        
        # Health check
        self.test_health_check()
        
        # Authentication tests
        self.test_signup_trainer()
        self.test_signup_trainee()
        self.test_login_trainer()
        self.test_login_trainee()
        self.test_jwt_verification_trainer()
        self.test_jwt_verification_trainee()
        
        # Profile tests
        if self.trainer_token and self.trainee_token:
            self.test_create_trainer_profile()
            self.test_create_trainee_profile()
            self.test_get_trainer_profile()
            self.test_get_trainee_profile()
            
            # Search tests
            self.test_verify_trainer()
            self.test_trainer_search_no_filters()
            self.test_trainer_search_with_filters()
            
            # Session and pricing tests
            self.test_create_first_session()
            self.test_create_second_session()
            self.test_create_third_session_with_discount()
            
            # Session management tests
            self.test_get_trainer_sessions()
            self.test_accept_session()
            self.test_decline_session()
            self.test_complete_session()
            
            # Rating and earnings tests
            self.test_create_rating()
            self.test_get_trainer_ratings()
            self.test_get_trainer_earnings()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        for result in self.test_results:
            print(f"{result['status']}: {result['test']}")
            if result['details']:
                print(f"   {result['details']}")
        
        print(f"\n🎯 Results: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("🎉 All tests passed! RapidReps backend is working correctly.")
        else:
            failed_tests = [r['test'] for r in self.test_results if not r['success']]
            print(f"⚠️  Failed tests: {', '.join(failed_tests)}")
        
        return passed == total

if __name__ == "__main__":
    tester = RapidRepsAPITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)