"""
Iteration 101 — Twelve-task post-deployment cleanup backend validation.

Covers items from the review_request features_or_bugs_to_test focused on backend contracts:
- /api/auth/me returns profilePhoto/avatarUrl, legalName/displayName for both roles
- PUT /api/auth/me updates fullName + preserves legalName for trainers
- /api/admin/name-change-audit returns 200 for admin, 401/403 for non-admin
- /api/trainers/nearby returns enriched fields
- /api/trainer/availability uses saved coords as fallback / 400s if none
- /api/admin/verifications/pending — documents must NOT include photo/Profile Photo
- /api/admin/payments/csv-export still works (regression)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://highlight-vibe-bugs.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")

ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASSWORD = "admin123"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASSWORD = "Test123!"
TRAINEE_EMAIL = "test_trainee_iter25@test.com"
TRAINEE_PASSWORD = "Test123!"


# ---------- Helpers ----------
def login(email: str, password: str):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    return data["access_token"], data["user"]


def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    token, _ = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    return token


@pytest.fixture(scope="module")
def trainer_token():
    token, _ = login(TRAINER_EMAIL, TRAINER_PASSWORD)
    return token


@pytest.fixture(scope="module")
def trainee_token():
    token, _ = login(TRAINEE_EMAIL, TRAINEE_PASSWORD)
    return token


# ---------- /api/auth/me ----------
class TestAuthMe:
    def test_me_trainee_has_photo_fields(self, trainee_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(trainee_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # Photo fields present (value may be None when no photo set)
        assert "profilePhoto" in data, "trainee /me missing profilePhoto"
        assert "avatarUrl" in data, "trainee /me missing avatarUrl"
        # Display/legal name fields present (None allowed)
        assert "legalName" in data
        assert "displayName" in data

    def test_me_trainer_has_photo_and_name_fields(self, trainer_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(trainer_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "profilePhoto" in data
        assert "avatarUrl" in data
        assert "legalName" in data
        assert "displayName" in data

    def test_put_me_updates_display_name_and_preserves_legal_name(self, trainer_token):
        # Capture current
        r0 = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(trainer_token), timeout=20)
        assert r0.status_code == 200
        original_full = r0.json().get("fullName")
        original_legal = r0.json().get("legalName")

        new_name = f"TEST_DisplayName_{int(time.time())}"
        r = requests.put(
            f"{BASE_URL}/api/auth/me",
            headers=auth_headers(trainer_token),
            json={"displayName": new_name},
            timeout=20,
        )
        # Endpoint must exist
        assert r.status_code in (200, 204), f"PUT /api/auth/me returned {r.status_code}: {r.text}"

        # GET to confirm
        r2 = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(trainer_token), timeout=20)
        assert r2.status_code == 200
        data = r2.json()
        # fullName updated
        assert data.get("fullName") == new_name, f"fullName not updated: {data.get('fullName')}"
        # legalName preserved (either unchanged-or-set vs original_legal not clobbered to None)
        if original_legal:
            assert data.get("legalName") == original_legal, "legalName was clobbered"

        # Restore (best-effort)
        if original_full:
            requests.put(
                f"{BASE_URL}/api/auth/me",
                headers=auth_headers(trainer_token),
                json={"displayName": original_full},
                timeout=20,
            )


# ---------- /api/admin/name-change-audit ----------
class TestNameChangeAudit:
    def test_admin_can_access(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/name-change-audit",
            headers=auth_headers(admin_token),
            timeout=20,
        )
        assert r.status_code == 200, f"admin name-change-audit failed: {r.status_code} {r.text}"
        data = r.json()
        # response should include entries list
        assert "entries" in data or isinstance(data, list), f"unexpected shape: {data}"
        if "entries" in data:
            assert isinstance(data["entries"], list)

    def test_non_admin_forbidden(self, trainee_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/name-change-audit",
            headers=auth_headers(trainee_token),
            timeout=20,
        )
        assert r.status_code in (401, 403), f"non-admin should be 401/403, got {r.status_code}"


# ---------- /api/trainers/nearby ----------
class TestTrainersNearby:
    REQUIRED_KEYS = [
        "profilePhoto",
        "accentColor",
        "personalityTag",
        "vibeTrackTitle",
        "vibePreviewUrl",
        "vibeTrackId",
        "specialties",
        "outdoor60Cents",
        "distance",
        "distanceMiles",
        "isAvailable",
        "rating",
    ]

    def _seed_trainer_visible(self, lat=40.7128, lng=-74.0060):
        """Make test_trainer_iter25 publicly visible via direct DB mutation.

        Captures original values for restoration so we don't poison other tests.
        """
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient

        async def _do():
            client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = client[os.environ.get("DB_NAME", "rapidreps")]
            user = await db.users.find_one({"email": TRAINER_EMAIL})
            if not user:
                return None
            uid = str(user["_id"])
            prof = await db.trainer_profiles.find_one({"userId": uid})
            if not prof:
                return None
            original = {
                "verificationStatus": prof.get("verificationStatus"),
                "tier": prof.get("tier"),
                "isAvailable": prof.get("isAvailable"),
                "latitude": prof.get("latitude"),
                "longitude": prof.get("longitude"),
            }
            await db.trainer_profiles.update_one(
                {"userId": uid},
                {"$set": {
                    "verificationStatus": "verified",
                    "tier": "standard",
                    "isAvailable": True,
                    "latitude": lat,
                    "longitude": lng,
                }},
            )
            return uid, original

        return asyncio.run(_do())

    def _restore_trainer(self, uid: str, original: dict):
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient

        async def _do():
            client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = client[os.environ.get("DB_NAME", "rapidreps")]
            await db.trainer_profiles.update_one(
                {"userId": uid},
                {"$set": original},
            )

        asyncio.run(_do())

    def test_nearby_returns_enriched_fields(self, trainee_token, trainer_token):
        seed = self._seed_trainer_visible(40.7128, -74.0060)
        if not seed:
            pytest.skip("Could not seed trainer for visibility test")
        uid, original = seed
        try:
            r = requests.get(
                f"{BASE_URL}/api/trainers/nearby",
                params={"latitude": 40.7128, "longitude": -74.0060, "radius_miles": 50},
                headers=auth_headers(trainee_token),
                timeout=30,
            )
            assert r.status_code == 200, f"nearby failed: {r.status_code} {r.text}"
            data = r.json()
            assert "trainers" in data, f"missing trainers field: {data}"
            trainers = data["trainers"]
            assert trainers, "No trainers returned after seeding the test trainer to be visible"

            # Find our seeded trainer (may not be first if other visible trainers exist)
            target = next((t for t in trainers if t.get("trainerId") == uid or t.get("userId") == uid), trainers[0])
            missing = [k for k in self.REQUIRED_KEYS if k not in target]
            assert not missing, f"trainer object missing enriched keys: {missing}; available: {list(target.keys())}"
            assert isinstance(target.get("isAvailable"), bool), "isAvailable must be bool"
        finally:
            self._restore_trainer(uid, original)


# ---------- /api/trainer/availability ----------
class TestTrainerAvailability:
    def test_toggle_on_uses_saved_coords_or_400s_clearly(self, trainer_token):
        # Try toggling without lat/lng
        r = requests.put(
            f"{BASE_URL}/api/trainer/availability",
            headers=auth_headers(trainer_token),
            json={"isAvailable": True},
            timeout=20,
        )
        # Accept either:
        #   200 — saved coords were used as fallback
        #   400 — no coords saved; helpful detail
        assert r.status_code in (200, 400), f"unexpected status {r.status_code}: {r.text}"
        if r.status_code == 400:
            detail = (r.json().get("detail") or "").lower()
            assert ("location" in detail) or ("home address" in detail) or ("coord" in detail), (
                f"400 detail not helpful: {detail}"
            )
        # cleanup — turn back off
        requests.put(
            f"{BASE_URL}/api/trainer/availability",
            headers=auth_headers(trainer_token),
            json={"isAvailable": False},
            timeout=20,
        )

    def test_toggle_off_always_works(self, trainer_token):
        r = requests.put(
            f"{BASE_URL}/api/trainer/availability",
            headers=auth_headers(trainer_token),
            json={"isAvailable": False},
            timeout=20,
        )
        assert r.status_code == 200, f"toggle-off should work: {r.status_code} {r.text}"


# ---------- /api/admin/verifications/pending — photo step removed ----------
class TestVerificationsPhotoRemoved:
    def test_documents_does_not_contain_photo(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/verifications/pending",
            headers=auth_headers(admin_token),
            timeout=30,
        )
        assert r.status_code == 200, f"pending verifications failed: {r.status_code} {r.text}"
        data = r.json()
        items = data if isinstance(data, list) else data.get("verifications") or data.get("items") or []
        if not items:
            pytest.skip("No pending verifications to inspect")
        forbidden_keys = {"photo", "profile_photo", "profilephoto", "profile photo"}
        for v in items:
            docs = v.get("documents") or []
            if not isinstance(docs, list):
                continue
            for d in docs:
                if isinstance(d, str):
                    assert d.lower() not in forbidden_keys, f"forbidden doc step '{d}' in verification {v.get('id')}"
                elif isinstance(d, dict):
                    for field in ("type", "name", "id", "step"):
                        val = d.get(field)
                        if isinstance(val, str):
                            assert val.lower() not in forbidden_keys, (
                                f"forbidden doc step '{val}' in verification {v.get('id')}"
                            )

    def test_verification_detail_steps_excludes_photo(self, admin_token):
        """Hit /api/admin/verifications/{trainerId} on the seed trainer and verify
        the steps[] array does not contain a 'photo' entry."""
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient

        async def _get_trainer_id():
            client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = client[os.environ.get("DB_NAME", "rapidreps")]
            u = await db.users.find_one({"email": TRAINER_EMAIL})
            return str(u["_id"]) if u else None

        tid = asyncio.run(_get_trainer_id())
        if not tid:
            pytest.skip("No test trainer found")
        r = requests.get(
            f"{BASE_URL}/api/admin/verifications/{tid}/detail",
            headers=auth_headers(admin_token),
            timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        steps = r.json().get("steps") or []
        step_ids = [s.get("id") for s in steps]
        assert "photo" not in step_ids, f"photo step still present in verification detail: {step_ids}"
        assert "video" not in step_ids, f"video step still present in verification detail: {step_ids}"
        # Should contain the documented 5 (photo + video were removed per iter98g/98h)
        for expected in ["identity", "background", "certification", "cpr", "insurance"]:
            assert expected in step_ids, f"missing step {expected}; got {step_ids}"


# ---------- Regression: payments CSV export ----------
class TestPaymentsCsvExport:
    def test_csv_export_still_works(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/payments/csv-export",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"csv-export failed: {r.status_code} {r.text[:300]}"
        ctype = r.headers.get("content-type", "")
        assert "csv" in ctype.lower() or "text/plain" in ctype.lower() or "octet-stream" in ctype.lower(), (
            f"unexpected content-type: {ctype}"
        )
