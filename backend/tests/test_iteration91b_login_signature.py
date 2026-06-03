"""
Iter91b regression guard — `AuthContext.login()` signature mismatch.

AuthContext exposes:
    login: (email: string, password: string) => Promise<User>

Earlier the premium login passed `{email, password}` as a single object,
which made `email` become the whole object and `password` undefined, so
the backend rejected every login with:

    email: Input should be a valid string
    password: Field required

This guard ensures premium login screens always pass two positional args.
"""
from pathlib import Path
import re

PREMIUM_LOGIN = Path("/app/frontend/app/auth/login.premium.tsx")
AUTH_CONTEXT = Path("/app/frontend/src/contexts/AuthContext.tsx")


def test_authcontext_login_takes_two_positional_args():
    """If this signature ever changes, the premium screens must be updated too."""
    src = AUTH_CONTEXT.read_text(encoding="utf-8")
    assert re.search(
        r"login:\s*\(email:\s*string,\s*password:\s*string\)",
        src,
    ), "AuthContext.login signature is expected to be (email: string, password: string)"


def test_premium_login_does_not_pass_object_to_login():
    """Premium login MUST call `login(email, password)`, NOT `login({email, password})`."""
    src = PREMIUM_LOGIN.read_text(encoding="utf-8")
    # Fail if the broken object-arg pattern ever reappears
    assert "login({" not in src.replace(" ", ""), (
        "Premium login must call AuthContext.login with positional args "
        "(email, password) — never as an object. "
        "An object becomes `email` and password becomes undefined, "
        "which causes the backend to reject the request with 422."
    )
    # Find the line(s) calling `await login(...)` and confirm both
    # `email` and `password` identifiers appear on the same line.
    found_valid_call = False
    for line in src.splitlines():
        if "await login(" in line:
            if "email" in line and "password" in line:
                found_valid_call = True
                break
    assert found_valid_call, (
        "Premium login must call `await login(email, password)` "
        "with both args on the same line."
    )
