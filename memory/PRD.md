# RapidReps PRD

## Original Problem Statement
RapidReps fitness app (React Native/Expo + FastAPI). Full-featured fitness marketplace connecting trainers with trainees for in-person and virtual sessions.

## Core Requirements
1. User auth (signup/login/roles)
2. Trainer/Trainee profiles with gallery, social links
3. Session booking (in-person/virtual)
4. Payments via Stripe
5. Rating & review system
6. Streak tracking & achievements
7. Leaderboard & referral system
8. Apple Music "Vibe" integration (iTunes proxy)
9. Highlight Reel video uploads
10. Personality Tags (8 options with descriptions)
11. Trainer Accent Color (10 preset brand colors)
12. CapCut/IG aesthetic: Oswald bold typography, cinematic animations, premium dark theme

## Architecture
```
/app
├── frontend/ (React Native/Expo)
│   ├── app/
│   │   ├── _layout.tsx (Oswald + SpaceMono fonts)
│   │   ├── auth/login.tsx (Fiery nebula BG + new RP logo)
│   │   ├── trainee/
│   │   │   ├── (tabs)/profile.tsx (PersonalityTag + Oswald)
│   │   │   ├── (tabs)/home.tsx (TrainerCard with accent+tag)
│   │   │   └── trainer-detail.tsx (Cinematic hero + parallax + accent color)
│   │   └── trainer/
│   │       ├── (tabs)/profile.tsx (AccentColor + PersonalityTag + Oswald)
│   │       ├── vibe-setup.tsx
│   │       └── highlight-upload.tsx
│   └── src/components/
│       ├── AccentColorPicker.tsx (Color picker modal)
│       ├── PersonalityTagBadge.tsx (Badge + Selector modal)
│       ├── TrainerVibePlayer.tsx
│       ├── HighlightReel.tsx
│       └── trainee-home/TrainerCard.tsx (Dynamic accent color)
└── backend/
    ├── models.py (602 lines - All Pydantic models & constants)
    ├── deps.py (345 lines - db, auth, helpers, push, limiter, require_admin)
    ├── server.py (6,057 lines - profiles, ratings, streaks, payments, etc.)
    └── routes/
        ├── __init__.py (Re-exports from deps/models)
        ├── auth_routes.py (275 lines - signup, login, me, password reset)
        ├── session_routes.py (1,551 lines - booking, confirm, cancel, GPS, etc.)
        ├── admin_routes.py (1,154 lines - dashboard, users, verifications, payouts)
        ├── feed.py, matching.py, progress.py, etc.
```

## Key API Endpoints (by module)
**auth_routes.py**: /api/auth/signup, /api/auth/login, /api/auth/me, /api/auth/change-password, /api/auth/forgot-password, /api/auth/reset-password
**session_routes.py**: /api/sessions/book, /api/sessions/{id}/confirm, /api/sessions/{id}/cancel, /api/sessions/{id}/verify-pin, etc.
**admin_routes.py**: /api/admin/dashboard, /api/admin/users, /api/admin/top-trainers, /api/admin/earnings-summary, /api/admin/process-payout, /api/admin/refund
**server.py**: Profiles, ratings, streaks, payments, memberships, boosts, notifications, virtual sessions, misc

## Prioritized Backlog

### P2
- Full 508 accessibility compliance
- SendGrid email integration (requires user API key)
- Further server.py extraction (profiles, streaks, payments into separate files)

### P3
- EAS iOS Build fix (BLOCKED - user must run `eas credentials`)

## Test Reports
- Iterations 58-64: All passed 100%
- Iteration 65: 21/21 route extraction regression tests passed 100% (testing agent also fixed missing calculate_trainer_tier import in admin_routes.py)
