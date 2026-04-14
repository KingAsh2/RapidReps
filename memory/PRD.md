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
13. **Admin Video Playback Broken**: `handlePlayVideo` was passing relative URL (`/api/files/...`) to Video component. Now prepends full `EXPO_PUBLIC_BACKEND_URL` like the document viewer does
14. **Admin Verification Text Invisible**: All light-background sections (`#F8FAFC`, `#FFF8E8`, `#FFF5F5`) in the verification modal replaced with dark-theme-consistent backgrounds using `rgba()` overlays. All text changed from `#333` to `#FFFFFF` for proper contrast on dark `#141929` modal
15. **Verification Doc Labels Invisible**: Step label `color: '#333'` → `#FFFFFF` on dark modal background
16. **Vibe Save Silent Failure**: Backend `update_one` matched 0 docs if profile didn't exist → now uses upsert (creates profile with vibe data if missing) + checks `matched_count`
17. **Vibe Auto-Play on Profile Open**: `TrainerVibePlayer` now re-fetches fresh preview URL from iTunes `/api/music/lookup` before auto-playing (iTunes preview URLs expire). Added 300ms delay for state to settle
18. **Music Lookup Endpoint**: Added `GET /api/music/lookup?trackId=X` to fetch fresh preview URLs from iTunes by trackId

## Social Login Integration (Apr 11, 2026)
19. **Apple Sign-In**: Native iOS via `expo-apple-authentication` — verifies identity token against Apple's public keys, creates/finds user, returns JWT
20. **Google Sign-In (Emergent Auth)**: Uses `expo-web-browser` to open Emergent OAuth flow → exchanges session_id for user data via Emergent API → creates/finds user, returns JWT
21. **Facebook Login (Scaffolded)**: UI ready, backend returns "coming soon" without `FACEBOOK_APP_ID` env var. When provided, verifies token with Facebook Graph API
22. **SocialAuthButtons Component**: Reusable React Native component with Apple (black), Google (white), Facebook (blue) buttons, loading states, and error handling
23. **Social Onboarding Flow**: New social users → redirected to signup with name/email pre-filled, password fields hidden, just pick role + add phone → full onboarding flow continues
24. **Backend Social Auth**: `social_auth_routes.py` with `find_or_create_social_user()` helper — links social providers to existing accounts by email, upserts new accounts without password
25. **Updated UserSignUp Model**: `password` now Optional, `isSocialAuth` flag added — signup endpoint handles passwordless social users gracefully

## Deployment Fix (Apr 11, 2026)
26. **iOS Build Failure — Apple Sign-In Entitlement**: `expo-apple-authentication` auto-injected `com.apple.developer.applesignin` entitlement which provisioning profile doesn't support. Fixed by removing the native package and switching to web-based Apple Sign-In via `expo-web-browser` (Apple's OAuth web flow). No native entitlement required.
27. **Dual Lock File Warning**: Removed `package-lock.json` (build warned about yarn.lock + package-lock.json conflict)

## UI Updates (Apr 11, 2026 — Session 2)
28. **Rapid Reps Header Logo**: Added user-provided stylized "Rapid Reps" text logo (`rapidreps-header.png`) at the very top of main page (`index.tsx`) and login page (`login.tsx`) with shimmer glow animation effect
29. **RR Dumbbell Icon Logo**: Replaced old logo with user-provided RR dumbbell icon (`rapidreps-icon-logo.png`), now fills entire circular frame using `resizeMode="cover"` with exact borderRadius matching. Pulsing heartbeat animation preserved
30. **Social Auth Buttons Redesign**: Converted from large vertical pill buttons with text to small 48px circular icons arranged horizontally (Facebook, Google, Apple), no "Continue with..." text — cleaner, less intrusive UI
31. **Cinematic Entrance Animation**: Header logo slides down from top first (500ms spring), then RR icon scales up from 0.3x to 1x from center with a dramatic spring bounce
32. **Strict Logo Sizing (User Spec)**: Header = 90% screen width (auto height, max 120px, 10px top spacing). Circle = 65% screen width (perfect circle). Logo inside circle = 108% of circle diameter with `resizeMode="cover"` and `overflow: hidden` — no padding, no empty space. 20px gap between header and circle. Applied identically to index.tsx, login.tsx, signup.tsx

## Known Issues
- EAS iOS Build Failure (BLOCKED - user must regenerate Apple Distribution Certificate)
- SendGrid Email Integration (BLOCKED - needs user API key)
- Facebook App ID missing (BLOCKED - needs user to provide App ID)
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
