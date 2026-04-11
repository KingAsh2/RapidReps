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
├── deps.py                (Shared dependencies, auth, helpers, create_and_send_notification)
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
- Login screen revert to original design (bg-battle-ropes.png)
- New RR dumbbell logo (replaced across all 8 files, pulsing animation preserved)

## Bug Fixes (Apr 10, 2026)
1. **Trainee Profile Crash**: `traineeData` undefined in `trainee-profile.tsx` → added state + API fetch
2. **Highlight Upload Crash**: `object_storage` import missing → fixed to use `put_object`
3. **Save Button Not Working**: `homeZipCode` missing from models + dark button → added field + orange gradient
4. **Address Input Blocked**: Banner didn't trigger edit mode → added `?editAddress=true` param
5. **Vibe Save Silent Failure**: Missing `res.ok` check → added error handling

## Bug Fixes (Apr 11, 2026)
6. **Pulsating Logo Circle Too Large**: `logoBacking` padding 20→0, borderRadius 140→120, added overflow:hidden so logo fills circle
7. **Profile Save Crash (edit-profile.tsx)**: Removed references to non-existent `formData.profilePhotoUrl` and `formData.introVideoUrl` that caused `TypeError: Cannot read properties of undefined (reading 'trim')`
8. **Empty Sessions Card Invisible Text**: Changed empty state gradient from white `rgba(255,255,255,0.95)` to dark `#141929/#1A2035` so white text is visible
9. **ID Scanning Overlay Freeze**: Moved `setShowScanningOverlay(true)` to AFTER camera capture instead of before, preventing overlay from showing while camera is open and timer from firing prematurely
10. **Vibe Save Guard**: Added null check for `user?.id` and `token` before API call, plus better error messages from backend response
11. **Highlight Upload Reliability**: Added base64 photo upload path for iOS reliability, reduced quality to 0.7, better error messages
12. **Onboarding Rates Prompt**: Post-onboarding modal now shows "Set Your Rates" as primary CTA before verification

## Known Issues
- EAS iOS Build Failure (BLOCKED - user must regenerate Apple Distribution Certificate)
- SendGrid Email Integration (BLOCKED - needs user API key)
- 508 Accessibility Compliance (IN PROGRESS - incremental)

## Upcoming Tasks
- 508 Accessibility Compliance (P2)
- SendGrid Email Integration (P2, blocked on API key)
- Auto-color detection from profile photo (P3)
- Further server.py extraction: messaging, location, notifications (P3)

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
| Trainee | test_trainee_iter25@test.com | Test123! |
| Trainer | test_trainer_iter25@test.com | Test123! |
