"""
migrate_zelle_to_connect.py — iter118q one-shot cutover script.

Immediate-cutover policy (per user decision):
  1. Void every pending / open Zelle payout row so the old batch job never
     picks them up again (audit history is PRESERVED — we set status=voided,
     never delete).
  2. Clear the Zelle handle fields on trainer_profiles so the old
     connect-bank screen never surfaces stale info.
  3. Flag every trainer as `needsStripeConnectOnboarding=true` so their next
     Earnings tab load shows the "Set up payouts" CTA.
  4. Idempotent — safe to rerun. Prints a summary at the end.

Usage:
    cd /app/backend && python -m scripts.migrate_zelle_to_connect
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import datetime

# Make backend/ importable when run as `python -m scripts.migrate_zelle_to_connect`
_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.dirname(_HERE)
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
log = logging.getLogger('migrate-zelle-connect')


async def main() -> None:
    from deps import db

    now = datetime.utcnow()

    # 1) Void pending Zelle payout rows.
    void_res = await db.payout_requests.update_many(
        {'status': {'$in': ['pending', 'approved']}},
        {'$set': {
            'status': 'voided',
            'voidReason': 'stripe_connect_cutover',
            'voidedAt': now,
        }},
    )
    log.info("payout_requests voided: %d", void_res.modified_count)

    # 2) Clear Zelle handle fields on trainer_profiles.
    zelle_clear = await db.trainer_profiles.update_many(
        {'$or': [
            {'zelleHandle': {'$exists': True, '$ne': None}},
            {'payoutMethod': 'zelle'},
        ]},
        {'$unset': {
            'zelleHandle': '',
            'zelleName': '',
            'zelleEmail': '',
            'zellePhone': '',
        }, '$set': {
            'payoutMethod': 'stripe_connect',
            'zelleCutoverAt': now,
        }},
    )
    log.info("trainer_profiles Zelle fields cleared: %d", zelle_clear.modified_count)

    # 3) Flag every trainer as needing onboarding (only if they haven't yet
    #    completed Stripe Connect onboarding — payoutsEnabled=true).
    flag_res = await db.trainer_profiles.update_many(
        {'payoutsEnabled': {'$ne': True}},
        {'$set': {
            'needsStripeConnectOnboarding': True,
            'connectStatus': 'not_connected',
        }},
    )
    log.info("trainer_profiles flagged for onboarding: %d", flag_res.modified_count)

    # 4) Ensure the audit indexes exist.
    try:
        await db.trainer_payouts.create_index([('stripePayoutId', 1)], unique=True, sparse=True)
        await db.trainer_payouts.create_index([('stripeConnectAccountId', 1), ('paidAt', -1)])
    except Exception as e:  # pragma: no cover
        log.warning("index create warning: %s", e)

    print()
    print("=" * 60)
    print("Zelle → Stripe Connect cutover complete.")
    print(f"  Voided payout_requests rows:  {void_res.modified_count}")
    print(f"  Cleared Zelle handles:         {zelle_clear.modified_count}")
    print(f"  Trainers flagged to onboard:   {flag_res.modified_count}")
    print("=" * 60)


if __name__ == '__main__':
    asyncio.run(main())
