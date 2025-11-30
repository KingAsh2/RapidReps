import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8001/api"

# Test locations (Maryland area - around Baltimore/Laurel area as user mentioned)
locations = {
    "laurel_md": {
        "latitude": 39.0993,
        "longitude": -76.8483,
        "address": "Laurel, MD"
    },
    "jessup_md": {
        "latitude": 39.1437,
        "longitude": -76.7747,
        "address": "Jessup, MD"
    },
    "columbia_md": {
        "latitude": 39.2037,
        "longitude": -76.8610,
        "address": "Columbia, MD"
    },
    "baltimore_md": {
        "latitude": 39.2904,
        "longitude": -76.6122,
        "address": "Baltimore, MD"
    },
    "elkridge_md": {
        "latitude": 39.2123,
        "longitude": -76.7136,
        "address": "Elkridge, MD"
    }
}

# Test users to create
test_users = [
    {
        "fullName": "Mike Johnson",
        "email": "trainer1@test.com",
        "phone": "555-0101",
        "password": "password123",
        "roles": ["trainer"],
        "location": locations["laurel_md"],
        "bio": "10 years of strength training experience. Specializing in powerlifting and bodybuilding.",
        "isAvailable": True
    },
    {
        "fullName": "Sarah Williams",
        "email": "trainer2@test.com",
        "phone": "555-0102",
        "password": "password123",
        "roles": ["trainer"],
        "location": locations["jessup_md"],
        "bio": "Certified yoga instructor and nutrition coach. Let's transform your lifestyle!",
        "isAvailable": True
    },
    {
        "fullName": "David Chen",
        "email": "trainer3@test.com",
        "phone": "555-0103",
        "password": "password123",
        "roles": ["trainer"],
        "location": locations["elkridge_md"],
        "bio": "Former NCAA athlete. HIIT and functional fitness specialist.",
        "isAvailable": True
    },
    {
        "fullName": "Jessica Martinez",
        "email": "trainee1@test.com",
        "phone": "555-0201",
        "password": "password123",
        "roles": ["trainee"],
        "location": locations["laurel_md"],
        "goals": "Lose 30 pounds and build confidence. Want to fit into my wedding dress!",
        "experience": "Never trained"
    },
    {
        "fullName": "Tom Rodriguez",
        "email": "trainee2@test.com",
        "phone": "555-0202",
        "password": "password123",
        "roles": ["trainee"],
        "location": locations["columbia_md"],
        "goals": "Build muscle and improve athletic performance for basketball season.",
        "experience": "Some experience"
    }
]

created_users = []

print("Creating test users and profiles...\n")

for user_data in test_users:
    try:
        # 1. Sign up user
        signup_response = requests.post(f"{BASE_URL}/auth/signup", json={
            "fullName": user_data["fullName"],
            "email": user_data["email"],
            "phone": user_data["phone"],
            "password": user_data["password"],
            "roles": user_data["roles"]
        })
        
        if signup_response.status_code == 200:
            signup_data = signup_response.json()
            token = signup_data["access_token"]
            user_id = signup_data["user"]["id"]
            
            print(f"✅ Created user: {user_data['fullName']} ({user_data['email']})")
            
            # 2. Create profile based on role
            if "trainer" in user_data["roles"]:
                profile_response = requests.post(
                    f"{BASE_URL}/trainer-profiles",
                    headers={"Authorization": f"Bearer {token}"},
                    json={
                        "userId": user_id,
                        "bio": user_data["bio"],
                        "experienceYears": 5,
                        "certifications": ["NASM-CPT", "ACE"],
                        "trainingStyles": ["Strength Training", "HIIT", "Cardio"],
                        "primaryGym": "LA Fitness",
                        "offersInPerson": True,
                        "offersVirtual": True,
                        "ratePerMinuteCents": 100,
                        "latitude": user_data["location"]["latitude"],
                        "longitude": user_data["location"]["longitude"],
                        "locationAddress": user_data["location"]["address"],
                        "isAvailable": user_data["isAvailable"],
                        "isVirtualTrainingAvailable": True
                    }
                )
                
                if profile_response.status_code == 200:
                    print(f"   ✅ Created trainer profile at {user_data['location']['address']}")
                    created_users.append({
                        "name": user_data["fullName"],
                        "email": user_data["email"],
                        "password": user_data["password"],
                        "role": "trainer",
                        "token": token,
                        "userId": user_id
                    })
                else:
                    print(f"   ❌ Failed to create trainer profile: {profile_response.text}")
                    
            elif "trainee" in user_data["roles"]:
                profile_response = requests.post(
                    f"{BASE_URL}/trainee-profiles",
                    headers={"Authorization": f"Bearer {token}"},
                    json={
                        "userId": user_id,
                        "fitnessGoals": user_data["goals"],
                        "experienceLevel": user_data["experience"],
                        "currentFitnessLevel": "beginner",
                        "preferredTrainingStyles": ["Strength Training", "Cardio"],
                        "prefersInPerson": True,
                        "prefersVirtual": False,
                        "isVirtualEnabled": False,
                        "budgetMinPerMinuteCents": 50,
                        "budgetMaxPerMinuteCents": 150,
                        "latitude": user_data["location"]["latitude"],
                        "longitude": user_data["location"]["longitude"],
                        "locationAddress": user_data["location"]["address"]
                    }
                )
                
                if profile_response.status_code == 200:
                    print(f"   ✅ Created trainee profile at {user_data['location']['address']}")
                    created_users.append({
                        "name": user_data["fullName"],
                        "email": user_data["email"],
                        "password": user_data["password"],
                        "role": "trainee",
                        "token": token,
                        "userId": user_id
                    })
                else:
                    print(f"   ❌ Failed to create trainee profile: {profile_response.text}")
        else:
            print(f"❌ Failed to create user {user_data['email']}: {signup_response.text}")
            
    except Exception as e:
        print(f"❌ Error creating {user_data['email']}: {str(e)}")

print("\n" + "="*60)
print("TEST ACCOUNTS CREATED:")
print("="*60)
for user in created_users:
    print(f"\n{user['role'].upper()}: {user['name']}")
    print(f"  Email: {user['email']}")
    print(f"  Password: {user['password']}")

print("\n" + "="*60)
print("TESTING PROXIMITY MATCHING")
print("="*60)

# Test trainee searching for trainers
trainee = next((u for u in created_users if u['role'] == 'trainee'), None)
if trainee:
    print(f"\n🔍 Testing search as {trainee['name']} from Laurel, MD...")
    search_response = requests.get(
        f"{BASE_URL}/trainers/search",
        headers={"Authorization": f"Bearer {trainee['token']}"},
        params={
            "latitude": locations["laurel_md"]["latitude"],
            "longitude": locations["laurel_md"]["longitude"],
            "wantsVirtual": True
        }
    )
    
    if search_response.status_code == 200:
        trainers = search_response.json()
        print(f"   ✅ Found {len(trainers)} available trainers")
        for trainer in trainers:
            distance = None
            if trainer.get('latitude') and trainer.get('longitude'):
                # Calculate distance
                from math import radians, sin, cos, sqrt, atan2
                R = 3959
                lat1 = radians(locations["laurel_md"]["latitude"])
                lon1 = radians(locations["laurel_md"]["longitude"])
                lat2 = radians(trainer['latitude'])
                lon2 = radians(trainer['longitude'])
                dlat = lat2 - lat1
                dlon = lon2 - lon1
                a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                c = 2 * atan2(sqrt(a), sqrt(1-a))
                distance = R * c
            
            print(f"      - {trainer.get('bio', 'Trainer')[:40]}... at {trainer.get('locationAddress', 'Unknown')}")
            if distance:
                print(f"        Distance: {distance:.1f} miles")
    else:
        print(f"   ❌ Search failed: {search_response.text}")

# Test trainer checking nearby trainees
trainer = next((u for u in created_users if u['role'] == 'trainer'), None)
if trainer:
    print(f"\n🔍 Testing nearby trainees for {trainer['name']}...")
    nearby_response = requests.get(
        f"{BASE_URL}/trainers/nearby-trainees",
        headers={"Authorization": f"Bearer {trainer['token']}"}
    )
    
    if nearby_response.status_code == 200:
        data = nearby_response.json()
        trainees = data.get('trainees', [])
        print(f"   ✅ Found {len(trainees)} nearby trainees")
        for t in trainees:
            print(f"      - {t.get('fullName', 'Unknown')} at {t.get('locationAddress', 'Unknown')}")
            print(f"        Distance: {t.get('distance', 'N/A')} miles")
            print(f"        Goals: {t.get('fitnessGoals', 'Not set')[:50]}...")
    else:
        print(f"   ❌ Failed to get nearby trainees: {nearby_response.text}")

print("\n✅ Test data creation complete!")
