# RapidReps - Product Requirements Document

## Original Problem Statement
A full-stack fitness marketplace application (React Native/Expo frontend, FastAPI backend, MongoDB) connecting trainees with personal trainers.

## Core Architecture
- **Frontend:** React Native / Expo Router
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Payments:** Stripe (Payment Sheet + Connect Express)
- **Notifications:** expo-server-sdk-python (push)

## Implementation Status

### All Phases Complete

**Phase 1: Matching & Virtual Accept** - COMPLETE
- ETA-weighted composite scoring (distance 40%, rating 20%, sessions 15%, price 10%, boost 10%, responsiveness 5%)
- `/api/trainers/ranked-search` returns trainers sorted by compositeScore
- 10-second accept timer for virtual sessions

**Phase 2: Instant Workout Mode** - COMPLETE
- Cascading polling-based matching at `/api/sessions/instant-match`
- Accept/decline/cancel flows with status polling
- Frontend screen at `/trainee/instant-match`

**Phase 3: Trainer Tools** - COMPLETE
- CRUD for workout plans, session notes, client progress
- Backend: `/api/trainer-tools/*` endpoints
- Frontend: `/trainer/trainer-tools` with tabs (clients/plans/notes)

**Phase 4: Group Workouts** - COMPLETE
- Create/join/leave/start/complete group sessions
- Backend: `/api/group-sessions/*` endpoints
- Frontend screens for both trainee and trainer

**Phase 5: Community Feed & User Progress** - COMPLETE
- Feed with auto-generated posts (session complete, badge unlock, streak milestone)
- User-created posts, likes system
- Progress tracking with streak levels, calorie estimates, consistency scores
- Backend: `/api/feed/*` and `/api/progress/*`
- Frontend: `/trainee/feed` and `/trainee/user-progress`

### UI/UX Updates (March 7, 2026)
- Global teal→navy blue (#1a2a5e/#2a3a6e) across 40+ files
- Admin: 80/20 revenue split, change password, cancellation policy card
- Trainer Detail: Removed Per Min column, added heart/favorite button
- Quick Book: Improved accessibility
- Share Status: "Train Safely" banner visibility improved
- Home Address: Added zip code field, brightened inputs
- Recurring Sessions: Multi-day selection, bulk payment pricing
- Safety Center screen, Report Issue screen
- Share Profile button on trainer profile
- Safety section on trainee home

### Deployment Fix (March 7, 2026)
- Fixed critical syntax error in `frontend/app/trainer/verification.tsx` (Modal outside root JSX element)
- Wrapped return JSX in React Fragment (`<>...</>`) to support sibling elements (ImageBackground + Modal)
- TypeScript and Metro bundler compile successfully

## Remaining Backlog
- P3: SendGrid Integration (awaiting API key)
- P4: TypeScript strict-mode warnings (86+)

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
