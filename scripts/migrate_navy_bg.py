#!/usr/bin/env python3
"""iter102r — migrate flat-navy LinearGradient roots to <RapidBg> hero images."""
import os, re, sys

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
NAVY_OPEN_RE = re.compile(
    r"<LinearGradient(\s[^>]*?)\bcolors=\{?\['#0A0E1A',\s*'#141929'\]\}?([^>]*?)>",
    re.DOTALL,
)

def variant_for(path: str) -> str:
    return path.replace("/", "-").replace(".tsx", "")

def relative_import(from_file: str) -> str:
    # Compute path from the file location to /app/frontend/src/components/RapidBg
    # All FILES live under /app/frontend/app/<X>
    rel = os.path.relpath("/app/frontend/src/components/RapidBg",
                          os.path.dirname(os.path.join(ROOT, from_file)))
    return rel.replace("\\", "/")

migrated = 0
skipped = []
for rel in FILES:
    fp = os.path.join(ROOT, rel)
    if not os.path.exists(fp):
        skipped.append((rel, "missing"))
        continue
    src = open(fp).read()

    m = NAVY_OPEN_RE.search(src)
    if not m:
        skipped.append((rel, "no-navy-match"))
        continue

    # Extract preserved attrs (without colors)
    attrs_before, attrs_after = m.group(1), m.group(2)
    preserved_attrs = (attrs_before + " " + attrs_after).strip()
    # Strip out start={...} and end={...} which are LinearGradient-only
    preserved_attrs = re.sub(r"\b(start|end)=\{[^}]*\}", "", preserved_attrs)
    preserved_attrs = re.sub(r"\s+", " ", preserved_attrs).strip()

    variant = variant_for(rel)
    new_open = f'<RapidBg variant="{variant}" {preserved_attrs}>'.replace("  ", " ")
    new_src = src[:m.start()] + new_open + src[m.end():]

    # Replace the LAST </LinearGradient> — assumed to be the root closer
    last_close = new_src.rfind("</LinearGradient>")
    if last_close == -1:
        skipped.append((rel, "no-close-match"))
        continue
    new_src = new_src[:last_close] + "</RapidBg>" + new_src[last_close + len("</LinearGradient>"):]

    # Inject `import RapidBg` if not present
    if "RapidBg" not in src or "from " not in src.split("RapidBg")[0]:
        if "import RapidBg" not in new_src:
            imp_path = relative_import(rel)
            import_line = f"import RapidBg from '{imp_path}';\n"
            # Insert after the last top-level import line
            lines = new_src.split("\n")
            last_import = 0
            for i, ln in enumerate(lines[:60]):
                if ln.startswith("import "):
                    last_import = i
            lines.insert(last_import + 1, import_line.rstrip())
            new_src = "\n".join(lines)

    open(fp, "w").write(new_src)
    migrated += 1
    print(f"  ✓ {rel} → variant={variant}")

print(f"\nMigrated: {migrated}/{len(FILES)}")
if skipped:
    print("Skipped:")
    for rel, why in skipped:
        print(f"  · {rel}  ({why})")
