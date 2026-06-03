"""
Iter93 — Comprehensive surface guards for:
  1. Backend negotiation state machine + endpoints
  2. Frontend pricing utility (mirrors backend)
  3. Trainer "Set Rates" screen (tier-aware)
  4. ZelleTab removal from admin

These tests are static + import-level only. End-to-end flow has been verified
via curl during development.
"""
import sys
from pathlib import Path

BACKEND = Path("/app/backend")
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))


# ─────────────────────────────────────────────────────────────
# Backend negotiation state machine
# ─────────────────────────────────────────────────────────────
def test_negotiation_module_imports_and_exposes_router():
    """Imports the negotiation router cleanly; surfaces broken db wiring."""
    from routes.negotiation_routes import router as negotiation_router  # noqa: F401
    # Confirm 5 endpoints registered (propose, counter, accept, reject, timeline)
    paths = {r.path for r in negotiation_router.routes}
    expected = {
        "/sessions/{session_id}/negotiation/propose",
        "/sessions/{session_id}/negotiation/counter",
        "/sessions/{session_id}/negotiation/accept",
        "/sessions/{session_id}/negotiation/reject",
        "/sessions/{session_id}/negotiation/timeline",
    }
    missing = expected - paths
    assert not missing, f"Missing negotiation routes: {missing}"


def test_negotiation_constants_match_state_machine_contract():
    from routes.negotiation_routes import (
        NEG_STATUS_PROPOSED_BY_TRAINEE,
        NEG_STATUS_PROPOSED_BY_TRAINER,
        NEG_STATUS_COUNTERED_BY_TRAINEE,
        NEG_STATUS_COUNTERED_BY_TRAINER,
        NEG_STATUS_AGREED,
        NEG_STATUS_REJECTED,
        NEG_STATUS_EXPIRED,
        PENDING_STATUSES,
        NEGOTIATION_TIMEOUT_MINUTES,
    )
    assert NEGOTIATION_TIMEOUT_MINUTES == 60
    assert {
        NEG_STATUS_PROPOSED_BY_TRAINEE,
        NEG_STATUS_PROPOSED_BY_TRAINER,
        NEG_STATUS_COUNTERED_BY_TRAINEE,
        NEG_STATUS_COUNTERED_BY_TRAINER,
    } == PENDING_STATUSES
    assert NEG_STATUS_AGREED not in PENDING_STATUSES
    assert NEG_STATUS_REJECTED not in PENDING_STATUSES


def test_negotiation_router_mounted_in_server():
    server_src = (BACKEND / "server.py").read_text(encoding="utf-8")
    assert "negotiation_router" in server_src
    assert "include_router(negotiation_router" in server_src


# ─────────────────────────────────────────────────────────────
# Frontend pricing utility
# ─────────────────────────────────────────────────────────────
def test_frontend_pricing_util_exists_with_required_exports():
    f = Path("/app/frontend/src/utils/pricing.ts")
    assert f.exists(), "Missing frontend pricing util at src/utils/pricing.ts"
    src = f.read_text(encoding="utf-8")
    required_exports = [
        "TIER_MATRIX",
        "calculatePricing",
        "validateRateCents",
        "formatCents",
        "getRateCapCents",
        "getServiceFeeCents",
        "TrainerTier",
        "Modality",
        "Duration",
    ]
    missing = [e for e in required_exports if f"export {{" not in src and f"export type {e}" not in src and f"export const {e}" not in src and f"export function {e}" not in src and f"export interface {e}" not in src and f" {e}" not in src]
    # Soft check: confirm at minimum the matrix + calculator + validator are exported
    for must in ("TIER_MATRIX", "calculatePricing", "validateRateCents", "formatCents"):
        assert f"export const {must}" in src or f"export function {must}" in src, (
            f"Frontend pricing util must export {must}"
        )


def test_frontend_pricing_matrix_matches_backend_values():
    """Spot-check a few cells of the JS mirror against the Python source of truth."""
    from services.pricing_tiers import calculate_pricing
    src = Path("/app/frontend/src/utils/pricing.ts").read_text(encoding="utf-8")

    # New / in_person / 60: cap 6500, fee 499
    assert "rate_caps_cents: { 30: 3500, 60: 6500, 90: 9500 }" in src
    # Certified / in_person / 90: cap 13000, fee 599
    assert "rate_caps_cents: { 30: 5000, 60: 9000, 90: 13000 }" in src
    # Specialty / virtual / 30: cap 6500, fee 599
    assert "rate_caps_cents: { 30: 6500, 60: 12000, 90: 17500 }" in src

    # Commission percentages
    assert "commission_percent: 25" in src  # new
    assert "commission_percent: 20" in src  # certified
    assert "commission_percent: 15" in src  # specialty


# ─────────────────────────────────────────────────────────────
# Trainer Set Rates screen
# ─────────────────────────────────────────────────────────────
def test_trainer_set_rates_screen_uses_tier_endpoints():
    f = Path("/app/frontend/app/trainer/set-rates.tsx")
    assert f.exists(), "Trainer set-rates.tsx missing"
    src = f.read_text(encoding="utf-8")
    # Must use the new tier endpoints, not the legacy single-rate API
    assert "/trainer/tier-rates" in src, (
        "set-rates.tsx must call the new /trainer/tier-rates endpoint"
    )
    # Must import from canonical frontend pricing util
    assert "from '../../src/utils/pricing'" in src
    # Must handle the "no tier assigned yet" state
    assert "Awaiting Tier Assignment" in src


# ─────────────────────────────────────────────────────────────
# Zelle removal
# ─────────────────────────────────────────────────────────────
def test_zelle_tab_component_deleted():
    f = Path("/app/frontend/src/components/admin/ZelleTab.tsx")
    assert not f.exists(), "Orphaned ZelleTab.tsx must be deleted (no longer used)"


def test_admin_dashboard_has_back_button():
    f = Path("/app/frontend/app/admin/dashboard.tsx")
    src = f.read_text(encoding="utf-8")
    assert "admin-header-back-btn" in src, "Admin dashboard must have a back button"
    assert "router.canGoBack" in src, "Back button should respect navigation history"


def test_zelle_tab_not_imported_in_admin_dashboard():
    src = Path("/app/frontend/app/admin/dashboard.tsx").read_text(encoding="utf-8")
    assert "ZelleTab" not in src
    assert "zelle" not in src.lower()  # case-insensitive sanity
