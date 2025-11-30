import requests

BASE_URL = "http://localhost:8001/api"

print("Testing Crystal's profile update functionality...\n")

# Login as Crystal
login = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "fedsense@gmail.com",
    "password": "superman"
})

if login.status_code == 200:
    token = login.json()["access_token"]
    user_id = login.json()["user"]["id"]
    print(f"✅ Logged in as Crystal\n")
    
    # Update profile (simulating what the frontend would do)
    print("Updating profile with new data...")
    update_data = {
        "userId": user_id,
        "bio": "UPDATED: Expert trainer specializing in strength and conditioning!",
        "experienceYears": 7,
        "certifications": ["NASM-CPT", "ACE", "CrossFit Level 1"],
        "trainingStyles": ["Strength Training", "CrossFit", "HIIT"],
        "gymsWorkedAt": ["Equinox", "Gold's Gym"],
        "primaryGym": "Equinox Downtown",
        "offersInPerson": True,
        "offersVirtual": True,
        "sessionDurationsOffered": [30, 45, 60],
        "ratePerMinuteCents": 120,
        "travelRadiusMiles": 15,
        "cancellationPolicy": "24 hour cancellation required",
        "latitude": 39.12,
        "longitude": -76.83,
        "locationAddress": "Laurel, MD",
        "isAvailable": True,
        "isVirtualTrainingAvailable": True
    }
    
    response = requests.post(
        f"{BASE_URL}/trainer-profiles",
        headers={"Authorization": f"Bearer {token}"},
        json=update_data
    )
    
    if response.status_code == 200:
        profile = response.json()
        print("✅ Profile updated successfully!")
        print(f"\nUpdated values:")
        print(f"   Bio: {profile['bio'][:60]}...")
        print(f"   Experience: {profile['experienceYears']} years")
        print(f"   Rate: ${profile['ratePerMinuteCents'] / 100}/min")
        print(f"   Location: {profile['locationAddress']}")
        
        # Verify the changes persisted
        print("\nVerifying changes persisted...")
        verify = requests.get(
            f"{BASE_URL}/trainer-profiles/{user_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if verify.status_code == 200:
            verified_profile = verify.json()
            if verified_profile['bio'] == profile['bio']:
                print("✅ Changes confirmed - profile save is working!")
            else:
                print("❌ Changes not persisted")
        else:
            print(f"⚠️  Verification failed: {verify.status_code}")
    else:
        print(f"❌ Update failed: {response.status_code}")
        print(f"   Error: {response.text}")
else:
    print(f"❌ Login failed: {login.status_code}")

print("\n" + "="*60)
print("FRONTEND SHOULD NOW BE ABLE TO:")
print("="*60)
print("1. Login as fedsense@gmail.com / superman")
print("2. Navigate to Edit Profile")
print("3. Make changes to any fields")
print("4. Click 'Save Changes' button")
print("5. See success message and return to home screen")
print("\nIf this still doesn't work, there may be a frontend JavaScript error.")
print("Check the browser console or Expo logs for errors.")
