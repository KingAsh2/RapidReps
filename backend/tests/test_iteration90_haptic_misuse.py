"""
Iter90 regression guard — prevents `haptic()` being called as a function.

`haptic` from `src/utils/haptics.ts` is an OBJECT exposing
`.light() / .medium() / .heavy() / .success() / .error() / .warning() / .selection()`.

Calling it bare as `haptic()` raises a runtime
`TypeError: Object is not a function` on press handlers (login button +
Find a Trainer + Become a Trainer crashes reported in iter90 prod logs).
"""
from pathlib import Path
import re

APP_DIRS = [Path("/app/frontend/app"), Path("/app/frontend/src")]
EXCLUDE = {"node_modules"}
# `haptic()` as a bare function call — captures `haptic()` but NOT `haptic.light()` etc.
BAD = re.compile(r"\bhaptic\s*\(\s*\)")


def _iter_ts_files():
    for root in APP_DIRS:
        for f in root.rglob("*.tsx"):
            if any(p in EXCLUDE for p in f.parts):
                continue
            yield f
        for f in root.rglob("*.ts"):
            if any(p in EXCLUDE for p in f.parts):
                continue
            yield f


def test_haptic_never_called_as_function():
    """No source file should call `haptic()` directly — must use `haptic.light()` etc."""
    offenders: list[str] = []
    for f in _iter_ts_files():
        text = f.read_text(encoding="utf-8")
        # Skip the haptics module itself (it imports `* as Haptics` from expo-haptics
        # and that uses uppercase `Haptics.x` — our regex is case-sensitive, so safe).
        if f.name == "haptics.ts":
            continue
        for m in BAD.finditer(text):
            line_no = text.count("\n", 0, m.start()) + 1
            offenders.append(f"{f}:{line_no}")
    assert not offenders, (
        "Calling `haptic()` as a bare function is a runtime crash.\n"
        "Replace with `haptic.light()`, `haptic.medium()`, `haptic.selection()`, etc.\n"
        "Offenders:\n  " + "\n  ".join(offenders)
    )
