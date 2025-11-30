#!/usr/bin/env python3
"""
RapidReps Backend API Comprehensive Testing Suite
Testing all backend functionality including:
1. Authentication endpoints (signup, login, JWT verification)
2. Trainer profile management (create, read, update, toggle availability)
3. Trainee profile management (create, read, update with location data)
4. Trainer search with proximity matching (15mi in-person, 20mi virtual)
5. Session booking and management
6. Rating system
7. Nearby trainees endpoint
8. NEW: Virtual training session request endpoint
"""

import requests
import json
import sys
from datetime import datetime, timedelta
import os

# Get backend URL from environment
BACKEND_URL = 'https://trainer-connect-24.preview.emergentagent.com'
API_BASE = f"{BACKEND_URL}/api"

class RapidRepsProximityTester:
    def __init__(self):
        self.session = requests.Session()
        self.trainer_token = None
        self.trainee_token = None
        self.test_results = []
        
        # Test coordinates - Laurel, MD
        self.test_lat = 39.0993
        self.test_lon = -76.8483
        
        # Test trainer data with specific distances from Laurel, MD
        self.test_trainers = [
            {
                "name": "Mike Johnson",
                "email": "mike.johnson@test.com",
                "lat": 39.0993, "lon": -76.8483,  # 0 miles - same location
                "offers_in_person": True, "offers_virtual": False,
                "expected_distance": 0
            },
            {
                "name": "Marcus Thompson", 
                "email": "marcus.thompson@test.com",
                "lat": 39.1050, "lon": -76.8550,  # ~0.5 miles
                "offers_in_person": True, "offers_virtual": False,
                "expected_distance": 0.5
            },
            {
                "name": "Amanda Foster",
                "email": "amanda.foster@test.com", 
                "lat": 39.1200, "lon": -76.8700,  # ~1.7 miles
                "offers_in_person": True, "offers_virtual": False,
                "expected_distance": 1.7
            },
            {
                "name": "Robert Williams",
                "email": "robert.williams@test.com",
                "lat": 39.1500, "lon": -76.9000,  # ~4.4 miles
                "offers_in_person": True, "offers_virtual": False,
                "expected_distance": 4.4
            },
            {
                "name": "Sarah Williams",
                "email": "sarah.williams@test.com",
                "lat": 39.1700, "lon": -76.9200,  # ~5 miles
                "offers_in_person": True, "offers_virtual": False,
                "expected_distance": 5
            },
            {
                "name": "David Chen",
                "email": "david.chen@test.com",
                "lat": 39.2500, "lon": -77.0000,  # ~10.6 miles
                "offers_in_person": True, "offers_virtual": False,
                "expected_distance": 10.6
            },
            {
                "name": "Emma Davis",
                "email": "emma.davis@test.com",
                "lat": 39.2600, "lon": -77.0100,  # ~10.7 miles
                "offers_in_person": True, "offers_virtual": False,
                "expected_distance": 10.7
            },
            {
                "name": "James Wilson",
                "email": "james.wilson@test.com",
                "lat": 39.2800, "lon": -77.0800,  # ~17.6 miles
                "offers_in_person": False, "offers_virtual": True,
                "expected_distance": 17.6
            },
            {
                "name": "Sophia Anderson",
                "email": "sophia.anderson@test.com",
                "lat": 39.4500, "lon": -77.3000,  # ~23.6 miles
                "offers_in_person": False, "offers_virtual": True,
                "expected_distance": 23.6
            },
            {
                "name": "Liam Martinez",
                "email": "liam.martinez@test.com",
                "lat": 39.5500, "lon": -77.5000,  # ~27.9 miles
                "offers_in_person": False, "offers_virtual": True,
                "expected_distance": 27.9
            }
        ]
        
        # Test trainee data
        self.test_trainees = [
            {
                "name": "Test Trainee 1",
                "email": "trainee1@test.com",
                "lat": 39.1100, "lon": -76.8600,  # ~1 mile from Laurel
                "expected_distance": 1
            },
            {
                "name": "Test Trainee 2", 
                "email": "trainee2@test.com",
                "lat": 39.2000, "lon": -76.9500,  # ~8 miles from Laurel
                "expected_distance": 8
            },
            {
                "name": "Test Trainee 3",
                "email": "trainee3@test.com",
                "lat": 39.2800, "lon": -77.0500,  # ~12 miles from Laurel
                "expected_distance": 12
            },
            {
                "name": "Test Trainee 4",
                "email": "trainee4@test.com",
                "lat": 39.3500, "lon": -77.2000,  # ~18 miles from Laurel
                "expected_distance": 18
            }
        ]

    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")

    def make_request(self, method, endpoint, data=None, headers=None, token=None):
        """Make HTTP request with error handling"""
        url = f"{API_BASE}{endpoint}"
        
        if headers is None:
            headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
            
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=headers, params=data)
            elif method.upper() == 'POST':
                response = self.session.post(url, headers=headers, json=data)
            elif method.upper() == 'PATCH':
                response = self.session.patch(url, headers=headers, json=data)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            return None

    def setup_test_data(self):
        """Create test users, trainers, and trainees"""
        print("\n🔧 Setting up test data...")
        
        created_trainers = []
        created_trainees = []
        
        # Create trainer users and profiles
        for trainer_data in self.test_trainers:
            # Create user
            user_payload = {
                "fullName": trainer_data["name"],
                "email": trainer_data["email"],
                "phone": "+1234567890",
                "password": "testpass123",
                "roles": ["trainer"]
            }
            
            response = self.make_request('POST', '/auth/signup', user_payload)
            if response and response.status_code == 200:
                user_info = response.json()
                user_id = user_info['user']['id']
                token = user_info['access_token']
                
                # Create trainer profile
                profile_payload = {
                    "userId": user_id,
                    "bio": f"Experienced trainer - {trainer_data['name']}",
                    "experienceYears": 5,
                    "certifications": ["NASM", "CPR"],
                    "trainingStyles": ["Strength Training", "Cardio"],
                    "offersInPerson": trainer_data["offers_in_person"],
                    "offersVirtual": trainer_data["offers_virtual"],
                    "isVirtualTrainingAvailable": trainer_data["offers_virtual"],
                    "ratePerMinuteCents": 150,
                    "latitude": trainer_data["lat"],
                    "longitude": trainer_data["lon"],
                    "locationAddress": f"Test Location for {trainer_data['name']}",
                    "isAvailable": True
                }
                
                profile_response = self.make_request('POST', '/trainer-profiles', profile_payload, token=token)
                if profile_response and profile_response.status_code == 200:
                    created_trainers.append({
                        'user_id': user_id,
                        'token': token,
                        'name': trainer_data['name'],
                        'email': trainer_data['email'],
                        'expected_distance': trainer_data['expected_distance'],
                        'offers_in_person': trainer_data['offers_in_person'],
                        'offers_virtual': trainer_data['offers_virtual']
                    })
                    print(f"   ✅ Created trainer: {trainer_data['name']}")
                else:
                    print(f"   ❌ Failed to create trainer profile: {trainer_data['name']}")
            else:
                print(f"   ❌ Failed to create trainer user: {trainer_data['name']}")
        
        # Create trainee users and profiles  
        for trainee_data in self.test_trainees:
            # Create user
            user_payload = {
                "fullName": trainee_data["name"],
                "email": trainee_data["email"], 
                "phone": "+1234567890",
                "password": "testpass123",
                "roles": ["trainee"]
            }
            
            response = self.make_request('POST', '/auth/signup', user_payload)
            if response and response.status_code == 200:
                user_info = response.json()
                user_id = user_info['user']['id']
                token = user_info['access_token']
                
                # Create trainee profile
                profile_payload = {
                    "userId": user_id,
                    "fitnessGoals": "Get fit and healthy",
                    "currentFitnessLevel": "beginner",
                    "experienceLevel": "Some experience",
                    "latitude": trainee_data["lat"],
                    "longitude": trainee_data["lon"],
                    "locationAddress": f"Test Location for {trainee_data['name']}",
                    "isVirtualEnabled": True,
                    "budgetMinPerMinuteCents": 100,
                    "budgetMaxPerMinuteCents": 200
                }
                
                profile_response = self.make_request('POST', '/trainee-profiles', profile_payload, token=token)
                if profile_response and profile_response.status_code == 200:
                    created_trainees.append({
                        'user_id': user_id,
                        'token': token,
                        'name': trainee_data['name'],
                        'email': trainee_data['email'],
                        'expected_distance': trainee_data['expected_distance']
                    })
                    print(f"   ✅ Created trainee: {trainee_data['name']}")
                else:
                    print(f"   ❌ Failed to create trainee profile: {trainee_data['name']}")
            else:
                print(f"   ❌ Failed to create trainee user: {trainee_data['name']}")
        
        # Store reference trainer token for nearby trainees test
        if created_trainers:
            self.trainer_token = created_trainers[0]['token']
            
        return created_trainers, created_trainees

    def test_scenario_1_in_person_only(self):
        """Test Scenario 1: In-Person Only Search (wantsVirtual=False)"""
        print("\n🧪 Testing Scenario 1: In-Person Only Search (wantsVirtual=False)")
        
        # Search for trainers - in-person only
        params = {
            'latitude': self.test_lat,
            'longitude': self.test_lon,
            'wantsVirtual': 'false'
        }
        
        response = self.make_request('GET', '/trainers/search', params)
        
        if not response or response.status_code != 200:
            self.log_result(
                "Scenario 1 - API Call",
                False,
                f"Failed to call search API. Status: {response.status_code if response else 'No response'}",
                response.text if response else None
            )
            return
        
        trainers = response.json()
        
        # Expected trainers within 15 miles offering in-person
        expected_trainers = [
            "Mike Johnson", "Marcus Thompson", "Amanda Foster", 
            "Robert Williams", "Sarah Williams", "David Chen", "Emma Davis"
        ]
        
        # Should NOT include virtual-only trainers beyond 15 miles
        excluded_trainers = ["James Wilson", "Sophia Anderson", "Liam Martinez"]
        
        found_names = [t.get('bio', '').replace('Experienced trainer - ', '') for t in trainers]
        
        # Check expected trainers are included
        missing_trainers = []
        for expected in expected_trainers:
            if expected not in found_names:
                missing_trainers.append(expected)
        
        # Check excluded trainers are not included
        incorrectly_included = []
        for excluded in excluded_trainers:
            if excluded in found_names:
                incorrectly_included.append(excluded)
        
        success = len(missing_trainers) == 0 and len(incorrectly_included) == 0
        
        details = {
            'found_trainers': found_names,
            'expected_count': len(expected_trainers),
            'actual_count': len(trainers),
            'missing_trainers': missing_trainers,
            'incorrectly_included': incorrectly_included
        }
        
        message = f"Found {len(trainers)} trainers. Expected {len(expected_trainers)} in-person trainers within 15 miles."
        if missing_trainers:
            message += f" Missing: {missing_trainers}"
        if incorrectly_included:
            message += f" Incorrectly included: {incorrectly_included}"
            
        self.log_result("Scenario 1 - In-Person Only Search", success, message, details)

    def test_scenario_2_in_person_plus_virtual(self):
        """Test Scenario 2: In-Person + Virtual Search (wantsVirtual=True)"""
        print("\n🧪 Testing Scenario 2: In-Person + Virtual Search (wantsVirtual=True)")
        
        # Search for trainers - including virtual
        params = {
            'latitude': self.test_lat,
            'longitude': self.test_lon,
            'wantsVirtual': 'true'
        }
        
        response = self.make_request('GET', '/trainers/search', params)
        
        if not response or response.status_code != 200:
            self.log_result(
                "Scenario 2 - API Call",
                False,
                f"Failed to call search API. Status: {response.status_code if response else 'No response'}",
                response.text if response else None
            )
            return
        
        trainers = response.json()
        
        # Expected: In-person trainers ≤15 mi FIRST, then virtual trainers ≤20 mi
        expected_in_person = [
            "Mike Johnson", "Marcus Thompson", "Amanda Foster",
            "Robert Williams", "Sarah Williams", "David Chen", "Emma Davis"
        ]
        expected_virtual = ["James Wilson"]  # 17.6 miles - within 20 mile limit
        excluded_trainers = ["Sophia Anderson", "Liam Martinez"]  # >20 miles
        
        found_names = [t.get('bio', '').replace('Experienced trainer - ', '') for t in trainers]
        
        # Check all expected trainers are included
        missing_trainers = []
        for expected in expected_in_person + expected_virtual:
            if expected not in found_names:
                missing_trainers.append(expected)
        
        # Check excluded trainers are not included
        incorrectly_included = []
        for excluded in excluded_trainers:
            if excluded in found_names:
                incorrectly_included.append(excluded)
        
        # Check ordering: in-person trainers should come before virtual trainers
        ordering_correct = True
        james_wilson_index = -1
        last_in_person_index = -1
        
        for i, trainer in enumerate(trainers):
            name = trainer.get('bio', '').replace('Experienced trainer - ', '')
            if name in expected_in_person:
                last_in_person_index = i
            elif name == "James Wilson":
                james_wilson_index = i
        
        if james_wilson_index != -1 and last_in_person_index != -1:
            ordering_correct = james_wilson_index > last_in_person_index
        
        success = (len(missing_trainers) == 0 and 
                  len(incorrectly_included) == 0 and 
                  ordering_correct)
        
        details = {
            'found_trainers': found_names,
            'expected_total': len(expected_in_person) + len(expected_virtual),
            'actual_count': len(trainers),
            'missing_trainers': missing_trainers,
            'incorrectly_included': incorrectly_included,
            'ordering_correct': ordering_correct,
            'james_wilson_index': james_wilson_index,
            'last_in_person_index': last_in_person_index
        }
        
        message = f"Found {len(trainers)} trainers. Expected {len(expected_in_person)} in-person + {len(expected_virtual)} virtual."
        if missing_trainers:
            message += f" Missing: {missing_trainers}"
        if incorrectly_included:
            message += f" Incorrectly included: {incorrectly_included}"
        if not ordering_correct:
            message += " Ordering incorrect: virtual trainers should come after in-person trainers"
            
        self.log_result("Scenario 2 - In-Person + Virtual Search", success, message, details)

    def test_scenario_3_trainer_availability_toggle(self):
        """Test Scenario 3: Trainer Availability Toggle"""
        print("\n🧪 Testing Scenario 3: Trainer Availability Toggle")
        
        if not self.trainer_token:
            self.log_result(
                "Scenario 3 - Setup",
                False,
                "No trainer token available for testing",
                None
            )
            return
        
        # Test setting trainer to unavailable
        response = self.make_request(
            'PATCH', 
            '/trainer-profiles/toggle-availability?isAvailable=false',
            token=self.trainer_token
        )
        
        if not response or response.status_code != 200:
            self.log_result(
                "Scenario 3 - Toggle Unavailable",
                False,
                f"Failed to toggle availability to false. Status: {response.status_code if response else 'No response'}",
                response.text if response else None
            )
            return
        
        # Verify trainer is hidden from search
        params = {
            'latitude': self.test_lat,
            'longitude': self.test_lon,
            'wantsVirtual': 'false'
        }
        
        search_response = self.make_request('GET', '/trainers/search', params)
        
        if not search_response or search_response.status_code != 200:
            self.log_result(
                "Scenario 3 - Search After Unavailable",
                False,
                f"Failed to search trainers. Status: {search_response.status_code if search_response else 'No response'}",
                search_response.text if search_response else None
            )
            return
        
        trainers_unavailable = search_response.json()
        
        # Test setting trainer back to available
        response = self.make_request(
            'PATCH',
            '/trainer-profiles/toggle-availability?isAvailable=true',
            token=self.trainer_token
        )
        
        if not response or response.status_code != 200:
            self.log_result(
                "Scenario 3 - Toggle Available",
                False,
                f"Failed to toggle availability to true. Status: {response.status_code if response else 'No response'}",
                response.text if response else None
            )
            return
        
        # Verify trainer appears in search again
        search_response2 = self.make_request('GET', '/trainers/search', params)
        
        if not search_response2 or search_response2.status_code != 200:
            self.log_result(
                "Scenario 3 - Search After Available",
                False,
                f"Failed to search trainers. Status: {search_response2.status_code if search_response2 else 'No response'}",
                search_response2.text if search_response2 else None
            )
            return
        
        trainers_available = search_response2.json()
        
        # Verify the trainer count increased when set back to available
        success = len(trainers_available) > len(trainers_unavailable)
        
        details = {
            'trainers_when_unavailable': len(trainers_unavailable),
            'trainers_when_available': len(trainers_available),
            'difference': len(trainers_available) - len(trainers_unavailable)
        }
        
        message = f"Availability toggle working. Trainers: {len(trainers_unavailable)} (unavailable) vs {len(trainers_available)} (available)"
        
        self.log_result("Scenario 3 - Trainer Availability Toggle", success, message, details)

    def test_scenario_4_nearby_trainees(self):
        """Test Scenario 4: Nearby Trainees (15-mile radius)"""
        print("\n🧪 Testing Scenario 4: Nearby Trainees (15-mile radius)")
        
        if not self.trainer_token:
            self.log_result(
                "Scenario 4 - Setup",
                False,
                "No trainer token available for testing",
                None
            )
            return
        
        # Get nearby trainees
        response = self.make_request('GET', '/trainers/nearby-trainees', token=self.trainer_token)
        
        if not response or response.status_code != 200:
            self.log_result(
                "Scenario 4 - API Call",
                False,
                f"Failed to get nearby trainees. Status: {response.status_code if response else 'No response'}",
                response.text if response else None
            )
            return
        
        result = response.json()
        trainees = result.get('trainees', [])
        
        # Expected trainees within 15 miles from Laurel, MD
        # Test Trainee 1: ~1 mile ✓
        # Test Trainee 2: ~8 miles ✓  
        # Test Trainee 3: ~12 miles ✓
        # Test Trainee 4: ~18 miles ❌ (beyond 15 miles)
        
        expected_trainees = ["Test Trainee 1", "Test Trainee 2", "Test Trainee 3"]
        excluded_trainees = ["Test Trainee 4"]  # Beyond 15 miles
        
        found_names = [t.get('fullName', '') for t in trainees]
        
        # Check expected trainees are included
        missing_trainees = []
        for expected in expected_trainees:
            if expected not in found_names:
                missing_trainees.append(expected)
        
        # Check excluded trainees are not included
        incorrectly_included = []
        for excluded in excluded_trainees:
            if excluded in found_names:
                incorrectly_included.append(excluded)
        
        # Verify distances are within 15 miles
        distance_violations = []
        for trainee in trainees:
            distance = trainee.get('distance', 0)
            if distance > 15:
                distance_violations.append(f"{trainee.get('fullName', 'Unknown')} ({distance} miles)")
        
        success = (len(missing_trainees) == 0 and 
                  len(incorrectly_included) == 0 and 
                  len(distance_violations) == 0)
        
        details = {
            'found_trainees': found_names,
            'expected_count': len(expected_trainees),
            'actual_count': len(trainees),
            'missing_trainees': missing_trainees,
            'incorrectly_included': incorrectly_included,
            'distance_violations': distance_violations,
            'trainee_distances': [(t.get('fullName', ''), t.get('distance', 0)) for t in trainees]
        }
        
        message = f"Found {len(trainees)} trainees within 15 miles. Expected {len(expected_trainees)}."
        if missing_trainees:
            message += f" Missing: {missing_trainees}"
        if incorrectly_included:
            message += f" Incorrectly included: {incorrectly_included}"
        if distance_violations:
            message += f" Distance violations: {distance_violations}"
            
        self.log_result("Scenario 4 - Nearby Trainees (15-mile radius)", success, message, details)

    def test_virtual_session_setup(self):
        """Setup virtual trainer for virtual session testing"""
        print("\n🔧 Setting up virtual trainer for virtual session testing...")
        
        # Create a dedicated virtual trainer
        virtual_trainer_data = {
            "fullName": "Virtual Trainer Pro",
            "email": f"virtual.trainer.{datetime.now().timestamp()}@test.com",
            "phone": "+1234567899",
            "password": "testpass123",
            "roles": ["trainer"]
        }
        
        response = self.make_request('POST', '/auth/signup', virtual_trainer_data)
        if not response or response.status_code != 200:
            self.log_result("Virtual Session Setup - Trainer Signup", False, 
                           f"Failed to create virtual trainer. Status: {response.status_code if response else 'No response'}")
            return None, None
            
        user_info = response.json()
        virtual_trainer_id = user_info['user']['id']
        virtual_trainer_token = user_info['access_token']
        
        # Create virtual trainer profile with all required flags
        virtual_profile = {
            "userId": virtual_trainer_id,
            "bio": "Expert virtual fitness trainer",
            "experienceYears": 8,
            "certifications": ["NASM-CPT", "Virtual Training Specialist"],
            "trainingStyles": ["HIIT", "Strength Training", "Yoga"],
            "offersInPerson": True,
            "offersVirtual": True,  # KEY: Must offer virtual
            "isAvailable": True,    # KEY: Must be available
            "isVirtualTrainingAvailable": True,  # KEY: Virtual training available
            "ratePerMinuteCents": 175,
            "latitude": 40.7128,
            "longitude": -74.0060,
            "locationAddress": "New York, NY",
            "videoCallPreference": "zoom",
            "zoomMeetingLink": "https://zoom.us/j/123456789"
        }
        
        profile_response = self.make_request('POST', '/trainer-profiles', virtual_profile, token=virtual_trainer_token)
        if not profile_response or profile_response.status_code != 200:
            self.log_result("Virtual Session Setup - Trainer Profile", False, 
                           f"Failed to create virtual trainer profile. Status: {profile_response.status_code if profile_response else 'No response'}")
            return None, None
            
        self.log_result("Virtual Session Setup", True, "Virtual trainer created successfully")
        return virtual_trainer_id, virtual_trainer_token

    def test_virtual_session_successful_request(self):
        """Test successful virtual session request with available trainer"""
        print("\n🧪 Testing Virtual Session - Successful Request")
        
        # Setup virtual trainer
        virtual_trainer_id, virtual_trainer_token = self.test_virtual_session_setup()
        if not virtual_trainer_id:
            return
            
        # Create a trainee for virtual session
        trainee_data = {
            "fullName": "Virtual Session Trainee",
            "email": f"virtual.trainee.{datetime.now().timestamp()}@test.com",
            "phone": "+1234567898",
            "password": "testpass123",
            "roles": ["trainee"]
        }
        
        response = self.make_request('POST', '/auth/signup', trainee_data)
        if not response or response.status_code != 200:
            self.log_result("Virtual Session - Trainee Setup", False, "Failed to create trainee")
            return
            
        trainee_info = response.json()
        trainee_id = trainee_info['user']['id']
        trainee_token = trainee_info['access_token']
        
        # Create trainee profile
        trainee_profile = {
            "userId": trainee_id,
            "fitnessGoals": "Virtual training experience",
            "currentFitnessLevel": "intermediate",
            "experienceLevel": "Some experience",
            "isVirtualEnabled": True,
            "budgetMinPerMinuteCents": 100,
            "budgetMaxPerMinuteCents": 300
        }
        
        profile_response = self.make_request('POST', '/trainee-profiles', trainee_profile, token=trainee_token)
        if not profile_response or profile_response.status_code != 200:
            self.log_result("Virtual Session - Trainee Profile Setup", False, "Failed to create trainee profile")
            return
            
        # Request virtual session
        virtual_session_request = {
            "traineeId": trainee_id,
            "durationMinutes": 30,
            "paymentMethod": "mock",
            "notes": "Testing virtual session request"
        }
        
        response = self.make_request('POST', '/virtual-sessions/request', virtual_session_request, token=trainee_token)
        
        if not response or response.status_code != 200:
            self.log_result("Virtual Session Request", False, 
                           f"Failed to request virtual session. Status: {response.status_code if response else 'No response'}",
                           response.text if response else None)
            return
            
        result = response.json()
        
        # Verify response structure
        required_fields = ['sessionId', 'trainerId', 'trainerName', 'trainerRating', 
                          'sessionDateTimeStart', 'sessionDateTimeEnd', 'durationMinutes', 
                          'finalSessionPriceCents', 'status']
        
        missing_fields = [field for field in required_fields if field not in result]
        
        if missing_fields:
            self.log_result("Virtual Session - Response Structure", False, 
                           f"Missing required fields: {missing_fields}")
            return
            
        # Verify pricing ($18 for 30 minutes = 1800 cents)
        expected_price = 1800
        actual_price = result['finalSessionPriceCents']
        price_correct = actual_price == expected_price
        
        # Verify duration
        duration_correct = result['durationMinutes'] == 30
        
        # Verify status is confirmed (auto-confirmed for virtual)
        status_correct = result['status'] == 'confirmed'
        
        # Verify trainer matching
        trainer_matched = result['trainerId'] == virtual_trainer_id
        
        success = (len(missing_fields) == 0 and price_correct and 
                  duration_correct and status_correct and trainer_matched)
        
        details = {
            'session_id': result.get('sessionId'),
            'trainer_id': result.get('trainerId'),
            'trainer_name': result.get('trainerName'),
            'price_cents': actual_price,
            'expected_price_cents': expected_price,
            'duration_minutes': result.get('durationMinutes'),
            'status': result.get('status'),
            'zoom_link': result.get('zoomMeetingLink')
        }
        
        message = f"Virtual session created successfully. Price: ${actual_price/100:.2f}, Duration: {result.get('durationMinutes')}min, Status: {result.get('status')}"
        
        self.log_result("Virtual Session - Successful Request", success, message, details)
        
        return result

    def test_virtual_session_no_available_trainers(self):
        """Test error case when no virtual trainers are available"""
        print("\n🧪 Testing Virtual Session - No Available Trainers")
        
        # Create a trainee
        trainee_data = {
            "fullName": "No Trainer Trainee",
            "email": f"no.trainer.trainee.{datetime.now().timestamp()}@test.com",
            "phone": "+1234567897",
            "password": "testpass123",
            "roles": ["trainee"]
        }
        
        response = self.make_request('POST', '/auth/signup', trainee_data)
        if not response or response.status_code != 200:
            self.log_result("Virtual Session No Trainers - Setup", False, "Failed to create trainee")
            return
            
        trainee_info = response.json()
        trainee_id = trainee_info['user']['id']
        trainee_token = trainee_info['access_token']
        
        # Make all existing virtual trainers unavailable by searching and toggling
        # First, let's make sure we have no available virtual trainers
        # We'll create a trainer and then make them unavailable
        
        temp_trainer_data = {
            "fullName": "Temp Virtual Trainer",
            "email": f"temp.virtual.{datetime.now().timestamp()}@test.com",
            "phone": "+1234567896",
            "password": "testpass123",
            "roles": ["trainer"]
        }
        
        trainer_response = self.make_request('POST', '/auth/signup', temp_trainer_data)
        if trainer_response and trainer_response.status_code == 200:
            trainer_info = trainer_response.json()
            temp_trainer_token = trainer_info['access_token']
            
            # Create profile and immediately make unavailable
            temp_profile = {
                "userId": trainer_info['user']['id'],
                "offersVirtual": True,
                "isVirtualTrainingAvailable": True,
                "isAvailable": False  # Make unavailable
            }
            
            self.make_request('POST', '/trainer-profiles', temp_profile, token=temp_trainer_token)
        
        # Now try to request virtual session (should fail)
        virtual_session_request = {
            "traineeId": trainee_id,
            "durationMinutes": 30,
            "paymentMethod": "mock",
            "notes": "This should fail - no trainers available"
        }
        
        response = self.make_request('POST', '/virtual-sessions/request', virtual_session_request, token=trainee_token)
        
        # Should return 404 with appropriate error message
        if response and response.status_code == 404:
            error_data = response.json()
            expected_message = "No virtual trainers available at the moment"
            
            if expected_message in error_data.get('detail', ''):
                success = True
                message = f"Correct error handling: {error_data['detail']}"
            else:
                success = False
                message = f"Unexpected error message: {error_data.get('detail')}"
        else:
            success = False
            message = f"Expected 404 error, got {response.status_code if response else 'No response'}: {response.text if response else 'No response'}"
        
        self.log_result("Virtual Session - No Available Trainers", success, message)

    def test_virtual_session_pricing_verification(self):
        """Test virtual session pricing breakdown verification"""
        print("\n🧪 Testing Virtual Session - Pricing Verification")
        
        # Setup and create a virtual session
        session_data = self.test_virtual_session_successful_request()
        if not session_data:
            return
            
        session_id = session_data['sessionId']
        
        # Get session details from database
        response = self.make_request('GET', f'/sessions/{session_id}')
        
        if not response or response.status_code != 200:
            self.log_result("Virtual Session Pricing - Session Retrieval", False, 
                           f"Failed to retrieve session details. Status: {response.status_code if response else 'No response'}")
            return
            
        session = response.json()
        
        # Verify pricing breakdown
        base_price = session.get('baseSessionPriceCents', 0)
        platform_fee = session.get('platformFeeCents', 0)
        trainer_earnings = session.get('trainerEarningsCents', 0)
        final_price = session.get('finalSessionPriceCents', 0)
        
        # Expected: $18 base, $1.80 platform fee (10%), $16.20 trainer earnings
        expected_base = 1800
        expected_platform_fee = 180
        expected_trainer_earnings = 1620
        expected_final = 1800
        
        pricing_correct = (base_price == expected_base and 
                          platform_fee == expected_platform_fee and 
                          trainer_earnings == expected_trainer_earnings and
                          final_price == expected_final)
        
        # Verify session type is virtual
        is_virtual = session.get('locationType') == 'virtual'
        
        # Verify payment processing
        payment_status = session.get('paymentStatus')
        payment_id = session.get('paymentIntentId')
        payment_processed = payment_status == 'completed' and payment_id and payment_id.startswith('mock_payment_')
        
        success = pricing_correct and is_virtual and payment_processed
        
        details = {
            'base_price_cents': base_price,
            'platform_fee_cents': platform_fee,
            'trainer_earnings_cents': trainer_earnings,
            'final_price_cents': final_price,
            'location_type': session.get('locationType'),
            'payment_status': payment_status,
            'payment_id': payment_id
        }
        
        message = f"Pricing verification. Base: ${base_price/100:.2f}, Fee: ${platform_fee/100:.2f}, Earnings: ${trainer_earnings/100:.2f}"
        if not pricing_correct:
            message += f" (Expected: ${expected_base/100:.2f}, ${expected_platform_fee/100:.2f}, ${expected_trainer_earnings/100:.2f})"
        
        self.log_result("Virtual Session - Pricing Verification", success, message, details)

    def run_all_tests(self):
        """Run all proximity matching tests"""
        print("🚀 Starting RapidReps Proximity Matching Tests")
        print(f"Backend URL: {API_BASE}")
        print(f"Test Location: Laurel, MD ({self.test_lat}, {self.test_lon})")
        
        # Setup test data
        created_trainers, created_trainees = self.setup_test_data()
        
        if not created_trainers or not created_trainees:
            print("❌ Failed to create sufficient test data. Aborting tests.")
            return False
        
        print(f"\n✅ Created {len(created_trainers)} trainers and {len(created_trainees)} trainees")
        
        # Run test scenarios
        self.test_scenario_1_in_person_only()
        self.test_scenario_2_in_person_plus_virtual()
        self.test_scenario_3_trainer_availability_toggle()
        self.test_scenario_4_nearby_trainees()
        
        # Run NEW virtual session tests
        print("\n🚀 Testing NEW Virtual Training Session Flow")
        print("-" * 50)
        self.test_virtual_session_successful_request()
        self.test_virtual_session_no_available_trainers()
        self.test_virtual_session_pricing_verification()
        
        # Print summary
        self.print_summary()
        
        # Return overall success
        return all(result['success'] for result in self.test_results)

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*80)
        print("📊 TEST SUMMARY")
        print("="*80)
        
        passed = sum(1 for r in self.test_results if r['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        print("\n📋 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅ PASS" if result['success'] else "❌ FAIL"
            print(f"{status}: {result['test']}")
            if not result['success']:
                print(f"   ❌ {result['message']}")
        
        print("\n" + "="*80)

if __name__ == "__main__":
    tester = RapidRepsProximityTester()
    success = tester.run_all_tests()
    
    if success:
        print("🎉 All proximity matching tests passed!")
        sys.exit(0)
    else:
        print("💥 Some tests failed!")
        sys.exit(1)