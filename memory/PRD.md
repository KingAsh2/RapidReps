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

## Latest Updates (December 2025)

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

### Deployment Bug Fixed - expo-barcode-scanner Removal
- **Issue:** iOS build failed with error: `'ExpoModulesCore/EXBarcodeScannerInterface.h' file not found`
- **Root Cause:** `expo-barcode-scanner` package is deprecated and incompatible with Expo SDK 54. The native code references removed interfaces from ExpoModulesCore.
- **Fix:** Removed `expo-barcode-scanner` from package.json dependencies. The app already uses `expo-camera`'s built-in `CameraView` with `barcodeScannerSettings` for QR code scanning (in `verify-trainer.tsx`).

### Previous Fix - Missing Image Asset
- **Issue:** Build failed due to missing image asset `gym-bg.jpg` in `frontend/app/trainer/badge.tsx`
- **Fix:** Replaced with existing assets (`bg-gym-blue.png` for background, `icon.png` for badge logo)

## Prioritized Backlog
- **P4:** SendGrid Integration (blocked - awaiting API key)
- **P5:** TypeScript strict-mode warnings cleanup (86+ warnings)

## Credentials
- Admin: admin@rapidreps.com / admin123

## Mocked: SendGrid (awaiting API key)
