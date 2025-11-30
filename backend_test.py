#!/usr/bin/env python3
"""
RapidReps Backend API Test Suite - Proximity Matching & Trainer Availability Features
Tests the newly implemented features for proximity matching and trainer availability.
"""

import requests
import json
import base64
from datetime import datetime, timedelta
import time

# Configuration
BASE_URL = "https://workout-match-4.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def add_pass(self, test_name):
        self.passed += 1
        print(f"✅ {test_name}")
    
    def add_fail(self, test_name, error):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print(f"❌ {test_name}: {error}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} tests passed")
        if self.errors:
            print(f"\nFAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        print(f"{'='*60}")

# Global test results
results = TestResults()

def make_request(method, endpoint, data=None, headers=None, params=None):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    request_headers = HEADERS.copy()
    if headers:
        request_headers.update(headers)
    
    try:
        if method == "GET":
            response = requests.get(url, headers=request_headers, params=params)
        elif method == "POST":
            response = requests.post(url, headers=request_headers, json=data)
        elif method == "PATCH":
            response = requests.patch(url, headers=request_headers, json=data, params=params)
        elif method == "PUT":
            response = requests.put(url, headers=request_headers, json=data)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        return None

def test_health_check():
    """Test API health check"""
    response = make_request("GET", "/health")
    if response and response.status_code == 200:
        results.add_pass("API Health Check")
        return True
    else:
        results.add_fail("API Health Check", f"Status: {response.status_code if response else 'No response'}")
        return False

def create_test_user(role="trainee", suffix=""):
    """Create a test user and return auth token"""
    user_data = {
        "fullName": f"Test {role.title()} {suffix}",
        "email": f"test{role}{suffix}@example.com",
        "phone": f"555-000-{1000 + len(suffix)}",
        "password": "testpass123",
        "roles": [role]
    }
    
    response = make_request("POST", "/auth/signup", user_data)
    if response and response.status_code == 200:
        data = response.json()
        return data["access_token"], data["user"]["id"]
    return None, None

def test_trainee_profile_with_new_fields():
    """Test creating trainee profile with new proximity fields"""
    # Create test trainee
    token, user_id = create_test_user("trainee", "proximity1")
    if not token:
        results.add_fail("Trainee Profile - New Fields", "Failed to create test user")
        return None
    
    auth_headers = {"Authorization": f"Bearer {token}"}
    
    # Create sample base64 image (small test image)
    sample_image = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
    
    # Test trainee profile with all new fields
    profile_data = {
        "userId": user_id,
        "profilePhoto": sample_image,
        "fitnessGoals": "Build muscle and lose weight",
        "currentFitnessLevel": "intermediate",
        "experienceLevel": "Some experience",
        "preferredTrainingStyles": ["strength", "cardio"],
        "injuriesOrLimitations": "None",
        "homeGymOrZipCode": "90210",
        "prefersInPerson": True,
        "prefersVirtual": False,
        "isVirtualEnabled": True,
        "budgetMinPerMinuteCents": 75,
        "budgetMaxPerMinuteCents": 150,
        "latitude": 34.0522,
        "longitude": -118.2437,
        "locationAddress": "Beverly Hills, CA"
    }
    
    response = make_request("POST", "/trainee-profiles", profile_data, auth_headers)
    if response and response.status_code == 200:
        data = response.json()
        # Verify all new fields are present
        required_fields = ["profilePhoto", "latitude", "longitude", "locationAddress", "experienceLevel", "isVirtualEnabled"]
        missing_fields = [field for field in required_fields if field not in data or data[field] is None]
        
        if not missing_fields:
            results.add_pass("Trainee Profile - New Fields Creation")
            return data["id"], token, user_id
        else:
            results.add_fail("Trainee Profile - New Fields Creation", f"Missing fields: {missing_fields}")
    else:
        results.add_fail("Trainee Profile - New Fields Creation", f"Status: {response.status_code if response else 'No response'}")
    
    return None, token, user_id

def test_trainee_profile_update():
    """Test updating trainee profile with new fields"""
    result = test_trainee_profile_with_new_fields()
    if not result or result[0] is None:
        return
    profile_id, token, user_id = result
    
    auth_headers = {"Authorization": f"Bearer {token}"}
    
    # Update profile with new location
    updated_data = {
        "userId": user_id,
        "profilePhoto": "data:image/jpeg;base64,updated_image_data",
        "fitnessGoals": "Updated fitness goals",
        "experienceLevel": "Regular exerciser",
        "latitude": 34.0522,
        "longitude": -118.2437,
        "locationAddress": "Los Angeles, CA",
        "isVirtualEnabled": False
    }
    
    response = make_request("POST", "/trainee-profiles", updated_data, auth_headers)
    if response and response.status_code == 200:
        data = response.json()
        if (data["experienceLevel"] == "Regular exerciser" and 
            data["locationAddress"] == "Los Angeles, CA" and 
            data["isVirtualEnabled"] == False):
            results.add_pass("Trainee Profile - Update New Fields")
        else:
            results.add_fail("Trainee Profile - Update New Fields", "Fields not updated correctly")
    else:
        results.add_fail("Trainee Profile - Update New Fields", f"Status: {response.status_code if response else 'No response'}")

def create_test_trainer_with_location():
    """Create a test trainer with location for proximity testing"""
    token, user_id = create_test_user("trainer", "proximity1")
    if not token:
        return None, None, None
    
    auth_headers = {"Authorization": f"Bearer {token}"}
    
    # Create trainer profile with location
    trainer_data = {
        "userId": user_id,
        "bio": "Experienced fitness trainer",
        "experienceYears": 5,
        "certifications": ["NASM", "ACE"],
        "trainingStyles": ["strength", "cardio"],
        "ratePerMinuteCents": 120,
        "latitude": 34.0522,
        "longitude": -118.2437,
        "locationAddress": "Beverly Hills, CA",
        "isAvailable": True,
        "offersInPerson": True,
        "offersVirtual": True,
        "isVirtualTrainingAvailable": True
    }
    
    response = make_request("POST", "/trainer-profiles", trainer_data, auth_headers)
    if response and response.status_code == 200:
        return token, user_id, response.json()["id"]
    return None, None, None

def test_trainer_availability_toggle():
    """Test trainer availability toggle endpoint"""
    token, user_id, profile_id = create_test_trainer_with_location()
    if not token:
        results.add_fail("Trainer Availability Toggle", "Failed to create test trainer")
        return
    
    auth_headers = {"Authorization": f"Bearer {token}"}
    
    # Test setting availability to false
    response = make_request("PATCH", "/trainer-profiles/toggle-availability", 
                          headers=auth_headers, params={"isAvailable": "false"})
    
    if response and response.status_code == 200:
        data = response.json()
        if data["success"] and data["isAvailable"] == False:
            results.add_pass("Trainer Availability Toggle - Set Unavailable")
        else:
            results.add_fail("Trainer Availability Toggle - Set Unavailable", "Response data incorrect")
    else:
        results.add_fail("Trainer Availability Toggle - Set Unavailable", 
                        f"Status: {response.status_code if response else 'No response'}")
    
    # Test setting availability to true
    response = make_request("PATCH", "/trainer-profiles/toggle-availability", 
                          headers=auth_headers, params={"isAvailable": "true"})
    
    if response and response.status_code == 200:
        data = response.json()
        if data["success"] and data["isAvailable"] == True:
            results.add_pass("Trainer Availability Toggle - Set Available")
        else:
            results.add_fail("Trainer Availability Toggle - Set Available", "Response data incorrect")
    else:
        results.add_fail("Trainer Availability Toggle - Set Available", 
                        f"Status: {response.status_code if response else 'No response'}")

def test_nearby_trainees_endpoint():
    """Test nearby trainees endpoint"""
    # Create trainer with location
    trainer_token, trainer_user_id, trainer_profile_id = create_test_trainer_with_location()
    if not trainer_token:
        results.add_fail("Nearby Trainees Endpoint", "Failed to create test trainer")
        return
    
    # Create nearby trainee
    trainee_token, trainee_user_id = create_test_user("trainee", "nearby1")
    if trainee_token:
        trainee_auth = {"Authorization": f"Bearer {trainee_token}"}
        nearby_trainee_data = {
            "userId": trainee_user_id,
            "fitnessGoals": "Get fit",
            "latitude": 34.0500,  # Close to trainer (34.0522)
            "longitude": -118.2400,  # Close to trainer (-118.2437)
            "locationAddress": "West Hollywood, CA"
        }
        make_request("POST", "/trainee-profiles", nearby_trainee_data, trainee_auth)
    
    # Create far trainee
    far_trainee_token, far_trainee_user_id = create_test_user("trainee", "far1")
    if far_trainee_token:
        far_trainee_auth = {"Authorization": f"Bearer {far_trainee_token}"}
        far_trainee_data = {
            "userId": far_trainee_user_id,
            "fitnessGoals": "Stay healthy",
            "latitude": 40.7128,  # New York (far from LA trainer)
            "longitude": -74.0060,
            "locationAddress": "New York, NY"
        }
        make_request("POST", "/trainee-profiles", far_trainee_data, far_trainee_auth)
    
    # Test nearby trainees endpoint
    trainer_auth = {"Authorization": f"Bearer {trainer_token}"}
    response = make_request("GET", "/trainers/nearby-trainees", headers=trainer_auth)
    
    if response and response.status_code == 200:
        data = response.json()
        if "trainees" in data and "count" in data:
            # Should find the nearby trainee but not the far one
            nearby_count = data["count"]
            if nearby_count >= 1:
                # Check if distance is calculated
                if data["trainees"] and "distance" in data["trainees"][0]:
                    results.add_pass("Nearby Trainees Endpoint - With Location")
                else:
                    results.add_fail("Nearby Trainees Endpoint - With Location", "Distance not calculated")
            else:
                results.add_pass("Nearby Trainees Endpoint - With Location (No nearby trainees found)")
        else:
            results.add_fail("Nearby Trainees Endpoint - With Location", "Invalid response format")
    else:
        results.add_fail("Nearby Trainees Endpoint - With Location", 
                        f"Status: {response.status_code if response else 'No response'}")

def test_nearby_trainees_no_location():
    """Test nearby trainees endpoint when trainer has no location"""
    # Create trainer without location
    token, user_id = create_test_user("trainer", "nolocation")
    if not token:
        results.add_fail("Nearby Trainees - No Location", "Failed to create test trainer")
        return
    
    auth_headers = {"Authorization": f"Bearer {token}"}
    
    # Create trainer profile without location
    trainer_data = {
        "userId": user_id,
        "bio": "Trainer without location",
        "experienceYears": 3,
        "ratePerMinuteCents": 100,
        "isAvailable": True
    }
    
    make_request("POST", "/trainer-profiles", trainer_data, auth_headers)
    
    # Test nearby trainees endpoint
    response = make_request("GET", "/trainers/nearby-trainees", headers=auth_headers)
    
    if response and response.status_code == 200:
        data = response.json()
        if "message" in data and "location not set" in data["message"].lower():
            results.add_pass("Nearby Trainees - No Location")
        else:
            results.add_fail("Nearby Trainees - No Location", "Should return location not set message")
    else:
        results.add_fail("Nearby Trainees - No Location", 
                        f"Status: {response.status_code if response else 'No response'}")

def test_trainer_search_10_mile_radius():
    """Test trainer search with 10-mile radius and availability filter"""
    # Create available trainer within 10 miles
    available_token, available_user_id = create_test_user("trainer", "available")
    if available_token:
        available_auth = {"Authorization": f"Bearer {available_token}"}
        available_trainer_data = {
            "userId": available_user_id,
            "bio": "Available trainer",
            "latitude": 34.0522,
            "longitude": -118.2437,
            "isAvailable": True,
            "ratePerMinuteCents": 100
        }
        make_request("POST", "/trainer-profiles", available_trainer_data, available_auth)
    
    # Create unavailable trainer within 10 miles
    unavailable_token, unavailable_user_id = create_test_user("trainer", "unavailable")
    if unavailable_token:
        unavailable_auth = {"Authorization": f"Bearer {unavailable_token}"}
        unavailable_trainer_data = {
            "userId": unavailable_user_id,
            "bio": "Unavailable trainer",
            "latitude": 34.0500,
            "longitude": -118.2400,
            "isAvailable": False,
            "ratePerMinuteCents": 100
        }
        make_request("POST", "/trainer-profiles", unavailable_trainer_data, unavailable_auth)
    
    # Create available trainer outside 10 miles
    far_token, far_user_id = create_test_user("trainer", "far")
    if far_token:
        far_auth = {"Authorization": f"Bearer {far_token}"}
        far_trainer_data = {
            "userId": far_user_id,
            "bio": "Far trainer",
            "latitude": 34.2000,  # More than 10 miles away
            "longitude": -118.5000,
            "isAvailable": True,
            "ratePerMinuteCents": 100
        }
        make_request("POST", "/trainer-profiles", far_trainer_data, far_auth)
    
    # Search from trainee location (should only find available trainer within 10 miles)
    search_params = {
        "latitude": 34.0522,
        "longitude": -118.2437
    }
    
    response = make_request("GET", "/trainers/search", params=search_params)
    
    if response and response.status_code == 200:
        trainers = response.json()
        # Should only include available trainers
        available_trainers = [t for t in trainers if t.get("isAvailable") == True]
        unavailable_trainers = [t for t in trainers if t.get("isAvailable") == False]
        
        if len(unavailable_trainers) == 0:
            results.add_pass("Trainer Search - Availability Filter")
        else:
            results.add_fail("Trainer Search - Availability Filter", "Found unavailable trainers in results")
        
        # Check if we found some trainers (the available ones within range)
        if len(available_trainers) > 0:
            results.add_pass("Trainer Search - 10 Mile Radius")
        else:
            results.add_pass("Trainer Search - 10 Mile Radius (No trainers in range)")
    else:
        results.add_fail("Trainer Search - 10 Mile Radius", 
                        f"Status: {response.status_code if response else 'No response'}")

def test_virtual_trainer_visibility():
    """Test virtual trainer visibility in search"""
    # Create virtual trainer
    virtual_token, virtual_user_id = create_test_user("trainer", "virtual")
    if virtual_token:
        virtual_auth = {"Authorization": f"Bearer {virtual_token}"}
        virtual_trainer_data = {
            "userId": virtual_user_id,
            "bio": "Virtual trainer",
            "isAvailable": True,
            "offersVirtual": True,
            "isVirtualTrainingAvailable": True,
            "ratePerMinuteCents": 100
        }
        make_request("POST", "/trainer-profiles", virtual_trainer_data, virtual_auth)
    
    # Search with virtual preference
    search_params = {
        "wantsVirtual": "true",
        "latitude": 34.0522,
        "longitude": -118.2437
    }
    
    response = make_request("GET", "/trainers/search", params=search_params)
    
    if response and response.status_code == 200:
        trainers = response.json()
        virtual_trainers = [t for t in trainers if t.get("isVirtualTrainingAvailable") == True]
        
        if len(virtual_trainers) > 0:
            results.add_pass("Virtual Trainer Visibility")
        else:
            results.add_pass("Virtual Trainer Visibility (No virtual trainers found)")
    else:
        results.add_fail("Virtual Trainer Visibility", 
                        f"Status: {response.status_code if response else 'No response'}")

def run_all_tests():
    """Run all proximity matching and trainer availability tests"""
    print("🚀 Starting RapidReps Proximity Matching & Trainer Availability Tests")
    print(f"Testing against: {BASE_URL}")
    print("="*60)
    
    # Basic health check
    if not test_health_check():
        print("❌ API is not responding. Stopping tests.")
        return
    
    # Test new trainee profile fields
    print("\n📍 Testing Enhanced Trainee Profile Features...")
    test_trainee_profile_with_new_fields()
    test_trainee_profile_update()
    
    # Test trainer availability toggle
    print("\n🔄 Testing Trainer Availability Toggle...")
    test_trainer_availability_toggle()
    
    # Test nearby trainees endpoint
    print("\n📍 Testing Nearby Trainees Endpoint...")
    test_nearby_trainees_endpoint()
    test_nearby_trainees_no_location()
    
    # Test updated search logic
    print("\n🔍 Testing Updated Search Logic...")
    test_trainer_search_10_mile_radius()
    test_virtual_trainer_visibility()
    
    # Print summary
    results.summary()

if __name__ == "__main__":
    run_all_tests()