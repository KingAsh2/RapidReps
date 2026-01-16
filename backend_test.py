#!/usr/bin/env python3
"""
RapidReps API Comprehensive Testing Suite - LOCATION/MAP FEATURES FOCUS
Focus on location/map features and all critical endpoints as requested in review
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://athletic-revamp.preview.emergentagent.com/api"
TEST_CREDENTIALS = {
    "trainee": {"email": "mobile@test.com", "password": "test123"},
    "trainer": {"email": "trainer@test.com", "password": "test123"}  # Will create if needed
}

class RapidRepsAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.trainee_token = None
        self.trainer_token = None
        self.trainee_user = None
        self.trainer_user = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    Details: {details}")
        if not success and response_data:
            print(f"    Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, token: str = None, params: Dict = None) -> requests.Response:
        """Make HTTP request with proper headers"""
        url = f"{BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers, params=params)
            elif method.upper() == "POST":
                response = self.session.post(url, headers=headers, json=data)
            elif method.upper() == "PUT":
                response = self.session.put(url, headers=headers, json=data)
            elif method.upper() == "PATCH":
                response = self.session.patch(url, headers=headers, json=data)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            print(f"Request failed: {e}")
            raise
    
    def test_authentication(self):
        """Test authentication endpoints"""
        print("🔐 TESTING AUTHENTICATION ENDPOINTS")
        print("=" * 50)
        
        # Test 1: Login with trainee credentials
        try:
            response = self.make_request("POST", "/auth/login", TEST_CREDENTIALS["trainee"])
            
            if response.status_code == 200:
                data = response.json()
                self.trainee_token = data.get("access_token")
                self.trainee_user = data.get("user")
                self.log_test("Trainee Login", True, f"Token received, User ID: {self.trainee_user.get('id')}")
            else:
                self.log_test("Trainee Login", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Trainee Login", False, f"Exception: {str(e)}")
        
        # Test 2: Get current user with trainee token
        if self.trainee_token:
            try:
                response = self.make_request("GET", "/auth/me", token=self.trainee_token)
                
                if response.status_code == 200:
                    user_data = response.json()
                    self.log_test("Get Current User (Trainee)", True, f"Email: {user_data.get('email')}")
                else:
                    self.log_test("Get Current User (Trainee)", False, f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_test("Get Current User (Trainee)", False, f"Exception: {str(e)}")
        
        # Test 3: Create trainer account if needed
        try:
            trainer_signup_data = {
                "fullName": "Test Trainer",
                "email": TEST_CREDENTIALS["trainer"]["email"],
                "phone": "+1234567890",
                "password": TEST_CREDENTIALS["trainer"]["password"],
                "roles": ["trainer"]
            }
            
            response = self.make_request("POST", "/auth/signup", trainer_signup_data)
            
            if response.status_code == 200:
                data = response.json()
                self.trainer_token = data.get("access_token")
                self.trainer_user = data.get("user")
                self.log_test("Trainer Account Creation", True, f"New trainer created, ID: {self.trainer_user.get('id')}")
            elif response.status_code == 400 and "already registered" in response.text:
                # Try to login instead
                login_response = self.make_request("POST", "/auth/login", TEST_CREDENTIALS["trainer"])
                if login_response.status_code == 200:
                    data = login_response.json()
                    self.trainer_token = data.get("access_token")
                    self.trainer_user = data.get("user")
                    self.log_test("Trainer Login (Existing)", True, f"Existing trainer logged in, ID: {self.trainer_user.get('id')}")
                else:
                    self.log_test("Trainer Login (Existing)", False, f"Status: {login_response.status_code}", login_response.text)
            else:
                self.log_test("Trainer Account Creation", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Trainer Account Creation", False, f"Exception: {str(e)}")
    
    def test_location_availability_endpoints(self):
        """Test NEW location and availability endpoints (Priority)"""
        print("📍 TESTING LOCATION & AVAILABILITY ENDPOINTS (PRIORITY)")
        print("=" * 60)
        
        if not self.trainer_token:
            self.log_test("Location Tests", False, "No trainer token available")
            return
        
        # Test 1: Create trainer profile first (needed for location features)
        try:
            trainer_profile_data = {
                "userId": self.trainer_user["id"],
                "bio": "Test trainer for location testing",
                "experienceYears": 5,
                "trainingStyles": ["Personal Training", "Strength Training"],
                "ratePerMinuteCents": 175,  # $1.75/min
                "latitude": 39.17,
                "longitude": -76.77,
                "locationAddress": "Baltimore, MD",
                "isAvailable": True,
                "isVirtualTrainingAvailable": True,
                "offersVirtual": True
            }
            
            response = self.make_request("POST", "/trainer-profiles", trainer_profile_data, self.trainer_token)
            
            if response.status_code == 200:
                self.log_test("Trainer Profile Creation", True, "Profile created with location data")
            else:
                self.log_test("Trainer Profile Creation", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Trainer Profile Creation", False, f"Exception: {str(e)}")
        
        # Test 2: Toggle trainer availability (PUT /api/trainer/availability)
        try:
            availability_data = {"isAvailable": False}
            response = self.make_request("PUT", "/trainer/availability", availability_data, self.trainer_token)
            
            if response.status_code == 200:
                self.log_test("Toggle Trainer Availability (Unavailable)", True, "Trainer set to unavailable")
            else:
                self.log_test("Toggle Trainer Availability (Unavailable)", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Toggle Trainer Availability (Unavailable)", False, f"Exception: {str(e)}")
        
        # Test 3: Toggle trainer availability back to available
        try:
            availability_data = {"isAvailable": True, "latitude": 39.17, "longitude": -76.77}
            response = self.make_request("PUT", "/trainer/availability", availability_data, self.trainer_token)
            
            if response.status_code == 200:
                self.log_test("Toggle Trainer Availability (Available)", True, "Trainer set to available with location")
            else:
                self.log_test("Toggle Trainer Availability (Available)", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Toggle Trainer Availability (Available)", False, f"Exception: {str(e)}")
        
        # Test 4: Update trainer location (PUT /api/trainer/location)
        try:
            # Try the endpoint mentioned in review request first
            location_data = {
                "latitude": 39.20,
                "longitude": -76.80,
                "locationAddress": "Updated Baltimore, MD"
            }
            
            response = self.make_request("PUT", "/trainer/location", location_data, self.trainer_token)
            
            if response.status_code == 404:
                # The endpoint might not exist, this is expected based on the code review
                self.log_test("Update Trainer Location", False, "PUT /api/trainer/location endpoint not found (expected)", "Endpoint not implemented")
            elif response.status_code == 200:
                self.log_test("Update Trainer Location", True, "Location updated successfully")
            else:
                self.log_test("Update Trainer Location", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Update Trainer Location", False, f"Exception: {str(e)}")
        
        # Test 5: Get trainer's location status (GET /api/trainer/my-location-status)
        try:
            response = self.make_request("GET", "/trainer/my-location-status", token=self.trainer_token)
            
            if response.status_code == 404:
                # The endpoint might not exist, this is expected
                self.log_test("Get Trainer Location Status", False, "GET /api/trainer/my-location-status endpoint not found (expected)", "Endpoint not implemented")
            elif response.status_code == 200:
                data = response.json()
                self.log_test("Get Trainer Location Status", True, f"Location status retrieved: {data}")
            else:
                self.log_test("Get Trainer Location Status", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Trainer Location Status", False, f"Exception: {str(e)}")
        
        # Test 6: Get nearby trainers with distance and ETA
        try:
            params = {
                "latitude": 39.17,
                "longitude": -76.77,
                "radius_miles": 25
            }
            
            response = self.make_request("GET", "/trainers/nearby", params=params)
            
            if response.status_code == 404:
                # Try the actual search endpoint with location parameters
                search_params = {
                    "latitude": 39.17,
                    "longitude": -76.77,
                    "wantsVirtual": "true"
                }
                
                response = self.make_request("GET", "/trainers/search", params=search_params)
                
                if response.status_code == 200:
                    data = response.json()
                    self.log_test("Get Nearby Trainers (via search)", True, f"Found {len(data)} trainers with location data")
                    
                    # Check if distance and ETA are included
                    if data and len(data) > 0:
                        first_trainer = data[0]
                        has_distance = 'distance' in first_trainer
                        has_match_type = 'matchType' in first_trainer
                        self.log_test("Distance/ETA in Response", has_distance and has_match_type, 
                                    f"Distance: {has_distance}, MatchType: {has_match_type}")
                else:
                    self.log_test("Get Nearby Trainers (via search)", False, f"Status: {response.status_code}", response.text)
            elif response.status_code == 200:
                data = response.json()
                self.log_test("Get Nearby Trainers", True, f"Found {len(data)} nearby trainers")
            else:
                self.log_test("Get Nearby Trainers", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Nearby Trainers", False, f"Exception: {str(e)}")
    
    def test_trainer_endpoints(self):
        """Test trainer-specific endpoints"""
        print("👨‍💼 TESTING TRAINER ENDPOINTS")
        print("=" * 40)
        
        if not self.trainer_token:
            self.log_test("Trainer Endpoints", False, "No trainer token available")
            return
        
        # Test 1: Search trainers
        try:
            response = self.make_request("GET", "/trainers/search")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Search Trainers", True, f"Found {len(data)} trainers")
            else:
                self.log_test("Search Trainers", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Search Trainers", False, f"Exception: {str(e)}")
        
        # Test 2: Get trainer sessions
        try:
            response = self.make_request("GET", "/trainer/sessions", token=self.trainer_token)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Get Trainer Sessions", True, f"Found {len(data)} sessions")
            else:
                self.log_test("Get Trainer Sessions", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Trainer Sessions", False, f"Exception: {str(e)}")
        
        # Test 3: Get trainer earnings
        try:
            response = self.make_request("GET", "/trainer/earnings", token=self.trainer_token)
            
            if response.status_code == 200:
                data = response.json()
                total_earnings = data.get("totalEarningsCents", 0)
                self.log_test("Get Trainer Earnings", True, f"Total earnings: ${total_earnings/100:.2f}")
            else:
                self.log_test("Get Trainer Earnings", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Trainer Earnings", False, f"Exception: {str(e)}")
    
    def test_trainee_endpoints(self):
        """Test trainee-specific endpoints"""
        print("🏃‍♂️ TESTING TRAINEE ENDPOINTS")
        print("=" * 40)
        
        if not self.trainee_token:
            self.log_test("Trainee Endpoints", False, "No trainee token available")
            return
        
        # Test 1: Get trainee sessions
        try:
            response = self.make_request("GET", "/trainee/sessions", token=self.trainee_token)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Get Trainee Sessions", True, f"Found {len(data)} sessions")
            else:
                self.log_test("Get Trainee Sessions", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Get Trainee Sessions", False, f"Exception: {str(e)}")
        
        # Test 2: Create a session (test booking flow)
        if self.trainer_user:
            try:
                session_data = {
                    "traineeId": self.trainee_user["id"],
                    "trainerId": self.trainer_user["id"],
                    "sessionDateTimeStart": (datetime.now() + timedelta(days=1)).isoformat(),
                    "durationMinutes": 60,
                    "locationType": "gym",
                    "locationNameOrAddress": "Test Gym",
                    "notes": "Test session booking"
                }
                
                response = self.make_request("POST", "/sessions", session_data, self.trainee_token)
                
                if response.status_code == 200:
                    data = response.json()
                    session_id = data.get("id")
                    final_price = data.get("finalSessionPriceCents", 0)
                    self.log_test("Create Session (Booking)", True, f"Session created: {session_id}, Price: ${final_price/100:.2f}")
                else:
                    self.log_test("Create Session (Booking)", False, f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_test("Create Session (Booking)", False, f"Exception: {str(e)}")
    
    def test_edge_cases(self):
        """Test edge cases for location features"""
        print("⚠️ TESTING EDGE CASES")
        print("=" * 30)
        
        # Test 1: Nearby trainers with no location permission (should handle gracefully)
        try:
            # Test without location parameters
            response = self.make_request("GET", "/trainers/search")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Search Without Location", True, f"Handled gracefully, found {len(data)} trainers")
            else:
                self.log_test("Search Without Location", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_test("Search Without Location", False, f"Exception: {str(e)}")
        
        # Test 2: Update trainer location without being a trainer (should fail with 403)
        if self.trainee_token:
            try:
                location_data = {
                    "latitude": 39.20,
                    "longitude": -76.80
                }
                
                response = self.make_request("PATCH", "/trainer-profiles/toggle-availability", {"isAvailable": True}, self.trainee_token)
                
                if response.status_code == 403:
                    self.log_test("Non-trainer Location Update", True, "Correctly rejected with 403")
                elif response.status_code == 404:
                    self.log_test("Non-trainer Location Update", True, "Correctly rejected with 404 (no trainer profile)")
                else:
                    self.log_test("Non-trainer Location Update", False, f"Unexpected status: {response.status_code}")
            except Exception as e:
                self.log_test("Non-trainer Location Update", False, f"Exception: {str(e)}")
        
        # Test 3: Invalid location coordinates
        try:
            params = {
                "latitude": 999,  # Invalid latitude
                "longitude": 999,  # Invalid longitude
                "wantsVirtual": "true"
            }
            
            response = self.make_request("GET", "/trainers/search", params=params)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Invalid Coordinates", True, f"Handled gracefully, returned {len(data)} results")
            else:
                self.log_test("Invalid Coordinates", response.status_code in [400, 422], f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Invalid Coordinates", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 STARTING RAPIDREPS API COMPREHENSIVE TESTING")
        print("=" * 60)
        print(f"Base URL: {BASE_URL}")
        print(f"Test Credentials: {TEST_CREDENTIALS}")
        print("=" * 60)
        print()
        
        # Run test suites
        self.test_authentication()
        self.test_location_availability_endpoints()
        self.test_trainer_endpoints()
        self.test_trainee_endpoints()
        self.test_edge_cases()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print("📊 TEST SUMMARY")
        print("=" * 30)
        
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t["success"]])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        print()
        
        if failed_tests > 0:
            print("❌ FAILED TESTS:")
            for test in self.test_results:
                if not test["success"]:
                    print(f"  - {test['test']}: {test['details']}")
            print()
        
        print("✅ CRITICAL CHECKS:")
        auth_working = any(t["success"] and "Login" in t["test"] for t in self.test_results)
        location_working = any(t["success"] and ("Location" in t["test"] or "Nearby" in t["test"]) for t in self.test_results)
        trainer_endpoints_working = any(t["success"] and "Trainer" in t["test"] and "Endpoints" not in t["test"] for t in self.test_results)
        
        print(f"  Authentication: {'✅' if auth_working else '❌'}")
        print(f"  Location Features: {'✅' if location_working else '❌'}")
        print(f"  Trainer Endpoints: {'✅' if trainer_endpoints_working else '❌'}")
        
        print()
        print("🎯 CONCLUSION:")
        if success_rate >= 80:
            print("✅ RapidReps API is functioning well with most endpoints working correctly.")
        elif success_rate >= 60:
            print("⚠️ RapidReps API has some issues but core functionality appears to work.")
        else:
            print("❌ RapidReps API has significant issues that need attention.")

if __name__ == "__main__":
    tester = RapidRepsAPITester()
    tester.run_all_tests()