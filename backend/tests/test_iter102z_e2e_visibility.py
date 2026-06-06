"""iter102z-followup — End-to-end integration test for the verify → assign-tier → visibility chain.

Unlike the unit tests in `test_iter102z_visibility_wiring.py`, this exercises
the live MongoDB to prove that:

  1. A trainer missing `assignedTier` is excluded even when the legacy `tier`
     field is set — the exact disconnect iter102z fixed.
  2. A trainer with verified + assignedTier + isAvailable passes the filter.
  3. Toggling isAvailable off immediately hides them.

Each scenario creates and tears down its own fixture documents — it never
mutates pre-existing trainers in the database.
"""
import asyncio
import os
import sys
import uuid

import pytest
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from deps import trainer_visibility_filter  # noqa: E402


def _fresh_db():
    """Each test gets its own motor client/loop binding to avoid the
    'Event loop is closed' error that happens when multiple asyncio.run()
    calls share a module-level client."""
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client, client[os.environ['DB_NAME']]


async def _make_disposable_trainer(db, verification_status: str = "pending",
                                    assigned_tier: str | None = None) -> str:
    unique = uuid.uuid4().hex[:8]
    res = await db.users.insert_one({
        "fullName": f"Iter102zE2E_{unique}",
        "email": f"iter102z_{unique}@test.invalid",
        "passwordHash": "x",
        "roles": ["trainer"],
    })
    uid = str(res.inserted_id)
    profile = {
        "userId": uid,
        "verificationStatus": verification_status,
        "isAvailable": True,
        # Legacy `tier` field MUST be ignored by the filter.
        "tier": "specialty",
        "bio": "iter102z e2e bio that is at least fifty characters long for tests.",
        "trainingStyles": ["strength"],
        "offersOutdoor": True,
        "outdoorRateCents": 9000,
    }
    if assigned_tier:
        profile["assignedTier"] = assigned_tier
    await db.trainer_profiles.insert_one(profile)
    return uid


async def _cleanup(db, uid: str) -> None:
    await db.trainer_profiles.delete_many({"userId": uid})
    try:
        await db.users.delete_one({"_id": ObjectId(uid)})
    except Exception:
        pass


def test_pending_trainer_is_invisible():
    async def _run():
        client, db = _fresh_db()
        try:
            uid = await _make_disposable_trainer(db, verification_status="pending")
            try:
                f = trainer_visibility_filter()
                found = await db.trainer_profiles.find_one({**f, "userId": uid})
                assert found is None, "Pending trainer leaked into visibility filter"
            finally:
                await _cleanup(db, uid)
        finally:
            client.close()
    asyncio.run(_run())


def test_verified_without_assigned_tier_is_invisible():
    """Even though `tier='specialty'` is set in the fixture, the new filter
    requires `assignedTier`. This is the EXACT bug iter102z fixed."""
    async def _run():
        client, db = _fresh_db()
        try:
            uid = await _make_disposable_trainer(db, verification_status="verified")
            try:
                f = trainer_visibility_filter()
                found = await db.trainer_profiles.find_one({**f, "userId": uid})
                assert found is None, (
                    "Legacy `tier` field bypassed the filter — the iter102z "
                    "disconnect is back. Filter MUST require `assignedTier`."
                )
            finally:
                await _cleanup(db, uid)
        finally:
            client.close()
    asyncio.run(_run())


def test_full_chain_makes_trainer_visible():
    """Verified + assignedTier + isAvailable ⇒ trainer surfaces."""
    async def _run():
        client, db = _fresh_db()
        try:
            uid = await _make_disposable_trainer(
                db, verification_status="verified", assigned_tier="certified",
            )
            try:
                f = trainer_visibility_filter()
                found = await db.trainer_profiles.find_one({**f, "userId": uid})
                assert found is not None, (
                    "Trainer with verified+assignedTier+isAvailable did NOT pass "
                    "the visibility filter — chain is broken upstream of search."
                )
                assert found["assignedTier"] == "certified"
            finally:
                await _cleanup(db, uid)
        finally:
            client.close()
    asyncio.run(_run())


def test_toggling_available_off_hides_trainer():
    """Operational: trainer toggling Available off must immediately hide them."""
    async def _run():
        client, db = _fresh_db()
        try:
            uid = await _make_disposable_trainer(
                db, verification_status="verified", assigned_tier="specialty",
            )
            try:
                f = trainer_visibility_filter()
                assert await db.trainer_profiles.find_one({**f, "userId": uid}) is not None
                await db.trainer_profiles.update_one(
                    {"userId": uid}, {"$set": {"isAvailable": False}},
                )
                assert await db.trainer_profiles.find_one({**f, "userId": uid}) is None
            finally:
                await _cleanup(db, uid)
        finally:
            client.close()
    asyncio.run(_run())
