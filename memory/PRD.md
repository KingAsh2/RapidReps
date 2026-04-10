# RapidReps PRD

## Original Problem Statement
RapidReps fitness app (React Native/Expo + FastAPI). Full-featured fitness marketplace connecting trainers with trainees for in-person and virtual sessions. Recent focus: CapCut/IG aesthetic polish with bold typography, cinematic animations, personality tags, and code architecture refactoring.

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
10. **Personality Tags** (INTENSE, CHILL, BEAST MODE, ZEN, HIGH ENERGY, NO EXCUSES, PATIENT, COMPETITIVE) for both Trainer & Trainee profiles with descriptions
11. CapCut/IG aesthetic: Oswald bold typography, cinematic animations, premium dark theme

## What's Been Implemented

### Phase 1 - Core App (Previous Forks)
- Full auth system (JWT-based)
- Trainer & Trainee profiles with CRUD
- Session booking & management
- Stripe payment integration
- Rating & review system
- Streak tracking with fire animations
- Leaderboard & referral system
- Premium dark theme with 40+ visibility fixes

### Phase 2 - Trainer Personality (Previous Fork)
- Apple Music Vibe integration (iTunes Search API proxy)
- Highlight Reel upload
- TrainerVibePlayer, HighlightReel components
- Cinematic hero section on trainer-detail
- 508 compliance (partial)
- Oswald font installed and started

### Phase 3 - CapCut/IG Polish + Refactor (This Fork - Apr 10 2026)
- **Personality Tag System**: Full CRUD for both Trainer & Trainee profiles with 8 tags, badge component, selector modal
- **Oswald Typography Applied**: TrainerCard, trainer-detail hero (stats, sections, pricing), trainer profile (name, stats, sections, streak), trainee profile (name, stats, sections, streak)
- **Cinematic Page Transitions**: Enhanced trainer-detail with dramatic zoom (1.2x→1.0), parallax scroll on hero image, name scale animation (0.85→1.0 spring), tighter stagger timing
- **Backend Modularization**: Extracted Pydantic models to `models.py` (600 lines), shared dependencies to `deps.py` (325 lines). server.py reduced from ~10K to ~8.9K lines. All routes/__init__.py updated for backward compatibility.

## Architecture
```
/app
├── frontend/ (React Native/Expo)
│   ├── app/
│   │   ├── _layout.tsx (Oswald + SpaceMono fonts)
│   │   ├── trainee/
│   │   │   ├── (tabs)/profile.tsx (Personality tag + Oswald)
│   │   │   ├── (tabs)/home.tsx (TrainerCard with tags)
│   │   │   └── trainer-detail.tsx (Cinematic hero + parallax + personality tag)
│   │   └── trainer/
│   │       ├── (tabs)/profile.tsx (Personality tag + Oswald)
│   │       ├── vibe-setup.tsx
│   │       └── highlight-upload.tsx
│   └── src/components/
│       ├── PersonalityTagBadge.tsx (Badge + Selector modal)
│       ├── TrainerVibePlayer.tsx
│       ├── HighlightReel.tsx
│       └── trainee-home/TrainerCard.tsx (Personality tag badge)
└── backend/
    ├── models.py (All Pydantic models & constants - 600 lines)
    ├── deps.py (Shared deps: db, auth, helpers, push - 325 lines)
    ├── server.py (~8.9K lines, down from ~10K)
    └── routes/
        ├── __init__.py (Re-exports from deps.py)
        ├── feed.py, matching.py, progress.py, etc.
```

## Key API Endpoints
- POST /api/auth/login, /api/auth/register, /api/auth/signup
- GET/PUT /api/trainer-profiles/{userId}
- GET/PUT /api/trainee-profiles/{userId}
- PUT /api/trainer-profiles/{userId}/personality-tag
- PUT /api/trainee-profiles/{userId}/personality-tag
- PUT /api/trainer-profiles/{userId}/vibe
- POST /api/trainer-profiles/{userId}/highlights
- GET /api/music/search (iTunes proxy)
- POST /api/sessions/book
- GET /api/admin/earnings-summary

## DB Schema
- trainer_profiles: + personalityTag (string), vibeTrackTitle, vibeArtistName, etc.
- trainee_profiles: + personalityTag (string)

## Prioritized Backlog

### P1 (Next Up)
- Continue server.py route extraction (extract auth, admin, sessions into separate route files)

### P2
- Full 508 accessibility compliance (remaining interactive elements)
- SendGrid email integration (requires user API key)

### P3
- Trainer accent color system (brand color tinting cards)
- EAS iOS Build fix (BLOCKED - user must run `eas credentials`)

## 3rd Party Integrations
- iTunes Search API (free, proxied via backend)
- Stripe (payments)
- Emergent Object Storage (file uploads)
- Google Maps (requires user API key)
- SendGrid (requires user API key)
- @expo-google-fonts/oswald (display typography)

## Test Reports
- Iteration 58-61: All passed 100% (visibility, vibe APIs, highlights, 508 audit)
- Iteration 62: 20/20 personality tag CRUD tests passed 100%
- Iteration 63: 18/18 backend refactoring regression tests passed 100%
