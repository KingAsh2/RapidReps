"""
RapidReps Corporate Wellness (iter96).

B2B onboarding for employers who want to subsidize personal training for their
employees. Three pillars:

  1. Company signup + admin dashboard
  2. Credit pool (employer pre-funds session credits per employee)
  3. Branded landing page (public, per-employer)

Endpoints (all under /api/corporate):
    POST   companies                                 (admin or self-serve)
    GET    companies                                 (admin only)
    GET    companies/{id}                            (admin or company admin)
    PATCH  companies/{id}                            (company admin)
    POST   companies/{id}/credit-pool                (company admin — top up)
    POST   companies/{id}/invites                    (company admin)
    GET    companies/{id}/invites                    (company admin)
    GET    companies/{id}/employees                  (company admin)
    GET    companies/{id}/usage                      (company admin)
    POST   redeem                                    (trainee redeems code)
    GET    me/company                                (current user's affiliation)
    GET    landing/{slug}                            (public branded landing)
"""
from __future__ import annotations

import os
import re
import secrets
import string
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator

from deps import db, get_current_user, require_admin

router = APIRouter(prefix="/corporate", tags=["corporate"])


# ── Constants ─────────────────────────────────────────────────────────
DEFAULT_EMPLOYEE_ALLOWANCE_CENTS = 20000  # $200 default per employee
INVITE_CODE_LENGTH = 8
INVITE_DEFAULT_EXPIRY_DAYS = 30
SLUG_PATTERN = re.compile(r"^[a-z0-9-]{3,40}$")


# ── Models ────────────────────────────────────────────────────────────
class CompanyCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    slug: str = Field(..., min_length=3, max_length=40)
    contactEmail: EmailStr
    brandColor: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    logoUrl: Optional[str] = Field(None, max_length=500)
    brandTagline: Optional[str] = Field(None, max_length=200)

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        v = v.lower().strip()
        if not SLUG_PATTERN.match(v):
            raise ValueError("slug must be 3-40 chars, lowercase a-z, 0-9, -")
        return v


class CompanyUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    contactEmail: Optional[EmailStr] = None
    brandColor: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    logoUrl: Optional[str] = Field(None, max_length=500)
    brandTagline: Optional[str] = Field(None, max_length=200)


class CreditPoolTopUpRequest(BaseModel):
    amountCents: int = Field(..., gt=0, le=10_000_000)  # max $100k per top-up
    note: Optional[str] = Field(None, max_length=200)


class InviteCreateRequest(BaseModel):
    maxUses: int = Field(1, ge=1, le=500)
    creditAllowanceCents: int = Field(DEFAULT_EMPLOYEE_ALLOWANCE_CENTS, ge=0, le=1_000_000)
    expiresInDays: int = Field(INVITE_DEFAULT_EXPIRY_DAYS, ge=1, le=365)


class RedeemRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=32)


# ── Helpers ───────────────────────────────────────────────────────────
def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_oid(value: str, label: str = "id") -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")


def _gen_invite_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(INVITE_CODE_LENGTH))


def _serialize_company(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "slug": doc.get("slug", ""),
        "contactEmail": doc.get("contactEmail", ""),
        "logoUrl": doc.get("logoUrl"),
        "brandColor": doc.get("brandColor"),
        "brandTagline": doc.get("brandTagline"),
        "adminUserIds": doc.get("adminUserIds", []),
        "creditPoolCents": int(doc.get("creditPoolCents", 0)),
        "totalSpentCents": int(doc.get("totalSpentCents", 0)),
        "employeeCount": int(doc.get("employeeCount", 0)),
        "isActive": bool(doc.get("isActive", True)),
        "createdAt": doc.get("createdAt").isoformat() if doc.get("createdAt") else None,
    }


def _serialize_invite(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "companyId": doc.get("companyId", ""),
        "code": doc.get("code", ""),
        "maxUses": int(doc.get("maxUses", 1)),
        "usedCount": int(doc.get("usedCount", 0)),
        "creditAllowanceCents": int(doc.get("creditAllowanceCents", 0)),
        "expiresAt": doc.get("expiresAt").isoformat() if doc.get("expiresAt") else None,
        "createdAt": doc.get("createdAt").isoformat() if doc.get("createdAt") else None,
    }


def _serialize_membership(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "companyId": doc.get("companyId", ""),
        "userId": doc.get("userId", ""),
        "role": doc.get("role", "employee"),
        "creditAllowanceCents": int(doc.get("creditAllowanceCents", 0)),
        "creditUsedCents": int(doc.get("creditUsedCents", 0)),
        "joinedAt": doc.get("joinedAt").isoformat() if doc.get("joinedAt") else None,
    }


async def _load_company(company_id: str, current_user: dict, require_company_admin: bool = True) -> dict:
    """Load company and verify caller is a company admin (or platform admin)."""
    oid = _ensure_oid(company_id, "company id")
    company = await db.corporate_companies.find_one({"_id": oid})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")

    if require_company_admin:
        user_id = str(current_user["_id"])
        is_platform_admin = current_user.get("isAdmin", False)
        is_company_admin = user_id in company.get("adminUserIds", [])
        if not (is_platform_admin or is_company_admin):
            raise HTTPException(status_code=403, detail="Not authorized for this company.")
    return company


# ══════════════════════════════════════════════════════════════════════
#  Company CRUD
# ══════════════════════════════════════════════════════════════════════
@router.post("/companies", status_code=201)
async def create_company(
    payload: CompanyCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Create a new corporate account. The creator automatically becomes a
    company admin. Slug must be globally unique.
    """
    existing = await db.corporate_companies.find_one({"slug": payload.slug})
    if existing:
        raise HTTPException(status_code=409, detail="Slug already taken.")

    doc = {
        "name": payload.name,
        "slug": payload.slug,
        "contactEmail": payload.contactEmail,
        "logoUrl": payload.logoUrl,
        "brandColor": payload.brandColor or "#FF7A00",
        "brandTagline": payload.brandTagline,
        "adminUserIds": [str(current_user["_id"])],
        "creditPoolCents": 0,
        "totalSpentCents": 0,
        "employeeCount": 0,
        "isActive": True,
        "createdAt": _utcnow(),
        "updatedAt": _utcnow(),
    }
    result = await db.corporate_companies.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_company(doc)


@router.get("/companies")
async def list_companies(current_user: dict = Depends(require_admin)):
    """Platform admin only — list all companies."""
    cursor = db.corporate_companies.find({}).sort("createdAt", -1)
    return [_serialize_company(c) async for c in cursor]


@router.get("/companies/{company_id}")
async def get_company(
    company_id: str,
    current_user: dict = Depends(get_current_user),
):
    company = await _load_company(company_id, current_user, require_company_admin=True)
    return _serialize_company(company)


@router.patch("/companies/{company_id}")
async def update_company(
    company_id: str,
    payload: CompanyUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    company = await _load_company(company_id, current_user, require_company_admin=True)
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        return _serialize_company(company)
    updates["updatedAt"] = _utcnow()
    await db.corporate_companies.update_one({"_id": company["_id"]}, {"$set": updates})
    company = await db.corporate_companies.find_one({"_id": company["_id"]})
    return _serialize_company(company)


# ══════════════════════════════════════════════════════════════════════
#  Credit Pool
# ══════════════════════════════════════════════════════════════════════
@router.post("/companies/{company_id}/credit-pool")
async def topup_credit_pool(
    company_id: str,
    payload: CreditPoolTopUpRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Add funds to the company credit pool. In production this would be tied to a
    Stripe Charge; here we record the intent and update the pool.
    """
    company = await _load_company(company_id, current_user, require_company_admin=True)

    await db.corporate_credit_ledger.insert_one({
        "companyId": str(company["_id"]),
        "amountCents": payload.amountCents,
        "direction": "credit",
        "note": payload.note or "Top-up",
        "actorUserId": str(current_user["_id"]),
        "createdAt": _utcnow(),
    })

    await db.corporate_companies.update_one(
        {"_id": company["_id"]},
        {"$inc": {"creditPoolCents": payload.amountCents}, "$set": {"updatedAt": _utcnow()}},
    )

    refreshed = await db.corporate_companies.find_one({"_id": company["_id"]})
    return _serialize_company(refreshed)


# ══════════════════════════════════════════════════════════════════════
#  Invites
# ══════════════════════════════════════════════════════════════════════
@router.post("/companies/{company_id}/invites", status_code=201)
async def create_invite(
    company_id: str,
    payload: InviteCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    company = await _load_company(company_id, current_user, require_company_admin=True)

    # Generate a unique code (retry on collision — extremely rare)
    for _ in range(5):
        code = _gen_invite_code()
        clash = await db.corporate_invites.find_one({"code": code})
        if not clash:
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate invite code.")

    doc = {
        "companyId": str(company["_id"]),
        "code": code,
        "maxUses": payload.maxUses,
        "usedCount": 0,
        "creditAllowanceCents": payload.creditAllowanceCents,
        "expiresAt": _utcnow() + timedelta(days=payload.expiresInDays),
        "createdBy": str(current_user["_id"]),
        "createdAt": _utcnow(),
    }
    result = await db.corporate_invites.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_invite(doc)


@router.get("/companies/{company_id}/invites")
async def list_invites(
    company_id: str,
    current_user: dict = Depends(get_current_user),
):
    company = await _load_company(company_id, current_user, require_company_admin=True)
    cursor = db.corporate_invites.find({"companyId": str(company["_id"])}).sort("createdAt", -1)
    return [_serialize_invite(d) async for d in cursor]


# ══════════════════════════════════════════════════════════════════════
#  Redemption (employee enters invite code)
# ══════════════════════════════════════════════════════════════════════
@router.post("/redeem")
async def redeem_invite(
    payload: RedeemRequest,
    current_user: dict = Depends(get_current_user),
):
    code = payload.code.strip().upper()
    invite = await db.corporate_invites.find_one({"code": code})
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid code.")

    expires = invite.get("expiresAt")
    if expires:
        # Mongo returns naive UTC; force-aware for comparison
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < _utcnow():
            raise HTTPException(status_code=410, detail="This code has expired.")

    if invite.get("usedCount", 0) >= invite.get("maxUses", 1):
        raise HTTPException(status_code=409, detail="This code has reached its usage limit.")

    user_id = str(current_user["_id"])

    # Already a member?
    existing_membership = await db.corporate_memberships.find_one({
        "userId": user_id,
        "companyId": invite["companyId"],
    })
    if existing_membership:
        raise HTTPException(status_code=409, detail="You are already enrolled with this company.")

    # Create membership
    membership = {
        "companyId": invite["companyId"],
        "userId": user_id,
        "role": "employee",
        "creditAllowanceCents": int(invite.get("creditAllowanceCents", 0)),
        "creditUsedCents": 0,
        "inviteCode": code,
        "joinedAt": _utcnow(),
    }
    result = await db.corporate_memberships.insert_one(membership)
    membership["_id"] = result.inserted_id

    # Update invite + company counters
    await db.corporate_invites.update_one(
        {"_id": invite["_id"]},
        {"$inc": {"usedCount": 1}},
    )
    await db.corporate_companies.update_one(
        {"_id": _ensure_oid(invite["companyId"], "company id")},
        {"$inc": {"employeeCount": 1}, "$set": {"updatedAt": _utcnow()}},
    )

    # Denormalize on user doc for fast lookup
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"corporateCompanyId": invite["companyId"]}},
    )

    company = await db.corporate_companies.find_one({"_id": _ensure_oid(invite["companyId"], "company id")})
    return {
        "membership": _serialize_membership(membership),
        "company": _serialize_company(company) if company else None,
    }


# ══════════════════════════════════════════════════════════════════════
#  Employees + Usage
# ══════════════════════════════════════════════════════════════════════
@router.get("/companies/{company_id}/employees")
async def list_employees(
    company_id: str,
    current_user: dict = Depends(get_current_user),
):
    company = await _load_company(company_id, current_user, require_company_admin=True)
    cursor = db.corporate_memberships.find({"companyId": str(company["_id"])}).sort("joinedAt", -1)
    memberships = [_serialize_membership(d) async for d in cursor]

    # Enrich with user names (best-effort)
    user_ids = [m["userId"] for m in memberships]
    user_oids = []
    for uid in user_ids:
        try:
            user_oids.append(ObjectId(uid))
        except Exception:
            pass
    users_map: dict = {}
    if user_oids:
        async for u in db.users.find({"_id": {"$in": user_oids}}, {"fullName": 1, "email": 1, "avatarUrl": 1}):
            users_map[str(u["_id"])] = {
                "fullName": u.get("fullName", ""),
                "email": u.get("email", ""),
                "avatarUrl": u.get("avatarUrl"),
            }
    for m in memberships:
        m["user"] = users_map.get(m["userId"], {"fullName": "Unknown", "email": ""})
    return memberships


@router.get("/companies/{company_id}/usage")
async def company_usage(
    company_id: str,
    current_user: dict = Depends(get_current_user),
):
    company = await _load_company(company_id, current_user, require_company_admin=True)
    pipeline = [
        {"$match": {"companyId": str(company["_id"])}},
        {"$group": {
            "_id": None,
            "totalAllowance": {"$sum": "$creditAllowanceCents"},
            "totalUsed": {"$sum": "$creditUsedCents"},
            "employees": {"$sum": 1},
        }},
    ]
    agg = await db.corporate_memberships.aggregate(pipeline).to_list(length=1)
    summary = agg[0] if agg else {"totalAllowance": 0, "totalUsed": 0, "employees": 0}

    return {
        "companyId": str(company["_id"]),
        "creditPoolCents": int(company.get("creditPoolCents", 0)),
        "totalSpentCents": int(company.get("totalSpentCents", 0)),
        "employees": int(summary.get("employees", 0)),
        "allocatedAllowanceCents": int(summary.get("totalAllowance", 0)),
        "usedAllowanceCents": int(summary.get("totalUsed", 0)),
        "remainingPoolCents": max(0, int(company.get("creditPoolCents", 0)) - int(company.get("totalSpentCents", 0))),
    }


# ══════════════════════════════════════════════════════════════════════
#  Employee view of own membership
# ══════════════════════════════════════════════════════════════════════
@router.get("/me/company")
async def my_company(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    membership = await db.corporate_memberships.find_one({"userId": user_id})
    if not membership:
        return {"membership": None, "company": None}
    company = await db.corporate_companies.find_one({"_id": _ensure_oid(membership["companyId"], "company id")})
    return {
        "membership": _serialize_membership(membership),
        "company": _serialize_company(company) if company else None,
    }


# ══════════════════════════════════════════════════════════════════════
#  Public branded landing
# ══════════════════════════════════════════════════════════════════════
@router.get("/landing/{slug}")
async def public_landing(slug: str):
    slug = slug.lower().strip()
    if not SLUG_PATTERN.match(slug):
        raise HTTPException(status_code=400, detail="Invalid slug.")
    company = await db.corporate_companies.find_one({"slug": slug, "isActive": True})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")
    # Only expose safe public-facing fields
    return {
        "name": company.get("name", ""),
        "slug": company.get("slug", ""),
        "logoUrl": company.get("logoUrl"),
        "brandColor": company.get("brandColor") or "#FF7A00",
        "brandTagline": company.get("brandTagline"),
        "employeeCount": int(company.get("employeeCount", 0)),
    }



# ══════════════════════════════════════════════════════════════════════
#  Credit application helpers (used by payment_routes)
# ══════════════════════════════════════════════════════════════════════
async def compute_corporate_subsidy(user_id: str, amount_cents: int) -> dict:
    """Compute the subsidy a corporate employee receives for `amount_cents`.

    Returns a dict with: subsidyCents, traineePaysCents, companyId, membershipId,
    membershipRemaining, companyPoolRemaining. If the user has no eligible
    membership, subsidyCents will be 0.
    """
    if amount_cents <= 0:
        return {"subsidyCents": 0, "traineePaysCents": amount_cents}

    membership = await db.corporate_memberships.find_one({"userId": user_id})
    if not membership:
        return {"subsidyCents": 0, "traineePaysCents": amount_cents}

    try:
        company_oid = ObjectId(membership["companyId"])
    except Exception:
        return {"subsidyCents": 0, "traineePaysCents": amount_cents}
    company = await db.corporate_companies.find_one({"_id": company_oid})
    if not company or not company.get("isActive", True):
        return {"subsidyCents": 0, "traineePaysCents": amount_cents}

    membership_remaining = max(
        0,
        int(membership.get("creditAllowanceCents", 0)) - int(membership.get("creditUsedCents", 0)),
    )
    pool_remaining = max(
        0,
        int(company.get("creditPoolCents", 0)) - int(company.get("totalSpentCents", 0)),
    )
    subsidy = min(amount_cents, membership_remaining, pool_remaining)

    return {
        "subsidyCents": subsidy,
        "traineePaysCents": amount_cents - subsidy,
        "companyId": str(company["_id"]),
        "companyName": company.get("name", ""),
        "companySlug": company.get("slug", ""),
        "membershipId": str(membership["_id"]),
        "membershipRemainingCents": membership_remaining,
        "companyPoolRemainingCents": pool_remaining,
    }


async def commit_corporate_subsidy(
    *,
    user_id: str,
    quote: dict,
    session_id: Optional[str],
    payment_intent_id: Optional[str],
) -> None:
    """Persist the subsidy debit. Call this ONLY after Stripe intent succeeds.

    Updates the membership (creditUsedCents++), company totals (totalSpentCents++),
    and writes a debit row in corporate_credit_ledger for audit.
    """
    subsidy = int(quote.get("subsidyCents", 0))
    if subsidy <= 0:
        return

    membership_id = quote.get("membershipId")
    company_id = quote.get("companyId")
    if not membership_id or not company_id:
        return

    try:
        await db.corporate_memberships.update_one(
            {"_id": ObjectId(membership_id)},
            {"$inc": {"creditUsedCents": subsidy}},
        )
        await db.corporate_companies.update_one(
            {"_id": ObjectId(company_id)},
            {"$inc": {"totalSpentCents": subsidy}, "$set": {"updatedAt": _utcnow()}},
        )
        await db.corporate_credit_ledger.insert_one({
            "companyId": company_id,
            "userId": user_id,
            "amountCents": subsidy,
            "direction": "debit",
            "note": "Session subsidy",
            "sessionId": session_id,
            "paymentIntentId": payment_intent_id,
            "createdAt": _utcnow(),
        })
    except Exception:
        # Best-effort — debit failure must never break the intent return.
        pass


class QuoteRequest(BaseModel):
    amountCents: int = Field(..., gt=0, le=10_000_000)
    sessionId: Optional[str] = Field(None, max_length=64)


@router.post("/sessions/quote")
async def quote_session(
    payload: QuoteRequest,
    current_user: dict = Depends(get_current_user),
):
    """Pre-flight quote: how much will corporate cover for this booking?

    Used by the booking confirmation screen to show the employee the subsidy
    line and the out-of-pocket total before they hit "Pay".
    """
    quote = await compute_corporate_subsidy(str(current_user["_id"]), payload.amountCents)
    return {
        "amountCents": payload.amountCents,
        "subsidyCents": int(quote.get("subsidyCents", 0)),
        "traineePaysCents": int(quote.get("traineePaysCents", payload.amountCents)),
        "hasCorporateCoverage": int(quote.get("subsidyCents", 0)) > 0,
        "companyName": quote.get("companyName"),
        "companySlug": quote.get("companySlug"),
    }
