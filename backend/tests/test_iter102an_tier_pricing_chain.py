"""iter102an — Tier-rates-first pricing across booking, admin, trainer surfaces.

Locks in the fix for the user-reported pricing chain bug:
- Trainee booking screen showed $90 (correct).
- Admin sessions list showed $52.99 (WRONG — used the legacy default).
- Trainer pending card showed $40 (WRONG — used trainer 80% take of the legacy default).

Root cause: `calculate_session_pricing` only read the legacy hourly
`outdoorRateCents` field, ignoring the per-duration `tierRates` the trainer
actually configured. Fix: prefer `tierRates[inPerson60Cents]` as the session
gross, fall back to legacy hourly only when no tier rate is present.
"""
from deps import calculate_session_pricing  # noqa: E402
from models import SessionType  # noqa: E402


def _trainer_with_tier(price_cents: int) -> dict:
    return {
        'tierRates': {
            'inPerson30Cents': 4500,
            'inPerson45Cents': 6500,
            'inPerson60Cents': price_cents,
            'inPerson90Cents': 12000,
            'virtual30Cents': 3500,
            'virtual60Cents': 6500,
        },
        # Legacy seeds — should be ignored when tier rates exist.
        'outdoorRateCents': 4000,
        'virtualRateCents': 3000,
        'inHomeRateCents': 6000,
    }


def test_outdoor_60min_uses_tier_rate_not_legacy_default():
    """When a trainer sets `inPerson60Cents = 9000` ($90), the trainee
    should be charged $90 + $2.99 service fee = $92.99, not the legacy
    $40-hourly → $50 grossed → $52.99 result."""
    trainer = _trainer_with_tier(9000)
    p = calculate_session_pricing(SessionType.OUTDOOR, trainer, duration_minutes=60)
    assert p['baseSessionPriceCents'] == 9000, p
    assert p['totalChargedCents'] == 9000 + 299, p
    # Trainer earns 80% of $90 = $72.00
    assert p['trainerEarningsCents'] == 7200, p


def test_in_home_60min_also_uses_inperson_tier_rate():
    """Outdoor and In-Home are both 'in-person' from the trainer's perspective."""
    trainer = _trainer_with_tier(9000)
    p = calculate_session_pricing(SessionType.IN_HOME, trainer, duration_minutes=60)
    assert p['baseSessionPriceCents'] == 9000


def test_virtual_uses_separate_virtual_tier():
    trainer = _trainer_with_tier(9000)
    p = calculate_session_pricing(SessionType.VIRTUAL, trainer, duration_minutes=60)
    # virtual60Cents = 6500
    assert p['baseSessionPriceCents'] == 6500
    assert p['totalChargedCents'] == 6500 + 299
    assert p['trainerEarningsCents'] == 5200


def test_fallback_to_legacy_when_no_tier_rate():
    """If the trainer never set tier rates, fall back to the legacy hourly
    (graceful for old accounts)."""
    legacy_only = {
        'outdoorRateCents': 4800,  # $48/hr take-home
        'tierRates': {},
    }
    p = calculate_session_pricing(SessionType.OUTDOOR, legacy_only, duration_minutes=60)
    # 4800 / 0.80 = 6000 gross → above minimum
    assert p['baseSessionPriceCents'] == 6000


def test_30min_session_picks_30min_tier():
    trainer = _trainer_with_tier(9000)
    p = calculate_session_pricing(SessionType.OUTDOOR, trainer, duration_minutes=30)
    # inPerson30Cents = 4500
    assert p['baseSessionPriceCents'] == 4500
    assert p['trainerEarningsCents'] == 3600
