"""Iter89 — Premium UI redesign rollback safety tests.

These are file-system / static guards that prove:
- Classic backups exist (rollback target preserved)
- Premium screen files exist with the right test IDs
- Each entry switcher reads the EXPO_PUBLIC_UI_VERSION env flag

We can't render React Native here, so these tests focus on the contract.
"""
import os


def _read(p: str) -> str:
    with open(p, 'r', encoding='utf-8') as f:
        return f.read()


# ── Classic backups must exist (rollback safety) ──────────────────────

def test_classic_welcome_backup_exists():
    p = '/app/frontend/app/index.classic.tsx'
    assert os.path.exists(p), "Classic welcome backup missing — rollback broken"
    assert os.path.getsize(p) > 5000, "Classic welcome backup looks truncated"


def test_classic_login_backup_exists():
    p = '/app/frontend/app/auth/login.classic.tsx'
    assert os.path.exists(p), "Classic login backup missing — rollback broken"
    assert os.path.getsize(p) > 5000


def test_classic_signup_backup_exists():
    p = '/app/frontend/app/auth/signup.classic.tsx'
    assert os.path.exists(p), "Classic signup backup missing — rollback broken"
    assert os.path.getsize(p) > 5000


# ── Premium screens have test IDs and use the theme ────────────────────

def test_premium_welcome_has_required_testids():
    src = _read('/app/frontend/app/index.premium.tsx')
    for tid in (
        'premium-welcome-screen', 'premium-find-trainer-btn',
        'premium-become-trainer-btn', 'premium-login-link',
        'premium-feature-near', 'premium-feature-instant', 'premium-feature-verified',
    ):
        assert tid in src, f"Premium welcome missing testID: {tid}"
    assert 'DELIVERED' in src and 'RAPIDLY' in src


def test_premium_login_has_required_testids():
    src = _read('/app/frontend/app/auth/login.premium.tsx')
    for tid in (
        'premium-login-screen', 'premium-login-email', 'premium-login-password',
        'premium-login-btn', 'premium-forgot-password',
    ):
        assert tid in src, f"Premium login missing testID: {tid}"
    assert "LET'S GET" in src and 'TO WORK' in src


def test_premium_signup_has_required_testids():
    src = _read('/app/frontend/app/auth/signup.premium.tsx')
    for tid in (
        'premium-signup-screen', 'premium-signup-name', 'premium-signup-email',
        'premium-signup-phone', 'premium-signup-password', 'premium-signup-submit',
        'premium-signup-role-trainee', 'premium-signup-role-trainer',
    ):
        assert tid in src, f"Premium signup missing testID: {tid}"


# ── Switcher contract — entry files must gate on UI_VERSION ─────────────

def test_welcome_switcher_uses_ui_version():
    src = _read('/app/frontend/app/index.tsx')
    assert 'UI_VERSION' in src
    assert "'./index.premium'" in src or './index.premium' in src
    assert "'./index.classic'" in src or './index.classic' in src
    assert 'classic' in src and 'premium' in src.lower() or 'Premium' in src


def test_login_switcher_uses_ui_version():
    src = _read('/app/frontend/app/auth/login.tsx')
    assert 'UI_VERSION' in src
    assert './login.premium' in src
    assert './login.classic' in src


def test_signup_switcher_uses_ui_version():
    src = _read('/app/frontend/app/auth/signup.tsx')
    assert 'UI_VERSION' in src
    assert './signup.premium' in src
    assert './signup.classic' in src


# ── Env flag is set ─────────────────────────────────────────────────────

def test_env_has_ui_version_flag():
    with open('/app/frontend/.env', 'r', encoding='utf-8') as f:
        env = f.read()
    assert 'EXPO_PUBLIC_UI_VERSION' in env
    # Must be one of the two known values
    line = next(ln for ln in env.splitlines() if ln.startswith('EXPO_PUBLIC_UI_VERSION='))
    val = line.split('=', 1)[1].strip()
    assert val in ('premium', 'classic'), f"Unexpected UI version: {val!r}"


# ── Theme + components exist ────────────────────────────────────────────

def test_premium_theme_exists():
    src = _read('/app/frontend/src/theme/premium.ts')
    for name in ('PremiumColors', 'PremiumGradients', 'PremiumShadow', 'UI_VERSION'):
        assert name in src


def test_premium_background_assets_exist():
    """Iter89 round-3: user-supplied cinematic backgrounds + new chrome RR logo must be on disk."""
    for p in (
        '/app/frontend/assets/images/premium-welcome-bg.png',
        '/app/frontend/assets/images/premium-login-bg.png',
        '/app/frontend/assets/rapidreps-logo-premium.png',
    ):
        assert os.path.exists(p), f"Missing premium asset: {p}"
        assert os.path.getsize(p) > 100_000, f"{p} looks truncated"


def test_premium_screens_use_new_logo():
    """Premium screens must render the chrome logo — either via direct
    require() of the PNG or via the shared `PremiumLogo` component
    (which itself wraps that PNG)."""
    for path in (
        '/app/frontend/app/index.premium.tsx',
        '/app/frontend/app/auth/login.premium.tsx',
        '/app/frontend/app/auth/signup.premium.tsx',
    ):
        with open(path, 'r', encoding='utf-8') as f:
            src = f.read()
        assert ('rapidreps-logo-premium.png' in src) or ('PremiumLogo' in src), (
            f"{path} renders neither the chrome logo PNG nor PremiumLogo"
        )
    # And the PremiumLogo component itself must reference the asset
    with open('/app/frontend/src/components/premium/PremiumLogo.tsx', 'r', encoding='utf-8') as f:
        logo_src = f.read()
    assert 'rapidreps-logo-premium.png' in logo_src, "PremiumLogo component must wrap chrome PNG"


def test_premium_components_exist():
    for p in (
        '/app/frontend/src/components/premium/PremiumHeroBg.tsx',
        '/app/frontend/src/components/premium/PremiumGradientButton.tsx',
        '/app/frontend/src/components/premium/PremiumGlassInput.tsx',
        '/app/frontend/src/components/premium/PremiumFeatureBadge.tsx',
        '/app/frontend/src/components/premium/PremiumLogo.tsx',
    ):
        assert os.path.exists(p), f"Missing premium component: {p}"
        assert os.path.getsize(p) > 200
