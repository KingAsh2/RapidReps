"""
RapidReps Tier Pricing — Canonical Source of Truth (iter92).

Three-tier marketplace pricing model. Admin assigns tier on verification.
Trainer sets rate within tier's cap range. Customer pays customer_total only.

Matrix (in cents):
| Tier      | Modality   | 30min cap | 60min cap | 90min cap | Commission % | Service Fee |
|-----------|------------|-----------|-----------|-----------|--------------|-------------|
| new       | in_person  | 3500      | 6500      | 9500      | 25           | 499         |
| new       | virtual    | 3000      | 5500      | 8000      | 25           | 399         |
| certified | in_person  | 5000      | 9000      | 13000     | 20           | 599         |
| certified | virtual    | 4500      | 8000      | 11500     | 20           | 499         |
| specialty | in_person  | 7500      | 14000     | 20000     | 15           | 799         |
| specialty | virtual    | 6500      | 12000     | 17500     | 15           | 599         |

Formula:
    trainer_take_home = base * (1 - commission_rate)
    commission        = base * commission_rate
    customer_total    = base + service_fee
    rapidreps_total   = commission + service_fee
"""
from typing import Literal, Optional, TypedDict


# ── Tier identifiers (string constants for DB persistence) ─────────────
class TrainerTierV2:
    NEW = "new"
    CERTIFIED = "certified"
    SPECIALTY = "specialty"
    ALL = (NEW, CERTIFIED, SPECIALTY)


Modality = Literal["in_person", "virtual"]
Duration = Literal[30, 60, 90]


# ── Tier matrix (single source of truth) ───────────────────────────────
# All money values in CENTS (int). All percentages as int (0–100).
TIER_MATRIX = {
    TrainerTierV2.NEW: {
        "label": "New Trainer",
        "commission_percent": 25,
        "trainer_percent": 75,
        "in_person": {
            "service_fee_cents": 499,
            "rate_caps_cents": {30: 3500, 60: 6500, 90: 9500},
        },
        "virtual": {
            "service_fee_cents": 399,
            "rate_caps_cents": {30: 3000, 60: 5500, 90: 8000},
        },
    },
    TrainerTierV2.CERTIFIED: {
        "label": "Certified Trainer",
        "commission_percent": 20,
        "trainer_percent": 80,
        "in_person": {
            "service_fee_cents": 599,
            "rate_caps_cents": {30: 5000, 60: 9000, 90: 13000},
        },
        "virtual": {
            "service_fee_cents": 499,
            "rate_caps_cents": {30: 4500, 60: 8000, 90: 11500},
        },
    },
    TrainerTierV2.SPECIALTY: {
        "label": "Specialty Trainer",
        "commission_percent": 15,
        "trainer_percent": 85,
        "in_person": {
            "service_fee_cents": 799,
            "rate_caps_cents": {30: 7500, 60: 14000, 90: 20000},
        },
        "virtual": {
            "service_fee_cents": 599,
            "rate_caps_cents": {30: 6500, 60: 12000, 90: 17500},
        },
    },
}


class PricingBreakdown(TypedDict):
    tier: str
    tier_label: str
    modality: str
    duration_min: int
    base_price_cents: int
    trainer_take_home_cents: int
    commission_cents: int
    service_fee_cents: int
    customer_total_cents: int
    rapidreps_total_cents: int
    commission_percent: int
    trainer_percent: int


# ── Lookup helpers ─────────────────────────────────────────────────────
def get_tier_config(tier: str) -> dict:
    if tier not in TIER_MATRIX:
        raise ValueError(f"Invalid trainer tier '{tier}'. Must be one of {TrainerTierV2.ALL}.")
    return TIER_MATRIX[tier]


def get_rate_cap_cents(tier: str, modality: str, duration_min: int) -> int:
    """Return the maximum base price (cents) a trainer can set for this tier/modality/duration."""
    cfg = get_tier_config(tier)
    if modality not in ("in_person", "virtual"):
        raise ValueError(f"Invalid modality '{modality}'. Must be 'in_person' or 'virtual'.")
    if duration_min not in (30, 60, 90):
        raise ValueError(f"Invalid duration '{duration_min}'. Must be 30, 60, or 90.")
    return cfg[modality]["rate_caps_cents"][duration_min]


def get_service_fee_cents(tier: str, modality: str) -> int:
    cfg = get_tier_config(tier)
    return cfg[modality]["service_fee_cents"]


def get_commission_percent(tier: str) -> int:
    return get_tier_config(tier)["commission_percent"]


def validate_trainer_rate_cents(tier: str, modality: str, duration_min: int, base_cents: int) -> tuple[bool, Optional[str]]:
    """Validate a trainer's proposed rate.
    Returns (is_valid, error_message). Trainer may set anywhere in [0, cap]."""
    try:
        cap = get_rate_cap_cents(tier, modality, duration_min)
    except ValueError as e:
        return False, str(e)
    if not isinstance(base_cents, int) or base_cents < 0:
        return False, "Rate must be a non-negative integer (cents)."
    if base_cents > cap:
        return False, f"Rate ${base_cents/100:.2f} exceeds tier cap of ${cap/100:.2f} for {tier}/{modality}/{duration_min}min."
    return True, None


# ── Pricing calculator ─────────────────────────────────────────────────
def calculate_pricing(
    tier: str,
    modality: str,
    duration_min: int,
    trainer_base_cents: int,
) -> PricingBreakdown:
    """Compute the full pricing breakdown for a session.

    Caller is responsible for validating that `trainer_base_cents <= cap`.
    """
    cfg = get_tier_config(tier)
    if modality not in ("in_person", "virtual"):
        raise ValueError(f"Invalid modality '{modality}'.")
    if duration_min not in (30, 60, 90):
        raise ValueError(f"Invalid duration '{duration_min}'.")
    if trainer_base_cents < 0:
        raise ValueError("trainer_base_cents must be non-negative.")

    commission_percent = cfg["commission_percent"]
    service_fee_cents = cfg[modality]["service_fee_cents"]

    commission_cents = int(round(trainer_base_cents * commission_percent / 100))
    trainer_take_home_cents = trainer_base_cents - commission_cents
    customer_total_cents = trainer_base_cents + service_fee_cents
    rapidreps_total_cents = commission_cents + service_fee_cents

    return {
        "tier": tier,
        "tier_label": cfg["label"],
        "modality": modality,
        "duration_min": duration_min,
        "base_price_cents": trainer_base_cents,
        "trainer_take_home_cents": trainer_take_home_cents,
        "commission_cents": commission_cents,
        "service_fee_cents": service_fee_cents,
        "customer_total_cents": customer_total_cents,
        "rapidreps_total_cents": rapidreps_total_cents,
        "commission_percent": commission_percent,
        "trainer_percent": cfg["trainer_percent"],
    }


def get_tier_summary() -> list[dict]:
    """Return the full tier matrix for frontend display + admin UI."""
    out = []
    for tier_key in TrainerTierV2.ALL:
        cfg = TIER_MATRIX[tier_key]
        out.append({
            "tier": tier_key,
            "label": cfg["label"],
            "commission_percent": cfg["commission_percent"],
            "trainer_percent": cfg["trainer_percent"],
            "in_person": cfg["in_person"],
            "virtual": cfg["virtual"],
        })
    return out
