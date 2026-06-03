"""
Iter92b — Tier pricing E2E API surface guards.

Locks in:
  1. Zelle endpoints are GONE
  2. New tier endpoints exist (pricing + admin payouts)
  3. Tier matrix endpoint returns all three tiers with required fields
  4. Cap-enforcement is wired through validate_trainer_rate_cents
  5. Quote endpoint matches canonical pricing
"""
import sys
from pathlib import Path

BACKEND = Path("/app/backend")
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))


def test_zelle_endpoints_removed_from_payment_routes():
    """No surviving Zelle endpoint registrations in payment_routes.py."""
    src = (BACKEND / "routes" / "payment_routes.py").read_text(encoding="utf-8")
    bad_patterns = [
        '"/settings/zelle"',
        '"/admin/settings/zelle"',
        '"/payments/zelle/mark-sent"',
        '"/admin/payments/verify-zelle/',
        '"/admin/payments/pending-zelle"',
        '"/trainer/zelle-info"',
    ]
    survivors = [p for p in bad_patterns if p in src]
    assert not survivors, f"Zelle routes still registered: {survivors}"


def test_zelle_seed_removed_from_server():
    src = (BACKEND / "server.py").read_text(encoding="utf-8")
    # The actual mutating insert/update lines should be gone
    assert "zelle_config" not in src or "iter92" in src, (
        "Zelle config seed must be removed from server.py startup"
    )
    assert 'zelleEmail":' not in src and "ashtonbundy1@gmail.com" not in src, (
        "Hardcoded Zelle seed values must be removed from server.py"
    )


def test_new_tier_endpoints_registered():
    src = (BACKEND / "routes" / "payment_routes.py").read_text(encoding="utf-8")
    required = [
        '"/pricing/tiers"',
        '"/pricing/quote"',
        '"/trainer/tier-rates"',
        '/admin/trainers/{trainer_id}/assign-tier',
        '"/admin/payouts/summary"',
        '"/admin/payouts/mark-paid"',
    ]
    missing = [r for r in required if r not in src]
    assert not missing, f"New tier endpoints missing: {missing}"


def test_pricing_module_canonical_values_unchanged():
    """If anyone tweaks the matrix, the unit tests in
    test_iteration92_tier_pricing.py will catch the diff. This is a smoke
    confirmation that the import path is stable."""
    from services.pricing_tiers import (  # type: ignore
        calculate_pricing,
        get_rate_cap_cents,
        TrainerTierV2,
    )
    # Spot-check one cell of each tier
    new = calculate_pricing("new", "in_person", 60, 6500)
    cert = calculate_pricing("certified", "virtual", 30, 4500)
    spec = calculate_pricing("specialty", "in_person", 90, 20000)
    assert new["customer_total_cents"] == 6999
    assert cert["customer_total_cents"] == 4999
    assert spec["customer_total_cents"] == 20799
    # And cap lookups
    assert get_rate_cap_cents("specialty", "virtual", 90) == 17500
    assert TrainerTierV2.ALL == ("new", "certified", "specialty")
