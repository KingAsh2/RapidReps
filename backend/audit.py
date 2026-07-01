"""
audit.py — single helper for writing edge-case automated-action records.

Every automated transition (no-show flip, auto-decline, orphan refund, etc.)
calls `log_edge_case_action(...)` which inserts into `db.edge_case_audit`.
The collection is the source of truth for the deployment report, admin
inspection, and post-incident forensics.

Schema:
  - timestamp: datetime
  - action: str (e.g. 'auto_no_show_trainer', 'auto_decline_request', ...)
  - sessionId: Optional[str]
  - trainerId: Optional[str]
  - traineeId: Optional[str]
  - reason: str
  - source: 'scheduler' | 'webhook' | 'manual'
  - details: dict (free-form context: amount refunded, strikes count, etc.)
  - idempotency_key: Optional[str] — when set, duplicate writes are no-ops
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from pymongo.errors import DuplicateKeyError

from deps import db

logger = logging.getLogger(__name__)


async def log_edge_case_action(
    action: str,
    *,
    session_id: Optional[str] = None,
    trainer_id: Optional[str] = None,
    trainee_id: Optional[str] = None,
    reason: str = "",
    source: str = "scheduler",
    details: Optional[dict] = None,
    idempotency_key: Optional[str] = None,
) -> bool:
    """
    Insert one audit row. Returns True if a new row was written, False if a
    duplicate (matched on `idempotency_key`) was skipped.

    Concurrency safety: we rely on the unique-sparse index on `idempotencyKey`
    created by ensure_audit_indexes(). The `find_one` check below is a fast
    path to avoid the exception, but the unique index is the actual safety
    net — a `DuplicateKeyError` from a racing writer is caught and treated as
    a successful no-op.
    """
    doc = {
        "timestamp": datetime.utcnow(),
        "action": action,
        "sessionId": session_id,
        "trainerId": trainer_id,
        "traineeId": trainee_id,
        "reason": reason,
        "source": source,
        "details": details or {},
        "idempotencyKey": idempotency_key,
    }

    if idempotency_key:
        # Fast path — most duplicates are caught here without an exception.
        existing = await db.edge_case_audit.find_one({"idempotencyKey": idempotency_key})
        if existing:
            return False

    try:
        await db.edge_case_audit.insert_one(doc)
    except DuplicateKeyError:
        # Rare race between the fast-path find_one and this insert — another
        # writer got there first. The unique index enforces the invariant.
        return False
    logger.info(
        "EDGE_CASE_ACTION action=%s session=%s trainer=%s trainee=%s reason=%s source=%s",
        action, session_id, trainer_id, trainee_id, reason, source,
    )
    return True


async def ensure_audit_indexes() -> None:
    """Create indexes on the audit collection — called once at startup."""
    await db.edge_case_audit.create_index([("timestamp", -1)])
    await db.edge_case_audit.create_index([("action", 1), ("timestamp", -1)])
    await db.edge_case_audit.create_index([("sessionId", 1)])
    await db.edge_case_audit.create_index([("trainerId", 1)])
    # idempotencyKey: sparse unique so we get safety + can leave it null for non-idempotent rows
    await db.edge_case_audit.create_index(
        [("idempotencyKey", 1)], unique=True, sparse=True
    )

    # Processed Stripe webhook events — separate collection, unique on event id
    await db.processed_webhook_events.create_index(
        [("eventId", 1)], unique=True
    )
    await db.processed_webhook_events.create_index([("processedAt", -1)])
