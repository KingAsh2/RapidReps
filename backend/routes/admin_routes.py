"""Admin routes: dashboard, users, sessions, transactions, verifications, payouts, refunds, messages"""
from fastapi import APIRouter, HTTPException, Depends, Request, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import stripe
import uuid
import os
import csv
import io

from deps import (
    db, get_current_user, require_admin, serialize_doc, sanitize_text,
    send_push_notification, calculate_trainer_tier,
)
from models import (
    AdminDashboardStats, SessionStatus, TransactionType, PaymentStatus,
    PricingRules, VerificationStatus, UserRole, MembershipStatus, BoostType,
)
from email_service import send_payout_notification_email

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', '')

router = APIRouter(prefix="/api")

# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

@router.get("/admin/dashboard")
async def get_admin_dashboard(admin_user: dict = Depends(require_admin)):
    """Get admin dashboard statistics"""
    
    # Count users
    total_users = await db.users.count_documents({})
    total_trainers = await db.users.count_documents({'roles': {'$in': ['trainer']}})
    total_trainees = await db.users.count_documents({'roles': {'$in': ['trainee']}})
    
    # Count sessions
    total_sessions = await db.sessions.count_documents({})
    completed_sessions = await db.sessions.count_documents({'status': SessionStatus.COMPLETED})
    
    # Calculate revenue (from completed sessions)
    # iter97f: use the session document's stored platformFeeCents / trainerEarningsCents
    # (which already include the $2.99 service fee + tier-based commission), instead
    # of recomputing with a flat 20% on the gross. Service fee broken out separately.
    sessions = await db.sessions.find(
        {'status': SessionStatus.COMPLETED},
        {'finalSessionPriceCents': 1, 'platformFeeCents': 1, 'trainerEarningsCents': 1, 'serviceFeeCents': 1},
    ).to_list(None)
    total_revenue = sum(s.get('finalSessionPriceCents', 0) for s in sessions)
    platform_revenue = sum(s.get('platformFeeCents', 0) for s in sessions)
    trainer_payouts = sum(s.get('trainerEarningsCents', 0) for s in sessions)
    service_fee_revenue = sum(s.get('serviceFeeCents', 0) for s in sessions)
    # Fallback for legacy session docs that never persisted the split fields.
    if platform_revenue == 0 and total_revenue > 0:
        platform_revenue = int(total_revenue * PricingRules.PLATFORM_REVENUE_PERCENT / 100)
        trainer_payouts = total_revenue - platform_revenue
    
    # Count memberships and boosts
    active_memberships = await db.memberships.count_documents({'status': MembershipStatus.ACTIVE})
    active_boosts = await db.boosts.count_documents({'isActive': True, 'endDate': {'$gte': datetime.utcnow()}})
    
    # Pending verifications
    pending_verifications = await db.trainer_profiles.count_documents({
        'verificationStatus': VerificationStatus.PENDING
    })
    
    # iter98a: Premium dashboard tiles — additional KPIs
    # Avg session value (only completed)
    avg_session_value_cents = int(total_revenue / max(completed_sessions, 1)) if completed_sessions else 0

    # This-month metrics
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    sessions_this_month = await db.sessions.count_documents({
        'status': SessionStatus.COMPLETED,
        'createdAt': {'$gte': month_start},
    })
    month_sessions_docs = await db.sessions.find(
        {'status': SessionStatus.COMPLETED, 'createdAt': {'$gte': month_start}},
        {'finalSessionPriceCents': 1, 'platformFeeCents': 1, 'serviceFeeCents': 1},
    ).to_list(None)
    month_revenue = sum(s.get('finalSessionPriceCents', 0) for s in month_sessions_docs)
    month_platform_revenue = sum(s.get('platformFeeCents', 0) for s in month_sessions_docs)

    # Corporate credit pool — sum of remaining (creditPoolCents - totalSpentCents) across companies
    corporate_companies = await db.corporate_companies.find({}, {
        'creditPoolCents': 1, 'totalSpentCents': 1, 'companyName': 1
    }).to_list(None) if 'corporate_companies' in await db.list_collection_names() else []
    corporate_pool_total = sum(int(c.get('creditPoolCents', 0)) for c in corporate_companies)
    corporate_pool_spent = sum(int(c.get('totalSpentCents', 0)) for c in corporate_companies)
    corporate_pool_remaining = max(0, corporate_pool_total - corporate_pool_spent)
    corporate_companies_count = len(corporate_companies)

    return {
        "totalUsers": total_users,
        "totalTrainers": total_trainers,
        "totalTrainees": total_trainees,
        "totalSessions": total_sessions,
        "completedSessions": completed_sessions,
        "totalRevenueCents": total_revenue,
        "totalRevenueDollars": total_revenue / 100,
        "platformRevenueCents": platform_revenue,
        "platformRevenueDollars": platform_revenue / 100,
        "serviceFeeRevenueCents": service_fee_revenue,
        "serviceFeeRevenueDollars": service_fee_revenue / 100,
        "commissionRevenueCents": max(0, platform_revenue - service_fee_revenue),
        "trainerPayoutsCents": trainer_payouts,
        "trainerPayoutsDollars": trainer_payouts / 100,
        "activeMemberships": active_memberships,
        "activeBoosts": active_boosts,
        "pendingVerifications": pending_verifications,
        # iter98a additions
        "avgSessionValueCents": avg_session_value_cents,
        "sessionsThisMonth": sessions_this_month,
        "monthRevenueCents": month_revenue,
        "monthPlatformRevenueCents": month_platform_revenue,
        "corporatePoolTotalCents": corporate_pool_total,
        "corporatePoolSpentCents": corporate_pool_spent,
        "corporatePoolRemainingCents": corporate_pool_remaining,
        "corporateCompaniesCount": corporate_companies_count,
    }




# iter98c: Admin audit log for user display-name changes
@router.get("/admin/name-change-audit")
async def admin_name_change_audit(
    limit: int = 100,
    user_id: Optional[str] = None,
    admin_user: dict = Depends(require_admin),
):
    """Return the most recent display-name changes (admin-only audit trail)."""
    query: dict = {}
    if user_id:
        query['userId'] = user_id
    rows = await db.name_change_audit.find(query, {'_id': 0}).sort('changedAt', -1).limit(limit).to_list(limit)
    for r in rows:
        if r.get('changedAt') and hasattr(r['changedAt'], 'isoformat'):
            r['changedAt'] = r['changedAt'].isoformat()
    return {'entries': rows, 'count': len(rows)}



# iter98a: Recent completed sessions feed for premium dashboard tile
@router.get("/admin/recent-sessions")
async def admin_recent_sessions(limit: int = 10, admin_user: dict = Depends(require_admin)):
    """Return the most recent completed sessions, enriched with trainer/trainee names."""
    sessions = await db.sessions.find(
        {'status': SessionStatus.COMPLETED}
    ).sort('createdAt', -1).limit(limit).to_list(limit)

    user_ids = set()
    for s in sessions:
        if s.get('trainerId'): user_ids.add(s['trainerId'])
        if s.get('traineeId'): user_ids.add(s['traineeId'])

    users_map: dict = {}
    if user_ids:
        oids = []
        for uid in user_ids:
            try:
                oids.append(ObjectId(uid))
            except Exception:
                pass
        if oids:
            users = await db.users.find({'_id': {'$in': oids}}, {'fullName': 1}).to_list(len(oids))
            users_map = {str(u['_id']): u.get('fullName', 'Unknown') for u in users}

    out = []
    for s in sessions:
        out.append({
            'id': str(s.get('_id')),
            'trainerName': users_map.get(s.get('trainerId', ''), 'Unknown'),
            'traineeName': users_map.get(s.get('traineeId', ''), 'Unknown'),
            'sessionType': s.get('sessionType', 'session'),
            'finalSessionPriceCents': s.get('finalSessionPriceCents', 0),
            'platformFeeCents': s.get('platformFeeCents', 0),
            'trainerEarningsCents': s.get('trainerEarningsCents', 0),
            'serviceFeeCents': s.get('serviceFeeCents', 0),
            'createdAt': s.get('createdAt').isoformat() if s.get('createdAt') else None,
        })

    return {'sessions': out, 'count': len(out)}


# iter98a: CSV export — per-session payment breakdown, sorted by trainer name
@router.get("/admin/payments/csv-export")
async def admin_payments_csv_export(
    start_date: Optional[str] = None,   # ISO YYYY-MM-DD
    end_date: Optional[str] = None,
    period: Optional[str] = None,        # 'this_month' | 'last_month' | 'all_time'
    admin_user: dict = Depends(require_admin),
):
    """Export per-session payment breakdown as CSV, sorted by trainer name.

    Columns: Trainer Name, Session Date, Customer, Gross, Commission %, Commission $,
    Service Fee, Trainer Payout, Corporate Subsidy, Stripe Intent ID, Status.
    """
    now = datetime.utcnow()
    query: dict = {'status': SessionStatus.COMPLETED}

    # Resolve date range
    range_start: Optional[datetime] = None
    range_end: Optional[datetime] = None
    if period == 'this_month':
        range_start = datetime(now.year, now.month, 1)
        range_end = now
    elif period == 'last_month':
        if now.month == 1:
            range_start = datetime(now.year - 1, 12, 1)
            range_end = datetime(now.year, 1, 1)
        else:
            range_start = datetime(now.year, now.month - 1, 1)
            range_end = datetime(now.year, now.month, 1)
    elif period == 'all_time':
        range_start = None
        range_end = None
    else:
        if start_date:
            try:
                range_start = datetime.fromisoformat(start_date)
            except ValueError:
                raise HTTPException(400, "start_date must be ISO YYYY-MM-DD")
        if end_date:
            try:
                range_end = datetime.fromisoformat(end_date) + timedelta(days=1)
            except ValueError:
                raise HTTPException(400, "end_date must be ISO YYYY-MM-DD")

    if range_start or range_end:
        date_filter: dict = {}
        if range_start: date_filter['$gte'] = range_start
        if range_end: date_filter['$lt'] = range_end
        query['createdAt'] = date_filter

    sessions = await db.sessions.find(query).to_list(None)

    # Batch fetch users for names
    user_ids = set()
    for s in sessions:
        if s.get('trainerId'): user_ids.add(s['trainerId'])
        if s.get('traineeId'): user_ids.add(s['traineeId'])
    users_map: dict = {}
    if user_ids:
        oids = []
        for uid in user_ids:
            try: oids.append(ObjectId(uid))
            except Exception: pass
        if oids:
            users = await db.users.find({'_id': {'$in': oids}}, {'fullName': 1, 'email': 1}).to_list(len(oids))
            users_map = {str(u['_id']): u for u in users}

    # Build rows
    rows = []
    for s in sessions:
        trainer = users_map.get(s.get('trainerId', ''), {})
        trainee = users_map.get(s.get('traineeId', ''), {})
        gross = s.get('finalSessionPriceCents', 0)
        platform_fee = s.get('platformFeeCents', 0)
        service_fee = s.get('serviceFeeCents', 0)
        commission_cents = max(0, platform_fee - service_fee)
        # Commission base = gross - service_fee (i.e. the trainer rate portion)
        commission_base = max(0, gross - service_fee)
        commission_pct = round((commission_cents / commission_base) * 100, 1) if commission_base else 0
        rows.append({
            'trainer_name': trainer.get('fullName', 'Unknown'),
            'trainer_email': trainer.get('email', ''),
            'session_date': (s.get('createdAt').strftime('%Y-%m-%d %H:%M') if s.get('createdAt') else ''),
            'customer': trainee.get('fullName', 'Unknown'),
            'gross_dollars': f"{gross / 100:.2f}",
            'commission_pct': f"{commission_pct}%",
            'commission_dollars': f"{commission_cents / 100:.2f}",
            'service_fee_dollars': f"{service_fee / 100:.2f}",
            'trainer_payout_dollars': f"{s.get('trainerEarningsCents', 0) / 100:.2f}",
            'corporate_subsidy_dollars': f"{s.get('corporateSubsidyCents', 0) / 100:.2f}",
            'stripe_intent_id': s.get('paymentIntentId', ''),
            'status': s.get('status', ''),
        })

    # Sort by trainer name (case-insensitive), then session date asc
    rows.sort(key=lambda r: (r['trainer_name'].lower(), r['session_date']))

    # Write CSV
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        'Trainer Name', 'Trainer Email', 'Session Date', 'Customer',
        'Gross ($)', 'Commission %', 'Commission ($)', 'Service Fee ($)',
        'Trainer Payout ($)', 'Corporate Subsidy ($)', 'Stripe Intent ID', 'Status',
    ])
    for r in rows:
        writer.writerow([
            r['trainer_name'], r['trainer_email'], r['session_date'], r['customer'],
            r['gross_dollars'], r['commission_pct'], r['commission_dollars'],
            r['service_fee_dollars'], r['trainer_payout_dollars'], r['corporate_subsidy_dollars'],
            r['stripe_intent_id'], r['status'],
        ])

    csv_text = buf.getvalue()
    buf.close()

    # Filename includes range for clarity
    if period:
        fname_suffix = period
    elif start_date or end_date:
        fname_suffix = f"{start_date or 'start'}_to_{end_date or 'end'}"
    else:
        fname_suffix = 'all'
    filename = f"rapidreps_payments_{fname_suffix}.csv"

    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )



@router.get("/admin/top-trainers")
async def admin_top_trainers(days: int = 7, limit: int = 5, admin_user: dict = Depends(require_admin)):
    """Get top trainers by completed sessions in the given period"""
    cutoff = datetime.utcnow() - timedelta(days=days)

    pipeline = [
        {"$match": {"status": SessionStatus.COMPLETED, "createdAt": {"$gte": cutoff}}},
        {"$group": {"_id": "$trainerId", "sessionCount": {"$sum": 1}, "totalRevenue": {"$sum": "$finalSessionPriceCents"}}},
        {"$sort": {"sessionCount": -1}},
        {"$limit": limit},
    ]
    results = await db.sessions.aggregate(pipeline).to_list(limit)

    trainer_ids = [r["_id"] for r in results if r["_id"]]
    users = {str(u["_id"]): u for u in await db.users.find({"_id": {"$in": [ObjectId(tid) for tid in trainer_ids]}}).to_list(len(trainer_ids))} if trainer_ids else {}
    profiles = {p["userId"]: p for p in await db.trainer_profiles.find({"userId": {"$in": trainer_ids}}).to_list(len(trainer_ids))} if trainer_ids else {}

    leaderboard = []
    for r in results:
        tid = r["_id"]
        user = users.get(tid, {})
        profile = profiles.get(tid, {})
        total_reviews = profile.get("totalReviews", 0)
        avg_rating = profile.get("averageRating", 0.0)
        tier = calculate_trainer_tier(total_reviews, avg_rating, False)
        leaderboard.append({
            "trainerId": tid,
            "fullName": user.get("fullName", "Unknown Trainer"),
            "sessionCount": r["sessionCount"],
            "totalRevenueCents": r["totalRevenue"],
            "averageRating": round(avg_rating, 1),
            "tier": tier,
        })

    # If no data in period, return top trainers by all-time rating
    if not leaderboard:
        fallback = await db.trainer_profiles.find(
            {}, {"_id": 0, "userId": 1, "averageRating": 1, "totalReviews": 1}
        ).sort("averageRating", -1).limit(limit).to_list(limit)
        fb_ids = [f["userId"] for f in fallback]
        fb_users = {str(u["_id"]): u for u in await db.users.find({"_id": {"$in": [ObjectId(fid) for fid in fb_ids]}}).to_list(len(fb_ids))} if fb_ids else {}
        for f in fallback:
            uid = f["userId"]
            u = fb_users.get(uid, {})
            leaderboard.append({
                "trainerId": uid,
                "fullName": u.get("fullName", "Unknown Trainer"),
                "sessionCount": 0,
                "totalRevenueCents": 0,
                "averageRating": round(f.get("averageRating", 0), 1),
                "tier": calculate_trainer_tier(f.get("totalReviews", 0), f.get("averageRating", 0), False),
            })

    # Filter out trainers with no real name ("Unknown Trainer")
    leaderboard = [t for t in leaderboard if t["fullName"] and t["fullName"] != "Unknown Trainer"]

    return {"leaderboard": leaderboard, "periodDays": days}


@router.get("/admin/earnings-summary")
async def admin_earnings_summary(admin_user: dict = Depends(require_admin)):
    """Admin: Get platform-wide earnings summary with daily/weekly/monthly breakdowns."""
    now = datetime.utcnow()

    # All verified Zelle sessions
    verified_sessions = await db.sessions.find(
        {"zellePaymentStatus": "verified"},
        {"totalCents": 1, "priceCents": 1, "createdAt": 1, "zellePaymentVerifiedAt": 1, "sessionType": 1}
    ).sort("zellePaymentVerifiedAt", -1).to_list(2000)

    # Calculate totals
    def get_cents(s):
        return s.get("totalCents") or s.get("priceCents", 0)

    total_revenue = sum(get_cents(s) for s in verified_sessions)
    platform_cut = int(total_revenue * 0.20)
    trainer_cut = total_revenue - platform_cut

    # This month
    month_start = datetime(now.year, now.month, 1)
    month_sessions = [s for s in verified_sessions if (s.get("zellePaymentVerifiedAt") or s.get("createdAt", now)) >= month_start]
    month_revenue = sum(get_cents(s) for s in month_sessions)

    # Last month
    if now.month == 1:
        last_month_start = datetime(now.year - 1, 12, 1)
    else:
        last_month_start = datetime(now.year, now.month - 1, 1)
    last_month_sessions = [s for s in verified_sessions if last_month_start <= (s.get("zellePaymentVerifiedAt") or s.get("createdAt", now)) < month_start]
    last_month_revenue = sum(get_cents(s) for s in last_month_sessions)

    # This week (Mon start)
    week_start = now - timedelta(days=now.weekday())
    week_start = datetime(week_start.year, week_start.month, week_start.day)
    week_sessions = [s for s in verified_sessions if (s.get("zellePaymentVerifiedAt") or s.get("createdAt", now)) >= week_start]
    week_revenue = sum(get_cents(s) for s in week_sessions)

    # Last week
    last_week_start = week_start - timedelta(days=7)
    last_week_sessions = [s for s in verified_sessions if last_week_start <= (s.get("zellePaymentVerifiedAt") or s.get("createdAt", now)) < week_start]
    last_week_revenue = sum(get_cents(s) for s in last_week_sessions)

    # Daily breakdown (current week Mon-Sun)
    daily_breakdown = []
    for i in range(7):
        day_start = week_start + timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        day_sessions = [s for s in verified_sessions if day_start <= (s.get("zellePaymentVerifiedAt") or s.get("createdAt", now)) < day_end]
        daily_breakdown.append({
            "day": day_start.strftime("%a"),
            "date": day_start.strftime("%m/%d"),
            "revenueCents": sum(get_cents(s) for s in day_sessions),
            "sessions": len(day_sessions),
            "platformCents": int(sum(get_cents(s) for s in day_sessions) * 0.20),
        })

    # Weekly breakdown (current month, up to 5 weeks)
    weekly_breakdown = []
    cur_week = month_start
    wn = 1
    while cur_week < now and wn <= 5:
        cur_week_end = min(cur_week + timedelta(days=7), now)
        w_sessions = [s for s in verified_sessions if cur_week <= (s.get("zellePaymentVerifiedAt") or s.get("createdAt", now)) < cur_week_end]
        weekly_breakdown.append({
            "week": f"Week {wn}",
            "startDate": cur_week.strftime("%m/%d"),
            "revenueCents": sum(get_cents(s) for s in w_sessions),
            "sessions": len(w_sessions),
            "platformCents": int(sum(get_cents(s) for s in w_sessions) * 0.20),
        })
        cur_week = cur_week_end
        wn += 1

    # Monthly breakdown (last 6 months)
    monthly_breakdown = []
    for m_offset in range(5, -1, -1):
        m_year = now.year
        m_month = now.month - m_offset
        while m_month <= 0:
            m_month += 12
            m_year -= 1
        m_start = datetime(m_year, m_month, 1)
        if m_month == 12:
            m_end = datetime(m_year + 1, 1, 1)
        else:
            m_end = datetime(m_year, m_month + 1, 1)
        m_sessions = [s for s in verified_sessions if m_start <= (s.get("zellePaymentVerifiedAt") or s.get("createdAt", now)) < m_end]
        monthly_breakdown.append({
            "month": m_start.strftime("%b"),
            "year": m_year,
            "revenueCents": sum(get_cents(s) for s in m_sessions),
            "sessions": len(m_sessions),
            "platformCents": int(sum(get_cents(s) for s in m_sessions) * 0.20),
        })

    return {
        "totalRevenueCents": total_revenue,
        "platformRevenueCents": platform_cut,
        "trainerPayoutsCents": trainer_cut,
        "totalSessions": len(verified_sessions),
        "weekRevenueCents": week_revenue,
        "lastWeekRevenueCents": last_week_revenue,
        "monthRevenueCents": month_revenue,
        "lastMonthRevenueCents": last_month_revenue,
        "weekSessions": len(week_sessions),
        "monthSessions": len(month_sessions),
        "dailyBreakdown": daily_breakdown,
        "weeklyBreakdown": weekly_breakdown,
        "monthlyBreakdown": monthly_breakdown,
    }


@router.get("/admin/users")
async def admin_get_users(
    skip: int = 0,
    limit: int = 50,
    role: Optional[str] = None,
    search: Optional[str] = None,
    admin_user: dict = Depends(require_admin)
):
    """Get all users for admin with search and filter"""
    query = {}
    if role:
        query['roles'] = {'$in': [role]}
    if search:
        search_regex = {'$regex': search, '$options': 'i'}
        query['$or'] = [
            {'fullName': search_regex},
            {'email': search_regex},
            {'city': search_regex},
            {'state': search_regex},
        ]
    
    users = await db.users.find(query).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    
    # Enrich with city/state and avatarUrl from trainer/trainee profiles
    user_ids = [str(u['_id']) for u in users]
    trainer_profiles = {}
    async for tp in db.trainer_profiles.find({'userId': {'$in': user_ids}}, {'userId': 1, 'city': 1, 'state': 1, 'latitude': 1, 'longitude': 1, 'avatarUrl': 1}):
        trainer_profiles[tp['userId']] = tp
    
    trainee_profiles = {}
    async for tp in db.trainee_profiles.find({'userId': {'$in': user_ids}}, {'userId': 1, 'profilePhoto': 1, 'avatarUrl': 1}):
        trainee_profiles[tp['userId']] = tp
    
    serialized_users = []
    for u in users:
        doc = serialize_doc(u)
        doc.pop('passwordHash', None)
        uid = doc.get('id', '')
        tp = trainer_profiles.get(uid, {})
        tnp = trainee_profiles.get(uid, {})
        if not doc.get('city') and tp.get('city'):
            doc['city'] = tp['city']
        if not doc.get('state') and tp.get('state'):
            doc['state'] = tp['state']
        # Resolve avatar from profiles
        if not doc.get('avatarUrl'):
            doc['avatarUrl'] = tp.get('avatarUrl') or tnp.get('profilePhoto') or tnp.get('avatarUrl') or doc.get('profilePhoto')
        serialized_users.append(doc)
    
    return {
        "users": serialized_users,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/admin/users/{user_id}")
async def admin_get_user_detail(user_id: str, admin_user: dict = Depends(require_admin)):
    """Get detailed user information for admin"""
    user = await db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get profile
    trainer_profile = await db.trainer_profiles.find_one({'userId': user_id})
    trainee_profile = await db.trainee_profiles.find_one({'userId': user_id})
    
    # Get sessions
    sessions = await db.sessions.find({
        '$or': [{'traineeId': user_id}, {'trainerId': user_id}]
    }).sort('createdAt', -1).limit(20).to_list(20)
    
    # Get transactions
    transactions = await db.transactions.find({
        'userId': user_id
    }).sort('createdAt', -1).limit(20).to_list(20)
    
    # Get achievements
    achievements = await db.achievements.find_one({'userId': user_id})
    
    return {
        "user": serialize_doc(user),
        "trainerProfile": serialize_doc(trainer_profile) if trainer_profile else None,
        "traineeProfile": serialize_doc(trainee_profile) if trainee_profile else None,
        "recentSessions": [serialize_doc(s) for s in sessions],
        "recentTransactions": [serialize_doc(t) for t in transactions],
        "achievements": serialize_doc(achievements) if achievements else None
    }

@router.put("/admin/users/{user_id}")
async def admin_update_user(
    user_id: str,
    updates: dict,
    admin_user: dict = Depends(require_admin)
):
    """Update user details (admin only)"""
    # Don't allow changing password directly
    updates.pop('password', None)
    updates.pop('passwordHash', None)
    updates['updatedAt'] = datetime.utcnow()
    updates['updatedBy'] = str(admin_user['_id'])
    
    result = await db.users.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": "User updated"}

@router.get("/admin/sessions")
async def admin_get_sessions(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    search: Optional[str] = None,
    session_type: Optional[str] = None,
    admin_user: dict = Depends(require_admin)
):
    """Get all sessions for admin with trainer/trainee names, location, and duration"""
    query = {}
    if status:
        query['status'] = status
    if session_type:
        query['sessionType'] = session_type
    
    sessions = await db.sessions.find(query).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.sessions.count_documents(query)
    
    # Collect all unique user IDs for batch lookup
    user_ids = set()
    for s in sessions:
        if s.get('trainerId'):
            user_ids.add(s['trainerId'])
        if s.get('traineeId'):
            user_ids.add(s['traineeId'])
    
    # Batch fetch user names
    users_map = {}
    if user_ids:
        user_obj_ids = []
        for uid in user_ids:
            try:
                user_obj_ids.append(ObjectId(uid))
            except Exception:
                pass
        if user_obj_ids:
            users_cursor = db.users.find({'_id': {'$in': user_obj_ids}}, {'fullName': 1, 'email': 1})
            users_list = await users_cursor.to_list(len(user_obj_ids))
            users_map = {str(u['_id']): u for u in users_list}
    
    # Batch fetch trainee profiles for home address
    trainee_profiles_map = {}
    trainee_ids = [s.get('traineeId') for s in sessions if s.get('traineeId')]
    if trainee_ids:
        trainee_profiles = await db.trainee_profiles.find(
            {'userId': {'$in': list(set(trainee_ids))}},
            {'userId': 1, 'homeAddress': 1, 'locationAddress': 1}
        ).to_list(len(set(trainee_ids)))
        trainee_profiles_map = {tp['userId']: tp for tp in trainee_profiles}
    
    # Enrich sessions with names and computed duration
    enriched_sessions = []
    for s in sessions:
        doc = serialize_doc(s)
        trainer_user = users_map.get(s.get('trainerId', ''), {})
        trainee_user = users_map.get(s.get('traineeId', ''), {})
        doc['trainerName'] = trainer_user.get('fullName', 'Unknown')
        doc['trainerEmail'] = trainer_user.get('email', '')
        doc['traineeName'] = trainee_user.get('fullName', 'Unknown')
        doc['traineeEmail'] = trainee_user.get('email', '')
        
        # Add trainee home address for in-home sessions
        trainee_profile = trainee_profiles_map.get(s.get('traineeId', ''))
        if trainee_profile:
            doc['traineeHomeAddress'] = trainee_profile.get('homeAddress') or trainee_profile.get('locationAddress', '')
        else:
            doc['traineeHomeAddress'] = ''
        
        # Compute actual duration if start/end times exist
        started = s.get('sessionStartedAt')
        ended = s.get('sessionEndedAt')
        if started and ended:
            actual_minutes = int((ended - started).total_seconds() / 60)
            doc['actualDurationMinutes'] = actual_minutes
        else:
            doc['actualDurationMinutes'] = None
        
        enriched_sessions.append(doc)
    
    return {
        "sessions": enriched_sessions,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/admin/transactions")
async def admin_get_transactions(
    skip: int = 0,
    limit: int = 50,
    transaction_type: Optional[str] = None,
    admin_user: dict = Depends(require_admin)
):
    """Get all transactions for admin"""
    query = {}
    if transaction_type:
        query['transactionType'] = transaction_type
    
    transactions = await db.transactions.find(query).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.transactions.count_documents(query)
    
    return {
        "transactions": [serialize_doc(t) for t in transactions],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/admin/verifications/pending")
async def admin_get_pending_verifications(admin_user: dict = Depends(require_admin)):
    """Get all pending trainer verifications"""
    pending = await db.trainer_profiles.find({
        'verificationStatus': {'$in': [VerificationStatus.PENDING, VerificationStatus.REJECTED]}
    }).to_list(None)
    
    # Get user names
    result = []
    for profile in pending:
        user = await db.users.find_one({'_id': ObjectId(profile['userId'])})
        result.append({
            "profile": serialize_doc(profile),
            "user": serialize_doc(user) if user else None
        })
    
    return {"pendingVerifications": result, "count": len(result)}

@router.get("/admin/verifications/approved")
async def admin_get_approved_trainers(admin_user: dict = Depends(require_admin)):
    """Get all approved/verified trainers with their documents"""
    approved = await db.trainer_profiles.find({
        'verificationStatus': VerificationStatus.VERIFIED
    }).to_list(None)
    
    # Get user names
    result = []
    for profile in approved:
        user = await db.users.find_one({'_id': ObjectId(profile['userId'])})
        if user:
            result.append({
                "userId": profile['userId'],
                "fullName": user.get('fullName', ''),
                "email": user.get('email', ''),
                "verifiedAt": profile.get('verifiedAt'),
                "documentsUploaded": {
                    "governmentId": profile.get('governmentIdUploaded', False),
                    "backgroundCheck": profile.get('backgroundCheckPassed', False),
                    "fitnessCert": profile.get('fitnessCertUploaded', False),
                    "cprAedCert": profile.get('cprAedCertUploaded', False),
                    "introVideo": profile.get('introVideoUploaded', False),
                }
            })
    
    return result


@router.get("/admin/verifications/unverified")
async def admin_get_unverified_trainers(admin_user: dict = Depends(require_admin)):
    """Get trainers who have the trainer role but haven't completed verification"""
    # Get all users with trainer role
    trainer_users = await db.users.find(
        {'roles': {'$in': ['trainer']}},
        {'fullName': 1, 'email': 1, 'createdAt': 1}
    ).to_list(None)

    # Get all trainer profiles
    all_profile_user_ids = set()
    async for p in db.trainer_profiles.find({}, {'userId': 1, 'verificationStatus': 1}):
        vs = p.get('verificationStatus')
        if vs in (VerificationStatus.VERIFIED, VerificationStatus.PENDING, VerificationStatus.REJECTED):
            all_profile_user_ids.add(p['userId'])

    result = []
    for user in trainer_users:
        uid = str(user['_id'])
        if uid not in all_profile_user_ids:
            result.append({
                "userId": uid,
                "fullName": user.get('fullName', ''),
                "email": user.get('email', ''),
                "createdAt": user.get('createdAt'),
            })

    return result

@router.get("/admin/verifications/{trainer_id}/detail")
async def admin_get_verification_detail(trainer_id: str, admin_user: dict = Depends(require_admin)):
    """Get full verification details for a specific trainer"""
    profile = await db.trainer_profiles.find_one({'userId': trainer_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    user = await db.users.find_one({'_id': ObjectId(trainer_id)})
    
    steps = [
        {'id': 'identity', 'label': 'Government ID', 'field': 'governmentIdUploaded', 'submitted': bool(profile.get('governmentIdUploaded')), 'url': profile.get('identityFileUri')},
        {'id': 'background', 'label': 'Background Check', 'field': 'backgroundCheckPassed', 'submitted': bool(profile.get('backgroundCheckPassed')), 'url': profile.get('backgroundFileUri')},
        {'id': 'certification', 'label': 'Fitness Certification', 'field': 'fitnessCertUploaded', 'submitted': bool(profile.get('fitnessCertUploaded')), 'url': profile.get('certificationFileUri')},
        {'id': 'cpr', 'label': 'CPR/AED Certification', 'field': 'cprAedCertUploaded', 'submitted': bool(profile.get('cprAedCertUploaded')), 'url': profile.get('cprFileUri')},
        {'id': 'insurance', 'label': 'Insurance', 'field': 'insuranceUploaded', 'submitted': bool(profile.get('insuranceUploaded')), 'url': profile.get('insuranceFileUri')},
        # iter98d (Task 9): profile photo removed from verification checklist —
        # photos go live immediately without admin gating.
        {'id': 'video', 'label': 'Intro Video', 'field': 'introVideoUploaded', 'submitted': bool(profile.get('introVideoUploaded')), 'url': profile.get('introVideoUrl') or profile.get('videoFileUri')},
    ]
    
    # Get background check request info if submitted
    background_request = await db.background_check_requests.find_one({'userId': trainer_id})
    background_info = None
    if background_request:
        background_info = {
            'fullName': background_request.get('fullName'),
            'dob': background_request.get('dob'),
            'address': background_request.get('address'),
            'status': background_request.get('status'),
            'submittedAt': background_request.get('createdAt'),
        }
    
    return {
        "user": serialize_doc(user) if user else None,
        "profile": serialize_doc(profile),
        "steps": steps,
        "backgroundInfo": background_info,
        "verificationStatus": profile.get('verificationStatus', 'pending'),
        "submittedAt": profile.get('verificationSubmittedAt'),
        "rejectionReason": profile.get('rejectionReason'),
        "rejectedAt": profile.get('rejectedAt'),
        "verifiedAt": profile.get('verifiedAt'),
    }

@router.post("/admin/verifications/{trainer_id}/approve")
async def admin_approve_verification(
    trainer_id: str,
    admin_user: dict = Depends(require_admin)
):
    """Approve trainer verification"""
    result = await db.trainer_profiles.update_one(
        {'userId': trainer_id},
        {
            '$set': {
                'verificationStatus': VerificationStatus.VERIFIED,
                'isVerified': True,
                'canGoLive': True,
                'verifiedAt': datetime.utcnow(),
                'verifiedBy': str(admin_user['_id']),
                'rejectionReason': None,
                'rejectedAt': None,
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    # Notify the trainer
    await db.notifications.insert_one({
        'userId': trainer_id,
        'type': 'verification_approved',
        'title': 'Verification Approved!',
        'message': 'Congratulations! Your account has been verified. You can now accept sessions and start training.',
        'read': False,
        'createdAt': datetime.utcnow(),
    })
    
    # Send push notification
    await send_push_notification(
        trainer_id,
        'Verification Approved!',
        'Congratulations! Your account has been verified. You can now accept sessions.',
        {'type': 'verification_approved'}
    )
    
    return {"success": True, "message": "Trainer verification approved"}

@router.post("/admin/verifications/{trainer_id}/reject")
async def admin_reject_verification(
    trainer_id: str,
    body: dict = None,
    admin_user: dict = Depends(require_admin)
):
    """Reject trainer verification with reason"""
    reason = "Verification requirements not met"
    if body and isinstance(body, dict):
        reason = body.get('reason', reason)
    
    result = await db.trainer_profiles.update_one(
        {'userId': trainer_id},
        {
            '$set': {
                'verificationStatus': VerificationStatus.REJECTED,
                'isVerified': False,
                'canGoLive': False,
                'rejectionReason': reason,
                'rejectedAt': datetime.utcnow(),
                'rejectedBy': str(admin_user['_id'])
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trainer profile not found")
    
    # Notify the trainer with the rejection reason
    await db.notifications.insert_one({
        'userId': trainer_id,
        'type': 'verification_rejected',
        'title': 'Verification Update',
        'message': f'Your verification was not approved. Reason: {reason}. Please update your submission and try again.',
        'read': False,
        'createdAt': datetime.utcnow(),
        'metadata': {'rejectionReason': reason},
    })

    return {"success": True, "message": f"Trainer verification rejected. Reason: {reason}"}


@router.get("/admin/subscriptions")
async def admin_get_subscriptions(admin_user: dict = Depends(require_admin)):
    """Admin: Get all subscriptions with stats."""
    all_subs = await db.subscriptions.find().sort('createdAt', -1).to_list(None)

    # Compute stats
    active = sum(1 for s in all_subs if s.get('status') == 'active')
    paused = sum(1 for s in all_subs if s.get('status') == 'paused')
    cancelled = sum(1 for s in all_subs if s.get('status') == 'cancelled')
    total_platform_rev = sum(
        (s.get('platformFeeCents', 0) * s.get('sessionsCompleted', 0))
        for s in all_subs if s.get('status') in ('active', 'paused', 'completed')
    )

    # Enrich with user names
    results = []
    for s in all_subs:
        trainee = await db.users.find_one({'_id': ObjectId(s['traineeId'])}, {'fullName': 1})
        trainer = await db.users.find_one({'_id': ObjectId(s['trainerId'])}, {'fullName': 1})
        s.pop('_id', None)
        s['traineeName'] = trainee.get('fullName', '') if trainee else ''
        s['trainerName'] = trainer.get('fullName', '') if trainer else ''
        results.append(s)

    return {
        "subscriptions": results,
        "stats": {
            "total": len(all_subs),
            "active": active,
            "paused": paused,
            "cancelled": cancelled,
            "revenue": total_platform_rev,
        }
    }


@router.post("/admin/verifications/{trainer_id}/background-check-status")
async def admin_set_background_check_status(
    trainer_id: str,
    body: dict,
    admin_user: dict = Depends(require_admin)
):
    """Admin: Set background check status to passed/pending/failed"""
    status = body.get('status', 'pending')
    if status not in ('passed', 'pending', 'failed'):
        raise HTTPException(400, "Status must be 'passed', 'pending', or 'failed'")

    # Update background check request
    await db.background_check_requests.update_one(
        {'userId': trainer_id},
        {'$set': {'status': status, 'updatedAt': datetime.utcnow(), 'reviewedBy': str(admin_user['_id'])}}
    )

    # Update trainer profile
    bg_passed = status == 'passed'
    await db.trainer_profiles.update_one(
        {'userId': trainer_id},
        {'$set': {'backgroundCheckPassed': bg_passed, 'updatedAt': datetime.utcnow()}}
    )

    return {"success": True, "status": status, "message": f"Background check marked as {status}"}


@router.post("/admin/verifications/{trainer_id}/approve-step")
async def admin_approve_verification_step(
    trainer_id: str,
    body: dict,
    admin_user: dict = Depends(require_admin)
):
    """Approve a single verification document/step"""
    step_id = body.get('stepId')
    if not step_id:
        raise HTTPException(400, "stepId is required")
    
    approval_field = f'{step_id}Approved'
    result = await db.trainer_profiles.update_one(
        {'userId': trainer_id},
        {'$set': {
            approval_field: True,
            f'{step_id}ApprovedAt': datetime.utcnow(),
            f'{step_id}ApprovedBy': str(admin_user['_id']),
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(404, "Trainer profile not found")
    
    step_names = {
        'identity': 'Government ID',
        'background': 'Background Check',
        'certification': 'Fitness Certification',
        'cpr': 'CPR/AED Certification',
        'insurance': 'Liability Insurance',
        'video': 'Intro Video',
    }
    step_name = step_names.get(step_id, step_id)
    
    await db.notifications.insert_one({
        'userId': trainer_id,
        'type': 'document_approved',
        'title': f'{step_name} Approved',
        'message': f'Your {step_name} has been reviewed and approved.',
        'read': False,
        'createdAt': datetime.utcnow(),
    })
    
    # Send push notification
    await send_push_notification(
        trainer_id,
        f'{step_name} Approved',
        f'Your {step_name} has been reviewed and approved.',
        {'type': 'step_approved', 'stepId': step_id}
    )
    
    return {"success": True, "message": f"{step_name} approved"}

@router.post("/admin/verifications/{trainer_id}/reject-step")
async def admin_reject_verification_step(
    trainer_id: str,
    body: dict,
    admin_user: dict = Depends(require_admin)
):
    """Reject a single verification document/step"""
    step_id = body.get('stepId')
    reason = body.get('reason', 'Document did not meet requirements')
    if not step_id:
        raise HTTPException(400, "stepId is required")
    
    approval_field = f'{step_id}Approved'
    result = await db.trainer_profiles.update_one(
        {'userId': trainer_id},
        {'$set': {
            approval_field: False,
            f'{step_id}RejectedAt': datetime.utcnow(),
            f'{step_id}RejectionReason': reason,
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(404, "Trainer profile not found")
    
    step_names = {
        'identity': 'Government ID',
        'background': 'Background Check',
        'certification': 'Fitness Certification',
        'cpr': 'CPR/AED Certification',
        'insurance': 'Liability Insurance',
        'video': 'Intro Video',
    }
    step_name = step_names.get(step_id, step_id)
    
    return {"success": True, "message": f"{step_name} rejected"}


@router.post("/admin/verifications/{trainer_id}/approve-all-steps")
async def admin_approve_all_steps(
    trainer_id: str,
    admin_user: dict = Depends(require_admin),
):
    """One-tap moderation: approve every submitted-but-not-yet-approved step on a
    trainer's verification packet. Returns the list of step IDs that were just
    approved. Steps that have no uploaded file are skipped (cannot be approved).
    Does NOT change the overall verificationStatus — admin still clicks the
    main Approve button to mark the trainer verified, so review remains intentional.
    """
    profile = await db.trainer_profiles.find_one({'userId': trainer_id})
    if not profile:
        raise HTTPException(404, "Trainer profile not found")

    step_definitions = [
        ('identity', 'governmentIdUploaded', profile.get('identityFileUri')),
        ('background', 'backgroundCheckPassed', profile.get('backgroundFileUri')),
        ('certification', 'fitnessCertUploaded', profile.get('certificationFileUri')),
        ('cpr', 'cprAedCertUploaded', profile.get('cprFileUri')),
        ('insurance', 'insuranceUploaded', profile.get('insuranceFileUri')),
        # iter98d (Task 9): photo step removed — profile photos go live without admin review.
        ('video', 'introVideoUploaded', profile.get('introVideoUrl') or profile.get('videoFileUri')),
    ]

    now = datetime.utcnow()
    admin_id = str(admin_user['_id'])
    set_fields: dict = {}
    approved_step_ids: list = []
    skipped: list = []

    for step_id, uploaded_field, url in step_definitions:
        is_uploaded = bool(profile.get(uploaded_field))
        already_approved = bool(profile.get(f'{step_id}Approved'))
        if not is_uploaded or already_approved:
            continue
        if not url:
            skipped.append({'stepId': step_id, 'reason': 'No file uploaded'})
            continue
        set_fields[f'{step_id}Approved'] = True
        set_fields[f'{step_id}ApprovedAt'] = now
        set_fields[f'{step_id}ApprovedBy'] = admin_id
        approved_step_ids.append(step_id)

    if set_fields:
        await db.trainer_profiles.update_one({'userId': trainer_id}, {'$set': set_fields})

    if approved_step_ids:
        await db.notifications.insert_one({
            'userId': trainer_id,
            'type': 'documents_approved',
            'title': f'{len(approved_step_ids)} document{"s" if len(approved_step_ids) != 1 else ""} approved',
            'message': 'Your remaining verification documents were reviewed and approved.',
            'read': False,
            'createdAt': now,
        })
        await send_push_notification(
            trainer_id,
            f'{len(approved_step_ids)} document{"s" if len(approved_step_ids) != 1 else ""} approved',
            'Your remaining verification documents were reviewed and approved.',
            {'type': 'documents_approved', 'count': len(approved_step_ids)},
        )

    return {
        'success': True,
        'approvedSteps': approved_step_ids,
        'skipped': skipped,
        'approvedCount': len(approved_step_ids),
    }


@router.post("/trainer/set-rates")
async def trainer_set_rates(
    body: dict,
    current_user: dict = Depends(get_current_user)
):
    """Set trainer's per-session rates by session type and duration"""
    user_id = str(current_user['_id'])
    
    update_data = {'updatedAt': datetime.utcnow()}
    
    # Legacy hourly rates
    if 'outdoorRateCents' in body:
        update_data['outdoorRateCents'] = int(body['outdoorRateCents'])
    if 'virtualRateCents' in body:
        update_data['virtualRateCents'] = int(body['virtualRateCents'])
    if 'inHomeRateCents' in body:
        update_data['inHomeRateCents'] = int(body['inHomeRateCents'])
    
    # Per-duration rates - Outdoor
    if 'outdoor30Cents' in body:
        update_data['outdoor30Cents'] = int(body['outdoor30Cents'])
    if 'outdoor60Cents' in body:
        update_data['outdoor60Cents'] = int(body['outdoor60Cents'])
    if 'outdoor90Cents' in body:
        update_data['outdoor90Cents'] = int(body['outdoor90Cents'])
    
    # Per-duration rates - Virtual
    if 'virtual30Cents' in body:
        update_data['virtual30Cents'] = int(body['virtual30Cents'])
    if 'virtual60Cents' in body:
        update_data['virtual60Cents'] = int(body['virtual60Cents'])
    if 'virtual90Cents' in body:
        update_data['virtual90Cents'] = int(body['virtual90Cents'])
    
    # Per-duration rates - At Home
    if 'inHome30Cents' in body:
        update_data['inHome30Cents'] = int(body['inHome30Cents'])
    if 'inHome60Cents' in body:
        update_data['inHome60Cents'] = int(body['inHome60Cents'])
    if 'inHome90Cents' in body:
        update_data['inHome90Cents'] = int(body['inHome90Cents'])
    
    # Service type toggles
    if 'offersInPerson' in body:
        update_data['offersInPerson'] = bool(body['offersInPerson'])
    if 'offersVirtual' in body:
        update_data['offersVirtual'] = bool(body['offersVirtual'])
    if 'offersInHome' in body:
        update_data['offersInHome'] = bool(body['offersInHome'])
    
    result = await db.trainer_profiles.update_one(
        {'userId': user_id},
        {'$set': update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(404, "Trainer profile not found. Complete onboarding first.")
    
    return {"success": True, "message": "Rates updated successfully"}


@router.get("/admin/trainer-payout-info/{trainer_id}")
async def admin_get_trainer_payout_info(
    trainer_id: str,
    admin_user: dict = Depends(require_admin)
):
    """Get trainer's payout information for admin to process payment"""
    payout_info = await db.trainer_payout_info.find_one({'trainerId': trainer_id})
    if not payout_info:
        return {"hasPayoutInfo": False, "payoutInfo": None}
    
    return {"hasPayoutInfo": True, "payoutInfo": serialize_doc(payout_info)}

@router.post("/admin/process-payout")
async def admin_process_payout(
    trainer_id: str,
    amount_cents: int,
    payment_method: str,
    notes: Optional[str] = None,
    admin_user: dict = Depends(require_admin)
):
    """Record a payout to trainer (manual process via CashApp/Zelle/etc)"""
    payout = {
        'trainerId': trainer_id,
        'amountCents': amount_cents,
        'paymentMethod': payment_method,
        'notes': notes,
        'processedBy': str(admin_user['_id']),
        'processedAt': datetime.utcnow(),
        'createdAt': datetime.utcnow()
    }
    
    result = await db.trainer_payouts.insert_one(payout)
    payout['id'] = str(result.inserted_id)
    
    return {"success": True, "payout": serialize_doc(payout)}


# --- Admin: Delete/Remove User ---
@router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin_user: dict = Depends(require_admin)):
    """Admin: Remove a user and all their associated data"""
    user = await db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting yourself
    if str(admin_user['_id']) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
    
    # Delete related data
    await db.trainer_profiles.delete_many({'userId': user_id})
    await db.trainee_profiles.delete_many({'userId': user_id})
    await db.sessions.delete_many({'$or': [{'traineeId': user_id}, {'trainerId': user_id}]})
    await db.ratings.delete_many({'$or': [{'traineeId': user_id}, {'trainerId': user_id}]})
    await db.trainer_achievements.delete_many({'trainerId': user_id})
    await db.trainee_achievements.delete_many({'traineeId': user_id})
    await db.blocks.delete_many({'$or': [{'blockerUserId': user_id}, {'blockedUserId': user_id}]})
    await db.reports.delete_many({'$or': [{'reporterUserId': user_id}, {'reportedUserId': user_id}]})
    await db.transactions.delete_many({'userId': user_id})
    await db.memberships.delete_many({'userId': user_id})
    await db.boosts.delete_many({'trainerId': user_id})
    await db.payout_requests.delete_many({'trainerId': user_id})
    await db.trainer_payouts.delete_many({'trainerId': user_id})
    
    # Delete conversations & messages
    convos = await db.conversations.find({'participants': user_id}).to_list(None)
    for c in convos:
        await db.messages.delete_many({'conversationId': str(c['_id'])})
    await db.conversations.delete_many({'participants': user_id})
    
    # Delete the user
    await db.users.delete_one({'_id': ObjectId(user_id)})
    
    return {"success": True, "message": f"User {user.get('fullName', '')} and all associated data removed"}


# --- Admin: Refund a Session Payment ---
class AdminRefundRequest(BaseModel):
    sessionId: str
    reason: Optional[str] = "Admin refund"

@router.post("/admin/refund")
async def admin_refund_payment(
    refund_req: AdminRefundRequest,
    admin_user: dict = Depends(require_admin)
):
    """Admin: Refund a session payment. Attempts Stripe refund if payment intent exists, otherwise records refund."""
    try:
        oid = ObjectId(refund_req.sessionId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.get('refunded'):
        raise HTTPException(status_code=400, detail="Session already refunded")
    
    amount_cents = session.get('finalSessionPriceCents', 0)
    stripe_refund_id = None
    refund_status = "completed"
    
    # Try Stripe refund if payment intent exists
    payment_intent_id = session.get('paymentIntentId')
    if payment_intent_id and not payment_intent_id.startswith('mock_'):
        try:
            refund = stripe.Refund.create(
                payment_intent=payment_intent_id,
                reason='requested_by_customer'
            )
            stripe_refund_id = refund.id
        except Exception as e:
            refund_status = "stripe_failed"
            logger.error(f"Stripe refund failed: {e}")
    
    # Update session as refunded
    await db.sessions.update_one(
        {'_id': oid},
        {'$set': {
            'refunded': True,
            'refundedAt': datetime.utcnow(),
            'refundedBy': str(admin_user['_id']),
            'refundReason': refund_req.reason,
            'refundAmountCents': amount_cents,
            'stripeRefundId': stripe_refund_id,
            'updatedAt': datetime.utcnow()
        }}
    )
    
    # Record transaction
    refund_transaction = {
        'userId': session.get('traineeId', ''),
        'sessionId': refund_req.sessionId,
        'transactionType': TransactionType.REFUND,
        'amountCents': amount_cents,
        'status': refund_status,
        'description': f"Refund: {refund_req.reason}",
        'stripeRefundId': stripe_refund_id,
        'processedBy': str(admin_user['_id']),
        'createdAt': datetime.utcnow()
    }
    await db.transactions.insert_one(refund_transaction)
    
    return {
        "success": True,
        "refundAmountCents": amount_cents,
        "stripeRefundId": stripe_refund_id,
        "status": refund_status,
        "message": f"Refund of ${amount_cents/100:.2f} processed"
    }


# --- Admin: Confirm a Payment ---
class AdminConfirmPaymentRequest(BaseModel):
    sessionId: str
    notes: Optional[str] = None

@router.post("/admin/confirm-payment")
async def admin_confirm_payment(
    req: AdminConfirmPaymentRequest,
    admin_user: dict = Depends(require_admin)
):
    """Admin: Manually confirm/mark a session payment as completed"""
    try:
        oid = ObjectId(req.sessionId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    session = await db.sessions.find_one({'_id': oid})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    amount_cents = session.get('finalSessionPriceCents', 0)
    
    await db.sessions.update_one(
        {'_id': oid},
        {'$set': {
            'paymentConfirmed': True,
            'paymentConfirmedAt': datetime.utcnow(),
            'paymentConfirmedBy': str(admin_user['_id']),
            'updatedAt': datetime.utcnow()
        }}
    )
    
    # Record transaction
    confirm_transaction = {
        'userId': session.get('traineeId', ''),
        'sessionId': req.sessionId,
        'transactionType': TransactionType.SESSION_PAYMENT,
        'amountCents': amount_cents,
        'trainerPayoutCents': session.get('trainerEarningsCents', 0),
        'platformFeeCents': session.get('platformFeeCents', 0),
        'status': PaymentStatus.COMPLETED,
        'description': f"Payment confirmed by admin. {req.notes or ''}".strip(),
        'processedBy': str(admin_user['_id']),
        'createdAt': datetime.utcnow()
    }
    await db.transactions.insert_one(confirm_transaction)
    
    return {
        "success": True,
        "amountCents": amount_cents,
        "message": f"Payment of ${amount_cents/100:.2f} confirmed"
    }


# --- Admin: Update own profile ---
class AdminProfileUpdate(BaseModel):
    fullName: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None

@router.put("/admin/profile")
async def admin_update_profile(
    profile_update: AdminProfileUpdate,
    admin_user: dict = Depends(require_admin)
):
    """Admin: Update own profile information"""
    update_data = {}
    if profile_update.fullName:
        update_data['fullName'] = profile_update.fullName
    if profile_update.phone:
        update_data['phone'] = profile_update.phone
    if profile_update.email:
        # Check email not taken by another user
        existing = await db.users.find_one({'email': profile_update.email, '_id': {'$ne': admin_user['_id']}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use by another account")
        update_data['email'] = profile_update.email
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data['updatedAt'] = datetime.utcnow()
    
    await db.users.update_one(
        {'_id': admin_user['_id']},
        {'$set': update_data}
    )
    
    updated_user = await db.users.find_one({'_id': admin_user['_id']})
    user_doc = serialize_doc(updated_user)
    user_doc.pop('passwordHash', None)
    return {
        "success": True,
        "user": user_doc,
        "message": "Profile updated successfully"
    }


# --- Admin: Get enriched transactions with user names ---
@router.get("/admin/transactions-enriched")
async def admin_get_transactions_enriched(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    session_type: Optional[str] = None,
    admin_user: dict = Depends(require_admin)
):
    """Get all sessions as transactions with user names for admin panel"""
    query = {}
    if status:
        query['status'] = status
    if session_type:
        query['sessionType'] = session_type
    sessions = await db.sessions.find(query).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)
    total = await db.sessions.count_documents(query)
    
    # Batch fetch user names
    user_ids = set()
    for s in sessions:
        if s.get('trainerId'):
            user_ids.add(s['trainerId'])
        if s.get('traineeId'):
            user_ids.add(s['traineeId'])
    
    users_map = {}
    if user_ids:
        user_obj_ids = [ObjectId(uid) for uid in user_ids if uid]
        if user_obj_ids:
            users_list = await db.users.find({'_id': {'$in': user_obj_ids}}, {'fullName': 1}).to_list(len(user_obj_ids))
            users_map = {str(u['_id']): u.get('fullName', 'Unknown') for u in users_list}
    
    enriched = []
    for s in sessions:
        doc = serialize_doc(s)
        doc['trainerName'] = users_map.get(s.get('trainerId', ''), 'Unknown')
        doc['traineeName'] = users_map.get(s.get('traineeId', ''), 'Unknown')
        enriched.append(doc)
    
    return {"transactions": enriched, "total": total, "skip": skip, "limit": limit}


# --- Admin: Send message to any user ---
class AdminMessageSend(BaseModel):
    receiverId: str
    content: str

@router.post("/admin/message")
async def admin_send_message(
    msg: AdminMessageSend,
    admin_user: dict = Depends(require_admin)
):
    """Admin: Send a message to any user via the existing chat system"""
    admin_id = str(admin_user['_id'])
    
    # Find or create conversation
    conversation = await db.conversations.find_one({
        'participants': {'$all': [admin_id, msg.receiverId]}
    })
    
    if not conversation:
        conversation_doc = {
            '_id': str(uuid.uuid4()),
            'participants': [admin_id, msg.receiverId],
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }
        await db.conversations.insert_one(conversation_doc)
        conversation = conversation_doc
    
    message_doc = {
        '_id': str(uuid.uuid4()),
        'conversationId': str(conversation['_id']),
        'senderId': admin_id,
        'receiverId': msg.receiverId,
        'content': msg.content,
        'isRead': False,
        'createdAt': datetime.utcnow()
    }
    
    await db.messages.insert_one(message_doc)
    await db.conversations.update_one(
        {'_id': conversation['_id']},
        {'$set': {'updatedAt': datetime.utcnow()}}
    )
    
    return {
        "success": True,
        "messageId": str(message_doc['_id']),
        "conversationId": str(conversation['_id']),
        "message": "Message sent successfully"
    }
