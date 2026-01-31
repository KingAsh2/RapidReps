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
    
    def run_authentication_tests(self):
        """Run all authentication tests as requested in the review"""
        print("🚀 STARTING AUTHENTICATION API TESTS")
        print("=" * 60)
        print(f"Backend URL: {BASE_URL}")
        print("Testing Authentication Endpoints:")
        print("1. POST /api/auth/login - Valid credentials, invalid email, wrong password")
        print("2. POST /api/auth/signup - Valid data, duplicate email")
        print("3. GET /api/auth/me - With token from login")
        print("=" * 60)
        print()
        
        tests = [
            self.test_login_valid_credentials,
            self.test_login_invalid_email,
            self.test_login_wrong_password,
            self.test_signup_valid_data,
            self.test_signup_duplicate_email,
            self.test_get_me_with_token
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            if test():
                passed += 1
        
        print("=" * 60)
        print(f"📊 AUTHENTICATION TEST SUMMARY")
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        print("=" * 60)
        
        if passed == total:
            print("🎉 ALL AUTHENTICATION TESTS PASSED!")
            print("✅ Login API working correctly with valid/invalid credentials")
            print("✅ Signup API working correctly with valid data and duplicate detection")
            print("✅ Get Me API working correctly with JWT token")
        else:
            print(f"⚠️  {total - passed} test(s) failed - see details above")
            
            # Print failed tests
            failed_tests = [t for t in self.test_results if not t["success"]]
            if failed_tests:
                print("\n❌ FAILED TESTS:")
                for test in failed_tests:
                    print(f"  - {test['test']}: {test['details']}")
        
        return passed, total, self.test_results

if __name__ == "__main__":
    tester = AuthenticationTester()
    passed, total, results = tester.run_authentication_tests()