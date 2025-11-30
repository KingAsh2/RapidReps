import requests

BASE_URL = "http://localhost:8001/api"

print("Setting up Ashton's account...\n")

# Try to create Ashton's account as a trainee
signup = requests.post(f"{BASE_URL}/auth/signup", json={
    "fullName": "Ashton Bundy",
    "email": "ashtonbundy@gmail.com",
    "phone": "555-ASHTON",
    "password": "password123",
    "roles": ["trainee"]
})

if signup.status_code == 200:
    data = signup.json()
    token = data["access_token"]
    user_id = data["user"]["id"]
    
    print(f"✅ Account created for Ashton!")
    print(f"User ID: {user_id}\n")
    
    # Create trainee profile
    print("Creating trainee profile...")
    profile = requests.post(
        f"{BASE_URL}/trainee-profiles",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "userId": user_id,
            "fitnessGoals": "Get back in shape and build strength",
            "experienceLevel": "Some experience",
            "currentFitnessLevel": "intermediate",
            "preferredTrainingStyles": ["Strength Training", "HIIT"],
            "prefersInPerson": True,
            "prefersVirtual": False,
            "isVirtualEnabled": False,
            "budgetMinPerMinuteCents": 75,
            "budgetMaxPerMinuteCents": 150,
            "latitude": 39.0993,  # Laurel, MD
            "longitude": -76.8483,
            "locationAddress": "Laurel, MD"
        }
    )
    
    if profile.status_code == 200:
        print("✅ Trainee profile created!")
    else:
        print(f"⚠️  Profile creation: {profile.status_code}")
else:
    error = signup.json().get('detail', '')
    if "Email already registered" in error:
        print("ℹ️  Account already exists for ashtonbundy@gmail.com")
        print("   Password should be: password123")
    else:
        print(f"❌ Signup failed: {signup.status_code}")
        print(f"   {signup.text}")

# Now test the search
print("\n" + "="*60)
print("Testing search...")
print("="*60 + "\n")

login = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "ashtonbundy@gmail.com",
    "password": "password123"
})

if login.status_code == 200:
    token = login.json()["access_token"]
    print("✅ Login successful\n")
    
    # Search for trainers
    search = requests.get(
        f"{BASE_URL}/trainers/search",
        headers={"Authorization": f"Bearer {token}"},
        params={
            "latitude": 39.0993,
            "longitude": -76.8483,
            "wantsVirtual": False
        }
    )
    
    if search.status_code == 200:
        trainers = search.json()
        print(f"Found {len(trainers)} trainers near Laurel, MD\n")
        
        # Find Crystal
        for trainer in trainers:
            bio = trainer.get('bio', '').lower()
            if 'crystal' in bio or 'women' in bio or 'certified personal trainer with 5 years' in bio.lower():
                print("🎯 CRYSTAL FOUND IN SEARCH RESULTS!")
                print(f"   Bio: {trainer['bio'][:70]}...")
                print(f"   Location: {trainer['locationAddress']}")
                print(f"   Available: {'✅' if trainer.get('isAvailable') else '❌'}")
                print("\n✅ Ashton CAN see Crystal!")
                break
        else:
            print("❌ Crystal not found in results")
    else:
        print(f"❌ Search failed: {search.status_code}")
else:
    print(f"❌ Login failed: {login.status_code}")
