"""
iter118l — Beta-mode automatic trainer seeding.

Purpose: during beta testing, whenever a trainee first requests nearby trainers,
we auto-spawn 3 admin-approved trainers within 3-15 miles of their GPS position so
they never see an empty "Available Now" sheet. Every seeded trainer is flagged
`isBetaSeed: true` on their `trainer_profiles` document so all beta clutter can be
purged with a single admin call before going to production.

Feature flag: env `BETA_AUTO_SEED_TRAINERS` — set to "true" to enable, unset/false to
disable. Off by default so production is always clean.
"""
import os
import math
import random
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ---- Feature flag ----------------------------------------------------------
def is_beta_seeding_enabled() -> bool:
    return os.environ.get('BETA_AUTO_SEED_TRAINERS', '').strip().lower() in ('1', 'true', 'yes', 'on')


# ---- Seed content pools ----------------------------------------------------
# Diversified names, styles, tiers, tags so every beta trainee sees a realistic mix.
FIRST_NAMES_MALE = ["Marcus", "Devon", "Andre", "Jamal", "Chris", "Ethan", "Tyler", "Malcolm", "Isaac", "Rico", "Dre", "Preston"]
FIRST_NAMES_FEMALE = ["Jasmine", "Sara", "Nia", "Tanya", "Elena", "Rachel", "Bianca", "Danielle", "Simone", "Alicia", "Kiara", "Vanessa"]
LAST_NAMES = ["Reyes", "Carter", "Thompson", "Nguyen", "Malik", "Bishop", "Ortega", "Powell", "Sanders", "Whitfield", "Ramos", "Beckett", "Holloway", "Baldwin"]

STYLES_POOL = [
    ("Strength", "HIIT", "Athletic Performance"),
    ("Boxing", "Conditioning", "Mobility"),
    ("Yoga", "Mobility", "Recovery"),
    ("Powerlifting", "Strength", "Nutrition Coaching"),
    ("HIIT", "Group Training", "Fat Loss"),
    ("Sprint Training", "Athletic Performance", "Strength"),
    ("Bodybuilding", "Hypertrophy", "Nutrition Coaching"),
    ("CrossFit", "Metcon", "Strength"),
    ("Pilates", "Core", "Mobility"),
    ("Mixed Martial Arts", "Conditioning", "Boxing"),
]

CERTS_POOL = [
    ["NASM CPT"],
    ["ACE CPT", "PN L1"],
    ["NSCA CSCS"],
    ["NASM CPT", "NASM CES"],
    ["NASM CPT", "PN L2"],
    ["ISSA CPT", "USA Weightlifting L1"],
    ["ACSM CPT"],
]

TIER_POOL = [("elite", 4.9, 145), ("elite", 5.0, 78), ("pro", 4.8, 92), ("pro", 4.7, 63)]

PERSONALITY_TAGS = [
    ("Drill Sergeant", "#FF6A00"),
    ("The Motivator", "#E84393"),
    ("The Athlete Maker", "#3B82F6"),
    ("The Optimizer", "#00D68F"),
    ("The Shredder", "#9B59B6"),
    ("The Coach", "#F1C40F"),
    ("The Pacer", "#1ABC9C"),
]

BIOS_POOL = [
    "12+ years transforming clients through strength & conditioning. Vet.",
    "Pre-natal, post-natal & women's strength. Certified PN L1.",
    "Sprint mechanics & explosive power specialty.",
    "Fat loss, glute-focused strength, and small-group HIIT.",
    "Bodybuilding prep + hypertrophy coach. Contest history since 2018.",
    "Athlete-turned-coach — I train the way I trained to compete.",
    "Recovery + mobility first. Nobody trains hurt on my watch.",
    "Certified in three modalities. Every plan tailored to YOUR life.",
]


# ---- Helpers ----------------------------------------------------------------
def _random_offset_coords(lat: float, lng: float, min_miles: float, max_miles: float) -> tuple[float, float]:
    """Return (lat, lng) offset from origin by a random distance in [min_miles, max_miles]."""
    dist = random.uniform(min_miles, max_miles)
    angle = random.uniform(0, 2 * math.pi)
    # 1° latitude ≈ 69 miles; 1° longitude ≈ 69 * cos(lat) miles.
    d_lat = (dist * math.cos(angle)) / 69.0
    d_lng = (dist * math.sin(angle)) / (69.0 * max(math.cos(math.radians(lat)), 0.001))
    return lat + d_lat, lng + d_lng


def _pick_name() -> tuple[str, str]:
    first_pool = random.choice([FIRST_NAMES_MALE, FIRST_NAMES_FEMALE])
    return random.choice(first_pool), random.choice(LAST_NAMES)


def _rate_for_tier(tier: str) -> int:
    """Return outdoor rate in cents based on tier."""
    if tier == 'elite':
        return random.choice([7500, 8000, 8500, 9000, 9500])
    return random.choice([5500, 6000, 6500, 7000])


# ---- Main seeding entrypoint ------------------------------------------------
async def maybe_seed_trainers_for_trainee(
    db,
    trainee_user_id: str,
    latitude: float,
    longitude: float,
    hash_password_fn,
    count: int = 3,
) -> int:
    """
    If the feature flag is ON and this trainee has never been seeded yet, insert
    `count` sample trainers within 3-15 miles of (latitude, longitude). Returns
    the number actually created.

    Idempotent: uses a `beta_seeded_trainees` collection to record who has been
    seeded so re-visits to the endpoint don't spawn extra trainers.
    """
    if not is_beta_seeding_enabled():
        return 0

    # Skip if already seeded for this trainee
    marker = await db.beta_seeded_trainees.find_one({'userId': trainee_user_id})
    if marker:
        return 0

    now = datetime.now(timezone.utc)
    created = 0

    for i in range(count):
        try:
            first, last = _pick_name()
            styles = random.choice(STYLES_POOL)
            certs = random.choice(CERTS_POOL)
            tier, rating, reviews = random.choice(TIER_POOL)
            tag, accent = random.choice(PERSONALITY_TAGS)
            bio = random.choice(BIOS_POOL)

            # 3-15 mile offset per user request ("close enough to book, not same city")
            trainer_lat, trainer_lng = _random_offset_coords(latitude, longitude, 3.0, 15.0)

            # Unique email/phone per beta-seeded trainer (traceable, purgeable)
            uniq = f"{trainee_user_id[:8]}{random.randint(1000,9999)}{i}"
            email = f"beta.{first.lower()}.{last.lower()}.{uniq}@rapidreps-beta.com"
            phone = f"+1{random.randint(2000000000, 9999999999)}"
            full_name = f"{first} {last}"

            user_doc = {
                'fullName': full_name,
                'email': email,
                'phone': phone,
                'passwordHash': hash_password_fn('BetaTrainer!2025'),
                'roles': ['trainer'],
                'isAdmin': False,
                'emailVerified': True,
                'referralCode': f"BETA-{uniq[:8].upper()}",
                'referralCredits': 0,
                'isBetaSeed': True,          # top-level marker for admin purge
                'seededForTraineeId': trainee_user_id,
                'createdAt': now,
                'updatedAt': now,
            }
            user_result = await db.users.insert_one(user_doc)
            new_user_id = str(user_result.inserted_id)

            outdoor_rate = _rate_for_tier(tier)
            in_home_rate = outdoor_rate + random.choice([2500, 3000, 3500])
            virtual_rate = max(3500, outdoor_rate - 2000)

            profile_doc = {
                'userId': new_user_id,
                'fullName': full_name,
                'bio': bio,
                'experienceYears': random.randint(3, 14),
                'certifications': certs,
                'trainingStyles': list(styles),
                'primaryGym': random.choice([
                    'LA Fitness', 'Planet Fitness', 'Anytime Fitness',
                    'YMCA', 'Gold\'s Gym', 'Onelife Fitness', 'Iron Sports',
                ]),
                'gymsWorkedAt': [],
                'offersInPerson': True,
                'offersOutdoor': True,
                'offersInHome': True,
                'offersVirtual': True,
                'sessionDurationsOffered': [30, 45, 60, 90],
                'virtualRateCents': virtual_rate,
                'outdoorRateCents': outdoor_rate,
                'inHomeRateCents': in_home_rate,
                'ratePerMinuteCents': 100,
                'assignedTier': tier,
                'trainerTier': tier,
                'averageRating': rating,
                'totalReviews': reviews,
                'totalSessionsCompleted': reviews * 2,
                'isVerified': True,
                'verificationStatus': 'verified',
                'governmentIdUploaded': True,
                'ssnVerified': True,
                'backgroundCheckPassed': True,
                'sexOffenderCheckPassed': True,
                'cprAedCertUploaded': True,
                'fitnessCertUploaded': True,
                'canGoLive': True,
                'isAvailable': True,
                'isVirtualTrainingAvailable': True,
                'videoCallPreference': 'native',
                'latitude': trainer_lat,
                'longitude': trainer_lng,
                'locationAddress': 'Beta test area',
                'personalityTag': tag,
                'accentColor': accent,
                'isBetaSeed': True,          # top-level marker on profile too
                'seededForTraineeId': trainee_user_id,
                'createdAt': now,
                'updatedAt': now,
            }
            await db.trainer_profiles.insert_one(profile_doc)
            created += 1
            logger.info(
                f"beta-seed created trainer {full_name} for trainee={trainee_user_id[:8]}… "
                f"at ({trainer_lat:.4f},{trainer_lng:.4f})"
            )
        except Exception as e:
            logger.warning(f"beta-seed insert failed for iteration {i}: {e}")

    # Record so we don't seed again for this trainee
    await db.beta_seeded_trainees.insert_one({
        'userId': trainee_user_id,
        'seededAt': now,
        'trainersCreated': created,
        'traineeLat': latitude,
        'traineeLng': longitude,
    })

    return created


# ---- Admin purge -----------------------------------------------------------
async def purge_all_beta_seeds(db) -> dict:
    """Delete every user + trainer_profile with isBetaSeed=True and reset the marker
    collection. Returns counts. Called from admin route."""
    # Find all beta-seed user IDs first
    beta_user_ids: list[str] = []
    async for u in db.users.find({'isBetaSeed': True}, {'_id': 1}):
        beta_user_ids.append(str(u['_id']))

    profiles_result = await db.trainer_profiles.delete_many({'isBetaSeed': True})
    users_result = await db.users.delete_many({'isBetaSeed': True})
    markers_result = await db.beta_seeded_trainees.delete_many({})

    return {
        'usersDeleted': users_result.deleted_count,
        'profilesDeleted': profiles_result.deleted_count,
        'seedMarkersDeleted': markers_result.deleted_count,
    }
