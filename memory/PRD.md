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
32. **Strict Logo Sizing (User Spec)**: Header = 130% screen width (no height cap). Circle = 65% screen width. Logo inside = 130% circle diameter. Gray backing removed (transparent). Overlay opacity 0.95-0.97 to hide background logo. Applied to all 3 screens
33. **Explosive Fitness Entrance Animations**: Full premium explosive animation system on all 3 screens:
    - Header SLAMS down from -250px with rotation correction (-12deg to 0)
    - Gold impact FLASH burst (0.45 opacity, 80ms)
    - Logo EXPLODES from scale 0 with 360deg spin + overshoot spring
    - Pulsing gold energy ring behind logo (continuous)
    - Staggered content cascade (tagline, props, buttons slide up 120ms apart)
    - Heartbeat pulse + header shimmer (continuous loops)
    - Boxing bell impact sound on home screen entrance (expo-av Audio)
    - Plays every time app opens (not just first visit)

## Known Issues
- EAS iOS Build Failure (BLOCKED - user must regenerate Apple Distribution Certificate)
- SendGrid Email Integration (BLOCKED - needs user API key)
- Facebook App ID missing (BLOCKED - needs user to provide App ID)
- 508 Accessibility Compliance (IN PROGRESS - incremental)

## Bug Fixes (Apr 17, 2026)
34. **Invalid Token on Highlight Uploads / Vibe Saves (P0)**: `AuthContext.tsx` was not exporting `token` in its context. Both `highlight-upload.tsx` and `vibe-setup.tsx` destructured `{ user, token }` from `useAuth()`, but `token` was always `undefined`. Fixed by adding `token: string | null` to the AuthContextType interface, adding a `[token, setToken]` state, and populating it on login/signup/socialLogin/loadUser, clearing on logout.
35. **Admin Panel Document URLs Invalid (P0)**: Verification documents were stored as local device URIs (file://...) which are inaccessible from the admin panel. Added `POST /api/trainer/upload-verification-file` and `POST /api/trainer/upload-verification-file-base64` endpoints to upload files to object storage. Updated `verification.tsx` to upload files to storage before submitting steps. Admin panel now also shows a warning for legacy local URIs.
36. **Background Check Form Validations (P1)**: Added SSN validation (exactly 9 digits), DOB validation (MM/DD/YYYY format with auto-formatting), Address validation (alphanumeric + standard punctuation). Replaced submit button with "Hold to Submit" orange pressable button (2-second hold with progress animation).
37. **Admin Background Check Status Controls (P1)**: Added `POST /api/admin/verifications/{trainer_id}/background-check-status` endpoint. Admin panel now shows Passed/Pending/Failed toggle buttons in the background check info section.
38. **Unverified Trainers Visibility (P1)**: Added `GET /api/admin/verifications/unverified` endpoint that finds trainers with the trainer role but no verification status. Added "Unverified" tab to admin panel VerificationsTab with trainer list and join dates.
39. **Selection Highlights Orange (P1)**: Changed trainee onboarding selection chip colors from dark (#0A0E1A) to branded orange (#FF7F00) for experience levels, training styles, and training mode selections.
40. **Profile Photo Synchronization (P1)**: Backend now syncs profile photos across all collections when updated. `create_trainer_profile`, `create_trainee_profile`, and `submit_verification_step` (photo step) all now update `users.profilePhoto` in addition to the profile-specific fields. The `get_trainer_profile` endpoint already falls back from `users.profilePhoto` to `trainer_profiles.avatarUrl`.

## New Features (Apr 18, 2026)
41. **Subscription Tiers**: Custom plans where trainee picks 1-7 sessions/week. Trainer sets their rate, platform takes 20%. Full lifecycle: create, accept, decline, pause, resume, cancel. Auto-scheduling picks available slots for next week based on preferred days/times. If conflicts, system finds next available.
42. **Live GPS Check-in**: Both parties check in with GPS at session location. Haversine distance calculation. Trainer sets radius (1-35 miles). No-show handling: trainer decides to cancel, wait, or proceed. Push notifications on check-in/warning.
43. **Frontend: Subscription Management Screen** (`/app/frontend/app/subscriptions.tsx`): Full subscription list with status badges, pricing breakdown, action buttons (accept/decline/pause/resume/cancel), and create modal with day/time pickers.
44. **Frontend: GPS Check-in Card** (`/app/frontend/app/trainer/gps-checkin.tsx`): Reusable component showing check-in status for both parties, GPS check-in button with location permission, distance result display, and trainer no-show action buttons.
45. **Admin: Subscriptions Tab** (`/app/frontend/src/components/admin/SubscriptionsTab.tsx`): Admin panel tab showing all subscriptions with stats (total/active/paused/cancelled/revenue), status filters, and detailed list with trainee→trainer names, rates, and platform fees. Backend: `GET /api/admin/subscriptions`.

## Upcoming Tasks
- Profile Photo Synchronization across Home/Edit/Verification screens (P1)
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
