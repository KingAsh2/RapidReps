"""
Iter91c regression guard — Premium login MUST redirect after success.

`AuthContext.login()` only sets state — it does NOT navigate. The premium
login screen previously called `await login(...)` and then nothing, so a
successful login left the user stranded on the login screen.

This guard locks in that:
  1. `handleLogin` in `login.premium.tsx` calls `router.replace(...)`
  2. Both admin and trainer + trainee redirect targets are present.
"""
from pathlib import Path

LOGIN = Path("/app/frontend/app/auth/login.premium.tsx")


def test_premium_login_redirects_after_success():
    src = LOGIN.read_text(encoding="utf-8")
    assert "router.replace(" in src, (
        "Premium login must call router.replace(...) after a successful login. "
        "AuthContext.login() sets state but does NOT navigate; "
        "without an explicit redirect, the user is stranded on the login screen."
    )
    # Confirm role-based routes are present
    assert "/admin/dashboard" in src, "Admin route missing from premium login redirect"
    assert "/trainer/" in src, "Trainer route missing from premium login redirect"
    assert "/trainee/" in src, "Trainee route missing from premium login redirect"
