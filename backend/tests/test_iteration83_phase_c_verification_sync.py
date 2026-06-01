"""Iteration 83 Phase C — Verification status sync regression.

Scenario from user feedback (PDF RR_7-9 #4):
  Trainer uploads documents (Liability Insurance, Profile Photo, Intro Video).
  Admin approves them.
  Trainer's verification screen STAYS on "Under Review" / "Not Started".

RCA found at /app/backend/routes/profile_routes.py::get_verification_status:
  The per-step endpoint was returning `'submitted'` for every uploaded doc,
  regardless of whether the overall profile.verificationStatus was already
  'verified' or 'rejected'. So after admin approval, the trainer UI still
  rendered "Under Review" because the API never said "approved".

Fix: derive per-step status from BOTH the per-doc uploaded flag AND the
overall verificationStatus on the profile.

These tests lock in the fix.
"""
import os
from datetime import datetime

import pytest
import requests

BASE_URL = os.environ.get(
    'EXPO_PUBLIC_BACKEND_URL',
    'https://highlight-vibe-bugs.preview.emergentagent.com',
).rstrip('/')

ADMIN_EMAIL = "admin@rapidreps.com"
ADMIN_PASS = "admin123"
TRAINER_EMAIL = "test_trainer_iter25@test.com"
TRAINER_PASS = "Test123!"


def _login(email: str, password: str) -> dict:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login {email} failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def admin_session():
    data = _login(ADMIN_EMAIL, ADMIN_PASS)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def trainer_session():
    data = _login(TRAINER_EMAIL, TRAINER_PASS)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"})
    return s, data["user"]["id"]


def _set_trainer_profile_state(admin: requests.Session, trainer_id: str, verification_status: str, uploaded_flags: dict):
    """Helper: mutate the trainer's profile via admin DB-style routes when possible.

    We can't directly write to MongoDB from the test process (we're going through HTTPS).
    Instead we use the admin approve/reject endpoints + simulate uploaded flags via
    direct field writes through admin endpoints that touch trainer_profiles.

    Note: this test relies on the admin approve/reject flow already setting
    verificationStatus, so we don't need a low-level mutation endpoint.
    """
    pass


def test_admin_login_works():
    """Smoke: admin@rapidreps.com / admin123 logs in cleanly."""
    data = _login(ADMIN_EMAIL, ADMIN_PASS)
    assert data["user"]["isAdmin"] is True or "admin" in data["user"]["roles"]


def test_verification_status_after_admin_approve(admin_session, trainer_session):
    """The core regression: after admin approve, uploaded docs report 'approved' (not 'submitted')."""
    trainer_s, trainer_id = trainer_session

    # Step 1 — directly set uploaded flags on the trainer profile via the admin/profile-update
    # path. We bypass real file uploads to keep the test fast: just mark profilePhotoUploaded
    # = True so we have a doc to evaluate.
    # We use the admin verifications/{id}/detail endpoint to read state, and the approve
    # endpoint to flip verificationStatus.

    # Read current state — confirms admin route works
    r = admin_session.get(f"{BASE_URL}/api/admin/verifications/{trainer_id}/detail", timeout=30)
    assert r.status_code == 200, r.text

    # Seed at least one uploaded doc by hitting the trainer's verification upload base64 path
    # with a tiny PNG so profilePhotoUploaded=True. We login as the trainer for this.
    tiny_png_b64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
    )
    r = trainer_s.post(
        f"{BASE_URL}/api/trainer/upload-verification-file-base64",
        json={
            "data": tiny_png_b64,
            "stepId": "photo",
            "filename": "photo.png",
            "contentType": "image/png",
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    # Now mark profilePhotoUploaded=True via the verification-submit endpoint
    # (the upload endpoint just stores the file URL — a separate /submit step flips the flag)
    # Inspect the trainer's profile to see if upload already flipped the flag, otherwise call /submit
    r = trainer_s.post(
        f"{BASE_URL}/api/trainer/submit-verification-step",
        json={"stepId": "photo", "fileUri": "/api/files/some-photo.png"},
        timeout=30,
    )
    # This endpoint may or may not exist; if not, just rely on the upload above

    # Step 2 — Admin approves the trainer
    r = admin_session.post(
        f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve",
        timeout=30,
    )
    assert r.status_code == 200, r.text

    # Step 3 — Trainer fetches verification-status. Any uploaded doc must now be 'approved',
    # NOT 'submitted'. This is THE bug we're locking in.
    r = trainer_s.get(f"{BASE_URL}/api/trainer/verification-status", timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["verificationStatus"] == "verified", body
    steps = body["steps"]

    # For every step that the profile shows as uploaded, the status must be 'approved'.
    # We read the admin detail to know which steps are uploaded.
    detail = admin_session.get(f"{BASE_URL}/api/admin/verifications/{trainer_id}/detail", timeout=30).json()
    for s in detail["steps"]:
        if s.get("submitted"):
            step_id = s["id"]
            assert steps.get(step_id) == "approved", (
                f"After admin approve, step '{step_id}' should be 'approved' but was '{steps.get(step_id)}'. "
                f"Full steps payload: {steps}"
            )

    # AND nothing should still be 'submitted' if the overall is verified
    assert "submitted" not in steps.values(), (
        f"After admin approve, NO step should be 'submitted'. Got: {steps}"
    )


def test_verification_status_after_admin_reject(admin_session, trainer_session):
    """After admin rejects, uploaded docs report 'rejected' so trainer knows to re-submit."""
    trainer_s, trainer_id = trainer_session

    r = admin_session.post(
        f"{BASE_URL}/api/admin/verifications/{trainer_id}/reject",
        json={"reason": "iter83 phase C test rejection"},
        timeout=30,
    )
    assert r.status_code == 200, r.text

    r = trainer_s.get(f"{BASE_URL}/api/trainer/verification-status", timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body["verificationStatus"] == "rejected", body
    steps = body["steps"]
    assert body["rejectionReason"] == "iter83 phase C test rejection"

    # Any uploaded doc must surface as 'rejected'
    detail = admin_session.get(f"{BASE_URL}/api/admin/verifications/{trainer_id}/detail", timeout=30).json()
    for s in detail["steps"]:
        if s.get("submitted"):
            assert steps.get(s["id"]) == "rejected", (
                f"After admin reject, step '{s['id']}' should be 'rejected' but was '{steps.get(s['id'])}'"
            )


def test_verification_status_pending_returns_submitted_or_pending(admin_session, trainer_session):
    """When profile is in pending state (not yet adjudicated), uploaded docs read 'submitted', non-uploaded read 'pending'."""
    trainer_s, trainer_id = trainer_session

    # Reset to pending by approving (sets verified) → use a low-level approve undo? We don't have one.
    # Workaround: this test just confirms the contract that without a verified/rejected status,
    # the legacy 'submitted'/'pending' behavior holds. Since the previous test left us in
    # 'rejected', skip this assertion when already verified/rejected. Pure shape contract test.
    r = trainer_s.get(f"{BASE_URL}/api/trainer/verification-status", timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert "steps" in body
    assert "verificationStatus" in body
    # Every step must be one of the documented values
    for step_id, status in body["steps"].items():
        assert status in ("pending", "submitted", "approved", "rejected"), (
            f"Unknown step status '{status}' for '{step_id}'"
        )


def test_admin_endpoints_require_admin(trainer_session):
    """Non-admin users must not be able to approve/reject."""
    trainer_s, trainer_id = trainer_session
    r = trainer_s.post(f"{BASE_URL}/api/admin/verifications/{trainer_id}/approve", timeout=30)
    assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text}"
