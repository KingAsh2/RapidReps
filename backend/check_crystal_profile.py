import requests

BASE_URL = "http://localhost:8001/api"

# Login as Crystal
print("Logging in as Crystal (fedsense@gmail.com)...\n")
login = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "fedsense@gmail.com",
    "password": "superman"
})

if login.status_code == 200:
    data = login.json()
    token = data["access_token"]
    user_id = data["user"]["id"]
    
    print(f"✅ Login successful!")
    print(f"User ID: {user_id}")
    print(f"Full Name: {data['user']['fullName']}")
    print(f"Roles: {data['user']['roles']}\n")
    
    # Check if trainer profile exists
    print("Checking for trainer profile...\n")
    profile_response = requests.get(
        f"{BASE_URL}/trainer-profiles/{user_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if profile_response.status_code == 200:
        profile = profile_response.json()
        print("✅ Trainer profile EXISTS:")
        print(f"   Bio: {profile.get('bio', 'Not set')}")
        print(f"   Location: {profile.get('locationAddress', 'Not set')}")
        print(f"   Coordinates: ({profile.get('latitude')}, {profile.get('longitude')})")
        print(f"   Available: {profile.get('isAvailable')}")
        print(f"   Experience: {profile.get('experienceYears')} years")
        print(f"   Rate: ${profile.get('ratePerMinuteCents', 0) / 100}/min")
    elif profile_response.status_code == 404:
        print("❌ NO trainer profile found - needs to be created")
    else:
        print(f"❌ Error checking profile: {profile_response.status_code}")
        print(f"   {profile_response.text}")
else:
    print(f"❌ Login failed: {login.status_code}")
    print(f"   {login.text}")
