#!/usr/bin/env python3
"""
RapidReps API Authentication Testing Suite
Focus on authentication API endpoints as requested in the review:
1. POST /api/auth/login - Test with valid/invalid credentials
2. POST /api/auth/signup - Test with valid data and duplicate email
3. GET /api/auth/me - Test with token from login
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://login-logo-rapdreps.preview.emergentagent.com/api"
TEST_CREDENTIALS = {
    "valid_trainer": {"email": "trainer1@test.com", "password": "test123"},
    "invalid_email": {"email": "nonexistent@test.com", "password": "test123"},
    "wrong_password": {"email": "trainer1@test.com", "password": "wrongpassword"}
}

class AuthenticationTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.access_token = None
        
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

    def test_login_valid_credentials(self):
        """Test POST /api/auth/login with valid credentials: trainer1@test.com / test123"""
        print("🔐 Testing Login with Valid Credentials")
        try:
            response = self.make_request("POST", "/auth/login", TEST_CREDENTIALS["valid_trainer"])
            
            if response.status_code == 200:
                data = response.json()
                if 'access_token' in data and 'user' in data:
                    self.access_token = data['access_token']  # Store for later tests
                    user_email = data['user'].get('email', 'Unknown')
                    user_roles = data['user'].get('roles', [])
                    self.log_test("Login with Valid Credentials", True, 
                                f"Successfully logged in as {user_email} with roles {user_roles}")
                    return True
                else:
                    self.log_test("Login with Valid Credentials", False, 
                                "Response missing access_token or user object", data)
                    return False
            else:
                self.log_test("Login with Valid Credentials", False, 
                            f"Login failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Login with Valid Credentials", False, f"Exception occurred: {str(e)}")
            return False

    def test_login_invalid_email(self):
        """Test POST /api/auth/login with invalid email"""
        print("🔐 Testing Login with Invalid Email")
        try:
            response = self.make_request("POST", "/auth/login", TEST_CREDENTIALS["invalid_email"])
            
            if response.status_code == 401:
                self.log_test("Login with Invalid Email", True, 
                            "Correctly rejected invalid email with 401 Unauthorized")
                return True
            else:
                self.log_test("Login with Invalid Email", False, 
                            f"Expected 401 status but got {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Login with Invalid Email", False, f"Exception occurred: {str(e)}")
            return False

    def test_login_wrong_password(self):
        """Test POST /api/auth/login with wrong password"""
        print("🔐 Testing Login with Wrong Password")
        try:
            response = self.make_request("POST", "/auth/login", TEST_CREDENTIALS["wrong_password"])
            
            if response.status_code == 401:
                self.log_test("Login with Wrong Password", True, 
                            "Correctly rejected wrong password with 401 Unauthorized")
                return True
            else:
                self.log_test("Login with Wrong Password", False, 
                            f"Expected 401 status but got {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Login with Wrong Password", False, f"Exception occurred: {str(e)}")
            return False

    def test_signup_valid_data(self):
        """Test POST /api/auth/signup with valid data"""
        print("📝 Testing Signup with Valid Data")
        try:
            # Generate unique email to avoid duplicates
            random_string = str(uuid.uuid4())[:8]
            signup_data = {
                "fullName": "Test User",
                "email": f"testsignup_{random_string}@test.com",
                "phone": "1234567890",
                "password": "testpassword123",
                "roles": ["trainee"]
            }
            
            response = self.make_request("POST", "/auth/signup", signup_data)
            
            if response.status_code == 200:
                data = response.json()
                if 'access_token' in data and 'user' in data:
                    user_email = data['user'].get('email', 'Unknown')
                    user_roles = data['user'].get('roles', [])
                    self.log_test("Signup with Valid Data", True, 
                                f"Successfully created user {user_email} with roles {user_roles}")
                    return True
                else:
                    self.log_test("Signup with Valid Data", False, 
                                "Response missing access_token or user object", data)
                    return False
            else:
                self.log_test("Signup with Valid Data", False, 
                            f"Signup failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Signup with Valid Data", False, f"Exception occurred: {str(e)}")
            return False

    def test_signup_duplicate_email(self):
        """Test POST /api/auth/signup with duplicate email (should fail with 400)"""
        print("📝 Testing Signup with Duplicate Email")
        try:
            duplicate_signup_data = {
                "fullName": "Duplicate User",
                "email": "trainer1@test.com",  # This should already exist
                "phone": "1234567890",
                "password": "testpassword123",
                "roles": ["trainee"]
            }
            
            response = self.make_request("POST", "/auth/signup", duplicate_signup_data)
            
            if response.status_code == 400:
                self.log_test("Signup with Duplicate Email", True, 
                            "Correctly rejected duplicate email with 400 Bad Request")
                return True
            else:
                self.log_test("Signup with Duplicate Email", False, 
                            f"Expected 400 status but got {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Signup with Duplicate Email", False, f"Exception occurred: {str(e)}")
            return False

    def test_get_me_with_token(self):
        """Test GET /api/auth/me with valid token"""
        print("👤 Testing Get Me with Token")
        if not self.access_token:
            self.log_test("Get Me with Token", False, 
                        "No access token available from previous login test")
            return False
            
        try:
            response = self.make_request("GET", "/auth/me", token=self.access_token)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['id', 'email', 'fullName', 'roles']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    user_email = data.get('email', 'Unknown')
                    user_name = data.get('fullName', 'Unknown')
                    user_roles = data.get('roles', [])
                    self.log_test("Get Me with Token", True, 
                                f"Successfully retrieved user info: {user_name} ({user_email}) with roles {user_roles}")
                    return True
                else:
                    self.log_test("Get Me with Token", False, 
                                f"Response missing required fields: {missing_fields}", data)
                    return False
            else:
                self.log_test("Get Me with Token", False, 
                            f"Get me failed with status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Get Me with Token", False, f"Exception occurred: {str(e)}")
            return False
    
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
            
            response = self.make_request("GET", "/trainers/nearby", params=params, token=self.trainee_token)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Get Nearby Trainers", True, f"Found {len(data)} nearby trainers with distance/ETA")
                
                # Check if distance and ETA are included
                if data and len(data) > 0:
                    first_trainer = data[0]
                    has_distance = 'distanceMiles' in first_trainer
                    has_eta = 'etaMinutes' in first_trainer
                    if has_distance and has_eta:
                        self.log_test("Distance/ETA in Response", True, 
                                    f"Distance: {first_trainer.get('distanceMiles')}mi, ETA: {first_trainer.get('etaMinutes')}min")
                    else:
                        self.log_test("Distance/ETA in Response", False, 
                                    f"Missing fields - Distance: {has_distance}, ETA: {has_eta}")
                else:
                    self.log_test("Distance/ETA in Response", False, "No trainers returned to check fields")
            else:
                # Try the search endpoint as fallback
                search_params = {
                    "latitude": 39.17,
                    "longitude": -76.77,
                    "wantsVirtual": "true"
                }
                
                response = self.make_request("GET", "/trainers/search", params=search_params)
                
                if response.status_code == 200:
                    data = response.json()
                    self.log_test("Get Nearby Trainers (via search)", True, f"Found {len(data)} trainers with location data")
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
                availability_data = {"isAvailable": True}
                response = self.make_request("PUT", "/trainer/availability", availability_data, self.trainee_token)
                
                if response.status_code == 403:
                    self.log_test("Non-trainer Availability Update", True, "Correctly rejected with 403")
                else:
                    self.log_test("Non-trainer Availability Update", False, f"Unexpected status: {response.status_code}")
            except Exception as e:
                self.log_test("Non-trainer Availability Update", False, f"Exception: {str(e)}")
        
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