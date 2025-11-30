import requests

BASE_URL = "http://localhost:8001/api"

# Login as trainee
login_response = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "trainee1@test.com",
    "password": "password123"
})

if login_response.status_code == 200:
    token = login_response.json()["access_token"]
    
    # Search trainers from Laurel, MD
    search_response = requests.get(
        f"{BASE_URL}/trainers/search",
        headers={"Authorization": f"Bearer {token}"},
        params={
            "latitude": 39.0993,  # Laurel, MD
            "longitude": -76.8483,
            "wantsVirtual": True
        }
    )
    
    if search_response.status_code == 200:
        trainers = search_response.json()
        print(f"Found {len(trainers)} trainers\n")
        
        for i, trainer in enumerate(trainers, 1):
            print(f"{i}. Bio: {trainer.get('bio', 'N/A')[:50]}")
            print(f"   Location: {trainer.get('locationAddress', 'No location set')}")
            print(f"   Coordinates: {trainer.get('latitude')}, {trainer.get('longitude')}")
            print(f"   Available: {trainer.get('isAvailable')}")
            print(f"   Virtual: {trainer.get('isVirtualTrainingAvailable')}")
            print()
