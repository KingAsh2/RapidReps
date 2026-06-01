"""Iteration 83 — Phase A: UI cleanup & proximity filter strict enforcement.

Validates the trainee home tweaks from user-marked PDF/screenshot feedback:
- "Need a Trainer Now" banner removed
- "Instant Workout" feature tile removed
- "Travel to Trainer Proximity" → "Trainer Proximity" relabel
- "No trainers nearby → Find Virtual Trainers" empty state replaced with
  "No trainers within X mi → Adjust Radius"
- Proximity filter strictly drops trainers w/ unknown distance
- SCANNING AREA + SCAN button text/border now orange (was green)
"""
import os
import re

FRONTEND_HOME = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "app", "trainee", "(tabs)", "home.tsx")
FRONTEND_MAP = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src", "components", "NearbyTrainersMap.native.tsx")


def _read(p: str) -> str:
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


def test_need_a_trainer_now_banner_removed():
    src = _read(FRONTEND_HOME)
    assert "NEED A TRAINER NOW?" not in src, "Urgent CTA banner must be removed (user request)"
    # The actual JSX block that used to render the banner must be gone
    assert "styles.urgentBanner}" not in src and "styles.urgentContent}" not in src, (
        "Urgent banner JSX must be removed (style remnants in StyleSheet are harmless)"
    )


def test_instant_workout_tile_removed():
    src = _read(FRONTEND_HOME)
    assert 'data-testid="instant-workout-btn"' not in src, "Instant Workout tile must be removed"
    assert "Instant{'\\n'}Workout" not in src, "Instant Workout tile label must be gone"


def test_proximity_label_renamed():
    src = _read(FRONTEND_HOME)
    assert ">Trainer Proximity<" in src, "Label must read 'Trainer Proximity'"
    assert ">Travel to Trainer Proximity<" not in src, "Old label must be removed"


def test_proximity_filter_strictly_drops_unknown_distance():
    src = _read(FRONTEND_HOME)
    # The fixed predicate should drop trainers w/o distance, not let them through
    assert "// show trainers without distance data" not in src, (
        "Old leaky predicate ('show trainers without distance data') must be gone"
    )
    # Look for the new strict comment or behavior
    assert re.search(r"if \(t\.distance === null \|\| t\.distance === undefined\) return false;", src), (
        "Strict drop path missing in getFilteredAndSortedTrainers"
    )


def test_empty_state_no_longer_pushes_virtual():
    src = _read(FRONTEND_HOME)
    assert "Find Virtual Trainers" not in src, (
        "'Find Virtual Trainers' empty-state CTA must be removed"
    )
    assert "No trainers nearby" not in src, "Old empty title must be replaced"
    assert "Adjust Radius" in src, "New 'Adjust Radius' CTA missing"
    assert "No trainers within" in src, "New empty title missing"


def test_map_filtered_by_proximity():
    src = _read(FRONTEND_HOME)
    # The NearbyTrainersMap call should now pass a filtered list, not raw nearbyTrainers
    map_block = re.search(r"<NearbyTrainersMap[\s\S]*?/>", src)
    assert map_block, "NearbyTrainersMap usage not found"
    block = map_block.group(0)
    assert "trainers={nearbyTrainers}" not in block, (
        "Map must receive filtered trainers, not raw nearbyTrainers"
    )
    assert "travelProximity" in block, "Map trainers list must filter by travelProximity"


def test_scanning_area_uses_orange():
    src = _read(FRONTEND_MAP)
    # The headLabel, scanBtn/scanText, and the radio icon must use N.orange now
    assert re.search(r"headLabel:\s*\{[^}]*color:\s*N\.orange", src), "SCANNING AREA label must be orange"
    assert re.search(r"scanText:\s*\{[^}]*color:\s*N\.orange", src), "SCAN button text must be orange"
    assert re.search(r"scanBtn:\s*\{[^}]*borderColor:\s*N\.orange", src), "SCAN button border must be orange"
