"""
CI Guard: Prevent stray/corrupted filenames in /app/frontend that break EAS uploads.

Background (Iter 81):
    EAS Build's tarball compressor calls lstat() on every file. Files with
    non-UTF-8 or shell-redirect-mangled names (e.g. `=13px`, `=44px`, or
    binary garbage like `\\001\\220\\370@@...`) cause:

        Failed to upload the project tarball to EAS Build
        Reason: ENOENT: no such file or directory, lstat '...'

    These files typically appear from accidental commands like:
        cmd >=13px   (intended `cmd >= 13px` in a Tailwind/CSS context)
        cmd > =44px

    This guard fails fast in CI before any deployment is attempted.
"""
import os
import re

FRONTEND_ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
EXCLUDE_DIRS = {"node_modules", ".expo", ".metro-cache", "dist", "ios", "android",
                ".git", ".cache", "build", "web-build"}
# Allow only printable ASCII (0x20-0x7E) + standard path separators
SAFE_FILENAME = re.compile(r"^[\x20-\x7e]+$")
# Names that start with `=`, `<`, `>` are almost always shell-redirect mistakes
SHELL_REDIRECT_PREFIX = re.compile(r"^[=<>]")


def test_no_garbage_filenames_in_frontend():
    bad = []
    for root, dirs, files in os.walk(FRONTEND_ROOT):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for name in files:
            # Check for non-ASCII / corrupted byte sequences
            try:
                name.encode("ascii")
            except UnicodeEncodeError:
                bad.append(os.path.join(root, repr(name)))
                continue
            # Check for shell-redirect mistakes at file basename
            if SHELL_REDIRECT_PREFIX.match(name):
                bad.append(os.path.join(root, name))

    assert not bad, (
        "Found stray/corrupted filenames that will break EAS Build upload:\n  "
        + "\n  ".join(bad)
        + "\n\nDelete them (likely shell-redirect artifacts) before deploying."
    )
