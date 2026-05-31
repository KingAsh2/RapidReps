"""CI guards against the two crash classes that hit production in iter77 → iter79.

These are intentionally implemented as pytest tests (not a separate script) so they:
  * run automatically alongside the regression suite
  * fail loudly with the offending file/line numbers
  * cost ~50ms (pure filesystem + regex, no network)

Failure here means production deploy WILL crash. Fix before pushing.

Guards:
  1. No duplicate `export const NAME` identifiers in `frontend/src/services/api.ts`.
     (Duplicates blow up Metro in production with a SyntaxError; dev hot-reload silently
     wins-last-write.)

  2. No `*.tsx` file at the same path as a directory of the same name inside
     `frontend/app/` — Expo Router collides both into the same URL and the route tree
     construction throws on app boot.
"""
import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent  # /app
FRONTEND_APP_DIR = REPO_ROOT / "frontend" / "app"
API_FILE = REPO_ROOT / "frontend" / "src" / "services" / "api.ts"

EXPORT_CONST_RE = re.compile(r"^\s*export\s+const\s+([A-Za-z_$][\w$]*)\s*[:=]", re.MULTILINE)


# ---------------------------------------------------------------------------
# Guard 1 — duplicate `export const` in services/api.ts
# ---------------------------------------------------------------------------
def test_no_duplicate_export_const_in_api_ts():
    """Iter77 introduced a duplicate `export const referralAPI = ...` which broke
    EAS production builds with `Identifier 'referralAPI' has already been declared.`
    Dev hot-reload tolerated it. This catches the next one before it ships.
    """
    assert API_FILE.exists(), f"Expected api.ts at {API_FILE}"
    text = API_FILE.read_text()
    names = EXPORT_CONST_RE.findall(text)
    duplicates: dict[str, int] = {}
    for n in names:
        duplicates[n] = duplicates.get(n, 0) + 1
    offenders = {n: c for n, c in duplicates.items() if c > 1}
    assert not offenders, (
        f"Duplicate `export const` identifiers in {API_FILE.relative_to(REPO_ROOT)}: "
        f"{offenders}. This crashes production Metro builds with 'Identifier X has "
        "already been declared.' Pick one declaration, merge methods, delete the other."
    )


# ---------------------------------------------------------------------------
# Guard 2 — Expo Router route collisions in frontend/app/
# ---------------------------------------------------------------------------
def test_no_expo_router_route_collisions():
    """Iter77 created `app/referral.tsx` while `app/referral/index.tsx` already
    existed. Expo Router maps both to `/referral` → unhandled exception during
    route tree construction at app boot → crash on launch.
    
    This walks every directory under `frontend/app/` and asserts that no `.tsx`
    file shares a basename with a sibling directory.
    """
    assert FRONTEND_APP_DIR.is_dir(), f"Expected app dir at {FRONTEND_APP_DIR}"
    collisions: list[tuple[Path, Path]] = []
    for current in [FRONTEND_APP_DIR, *FRONTEND_APP_DIR.rglob("*")]:
        if not current.is_dir():
            continue
        # Skip Expo build/cache directories
        if any(part in {"node_modules", ".expo", "dist", ".metro-cache"} for part in current.parts):
            continue
        children = list(current.iterdir())
        dirs = {p.name: p for p in children if p.is_dir()}
        for p in children:
            if p.is_file() and p.suffix in {".tsx", ".jsx", ".ts", ".js"}:
                stem = p.stem
                # Ignore _layout, +not-found, and similar Expo Router special files
                if stem.startswith("_") or stem.startswith("+"):
                    continue
                if stem in dirs:
                    collisions.append((p, dirs[stem]))
    assert not collisions, (
        "Expo Router route collisions detected — these crash the app on launch:\n"
        + "\n".join(
            f"  • {f.relative_to(REPO_ROOT)}  collides with directory  {d.relative_to(REPO_ROOT)}/"
            for f, d in collisions
        )
        + "\nMerge the file's content into the directory's index.tsx, then delete the loose file."
    )


if __name__ == "__main__":
    # Allow `python test_iteration79_ci_guards.py` for quick local check
    pytest.main([__file__, "-v"])
