"""
Iter95b — Static guards for trainer session-detail screen, Welcome A/B harness,
and tier-assigned email wiring.
"""
import re
from pathlib import Path

FRONTEND = Path("/app/frontend")
BACKEND = Path("/app/backend")


# ── Trainer session-detail screen ─────────────────────────────────────
def test_trainer_session_detail_exists():
    f = FRONTEND / "app/trainer/session-detail.tsx"
    assert f.exists(), "Trainer session-detail screen must exist"
    src = f.read_text()
    assert "NegotiationPanel" in src, "Trainer session-detail must embed NegotiationPanel"
    assert "currentUserRole=\"trainer\"" in src, "NegotiationPanel must be invoked with trainer role"
    assert "designSystem" in src or "from '../../src/theme/designSystem'" in src, \
        "Trainer session-detail must use the unified design system tokens (DS)"


def test_trainer_sessions_list_navigates_to_detail():
    f = FRONTEND / "app/trainer/(tabs)/sessions.tsx"
    src = f.read_text()
    assert "/trainer/session-detail?sessionId=" in src, \
        "Trainer sessions tab must navigate into the new detail screen"


# ── Welcome A/B harness ───────────────────────────────────────────────
def test_welcome_variant_flag_present_in_premium_theme():
    f = FRONTEND / "src/theme/premium.ts"
    src = f.read_text()
    assert "WELCOME_VARIANT" in src, "premium.ts must export WELCOME_VARIANT"
    assert "EXPO_PUBLIC_WELCOME_VARIANT" in src, "WELCOME_VARIANT must read from EXPO_PUBLIC_WELCOME_VARIANT"


def test_welcome_variant_b_file_exists():
    assert (FRONTEND / "app/index.premium-b.tsx").exists(), \
        "Variant B Welcome stub must exist for the A/B harness"


def test_index_switcher_routes_by_variant():
    src = (FRONTEND / "app/index.tsx").read_text()
    assert "WELCOME_VARIANT" in src, "index.tsx must consult WELCOME_VARIANT"
    assert "index.premium-b" in src, "index.tsx must reference variant B"
    assert "index.premium" in src, "index.tsx must reference variant A (premium)"


# ── Tier-assigned email wiring ────────────────────────────────────────
def test_tier_assigned_email_helper_exists():
    src = (BACKEND / "email_service.py").read_text()
    assert "send_tier_assigned_email" in src, \
        "email_service must expose send_tier_assigned_email"
    assert "take_home_pct" in src, "tier-assigned email must include take-home %"


def test_admin_assign_tier_route_sends_email():
    src = (BACKEND / "routes/payment_routes.py").read_text()
    # Confirm import + invocation inside admin_assign_tier
    assign_tier_block = re.search(
        r"async def admin_assign_tier\([\s\S]+?return \{\"success\": True",
        src,
    )
    assert assign_tier_block, "admin_assign_tier route must be present"
    block = assign_tier_block.group(0)
    assert "send_tier_assigned_email" in block, \
        "admin_assign_tier must invoke send_tier_assigned_email"
    assert "take_home_pct" in block, \
        "admin_assign_tier must compute take_home_pct from commission_percent"


# ── Payment gating still in place ─────────────────────────────────────
def test_create_payment_intent_negotiation_gate_present():
    src = (BACKEND / "routes/payment_routes.py").read_text()
    # The gate must reference paymentReady AND negotiationStatus == 'agreed'
    assert "paymentReady" in src, "create_payment_intent must reference paymentReady"
    assert "negotiationStatus" in src and "agreed" in src, \
        "create_payment_intent must require negotiationStatus == 'agreed'"


# ── SessionResponse extended ──────────────────────────────────────────
def test_session_response_surfaces_negotiation_fields():
    src = (BACKEND / "models.py").read_text()
    for field in (
        "negotiationStatus",
        "agreedTime",
        "agreedLocation",
        "paymentReady",
    ):
        assert field + ":" in src, f"SessionResponse must include {field}"
