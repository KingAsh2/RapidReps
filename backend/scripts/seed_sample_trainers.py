"""
iter118i — Seed 5 sample trainers in the Elkridge / Laurel / College Park / Hanover MD corridor
so trainee accounts see a real, non-empty Available Now sheet after login.

Idempotent — reruns will UPSERT by email so we never duplicate rows.

Run:
    cd /app/backend && python -m scripts.seed_sample_trainers
"""
import asyncio
import os
import sys
from datetime import datetime, timezone

# Path so we can import the app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from deps import db, hash_password


# 5 trainers spread across the corridor the user asked about.
# Coordinates verified via Google Maps. Location addresses set so the UI
# proximity chip has something human to render.
SAMPLE_TRAINERS = [
    {
        "email": "marcus.elkridge@rapidreps-seed.com",
        "fullName": "Marcus Reyes",
        "phone": "+14435550101",
        "city": "Elkridge, MD",
        "lat": 39.2126,
        "lng": -76.7130,
        "bio": "12+ years transforming clients through strength & conditioning. USMC vet.",
        "trainingStyles": ["Strength", "HIIT", "Boxing"],
        "certifications": ["NASM CPT", "USMC PT Cert"],
        "primaryGym": "Elkridge Family YMCA",
        "experienceYears": 12,
        "rating": 4.9,
        "totalReviews": 187,
        "assignedTier": "elite",
        "outdoorRateCents": 8000,
        "inHomeRateCents": 12000,
        "personalityTag": "Drill Sergeant",
        "accentColor": "#FF6A00",
    },
    {
        "email": "jasmine.laurel@rapidreps-seed.com",
        "fullName": "Jasmine Carter",
        "phone": "+14435550102",
        "city": "Laurel, MD",
        "lat": 39.0993,
        "lng": -76.8483,
        "bio": "Pre-natal, post-natal & women's strength. Certified Precision Nutrition L1.",
        "trainingStyles": ["Yoga", "Mobility", "Strength"],
        "certifications": ["ACE CPT", "PN L1", "Pre-Natal Cert"],
        "primaryGym": "Laurel Regional Rec",
        "experienceYears": 7,
        "rating": 4.8,
        "totalReviews": 92,
        "assignedTier": "pro",
        "outdoorRateCents": 6500,
        "inHomeRateCents": 9500,
        "personalityTag": "The Motivator",
        "accentColor": "#E84393",
    },
    {
        "email": "andre.collegepark@rapidreps-seed.com",
        "fullName": "Andre Thompson",
        "phone": "+14435550103",
        "city": "College Park, MD",
        "lat": 38.9807,
        "lng": -76.9369,
        "bio": "UMD strength coach turned private. Sprint mechanics & explosive power specialty.",
        "trainingStyles": ["Sprint Training", "Powerlifting", "Athletic Performance"],
        "certifications": ["NSCA CSCS", "USA Track & Field L1"],
        "primaryGym": "Ritchie Coliseum Facility",
        "experienceYears": 9,
        "rating": 5.0,
        "totalReviews": 64,
        "assignedTier": "elite",
        "outdoorRateCents": 9000,
        "inHomeRateCents": 13000,
        "personalityTag": "The Athlete Maker",
        "accentColor": "#3B82F6",
    },
    {
        "email": "sara.hanover@rapidreps-seed.com",
        "fullName": "Sara Nguyen",
        "phone": "+14435550104",
        "city": "Hanover, MD",
        "lat": 39.1920,
        "lng": -76.7237,
        "bio": "Fat loss, glute-focused strength, and small-group HIIT. 5-star Yelp x3 years.",
        "trainingStyles": ["HIIT", "Strength", "Group Training"],
        "certifications": ["NASM CPT", "NASM CES"],
        "primaryGym": "Arundel Mills LA Fitness",
        "experienceYears": 6,
        "rating": 4.9,
        "totalReviews": 143,
        "assignedTier": "pro",
        "outdoorRateCents": 7000,
        "inHomeRateCents": 10000,
        "personalityTag": "The Optimizer",
        "accentColor": "#00D68F",
    },
    {
        "email": "devon.elkridge@rapidreps-seed.com",
        "fullName": "Devon Malik",
        "phone": "+14435550105",
        "city": "Elkridge, MD",
        "lat": 39.2148,
        "lng": -76.7069,
        "bio": "Bodybuilding prep + hypertrophy coach. IFBB Pro contest history since 2018.",
        "trainingStyles": ["Bodybuilding", "Hypertrophy", "Nutrition Coaching"],
        "certifications": ["NASM CPT", "PN L2"],
        "primaryGym": "Iron Sports Elkridge",
        "experienceYears": 10,
        "rating": 4.7,
        "totalReviews": 78,
        "assignedTier": "elite",
        "outdoorRateCents": 8500,
        "inHomeRateCents": 12500,
        "personalityTag": "The Shredder",
        "accentColor": "#9B59B6",
    },
]

DEFAULT_PASSWORD = "SamplePass!2025"


async def upsert_trainer(seed: dict):
    """Upsert user + trainer_profile for a single seed record."""
    now = datetime.now(timezone.utc)

    # ---- User doc ----
    existing = await db.users.find_one({"email": seed["email"]})
    if existing:
        user_id = str(existing["_id"])
        # Update the human-visible fields but keep the hash + createdAt intact
        await db.users.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "fullName": seed["fullName"],
                    "phone": seed["phone"],
                    "roles": ["trainer"],
                    "emailVerified": True,
                    "updatedAt": now,
                }
            },
        )
    else:
        user_doc = {
            "fullName": seed["fullName"],
            "email": seed["email"],
            "phone": seed["phone"],
            "passwordHash": hash_password(DEFAULT_PASSWORD),
            "roles": ["trainer"],
            "isAdmin": False,
            "emailVerified": True,
            "referralCode": f"SEED-{seed['email'][:6].upper()}",
            "referralCredits": 0,
            "createdAt": now,
            "updatedAt": now,
        }
        res = await db.users.insert_one(user_doc)
        user_id = str(res.inserted_id)

    # ---- Trainer profile doc ----
    tier_min = seed["outdoorRateCents"]
    profile_doc = {
        "userId": user_id,
        "fullName": seed["fullName"],
        "bio": seed["bio"],
        "experienceYears": seed["experienceYears"],
        "certifications": seed["certifications"],
        "trainingStyles": seed["trainingStyles"],
        "primaryGym": seed["primaryGym"],
        "gymsWorkedAt": [seed["primaryGym"]],
        "offersInPerson": True,
        "offersOutdoor": True,
        "offersInHome": True,
        "offersVirtual": True,
        "sessionDurationsOffered": [30, 45, 60, 90],
        "virtualRateCents": max(3000, tier_min - 2000),
        "outdoorRateCents": seed["outdoorRateCents"],
        "inHomeRateCents": seed["inHomeRateCents"],
        "ratePerMinuteCents": 100,
        "assignedTier": seed["assignedTier"],
        "trainerTier": seed["assignedTier"],
        "averageRating": seed["rating"],
        "totalReviews": seed["totalReviews"],
        "totalSessionsCompleted": seed["totalReviews"] * 2,  # rough estimate
        "isVerified": True,
        "verificationStatus": "verified",
        "governmentIdUploaded": True,
        "ssnVerified": True,
        "backgroundCheckPassed": True,
        "sexOffenderCheckPassed": True,
        "cprAedCertUploaded": True,
        "fitnessCertUploaded": True,
        "canGoLive": True,
        "isAvailable": True,
        "isVirtualTrainingAvailable": True,
        "videoCallPreference": "native",
        "latitude": seed["lat"],
        "longitude": seed["lng"],
        "locationAddress": seed["city"],
        "personalityTag": seed["personalityTag"],
        "accentColor": seed["accentColor"],
        "updatedAt": now,
    }

    existing_profile = await db.trainer_profiles.find_one({"userId": user_id})
    if existing_profile:
        await db.trainer_profiles.update_one(
            {"userId": user_id},
            {"$set": profile_doc},
        )
        action = "UPDATED"
    else:
        profile_doc["createdAt"] = now
        await db.trainer_profiles.insert_one(profile_doc)
        action = "CREATED"

    return action, seed["fullName"], seed["city"]


async def main():
    print("iter118i — Seeding sample trainers in the Elkridge/Laurel/College Park/Hanover corridor…")
    print(f"Default password for all sample accounts: {DEFAULT_PASSWORD}\n")

    results = []
    for seed in SAMPLE_TRAINERS:
        try:
            action, name, city = await upsert_trainer(seed)
            results.append((action, name, city))
            print(f"  {action:<8} — {name:<20} ({city})")
        except Exception as e:
            print(f"  FAILED   — {seed['fullName']}: {e}")

    created = sum(1 for r in results if r[0] == "CREATED")
    updated = sum(1 for r in results if r[0] == "UPDATED")
    print(f"\nDone. {created} created, {updated} updated. Total sample trainers: {len(SAMPLE_TRAINERS)}")


if __name__ == "__main__":
    asyncio.run(main())
