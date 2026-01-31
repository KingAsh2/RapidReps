#!/usr/bin/env python3
"""
Focused test for specific failing endpoints
"""

import requests
import json

BASE_URL = "https://login-logo-rapdreps.preview.emergentagent.com/api"

def test_specific_endpoints():
    # First login to get token
    login_data = {"email": "trainer1@test.com", "password": "test123"}
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        return
        
    token = response.json()["access_token"]
    user_id = response.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    print(f"✅ Login successful, User ID: {user_id}")
    
    # Test 1: Toggle availability (correct way)
    print("\n🔧 Testing toggle availability...")
    response = requests.patch(f"{BASE_URL}/trainer-profiles/toggle-availability?isAvailable=true", headers=headers)
    print(f"Toggle availability: {response.status_code} - {response.text[:200]}")
    
    # Test 2: Nearby trainers (check if it needs authentication)
    print("\n🔧 Testing nearby trainers...")
    response = requests.get(f"{BASE_URL}/trainers/nearby?latitude=39.0&longitude=-77.0")
    print(f"Nearby trainers (no auth): {response.status_code} - {response.text[:200]}")
    
    # Test 3: Virtual session request
    print("\n🔧 Testing virtual session request...")
    virtual_data = {
        "traineeId": user_id,
        "durationMinutes": 30,
        "paymentMethod": "mock",
        "notes": "Test virtual session"
    }
    response = requests.post(f"{BASE_URL}/virtual-sessions/request", json=virtual_data, headers=headers)
    print(f"Virtual session request: {response.status_code} - {response.text[:200]}")
    
    # Test 4: Create conversation (correct way)
    print("\n🔧 Testing create conversation...")
    response = requests.post(f"{BASE_URL}/conversations?receiver_id={user_id}", headers=headers)
    print(f"Create conversation: {response.status_code} - {response.text[:200]}")
    
    # Test 5: Session cancel (should work now)
    print("\n🔧 Testing session cancel...")
    # First create a session
    session_data = {
        "traineeId": user_id,
        "trainerId": user_id,
        "sessionDateTimeStart": "2026-02-01T10:00:00",
        "durationMinutes": 60,
        "locationType": "gym",
        "locationNameOrAddress": "Test Gym"
    }
    response = requests.post(f"{BASE_URL}/sessions", json=session_data, headers=headers)
    if response.status_code == 200:
        session_id = response.json()["id"]
        print(f"Session created: {session_id}")
        
        # Now try to cancel it
        response = requests.patch(f"{BASE_URL}/sessions/{session_id}/cancel", headers=headers)
        print(f"Session cancel: {response.status_code} - {response.text[:200]}")
    else:
        print(f"Session creation failed: {response.status_code} - {response.text[:200]}")

if __name__ == "__main__":
    test_specific_endpoints()