# RapidReps PRD

## Original Problem Statement
RapidReps fitness app (React Native/Expo + FastAPI). Full-featured fitness marketplace connecting trainers with trainees for in-person and virtual sessions.

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
- Full auth system (JWT-based)
- Trainer & Trainee profiles with CRUD
- Session booking & management
- Stripe payment integration
- Rating & review system
- Streak tracking with fire animations
- Leaderboard & referral system
- Apple Music Vibe integration (iTunes Search API proxy)
- Highlight Reel upload
- **Personality Tag system** (backend CRUD + frontend selector modal + badge component)
- **Oswald typography** applied to: TrainerCard, trainer-detail hero, both profile screens (names, stats, section titles, streak badges)
- Premium dark theme with 40+ visibility fixes
- 508 compliance (partial)
- Object storage for uploads

## Architecture
```
/app
├── frontend/ (React Native/Expo)
│   ├── app/
│   │   ├── _layout.tsx (Oswald + SpaceMono fonts)
│   │   ├── trainee/
│   │   │   ├── (tabs)/profile.tsx (Personality tag + Oswald)
│   │   │   ├── (tabs)/home.tsx
│   │   │   └── trainer-detail.tsx (Cinematic hero + Personality tag)
│   │   └── trainer/
│   │       ├── (tabs)/profile.tsx (Personality tag + Oswald)
│   │       ├── vibe-setup.tsx
│   │       └── highlight-upload.tsx
│   └── src/components/
│       ├── PersonalityTagBadge.tsx (NEW - Badge + Selector modal)
│       ├── TrainerVibePlayer.tsx
│       ├── HighlightReel.tsx
│       └── trainee-home/TrainerCard.tsx (Personality tag badge)
└── backend/
    └── server.py (~10K lines, needs modularization)
```

## Key API Endpoints
- POST /api/auth/login, /api/auth/register
- GET/PUT /api/trainer-profiles/{userId}
- GET/PUT /api/trainee-profiles/{userId}
- PUT /api/trainer-profiles/{userId}/personality-tag
- PUT /api/trainee-profiles/{userId}/personality-tag
- PUT /api/trainer-profiles/{userId}/vibe
- POST /api/trainer-profiles/{userId}/highlights
- GET /api/music/search (iTunes proxy)
- POST /api/sessions/book
- GET /api/admin/earnings-summary

## DB Schema Additions
- trainer_profiles: + personalityTag (string)
- trainee_profiles: + personalityTag (string)
- trainer_profiles: vibeTrackTitle, vibeArtistName, vibePreviewUrl, vibeArtworkUrl, etc.

## Prioritized Backlog

### P1
- Refactor server.py (~10K lines) into modular FastAPI routers
- Enhance cinematic page transitions (scale/zoom between card → detail)

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
- Iteration 62: All 20 personality tag CRUD tests passed 100%
