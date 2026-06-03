"""
Iter94 — Admin Tier-Assign UI + Design System tokens
"""
from pathlib import Path


def test_design_system_tokens_file_exists():
    f = Path("/app/frontend/src/theme/designSystem.ts")
    assert f.exists(), "Missing /app/frontend/src/theme/designSystem.ts"
    src = f.read_text(encoding="utf-8")
    # Must export the unified DS namespace
    for token in ("DSColors", "DSSpacing", "DSRadii", "DSShadows", "DSText", "DSCard", "DSOverlay", "DS"):
        assert f"export const {token}" in src or f"export default {token}" in src, (
            f"Design system must export {token}"
        )


def test_design_system_radii_canonical():
    """Card radius should be 18, input 14 — locked so screens converge consistently."""
    src = Path("/app/frontend/src/theme/designSystem.ts").read_text(encoding="utf-8")
    assert "card: 18" in src
    assert "input: 14" in src
    assert "pill: 9999" in src


def test_admin_verification_has_tier_picker_buttons():
    """Replaces the legacy single 'Approve Trainer' button with 3 tier buttons."""
    f = Path("/app/frontend/src/components/admin/VerificationsTab.tsx")
    src = f.read_text(encoding="utf-8")
    for tid in ("approve-tier-new-btn", "approve-tier-certified-btn", "approve-tier-specialty-btn"):
        assert f'data-testid="{tid}"' in src, (
            f"Admin verification must expose {tid} (one button per tier)"
        )
    # And the assign-tier endpoint must be called before approve
    assert "/admin/trainers/" in src
    assert "/assign-tier" in src
    # The old single 'Approve Trainer' button id should be GONE
    assert "approve-verification-btn" not in src, (
        "Legacy single approve button should be replaced by 3 tier buttons"
    )
