# RapidReps PRD

## Original Problem Statement
RapidReps fitness app (React Native/Expo + FastAPI). Full-featured fitness marketplace connecting trainers with trainees for in-person and virtual sessions. Recent focus: CapCut/IG aesthetic polish with bold typography, cinematic animations, personality tags, accent colors, and code architecture refactoring.

## User Personas
- **Trainees**: People looking for personal trainers, can book sessions, rate trainers, track streaks
- **Trainers**: Fitness professionals offering services, managing bookings, showcasing personality
- **Admins**: Platform managers overseeing operations

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
10. Personality Tags (INTENSE, CHILL, BEAST MODE, ZEN, HIGH ENERGY, NO EXCUSES, PATIENT, COMPETITIVE)
11. **Trainer Accent Color** (10 preset brand colors that tint card glows, hero sections, CTAs)
12. CapCut/IG aesthetic: Oswald bold typography, cinematic animations, premium dark theme

## What's Been Implemented

### Phase 1 - Core App (Previous Forks)
- Full auth system (JWT-based), profiles CRUD, session booking, Stripe payments
- Rating/review system, streak tracking, leaderboard, referral system
- Premium dark theme with 40+ visibility fixes

### Phase 2 - Trainer Personality (Previous Fork)
- Apple Music Vibe integration, Highlight Reel, TrainerVibePlayer
- Cinematic hero section, partial 508 compliance, Oswald font installed

### Phase 3 - CapCut/IG Polish + Refactor (Apr 10 2026)
- Personality Tag System (CRUD + badge + selector for both profiles)
- Oswald Typography across all key screens
- Cinematic page transitions (parallax, zoom, scale-spring)
- Backend modularization: models.py + deps.py extracted from server.py

### Phase 4 - Trainer Accent Color (Apr 10 2026)
- **Backend**: `PUT /api/trainer-profiles/{userId}/accent-color` with 10 validated colors
- **Frontend**: `AccentColorPicker` modal with live preview, color grid
- **TrainerCard**: Dynamic shimmer, top accent line, CTA gradient using accent color
- **trainer-detail**: Hero glow, verified icon, CTA buttons, booking section all use accent color
- **Trainer Profile**: Brand Color CTA with swatch preview + picker modal

## Architecture
```
/app
├── frontend/ (React Native/Expo)
│   ├── app/
│   │   ├── trainee/trainer-detail.tsx (Dynamic accent color throughout)
│   │   ├── trainer/(tabs)/profile.tsx (AccentColorPicker + PersonalityTag)
│   │   └── trainee/(tabs)/profile.tsx (PersonalityTag)
│   └── src/components/
│       ├── AccentColorPicker.tsx (NEW - Color grid + preview modal)
│       ├── PersonalityTagBadge.tsx (Badge + Selector)
│       ├── TrainerVibePlayer.tsx
│       ├── HighlightReel.tsx
│       └── trainee-home/TrainerCard.tsx (Dynamic accent color)
└── backend/
    ├── models.py (Pydantic models + constants - 603 lines)
    ├── deps.py (Shared deps: db, auth, helpers - 325 lines)
    ├── server.py (~8.9K lines)
    └── routes/
```

## Key API Endpoints
- PUT /api/trainer-profiles/{userId}/accent-color (NEW)
- PUT /api/trainer-profiles/{userId}/personality-tag
- PUT /api/trainee-profiles/{userId}/personality-tag
- PUT /api/trainer-profiles/{userId}/vibe
- POST /api/trainer-profiles/{userId}/highlights
- GET /api/music/search (iTunes proxy)
- Standard auth, session, payment, admin endpoints

## Prioritized Backlog

### P1
- Continue server.py route extraction (auth, admin, sessions into separate files)

### P2
- Full 508 accessibility compliance
- SendGrid email integration (requires user API key)

### P3
- EAS iOS Build fix (BLOCKED - user must run `eas credentials`)

## Test Reports
- Iterations 58-61: All passed 100%
- Iteration 62: 20/20 personality tag CRUD passed
- Iteration 63: 18/18 backend refactoring regression passed
- Iteration 64: 19/19 accent color CRUD + regression passed
