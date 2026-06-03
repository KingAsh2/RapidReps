"""
Iter91 regression guard — Pydantic v2 422 error crash class.

FastAPI returns validation errors as:
    detail = [{type, loc, msg, input, url}, ...]   # Pydantic v2

Rendering that array directly in a React Native <Text> child crashes:
    "Objects are not valid as a React child
     (found: object with keys {type, loc, msg, input, url})"

The fix is `src/utils/formatApiError.ts` which safely flattens any shape
into a string. This guard enforces:
  1. The helper file exists and exports `formatApiError`.
  2. Every premium auth screen imports + uses it for showAlert messages.
  3. No premium auth screen renders `err?.response?.data?.detail` directly
     in an alert/toast call.
"""
from pathlib import Path
import re

HELPER = Path("/app/frontend/src/utils/formatApiError.ts")
PREMIUM_AUTH = [
    Path("/app/frontend/app/auth/login.premium.tsx"),
    Path("/app/frontend/app/auth/signup.premium.tsx"),
    Path("/app/frontend/app/auth/forgot-password.premium.tsx"),
]

# Match raw `*.detail || 'fallback'` patterns inside a showAlert / toast call.
# We only flag if `formatApiError` is NOT used on the same line.
RAW_DETAIL_PATTERN = re.compile(r"response\??\.data\??\.detail\s*\|\|")


def test_helper_exists_and_exports_function():
    assert HELPER.exists(), f"Missing safety helper {HELPER}"
    src = HELPER.read_text(encoding="utf-8")
    assert "export function formatApiError" in src, (
        "formatApiError must be exported from formatApiError.ts"
    )
    # Must handle the v2 array case explicitly
    assert "Array.isArray" in src, "Helper must handle Pydantic v2 array shape"


def test_premium_auth_screens_use_safe_formatter():
    for path in PREMIUM_AUTH:
        assert path.exists(), f"Missing premium auth screen: {path}"
        src = path.read_text(encoding="utf-8")
        assert "formatApiError" in src, (
            f"{path.name} must import + use formatApiError() to avoid the Pydantic v2 422 crash"
        )


def test_no_raw_detail_render_in_premium_auth():
    offenders: list[str] = []
    for path in PREMIUM_AUTH:
        text = path.read_text(encoding="utf-8")
        for m in RAW_DETAIL_PATTERN.finditer(text):
            # Walk back to the line and check if formatApiError is on it
            line_start = text.rfind("\n", 0, m.start()) + 1
            line_end = text.find("\n", m.end())
            line = text[line_start:line_end if line_end > 0 else len(text)]
            if "formatApiError" not in line:
                line_no = text.count("\n", 0, m.start()) + 1
                offenders.append(f"{path.name}:{line_no} → {line.strip()[:100]}")
    assert not offenders, (
        "Raw `err.response.data.detail` rendering can crash on Pydantic v2 422s.\n"
        "Wrap with formatApiError(err, fallback). Offenders:\n  "
        + "\n  ".join(offenders)
    )
