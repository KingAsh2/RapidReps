#!/usr/bin/env python3
"""
RapidReps Chat/Messaging System Backend API Testing
Testing the new chat/messaging endpoints as requested
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Optional

# Configuration
BASE_URL = "https://workout-buddy-852.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class ChatTestRunner:
    def __init__(self):
        self.trainee_token = None
        self.trainer_token = None
        self.trainee_id = None
        self.trainer_id = None
        self.conversation_id = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append(f"{status} - {test_name}: {details}")
        print(f"{status} - {test_name}: {details}")
        
    def setup_test_users(self):
        """Create or login test users for chat testing"""
        print("\n🔧 SETTING UP TEST USERS...")
        
        # Test trainee credentials as specified
        trainee_email = "mobile@test.com"
        trainee_password = "test123"
        
        # Test trainer credentials
        trainer_email = "trainer@test.com"
        trainer_password = "test123"
        
        # Try to login trainee first
        try:
            response = requests.post(f"{BASE_URL}/auth/login", 
                                   json={"email": trainee_email, "password": trainee_password},
                                   headers=HEADERS)
            
            if response.status_code == 200:
                data = response.json()
                self.trainee_token = data["access_token"]
                self.trainee_id = data["user"]["id"]
                self.log_test("Trainee Login", True, f"Logged in as {trainee_email}")
            else:
                # Create trainee if login fails
                signup_data = {
                    "fullName": "Mobile Test User",
                    "email": trainee_email,
                    "phone": "+1234567890",
                    "password": trainee_password,
                    "roles": ["trainee"]
                }
                response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data, headers=HEADERS)
                if response.status_code == 200:
                    data = response.json()
                    self.trainee_token = data["access_token"]
                    self.trainee_id = data["user"]["id"]
                    self.log_test("Trainee Signup", True, f"Created trainee {trainee_email}")
                else:
                    self.log_test("Trainee Setup", False, f"Failed to create/login trainee: {response.text}")
                    return False
                    
        except Exception as e:
            self.log_test("Trainee Setup", False, f"Exception: {str(e)}")
            return False
            
        # Try to login trainer
        try:
            response = requests.post(f"{BASE_URL}/auth/login", 
                                   json={"email": trainer_email, "password": trainer_password},
                                   headers=HEADERS)
            
            if response.status_code == 200:
                data = response.json()
                self.trainer_token = data["access_token"]
                self.trainer_id = data["user"]["id"]
                self.log_test("Trainer Login", True, f"Logged in as {trainer_email}")
            else:
                # Create trainer if login fails
                signup_data = {
                    "fullName": "Test Trainer",
                    "email": trainer_email,
                    "phone": "+1234567891",
                    "password": trainer_password,
                    "roles": ["trainer"]
                }
                response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data, headers=HEADERS)
                if response.status_code == 200:
                    data = response.json()
                    self.trainer_token = data["access_token"]
                    self.trainer_id = data["user"]["id"]
                    self.log_test("Trainer Signup", True, f"Created trainer {trainer_email}")
                else:
                    self.log_test("Trainer Setup", False, f"Failed to create/login trainer: {response.text}")
                    return False
                    
        except Exception as e:
            self.log_test("Trainer Setup", False, f"Exception: {str(e)}")
            return False
            
        return True
        
    def test_create_conversation(self):
        """Test POST /api/conversations - Create or get conversation between two users"""
        print("\n📝 TESTING CONVERSATION CREATION...")
        
        try:
            # Create conversation from trainee to trainer
            auth_headers = {**HEADERS, "Authorization": f"Bearer {self.trainee_token}"}
            
            # Note: The endpoint expects receiver_id as a query parameter or in request body
            # Based on the backend code, it should be a query parameter
            response = requests.post(f"{BASE_URL}/conversations?receiver_id={self.trainer_id}", 
                                   headers=auth_headers)
            
            if response.status_code == 200:
                data = response.json()
                self.conversation_id = data.get("conversationId")
                self.log_test("Create Conversation", True, f"Created conversation ID: {self.conversation_id}")
                return True
            else:
                self.log_test("Create Conversation", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Create Conversation", False, f"Exception: {str(e)}")
            return False
            
    def test_send_messages(self):
        """Test POST /api/messages - Send messages back and forth"""
        print("\n💬 TESTING MESSAGE SENDING...")
        
        messages_to_send = [
            {"sender": "trainee", "content": "Hi! I'm interested in booking a training session."},
            {"sender": "trainer", "content": "Hello! I'd be happy to help. What are your fitness goals?"},
            {"sender": "trainee", "content": "I want to build muscle and improve my strength."},
            {"sender": "trainer", "content": "Great! I specialize in strength training. When would you like to schedule?"},
            {"sender": "trainee", "content": "How about tomorrow at 3 PM?"}
        ]
        
        sent_messages = []
        
        for i, msg_data in enumerate(messages_to_send):
            try:
                # Determine sender and receiver
                if msg_data["sender"] == "trainee":
                    token = self.trainee_token
                    receiver_id = self.trainer_id
                    sender_name = "Trainee"
                else:
                    token = self.trainer_token
                    receiver_id = self.trainee_id
                    sender_name = "Trainer"
                
                auth_headers = {**HEADERS, "Authorization": f"Bearer {token}"}
                
                message_payload = {
                    "receiverId": receiver_id,
                    "content": msg_data["content"]
                }
                
                response = requests.post(f"{BASE_URL}/messages", 
                                       json=message_payload,
                                       headers=auth_headers)
                
                if response.status_code == 200:
                    data = response.json()
                    sent_messages.append(data)
                    self.log_test(f"Send Message {i+1}", True, f"{sender_name}: '{msg_data['content'][:30]}...'")
                    time.sleep(0.5)  # Small delay between messages
                else:
                    self.log_test(f"Send Message {i+1}", False, f"Status: {response.status_code}, Response: {response.text}")
                    return False
                    
            except Exception as e:
                self.log_test(f"Send Message {i+1}", False, f"Exception: {str(e)}")
                return False
                
        return len(sent_messages) == len(messages_to_send)
        
    def test_get_conversations(self):
        """Test GET /api/conversations - Get all conversations for current user"""
        print("\n📋 TESTING GET CONVERSATIONS...")
        
        # Test for trainee
        try:
            auth_headers = {**HEADERS, "Authorization": f"Bearer {self.trainee_token}"}
            response = requests.get(f"{BASE_URL}/conversations", headers=auth_headers)
            
            if response.status_code == 200:
                data = response.json()
                conversations = data if isinstance(data, list) else []
                
                if len(conversations) > 0:
                    conv = conversations[0]
                    # Verify conversation structure
                    required_fields = ["id", "participants", "participantDetails", "unreadCount", "updatedAt"]
                    missing_fields = [field for field in required_fields if field not in conv]
                    
                    if not missing_fields:
                        # Check participant details
                        participant_details = conv.get("participantDetails", [])
                        has_trainer_details = any(self.trainer_id in p.get("id", "") for p in participant_details)
                        
                        self.log_test("Get Trainee Conversations", True, 
                                    f"Found {len(conversations)} conversation(s), unread: {conv.get('unreadCount', 0)}")
                        
                        if has_trainer_details:
                            self.log_test("Participant Details", True, "Trainer details included in conversation")
                        else:
                            self.log_test("Participant Details", False, "Trainer details missing")
                            
                    else:
                        self.log_test("Get Trainee Conversations", False, f"Missing fields: {missing_fields}")
                        return False
                else:
                    self.log_test("Get Trainee Conversations", False, "No conversations found")
                    return False
                    
            else:
                self.log_test("Get Trainee Conversations", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Trainee Conversations", False, f"Exception: {str(e)}")
            return False
            
        # Test for trainer
        try:
            auth_headers = {**HEADERS, "Authorization": f"Bearer {self.trainer_token}"}
            response = requests.get(f"{BASE_URL}/conversations", headers=auth_headers)
            
            if response.status_code == 200:
                data = response.json()
                conversations = data if isinstance(data, list) else []
                
                if len(conversations) > 0:
                    conv = conversations[0]
                    unread_count = conv.get("unreadCount", 0)
                    self.log_test("Get Trainer Conversations", True, 
                                f"Found {len(conversations)} conversation(s), unread: {unread_count}")
                    
                    # Verify trainer sees unread messages from trainee
                    if unread_count > 0:
                        self.log_test("Unread Count Update", True, f"Trainer has {unread_count} unread messages")
                    else:
                        self.log_test("Unread Count Update", False, "Expected unread messages for trainer")
                        
                else:
                    self.log_test("Get Trainer Conversations", False, "No conversations found for trainer")
                    return False
                    
            else:
                self.log_test("Get Trainer Conversations", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Trainer Conversations", False, f"Exception: {str(e)}")
            return False
            
        return True
        
    def test_get_messages(self):
        """Test GET /api/conversations/{conversation_id}/messages - Get messages in a conversation"""
        print("\n📨 TESTING GET MESSAGES...")
        
        if not self.conversation_id:
            self.log_test("Get Messages", False, "No conversation ID available")
            return False
            
        try:
            # Get messages as trainer (should mark them as read)
            auth_headers = {**HEADERS, "Authorization": f"Bearer {self.trainer_token}"}
            response = requests.get(f"{BASE_URL}/conversations/{self.conversation_id}/messages", 
                                  headers=auth_headers)
            
            if response.status_code == 200:
                messages = response.json()
                
                if len(messages) > 0:
                    # Verify message structure
                    msg = messages[0]
                    required_fields = ["id", "conversationId", "senderId", "receiverId", "content", "isRead", "createdAt"]
                    missing_fields = [field for field in required_fields if field not in msg]
                    
                    if not missing_fields:
                        # Check chronological order
                        is_chronological = True
                        for i in range(1, len(messages)):
                            prev_time = datetime.fromisoformat(messages[i-1]["createdAt"].replace('Z', '+00:00'))
                            curr_time = datetime.fromisoformat(messages[i]["createdAt"].replace('Z', '+00:00'))
                            if prev_time > curr_time:
                                is_chronological = False
                                break
                                
                        self.log_test("Get Messages", True, f"Retrieved {len(messages)} messages")
                        
                        if is_chronological:
                            self.log_test("Message Order", True, "Messages in chronological order")
                        else:
                            self.log_test("Message Order", False, "Messages not in chronological order")
                            
                        # Verify message content
                        trainee_messages = [m for m in messages if m["senderId"] == self.trainee_id]
                        trainer_messages = [m for m in messages if m["senderId"] == self.trainer_id]
                        
                        self.log_test("Message Storage", True, 
                                    f"Trainee sent {len(trainee_messages)}, Trainer sent {len(trainer_messages)}")
                        
                    else:
                        self.log_test("Get Messages", False, f"Missing fields: {missing_fields}")
                        return False
                        
                else:
                    self.log_test("Get Messages", False, "No messages found in conversation")
                    return False
                    
            else:
                self.log_test("Get Messages", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Get Messages", False, f"Exception: {str(e)}")
            return False
            
        return True
        
    def test_read_status_changes(self):
        """Test that read status changes when messages are fetched"""
        print("\n👁️ TESTING READ STATUS CHANGES...")
        
        try:
            # Check trainer's conversations again to see if unread count decreased
            auth_headers = {**HEADERS, "Authorization": f"Bearer {self.trainer_token}"}
            response = requests.get(f"{BASE_URL}/conversations", headers=auth_headers)
            
            if response.status_code == 200:
                conversations = response.json()
                
                if len(conversations) > 0:
                    conv = conversations[0]
                    unread_count = conv.get("unreadCount", 0)
                    
                    if unread_count == 0:
                        self.log_test("Read Status Update", True, "Unread count reset to 0 after fetching messages")
                    else:
                        self.log_test("Read Status Update", False, f"Unread count still {unread_count} after fetching")
                        
                else:
                    self.log_test("Read Status Update", False, "No conversations found")
                    return False
                    
            else:
                self.log_test("Read Status Update", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Read Status Update", False, f"Exception: {str(e)}")
            return False
            
        return True
        
    def test_access_control(self):
        """Test that only conversation participants can access messages"""
        print("\n🔒 TESTING ACCESS CONTROL...")
        
        if not self.conversation_id:
            self.log_test("Access Control", False, "No conversation ID available")
            return False
            
        try:
            # Create a third user to test unauthorized access
            third_user_email = "unauthorized@test.com"
            third_user_password = "test123"
            
            signup_data = {
                "fullName": "Unauthorized User",
                "email": third_user_email,
                "phone": "+1234567892",
                "password": third_user_password,
                "roles": ["trainee"]
            }
            
            response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data, headers=HEADERS)
            if response.status_code == 200:
                third_user_token = response.json()["access_token"]
                
                # Try to access conversation messages with unauthorized user
                auth_headers = {**HEADERS, "Authorization": f"Bearer {third_user_token}"}
                response = requests.get(f"{BASE_URL}/conversations/{self.conversation_id}/messages", 
                                      headers=auth_headers)
                
                if response.status_code == 403:
                    self.log_test("Access Control", True, "Unauthorized access properly blocked (403)")
                elif response.status_code == 404:
                    self.log_test("Access Control", True, "Unauthorized access properly blocked (404)")
                else:
                    self.log_test("Access Control", False, f"Unauthorized access allowed: {response.status_code}")
                    return False
                    
            else:
                self.log_test("Access Control", False, "Could not create third user for testing")
                return False
                
        except Exception as e:
            self.log_test("Access Control", False, f"Exception: {str(e)}")
            return False
            
        return True
        
    def run_all_tests(self):
        """Run all chat/messaging system tests"""
        print("🚀 STARTING RAPIDREPS CHAT/MESSAGING SYSTEM TESTS")
        print("=" * 60)
        
        # Setup
        if not self.setup_test_users():
            print("\n❌ SETUP FAILED - Cannot proceed with tests")
            return False
            
        # Run tests in sequence
        tests = [
            self.test_create_conversation,
            self.test_send_messages,
            self.test_get_conversations,
            self.test_get_messages,
            self.test_read_status_changes,
            self.test_access_control
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test_func in tests:
            if test_func():
                passed_tests += 1
            time.sleep(1)  # Brief pause between test groups
            
        # Summary
        print("\n" + "=" * 60)
        print("📊 CHAT/MESSAGING SYSTEM TEST SUMMARY")
        print("=" * 60)
        
        for result in self.test_results:
            print(result)
            
        success_rate = (passed_tests / total_tests) * 100
        print(f"\n🎯 OVERALL RESULT: {passed_tests}/{total_tests} test groups passed ({success_rate:.1f}%)")
        
        if success_rate >= 80:
            print("✅ CHAT/MESSAGING SYSTEM IS FUNCTIONAL")
        else:
            print("❌ CHAT/MESSAGING SYSTEM HAS CRITICAL ISSUES")
            
        return success_rate >= 80

if __name__ == "__main__":
    tester = ChatTestRunner()
    tester.run_all_tests()