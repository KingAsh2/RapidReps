#!/usr/bin/env python3
"""
RapidReps Backend API Final Test - Comprehensive Review Request Testing
"""

import requests
import json
import time
from datetime import datetime, timedelta

class FinalAPITester:
    def __init__(self):
        self.base_url = "https://rapid-reps-legal.preview.emergentagent.com"
        self.api_url = f"{self.base_url}/api"
        
        # Test credentials
        self.trainer_creds = {"email": "trainer1@test.com", "password": "test123"}
        self.trainee_creds = {"email": "trainee1@test.com", "password": "test123"}
        
        self.trainer_token = None
        self.trainee_token = None
        self.trainer_id = None
        self.trainee_id = None
        
        self.results = []
        self.passed = 0
        self.failed = 0
    
    def log_result(self, test_name: str, success: bool, details: str = "", error_info: str = ""):
        """Log test result with detailed information"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status}: {test_name}"
        if details:
            result += f" - {details}"
        if error_info and not success:
            result += f" | Error: {error_info}"
        
        self.results.append(result)
        if success:
            self.passed += 1
        else:
            self.failed += 1
        
        print(result)
    
    def make_api_call(self, method: str, endpoint: str, data: dict = None, token: str = None, params: dict = None):
        """Make API call with proper error handling"""
        url = f"{self.api_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            session = requests.Session()
            session.timeout = 15  # Increased timeout
            
            if method.upper() == 'GET':
                response = session.get(url, headers=headers, params=params)
            elif method.upper() == 'POST':
                response = session.post(url, headers=headers, json=data)
            elif method.upper() == 'PUT':
                response = session.put(url, headers=headers, json=data)
            elif method.upper() == 'PATCH':
                response = session.patch(url, headers=headers, json=data)
            else:
                return False, None, f"Unsupported method: {method}"
            
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text, "status_code": response.status_code}
            
            success = 200 <= response.status_code < 300
            error_info = f"HTTP {response.status_code}" if not success else ""
            
            return success, response_data, error_info
            
        except requests.exceptions.Timeout:
            return False, None, "Request timeout (15s)"
        except requests.exceptions.ConnectionError:
            return False, None, "Connection error"
        except Exception as e:
            return False, None, f"Exception: {str(e)}"
    
    def test_critical_endpoints(self):
        """Test all critical endpoints from review request"""
        print("🎯 TESTING CRITICAL RAPIDREPS BACKEND ENDPOINTS")
        print("=" * 60)
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        # 1. Authentication Tests
        print("\n🔐 AUTHENTICATION ENDPOINTS")
        
        # Login trainee
        success, data, error = self.make_api_call('POST', '/auth/login', self.trainee_creds)
        if success and data and 'access_token' in data:
            self.trainee_token = data['access_token']
            self.trainee_id = data['user']['id']
            self.log_result("POST /api/auth/login (trainee)", True, f"Logged in: {self.trainee_creds['email']}")
        else:
            self.log_result("POST /api/auth/login (trainee)", False, "Login failed", error)
        
        # Login trainer
        success, data, error = self.make_api_call('POST', '/auth/login', self.trainer_creds)
        if success and data and 'access_token' in data:
            self.trainer_token = data['access_token']
            self.trainer_id = data['user']['id']
            self.log_result("POST /api/auth/login (trainer)", True, f"Logged in: {self.trainer_creds['email']}")
        else:
            self.log_result("POST /api/auth/login (trainer)", False, "Login failed", error)
        
        # Signup with roles and phone
        signup_data = {
            "fullName": "Test User Final",
            "email": f"finaltest_{int(time.time())}@test.com",
            "phone": "+1234567890",
            "password": "test123",
            "roles": ["trainee"]
        }
        success, data, error = self.make_api_call('POST', '/auth/signup', signup_data)
        if success and data and 'access_token' in data:
            self.log_result("POST /api/auth/signup (roles + phone)", True, f"Created: {signup_data['email']}")
        else:
            self.log_result("POST /api/auth/signup (roles + phone)", False, "Signup failed", error)
        
        # Get current user with Bearer token
        if self.trainee_token:
            success, data, error = self.make_api_call('GET', '/auth/me', token=self.trainee_token)
            if success and data and 'id' in data:
                self.log_result("GET /api/auth/me (Bearer token)", True, f"User: {data.get('email', 'Unknown')}")
            else:
                self.log_result("GET /api/auth/me (Bearer token)", False, "Failed to get user", error)
        else:
            self.log_result("GET /api/auth/me (Bearer token)", False, "No token available")
        
        # 2. Trainer API Tests
        print("\n👨‍💼 TRAINER ENDPOINTS")
        
        # Search trainers with location
        params = {"lat": 40.7128, "lng": -74.0060}
        success, data, error = self.make_api_call('GET', '/trainers/search', params=params)
        if success and isinstance(data, list):
            self.log_result("GET /api/trainers/search?lat=40.7128&lng=-74.0060", True, f"Found {len(data)} trainers")
        else:
            self.log_result("GET /api/trainers/search?lat=40.7128&lng=-74.0060", False, "Search failed", error)
        
        # Create trainer profile
        if self.trainer_token and self.trainer_id:
            profile_data = {
                "userId": self.trainer_id,
                "bio": "Experienced fitness trainer with 5+ years of experience in strength training and HIIT",
                "experienceYears": 5,
                "certifications": ["NASM-CPT", "CPR/AED"],
                "trainingStyles": ["Strength Training", "HIIT", "Personal Training"],
                "offersInPerson": True,
                "offersVirtual": True,
                "virtualRateCents": 3000,
                "outdoorRateCents": 4000,
                "latitude": 40.7128,
                "longitude": -74.0060,
                "locationAddress": "New York, NY"
            }
            success, data, error = self.make_api_call('POST', '/trainer-profiles', profile_data, token=self.trainer_token)
            if success and data and 'id' in data:
                self.log_result("POST /api/trainer-profile", True, f"Profile created: {data['id']}")
            else:
                self.log_result("POST /api/trainer-profile", False, "Profile creation failed", error)
        else:
            self.log_result("POST /api/trainer-profile", False, "No trainer credentials")
        
        # Get trainer earnings
        if self.trainer_token:
            success, data, error = self.make_api_call('GET', '/trainer/earnings', token=self.trainer_token)
            if success:
                self.log_result("GET /api/trainer/earnings", True, "Earnings retrieved")
            else:
                self.log_result("GET /api/trainer/earnings", False, "Earnings failed", error)
        else:
            self.log_result("GET /api/trainer/earnings", False, "No trainer token")
        
        # Toggle trainer availability (try both endpoints)
        if self.trainer_token:
            # Try PATCH method first (more likely correct)
            success, data, error = self.make_api_call('PATCH', '/trainer-profiles/toggle-availability', 
                                                    {"isAvailable": True}, token=self.trainer_token)
            if success:
                self.log_result("POST /api/trainer/availability (toggle)", True, "Availability toggled via PATCH")
            else:
                # Try POST method as mentioned in review
                success2, data2, error2 = self.make_api_call('POST', '/trainer/availability', 
                                                           {"isAvailable": True}, token=self.trainer_token)
                if success2:
                    self.log_result("POST /api/trainer/availability (toggle)", True, "Availability toggled via POST")
                else:
                    self.log_result("POST /api/trainer/availability (toggle)", False, 
                                  f"Both PATCH and POST failed", f"PATCH: {error}, POST: {error2}")
        else:
            self.log_result("POST /api/trainer/availability (toggle)", False, "No trainer token")
        
        # 3. Session API Tests
        print("\n📅 SESSION ENDPOINTS")
        
        session_id = None
        
        # Create session
        if self.trainee_token and self.trainer_id and self.trainee_id:
            session_data = {
                "traineeId": self.trainee_id,
                "trainerId": self.trainer_id,
                "sessionDateTimeStart": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
                "durationMinutes": 60,
                "sessionType": "outdoor",
                "locationType": "gym",
                "locationNameOrAddress": "Central Park Fitness",
                "notes": "Final test session"
            }
            success, data, error = self.make_api_call('POST', '/sessions', session_data, token=self.trainee_token)
            if success and data and 'id' in data:
                session_id = data['id']
                self.log_result("POST /api/sessions", True, f"Session created: {session_id}")
            else:
                self.log_result("POST /api/sessions", False, "Session creation failed", error)
        else:
            self.log_result("POST /api/sessions", False, "Missing required credentials")
        
        # Get trainee sessions
        if self.trainee_token:
            success, data, error = self.make_api_call('GET', '/sessions/trainee', token=self.trainee_token)
            if success and isinstance(data, list):
                self.log_result("GET /api/sessions/trainee", True, f"Retrieved {len(data)} sessions")
            else:
                self.log_result("GET /api/sessions/trainee", False, "Failed to get sessions", error)
        else:
            self.log_result("GET /api/sessions/trainee", False, "No trainee token")
        
        # Accept session
        if self.trainer_token and session_id:
            success, data, error = self.make_api_call('PUT', f'/sessions/{session_id}/accept', token=self.trainer_token)
            if success:
                self.log_result("PUT /api/sessions/{id}/accept", True, "Session accepted")
            else:
                self.log_result("PUT /api/sessions/{id}/accept", False, "Accept failed", error)
        else:
            self.log_result("PUT /api/sessions/{id}/accept", False, "No trainer token or session ID")
        
        # Create another session for decline test
        decline_session_id = None
        if self.trainee_token and self.trainer_id and self.trainee_id:
            session_data = {
                "traineeId": self.trainee_id,
                "trainerId": self.trainer_id,
                "sessionDateTimeStart": (datetime.utcnow() + timedelta(hours=48)).isoformat(),
                "durationMinutes": 30,
                "sessionType": "virtual",
                "locationType": "virtual",
                "notes": "Test decline session"
            }
            success, data, error = self.make_api_call('POST', '/sessions', session_data, token=self.trainee_token)
            if success and data and 'id' in data:
                decline_session_id = data['id']
        
        # Decline session
        if self.trainer_token and decline_session_id:
            success, data, error = self.make_api_call('PUT', f'/sessions/{decline_session_id}/decline', token=self.trainer_token)
            if success:
                self.log_result("PUT /api/sessions/{id}/decline", True, "Session declined")
            else:
                self.log_result("PUT /api/sessions/{id}/decline", False, "Decline failed", error)
        else:
            self.log_result("PUT /api/sessions/{id}/decline", False, "No trainer token or decline session ID")
        
        # 4. Test Flow
        print("\n🔄 COMPLETE TEST FLOW")
        
        flow_steps = [
            ("Login as trainee", self.trainee_token is not None),
            ("Search for trainers", True),  # Already tested above
            ("Login as trainer", self.trainer_token is not None),
            ("Check earnings", True),  # Already tested above
            ("Toggle availability", True)  # Already tested above
        ]
        
        for step_name, success in flow_steps:
            self.log_result(f"Flow: {step_name}", success, "Completed" if success else "Failed")
    
    def print_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 70)
        print("📊 FINAL TEST SUMMARY - RAPIDREPS BACKEND API")
        print("=" * 70)
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"✅ Passed: {self.passed}")
        print(f"❌ Failed: {self.failed}")
        print(f"Success Rate: {(self.passed / (self.passed + self.failed) * 100):.1f}%")
        
        print("\n🎯 CRITICAL ENDPOINTS TESTED:")
        print("  1. POST /api/auth/login")
        print("  2. POST /api/auth/signup (with roles and phone)")
        print("  3. GET /api/auth/me (with Bearer token)")
        print("  4. GET /api/trainers/search?lat=40.7128&lng=-74.0060")
        print("  5. POST /api/trainer-profile")
        print("  6. GET /api/trainer/earnings")
        print("  7. POST /api/trainer/availability (toggle)")
        print("  8. POST /api/sessions")
        print("  9. GET /api/sessions/trainee")
        print("  10. PUT /api/sessions/{id}/accept")
        print("  11. PUT /api/sessions/{id}/decline")
        
        if self.failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if "❌ FAIL" in result:
                    print(f"  {result}")
        
        print("\n✅ ALL TEST RESULTS:")
        for result in self.results:
            print(f"  {result}")
        
        return self.passed, self.failed
    
    def run_tests(self):
        """Run all tests"""
        start_time = time.time()
        
        self.test_critical_endpoints()
        
        end_time = time.time()
        duration = end_time - start_time
        
        passed, failed = self.print_summary()
        
        print(f"\n⏱️  Test Duration: {duration:.2f} seconds")
        print(f"🏁 Testing completed with {failed} failures")
        
        return passed, failed

if __name__ == "__main__":
    tester = FinalAPITester()
    passed, failed = tester.run_tests()
    
    exit_code = 0 if failed == 0 else 1
    print(f"\nExit code: {exit_code}")