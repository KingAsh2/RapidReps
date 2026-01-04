#!/usr/bin/env python3
"""
Supplementary Backend API Testing for specific endpoints mentioned in review request
Covers any gaps from the main test suite
"""

import requests
import json
import time
from datetime import datetime, timedelta
import uuid

# Configuration
BASE_URL = "https://rapid-fitness.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class SupplementaryTester:
    def __init__(self):
        self.results = {"total": 0, "passed": 0, "failed": 0, "details": []}
        self.trainer_token = None
        self.trainee_token = None
        self.trainer_id = None
        self.trainee_id = None
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        self.results["total"] += 1
        if success:
            self.results["passed"] += 1
            print(f"✅ {test_name}: PASS {details}")
        else:
            self.results["failed"] += 1
            print(f"❌ {test_name}: FAIL {details}")
        
        self.results["details"].append({
            "test": test_name,
            "success": success,
            "details": details
        })
    
    def make_request(self, method: str, endpoint: str, data: dict = None, auth_token: str = None):
        url = f"{BASE_URL}{endpoint}"
        headers = HEADERS.copy()
        
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "PATCH":
                response = requests.patch(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text}
            
            return response.status_code in [200, 201], response_data, response.status_code
        except Exception as e:
            return False, {"error": str(e)}, 0
    
    def setup_test_users(self):
        """Create test users for supplementary testing"""
        print("Setting up test users for supplementary testing...")
        
        # Create trainer
        trainer_data = {
            "fullName": "Supplementary Test Trainer",
            "email": f"supp_trainer_{uuid.uuid4().hex[:8]}@test.com",
            "phone": "+1555000001",
            "password": "testpass123",
            "roles": ["trainer"]
        }
        
        success, response, status = self.make_request("POST", "/auth/signup", trainer_data)
        if success:
            self.trainer_token = response["access_token"]
            self.trainer_id = response["user"]["id"]
            print(f"✅ Created trainer: {response['user']['email']}")
        else:
            print(f"❌ Failed to create trainer: {response}")
            return False
        
        # Create trainee
        trainee_data = {
            "fullName": "Supplementary Test Trainee",
            "email": f"supp_trainee_{uuid.uuid4().hex[:8]}@test.com",
            "phone": "+1555000002",
            "password": "testpass123",
            "roles": ["trainee"]
        }
        
        success, response, status = self.make_request("POST", "/auth/signup", trainee_data)
        if success:
            self.trainee_token = response["access_token"]
            self.trainee_id = response["user"]["id"]
            print(f"✅ Created trainee: {response['user']['email']}")
        else:
            print(f"❌ Failed to create trainee: {response}")
            return False
        
        return True
    
    def test_specific_authentication_endpoints(self):
        """Test specific authentication endpoints from review request"""
        print("\n=== Testing Specific Authentication Endpoints ===")
        
        # Test DELETE /api/auth/me (account deletion)
        success, response, status = self.make_request("DELETE", "/auth/me", auth_token=self.trainee_token)
        self.log_test("DELETE /api/auth/me (Account Deletion)", 
                     success and response.get("success"), 
                     f"Status: {status}, Response: {response}")
        
        # Re-create trainee since we deleted it
        trainee_data = {
            "fullName": "Supplementary Test Trainee 2",
            "email": f"supp_trainee2_{uuid.uuid4().hex[:8]}@test.com",
            "phone": "+1555000003",
            "password": "testpass123",
            "roles": ["trainee"]
        }
        
        success, response, status = self.make_request("POST", "/auth/signup", trainee_data)
        if success:
            self.trainee_token = response["access_token"]
            self.trainee_id = response["user"]["id"]
    
    def test_trainer_profile_specific_endpoints(self):
        """Test specific trainer profile endpoints"""
        print("\n=== Testing Specific Trainer Profile Endpoints ===")
        
        # Create trainer profile first
        profile_data = {
            "userId": self.trainer_id,
            "bio": "Supplementary test trainer",
            "experienceYears": 3,
            "certifications": ["NASM"],
            "trainingStyles": ["Strength Training"],
            "offersInPerson": True,
            "offersVirtual": True,
            "ratePerMinuteCents": 150,
            "latitude": 39.0,
            "longitude": -77.0,
            "isAvailable": True,
            "isVirtualTrainingAvailable": True
        }
        
        success, response, status = self.make_request("POST", "/trainer-profiles", profile_data, auth_token=self.trainer_token)
        
        # Test GET /api/trainer-profiles/{userId}
        success, response, status = self.make_request("GET", f"/trainer-profiles/{self.trainer_id}")
        self.log_test("GET /api/trainer-profiles/{userId}", 
                     success and "id" in response, 
                     f"Status: {status}, Profile ID: {response.get('id', 'N/A')}")
        
        # Test POST /api/trainer-profiles/upload-documents
        documents = ["doc1_base64", "doc2_base64"]
        success, response, status = self.make_request("POST", "/trainer-profiles/upload-documents", 
                                                     documents, auth_token=self.trainer_token)
        self.log_test("POST /api/trainer-profiles/upload-documents", 
                     success and response.get("success"), 
                     f"Status: {status}, Documents uploaded: {response.get('totalDocuments', 0)}")
        
        # Test PATCH /api/trainer-profiles/toggle-availability
        success, response, status = self.make_request("PATCH", "/trainer-profiles/toggle-availability?isAvailable=false", 
                                                     auth_token=self.trainer_token)
        self.log_test("PATCH /api/trainer-profiles/toggle-availability", 
                     success and response.get("success"), 
                     f"Status: {status}, Available: {response.get('isAvailable', 'N/A')}")
        
        # Test GET /api/trainer/achievements
        success, response, status = self.make_request("GET", "/trainer/achievements", auth_token=self.trainer_token)
        self.log_test("GET /api/trainer/achievements", 
                     success and "badges" in response, 
                     f"Status: {status}, Badges: {len(response.get('badges', []))}")
        
        # Test GET /api/trainers/search with filters
        search_params = "?latitude=39.0&longitude=-77.0&styles=Strength Training&minPrice=100&maxPrice=200"
        success, response, status = self.make_request("GET", f"/trainers/search{search_params}")
        self.log_test("GET /api/trainers/search (with filters)", 
                     success and isinstance(response, list), 
                     f"Status: {status}, Trainers found: {len(response) if isinstance(response, list) else 0}")
        
        # Test GET /api/trainers/{trainerId}/ratings
        success, response, status = self.make_request("GET", f"/trainers/{self.trainer_id}/ratings")
        self.log_test("GET /api/trainers/{trainerId}/ratings", 
                     success and isinstance(response, list), 
                     f"Status: {status}, Ratings: {len(response) if isinstance(response, list) else 0}")
    
    def test_trainee_profile_specific_endpoints(self):
        """Test specific trainee profile endpoints"""
        print("\n=== Testing Specific Trainee Profile Endpoints ===")
        
        # Create trainee profile
        profile_data = {
            "userId": self.trainee_id,
            "fitnessGoals": "Weight loss",
            "currentFitnessLevel": "beginner",
            "preferredTrainingStyles": ["Cardio"],
            "budgetMinPerMinuteCents": 100,
            "budgetMaxPerMinuteCents": 200,
            "latitude": 39.1,
            "longitude": -77.1,
            "isVirtualEnabled": True
        }
        
        success, response, status = self.make_request("POST", "/trainee-profiles", profile_data, auth_token=self.trainee_token)
        
        # Test GET /api/trainee-profiles/{userId}
        success, response, status = self.make_request("GET", f"/trainee-profiles/{self.trainee_id}")
        self.log_test("GET /api/trainee-profiles/{userId}", 
                     success and "id" in response, 
                     f"Status: {status}, Profile ID: {response.get('id', 'N/A')}")
        
        # Test GET /api/trainee/achievements
        success, response, status = self.make_request("GET", "/trainee/achievements", auth_token=self.trainee_token)
        self.log_test("GET /api/trainee/achievements", 
                     success and "badges" in response, 
                     f"Status: {status}, Badges: {len(response.get('badges', []))}")
    
    def test_session_management_specific_endpoints(self):
        """Test specific session management endpoints"""
        print("\n=== Testing Specific Session Management Endpoints ===")
        
        # Create a session first
        session_data = {
            "traineeId": self.trainee_id,
            "trainerId": self.trainer_id,
            "sessionDateTimeStart": (datetime.now() + timedelta(days=1)).isoformat(),
            "durationMinutes": 45,
            "locationType": "gym",
            "locationNameOrAddress": "Test Gym"
        }
        
        success, response, status = self.make_request("POST", "/sessions", session_data, auth_token=self.trainee_token)
        session_id = response.get("id") if success else None
        
        if session_id:
            # Test GET /api/sessions/{sessionId}
            success, response, status = self.make_request("GET", f"/sessions/{session_id}")
            self.log_test("GET /api/sessions/{sessionId}", 
                         success and "id" in response, 
                         f"Status: {status}, Session status: {response.get('status', 'N/A')}")
            
            # Test GET /api/trainer/sessions with status filter
            success, response, status = self.make_request("GET", "/trainer/sessions?status=requested", 
                                                         auth_token=self.trainer_token)
            self.log_test("GET /api/trainer/sessions (with status filter)", 
                         success and isinstance(response, list), 
                         f"Status: {status}, Sessions: {len(response) if isinstance(response, list) else 0}")
            
            # Test GET /api/trainee/sessions with status filter
            success, response, status = self.make_request("GET", "/trainee/sessions?status=requested", 
                                                         auth_token=self.trainee_token)
            self.log_test("GET /api/trainee/sessions (with status filter)", 
                         success and isinstance(response, list), 
                         f"Status: {status}, Sessions: {len(response) if isinstance(response, list) else 0}")
            
            # Test PATCH /api/sessions/{sessionId}/accept
            success, response, status = self.make_request("PATCH", f"/sessions/{session_id}/accept", 
                                                         auth_token=self.trainer_token)
            self.log_test("PATCH /api/sessions/{sessionId}/accept", 
                         success and response.get("status") == "confirmed", 
                         f"Status: {status}, Session status: {response.get('status', 'N/A')}")
            
            # Test PATCH /api/sessions/{sessionId}/complete
            success, response, status = self.make_request("PATCH", f"/sessions/{session_id}/complete", 
                                                         auth_token=self.trainer_token)
            self.log_test("PATCH /api/sessions/{sessionId}/complete", 
                         success and response.get("status") == "completed", 
                         f"Status: {status}, Session status: {response.get('status', 'N/A')}")
            
            # Test rating creation after completion
            rating_data = {
                "sessionId": session_id,
                "traineeId": self.trainee_id,
                "trainerId": self.trainer_id,
                "rating": 5,
                "reviewText": "Great session!"
            }
            
            success, response, status = self.make_request("POST", "/ratings", rating_data, auth_token=self.trainee_token)
            self.log_test("POST /api/ratings (create rating)", 
                         success and "id" in response, 
                         f"Status: {status}, Rating: {response.get('rating', 'N/A')} stars")
    
    def test_chat_messaging_specific_endpoints(self):
        """Test specific chat/messaging endpoints"""
        print("\n=== Testing Specific Chat/Messaging Endpoints ===")
        
        # Test POST /api/conversations (get or create)
        success, response, status = self.make_request("POST", f"/conversations?receiver_id={self.trainer_id}", 
                                                     auth_token=self.trainee_token)
        conversation_id = response.get("conversationId") if success else None
        self.log_test("POST /api/conversations (get or create)", 
                     success and "conversationId" in response, 
                     f"Status: {status}, Conversation ID: {conversation_id}")
        
        # Test GET /api/conversations (list all)
        success, response, status = self.make_request("GET", "/conversations", auth_token=self.trainee_token)
        self.log_test("GET /api/conversations (list all)", 
                     success and isinstance(response, list), 
                     f"Status: {status}, Conversations: {len(response) if isinstance(response, list) else 0}")
        
        # Test POST /api/messages (send message)
        message_data = {
            "receiverId": self.trainer_id,
            "content": "Hello trainer! Looking forward to our session."
        }
        
        success, response, status = self.make_request("POST", "/messages", message_data, auth_token=self.trainee_token)
        self.log_test("POST /api/messages (send message)", 
                     success and "id" in response, 
                     f"Status: {status}, Message ID: {response.get('id', 'N/A')}")
        
        # Test GET /api/conversations/{conversationId}/messages
        if conversation_id:
            success, response, status = self.make_request("GET", f"/conversations/{conversation_id}/messages", 
                                                         auth_token=self.trainee_token)
            self.log_test("GET /api/conversations/{conversationId}/messages", 
                         success and isinstance(response, list), 
                         f"Status: {status}, Messages: {len(response) if isinstance(response, list) else 0}")
    
    def test_safety_specific_endpoints(self):
        """Test specific safety endpoints"""
        print("\n=== Testing Specific Safety Endpoints ===")
        
        # Test POST /api/safety/report
        report_data = {
            "reportedUserId": self.trainer_id,
            "reason": "Test report",
            "context": "Supplementary testing",
            "contentType": "profile"
        }
        
        success, response, status = self.make_request("POST", "/safety/report", report_data, auth_token=self.trainee_token)
        self.log_test("POST /api/safety/report", 
                     success and response.get("success"), 
                     f"Status: {status}, Success: {response.get('success', False)}")
        
        # Test POST /api/safety/block/{userId}
        success, response, status = self.make_request("POST", f"/safety/block/{self.trainer_id}", 
                                                     auth_token=self.trainee_token)
        self.log_test("POST /api/safety/block/{userId}", 
                     success and response.get("success"), 
                     f"Status: {status}, Success: {response.get('success', False)}")
        
        # Test GET /api/safety/blocks
        success, response, status = self.make_request("GET", "/safety/blocks", auth_token=self.trainee_token)
        self.log_test("GET /api/safety/blocks", 
                     success and "blockedUserIds" in response, 
                     f"Status: {status}, Blocked users: {len(response.get('blockedUserIds', []))}")
        
        # Test DELETE /api/safety/block/{userId}
        success, response, status = self.make_request("DELETE", f"/safety/block/{self.trainer_id}", 
                                                     auth_token=self.trainee_token)
        self.log_test("DELETE /api/safety/block/{userId}", 
                     success and response.get("success"), 
                     f"Status: {status}, Success: {response.get('success', False)}")
    
    def test_virtual_session_specific_endpoints(self):
        """Test specific virtual session endpoints"""
        print("\n=== Testing Specific Virtual Session Endpoints ===")
        
        # Test POST /api/virtual-sessions/request
        virtual_request = {
            "traineeId": self.trainee_id,
            "durationMinutes": 30,
            "paymentMethod": "mock",
            "notes": "Supplementary test virtual session"
        }
        
        success, response, status = self.make_request("POST", "/virtual-sessions/request", virtual_request, 
                                                     auth_token=self.trainee_token)
        self.log_test("POST /api/virtual-sessions/request", 
                     success and "sessionId" in response, 
                     f"Status: {status}, Session ID: {response.get('sessionId', 'N/A')}")
    
    def test_error_handling_scenarios(self):
        """Test error handling scenarios"""
        print("\n=== Testing Error Handling Scenarios ===")
        
        # Test invalid credentials
        invalid_login = {
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        }
        
        success, response, status = self.make_request("POST", "/auth/login", invalid_login)
        self.log_test("Invalid credentials (401 expected)", 
                     not success and status == 401, 
                     f"Status: {status}, Expected: 401")
        
        # Test unauthorized access
        success, response, status = self.make_request("GET", "/trainer/achievements")
        self.log_test("Unauthorized access (401 expected)", 
                     not success and status == 401, 
                     f"Status: {status}, Expected: 401")
        
        # Test invalid session ID
        success, response, status = self.make_request("GET", "/sessions/invalid_session_id")
        self.log_test("Invalid session ID (400/404 expected)", 
                     not success and status in [400, 404, 500], 
                     f"Status: {status}, Expected: 400/404/500")
        
        # Test missing required fields
        incomplete_data = {"email": "incomplete@test.com"}
        success, response, status = self.make_request("POST", "/auth/signup", incomplete_data)
        self.log_test("Missing required fields (422 expected)", 
                     not success and status == 422, 
                     f"Status: {status}, Expected: 422")
    
    def run_supplementary_tests(self):
        """Run all supplementary tests"""
        print("🔍 STARTING SUPPLEMENTARY BACKEND API TESTING")
        print("="*60)
        
        if not self.setup_test_users():
            print("❌ Failed to setup test users. Aborting tests.")
            return
        
        # Run all test categories
        self.test_specific_authentication_endpoints()
        self.test_trainer_profile_specific_endpoints()
        self.test_trainee_profile_specific_endpoints()
        self.test_session_management_specific_endpoints()
        self.test_chat_messaging_specific_endpoints()
        self.test_safety_specific_endpoints()
        self.test_virtual_session_specific_endpoints()
        self.test_error_handling_scenarios()
        
        # Print results
        print("\n" + "="*60)
        print("🏁 SUPPLEMENTARY TEST RESULTS")
        print("="*60)
        print(f"Total Tests: {self.results['total']}")
        print(f"✅ Passed: {self.results['passed']}")
        print(f"❌ Failed: {self.results['failed']}")
        success_rate = (self.results['passed'] / self.results['total'] * 100) if self.results['total'] > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        failed_tests = [t for t in self.results['details'] if not t['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['details']}")
        else:
            print("\n🎉 ALL SUPPLEMENTARY TESTS PASSED!")
        
        print("="*60)

if __name__ == "__main__":
    tester = SupplementaryTester()
    tester.run_supplementary_tests()