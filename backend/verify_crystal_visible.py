import requests

BASE_URL = "http://localhost:8001/api"

# Login as Ashton
print("Verifying Crystal is visible to Ashton...\n")
login = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "ashtonbundy@gmail.com",
    "password": "password123"
})

if login.status_code == 200:
    token = login.json()["access_token"]
    print("✅ Logged in as Ashton\n")
    
    # Search for trainers from Ashton's location
    print("Searching for trainers near Ashton's location...")
    search = requests.get(
        f"{BASE_URL}/trainers/search",
        headers={"Authorization": f"Bearer {token}"},
        params={
            "latitude": 39.0993,  # Laurel, MD
            "longitude": -76.8483,
            "wantsVirtual": False  # In-person only
        }
    )
    
    if search.status_code == 200:
        trainers = search.json()
        print(f"✅ Found {len(trainers)} trainers\n")
        
        # Find Crystal
        crystal_found = False
        for trainer in trainers:
            if 'Crystal' in trainer.get('bio', '') or 'women' in trainer.get('bio', '').lower():
                crystal_found = True
                print("✅ CRYSTAL FOUND!")
                print(f"   Bio: {trainer['bio'][:60]}...")
                print(f"   Location: {trainer['locationAddress']}")
                
                # Calculate distance
                if trainer.get('latitude') and trainer.get('longitude'):
                    from math import radians, sin, cos, sqrt, atan2
                    R = 3959
                    lat1, lon1 = radians(39.0993), radians(-76.8483)
                    lat2, lon2 = radians(trainer['latitude']), radians(trainer['longitude'])
                    dlat = lat2 - lat1
                    dlon = lon2 - lon1
                    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                    c = 2 * atan2(sqrt(a), sqrt(1-a))
                    distance = R * c
                    print(f"   Distance: {distance:.1f} miles")
                
                print(f"   Available: {'✅ Yes' if trainer.get('isAvailable') else '❌ No'}")
                break
        
        if not crystal_found:
            print("❌ Crystal NOT found in search results")
            print("\nShowing first 5 trainers:")
            for i, t in enumerate(trainers[:5], 1):
                print(f"{i}. {t.get('bio', 'N/A')[:40]}... at {t.get('locationAddress')}")
    else:
        print(f"❌ Search failed: {search.status_code}")
        print(f"   {search.text}")
else:
    print(f"❌ Login failed: {login.status_code}")
    print(f"   {login.text}")
