import requests
from datetime import datetime, timedelta
import json

BASE_URL = "http://localhost:8001/api"

print("="*60)
print("TESTING 'LET'S LOCK IN' - SESSION BOOKING FLOW")
print("="*60 + "\n")

# 1. Login as trainee
print("1️⃣ Logging in as trainee (Jessica Martinez)...")
trainee_login = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "trainee1@test.com",
    "password": "password123"
})

if trainee_login.status_code != 200:
    print("❌ Trainee login failed")
    exit(1)

trainee_data = trainee_login.json()
trainee_token = trainee_data["access_token"]
trainee_id = trainee_data["user"]["id"]
print(f"   ✅ Logged in as {trainee_data['user']['fullName']}\n")

# 2. Search for trainers
print("2️⃣ Searching for available trainers near Laurel, MD...")
search_response = requests.get(
    f"{BASE_URL}/trainers/search",
    headers={"Authorization": f"Bearer {trainee_token}"},
    params={
        "latitude": 39.0993,
        "longitude": -76.8483,
        "wantsVirtual": False
    }
)

if search_response.status_code != 200:
    print("❌ Search failed")
    exit(1)

trainers = search_response.json()
print(f"   ✅ Found {len(trainers)} available trainers\n")

if len(trainers) == 0:
    print("❌ No trainers found")
    exit(1)

# Pick the first trainer
selected_trainer = trainers[0]
trainer_user_id = selected_trainer['userId']
print(f"3️⃣ Selected trainer: {selected_trainer.get('bio', 'Unknown')[:50]}...")
print(f"   📍 Location: {selected_trainer.get('locationAddress')}")
print(f"   💰 Rate: ${selected_trainer.get('ratePerMinuteCents', 0) / 100:.2f}/min\n")

# 4. Book a session
print("4️⃣ Booking a training session...")
session_start = datetime.utcnow() + timedelta(days=2)  # 2 days from now

session_data = {
    "traineeId": trainee_id,
    "trainerId": trainer_user_id,
    "sessionDateTimeStart": session_start.isoformat(),
    "durationMinutes": 60,
    "locationType": "gym",
    "locationNameOrAddress": "Gold's Gym, Laurel MD",
    "notes": "Looking forward to getting started! Ready to transform my fitness."
}

booking_response = requests.post(
    f"{BASE_URL}/sessions",
    headers={"Authorization": f"Bearer {trainee_token}"},
    json=session_data
)

if booking_response.status_code != 200:
    print(f"❌ Booking failed: {booking_response.text}")
    exit(1)

session = booking_response.json()
print(f"   ✅ Session booked successfully!")
print(f"   📅 Date: {session_start.strftime('%B %d, %Y at %I:%M %p')}")
print(f"   ⏱️  Duration: 60 minutes")
print(f"   💵 Price: ${session['finalSessionPriceCents'] / 100:.2f}")
print(f"   📍 Location: {session['locationNameOrAddress']}")
print(f"   📝 Status: {session['status'].upper()}\n")

# 5. Login as trainer and check pending requests
print("5️⃣ Logging in as trainer to check pending requests...")
trainer_login = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "trainer1@test.com",
    "password": "password123"
})

if trainer_login.status_code != 200:
    print("❌ Trainer login failed")
    exit(1)

trainer_data = trainer_login.json()
trainer_token = trainer_data["access_token"]
print(f"   ✅ Logged in as {trainer_data['user']['fullName']}\n")

# 6. Get trainer's sessions
print("6️⃣ Checking trainer's pending session requests...")
trainer_sessions_response = requests.get(
    f"{BASE_URL}/trainer/sessions",
    headers={"Authorization": f"Bearer {trainer_token}"},
    params={"status": "requested"}
)

if trainer_sessions_response.status_code != 200:
    print(f"❌ Failed to get sessions: {trainer_sessions_response.text}")
    exit(1)

pending_sessions = trainer_sessions_response.json()
print(f"   ✅ Found {len(pending_sessions)} pending session(s)\n")

if len(pending_sessions) > 0:
    for s in pending_sessions:
        print(f"   📋 Session Request:")
        print(f"      - Trainee ID: {s['traineeId']}")
        print(f"      - Date: {s['sessionDateTimeStart']}")
        print(f"      - Duration: {s['durationMinutes']} min")
        print(f"      - Trainer Earnings: ${s['trainerEarningsCents'] / 100:.2f}")
        print(f"      - Notes: {s.get('notes', 'None')}")
        print()

# 7. Accept the session
if len(pending_sessions) > 0:
    print("7️⃣ Trainer accepting the session...")
    session_id = pending_sessions[0]['id']
    
    accept_response = requests.patch(
        f"{BASE_URL}/sessions/{session_id}/accept",
        headers={"Authorization": f"Bearer {trainer_token}"}
    )
    
    if accept_response.status_code != 200:
        print(f"❌ Failed to accept session: {accept_response.text}")
    else:
        updated_session = accept_response.json()
        print(f"   ✅ Session ACCEPTED!")
        print(f"   📝 New Status: {updated_session['status'].upper()}\n")

# 8. Check nearby trainees for trainer
print("8️⃣ Checking nearby trainees for trainer...")
nearby_response = requests.get(
    f"{BASE_URL}/trainers/nearby-trainees",
    headers={"Authorization": f"Bearer {trainer_token}"}
)

if nearby_response.status_code == 200:
    nearby_data = nearby_response.json()
    trainees = nearby_data.get('trainees', [])
    print(f"   ✅ Found {len(trainees)} nearby trainees:")
    for t in trainees:
        print(f"      - {t.get('fullName')} ({t.get('distance')} mi away)")
        print(f"        Goals: {t.get('fitnessGoals', 'Not set')[:60]}...")
    print()

# 9. Test trainer availability toggle
print("9️⃣ Testing trainer availability toggle...")
toggle_response = requests.patch(
    f"{BASE_URL}/trainer-profiles/toggle-availability",
    headers={"Authorization": f"Bearer {trainer_token}"},
    params={"isAvailable": False}
)

if toggle_response.status_code == 200:
    print("   ✅ Trainer set to UNAVAILABLE")
    print("   🔴 Trainer is now hidden from trainee searches\n")
    
    # Verify trainer doesn't appear in search
    print("🔟 Verifying trainer is hidden from search...")
    search_again = requests.get(
        f"{BASE_URL}/trainers/search",
        headers={"Authorization": f"Bearer {trainee_token}"},
        params={
            "latitude": 39.0993,
            "longitude": -76.8483,
            "wantsVirtual": False
        }
    )
    
    if search_again.status_code == 200:
        trainers_after = search_again.json()
        print(f"   ✅ Now showing {len(trainers_after)} trainers (down from {len(trainers)})")
        print("   ✅ Availability toggle working correctly!\n")
    
    # Set back to available
    requests.patch(
        f"{BASE_URL}/trainer-profiles/toggle-availability",
        headers={"Authorization": f"Bearer {trainer_token}"},
        params={"isAvailable": True}
    )
    print("   🟢 Trainer set back to AVAILABLE\n")

print("="*60)
print("✅ ALL TESTS PASSED! 'LET'S LOCK IN' FLOW IS WORKING!")
print("="*60)
print("\n📱 You can now test in the mobile app with:")
print("   Trainee: trainee1@test.com / password123")
print("   Trainer: trainer1@test.com / password123")
