#!/usr/bin/env python3
"""
RapidReps Virtual Training Session Flow Testing
Testing the NEW /api/virtual-sessions/request endpoint
"""

import requests
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import uuid

# Backend URL
BACKEND_URL = 'https://trainer-connect-24.preview.emergentagent.com'
API_BASE = f"{BACKEND_URL}/api"

class VirtualSessionTester:
    def __init__(self):
        self.session = requests.Session()
        self.trainer_token = None
        self.trainee_token = None
        self.trainer_user_id = None
        self.trainee_user_id = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    Details: {details}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, token: str = None) -> requests.Response:
        """Make HTTP request with optional authentication"""
        url = f"{API_BASE}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
            
        try:
            if method.upper() == 'GET':
                return self.session.get(url, headers=headers, params=data)
            elif method.upper() == 'POST':
                return self.session.post(url, json=data, headers=headers)
            elif method.upper() == 'PATCH':
                return self.session.patch(url, json=data, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
        except Exception as e:
            print(f"Request error: {e}")
            return None
            
    def setup_test_users(self):
        """Create test trainer and trainee users"""
        print("\n🔧 Setting up test users for virtual session testing...")
        
        # Generate unique identifiers
        timestamp = str(int(datetime.now().timestamp()))
        
        # Create virtual trainer
        trainer_data = {
            "fullName": "Virtual Trainer Mike",
            "email": f"virtual.trainer.{timestamp}@test.com",
            "phone": f"+123456{timestamp[-4:]}",
            "password": "testpass123",
            "roles": ["trainer"]
        }
        
        response = self.make_request('POST', '/auth/signup', trainer_data)
        if response and response.status_code == 200:
            result = response.json()
            self.trainer_token = result['access_token']
            self.trainer_user_id = result['user']['id']
            self.log_test("Virtual Trainer Signup", True, f"User ID: {self.trainer_user_id}")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Virtual Trainer Signup", False, f"Status: {response.status_code if response else 'None'}, Response: {error_msg}")
            return False
            
        # Create trainee
        trainee_data = {
            "fullName": "Virtual Trainee Sarah",
            "email": f"virtual.trainee.{timestamp}@test.com",
            "phone": f"+123457{timestamp[-4:]}",
            "password": "testpass123",
            "roles": ["trainee"]
        }
        
        response = self.make_request('POST', '/auth/signup', trainee_data)
        if response and response.status_code == 200:
            result = response.json()
            self.trainee_token = result['access_token']
            self.trainee_user_id = result['user']['id']
            self.log_test("Virtual Trainee Signup", True, f"User ID: {self.trainee_user_id}")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Virtual Trainee Signup", False, f"Status: {response.status_code if response else 'None'}, Response: {error_msg}")
            return False
            
        return True
        
    def setup_virtual_trainer_profile(self):
        """Create trainer profile with virtual training enabled"""
        print("\n🔧 Setting up virtual trainer profile...")
        
        trainer_profile = {
            "userId": self.trainer_user_id,
            "bio": "Experienced virtual fitness trainer specializing in home workouts",
            "experienceYears": 5,
            "certifications": ["NASM-CPT", "Virtual Training Specialist"],
            "trainingStyles": ["HIIT", "Strength Training", "Yoga"],
            "offersInPerson": True,
            "offersVirtual": True,  # KEY: Must offer virtual
            "isAvailable": True,    # KEY: Must be available
            "isVirtualTrainingAvailable": True,  # KEY: Virtual training available
            "ratePerMinuteCents": 175,  # $1.75/min
            "latitude": 40.7128,
            "longitude": -74.0060,
            "locationAddress": "New York, NY",
            "videoCallPreference": "zoom",
            "zoomMeetingLink": "https://zoom.us/j/123456789"
        }
        
        response = self.make_request('POST', '/trainer-profiles', trainer_profile, self.trainer_token)
        if response and response.status_code == 200:
            result = response.json()
            self.log_test("Virtual Trainer Profile Creation", True, 
                         f"Virtual Available: {result.get('isVirtualTrainingAvailable')}, Available: {result.get('isAvailable')}")
            return True
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Virtual Trainer Profile Creation", False, 
                         f"Status: {response.status_code if response else 'None'}, Response: {error_msg}")
            return False
            
    def setup_trainee_profile(self):
        """Create trainee profile"""
        print("\n🔧 Setting up trainee profile...")
        
        trainee_profile = {
            "userId": self.trainee_user_id,
            "fitnessGoals": "Weight loss and strength building",
            "currentFitnessLevel": "intermediate",
            "experienceLevel": "Some experience",
            "preferredTrainingStyles": ["HIIT", "Strength Training"],
            "prefersVirtual": True,
            "isVirtualEnabled": True,
            "budgetMinPerMinuteCents": 100,
            "budgetMaxPerMinuteCents": 300,
            "latitude": 40.7589,
            "longitude": -73.9851,
            "locationAddress": "Manhattan, NY"
        }
        
        response = self.make_request('POST', '/trainee-profiles', trainee_profile, self.trainee_token)
        if response and response.status_code == 200:
            result = response.json()
            self.log_test("Trainee Profile Creation", True, f"Virtual Enabled: {result.get('isVirtualEnabled')}")
            return True
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Trainee Profile Creation", False, 
                         f"Status: {response.status_code if response else 'None'}, Response: {error_msg}")
            return False
            
    def test_successful_virtual_session_request(self):
        """Test successful virtual session request with available trainer"""
        print("\n🧪 Testing successful virtual session request...")
        
        virtual_session_request = {
            "traineeId": self.trainee_user_id,
            "durationMinutes": 30,
            "paymentMethod": "mock",
            "notes": "Looking forward to my first virtual training session!"
        }
        
        response = self.make_request('POST', '/virtual-sessions/request', virtual_session_request, self.trainee_token)
        
        if response and response.status_code == 200:
            result = response.json()
            
            # Verify all required fields are present
            required_fields = ['sessionId', 'trainerId', 'trainerName', 'trainerRating', 
                             'sessionDateTimeStart', 'sessionDateTimeEnd', 'durationMinutes', 
                             'finalSessionPriceCents', 'status']
            
            missing_fields = [field for field in required_fields if field not in result]
            
            if missing_fields:
                self.log_test("Virtual Session Request - Response Fields", False, 
                             f"Missing fields: {missing_fields}")
                return None
            else:
                self.log_test("Virtual Session Request - Response Fields", True, "All required fields present")
            
            # Verify pricing ($18 for 30 minutes = 1800 cents)
            expected_price = 1800
            actual_price = result['finalSessionPriceCents']
            price_correct = actual_price == expected_price
            self.log_test("Virtual Session Pricing", price_correct, 
                         f"Expected: ${expected_price/100:.2f}, Actual: ${actual_price/100:.2f}")
            
            # Verify duration
            duration_correct = result['durationMinutes'] == 30
            self.log_test("Virtual Session Duration", duration_correct, 
                         f"Duration: {result['durationMinutes']} minutes")
            
            # Verify status is confirmed (auto-confirmed for virtual)
            status_correct = result['status'] == 'confirmed'
            self.log_test("Virtual Session Auto-Confirmation", status_correct, 
                         f"Status: {result['status']}")
            
            # Verify trainer matching
            trainer_matched = result['trainerId'] == self.trainer_user_id
            self.log_test("Virtual Trainer Matching", trainer_matched, 
                         f"Matched Trainer: {result['trainerName']}")
            
            # Verify zoom link is present
            zoom_link_present = 'zoomMeetingLink' in result and result['zoomMeetingLink'] is not None
            self.log_test("Zoom Meeting Link", zoom_link_present, 
                         f"Zoom Link: {result.get('zoomMeetingLink', 'None')}")
            
            return result
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Virtual Session Request", False, 
                         f"Status: {response.status_code if response else 'None'}, Response: {error_msg}")
            return None
            
    def test_virtual_session_details_verification(self, session_data):
        """Verify the created session details in database"""
        if not session_data:
            return
            
        print("\n🧪 Verifying virtual session details in database...")
        
        session_id = session_data['sessionId']
        response = self.make_request('GET', f'/sessions/{session_id}', token=self.trainee_token)
        
        if response and response.status_code == 200:
            session = response.json()
            
            # Verify session type is virtual
            is_virtual = session.get('locationType') == 'virtual'
            self.log_test("Session Type Verification", is_virtual, 
                         f"Location Type: {session.get('locationType')}")
            
            # Verify pricing breakdown
            base_price = session.get('baseSessionPriceCents', 0)
            platform_fee = session.get('platformFeeCents', 0)
            trainer_earnings = session.get('trainerEarningsCents', 0)
            
            # Expected: $18 base, $1.80 platform fee (10%), $16.20 trainer earnings
            expected_base = 1800
            expected_platform_fee = 180
            expected_trainer_earnings = 1620
            
            pricing_correct = (base_price == expected_base and 
                             platform_fee == expected_platform_fee and 
                             trainer_earnings == expected_trainer_earnings)
            
            self.log_test("Session Pricing Breakdown", pricing_correct, 
                         f"Base: ${base_price/100:.2f}, Fee: ${platform_fee/100:.2f}, Earnings: ${trainer_earnings/100:.2f}")
            
            # Verify payment status
            payment_status = session.get('paymentStatus')
            payment_id = session.get('paymentIntentId')
            
            payment_processed = payment_status == 'completed' and payment_id and payment_id.startswith('mock_payment_')
            self.log_test("Mock Payment Processing", payment_processed, 
                         f"Status: {payment_status}, ID: {payment_id}")
            
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Session Details Verification", False, 
                         f"Status: {response.status_code if response else 'None'}, Response: {error_msg}")
            
    def test_no_available_virtual_trainers(self):
        """Test error case when no virtual trainers are available"""
        print("\n🧪 Testing no available virtual trainers scenario...")
        
        # First, make our trainer unavailable
        response = self.make_request('PATCH', '/trainer-profiles/toggle-availability?isAvailable=false', 
                                   None, self.trainer_token)
        
        if not response or response.status_code != 200:
            self.log_test("Setup - Make Trainer Unavailable", False, 
                         f"Status: {response.status_code if response else 'None'}")
            return
            
        # Now try to request a virtual session
        virtual_session_request = {
            "traineeId": self.trainee_user_id,
            "durationMinutes": 30,
            "paymentMethod": "mock",
            "notes": "This should fail - no trainers available"
        }
        
        response = self.make_request('POST', '/virtual-sessions/request', virtual_session_request, self.trainee_token)
        
        # Should return 404 with appropriate error message
        if response and response.status_code == 404:
            error_data = response.json()
            expected_message = "No virtual trainers available at the moment"
            
            if expected_message in error_data.get('detail', ''):
                self.log_test("No Available Trainers Error", True, 
                             f"Correct error message: {error_data['detail']}")
            else:
                self.log_test("No Available Trainers Error", False, 
                             f"Unexpected error message: {error_data.get('detail')}")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("No Available Trainers Error", False, 
                         f"Expected 404, got {response.status_code if response else 'None'}: {error_msg}")
        
        # Restore trainer availability for other tests
        self.make_request('PATCH', '/trainer-profiles/toggle-availability?isAvailable=true', 
                         None, self.trainer_token)
        
    def run_all_tests(self):
        """Run all virtual session tests"""
        print("🚀 Starting Virtual Training Session Flow Tests")
        print("=" * 60)
        print(f"Backend URL: {API_BASE}")
        
        # Setup phase
        if not self.setup_test_users():
            print("❌ Failed to setup test users. Aborting tests.")
            return False
            
        if not self.setup_virtual_trainer_profile():
            print("❌ Failed to setup trainer profile. Aborting tests.")
            return False
            
        if not self.setup_trainee_profile():
            print("❌ Failed to setup trainee profile. Aborting tests.")
            return False
            
        # Core virtual session tests
        session_data = self.test_successful_virtual_session_request()
        self.test_virtual_session_details_verification(session_data)
        self.test_no_available_virtual_trainers()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 VIRTUAL SESSION TESTING SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = VirtualSessionTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 ALL VIRTUAL SESSION TESTS PASSED!")
    else:
        print("\n⚠️  SOME VIRTUAL SESSION TESTS FAILED!")
        
    exit(0 if success else 1)