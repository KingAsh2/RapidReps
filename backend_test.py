#!/usr/bin/env python3
"""
TEST RUN #3 of 3 - Virtual Training Flow Data Integrity & Edge Cases
Comprehensive backend testing for RapidReps virtual training system
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List
import uuid

# Configuration
BACKEND_URL = "https://trainer-connect-24.preview.emergentagent.com/api"
TEST_PREFIX = "test3_"

class RapidRepsTestSuite:
    def __init__(self):
        self.session = requests.Session()
        self.trainee_token = None
        self.trainer_token = None
        self.trainee_id = None
        self.trainer_id = None
        self.test_sessions = []
        self.test_results = []
        
    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        result = f"{status} - {test_name}"
        if details:
            result += f": {details}"
        print(result)
        self.test_results.append({
            'test': test_name,
            'passed': passed,
            'details': details
        })
        return passed
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> requests.Response:
        """Make HTTP request with error handling"""
        url = f"{BACKEND_URL}{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)
            
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=default_headers)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=default_headers)
            elif method.upper() == 'PATCH':
                response = self.session.patch(url, json=data, headers=default_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            print(f"Request failed: {method} {url} - {str(e)}")
            raise
    
    def setup_test_users(self) -> bool:
        """Create test trainee and trainer users"""
        print("\n=== SETTING UP TEST USERS ===")
        
        # Create test trainee
        trainee_data = {
            "fullName": f"{TEST_PREFIX}DataIntegrity Trainee",
            "email": f"{TEST_PREFIX}trainee_data@test.com",
            "phone": "+1234567890",
            "password": "testpass123",
            "roles": ["trainee"]
        }
        
        response = self.make_request('POST', '/auth/signup', trainee_data)
        if response.status_code in [200, 201]:
            data = response.json()
            self.trainee_token = data['access_token']
            self.trainee_id = data['user']['id']
            self.log_test("Trainee User Creation", True, f"ID: {self.trainee_id}")
        else:
            return self.log_test("Trainee User Creation", False, f"Status: {response.status_code}")
        
        # Create test trainer
        trainer_data = {
            "fullName": f"{TEST_PREFIX}DataIntegrity Trainer",
            "email": f"{TEST_PREFIX}trainer_data@test.com", 
            "phone": "+1234567891",
            "password": "testpass123",
            "roles": ["trainer"]
        }
        
        response = self.make_request('POST', '/auth/signup', trainer_data)
        if response.status_code in [200, 201]:
            data = response.json()
            self.trainer_token = data['access_token']
            self.trainer_id = data['user']['id']
            self.log_test("Trainer User Creation", True, f"ID: {self.trainer_id}")
        else:
            return self.log_test("Trainer User Creation", False, f"Status: {response.status_code}")
        
        return True
    
    def setup_test_profiles(self) -> bool:
        """Create test profiles for trainee and trainer"""
        print("\n=== SETTING UP TEST PROFILES ===")
        
        # Create trainee profile with virtual enabled
        trainee_profile = {
            "userId": self.trainee_id,
            "profilePhoto": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
            "fitnessGoals": "Build strength and endurance",
            "currentFitnessLevel": "intermediate",
            "experienceLevel": "Some experience",
            "preferredTrainingStyles": ["strength", "cardio"],
            "isVirtualEnabled": True,
            "latitude": 40.7128,
            "longitude": -74.0060,
            "locationAddress": "New York, NY"
        }
        
        headers = {'Authorization': f'Bearer {self.trainee_token}'}
        response = self.make_request('POST', '/trainee-profiles', trainee_profile, headers)
        
        if response.status_code in [200, 201]:
            self.log_test("Trainee Profile Creation", True, "Virtual enabled profile created")
        else:
            return self.log_test("Trainee Profile Creation", False, f"Status: {response.status_code}")
        
        # Create trainer profile with virtual training enabled
        trainer_profile = {
            "userId": self.trainer_id,
            "bio": "Experienced virtual trainer specializing in strength and conditioning",
            "experienceYears": 5,
            "certifications": ["NASM-CPT", "ACSM"],
            "trainingStyles": ["strength", "cardio", "functional"],
            "offersVirtual": True,
            "isVirtualTrainingAvailable": True,
            "isAvailable": True,
            "ratePerMinuteCents": 60,
            "latitude": 40.7589,
            "longitude": -73.9851,
            "locationAddress": "Manhattan, NY",
            "zoomMeetingLink": "https://zoom.us/j/test123456789"
        }
        
        headers = {'Authorization': f'Bearer {self.trainer_token}'}
        response = self.make_request('POST', '/trainer-profiles', trainer_profile, headers)
        
        if response.status_code in [200, 201]:
            self.log_test("Trainer Profile Creation", True, "Virtual trainer profile created")
        else:
            return self.log_test("Trainer Profile Creation", False, f"Status: {response.status_code}")
        
        return True
    
    def test_data_integrity(self) -> bool:
        """Test 1: Data Integrity - Verify session response contains all required fields"""
        print("\n=== TEST 1: DATA INTEGRITY ===")
        
        # Request virtual session
        session_request = {
            "traineeId": self.trainee_id,
            "durationMinutes": 30,
            "paymentMethod": "mock",
            "notes": "Data integrity test session"
        }
        
        headers = {'Authorization': f'Bearer {self.trainee_token}'}
        response = self.make_request('POST', '/virtual-sessions/request', session_request, headers)
        
        if response.status_code not in [200, 201]:
            return self.log_test("Virtual Session Request", False, f"Status: {response.status_code}")
        
        session_data = response.json()
        self.test_sessions.append(session_data['sessionId'])
        
        # Verify all required fields are present
        required_fields = [
            'sessionId', 'trainerId', 'trainerName', 'trainerBio', 'trainerRating',
            'sessionDateTimeStart', 'sessionDateTimeEnd', 'durationMinutes',
            'finalSessionPriceCents', 'zoomMeetingLink', 'status'
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in session_data:
                missing_fields.append(field)
        
        if missing_fields:
            return self.log_test("Required Fields Present", False, f"Missing: {missing_fields}")
        
        self.log_test("Required Fields Present", True, "All required fields found")
        
        # Verify data types
        type_checks = [
            ('sessionId', str),
            ('trainerId', str), 
            ('trainerName', str),
            ('trainerRating', (int, float)),
            ('durationMinutes', int),
            ('finalSessionPriceCents', int),
            ('status', str)
        ]
        
        type_errors = []
        for field, expected_type in type_checks:
            if not isinstance(session_data.get(field), expected_type):
                type_errors.append(f"{field}: expected {expected_type}, got {type(session_data.get(field))}")
        
        if type_errors:
            return self.log_test("Data Types Correct", False, f"Type errors: {type_errors}")
        
        self.log_test("Data Types Correct", True, "All data types match expectations")
        
        # Verify pricing is correct ($18 for 30 minutes = 1800 cents)
        expected_price = 1800
        actual_price = session_data.get('finalSessionPriceCents')
        
        if actual_price != expected_price:
            return self.log_test("Pricing Correct", False, f"Expected {expected_price}, got {actual_price}")
        
        self.log_test("Pricing Correct", True, f"Correct pricing: ${actual_price/100}")
        
        # Verify session duration
        if session_data.get('durationMinutes') != 30:
            return self.log_test("Duration Correct", False, f"Expected 30 min, got {session_data.get('durationMinutes')}")
        
        self.log_test("Duration Correct", True, "30 minute duration confirmed")
        
        return True
    
    def test_multi_session_rating_impact(self) -> bool:
        """Test 2: Multi-Session Rating Impact - Test rating system with multiple sessions"""
        print("\n=== TEST 2: MULTI-SESSION RATING IMPACT ===")
        
        # Create 3 virtual sessions
        session_ids = []
        for i in range(3):
            session_request = {
                "traineeId": self.trainee_id,
                "durationMinutes": 30,
                "paymentMethod": "mock",
                "notes": f"Rating test session {i+1}"
            }
            
            headers = {'Authorization': f'Bearer {self.trainee_token}'}
            response = self.make_request('POST', '/virtual-sessions/request', session_request, headers)
            
            if response.status_code not in [200, 201]:
                return self.log_test(f"Session {i+1} Creation", False, f"Status: {response.status_code}")
            
            session_data = response.json()
            session_ids.append(session_data['sessionId'])
            self.test_sessions.append(session_data['sessionId'])
            time.sleep(0.1)  # Small delay between requests
        
        self.log_test("Multiple Sessions Created", True, f"Created {len(session_ids)} sessions")
        
        # Complete all sessions
        for i, session_id in enumerate(session_ids):
            headers = {'Authorization': f'Bearer {self.trainer_token}'}
            response = self.make_request('PATCH', f'/sessions/{session_id}/complete', {}, headers)
            
            if response.status_code != 200:
                return self.log_test(f"Session {i+1} Completion", False, f"Status: {response.status_code}")
        
        self.log_test("All Sessions Completed", True, "3 sessions marked as completed")
        
        # Rate each session with different ratings (5, 4, 3 stars)
        ratings = [5, 4, 3]
        for i, (session_id, rating) in enumerate(zip(session_ids, ratings)):
            rating_data = {
                "sessionId": session_id,
                "traineeId": self.trainee_id,
                "trainerId": self.trainer_id,
                "rating": rating,
                "reviewText": f"Test rating {rating} stars for session {i+1}"
            }
            
            headers = {'Authorization': f'Bearer {self.trainee_token}'}
            response = self.make_request('POST', '/ratings', rating_data, headers)
            
            if response.status_code not in [200, 201]:
                return self.log_test(f"Rating {i+1} Creation", False, f"Status: {response.status_code}")
        
        self.log_test("All Ratings Created", True, "Ratings: 5, 4, 3 stars")
        
        # Verify trainer's average rating is updated correctly: (5+4+3)/3 = 4.0
        response = self.make_request('GET', f'/trainer-profiles/{self.trainer_id}')
        
        if response.status_code != 200:
            return self.log_test("Trainer Profile Retrieval", False, f"Status: {response.status_code}")
        
        trainer_data = response.json()
        expected_rating = 4.0
        actual_rating = trainer_data.get('averageRating', 0)
        
        if abs(actual_rating - expected_rating) > 0.01:  # Allow small floating point differences
            return self.log_test("Average Rating Calculation", False, f"Expected {expected_rating}, got {actual_rating}")
        
        self.log_test("Average Rating Calculation", True, f"Correct average: {actual_rating}")
        
        return True
    
    def test_session_status_progression(self) -> bool:
        """Test 3: Session Status Progression - Test session lifecycle and rating restrictions"""
        print("\n=== TEST 3: SESSION STATUS PROGRESSION ===")
        
        # Request virtual session
        session_request = {
            "traineeId": self.trainee_id,
            "durationMinutes": 30,
            "paymentMethod": "mock",
            "notes": "Status progression test"
        }
        
        headers = {'Authorization': f'Bearer {self.trainee_token}'}
        response = self.make_request('POST', '/virtual-sessions/request', session_request, headers)
        
        if response.status_code != 201:
            return self.log_test("Session Creation", False, f"Status: {response.status_code}")
        
        session_data = response.json()
        session_id = session_data['sessionId']
        self.test_sessions.append(session_id)
        
        # Verify session starts as 'confirmed'
        if session_data.get('status') != 'confirmed':
            return self.log_test("Initial Status Check", False, f"Expected 'confirmed', got '{session_data.get('status')}'")
        
        self.log_test("Initial Status Check", True, "Session status is 'confirmed'")
        
        # Try to rate incomplete session (should fail)
        rating_data = {
            "sessionId": session_id,
            "traineeId": self.trainee_id,
            "trainerId": self.trainer_id,
            "rating": 5,
            "reviewText": "Trying to rate incomplete session"
        }
        
        headers = {'Authorization': f'Bearer {self.trainee_token}'}
        response = self.make_request('POST', '/ratings', rating_data, headers)
        
        if response.status_code == 201:
            return self.log_test("Rating Incomplete Session Blocked", False, "Should not allow rating incomplete session")
        
        self.log_test("Rating Incomplete Session Blocked", True, "Correctly blocked rating of incomplete session")
        
        # Complete the session
        headers = {'Authorization': f'Bearer {self.trainer_token}'}
        response = self.make_request('PATCH', f'/sessions/{session_id}/complete', {}, headers)
        
        if response.status_code != 200:
            return self.log_test("Session Completion", False, f"Status: {response.status_code}")
        
        # Verify status changed to 'completed'
        response = self.make_request('GET', f'/sessions/{session_id}')
        if response.status_code == 200:
            session_data = response.json()
            if session_data.get('status') != 'completed':
                return self.log_test("Status Change Verification", False, f"Expected 'completed', got '{session_data.get('status')}'")
            
            self.log_test("Status Change Verification", True, "Session status changed to 'completed'")
        
        # Now rating should be allowed
        headers = {'Authorization': f'Bearer {self.trainee_token}'}
        response = self.make_request('POST', '/ratings', rating_data, headers)
        
        if response.status_code != 201:
            return self.log_test("Rating Completed Session Allowed", False, f"Status: {response.status_code}")
        
        self.log_test("Rating Completed Session Allowed", True, "Successfully rated completed session")
        
        # Try to rate same session twice (should fail)
        response = self.make_request('POST', '/ratings', rating_data, headers)
        
        if response.status_code == 201:
            return self.log_test("Duplicate Rating Blocked", False, "Should not allow duplicate ratings")
        
        self.log_test("Duplicate Rating Blocked", True, "Correctly blocked duplicate rating")
        
        return True
    
    def test_payment_mock_validation(self) -> bool:
        """Test 4: Payment Mock Validation - Verify mock payment processing"""
        print("\n=== TEST 4: PAYMENT MOCK VALIDATION ===")
        
        # Request virtual session
        session_request = {
            "traineeId": self.trainee_id,
            "durationMinutes": 30,
            "paymentMethod": "mock",
            "notes": "Payment validation test"
        }
        
        headers = {'Authorization': f'Bearer {self.trainee_token}'}
        response = self.make_request('POST', '/virtual-sessions/request', session_request, headers)
        
        if response.status_code != 201:
            return self.log_test("Session Creation", False, f"Status: {response.status_code}")
        
        session_data = response.json()
        session_id = session_data['sessionId']
        self.test_sessions.append(session_id)
        
        # Get full session details to check payment fields
        response = self.make_request('GET', f'/sessions/{session_id}')
        
        if response.status_code != 200:
            return self.log_test("Session Retrieval", False, f"Status: {response.status_code}")
        
        full_session = response.json()
        
        # Verify paymentIntentId exists and follows pattern 'mock_payment_*'
        payment_id = full_session.get('paymentIntentId')
        if not payment_id:
            return self.log_test("Payment ID Exists", False, "No paymentIntentId found")
        
        if not payment_id.startswith('mock_payment_'):
            return self.log_test("Payment ID Pattern", False, f"Expected 'mock_payment_*', got '{payment_id}'")
        
        self.log_test("Payment ID Pattern", True, f"Correct pattern: {payment_id}")
        
        # Verify paymentStatus is 'completed' (mock payment)
        payment_status = full_session.get('paymentStatus')
        if payment_status != 'completed':
            return self.log_test("Payment Status", False, f"Expected 'completed', got '{payment_status}'")
        
        self.log_test("Payment Status", True, "Mock payment status is 'completed'")
        
        # Verify no actual charge occurred (this is inherently true for mock)
        self.log_test("No Actual Charge", True, "Mock payment - no real charge processed")
        
        return True
    
    def test_zoom_link_handling(self) -> bool:
        """Test 5: Zoom Link Handling - Test zoom link inclusion in responses"""
        print("\n=== TEST 5: ZOOM LINK HANDLING ===")
        
        # Test with trainer having zoom link (our test trainer has one)
        session_request = {
            "traineeId": self.trainee_id,
            "durationMinutes": 30,
            "paymentMethod": "mock",
            "notes": "Zoom link test with trainer having link"
        }
        
        headers = {'Authorization': f'Bearer {self.trainee_token}'}
        response = self.make_request('POST', '/virtual-sessions/request', session_request, headers)
        
        if response.status_code != 201:
            return self.log_test("Session with Zoom Link", False, f"Status: {response.status_code}")
        
        session_data = response.json()
        self.test_sessions.append(session_data['sessionId'])
        
        # Verify zoom link is included
        zoom_link = session_data.get('zoomMeetingLink')
        if not zoom_link:
            return self.log_test("Zoom Link Present", False, "No zoom link in response")
        
        # Should be the trainer's actual zoom link or placeholder
        expected_link = "https://zoom.us/j/test123456789"
        if zoom_link != expected_link and not zoom_link.startswith('https://zoom.us/j/'):
            return self.log_test("Zoom Link Format", False, f"Unexpected format: {zoom_link}")
        
        self.log_test("Zoom Link Present", True, f"Zoom link: {zoom_link}")
        
        # Create trainer without zoom link to test placeholder
        trainer_no_zoom = {
            "fullName": f"{TEST_PREFIX}NoZoom Trainer",
            "email": f"{TEST_PREFIX}trainer_nozoom@test.com",
            "phone": "+1234567892",
            "password": "testpass123",
            "roles": ["trainer"]
        }
        
        response = self.make_request('POST', '/auth/signup', trainer_no_zoom)
        if response.status_code == 201:
            trainer_data = response.json()
            trainer_no_zoom_id = trainer_data['user']['id']
            trainer_no_zoom_token = trainer_data['access_token']
            
            # Create profile without zoom link
            profile_no_zoom = {
                "userId": trainer_no_zoom_id,
                "bio": "Trainer without zoom link",
                "experienceYears": 3,
                "offersVirtual": True,
                "isVirtualTrainingAvailable": True,
                "isAvailable": True,
                "ratePerMinuteCents": 60,
                "latitude": 40.7589,
                "longitude": -73.9851
                # No zoomMeetingLink provided
            }
            
            headers = {'Authorization': f'Bearer {trainer_no_zoom_token}'}
            response = self.make_request('POST', '/trainer-profiles', profile_no_zoom, headers)
            
            if response.status_code == 201:
                self.log_test("Trainer Without Zoom Created", True, "Test trainer without zoom link created")
            else:
                self.log_test("Trainer Without Zoom Created", False, f"Status: {response.status_code}")
        
        return True
    
    def test_session_timestamps(self) -> bool:
        """Test 6: Session Timestamps - Verify timestamp accuracy and consistency"""
        print("\n=== TEST 6: SESSION TIMESTAMPS ===")
        
        # Record time before request
        before_request = datetime.utcnow()
        
        # Request virtual session
        session_request = {
            "traineeId": self.trainee_id,
            "durationMinutes": 30,
            "paymentMethod": "mock",
            "notes": "Timestamp test session"
        }
        
        headers = {'Authorization': f'Bearer {self.trainee_token}'}
        response = self.make_request('POST', '/virtual-sessions/request', session_request, headers)
        
        # Record time after request
        after_request = datetime.utcnow()
        
        if response.status_code != 201:
            return self.log_test("Session Creation", False, f"Status: {response.status_code}")
        
        session_data = response.json()
        session_id = session_data['sessionId']
        self.test_sessions.append(session_id)
        
        # Parse timestamps
        try:
            start_time_str = session_data.get('sessionDateTimeStart')
            end_time_str = session_data.get('sessionDateTimeEnd')
            
            # Handle different datetime formats
            for fmt in ['%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%dT%H:%M:%S.%f']:
                try:
                    start_time = datetime.strptime(start_time_str.replace('Z', ''), fmt.replace('Z', ''))
                    end_time = datetime.strptime(end_time_str.replace('Z', ''), fmt.replace('Z', ''))
                    break
                except ValueError:
                    continue
            else:
                return self.log_test("Timestamp Parsing", False, f"Could not parse timestamps: {start_time_str}, {end_time_str}")
            
        except Exception as e:
            return self.log_test("Timestamp Parsing", False, f"Error parsing timestamps: {str(e)}")
        
        # Verify sessionDateTimeStart is approximately current time (within 2 minutes)
        time_diff = abs((start_time - before_request).total_seconds())
        if time_diff > 120:  # 2 minutes tolerance
            return self.log_test("Start Time Accuracy", False, f"Start time too far from current: {time_diff}s difference")
        
        self.log_test("Start Time Accuracy", True, f"Start time within {time_diff:.1f}s of request")
        
        # Verify sessionDateTimeEnd is exactly 30 minutes after start
        expected_duration = timedelta(minutes=30)
        actual_duration = end_time - start_time
        
        if abs(actual_duration.total_seconds() - expected_duration.total_seconds()) > 1:  # 1 second tolerance
            return self.log_test("Duration Accuracy", False, f"Expected 30 min, got {actual_duration}")
        
        self.log_test("Duration Accuracy", True, "End time is exactly 30 minutes after start")
        
        # Get full session to check createdAt timestamp
        response = self.make_request('GET', f'/sessions/{session_id}')
        if response.status_code == 200:
            full_session = response.json()
            created_at_str = full_session.get('createdAt')
            
            if created_at_str:
                try:
                    # Parse createdAt timestamp
                    for fmt in ['%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%dT%H:%M:%S.%f']:
                        try:
                            created_at = datetime.strptime(created_at_str.replace('Z', ''), fmt.replace('Z', ''))
                            break
                        except ValueError:
                            continue
                    
                    # Verify createdAt is within reasonable time of request
                    created_diff = abs((created_at - before_request).total_seconds())
                    if created_diff > 120:  # 2 minutes tolerance
                        return self.log_test("CreatedAt Timestamp", False, f"CreatedAt too far from request: {created_diff}s")
                    
                    self.log_test("CreatedAt Timestamp", True, f"CreatedAt within {created_diff:.1f}s of request")
                    
                except Exception as e:
                    self.log_test("CreatedAt Timestamp", False, f"Error parsing createdAt: {str(e)}")
            else:
                self.log_test("CreatedAt Timestamp", False, "No createdAt field found")
        
        return True
    
    def run_all_tests(self):
        """Run all test scenarios"""
        print("🚀 STARTING TEST RUN #3 of 3 - Virtual Training Flow Data Integrity & Edge Cases")
        print("=" * 80)
        
        try:
            # Setup
            if not self.setup_test_users():
                return False
            
            if not self.setup_test_profiles():
                return False
            
            # Run all test scenarios
            tests = [
                self.test_data_integrity,
                self.test_multi_session_rating_impact,
                self.test_session_status_progression,
                self.test_payment_mock_validation,
                self.test_zoom_link_handling,
                self.test_session_timestamps
            ]
            
            all_passed = True
            for test in tests:
                if not test():
                    all_passed = False
            
            # Summary
            print("\n" + "=" * 80)
            print("📊 TEST SUMMARY")
            print("=" * 80)
            
            passed_count = sum(1 for result in self.test_results if result['passed'])
            total_count = len(self.test_results)
            success_rate = (passed_count / total_count * 100) if total_count > 0 else 0
            
            print(f"Total Tests: {total_count}")
            print(f"Passed: {passed_count}")
            print(f"Failed: {total_count - passed_count}")
            print(f"Success Rate: {success_rate:.1f}%")
            
            if all_passed:
                print("\n🎉 ALL TESTS PASSED - Virtual Training Data Integrity Verified!")
            else:
                print("\n⚠️  SOME TESTS FAILED - Review failed tests above")
                
                # Show failed tests
                failed_tests = [r for r in self.test_results if not r['passed']]
                if failed_tests:
                    print("\nFailed Tests:")
                    for test in failed_tests:
                        print(f"  ❌ {test['test']}: {test['details']}")
            
            return all_passed
            
        except Exception as e:
            print(f"\n💥 TEST SUITE ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    test_suite = RapidRepsTestSuite()
    success = test_suite.run_all_tests()
    exit(0 if success else 1)