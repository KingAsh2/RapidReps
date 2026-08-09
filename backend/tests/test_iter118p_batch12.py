"""
Batch 1+2 (iter118p) — RapidReps product-fixes spec.
Tests:
  - GET /api/trainer-profiles/{userId} → new reliability fields
  - POST /api/sessions/{id}/trainee-no-show-action (auth, validation, wait/refund)
  - POST /api/sessions/{id}/gps-checkin trainerLateCheckIn logic
  - GET /api/trainers/nearby returns isBoosted per trainer
"""
import os
import pytest
import requests
from datetime import datetime, timedelta
from bson import ObjectId
from pymongo import MongoClient

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://highlight-vibe-bugs.preview.emergentagent.com').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

TRAINEE_EMAIL = 'test_trainee_iter25@test.com'
TRAINEE_PW = 'Test123!'
TRAINER_EMAIL = 'test_trainer_iter25@test.com'
TRAINER_PW = 'Test123!'


# ---------- helpers ----------
def _login(email: str, pw: str) -> dict:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def trainee_auth():
    d = _login(TRAINEE_EMAIL, TRAINEE_PW)
    return {"token": d["access_token"], "id": d["user"]["id"], "headers": {"Authorization": f"Bearer {d['access_token']}"}}


@pytest.fixture(scope="module")
def trainer_auth():
    d = _login(TRAINER_EMAIL, TRAINER_PW)
    return {"token": d["access_token"], "id": d["user"]["id"], "headers": {"Authorization": f"Bearer {d['access_token']}"}}


@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


# ---------- trainer-profiles reliability fields ----------
class TestReliabilityFields:
    def test_trainer_profile_returns_reliability_fields(self, trainer_auth, trainee_auth):
        r = requests.get(
            f"{BASE_URL}/api/trainer-profiles/{trainer_auth['id']}",
            headers=trainee_auth['headers'], timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert 'onTimePercent' in data, "onTimePercent missing from response"
        assert 'completedSessionsForReliability' in data, "completedSessionsForReliability missing"
        assert isinstance(data['completedSessionsForReliability'], int)
        # onTimePercent may be null OR float
        assert data['onTimePercent'] is None or isinstance(data['onTimePercent'], (int, float))

    def test_no_completed_sessions_returns_zero_and_null(self, trainer_auth, trainee_auth, mongo):
        # Ensure trainer has no completed/no_show sessions for this test.
        count = mongo.sessions.count_documents({
            'trainerId': trainer_auth['id'],
            'status': {'$in': ['completed', 'no_show']},
        })
        r = requests.get(
            f"{BASE_URL}/api/trainer-profiles/{trainer_auth['id']}",
            headers=trainee_auth['headers'], timeout=15,
        )
        data = r.json()
        if count == 0:
            assert data['completedSessionsForReliability'] == 0
            assert data['onTimePercent'] is None
        else:
            assert data['completedSessionsForReliability'] == count


# ---------- trainee-no-show-action ----------
class TestTraineeNoShowAction:
    def test_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/sessions/000000000000000000000000/trainee-no-show-action",
                          json={"action": "wait"}, timeout=10)
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def _create_session(self, mongo, trainee_id, trainer_id, minutes_ago_start):
        start = datetime.utcnow() - timedelta(minutes=minutes_ago_start)
        doc = {
            'traineeId': trainee_id,
            'trainerId': trainer_id,
            'status': 'confirmed',
            'sessionDateTimeStart': start,
            'sessionDateTimeEnd': start + timedelta(hours=1),
            'locationLatitude': 39.2126, 'locationLongitude': -76.7130,
            'createdAt': datetime.utcnow(), 'updatedAt': datetime.utcnow(),
            'totalPrice': 50, 'sessionType': 'in_person',
            'TEST_iter118p': True,
        }
        res = mongo.sessions.insert_one(doc)
        return str(res.inserted_id)

    def test_invalid_action_returns_400(self, trainee_auth, trainer_auth, mongo):
        sid = self._create_session(mongo, trainee_auth['id'], trainer_auth['id'], 20)
        try:
            r = requests.post(f"{BASE_URL}/api/sessions/{sid}/trainee-no-show-action",
                              headers=trainee_auth['headers'], json={"action": "bogus"}, timeout=10)
            assert r.status_code == 400, r.text
        finally:
            mongo.sessions.delete_one({'_id': ObjectId(sid)})

    def test_wait_action_updates_session(self, trainee_auth, trainer_auth, mongo):
        sid = self._create_session(mongo, trainee_auth['id'], trainer_auth['id'], 20)
        try:
            r = requests.post(f"{BASE_URL}/api/sessions/{sid}/trainee-no-show-action",
                              headers=trainee_auth['headers'], json={"action": "wait"}, timeout=10)
            assert r.status_code == 200, r.text
            assert r.json().get("action") == "wait"
            doc = mongo.sessions.find_one({'_id': ObjectId(sid)})
            assert doc.get('traineeNoShowAction') == 'wait'
        finally:
            mongo.sessions.delete_one({'_id': ObjectId(sid)})

    def test_refund_before_15min_returns_400(self, trainee_auth, trainer_auth, mongo):
        # Session started 5 min ago → refund not yet allowed
        sid = self._create_session(mongo, trainee_auth['id'], trainer_auth['id'], 5)
        try:
            r = requests.post(f"{BASE_URL}/api/sessions/{sid}/trainee-no-show-action",
                              headers=trainee_auth['headers'], json={"action": "refund"}, timeout=10)
            assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"
            assert "15" in r.text
        finally:
            mongo.sessions.delete_one({'_id': ObjectId(sid)})

    def test_refund_after_15min_marks_no_show(self, trainee_auth, trainer_auth, mongo):
        sid = self._create_session(mongo, trainee_auth['id'], trainer_auth['id'], 20)
        # Ensure baseline strike count
        prev_profile = mongo.trainer_profiles.find_one({'userId': trainer_auth['id']}) or {}
        prev_strikes = prev_profile.get('noShowStrikes', 0)
        try:
            r = requests.post(f"{BASE_URL}/api/sessions/{sid}/trainee-no-show-action",
                              headers=trainee_auth['headers'], json={"action": "refund"}, timeout=10)
            assert r.status_code == 200, r.text
            doc = mongo.sessions.find_one({'_id': ObjectId(sid)})
            assert doc.get('status') == 'no_show'
            assert doc.get('trainerNoShow') is True
            assert doc.get('refundPending') is True
            profile = mongo.trainer_profiles.find_one({'userId': trainer_auth['id']})
            if profile is not None:
                assert profile.get('noShowStrikes', 0) == prev_strikes + 1
        finally:
            mongo.sessions.delete_one({'_id': ObjectId(sid)})
            # revert strike so we don't leave test residue
            if prev_profile:
                mongo.trainer_profiles.update_one(
                    {'userId': trainer_auth['id']},
                    {'$set': {'noShowStrikes': prev_strikes}}
                )


# ---------- gps-checkin lateness ----------
class TestGpsCheckinLateness:
    def _create_session_for_trainer(self, mongo, trainee_id, trainer_id, minutes_ago_start):
        start = datetime.utcnow() - timedelta(minutes=minutes_ago_start)
        doc = {
            'traineeId': trainee_id,
            'trainerId': trainer_id,
            'status': 'confirmed',
            'sessionDateTimeStart': start,
            'sessionDateTimeEnd': start + timedelta(hours=1),
            'locationLatitude': 39.2126, 'locationLongitude': -76.7130,
            'gpsCheckinRadiusMiles': 5,
            'createdAt': datetime.utcnow(), 'updatedAt': datetime.utcnow(),
            'totalPrice': 50, 'sessionType': 'in_person',
            'TEST_iter118p': True,
        }
        return str(mongo.sessions.insert_one(doc).inserted_id)

    def test_late_checkin_flags_trainer(self, trainee_auth, trainer_auth, mongo):
        # Session started 10 min ago → trainer is 10min late (>5)
        sid = self._create_session_for_trainer(mongo, trainee_auth['id'], trainer_auth['id'], 10)
        try:
            r = requests.post(
                f"{BASE_URL}/api/sessions/{sid}/gps-checkin",
                headers=trainer_auth['headers'],
                json={"latitude": 39.2126, "longitude": -76.7130}, timeout=10,
            )
            assert r.status_code == 200, r.text
            doc = mongo.sessions.find_one({'_id': ObjectId(sid)})
            assert doc.get('trainerLateCheckIn') is True, f"trainerLateCheckIn not set: {doc}"
            assert doc.get('trainerLateMinutes', 0) > 5
            assert doc.get('trainerCheckedInAt') is not None
        finally:
            mongo.sessions.delete_one({'_id': ObjectId(sid)})

    def test_ontime_checkin_no_late_flag(self, trainee_auth, trainer_auth, mongo):
        # Session started 2 min ago → within grace, not late
        sid = self._create_session_for_trainer(mongo, trainee_auth['id'], trainer_auth['id'], 2)
        try:
            r = requests.post(
                f"{BASE_URL}/api/sessions/{sid}/gps-checkin",
                headers=trainer_auth['headers'],
                json={"latitude": 39.2126, "longitude": -76.7130}, timeout=10,
            )
            assert r.status_code == 200, r.text
            doc = mongo.sessions.find_one({'_id': ObjectId(sid)})
            assert not doc.get('trainerLateCheckIn'), f"trainerLateCheckIn should be false/unset: {doc.get('trainerLateCheckIn')}"
        finally:
            mongo.sessions.delete_one({'_id': ObjectId(sid)})


# ---------- trainers/nearby isBoosted ----------
class TestTrainersNearbyIsBoosted:
    def test_nearby_returns_isBoosted(self, trainee_auth):
        r = requests.get(
            f"{BASE_URL}/api/trainers/nearby",
            headers=trainee_auth['headers'],
            params={"latitude": 39.2126, "longitude": -76.7130, "radiusMiles": 30},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        trainers = data.get('trainers', data) if isinstance(data, dict) else data
        assert isinstance(trainers, list)
        if trainers:
            for t in trainers[:5]:
                assert 'isBoosted' in t, f"isBoosted missing in trainer row: {list(t.keys())[:15]}"
                assert isinstance(t['isBoosted'], bool)
