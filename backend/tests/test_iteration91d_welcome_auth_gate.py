"""
Iter91d regression guard — Premium Welcome screen auth-gate correctness.

Two prior bugs in `index.premium.tsx`:
  1. Read AsyncStorage key `@rapidreps_token` — but AuthContext stores
     the token under `auth_token`. So an already-logged-in user opening
     the app was never redirected.
  2. Redirected to `/auth/login` even when authenticated — should go to
     the role-correct dashboard (admin / trainer / trainee).

Fix: use `useAuth().user` (already hydrated from AsyncStorage in AuthContext)
and route by role.
"""
from pathlib import Path

WELCOME = Path("/app/frontend/app/index.premium.tsx")
AUTH_CONTEXT = Path("/app/frontend/src/contexts/AuthContext.tsx")


def test_welcome_uses_auth_context_not_wrong_storage_key():
    src = WELCOME.read_text(encoding="utf-8")
    assert "@rapidreps_token" not in src, (
        "Premium welcome must not read `@rapidreps_token` — AuthContext stores under `auth_token`. "
        "Use `useAuth().user` for the gate instead."
    )
    assert "useAuth" in src, (
        "Premium welcome should use `useAuth()` from AuthContext to detect "
        "an already-authenticated user."
    )


def test_welcome_auth_gate_routes_by_role():
    src = WELCOME.read_text(encoding="utf-8")
    # Must redirect to all three dashboards by role
    assert "/admin/dashboard" in src, "Admin redirect missing from welcome auth-gate"
    assert "/trainer/" in src, "Trainer redirect missing from welcome auth-gate"
    assert "/trainee/" in src, "Trainee redirect missing from welcome auth-gate"


def test_authcontext_storage_key_is_auth_token():
    """If AuthContext ever renames the storage key, this guard surfaces it."""
    src = AUTH_CONTEXT.read_text(encoding="utf-8")
    assert "'auth_token'" in src or '"auth_token"' in src, (
        "AuthContext is expected to use the storage key `auth_token`. "
        "If this changes, update welcome + login + tests accordingly."
    )
