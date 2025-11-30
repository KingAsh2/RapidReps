import requests
from math import radians, sin, cos, sqrt, atan2

BASE_URL = "http://localhost:8001/api"

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 3959
    lat1, lon1 = radians(lat1), radians(lon1)
    lat2, lon2 = radians(lat2), radians(lon2)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

print("="*70)
print("TESTING NEW MATCHING RULES: 15 MILES IN-PERSON | 20 MILES VIRTUAL")
print("="*70 + "\n")

# Create trainers at specific distances from Laurel, MD (39.0993, -76.8483)
test_trainers = [
    {
        "name": "Emma Davis",
        "email": "trainer_emma@test.com",
        "lat": 39.2500,  # ~12 miles from Laurel (in-person range)
        "lon": -76.8000,
        "location": "Columbia, MD",
        "bio": "Yoga and flexibility specialist. Mind-body connection.",
        "offers_in_person": True,
        "offers_virtual": False
    },
    {
        "name": "James Wilson",
        "email": "trainer_james@test.com",
        "lat": 39.2904,  # ~15 miles from Laurel (edge of in-person)
        "lon": -76.6122,
        "location": "Baltimore, MD",
        "bio": "Boxing and MMA trainer. Get fight-ready!",
        "offers_in_person": True,
        "offers_virtual": True
    },
    {
        "name": "Sophia Anderson",
        "email": "trainer_sophia@test.com",
        "lat": 39.3500,  # ~18 miles from Laurel (virtual only range)
        "lon": -76.5500,
        "location": "Baltimore, MD",
        "bio": "Virtual personal training specialist. Online workouts.",
        "offers_in_person": False,
        "offers_virtual": True
    },
    {
        "name": "Liam Martinez",
        "email": "trainer_liam@test.com",
        "lat": 39.4000,  # ~22 miles from Laurel (outside both ranges)
        "lon": -76.5000,
        "location": "Baltimore, MD",
        "bio": "Marathon coach. Virtual running programs.",
        "offers_in_person": False,
        "offers_virtual": True
    }
]

print("Creating test trainers at various distances...\n")

for trainer_data in test_trainers:
    # Calculate actual distance
    distance = calculate_distance(39.0993, -76.8483, trainer_data['lat'], trainer_data['lon'])
    
    try:
        signup_response = requests.post(f"{BASE_URL}/auth/signup", json={
            "fullName": trainer_data["name"],
            "email": trainer_data["email"],
            "phone": "555-9999",
            "password": "password123",
            "roles": ["trainer"]
        })
        
        if signup_response.status_code == 200:
            signup_data = signup_response.json()
            token = signup_data["access_token"]
            user_id = signup_data["user"]["id"]
            
            # Create trainer profile
            profile_response = requests.post(
                f"{BASE_URL}/trainer-profiles",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "userId": user_id,
                    "bio": trainer_data["bio"],
                    "experienceYears": 6,
                    "certifications": ["ACE", "NASM-CPT"],
                    "trainingStyles": ["Strength Training", "Cardio"],
                    "primaryGym": "LA Fitness",
                    "offersInPerson": trainer_data["offers_in_person"],
                    "offersVirtual": trainer_data["offers_virtual"],
                    "ratePerMinuteCents": 100,
                    "latitude": trainer_data["lat"],
                    "longitude": trainer_data["lon"],
                    "locationAddress": trainer_data["location"],
                    "isAvailable": True,
                    "isVirtualTrainingAvailable": trainer_data["offers_virtual"]
                }
            )
            
            if profile_response.status_code == 200:
                print(f"✅ {trainer_data['name']}")
                print(f"   📍 {trainer_data['location']} - {distance:.1f} miles from Laurel")
                print(f"   🏋️ In-person: {'Yes' if trainer_data['offers_in_person'] else 'No'}")
                print(f"   💻 Virtual: {'Yes' if trainer_data['offers_virtual'] else 'No'}")
                print()
        else:
            error_msg = signup_response.json().get('detail', '')
            if "Email already registered" in error_msg:
                print(f"ℹ️  {trainer_data['name']} already exists ({distance:.1f} mi)")
            else:
                print(f"❌ Failed to create {trainer_data['name']}: {error_msg}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

print("\n" + "="*70)
print("TESTING SEARCH WITH NEW RULES")
print("="*70 + "\n")

# Login as trainee
login_response = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "trainee1@test.com",
    "password": "password123"
})

if login_response.status_code == 200:
    token = login_response.json()["access_token"]
    
    # Test 1: In-person only search (no virtual)
    print("TEST 1: In-person ONLY (wantsVirtual=False)")
    print("-" * 70)
    search1 = requests.get(
        f"{BASE_URL}/trainers/search",
        headers={"Authorization": f"Bearer {token}"},
        params={
            "latitude": 39.0993,
            "longitude": -76.8483,
            "wantsVirtual": False
        }
    )
    
    if search1.status_code == 200:
        trainers1 = search1.json()
        print(f"Found {len(trainers1)} trainers\n")
        
        for i, t in enumerate(trainers1, 1):
            dist = None
            if t.get('latitude') and t.get('longitude'):
                dist = calculate_distance(39.0993, -76.8483, t['latitude'], t['longitude'])
            
            print(f"{i}. {t.get('bio', 'Unknown')[:45]}...")
            print(f"   📍 {t.get('locationAddress')} ({dist:.1f} mi)" if dist else f"   📍 {t.get('locationAddress')}")
            print(f"   Type: {'In-person' if t.get('offersInPerson') else 'Virtual only'}")
            print()
    
    # Test 2: In-person + Virtual search
    print("\nTEST 2: In-person + Virtual (wantsVirtual=True)")
    print("-" * 70)
    search2 = requests.get(
        f"{BASE_URL}/trainers/search",
        headers={"Authorization": f"Bearer {token}"},
        params={
            "latitude": 39.0993,
            "longitude": -76.8483,
            "wantsVirtual": True
        }
    )
    
    if search2.status_code == 200:
        trainers2 = search2.json()
        print(f"Found {len(trainers2)} trainers\n")
        
        in_person_count = 0
        virtual_count = 0
        
        for i, t in enumerate(trainers2, 1):
            dist = None
            if t.get('latitude') and t.get('longitude'):
                dist = calculate_distance(39.0993, -76.8483, t['latitude'], t['longitude'])
            
            # Determine type
            type_str = ""
            if t.get('offersInPerson') and dist and dist <= 15:
                type_str = "🏋️ IN-PERSON"
                in_person_count += 1
            elif t.get('isVirtualTrainingAvailable'):
                type_str = "💻 VIRTUAL"
                virtual_count += 1
            
            print(f"{i}. {type_str} | {t.get('bio', 'Unknown')[:35]}...")
            print(f"   📍 {t.get('locationAddress')} ({dist:.1f} mi)" if dist else f"   📍 {t.get('locationAddress')}")
            print()
        
        print(f"\n📊 Summary: {in_person_count} in-person (≤15 mi) + {virtual_count} virtual (≤20 mi)")

print("\n" + "="*70)
print("EXPECTED RESULTS:")
print("="*70)
print("• In-person only: Should show trainers ≤15 miles offering in-person")
print("• In-person + Virtual: In-person trainers first (≤15 mi), then virtual (≤20 mi)")
print("• Trainers >20 miles should NOT appear")
print("• Liam Martinez (22 miles, virtual) should be EXCLUDED")
print("="*70)
