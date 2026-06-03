"""
Iter92 pricing-tier matrix guard.

Every single cell of the user-specified tier matrix is asserted against
the canonical `services/pricing_tiers.calculate_pricing()` function.
If anyone tweaks the matrix accidentally, this guard surfaces the diff.
"""
import sys
from pathlib import Path

# Make /app/backend importable as a flat package
BACKEND = Path("/app/backend")
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from services.pricing_tiers import (  # type: ignore  # noqa: E402
    TrainerTierV2,
    calculate_pricing,
    get_rate_cap_cents,
    get_service_fee_cents,
    get_commission_percent,
    validate_trainer_rate_cents,
    get_tier_summary,
)


# --- The user's published matrix (cents) ----------------------------------
# Columns: tier, modality, duration, base, take_home, commission, service_fee, customer_total, rapidreps_total
MATRIX = [
    # In-person — New (75/25)
    ("new", "in_person", 30, 3500, 2625, 875, 499, 3999, 1374),
    ("new", "in_person", 60, 6500, 4875, 1625, 499, 6999, 2124),
    ("new", "in_person", 90, 9500, 7125, 2375, 499, 9999, 2874),
    # In-person — Certified (80/20)
    ("certified", "in_person", 30, 5000, 4000, 1000, 599, 5599, 1599),
    ("certified", "in_person", 60, 9000, 7200, 1800, 599, 9599, 2399),
    ("certified", "in_person", 90, 13000, 10400, 2600, 599, 13599, 3199),
    # In-person — Specialty (85/15)
    ("specialty", "in_person", 30, 7500, 6375, 1125, 799, 8299, 1924),
    ("specialty", "in_person", 60, 14000, 11900, 2100, 799, 14799, 2899),
    ("specialty", "in_person", 90, 20000, 17000, 3000, 799, 20799, 3799),
    # Virtual — New
    ("new", "virtual", 30, 3000, 2250, 750, 399, 3399, 1149),
    ("new", "virtual", 60, 5500, 4125, 1375, 399, 5899, 1774),
    ("new", "virtual", 90, 8000, 6000, 2000, 399, 8399, 2399),
    # Virtual — Certified
    ("certified", "virtual", 30, 4500, 3600, 900, 499, 4999, 1399),
    ("certified", "virtual", 60, 8000, 6400, 1600, 499, 8499, 2099),
    ("certified", "virtual", 90, 11500, 9200, 2300, 499, 11999, 2799),
    # Virtual — Specialty (note: user table shows $148.75 take-home on 30min,
    # which rounds to 5525 cents -- 5525 = 6500-975. Recompute: 6500 * 15% = 975.)
    ("specialty", "virtual", 30, 6500, 5525, 975, 599, 7099, 1574),
    ("specialty", "virtual", 60, 12000, 10200, 1800, 599, 12599, 2399),
    ("specialty", "virtual", 90, 17500, 14875, 2625, 599, 18099, 3224),
]


def test_matrix_cells_match_canonical_calculator():
    failures = []
    for (tier, modality, duration, base, take, commission, fee, customer, rapidreps) in MATRIX:
        result = calculate_pricing(tier, modality, duration, base)
        expected = {
            "trainer_take_home_cents": take,
            "commission_cents": commission,
            "service_fee_cents": fee,
            "customer_total_cents": customer,
            "rapidreps_total_cents": rapidreps,
        }
        for key, exp_val in expected.items():
            actual = result[key]
            if actual != exp_val:
                failures.append(
                    f"  {tier}/{modality}/{duration}min base=${base/100:.2f} "
                    f"{key}: expected {exp_val} got {actual}"
                )
    assert not failures, "Pricing matrix mismatch:\n" + "\n".join(failures)


def test_rate_caps_match_matrix_max_values():
    # Sanity: the cap returned for each row should equal the row's `base`
    # (since base IS the maximum tier price).
    for (tier, modality, duration, base, *_rest) in MATRIX:
        cap = get_rate_cap_cents(tier, modality, duration)
        assert cap == base, (
            f"Cap for {tier}/{modality}/{duration}min should be {base} got {cap}"
        )


def test_validate_trainer_rate_accepts_within_cap():
    for tier in TrainerTierV2.ALL:
        for modality in ("in_person", "virtual"):
            for duration in (30, 60, 90):
                cap = get_rate_cap_cents(tier, modality, duration)
                # 0, half, exactly cap → all valid
                for v in (0, cap // 2, cap):
                    ok, err = validate_trainer_rate_cents(tier, modality, duration, v)
                    assert ok, f"{tier}/{modality}/{duration} base={v} should be valid: {err}"
                # cap + 1 → invalid
                ok, err = validate_trainer_rate_cents(tier, modality, duration, cap + 1)
                assert not ok, f"{tier}/{modality}/{duration} base={cap+1} should be rejected"


def test_validate_trainer_rate_rejects_negative_and_bad_types():
    ok, _ = validate_trainer_rate_cents("new", "in_person", 60, -1)
    assert not ok, "negative rate must be rejected"
    ok, err = validate_trainer_rate_cents("bogus", "in_person", 60, 1000)
    assert not ok and "tier" in (err or "").lower()


def test_commission_percentages_are_canonical():
    assert get_commission_percent("new") == 25
    assert get_commission_percent("certified") == 20
    assert get_commission_percent("specialty") == 15


def test_get_tier_summary_has_all_three_tiers():
    summary = get_tier_summary()
    assert {t["tier"] for t in summary} == {"new", "certified", "specialty"}
    for t in summary:
        assert set(t.keys()) >= {"tier", "label", "commission_percent",
                                  "trainer_percent", "in_person", "virtual"}
        for modality in ("in_person", "virtual"):
            assert set(t[modality].keys()) == {"service_fee_cents", "rate_caps_cents"}
            assert set(t[modality]["rate_caps_cents"].keys()) == {30, 60, 90}


def test_invariant_take_home_plus_commission_equals_base():
    """trainer_take_home + commission MUST always equal base price."""
    for (tier, modality, duration, base, take, commission, *_rest) in MATRIX:
        assert take + commission == base, f"Identity violated for {tier}/{modality}/{duration}"


def test_invariant_customer_total_equals_base_plus_service_fee():
    for (tier, modality, duration, base, _take, _comm, fee, customer, *_rest) in MATRIX:
        assert base + fee == customer, f"Customer total wrong for {tier}/{modality}/{duration}"


def test_invariant_rapidreps_total_equals_commission_plus_service_fee():
    for (tier, modality, duration, _base, _take, commission, fee, _customer, rr_total) in MATRIX:
        assert commission + fee == rr_total, f"RR total wrong for {tier}/{modality}/{duration}"
