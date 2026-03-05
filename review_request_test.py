#!/usr/bin/env python3
"""
RapidReps Backend API Testing - Review Request Specific Tests
Testing the exact endpoints mentioned in the review request
"""

import requests
import json
import time
from datetime import datetime, timedelta

class ReviewRequestTester:
    def __init__(self):
        self.base_url = "https://build-debug-7.preview.emergentagent.com"
        self.api_url = f"{self.base_url}/api"
        self.session = requests.Session()
        self.session.timeout = 30
        
        # Test credentials from review request
        self.trainer_creds = {"email": "trainer1@test.com", "password": "test123"}
        self.trainee_creds = {"email": "trainee1@test.com", "password": "test123"}
        
        self.trainer_token = None
        self.trainee_token = None
        self.trainer_id = None
        self.trainee_id = None
        
        self.test_results = []
        self.passed = 0
        self.failed = 0
    
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append(f"{status}: {test_name} - {details}")
        if success:
            self.passed += 1
        else:
            self.failed += 1
        print(f"{status}: {test_name}")
        if details:
            print(f"   {details}")
    
    def make_request(self, method: str, endpoint: str, data: dict = None, token: str = None, params: dict = None):
        """Make HTTP request"""
        url = f"{self.api_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=headers, params=params)
            elif method.upper() == 'POST':
                response = self.session.post(url, headers=headers, json=data)
            elif method.upper() == 'PUT':
                response = self.session.put(url, headers=headers, json=data)
            elif method.upper() == 'PATCH':
                response = self.session.patch(url, headers=headers, json=data)
            else:
                return None, {"error": f"Unsupported method: {method}"}
            
            try:
                return response, response.json()
            except:
                return response, {"text": response.text, "status_code": response.status_code}
        except Exception as e:
            return None, {"error": str(e)}
    
    def test_authentication_endpoints(self):
        """Test authentication endpoints from review request"""
        print("\n🔐 TESTING AUTHENTICATION ENDPOINTS (Review Request)")
        print("=" * 60)
        
        # 1. POST /api/auth/login (trainee)
        response, data = self.make_request('POST', '/auth/login', self.trainee_creds)
        if response and response.status_code == 200 and 'access_token' in data:
            self.trainee_token = data['access_token']
            self.trainee_id = data['user']['id']
            self.log_test("POST /api/auth/login (trainee)", True, f"Trainee logged in: {self.trainee_creds['email']}")
        else:
            self.log_test("POST /api/auth/login (trainee)", False, f"Status: {response.status_code if response else 'No response'}")
        
        # 2. POST /api/auth/login (trainer)
        response, data = self.make_request('POST', '/auth/login', self.trainer_creds)
        if response and response.status_code == 200 and 'access_token' in data:
            self.trainer_token = data['access_token']
            self.trainer_id = data['user']['id']
            self.log_test("POST /api/auth/login (trainer)", True, f"Trainer logged in: {self.trainer_creds['email']}")
        else:
            self.log_test("POST /api/auth/login (trainer)", False, f"Status: {response.status_code if response else 'No response'}")
        
        # 3. POST /api/auth/signup (with roles and phone)
        signup_data = {
            "fullName": "Test User Review",
            "email": f"reviewtest_{int(time.time())}@test.com",
            "phone": "+1234567890",
            "password": "test123",
            "roles": ["trainee"]
        }
        response, data = self.make_request('POST', '/auth/signup', signup_data)
        if response and response.status_code == 200 and 'access_token' in data:
            self.log_test("POST /api/auth/signup (roles + phone)", True, f"Account created: {signup_data['email']}")
        else:
            self.log_test("POST /api/auth/signup (roles + phone)", False, f"Status: {response.status_code if response else 'No response'}")
        
        # 4. GET /api/auth/me (with Bearer token)
        if self.trainee_token:
            response, data = self.make_request('GET', '/auth/me', token=self.trainee_token)
            if response and response.status_code == 200 and 'id' in data:
                self.log_test("GET /api/auth/me (Bearer token)", True, f"User retrieved: {data.get('email', 'Unknown')}")
            else:
                self.log_test("GET /api/auth/me (Bearer token)", False, f"Status: {response.status_code if response else 'No response'}")
        else:
            self.log_test("GET /api/auth/me (Bearer token)", False, "No trainee token available")
    
    def test_trainer_endpoints(self):
        """Test trainer endpoints from review request"""
        print("\n👨‍💼 TESTING TRAINER ENDPOINTS (Review Request)")
        print("=" * 60)
        
        # 1. GET /api/trainers/search?lat=40.7128&lng=-74.0060
        params = {"lat": 40.7128, "lng": -74.0060}
        response, data = self.make_request('GET', '/trainers/search', params=params)
        if response and response.status_code == 200 and isinstance(data, list):
            self.log_test("GET /api/trainers/search (lat/lng)", True, f"Found {len(data)} trainers")
        else:
            self.log_test("GET /api/trainers/search (lat/lng)", False, f"Status: {response.status_code if response else 'No response'}")
        
        # 2. POST /api/trainer-profile (create trainer profile)
        if self.trainer_token and self.trainer_id:
            profile_data = {
                "userId": self.trainer_id,
                "bio": "Experienced fitness trainer specializing in strength training and HIIT workouts",
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
            response, data = self.make_request('POST', '/trainer-profiles', profile_data, token=self.trainer_token)
            if response and response.status_code == 200 and 'id' in data:
                self.log_test("POST /api/trainer-profile (create)", True, f"Profile created: {data['id']}")
            else:
                self.log_test("POST /api/trainer-profile (create)", False, f"Status: {response.status_code if response else 'No response'}")
        else:
            self.log_test("POST /api/trainer-profile (create)", False, "No trainer token or ID available")
        
        # 3. GET /api/trainer/earnings
        if self.trainer_token:
            response, data = self.make_request('GET', '/trainer/earnings', token=self.trainer_token)
            if response and response.status_code == 200:
                self.log_test("GET /api/trainer/earnings", True, "Earnings data retrieved")
            else:
                self.log_test("GET /api/trainer/earnings", False, f"Status: {response.status_code if response else 'No response'}")
        else:
            self.log_test("GET /api/trainer/earnings", False, "No trainer token available")
        
        # 4. POST /api/trainer/availability (toggle availability)
        if self.trainer_token:
            # First try PATCH method (more likely for toggle)
            response, data = self.make_request('PATCH', '/trainer-profiles/toggle-availability', 
                                             {"isAvailable": True}, token=self.trainer_token)
            if response and response.status_code == 200:
                self.log_test("POST /api/trainer/availability (toggle)", True, "Availability toggled successfully")
            else:
                # Try POST method as mentioned in review
                response, data = self.make_request('POST', '/trainer/availability', 
                                                 {"isAvailable": True}, token=self.trainer_token)
                if response and response.status_code == 200:
                    self.log_test("POST /api/trainer/availability (toggle)", True, "Availability toggled successfully")
                else:
                    self.log_test("POST /api/trainer/availability (toggle)", False, f"Status: {response.status_code if response else 'No response'}")
        else:
            self.log_test("POST /api/trainer/availability (toggle)", False, "No trainer token available")
    
    def test_session_endpoints(self):
        """Test session endpoints from review request"""
        print("\n📅 TESTING SESSION ENDPOINTS (Review Request)")
        print("=" * 60)
        
        session_id = None
        
        # 1. POST /api/sessions (create a session)
        if self.trainee_token and self.trainer_id and self.trainee_id:
            session_data = {
                "traineeId": self.trainee_id,
                "trainerId": self.trainer_id,
                "sessionDateTimeStart": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
                "durationMinutes": 60,
                "sessionType": "outdoor",
                "locationType": "gym",
                "locationNameOrAddress": "Central Park Gym",
                "notes": "Review request test session"
            }
            response, data = self.make_request('POST', '/sessions', session_data, token=self.trainee_token)
            if response and response.status_code == 200 and 'id' in data:
                session_id = data['id']
                self.log_test("POST /api/sessions (create)", True, f"Session created: {session_id}")
            else:
                self.log_test("POST /api/sessions (create)", False, f"Status: {response.status_code if response else 'No response'}")
        else:
            self.log_test("POST /api/sessions (create)", False, "Missing required tokens or IDs")
        
        # 2. GET /api/sessions/trainee (get trainee's sessions)
        if self.trainee_token:
            response, data = self.make_request('GET', '/sessions/trainee', token=self.trainee_token)
            if response and response.status_code == 200 and isinstance(data, list):
                self.log_test("GET /api/sessions/trainee", True, f"Retrieved {len(data)} trainee sessions")
            else:
                self.log_test("GET /api/sessions/trainee", False, f"Status: {response.status_code if response else 'No response'}")
        else:
            self.log_test("GET /api/sessions/trainee", False, "No trainee token available")
        
        # 3. PUT /api/sessions/{id}/accept
        if self.trainer_token and session_id:
            response, data = self.make_request('PUT', f'/sessions/{session_id}/accept', token=self.trainer_token)
            if response and response.status_code == 200:
                self.log_test("PUT /api/sessions/{id}/accept", True, "Session accepted successfully")
            else:
                self.log_test("PUT /api/sessions/{id}/accept", False, f"Status: {response.status_code if response else 'No response'}")
        else:
            self.log_test("PUT /api/sessions/{id}/accept", False, "No trainer token or session ID available")
        
        # 4. PUT /api/sessions/{id}/decline (create another session first)
        decline_session_id = None
        if self.trainee_token and self.trainer_id and self.trainee_id:
            session_data = {
                "traineeId": self.trainee_id,
                "trainerId": self.trainer_id,
                "sessionDateTimeStart": (datetime.utcnow() + timedelta(hours=48)).isoformat(),
                "durationMinutes": 30,
                "sessionType": "virtual",
                "locationType": "virtual",
                "notes": "Test session for decline"
            }
            response, data = self.make_request('POST', '/sessions', session_data, token=self.trainee_token)
            if response and response.status_code == 200:
                decline_session_id = data.get('id')
        
        if self.trainer_token and decline_session_id:
            response, data = self.make_request('PUT', f'/sessions/{decline_session_id}/decline', token=self.trainer_token)
            if response and response.status_code == 200:
                self.log_test("PUT /api/sessions/{id}/decline", True, "Session declined successfully")
            else:
                self.log_test("PUT /api/sessions/{id}/decline", False, f"Status: {response.status_code if response else 'No response'}")
        else:
            self.log_test("PUT /api/sessions/{id}/decline", False, "No trainer token or decline session ID available")
    
    def test_complete_flow(self):
        """Test the complete flow described in review request"""
        print("\n🔄 TESTING COMPLETE FLOW (Review Request)")
        print("=" * 60)
        
        # Flow: Login as trainee → Search for trainers → Login as trainer → Check earnings → Toggle availability
        
        # 1. Login as trainee (already done)
        trainee_success = self.trainee_token is not None
        self.log_test("Flow Step 1: Login as trainee", trainee_success, 
                     "Trainee authenticated" if trainee_success else "Trainee login failed")
        
        # 2. Search for trainers
        if trainee_success:
            params = {"lat": 40.7128, "lng": -74.0060}
            response, data = self.make_request('GET', '/trainers/search', params=params)
            search_success = response and response.status_code == 200
            self.log_test("Flow Step 2: Search for trainers", search_success,
                         f"Found {len(data) if isinstance(data, list) else 0} trainers" if search_success else "Search failed")
        
        # 3. Login as trainer (already done)
        trainer_success = self.trainer_token is not None
        self.log_test("Flow Step 3: Login as trainer", trainer_success,
                     "Trainer authenticated" if trainer_success else "Trainer login failed")
        
        # 4. Check earnings
        if trainer_success:
            response, data = self.make_request('GET', '/trainer/earnings', token=self.trainer_token)
            earnings_success = response and response.status_code == 200
            self.log_test("Flow Step 4: Check earnings", earnings_success,
                         "Earnings retrieved" if earnings_success else "Earnings check failed")
        
        # 5. Toggle availability
        if trainer_success:
            response, data = self.make_request('PATCH', '/trainer-profiles/toggle-availability',
                                             {"isAvailable": False}, token=self.trainer_token)
            toggle_success = response and response.status_code == 200
            self.log_test("Flow Step 5: Toggle availability", toggle_success,
                         "Availability toggled" if toggle_success else "Toggle failed")
    
    def run_all_tests(self):
        """Run all tests from review request"""
        print("🎯 RAPIDREPS BACKEND API TESTING - REVIEW REQUEST SPECIFIC")
        print("=" * 70)
        print(f"Backend URL: {self.base_url}")
        print(f"Test Credentials: trainer1@test.com / trainee1@test.com")
        print("=" * 70)
        
        start_time = time.time()
        
        # Run test suites
        self.test_authentication_endpoints()
        self.test_trainer_endpoints()
        self.test_session_endpoints()
        self.test_complete_flow()
        
        # Print summary
        end_time = time.time()
        duration = end_time - start_time
        
        print("\n" + "=" * 70)
        print("📊 REVIEW REQUEST TEST SUMMARY")
        print("=" * 70)
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"✅ Passed: {self.passed}")
        print(f"❌ Failed: {self.failed}")
        print(f"Success Rate: {(self.passed / (self.passed + self.failed) * 100):.1f}%")
        print(f"Duration: {duration:.2f} seconds")
        
        if self.failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if "❌ FAIL" in result:
                    print(f"  {result}")
        
        print("\n✅ ALL TEST RESULTS:")
        for result in self.test_results:
            print(f"  {result}")
        
        return self.passed, self.failed

if __name__ == "__main__":
    tester = ReviewRequestTester()
    passed, failed = tester.run_all_tests()
    
    exit_code = 0 if failed == 0 else 1
    print(f"\n🏁 Review request testing completed with exit code: {exit_code}")