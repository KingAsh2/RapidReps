"""
iter102h — /api/trainers/nearby proximity gates

Asserts:
- Trainer's own `travelRadiusMiles` is honored: a trainer who only wants to
  travel N miles must NOT appear to a trainee farther than N miles away,
  even if the trainee's requested radius is wider.
- The trainee's `radius_miles` query param is still honored.
"""
import os
import time
import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8001")


def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=15,
    )
    r.raise_for_status()
    d = r.json()
    return d.get("token") or d.get("access_token")


def _admin_headers() -> dict:
    return {"Authorization": f"Bearer {_login('admin@rapidreps.com', 'admin123')}"}


def _trainee_headers() -> dict:
    return {"Authorization": f"Bearer {_login('test_trainee_iter25@test.com', 'Test123!')}"}


def _set_test_trainer_travel_radius(miles: int) -> None:
    """Set the seed trainer's travelRadiusMiles directly via Mongo."""
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    async def _do():
        # Get the seed trainer's userId by email lookup so this doesn't depend
        # on a hardcoded ObjectId from a specific environment.
        u = await db.users.find_one({"email": "test_trainer_iter25@test.com"})
        if not u:
            return
        await db.trainer_profiles.update_one(
            {"userId": str(u["_id"])},
            {"$set": {
                "travelRadiusMiles": miles,
                "isAvailable": True,
                "latitude": 33.749,
                "longitude": -84.388,
                "isVerified": True,
                "verificationStatus": "verified",
                "canBeListed": True,
                "canGoLive": True,
            }},
        )
    asyncio.run(_do())


def test_trainer_travel_radius_excludes_far_trainees():
    # Set test trainer to a very small travel radius
    _set_test_trainer_travel_radius(2)
    time.sleep(0.2)

    # Trainee ~10mi away with a 25mi requested radius — trainer should be hidden
    r = requests.get(
        f"{BASE_URL}/api/trainers/nearby?latitude=33.7&longitude=-84.50&radius_miles=25",
        headers=_trainee_headers(),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    names = [t.get("fullName") for t in d.get("trainers", [])]
    assert "Test Trainer" not in names, f"trainer w/ travelRadius=2 leaked to far-away trainee: {names}"

    # Trainee right next to trainer — should be included
    r = requests.get(
        f"{BASE_URL}/api/trainers/nearby?latitude=33.749&longitude=-84.388&radius_miles=25",
        headers=_trainee_headers(),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    names = [t.get("fullName") for t in d.get("trainers", [])]
    assert "Test Trainer" in names, f"trainer not visible to nearby trainee: {names}"

    # Reset trainer back to 25 mi so other tests aren't affected
    _set_test_trainer_travel_radius(25)
