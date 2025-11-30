import requests
import json

BASE_URL = "http://localhost:8001/api"

# Try to login with the user's email
user_email = "Ashtonbundy@gmail.com"

print(f"Checking for user: {user_email}\n")

# First, let's create more trainers in Maryland area (close to all the cities mentioned)
# These will be within 10 miles of Laurel/Jessup area

additional_trainers = [
    {
        "fullName": "Marcus Thompson",
        "email": "trainer_marcus@test.com",
        "phone": "555-0104",
        "password": "password123",
        "roles": ["trainer"],
        "latitude": 39.1026,  # Very close to Laurel
        "longitude": -76.8556,
        "locationAddress": "Laurel, MD",
        "bio": "NASM certified. Specializing in weight loss and body transformation. 8+ years experience.",
        "isAvailable": True
    },
    {
        "fullName": "Amanda Foster",
        "email": "trainer_amanda@test.com",
        "phone": "555-0105",
        "password": "password123",
        "roles": ["trainer"],
        "latitude": 39.1100,  # Near Jessup/Laurel
        "longitude": -76.8200,
        "locationAddress": "Jessup, MD",
        "bio": "CrossFit Level 2 trainer. High-intensity workouts that deliver results!",
        "isAvailable": True
    },
    {
        "fullName": "Robert Williams",
        "email": "trainer_robert@test.com",
        "phone": "555-0106",
        "password": "password123",
        "roles": ["trainer"],
        "latitude": 39.1500,  # Between Jessup and Columbia
        "longitude": -76.8000,
        "locationAddress": "Jessup, MD",
        "bio": "Former Marine. Boot camp style training. Let's push your limits!",
        "isAvailable": True
    }
]

print("Creating additional trainers in Laurel/Jessup area...\n")

for trainer_data in additional_trainers:
    try:
        # Sign up
        signup_response = requests.post(f"{BASE_URL}/auth/signup", json={
            "fullName": trainer_data["fullName"],
            "email": trainer_data["email"],
            "phone": trainer_data["phone"],
            "password": trainer_data["password"],
            "roles": trainer_data["roles"]
        })
        
        if signup_response.status_code == 200:
            signup_data = signup_response.json()
            token = signup_data["access_token"]
            user_id = signup_data["user"]["id"]
            
            print(f"✅ Created trainer: {trainer_data['fullName']}")
            
            # Create trainer profile
            profile_response = requests.post(
                f"{BASE_URL}/trainer-profiles",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "userId": user_id,
                    "bio": trainer_data["bio"],
                    "experienceYears": 7,
                    "certifications": ["NASM-CPT", "ACE", "ISSA"],
                    "trainingStyles": ["Strength Training", "HIIT", "Cardio", "Weight Loss"],
                    "primaryGym": "Gold's Gym",
                    "offersInPerson": True,
                    "offersVirtual": True,
                    "ratePerMinuteCents": 100,
                    "latitude": trainer_data["latitude"],
                    "longitude": trainer_data["longitude"],
                    "locationAddress": trainer_data["locationAddress"],
                    "isAvailable": trainer_data["isAvailable"],
                    "isVirtualTrainingAvailable": True
                }
            )
            
            if profile_response.status_code == 200:
                print(f"   ✅ Profile created at {trainer_data['locationAddress']}")
                print(f"   📍 Coordinates: ({trainer_data['latitude']}, {trainer_data['longitude']})")
            else:
                print(f"   ❌ Failed to create profile: {profile_response.text}")
        else:
            error_msg = signup_response.json().get('detail', signup_response.text)
            if "Email already registered" in error_msg:
                print(f"ℹ️  {trainer_data['fullName']} already exists")
            else:
                print(f"❌ Failed to create {trainer_data['fullName']}: {error_msg}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    
    print()

print("\n" + "="*60)
print("SUMMARY OF ALL TRAINERS IN MARYLAND AREA")
print("="*60 + "\n")

# Login as a trainee and search
login_response = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "trainee1@test.com",
    "password": "password123"
})

if login_response.status_code == 200:
    token = login_response.json()["access_token"]
    
    # Search from Laurel location WITHOUT virtual filter to see only nearby trainers
    search_response = requests.get(
        f"{BASE_URL}/trainers/search",
        headers={"Authorization": f"Bearer {token}"},
        params={
            "latitude": 39.0993,  # Laurel, MD
            "longitude": -76.8483,
            "wantsVirtual": False  # Only show local trainers within 10 miles
        }
    )
    
    if search_response.status_code == 200:
        trainers = search_response.json()
        
        # Calculate distances
        from math import radians, sin, cos, sqrt, atan2
        
        def calc_distance(lat1, lon1, lat2, lon2):
            R = 3959
            lat1, lon1 = radians(lat1), radians(lon1)
            lat2, lon2 = radians(lat2), radians(lon2)
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            return R * c
        
        trainers_with_distance = []
        for trainer in trainers:
            if trainer.get('latitude') and trainer.get('longitude'):
                distance = calc_distance(39.0993, -76.8483, trainer['latitude'], trainer['longitude'])
                trainers_with_distance.append((trainer, distance))
        
        trainers_with_distance.sort(key=lambda x: x[1])
        
        print(f"Found {len(trainers_with_distance)} trainers within 10 miles of Laurel, MD:\n")
        
        for trainer, distance in trainers_with_distance:
            print(f"📍 {trainer.get('bio', 'Trainer')[:50]}...")
            print(f"   Location: {trainer.get('locationAddress')}")
            print(f"   Distance: {distance:.2f} miles")
            print(f"   Available: {'✅ Online' if trainer.get('isAvailable') else '❌ Offline'}")
            print()

print("\n" + "="*60)        
print("ALL TEST ACCOUNTS (for user testing):")
print("="*60)
print("\nTRAINERS:")
print("  - trainer1@test.com / password123 (Mike Johnson - Laurel)")
print("  - trainer2@test.com / password123 (Sarah Williams - Jessup)")
print("  - trainer3@test.com / password123 (David Chen - Elkridge)")
print("  - trainer_marcus@test.com / password123 (Marcus Thompson - Laurel)")
print("  - trainer_amanda@test.com / password123 (Amanda Foster - Jessup)")
print("  - trainer_robert@test.com / password123 (Robert Williams - Jessup)")
print("\nTRAINEES:")
print("  - trainee1@test.com / password123 (Jessica Martinez - Laurel)")
print("  - trainee2@test.com / password123 (Tom Rodriguez - Columbia)")

print("\n✅ Setup complete! You can now test with Ashtonbundy@gmail.com")
