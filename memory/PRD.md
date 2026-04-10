# RapidReps PRD

## Original Problem Statement
RapidReps is a full-stack fitness platform (React Native/Expo + FastAPI + MongoDB) connecting trainers with trainees. Features include session booking, Zelle payments, trainer verification, personality tags, accent colors, cinematic UI transitions, streaks/achievements, and admin dashboards.

## Architecture
- **Frontend**: React Native (Expo) with Oswald typography, Premium Dark Theme
- **Backend**: FastAPI with modular APIRouter architecture
- **Database**: MongoDB
- **Storage**: Emergent Object Storage

## Backend Architecture (Modularized)
```
/app/backend/
├── server.py              (~2700 lines - core: messaging, virtual sessions, location, notifications, scheduling)
├── models.py              (Pydantic models & enums)
├── deps.py                (Shared dependencies, auth, helpers)
├── storage.py             (Object storage)
├── routes/
│   ├── auth_routes.py     (Login, register, password reset)
│   ├── session_routes.py  (Session CRUD, booking flow)
│   ├── admin_routes.py    (Admin dashboard, user management)
│   ├── profile_routes.py  (Trainer/trainee profiles, gallery, vibe, personality tags, verification, highlights)
│   ├── streak_routes.py   (Achievements, badges, streaks, leaderboard)
│   ├── payment_routes.py  (Ratings, earnings, payouts, Zelle, receipts, Stripe, memberships, boosts)
│   ├── matching.py        (Trainer-trainee matching)
│   ├── feed.py            (Social feed)
│   ├── group_sessions.py  (Group sessions)
│   ├── progress.py        (Progress tracking)
│   ├── trainer_tools.py   (Trainer utilities)
│   └── safety_check.py    (Safety features)
```

## Completed Features
- Trainer/Trainee personality tag system (CRUD + UI)
- Trainer accent color system (dynamic tinting)
- Cinematic page transitions (parallax, scale, opacity)
- Oswald typography upgrade
- Backend refactoring: server.py from ~10,000 → ~2,700 lines (Phase 1 + Phase 2)
- Login screen revert to original design (bg-battle-ropes.png + rapidreps-logo.png)

## Phase 2 Route Extraction (Completed Apr 10, 2026)
- Extracted Profile routes → `profile_routes.py` (845 lines)
- Extracted Streak/Achievement routes → `streak_routes.py` (634 lines)
- Extracted Payment/Earnings routes → `payment_routes.py` (1118 lines)
- Moved `create_and_send_notification` to deps.py for cross-file access
- All 33 regression tests passed (iteration_66)

## Remaining in server.py (~2700 lines)
- Safety/Moderation routes
- Referral System routes
- Chat/Messaging routes
- Virtual session matching routes
- Location/GPS routes
- Notification routes + preferences
- Weekly digest / scheduling
- Background task scheduler

## Known Issues
- EAS iOS Build Failure (BLOCKED - user must regenerate Apple Distribution Certificate)
- SendGrid Email Integration (BLOCKED - needs user API key)
- 508 Accessibility Compliance (IN PROGRESS - incremental)

## Upcoming Tasks
- SendGrid Email Integration (P2, blocked on API key)
- Auto-color detection from profile photo (P3)
- Further server.py extraction: messaging, location, notifications (P3)

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
| Trainee | test_trainee_iter25@test.com | Test123! |
| Trainer | test_trainer_iter25@test.com | Test123! |
