#!/usr/bin/env python3
"""
Comprehensive RapidReps Backend API Testing Suite
Pre-deployment validation for TestFlight

Tests all API categories as requested:
1. Authentication System
2. Trainer Features  
3. Trainee Features
4. Session Management
5. Virtual Training
6. Messaging System
7. Ratings
8. Safety Features
9. Health Checks
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

# Configuration
BASE_URL = "https://login-logo-rapdreps.preview.emergentagent.com/api"

# Test credentials from review request
TRAINER_CREDENTIALS = [
    {"email": "trainer1@test.com", "password": "test123"},
    {"email": "trainer2@test.com", "password": "test123"},
    {"email": "trainer3@test.com", "password": "test123"}
]

TRAINEE_CREDENTIALS = [
    {"email": "trainee1@test.com", "password": "test123"},
    {"email": "trainee2@test.com", "password": "test123"},
    {"email": "trainee3@test.com", "password": "test123"}
]

class ComprehensiveAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.tokens = {}
        self.user_ids = {}
        self.session_ids = []
        
    def log_test(self, category: str, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results with category"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} [{category}] {test_name}")
        if details:
            print(f"    Details: {details}")
        if not success and response_data:
            print(f"    Response: {response_data}")
        print()
        
        self.test_results.append({
            "category": category,
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

    def test_health_checks(self):
        """Test health check endpoints"""
        print("\n🏥 TESTING HEALTH CHECKS")
        print("=" * 50)
        
        # Root health check
        try:
            response = self.make_request("GET", "")  # Root endpoint
            success = response.status_code == 200
            self.log_test("Health", "Root health check", success, 
                         f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Health", "Root health check", False, f"Error: {str(e)}")
            
        # Health endpoint
        try:
            response = self.make_request("GET", "/health")
            success = response.status_code == 200
            self.log_test("Health", "Health endpoint", success,
                         f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Health", "Health endpoint", False, f"Error: {str(e)}")

    def test_authentication_system(self):
        """Test authentication system"""
        print("\n🔐 TESTING AUTHENTICATION SYSTEM")
        print("=" * 50)
        
        # Test login with valid credentials
        for i, creds in enumerate(TRAINER_CREDENTIALS[:1]):  # Test first trainer
            try:
                response = self.make_request("POST", "/auth/login", creds)
                if response.status_code == 200:
                    data = response.json()
                    if "access_token" in data and "user" in data:
                        self.tokens[f"trainer_{i+1}"] = data["access_token"]
                        self.user_ids[f"trainer_{i+1}"] = data["user"]["id"]
                        self.log_test("Auth", f"Trainer {i+1} login", True,
                                     f"Token received, User: {data['user']['fullName']}")
                    else:
                        self.log_test("Auth", f"Trainer {i+1} login", False,
                                     "Missing token or user in response")
                else:
                    self.log_test("Auth", f"Trainer {i+1} login", False,
                                 f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Auth", f"Trainer {i+1} login", False, f"Error: {str(e)}")
                
        # Test login with trainee credentials
        for i, creds in enumerate(TRAINEE_CREDENTIALS[:1]):  # Test first trainee
            try:
                response = self.make_request("POST", "/auth/login", creds)
                if response.status_code == 200:
                    data = response.json()
                    if "access_token" in data and "user" in data:
                        self.tokens[f"trainee_{i+1}"] = data["access_token"]
                        self.user_ids[f"trainee_{i+1}"] = data["user"]["id"]
                        self.log_test("Auth", f"Trainee {i+1} login", True,
                                     f"Token received, User: {data['user']['fullName']}")
                    else:
                        self.log_test("Auth", f"Trainee {i+1} login", False,
                                     "Missing token or user in response")
                else:
                    self.log_test("Auth", f"Trainee {i+1} login", False,
                                 f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Auth", f"Trainee {i+1} login", False, f"Error: {str(e)}")
                
        # Test invalid credentials
        try:
            invalid_creds = {"email": "invalid@test.com", "password": "wrongpass"}
            response = self.make_request("POST", "/auth/login", invalid_creds)
            success = response.status_code == 401
            self.log_test("Auth", "Invalid credentials rejection", success,
                         f"Status: {response.status_code} (expected 401)")
        except Exception as e:
            self.log_test("Auth", "Invalid credentials rejection", False, f"Error: {str(e)}")
            
        # Test signup with new user
        try:
            new_user = {
                "fullName": f"Test User {uuid.uuid4().hex[:8]}",
                "email": f"testuser_{uuid.uuid4().hex[:8]}@test.com",
                "phone": "+1234567890",
                "password": "testpass123",
                "roles": ["trainee"]
            }
            response = self.make_request("POST", "/auth/signup", new_user)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = "access_token" in data and "user" in data
            self.log_test("Auth", "New user signup", success,
                         f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Auth", "New user signup", False, f"Error: {str(e)}")
            
        # Test /auth/me endpoint
        if "trainer_1" in self.tokens:
            try:
                response = self.make_request("GET", "/auth/me", token=self.tokens["trainer_1"])
                success = response.status_code == 200
                if success:
                    data = response.json()
                    success = "id" in data and "email" in data
                self.log_test("Auth", "Get current user", success,
                             f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Auth", "Get current user", False, f"Error: {str(e)}")

    def test_trainer_features(self):
        """Test trainer-specific features"""
        print("\n👨‍💼 TESTING TRAINER FEATURES")
        print("=" * 50)
        
        if "trainer_1" not in self.tokens:
            self.log_test("Trainer", "All trainer tests", False, "No trainer token available")
            return
            
        token = self.tokens["trainer_1"]
        user_id = self.user_ids.get("trainer_1")
        
        # Get trainer profile
        if user_id:
            try:
                response = self.make_request("GET", f"/trainer-profiles/{user_id}")
                success = response.status_code == 200
                self.log_test("Trainer", "Get trainer profile", success,
                             f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Trainer", "Get trainer profile", False, f"Error: {str(e)}")
                
        # Create/update trainer profile
        if user_id:
            try:
                profile_data = {
                    "userId": user_id,
                    "bio": "Experienced fitness trainer for testing",
                    "experienceYears": 5,
                    "certifications": ["NASM", "CPR"],
                    "trainingStyles": ["Strength Training", "HIIT"],
                    "ratePerMinuteCents": 150,
                    "offersInPerson": True,
                    "offersVirtual": True,
                    "isVirtualTrainingAvailable": True,
                    "latitude": 39.0,
                    "longitude": -77.0,
                    "locationAddress": "Test City, Test State",
                    "isAvailable": True
                }
                
                response = self.make_request("POST", "/trainer-profiles", profile_data, token=token)
                success = response.status_code == 200
                self.log_test("Trainer", "Create/update profile", success,
                             f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Trainer", "Create/update profile", False, f"Error: {str(e)}")
                
        # Toggle availability
        try:
            # Send isAvailable as query parameter, not in params dict
            response = self.make_request("PATCH", "/trainer-profiles/toggle-availability?isAvailable=true", token=token)
            success = response.status_code == 200
            self.log_test("Trainer", "Toggle availability", success,
                         f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Trainer", "Toggle availability", False, f"Error: {str(e)}")
            
        # Search trainers
        try:
            params = {"latitude": "39.0", "longitude": "-77.0"}
            response = self.make_request("GET", "/trainers/search", params=params)
            success = response.status_code == 200
            count = 0
            if success:
                data = response.json()
                count = len(data) if isinstance(data, list) else 0
            self.log_test("Trainer", "Search trainers", success,
                         f"Status: {response.status_code}, Found: {count}")
        except Exception as e:
            self.log_test("Trainer", "Search trainers", False, f"Error: {str(e)}")
            
        # Get nearby trainers for trainees
        try:
            params = {"latitude": "39.0", "longitude": "-77.0"}
            response = self.make_request("GET", "/trainers/nearby", params=params)
            success = response.status_code == 200
            self.log_test("Trainer", "Nearby trainers", success,
                         f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Trainer", "Nearby trainers", False, f"Error: {str(e)}")
            
        # Get nearby trainees for trainer
        try:
            response = self.make_request("GET", "/trainers/nearby-trainees", token=token)
            success = response.status_code == 200
            self.log_test("Trainer", "Nearby trainees", success,
                         f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Trainer", "Nearby trainees", False, f"Error: {str(e)}")
            
        # Get trainer sessions
        try:
            response = self.make_request("GET", "/trainer/sessions", token=token)
            success = response.status_code == 200
            self.log_test("Trainer", "Get sessions", success,
                         f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Trainer", "Get sessions", False, f"Error: {str(e)}")
            
        # Get trainer earnings
        try:
            response = self.make_request("GET", "/trainer/earnings", token=token)
            success = response.status_code == 200
            self.log_test("Trainer", "Get earnings", success,
                         f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Trainer", "Get earnings", False, f"Error: {str(e)}")
            
        # Get trainer achievements
        try:
            response = self.make_request("GET", "/trainer/achievements", token=token)
            success = response.status_code == 200
            self.log_test("Trainer", "Get achievements", success,
                         f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Trainer", "Get achievements", False, f"Error: {str(e)}")

    def test_trainee_features(self):
        """Test trainee-specific features"""
        print("\n👤 TESTING TRAINEE FEATURES")
        print("=" * 50)
        
        if "trainee_1" not in self.tokens:
            self.log_test("Trainee", "All trainee tests", False, "No trainee token available")
            return
            
        token = self.tokens["trainee_1"]
        user_id = self.user_ids.get("trainee_1")
        
        # Get trainee profile
        if user_id:
            try:
                response = self.make_request("GET", f"/trainee-profiles/{user_id}")
                success = response.status_code == 200
                self.log_test("Trainee", "Get trainee profile", success,
                             f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Trainee", "Get trainee profile", False, f"Error: {str(e)}")
                
        # Create/update trainee profile
        if user_id:
            try:
                profile_data = {
                    "userId": user_id,
                    "fitnessGoals": "Weight loss and muscle building",
                    "currentFitnessLevel": "intermediate",
                    "experienceLevel": "Some experience",
                    "preferredTrainingStyles": ["Strength Training", "Cardio"],
                    "prefersInPerson": True,
                    "prefersVirtual": True,
                    "isVirtualEnabled": True,
                    "budgetMinPerMinuteCents": 100,
                    "budgetMaxPerMinuteCents": 200,
                    "latitude": 39.1,
                    "longitude": -77.1,
                    "locationAddress": "Test City, Test State"
                }
                
                response = self.make_request("POST", "/trainee-profiles", profile_data, token=token)
                success = response.status_code == 200
                self.log_test("Trainee", "Create/update profile", success,
                             f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Trainee", "Create/update profile", False, f"Error: {str(e)}")
                
        # Get trainee sessions
        try:
            response = self.make_request("GET", "/trainee/sessions", token=token)
            success = response.status_code == 200
            self.log_test("Trainee", "Get sessions", success,
                         f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Trainee", "Get sessions", False, f"Error: {str(e)}")
            
        # Get trainee achievements
        try:
            response = self.make_request("GET", "/trainee/achievements", token=token)
            success = response.status_code == 200
            self.log_test("Trainee", "Get achievements", success,
                         f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Trainee", "Get achievements", False, f"Error: {str(e)}")

    def test_session_management(self):
        """Test session booking and management"""
        print("\n📅 TESTING SESSION MANAGEMENT")
        print("=" * 50)
        
        if "trainer_1" not in self.tokens or "trainee_1" not in self.tokens:
            self.log_test("Sessions", "All session tests", False, "Missing trainer or trainee tokens")
            return
            
        trainer_token = self.tokens["trainer_1"]
        trainee_token = self.tokens["trainee_1"]
        trainer_id = self.user_ids.get("trainer_1")
        trainee_id = self.user_ids.get("trainee_1")
        
        if not trainer_id or not trainee_id:
            self.log_test("Sessions", "All session tests", False, "Missing user IDs")
            return
            
        # Create session booking
        try:
            session_data = {
                "traineeId": trainee_id,
                "trainerId": trainer_id,
                "sessionDateTimeStart": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
                "durationMinutes": 60,
                "locationType": "gym",
                "locationNameOrAddress": "Test Gym",
                "notes": "Test session booking"
            }
            
            response = self.make_request("POST", "/sessions", session_data, token=trainee_token)
            success = response.status_code == 200
            session_id = None
            if success:
                data = response.json()
                session_id = data.get("id")
                self.session_ids.append(session_id)
            self.log_test("Sessions", "Create session booking", success,
                         f"Status: {response.status_code}, Session ID: {session_id}")
                         
            # Test session accept (if session was created)
            if session_id:
                try:
                    response = self.make_request("PATCH", f"/sessions/{session_id}/accept", token=trainer_token)
                    success = response.status_code == 200
                    self.log_test("Sessions", "Accept session", success,
                                 f"Status: {response.status_code}")
                except Exception as e:
                    self.log_test("Sessions", "Accept session", False, f"Error: {str(e)}")
                    
                # Test session decline (create another session first)
                try:
                    session_data2 = session_data.copy()
                    session_data2["sessionDateTimeStart"] = (datetime.utcnow() + timedelta(hours=2)).isoformat()
                    response = self.make_request("POST", "/sessions", session_data2, token=trainee_token)
                    if response.status_code == 200:
                        session_id2 = response.json().get("id")
                        if session_id2:
                            response = self.make_request("PATCH", f"/sessions/{session_id2}/decline", token=trainer_token)
                            success = response.status_code == 200
                            self.log_test("Sessions", "Decline session", success,
                                         f"Status: {response.status_code}")
                except Exception as e:
                    self.log_test("Sessions", "Decline session", False, f"Error: {str(e)}")
                    
                # Test session completion
                try:
                    response = self.make_request("PATCH", f"/sessions/{session_id}/complete", token=trainer_token)
                    success = response.status_code == 200
                    self.log_test("Sessions", "Complete session", success,
                                 f"Status: {response.status_code}")
                except Exception as e:
                    self.log_test("Sessions", "Complete session", False, f"Error: {str(e)}")
                    
                # Test session cancel (create another session first)
                try:
                    session_data3 = session_data.copy()
                    session_data3["sessionDateTimeStart"] = (datetime.utcnow() + timedelta(hours=3)).isoformat()
                    response = self.make_request("POST", "/sessions", session_data3, token=trainee_token)
                    if response.status_code == 200:
                        session_id3 = response.json().get("id")
                        if session_id3:
                            response = self.make_request("PATCH", f"/sessions/{session_id3}/cancel", token=trainee_token)
                            success = response.status_code == 200
                            self.log_test("Sessions", "Cancel session", success,
                                         f"Status: {response.status_code}")
                except Exception as e:
                    self.log_test("Sessions", "Cancel session", False, f"Error: {str(e)}")
                    
        except Exception as e:
            self.log_test("Sessions", "Create session booking", False, f"Error: {str(e)}")

    def test_virtual_training(self):
        """Test virtual training features"""
        print("\n💻 TESTING VIRTUAL TRAINING")
        print("=" * 50)
        
        if "trainee_1" not in self.tokens:
            self.log_test("Virtual", "Virtual training test", False, "No trainee token available")
            return
            
        token = self.tokens["trainee_1"]
        trainee_id = self.user_ids.get("trainee_1")
        
        if not trainee_id:
            self.log_test("Virtual", "Virtual training test", False, "No trainee ID available")
            return
            
        # Request virtual session
        try:
            virtual_request = {
                "traineeId": trainee_id,
                "durationMinutes": 30,
                "paymentMethod": "mock",
                "notes": "Test virtual session request"
            }
            
            response = self.make_request("POST", "/virtual-sessions/request", virtual_request, token=token)
            success = response.status_code == 200
            if success:
                data = response.json()
                success = "sessionId" in data and "trainerId" in data
                session_id = data.get("sessionId")
                if session_id:
                    self.session_ids.append(session_id)
            self.log_test("Virtual", "Request virtual session", success,
                         f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Virtual", "Request virtual session", False, f"Error: {str(e)}")

    def test_messaging_system(self):
        """Test chat/messaging features"""
        print("\n💬 TESTING MESSAGING SYSTEM")
        print("=" * 50)
        
        if "trainer_1" not in self.tokens or "trainee_1" not in self.tokens:
            self.log_test("Messaging", "All messaging tests", False, "Missing trainer or trainee tokens")
            return
            
        trainer_token = self.tokens["trainer_1"]
        trainee_token = self.tokens["trainee_1"]
        trainer_id = self.user_ids.get("trainer_1")
        trainee_id = self.user_ids.get("trainee_1")
        
        if not trainer_id or not trainee_id:
            self.log_test("Messaging", "All messaging tests", False, "Missing user IDs")
            return
            
        # Create/get conversation
        try:
            # Send receiver_id as query parameter in the URL
            response = self.make_request("POST", f"/conversations?receiver_id={trainer_id}", token=trainee_token)
            success = response.status_code == 200
            conversation_id = None
            if success:
                data = response.json()
                conversation_id = data.get("conversationId")
            self.log_test("Messaging", "Create conversation", success,
                         f"Status: {response.status_code}")
                         
            # Send message
            if conversation_id:
                try:
                    message_data = {
                        "conversationId": conversation_id,
                        "receiverId": trainer_id,
                        "content": "Hello! I'd like to book a training session."
                    }
                    
                    response = self.make_request("POST", "/messages", message_data, token=trainee_token)
                    success = response.status_code == 200
                    self.log_test("Messaging", "Send message", success,
                                 f"Status: {response.status_code}")
                except Exception as e:
                    self.log_test("Messaging", "Send message", False, f"Error: {str(e)}")
                    
            # Get conversations
            try:
                response = self.make_request("GET", "/conversations", token=trainee_token)
                success = response.status_code == 200
                self.log_test("Messaging", "Get conversations", success,
                             f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Messaging", "Get conversations", False, f"Error: {str(e)}")
                
            # Get messages (if conversation exists)
            if conversation_id:
                try:
                    response = self.make_request("GET", f"/conversations/{conversation_id}/messages", token=trainee_token)
                    success = response.status_code == 200
                    self.log_test("Messaging", "Get messages", success,
                                 f"Status: {response.status_code}")
                except Exception as e:
                    self.log_test("Messaging", "Get messages", False, f"Error: {str(e)}")
                    
        except Exception as e:
            self.log_test("Messaging", "Create conversation", False, f"Error: {str(e)}")

    def test_ratings(self):
        """Test rating system"""
        print("\n⭐ TESTING RATINGS")
        print("=" * 50)
        
        if "trainer_1" not in self.tokens or "trainee_1" not in self.tokens:
            self.log_test("Ratings", "All rating tests", False, "Missing trainer or trainee tokens")
            return
            
        trainer_token = self.tokens["trainer_1"]
        trainee_token = self.tokens["trainee_1"]
        trainer_id = self.user_ids.get("trainer_1")
        trainee_id = self.user_ids.get("trainee_1")
        
        if not trainer_id or not trainee_id:
            self.log_test("Ratings", "All rating tests", False, "Missing user IDs")
            return
            
        # Get trainer ratings
        try:
            response = self.make_request("GET", f"/trainers/{trainer_id}/ratings")
            success = response.status_code == 200
            count = 0
            if success:
                data = response.json()
                count = len(data) if isinstance(data, list) else 0
            self.log_test("Ratings", "Get trainer ratings", success,
                         f"Status: {response.status_code}, Ratings: {count}")
        except Exception as e:
            self.log_test("Ratings", "Get trainer ratings", False, f"Error: {str(e)}")
            
        # Create rating (if we have a completed session)
        if self.session_ids:
            try:
                session_id = self.session_ids[0]  # Use first session
                rating_data = {
                    "sessionId": session_id,
                    "traineeId": trainee_id,
                    "trainerId": trainer_id,
                    "rating": 5,
                    "reviewText": "Excellent training session!"
                }
                
                response = self.make_request("POST", "/ratings", rating_data, token=trainee_token)
                success = response.status_code == 200
                self.log_test("Ratings", "Create rating", success,
                             f"Status: {response.status_code}")
            except Exception as e:
                self.log_test("Ratings", "Create rating", False, f"Error: {str(e)}")

    def test_safety_features(self):
        """Test safety and moderation features"""
        print("\n🛡️ TESTING SAFETY FEATURES")
        print("=" * 50)
        
        if "trainee_1" not in self.tokens:
            self.log_test("Safety", "All safety tests", False, "No trainee token available")
            return
            
        token = self.tokens["trainee_1"]
        
        # Test report user
        try:
            report_data = {
                "reportedUserId": "test_user_id_for_report",
                "reason": "Inappropriate behavior",
                "context": "Test safety report",
                "contentType": "profile"
            }
            
            response = self.make_request("POST", "/safety/report", report_data, token=token)
            success = response.status_code == 200
            self.log_test("Safety", "Report user", success,
                         f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Safety", "Report user", False, f"Error: {str(e)}")
            
        # Test block user
        try:
            response = self.make_request("POST", "/safety/block/test_user_id_for_block", token=token)
            success = response.status_code == 200
            self.log_test("Safety", "Block user", success,
                         f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Safety", "Block user", False, f"Error: {str(e)}")
            
        # Test get blocked users
        try:
            response = self.make_request("GET", "/safety/blocks", token=token)
            success = response.status_code == 200
            self.log_test("Safety", "Get blocked users", success,
                         f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Safety", "Get blocked users", False, f"Error: {str(e)}")

    def run_comprehensive_tests(self):
        """Run all comprehensive tests"""
        print("🚀 STARTING COMPREHENSIVE RAPIDREPS BACKEND API TESTING")
        print("Pre-deployment validation for TestFlight")
        print("=" * 80)
        print(f"Backend URL: {BASE_URL}")
        print(f"Test started at: {datetime.now().isoformat()}")
        print("=" * 80)
        
        # Run all test categories
        self.test_health_checks()
        self.test_authentication_system()
        self.test_trainer_features()
        self.test_trainee_features()
        self.test_session_management()
        self.test_virtual_training()
        self.test_messaging_system()
        self.test_ratings()
        self.test_safety_features()
        
        # Generate summary
        self.generate_summary()
        
    def generate_summary(self):
        """Generate comprehensive test summary"""
        print("\n" + "="*80)
        print("🎯 COMPREHENSIVE BACKEND API TEST RESULTS SUMMARY")
        print("="*80)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["success"]])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"📊 OVERALL RESULTS:")
        print(f"   Total Tests: {total_tests}")
        print(f"   Passed: {passed_tests} ✅")
        print(f"   Failed: {failed_tests} ❌")
        print(f"   Success Rate: {success_rate:.1f}%")
        
        # Group results by category
        categories = {}
        for result in self.test_results:
            cat = result["category"]
            if cat not in categories:
                categories[cat] = {"passed": 0, "failed": 0, "tests": []}
            if result["success"]:
                categories[cat]["passed"] += 1
            else:
                categories[cat]["failed"] += 1
            categories[cat]["tests"].append(result)
            
        print(f"\n📋 RESULTS BY CATEGORY:")
        for category, data in categories.items():
            total = data["passed"] + data["failed"]
            rate = (data["passed"] / total * 100) if total > 0 else 0
            status = "✅" if rate == 100 else "⚠️" if rate >= 80 else "❌"
            print(f"   {status} {category}: {data['passed']}/{total} ({rate:.1f}%)")
            
        # Show failed tests
        failed_results = [r for r in self.test_results if not r["success"]]
        if failed_results:
            print(f"\n❌ FAILED TESTS DETAILS:")
            for result in failed_results:
                print(f"   [{result['category']}] {result['test']}: {result['details']}")
        else:
            print(f"\n🎉 ALL TESTS PASSED! Backend is ready for TestFlight deployment.")
            
        # Deployment readiness assessment
        critical_categories = ["Auth", "Health"]
        critical_failures = [r for r in failed_results if r["category"] in critical_categories]
        
        if not critical_failures and success_rate >= 90:
            print(f"\n✅ DEPLOYMENT READY: {success_rate:.1f}% success rate with no critical failures")
        elif critical_failures:
            print(f"\n🚨 DEPLOYMENT BLOCKED: Critical failures in {[r['category'] for r in critical_failures]}")
        else:
            print(f"\n⚠️ DEPLOYMENT CAUTION: {success_rate:.1f}% success rate - review failures")
            
        print(f"\nTest completed at: {datetime.now().isoformat()}")
        print("="*80)

if __name__ == "__main__":
    tester = ComprehensiveAPITester()
    tester.run_comprehensive_tests()