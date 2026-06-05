#!/usr/bin/env python3
"""
iter102s — Detect screens where the navy LinearGradient is the *actual* root
background (not a header card / button / loading-state).

A file qualifies if:
  - It contains `colors={['#0A0E1A', '#141929']}` AND
  - That LinearGradient is the outermost JSX node returned by the main render
    (i.e., directly inside `return (` or immediately wrapped by a SafeAreaView).
"""
import os, re

FILES = [
    "admin/dashboard.tsx",
    "messages/chat.tsx",
    "messages/index.tsx",
    "trainee/payment.tsx",
    "trainee/session-detail.tsx",
    "trainee/receipt.tsx",
    "trainee/instant-match.tsx",
    "trainee/safety-center.tsx",
    "trainee/trainer-detail.tsx",
    "trainee/(tabs)/sessions.tsx",
    "trainee/(tabs)/messages.tsx",
    "trainee/(tabs)/saved.tsx",
    "trainee/(tabs)/profile.tsx",
    "trainee/trainer-en-route.tsx",
    "auth/signup.classic.tsx",
    "auth/onboarding-trainee.tsx",
    "trainer/set-rates.tsx",
    "trainer/connect-bank.tsx",
    "trainer/session-detail.tsx",
    "trainer/receipt.tsx",
    "trainer/edit-profile.tsx",
    "trainer/verification.tsx",
    "trainer/en-route.tsx",
    "trainer/(tabs)/messages.tsx",
    "trainer/(tabs)/home.tsx",
    "trainer/trainee-detail.tsx",
    "trainer/discover-trainees.tsx",
    "trainer/home.tsx",
    "referral/index.tsx",
]

ROOT = "/app/frontend/app"
NAVY = "colors={['#0A0E1A', '#141929']}"

for rel in FILES:
    fp = os.path.join(ROOT, rel)
    src = open(fp).read()
    if NAVY not in src:
        continue

    # Find each `return (` and capture the next 800 chars to inspect what's at the root
    matches = list(re.finditer(r"return\s*\(", src))
    root_uses_navy = False
    uses_image_bg = False

    for m in matches:
        # Look at the next 600 chars after `return (`
        snippet = src[m.end(): m.end() + 800]
        # Strip leading whitespace/comments
        snippet = re.sub(r"^\s*(\{\s*/\*[^*]*\*/\s*\}\s*)*", "", snippet)
        # Strip an outer SafeAreaView if present
        snippet = re.sub(r"^<SafeAreaView[^>]*>\s*(\{\s*/\*[^*]*\*/\s*\}\s*)*", "", snippet)
        # Strip an outer <View style={s.container}> if present
        snippet = re.sub(r"^<View\s+style=\{[^}]+\}[^>]*>\s*(\{\s*/\*[^*]*\*/\s*\}\s*)*", "", snippet)
        # Strip an outer <> fragment if present
        snippet = re.sub(r"^<>\s*(\{[^}]+\}\s*)*", "", snippet)

        if snippet.startswith("<ImageBackground"):
            uses_image_bg = True
        if re.match(r"<LinearGradient[\s\n][^>]*colors=\{\['#0A0E1A',\s*'#141929'\]", snippet, re.DOTALL):
            root_uses_navy = True

    verdict = (
        "ROOT_NAVY ✅" if root_uses_navy and not uses_image_bg
        else "already-hero (ImageBackground)" if uses_image_bg
        else "inner-only (no root navy)"
    )
    print(f"  {verdict:<35}  {rel}")
