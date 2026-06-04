"""
Iter96b — Sprint A bug fixes + Sprint B pricing system + Corporate credit hook.

Coverage:
  • Item #5: Trainer visibility filter applied to discovery/nearby/search
  • Item #21 + #23: 45-min rates supported and flat $2.99 service fee
  • Item #24: pricing.ts frontend matrix mirrors backend after migration
  • Item #25: trainer-detail.tsx now uses tierRates per-duration (no per-hour math)
  • In-flight: corporate quote endpoint behavior + payment_routes integration
  • In-flight: hash-based A/B variant scaffolding present
"""
from pathlib import Path

import requests

API_BASE = "http://localhost:8001"
FRONTEND = Path("/app/frontend")
BACKEND = Path("/app/backend")


# ── #21: 45-min duration accepted by pricing engine ──────────────────
def test_pricing_quote_45_min_supported():
    # Public auth required — we use an admin token from existing fixtures
    r0 = requests.post(
        f"{API_BASE}/api/auth/login",
        json={"email": "test_trainee_iter25@test.com", "password": "Test123!"},
        timeout=10,
    )
    tok = (r0.json().get("access_token") or r0.json().get("token"))
    r = requests.get(
        f"{API_BASE}/api/pricing/quote",
        params={"tier": "certified", "modality": "in_person", "duration": 45, "base_cents": 7000},
        headers={"Authorization": f"Bearer {tok}"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    b = r.json()
    # iter96b: flat fee everywhere
    assert b["service_fee_cents"] == 299
    assert b["customer_total_cents"] == 7000 + 299
    assert b["base_price_cents"] == 7000


# ── #23: flat $2.99 service fee everywhere ───────────────────────────
def test_pricing_quote_flat_fee_across_all_tiers():
    r0 = requests.post(
        f"{API_BASE}/api/auth/login",
        json={"email": "test_trainee_iter25@test.com", "password": "Test123!"},
        timeout=10,
    )
    tok = (r0.json().get("access_token") or r0.json().get("token"))
    for tier in ("new", "certified", "specialty"):
        for modality in ("in_person", "virtual"):
            r = requests.get(
                f"{API_BASE}/api/pricing/quote",
                params={"tier": tier, "modality": modality, "duration": 60, "base_cents": 5000},
                headers={"Authorization": f"Bearer {tok}"},
                timeout=10,
            )
            assert r.status_code == 200, f"{tier}/{modality}: {r.text}"
            assert r.json()["service_fee_cents"] == 299, f"{tier}/{modality}"


# ── Static guards: frontend mirrors backend ─────────────────────────
def test_frontend_pricing_has_45_min_and_flat_fee():
    src = (FRONTEND / "src/utils/pricing.ts").read_text()
    assert "FLAT_SERVICE_FEE_CENTS = 299" in src
    assert "45:" in src  # 45-min rate caps present
    assert "Duration = 30 | 45 | 60 | 90" in src


def test_trainer_set_rates_screen_has_45_min_rows():
    src = (FRONTEND / "app/trainer/set-rates.tsx").read_text()
    assert "inPerson45" in src
    assert "virtual45" in src
    # #22: customer pricing line should be removed
    assert "Cust:" not in src


def test_trainer_detail_uses_tierRates_per_duration():
    src = (FRONTEND / "app/trainee/trainer-detail.tsx").read_text()
    assert "tierRates" in src
    # The old buggy formula must be gone
    assert "* (duration / 60) + 2)" not in src


def test_confirm_booking_uses_flat_299_fee():
    src = (FRONTEND / "app/trainee/confirm-booking.tsx").read_text()
    assert "const serviceFeeCents = 299" in src


# ── In-flight: hash-based A/B scaffold ──────────────────────────────
def test_ab_variant_hook_present():
    src = (FRONTEND / "src/utils/abVariant.ts").read_text()
    assert "useWelcomeVariant" in src
    assert "fnv1a" in src  # hash function
    assert "@rapidreps_ab_device_id" in src


def test_welcome_router_uses_hook():
    src = (FRONTEND / "app/index.tsx").read_text()
    assert "useWelcomeVariant" in src


# ── In-flight: corporate quote integration in payment flow ──────────
def test_payment_intent_imports_corporate_helpers():
    src = (BACKEND / "routes/payment_routes.py").read_text()
    assert "compute_corporate_subsidy" in src
    assert "commit_corporate_subsidy" in src
    assert "corporateSubsidyCents" in src


# ── #5: trainer visibility filter applied at backend ─────────────────
def test_visibility_filter_applied_to_listings():
    matching = (BACKEND / "routes/matching.py").read_text()
    matching_routes = (BACKEND / "routes/matching_routes.py").read_text()
    location_routes = (BACKEND / "routes/location_routes.py").read_text()
    profile_routes = (BACKEND / "routes/profile_routes.py").read_text()
    for path, body in [
        ("matching.py", matching),
        ("matching_routes.py", matching_routes),
        ("location_routes.py", location_routes),
        ("profile_routes.py", profile_routes),
    ]:
        assert ("trainer_visibility_filter" in body) or ("_visibility_filter" in body), \
            f"{path} not applying visibility filter"


# ── #16, #17: Banners removed ───────────────────────────────────────
def test_stripe_payouts_banner_removed():
    src = (FRONTEND / "app/trainer/(tabs)/home.tsx").read_text()
    assert "Set Up Stripe Payouts" not in src


def test_new_trainers_banner_removed():
    src = (FRONTEND / "app/trainee/(tabs)/home.tsx").read_text()
    # The label itself should not be in any rendered Text node.
    assert 'sectionTitle}>NEW TRAINERS' not in src


# ── #4: Admin logout calls AuthContext ──────────────────────────────
def test_admin_logout_uses_authcontext():
    src = (FRONTEND / "app/admin/dashboard.tsx").read_text()
    assert "useAuth" in src
    assert "authLogout" in src


# ── #10: Admin user-row → open user profile ─────────────────────────
def test_admin_can_open_user_profile_from_dashboard():
    src = (FRONTEND / "app/admin/dashboard.tsx").read_text()
    assert "handleOpenUserProfile" in src
    assert "Open Full Profile" in src


# ── #2: Messaging timestamps use local TZ ───────────────────────────
def test_messages_dropped_en_us_locale():
    for f in [
        "app/messages/index.tsx",
        "app/messages/chat.tsx",
        "app/trainee/(tabs)/messages.tsx",
        "app/trainer/(tabs)/messages.tsx",
    ]:
        src = (FRONTEND / f).read_text()
        # locale must be undefined (device locale) — no hardcoded 'en-US' on the
        # active formatTime helper
        assert "'en-US'" not in src or "toLocaleTimeString(undefined" in src
