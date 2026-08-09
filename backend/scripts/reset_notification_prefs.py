"""iter117: Force-enable ALL push notifications for every existing user.

Rationale
─────────
User request: "Ensure push notifications are enabled for everything for both
trainers and trainees."

New users already default to all-True via the `NotificationPreferences` model
in `routes/notification_routes.py`. Existing users who previously toggled a
category OFF will still have that stored. This script sets `pushEnabled=True`
+ every category flag = True across the collection so nothing is muted.

Idempotent — safe to run multiple times.

Usage
─────
    cd /app/backend && python -m scripts.reset_notification_prefs
"""
import asyncio
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


NOTIFICATION_TYPES = [
    'session_requested', 'session_accepted', 'session_declined',
    'session_ended', 'session_reminder', 'rate_reminder',
    'payment_released', 'new_message', 'streak_warning', 'boost_expiring',
    'virtual_request', 'virtual_matched', 'virtual_taken',
    'missed_acceptance', 'late_warning', 'session_started',
]


async def main():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]

    all_on = {k: True for k in ['pushEnabled'] + NOTIFICATION_TYPES}
    all_on['updatedAt'] = datetime.utcnow()

    # 1) Force every EXISTING preference row to all-True.
    result_update = await db.notification_preferences.update_many(
        {},
        {'$set': all_on},
    )

    # 2) For any user who has *no* preference row yet, we don't need to seed
    #    one — the GET/POST endpoints already return all-True defaults when
    #    the row is missing. But we'll seed rows for users with a registered
    #    push token so the send path never even checks defaults.
    seeded = 0
    async for token in db.push_tokens.find({}, {'userId': 1}):
        uid = token.get('userId')
        if not uid:
            continue
        existing = await db.notification_preferences.find_one({'userId': uid})
        if existing:
            continue
        await db.notification_preferences.insert_one({'userId': uid, **all_on})
        seeded += 1

    print(f"✓ Updated existing preference rows: {result_update.modified_count}")
    print(f"✓ Seeded missing rows for users with push tokens: {seeded}")
    print(f"✓ All notifications now ON for both trainers and trainees.")
    client.close()


if __name__ == '__main__':
    asyncio.run(main())
