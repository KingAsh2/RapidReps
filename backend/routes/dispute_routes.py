"""
Refund / Dispute routes for RapidReps.

Flow:
  1. Trainee or Trainer opens a dispute on a completed/paid session.
  2. Admin reviews queued disputes and acts: full refund, partial refund, deny,
     or request more info from the opener.
  3. Stripe refunds are issued via stripe.Refund.create() against the session's
     payment_intent.
  4. If the trainer has already been marked paid, their earnings record is
     flagged 'reversed' so the admin manual-payout report shows the clawback.
  5. All parties (opener, counterparty, admins) get push + in-app notifications
     on each state change.

Schema (collection: `disputes`):
  _id                ObjectId
  sessionId          str
  openedBy           str    (userId)
  openedByRole       str    (trainee|trainer)
  reason             str    (short label)
  description        str    (free text, sanitized)
  status             str    (open | info_requested | approved_full |
                              approved_partial | denied | resolved)
  refundAmountCents  int    (only set on approved_full / approved_partial)
  stripeRefundId     str    (set after Stripe refund succeeds)
  adminNotes         str
  adminInfoRequest   str    (the question admin asked when info_requested)
  openerResponse     str    (opener's reply to info_requested)
  resolvedBy         str    (admin userId)
  createdAt          datetime
  updatedAt          datetime
"""
from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import logging
import os
import stripe

from deps import (
    db, get_current_user, require_admin, serialize_doc, sanitize_text,
    create_and_send_notification,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["disputes"])

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')


# ---------- Pydantic ----------
class DisputeCreate(BaseModel):
    reason: str = Field(..., min_length=1, max_length=80)
    description: str = Field(..., min_length=1, max_length=2000)


class PartialRefundBody(BaseModel):
    amountCents: int = Field(..., gt=0)
    adminNotes: Optional[str] = Field(None, max_length=2000)


class DenyBody(BaseModel):
    adminNotes: Optional[str] = Field(None, max_length=2000)


class FullRefundBody(BaseModel):
    adminNotes: Optional[str] = Field(None, max_length=2000)


class RequestInfoBody(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)


class RespondBody(BaseModel):
    response: str = Field(..., min_length=1, max_length=2000)


# ---------- Helpers ----------
def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _load_session(session_id: str) -> dict:
    try:
        s = await db.sessions.find_one({"_id": ObjectId(session_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session id")
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s


async def _notify(user_id: str, title: str, body: str, dispute_id: str, session_id: str) -> None:
    try:
        await create_and_send_notification(
            user_id=str(user_id),
            title=title,
            body=body,
            notif_type="dispute",
            data={
                "type": "dispute",
                "disputeId": dispute_id,
                "sessionId": session_id,
                "deepLink": f"/dispute/{dispute_id}",
            },
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("dispute notification failed user=%s err=%s", user_id, exc)


async def _notify_admins(title: str, body: str, dispute_id: str, session_id: str) -> None:
    admins = db.users.find({"isAdmin": True}, {"_id": 1})
    async for adm in admins:
        await _notify(str(adm["_id"]), title, body, dispute_id, session_id)


def _counterparty(session: dict, opener_id: str) -> Optional[str]:
    trainee = str(session.get("traineeId", ""))
    trainer = str(session.get("trainerId", ""))
    if opener_id == trainee:
        return trainer or None
    if opener_id == trainer:
        return trainee or None
    return None


# ---------- User endpoints ----------
@router.post("/sessions/{session_id}/disputes")
async def open_dispute(
    session_id: str,
    body: DisputeCreate,
    current_user: dict = Depends(get_current_user),
):
    """Trainee or trainer opens a dispute on a session."""
    session = await _load_session(session_id)
    uid = str(current_user["_id"])

    is_trainee = uid == str(session.get("traineeId"))
    is_trainer = uid == str(session.get("trainerId"))
    if not (is_trainee or is_trainer):
        raise HTTPException(status_code=403, detail="Not a participant in this session.")

    if session.get("paymentStatus") != "paid":
        raise HTTPException(status_code=400, detail="Disputes can only be opened on paid sessions.")

    # Prevent duplicate open disputes from the same user
    existing = await db.disputes.find_one({
        "sessionId": session_id,
        "openedBy": uid,
        "status": {"$in": ["open", "info_requested"]},
    })
    if existing:
        raise HTTPException(status_code=409, detail="You already have an open dispute on this session.")

    doc = {
        "sessionId": session_id,
        "openedBy": uid,
        "openedByRole": "trainee" if is_trainee else "trainer",
        "reason": sanitize_text(body.reason),
        "description": sanitize_text(body.description),
        "status": "open",
        "refundAmountCents": None,
        "stripeRefundId": None,
        "adminNotes": "",
        "adminInfoRequest": "",
        "openerResponse": "",
        "resolvedBy": None,
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    result = await db.disputes.insert_one(doc)
    dispute_id = str(result.inserted_id)

    # Notify counterparty + admins
    cp = _counterparty(session, uid)
    if cp:
        await _notify(cp, "Dispute opened",
                      "The other party opened a dispute on your session.",
                      dispute_id, session_id)
    await _notify_admins("New dispute",
                         f"{doc['openedByRole'].title()} opened: {doc['reason']}",
                         dispute_id, session_id)

    return {"disputeId": dispute_id, "status": "open"}


@router.get("/disputes/{dispute_id}")
async def get_dispute(dispute_id: str, current_user: dict = Depends(get_current_user)):
    try:
        d = await db.disputes.find_one({"_id": ObjectId(dispute_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid dispute id")
    if not d:
        raise HTTPException(status_code=404, detail="Dispute not found")

    session = await _load_session(d["sessionId"])
    uid = str(current_user["_id"])
    is_participant = uid in (str(session.get("traineeId", "")), str(session.get("trainerId", "")))
    is_admin = bool(current_user.get("isAdmin"))
    if not (is_participant or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized.")

    return serialize_doc(d)


@router.get("/disputes")
async def list_my_disputes(current_user: dict = Depends(get_current_user)) -> List[dict]:
    """Disputes I opened OR disputes opened on sessions I'm part of."""
    uid = str(current_user["_id"])
    # Sessions I'm a participant in
    my_sessions = db.sessions.find(
        {"$or": [{"traineeId": uid}, {"trainerId": uid}]},
        {"_id": 1},
    )
    session_ids = [str(s["_id"]) async for s in my_sessions]
    cursor = db.disputes.find({"sessionId": {"$in": session_ids}}).sort("createdAt", -1)
    return [serialize_doc(d) async for d in cursor]


@router.post("/disputes/{dispute_id}/respond")
async def respond_to_info_request(
    dispute_id: str,
    body: RespondBody,
    current_user: dict = Depends(get_current_user),
):
    """Opener responds when admin has asked for more info."""
    try:
        d = await db.disputes.find_one({"_id": ObjectId(dispute_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid dispute id")
    if not d:
        raise HTTPException(status_code=404, detail="Dispute not found")

    if str(current_user["_id"]) != d["openedBy"]:
        raise HTTPException(status_code=403, detail="Only the opener can respond.")
    if d["status"] != "info_requested":
        raise HTTPException(status_code=400, detail="No info has been requested on this dispute.")

    await db.disputes.update_one(
        {"_id": d["_id"]},
        {"$set": {
            "openerResponse": sanitize_text(body.response),
            "status": "open",
            "updatedAt": _now(),
        }},
    )
    await _notify_admins("Dispute updated",
                         "Opener responded to your info request.",
                         dispute_id, d["sessionId"])
    return {"status": "open"}


# ---------- Admin endpoints ----------
@router.get("/admin/disputes")
async def admin_list_disputes(
    status: Optional[str] = None,
    limit: int = 100,
    admin_user: dict = Depends(require_admin),
) -> List[dict]:
    q: dict = {}
    if status:
        q["status"] = status
    cursor = db.disputes.find(q).sort("createdAt", -1).limit(min(max(limit, 1), 500))
    out: List[dict] = []
    async for d in cursor:
        item = serialize_doc(d)
        # Attach light session snapshot for the admin UI list
        try:
            sess = await db.sessions.find_one(
                {"_id": ObjectId(d["sessionId"])},
                {"price": 1, "paymentStatus": 1, "paymentIntentId": 1, "status": 1,
                 "traineeId": 1, "trainerId": 1, "scheduledAt": 1},
            )
            if sess:
                item["session"] = serialize_doc(sess)
        except Exception:
            pass
        out.append(item)
    return out


async def _issue_stripe_refund(session: dict, amount_cents: Optional[int]) -> Optional[str]:
    """Return the Stripe refund id, or None when no payment_intent on file."""
    pi = session.get("paymentIntentId")
    if not pi or str(pi).startswith("corp_full_subsidy_"):
        # Corporate-subsidized or otherwise off-Stripe — no refund to issue.
        return None
    kwargs: dict = {"payment_intent": pi}
    if amount_cents is not None:
        kwargs["amount"] = int(amount_cents)
    try:
        refund = stripe.Refund.create(**kwargs)
        return refund.id
    except stripe.error.StripeError as exc:
        logger.error("stripe refund failed pi=%s err=%s", pi, exc)
        raise HTTPException(status_code=502, detail=f"Stripe refund failed: {exc.user_message or str(exc)}")


async def _reverse_trainer_earnings(session_id: str, admin_id: str) -> None:
    """Flag any paid trainer earnings record for this session as reversed."""
    await db.trainer_earnings.update_many(
        {"sessionId": session_id},
        {"$set": {
            "payoutStatus": "reversed",
            "reversedAt": _now(),
            "reversedBy": admin_id,
        }},
    )


async def _resolve(dispute: dict, status: str, *, refund_amount: Optional[int],
                   refund_id: Optional[str], admin_notes: str, admin_id: str) -> None:
    await db.disputes.update_one(
        {"_id": dispute["_id"]},
        {"$set": {
            "status": status,
            "refundAmountCents": refund_amount,
            "stripeRefundId": refund_id,
            "adminNotes": sanitize_text(admin_notes or ""),
            "resolvedBy": admin_id,
            "updatedAt": _now(),
        }},
    )


@router.post("/admin/disputes/{dispute_id}/refund-full")
async def admin_refund_full(
    dispute_id: str,
    body: FullRefundBody = Body(default_factory=FullRefundBody),
    admin_user: dict = Depends(require_admin),
):
    d = await db.disputes.find_one({"_id": ObjectId(dispute_id)})
    if not d:
        raise HTTPException(status_code=404, detail="Dispute not found")
    if d["status"] in ("approved_full", "approved_partial", "denied"):
        raise HTTPException(status_code=400, detail="Dispute already resolved.")

    session = await _load_session(d["sessionId"])
    refund_id = await _issue_stripe_refund(session, amount_cents=None)
    refund_amount = int(session.get("price", 0) * 100) if session.get("price") else None

    await _reverse_trainer_earnings(d["sessionId"], str(admin_user["_id"]))
    await db.sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"paymentStatus": "refunded", "refundedAt": _now()}},
    )
    await _resolve(d, "approved_full",
                   refund_amount=refund_amount,
                   refund_id=refund_id,
                   admin_notes=body.adminNotes or "",
                   admin_id=str(admin_user["_id"]))

    # Notify all parties
    cp = _counterparty(session, d["openedBy"])
    await _notify(d["openedBy"], "Full refund issued",
                  "Your dispute was approved and a full refund was issued.",
                  dispute_id, d["sessionId"])
    if cp:
        await _notify(cp, "Session refunded",
                      "An admin issued a full refund on this session.",
                      dispute_id, d["sessionId"])
    return {"status": "approved_full", "stripeRefundId": refund_id, "refundAmountCents": refund_amount}


@router.post("/admin/disputes/{dispute_id}/refund-partial")
async def admin_refund_partial(
    dispute_id: str,
    body: PartialRefundBody,
    admin_user: dict = Depends(require_admin),
):
    d = await db.disputes.find_one({"_id": ObjectId(dispute_id)})
    if not d:
        raise HTTPException(status_code=404, detail="Dispute not found")
    if d["status"] in ("approved_full", "approved_partial", "denied"):
        raise HTTPException(status_code=400, detail="Dispute already resolved.")

    session = await _load_session(d["sessionId"])
    session_cents = int((session.get("price") or 0) * 100)
    if session_cents and body.amountCents > session_cents:
        raise HTTPException(status_code=400,
                            detail=f"Partial refund exceeds session price ({session_cents}¢).")

    refund_id = await _issue_stripe_refund(session, amount_cents=body.amountCents)
    await _reverse_trainer_earnings(d["sessionId"], str(admin_user["_id"]))
    await db.sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"paymentStatus": "partially_refunded", "refundedAt": _now()}},
    )
    await _resolve(d, "approved_partial",
                   refund_amount=body.amountCents,
                   refund_id=refund_id,
                   admin_notes=body.adminNotes or "",
                   admin_id=str(admin_user["_id"]))

    cp = _counterparty(session, d["openedBy"])
    pretty = f"${body.amountCents/100:.2f}"
    await _notify(d["openedBy"], "Partial refund issued",
                  f"Your dispute was resolved with a {pretty} refund.",
                  dispute_id, d["sessionId"])
    if cp:
        await _notify(cp, "Session partially refunded",
                      f"An admin issued a {pretty} refund on this session.",
                      dispute_id, d["sessionId"])
    return {"status": "approved_partial", "stripeRefundId": refund_id, "refundAmountCents": body.amountCents}


@router.post("/admin/disputes/{dispute_id}/deny")
async def admin_deny(
    dispute_id: str,
    body: DenyBody = Body(default_factory=DenyBody),
    admin_user: dict = Depends(require_admin),
):
    d = await db.disputes.find_one({"_id": ObjectId(dispute_id)})
    if not d:
        raise HTTPException(status_code=404, detail="Dispute not found")
    if d["status"] in ("approved_full", "approved_partial", "denied"):
        raise HTTPException(status_code=400, detail="Dispute already resolved.")

    await _resolve(d, "denied",
                   refund_amount=None,
                   refund_id=None,
                   admin_notes=body.adminNotes or "",
                   admin_id=str(admin_user["_id"]))
    await _notify(d["openedBy"], "Dispute denied",
                  "After review, your dispute was denied. Tap to see admin notes.",
                  dispute_id, d["sessionId"])
    return {"status": "denied"}


@router.post("/admin/disputes/{dispute_id}/request-info")
async def admin_request_info(
    dispute_id: str,
    body: RequestInfoBody,
    admin_user: dict = Depends(require_admin),
):
    d = await db.disputes.find_one({"_id": ObjectId(dispute_id)})
    if not d:
        raise HTTPException(status_code=404, detail="Dispute not found")
    if d["status"] in ("approved_full", "approved_partial", "denied"):
        raise HTTPException(status_code=400, detail="Dispute already resolved.")

    await db.disputes.update_one(
        {"_id": d["_id"]},
        {"$set": {
            "status": "info_requested",
            "adminInfoRequest": sanitize_text(body.question),
            "updatedAt": _now(),
        }},
    )
    await _notify(d["openedBy"], "More info needed",
                  "Admin requested more info on your dispute.",
                  dispute_id, d["sessionId"])
    return {"status": "info_requested"}
