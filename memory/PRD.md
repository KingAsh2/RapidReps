# RapidReps - Fitness Training App

## Original Problem Statement
A full-stack React Native/Expo fitness application connecting trainees with personal trainers. Includes session booking, payments via Stripe, messaging, trainer verification, group sessions, streaks/gamification, and a mandatory in-person session verification system.

## Tech Stack
- **Frontend:** React Native / Expo with Expo Router
- **Backend:** FastAPI (Python) + MongoDB
- **Payments:** Stripe | **Auth:** JWT | **QR Codes:** react-native-qrcode-svg + expo-camera

## What's Been Implemented

### Rapid Reps Safety Check System (March 2026)
- **Backend:** 12 API endpoints under `/api/safety-check/*` — QR token generation (SHA-256, 5-min expiry), verification with 6-point validation, session timer, blocking logic, admin tracking with override
- **Trainer Badge Screen:** Professional digital ID badge with dynamic QR code, auto-refresh countdown, session details, verification badges
- **Client Verification:** Camera QR scanner, branded success screen ("Rapid Reps Safety Check Complete"), failure screen with retry
- **Admin Safety Dashboard:** 4 views — Active Sessions (live timers), Verification Log, Safety Events, Duration Tracking. Includes admin override modal
- **Session Countdown Timer:** Real-time countdown based on purchased session duration (30/45/60 min). Shows on both trainer and trainee session cards for in-progress sessions. Progress bar with green→warning→red color states. Pulse animation under 5 minutes

### UI/UX Alignment (March 2026)
- All trainer screens unified to orange gradient background matching trainee design
- Updated 10+ files: sessions, profile, earnings tabs + sub-screens (connect-bank, en-route, group-sessions, set-rates, trainer-tools)

### Previous Implementations
- Full trainer/trainee flows, Stripe Connect, trainer verification with PII, group sessions
- Streaks & gamification, referral system, 508 accessibility compliance
- Animations & haptic feedback, login screen redesign

## Key API Endpoints
| Endpoint | Description |
|----------|-------------|
| POST /api/safety-check/generate-token/{id} | Generate QR token |
| POST /api/safety-check/verify | Verify QR (client scans) |
| GET /api/safety-check/badge/{id} | Get badge data |
| GET /api/safety-check/active-session | Trainer's active session |
| GET /api/safety-check/timer/{id} | Timer status + remainingSeconds |
| POST /api/safety-check/timer/{id}/complete | Complete session |
| GET /api/safety-check/can-start/{id} | Check verification requirement |
| GET /api/safety-check/admin/active-sessions | Live monitoring |
| GET /api/safety-check/admin/verification-log | Scan history |
| GET /api/safety-check/admin/safety-events | Failed scans/overrides |
| GET /api/safety-check/admin/duration-tracking | Booked vs actual |
| POST /api/safety-check/admin/override | Manual verification |

## Latest Updates (March 2026)

### P1 Features Completed (March 2026)
1. **Admin Verification Details Enhancement:** Admin panel now displays full trainer profile info (bio, experience years, certifications, training styles, location) when reviewing verification requests
2. **Intro Video Playback (15s Limit):** Video player in admin panel auto-stops after 15 seconds with both timer and playback status monitoring
3. **Saved Trainers Backend API:** New `/api/trainee/saved-trainers` endpoint returns full trainer details for favorited trainers
4. **Smart Back Navigation:** Created `goBack()` utility with role-based fallbacks for edge cases (deep links, empty history)
5. **30/60/90 Min Pricing:** Correctly implemented as frontend calculation from backend hourly rates (design-intended)

### Sentry Crash Reporting Integration (December 2025)
- **Package:** `@sentry/react-native@7.2.0` installed (downgraded from 8.4.0 for Expo SDK 54 compatibility)
- **DSN:** Configured in `app/_layout.tsx` 
- **Organization:** rapidreps
- **Project:** rapidreps
- **Features enabled:**
  - `enableNative: true` - Captures native-level crashes
  - `enableNativeCrashHandling: true` - Catches force closes before JS loads
  - `enableAutoSessionTracking: true` - Tracks user sessions
  - `attachStacktrace: true` - Full stack traces on all events
  - Environment tagging (development/production)
- **Files modified:**
  - `metro.config.js` - Reverted to standard Expo config (Sentry metro wrapper caused bundling error)
  - `app.json` - Added `@sentry/react-native/expo` plugin, version bumped to 2.0.39
  - `app/_layout.tsx` - Sentry.init() at app startup, Sentry.wrap() on root component
  - `eas.json` - Added SENTRY_AUTH_TOKEN + SENTRY_ALLOW_FAILURE=true to all build profiles
  - `.env` - Added SENTRY_AUTH_TOKEN
- **IMPORTANT FIX:** Removed Sentry metro wrapper (`withSentryConfig`/`getSentryExpoConfig`) which caused "TypeError: Cannot read properties of undefined (reading 'match')" during EAS Update bundling. The Expo plugin in app.json handles source maps during EAS builds.
- **EAS BUILD FIX (Feb 2026):** Added `SENTRY_ALLOW_FAILURE=true` to all build profiles in eas.json. This prevents sentry-cli source map upload failures (400 Bad Request) from blocking the entire build. Root cause: likely incorrect org/project slug — user should verify credentials in Sentry dashboard.
- **Status:** Implementation complete - Awaiting user re-deploy to verify build succeeds

### iOS Build Fixes (March 2026)
1. **Removed `package-lock.json`** - Multiple lock files caused EAS Build issues
2. **Fixed duplicate style property** in `app/trainee/(tabs)/home.tsx` - Removed duplicate `proximityValue` definition
3. **Added `expo-camera` plugin to `app.json`** - Required for QR code scanning
4. **Completely removed `@stripe/stripe-react-native` native SDK** - This was the root cause of the Apple Pay entitlement mismatch. The fix required:
   - Removing all `require('@stripe/stripe-react-native')` dynamic imports from 4 files:
     - `app/_layout.tsx` - StripeProvider wrapper removed
     - `app/trainee/confirm-booking.tsx` - useStripe hook removed
     - `app/trainee/membership.tsx` - useStripe hook removed  
     - `app/trainer/boosts.tsx` - useStripe hook removed
   - Removing the Metro config Stripe web shim (`src/shims/stripe-web.js`)
   - Updating payment flows to work without native payment sheet (backend payment intents still work)
5. **Fixed NotificationContext race condition crash** - Major rewrite to fix intermittent crash after login:
   - Removed invalid `token` reference from `useAuth()` hook
   - Added 500ms initialization delay to allow navigation to settle
   - Added `isMounted` ref to prevent state updates on unmounted components
   - Changed context default from `undefined` to safe default values
   - Added `isReady` flag for consumers to check initialization status
   - Wrapped all async operations in `Promise.allSettled()` for error isolation
6. **Fixed "TypeError: undefined is not a function" crash** - Removed redundant `|| {}` fallbacks from hook destructuring that were overriding context safe defaults
7. **Fixed context hooks to never throw:**
   - `useAuth()` - Returns safe defaults if context unavailable
   - `useAlert()` - Returns no-op implementation if context unavailable
   - `useNotifications()` - Already fixed earlier
8. **Fixed deployment blockers:**
   - Cleaned `.gitignore` - Removed malformed lines 80-111 with `-e` flags and `*.env` patterns
   - Fixed `EXPO_TUNNEL_SUBDOMAIN=rapidreps-preview
9. **UI Fixes:**
   - Renamed "Pricing & Sessions" → "Session Durations" in trainer onboarding
   - Added 90 min option to session durations: `[30, 45, 60, 90]`
   - Changed Streak Share screen background from navy to orange gradient
   - Changed Virtual Live Session screen background from navy to orange gradient
   - Changed Group Workouts screen background from navy to orange gradient
   - Made map edge-to-edge with `marginHorizontal: -20`
   - Added null check for verification documents in admin panel
10. **ErrorBoundary Enhancement:** Now shows actual error message in production (not just DEV mode)
11. **Version: 2.0.36**
12. **expo-doctor: 17/17 checks passed**

**Note:** Payments currently create backend payment intents but don't present native payment UI. Future enhancement: Implement Stripe Checkout redirect or Stripe.js web-based payments.

### Feature Updates (March 2026)
1. **Saved Trainers Backend API:** Added `/api/trainee/saved-trainers` endpoint to fetch full trainer details for saved/favorited trainers
2. **Saved Trainers Screen:** Updated to fetch real data from backend and allow removing trainers from favorites
3. **Smart Back Navigation:** Created `goBack()` utility function that handles edge cases (deep links, empty history) with appropriate fallbacks

### Background Image Updates
Applied 8 new fitness-themed background images across multiple screens:
- Edit Profile: bg-box-jumps-orange.jpg
- Set Rates: bg-plank-ropes.png
- Trainer Tools: bg-boxing.png
- Group Sessions: bg-group-gym.png
- Connect Bank: bg-swimming.png
- Change Password: bg-cardio-gym.png
- Referral: bg-box-jumps-wide.png
- Leaderboard: bg-group-gym.png
- Notifications: bg-swimming.png
- User Progress: bg-box-jumps-orange.jpg
- Community Feed: bg-plank-ropes.png
- Instant Match: bg-jump-rope.jpg
- Earnings: bg-jump-rope.jpg
- Terms of Service: bg-cardio-gym.png

### Feature Updates Implemented
1. **Chat header profile photo:** Added profile photo display in messaging header
2. **"Need a Trainer Now" banner:** Removed pricing text ($18/30-min), now shows "Get matched instantly"
3. **Set Rates 30/60/90 pricing:** Added duration breakdown showing calculated prices for 30, 60, and 90 minute sessions
4. **Travel Proximity slider:** Converted dropdown list to interactive range slider (1-35 miles) on trainee home
5. **Saved Trainers compact view:** Converted to 4-column thumbnail grid with profile pic, name, rating
6. **Nearby Trainees compact view:** Converted to 4-column thumbnail grid (up to 8 trainees visible)
7. **Map edge-to-edge:** Made map component full-width (0 horizontal margin) and taller (320px)
8. **Travel Radius slider (Trainer):** Converted trainer's travel radius dropdown to slider on Edit Profile
9. **Admin Panel Approved Trainers:** Added toggle to view approved trainers with documents access
10. **Backend endpoint:** Added /admin/verifications/approved endpoint for approved trainers list
11. **ID Scan Animation:** Added scanning overlay animation when trainer submits ID for verification

### Testing Status (Iteration 42)
- **Backend API Tests:** 24/24 PASSED (100%)
- **Frontend Code Review:** All 13 features VERIFIED implemented
- **Test Report:** /app/test_reports/iteration_42.json

### Deployment Bug Fixed - expo-barcode-scanner Removal
- **Issue:** iOS build failed with error: `'ExpoModulesCore/EXBarcodeScannerInterface.h' file not found`
- **Root Cause:** `expo-barcode-scanner` package is deprecated and incompatible with Expo SDK 54. The native code references removed interfaces from ExpoModulesCore.
- **Fix:** Removed `expo-barcode-scanner` from package.json dependencies. The app already uses `expo-camera`'s built-in `CameraView` with `barcodeScannerSettings` for QR code scanning (in `verify-trainer.tsx`).

### Previous Fix - Missing Image Asset
- **Issue:** Build failed due to missing image asset `gym-bg.jpg` in `frontend/app/trainer/badge.tsx`
- **Fix:** Replaced with existing assets (`bg-gym-blue.png` for background, `icon.png` for badge logo)

## Prioritized Backlog
- **P0:** Diagnose crash from Sentry reports (waiting on user to rebuild and reproduce)
- **P1:** User verification of Saved Trainers, Back Navigation, Admin Verification UI
- **P2:** SendGrid Integration (blocked - awaiting API key)
- **P3:** TypeScript strict-mode warnings cleanup (86+ warnings)

## Credentials
- Admin: admin@rapidreps.com / admin123

## Mocked: SendGrid (awaiting API key)
