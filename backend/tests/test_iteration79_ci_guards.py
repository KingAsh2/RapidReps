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


# ---------------------------------------------------------------------------
# Guard 5 — Icon-only TouchableOpacity must have accessibilityLabel (a11y / 508)
# ---------------------------------------------------------------------------
ICON_ONLY_TOUCHABLE_RE = re.compile(
    r"<TouchableOpacity\b([^>]{0,400})>\s*<Ionicons\b[^/>]{0,200}/>\s*</TouchableOpacity>",
)


def test_icon_only_buttons_have_accessibility_label():
    """Buttons that contain ONLY an icon (no text child) are silent to screen readers
    unless explicitly labeled. This was the largest a11y hole in iter80 audit (17 buttons).
    
    Allowed: buttons with `accessibilityLabel="..."`. Text-bearing buttons are exempt
    because RN auto-announces the inner Text.
    """
    offenders: list[tuple[str, int]] = []
    for base in FRONTEND_SRC_DIRS:
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or path.suffix not in {".tsx", ".jsx"}:
                continue
            if any(part in {"node_modules", ".expo", "dist", ".metro-cache", "build"} for part in path.parts):
                continue
            rel = str(path.relative_to(REPO_ROOT))
            try:
                text = path.read_text(errors="ignore")
            except Exception:
                continue
            for m in ICON_ONLY_TOUCHABLE_RE.finditer(text):
                if "accessibilityLabel" in m.group(1):
                    continue
                line = text[: m.start()].count("\n") + 1
                offenders.append((rel, line))
    assert not offenders, (
        f"{len(offenders)} icon-only TouchableOpacity without accessibilityLabel "
        "(silent to screen readers — Section 508 / WCAG 2.1 AA violation):\n"
        + "\n".join(f"  • {f}:{ln}" for f, ln in offenders)
        + "\nAdd accessibilityLabel + accessibilityRole=\"button\" to each."
    )


if __name__ == "__main__":
    # Allow `python test_iteration79_ci_guards.py` for quick local check
    pytest.main([__file__, "-v"])


# ---------------------------------------------------------------------------
# Guard 3 — hardcoded URLs in frontend (the classic "forgot REACT_APP_BACKEND_URL")
# ---------------------------------------------------------------------------
FRONTEND_SRC_DIRS = [
    REPO_ROOT / "frontend" / "src",
    REPO_ROOT / "frontend" / "app",
]
HARDCODED_URL_RE = re.compile(
    r"""(?:["'`])(?:https?://)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?:["'`/])"""
)
# Files where hardcoded references are legitimate (e.g. .env templates, test fixtures, ngrok webhook docs)
HARDCODED_URL_ALLOWLIST = {
    # Add file paths (relative to REPO_ROOT) here if any false-positive is intentional
}


def test_no_hardcoded_localhost_urls_in_frontend():
    """Iter78 inadvertently routed an analytics ping to localhost:8001 in a prior session.
    Catching this class of bug at test time avoids the classic 'works on simulator,
    fails on device' debug spiral. Always go through `process.env.EXPO_PUBLIC_BACKEND_URL`."""
    offenders: list[tuple[str, int, str]] = []
    for base in FRONTEND_SRC_DIRS:
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or path.suffix not in {".tsx", ".jsx", ".ts", ".js"}:
                continue
            if any(part in {"node_modules", ".expo", "dist", ".metro-cache", "build"} for part in path.parts):
                continue
            rel = str(path.relative_to(REPO_ROOT))
            if rel in HARDCODED_URL_ALLOWLIST:
                continue
            try:
                text = path.read_text(errors="ignore")
            except Exception:
                continue
            for lineno, line in enumerate(text.splitlines(), start=1):
                # Comments are fine ("see http://localhost:8001 for local dev")
                stripped = line.lstrip()
                if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*"):
                    continue
                if HARDCODED_URL_RE.search(line):
                    offenders.append((rel, lineno, line.strip()[:120]))
    assert not offenders, (
        "Hardcoded localhost / 127.0.0.1 / 0.0.0.0 URLs found in frontend code "
        "(use `process.env.EXPO_PUBLIC_BACKEND_URL` instead — these break on real devices):\n"
        + "\n".join(f"  • {f}:{ln}  {snippet}" for f, ln, snippet in offenders)
    )


# ---------------------------------------------------------------------------
# Guard 4 — high-signal debug-string console.logs ('TODO', 'DEBUG', 'XXX', 'FIXME')
# ---------------------------------------------------------------------------
# Intentionally narrow: full ban on console.log would false-positive on legitimate
# error-path logging. This only catches obvious leftover-from-debugging patterns.
DEBUG_CONSOLE_RE = re.compile(
    r"""console\.(?:log|debug|info|warn)\s*\(\s*["'`]\s*(?:TODO|DEBUG|XXX|FIXME|TEMP|REMOVE\s+THIS|TEST\s+LOG)""",
    re.IGNORECASE,
)


def test_no_debug_marker_console_logs_in_frontend():
    """Catches `console.log('TODO: ...')`, `console.log('DEBUG ...')`, `console.warn('FIXME')`
    and similar leftovers. Legitimate `console.log('Failed to fetch:', err)` is allowed."""
    offenders: list[tuple[str, int, str]] = []
    for base in FRONTEND_SRC_DIRS:
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or path.suffix not in {".tsx", ".jsx", ".ts", ".js"}:
                continue
            if any(part in {"node_modules", ".expo", "dist", ".metro-cache", "build"} for part in path.parts):
                continue
            rel = str(path.relative_to(REPO_ROOT))
            try:
                text = path.read_text(errors="ignore")
            except Exception:
                continue
            for lineno, line in enumerate(text.splitlines(), start=1):
                if DEBUG_CONSOLE_RE.search(line):
                    offenders.append((rel, lineno, line.strip()[:120]))
    assert not offenders, (
        "Debug-marker console.log statements found in frontend code:\n"
        + "\n".join(f"  • {f}:{ln}  {snippet}" for f, ln, snippet in offenders)
        + "\nThese are leftover debugging noise. Remove them before shipping."
    )
