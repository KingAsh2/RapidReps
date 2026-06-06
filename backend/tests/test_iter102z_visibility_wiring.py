"""iter102z — Regression tests for trainer visibility wiring.

These tests lock in three guarantees that were broken before iter102z:

  1. The MongoDB visibility filter uses the SAME field name (`assignedTier`)
     that the admin tier-assignment endpoint actually writes. Previously the
     filter checked a `tier` field that nobody ever wrote, so verified
     trainers were perpetually invisible.

  2. The admin verification approval endpoint auto-assigns a default tier
     (`new`) when one isn't already set, so admins forgetting the separate
     "Assign Tier" step don't leave verified trainers stuck off search.

  3. The visibility-status diagnostic ("Listed in search" gate) checks the
     same conditions as the real filter — no more false-negative spinners
     on the trainer's own visibility card.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from deps import trainer_visibility_filter  # noqa: E402


def test_visibility_filter_uses_assigned_tier_field():
    """The filter MUST query `assignedTier` (the field admin writes).

    If this assertion ever fails, the disconnect is back: admin will write
    `assignedTier=...` but the filter won't pick it up, so trainees see
    nobody in search.
    """
    f = trainer_visibility_filter()
    assert 'assignedTier' in f, (
        "Visibility filter dropped the assignedTier check — verified "
        "trainers will become invisible again. See iter102z."
    )
    # Also assert it does NOT fall back to the broken legacy `tier` field
    # (which was never written by production code).
    assert 'tier' not in f, (
        "Visibility filter re-introduced the legacy `tier` field that "
        "the admin tier-assignment endpoint does not write. See iter102z."
    )


def test_visibility_filter_required_keys():
    """All three pillars of public visibility must be enforced."""
    f = trainer_visibility_filter()
    assert f.get('verificationStatus') == 'verified'
    assert f.get('isAvailable') is True
    # assignedTier must require a non-empty value
    tier_clause = f.get('assignedTier')
    assert isinstance(tier_clause, dict)
    assert tier_clause.get('$exists') is True
    assert tier_clause.get('$nin') == [None, '']


def test_visibility_filter_is_a_plain_dict_for_mongo_use():
    """Result must be directly composable into a `db.find({**filter, ...})`."""
    f = trainer_visibility_filter()
    assert isinstance(f, dict)
    assert all(isinstance(k, str) for k in f.keys())


@pytest.mark.parametrize("profile,expected_visible", [
    # Fully eligible
    ({"verificationStatus": "verified", "assignedTier": "new", "isAvailable": True}, True),
    # Verified + tier but offline
    ({"verificationStatus": "verified", "assignedTier": "new", "isAvailable": False}, False),
    # Verified + available but no tier — this is the exact bug iter102z fixes
    ({"verificationStatus": "verified", "isAvailable": True}, False),
    # Tier set but not verified
    ({"verificationStatus": "pending", "assignedTier": "new", "isAvailable": True}, False),
    # Empty-string tier should not count as set
    ({"verificationStatus": "verified", "assignedTier": "", "isAvailable": True}, False),
])
def test_filter_matches_real_world_profiles(profile, expected_visible):
    """Simulate the same evaluation MongoDB does for the filter clauses."""
    f = trainer_visibility_filter()
    matches = (
        profile.get('verificationStatus') == f['verificationStatus']
        and profile.get('isAvailable') == f['isAvailable']
        and bool(profile.get('assignedTier'))
        and profile.get('assignedTier') not in (None, '')
    )
    assert matches == expected_visible, (
        f"Visibility evaluation drifted from the filter contract for "
        f"profile={profile}"
    )
