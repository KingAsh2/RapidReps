"""
scrub_legacy_avatars.py — iter106au P2

One-shot maintenance script that nulls out legacy placeholder avatar URLs
(example.com / /some-photo.png / picsum / placeholder / undefined) across the
three collections that carry them, so the new UserAvatar gradient fallback
renders instead of a broken image.

Idempotent — safe to re-run. Prints a summary of rows changed per collection.

Run:
    cd /app/backend && python -m scripts.scrub_legacy_avatars
"""
from __future__ import annotations

import asyncio
import os
import re
import sys
from typing import Iterable

# Allow "python -m scripts.scrub_legacy_avatars" from /app/backend.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from deps import db  # noqa: E402


# Patterns that indicate the URL is a legacy placeholder, not a real photo.
LEGACY_PATTERNS = [
    r'example\.com',
    r'/some-photo\.png',
    r'/some-photo\.jpg',
    r'placeholder',
    r'picsum',
    r'/avatar-default',
    r'^undefined$',
    r'^null$',
]
LEGACY_RE = re.compile('|'.join(LEGACY_PATTERNS), re.IGNORECASE)


async def _scrub_collection(coll_name: str, fields: Iterable[str]) -> dict:
    """
    For a given collection + list of avatar-carrying fields, set any legacy
    URL to None. Returns a per-field summary of matched/updated counts.
    """
    coll = db[coll_name]
    summary: dict = {}
    for f in fields:
        # Build the regex query — must match the specific field.
        query = {f: {'$regex': LEGACY_RE.pattern, '$options': 'i'}}
        matched = await coll.count_documents(query)
        if matched == 0:
            summary[f] = {'matched': 0, 'updated': 0}
            continue
        result = await coll.update_many(query, {'$set': {f: None}})
        summary[f] = {'matched': matched, 'updated': result.modified_count}
    return summary


async def main() -> int:
    print("🧹 Scrubbing legacy avatar URLs...\n")
    total_updated = 0

    plans = [
        ('users', ['profilePhoto', 'profilePhotoUrl', 'avatarUrl', 'photoUrl']),
        ('trainer_profiles', ['avatarUrl', 'profilePhoto', 'profilePhotoUrl']),
        ('trainee_profiles', ['avatarUrl', 'profilePhoto', 'profilePhotoUrl']),
    ]

    for coll_name, fields in plans:
        summary = await _scrub_collection(coll_name, fields)
        for f, stats in summary.items():
            if stats['matched'] > 0:
                print(f"  {coll_name}.{f}: matched={stats['matched']}, updated={stats['updated']}")
                total_updated += stats['updated']
        if all(v['matched'] == 0 for v in summary.values()):
            print(f"  {coll_name}: clean ✅")

    print(f"\n✅ Done. Total rows updated: {total_updated}")
    return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
