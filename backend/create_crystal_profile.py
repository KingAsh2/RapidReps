import requests

BASE_URL = "http://localhost:8001/api"

# Login as Crystal
print("Creating trainer profile for Crystal (fedsense@gmail.com)...\n")
login = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "fedsense@gmail.com",
    "password": "superman"
})

if login.status_code == 200:
    data = login.json()
    token = data["access_token"]
    user_id = data["user"]["id"]
    
    print(f"✅ Logged in as {data['user']['fullName']}")
    print(f"User ID: {user_id}\n")
    
    # Get Ashton's location (should be near Laurel/Jessup area)
    # Let's use a location near Laurel, MD
    ashton_lat = 39.0993  # Laurel, MD
    ashton_lon = -76.8483
    
    # Create Crystal's profile near Ashton's location
    crystal_lat = 39.1200  # About 1.5 miles from Laurel
    crystal_lon = -76.8300
    
    print("Creating trainer profile...")
    profile_data = {
        "userId": user_id,
        "bio": "Certified personal trainer with 5 years experience. Specializing in women's fitness and strength training.",
        "experienceYears": 5,
        "certifications": ["NASM-CPT", "ACE", "Nutrition Coach"],
        "trainingStyles": ["Strength Training", "HIIT", "Weight Loss", "Nutrition"],
        "gymsWorkedAt": ["Equinox", "Gold's Gym", "Planet Fitness"],
        "primaryGym": "Equinox Downtown",
        "offersInPerson": True,
        "offersVirtual": True,
        "sessionDurationsOffered": [30, 45, 60],
        "ratePerMinuteCents": 100,
        "travelRadiusMiles": 10,
        "cancellationPolicy": "Free cancellation before 24 hours",
        "latitude": crystal_lat,
        "longitude": crystal_lon,
        "locationAddress": "Laurel, MD",
        "isAvailable": True,
        "isVirtualTrainingAvailable": True,
        "videoCallPreference": "native"
    }
    
    response = requests.post(
        f"{BASE_URL}/trainer-profiles",
        headers={"Authorization": f"Bearer {token}"},
        json=profile_data
    )
    
    if response.status_code == 200:
        profile = response.json()
        print("✅ Profile created successfully!\n")
        print(f"Profile ID: {profile['id']}")
        print(f"Bio: {profile['bio']}")
        print(f"Location: {profile['locationAddress']}")
        print(f"Coordinates: ({profile['latitude']}, {profile['longitude']})")
        print(f"Available: {profile['isAvailable']}")
        
        # Calculate distance from Ashton's location
        from math import radians, sin, cos, sqrt, atan2
        R = 3959
        lat1, lon1 = radians(ashton_lat), radians(ashton_lon)
        lat2, lon2 = radians(crystal_lat), radians(crystal_lon)
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance = R * c
        
        print(f"\n📍 Crystal is {distance:.1f} miles from Ashton's location")
        print(f"   Should be visible to Ashton (within 15-mile radius) ✅")
    else:
        print(f"❌ Failed to create profile: {response.status_code}")
        print(f"   {response.text}")
else:
    print(f"❌ Login failed: {login.status_code}")
    print(f"   {login.text}")
