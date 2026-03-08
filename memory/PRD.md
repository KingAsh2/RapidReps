# RapidReps - Fitness Training App

## Original Problem Statement
A full-stack React Native/Expo fitness application connecting trainees with personal trainers. The app includes session booking, payments via Stripe, messaging, trainer verification, group sessions, streaks/gamification, and more.

## Core Requirements
1. **UI/UX Alignment:** Trainer-facing and trainee-facing screens share the same orange gradient design system
2. **508 Compliance:** Min 44x44px touch targets, sufficient color contrast, min 13px font sizes, accessibility labels
3. **Engagement:** Animations, haptic feedback, screen transitions
4. **Functional:** Stripe payments, favorites, sharing, session management, messaging
5. **Safety Check System:** QR-based trainer verification for in-person/at-home sessions with admin tracking

## Tech Stack
- **Frontend:** React Native / Expo with Expo Router
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Payments:** Stripe
- **Auth:** JWT-based
- **QR Codes:** react-native-qrcode-svg + expo-camera

## What's Been Implemented

### Rapid Reps Safety Check System (NEW - March 2026)
- **Backend Routes** (`/api/safety-check/*`): Token generation, verification, badge data, timer, blocking, admin endpoints
- **Trainer Badge Screen** (`trainer/badge.tsx`): Professional digital ID badge with QR code, auto-refresh, session details
- **Client Verification** (`trainee/verify-trainer.tsx`): QR scanner, success screen (green check animation), failure screen with retry
- **Admin Safety Tab** (`admin/SafetyTab.tsx`): Active sessions, verification log, safety events, duration tracking, override system
- **Navigation:** "My Badge" in trainer menu, "Verify Trainer" in trainee menu, "Safety" tab in admin dashboard
- **Security:** SHA-256 hashed tokens, 5-min expiry, session-tied, reuse prevention
- **Session Timer:** Locked until verification for in-person/at-home, auto-start on verification
- **Admin Tracking:** Full audit trail with override capability

### Previous Implementations
- Full trainer/trainee flows (booking, sessions, messaging, profiles)
- Stripe Connect for trainer payouts
- Trainer verification with PII collection
- Group sessions, Streaks & gamification, Referral system
- 508 accessibility compliance
- Animations & haptic feedback
- Login screen redesign (orange theme)
- UI/UX alignment (trainer matches trainee orange gradient)

## Architecture
```
/app
├── backend/
│   ├── routes/
│   │   ├── safety_check.py    # NEW: Safety Check verification system
│   │   ├── group_sessions.py
│   │   ├── matching.py
│   │   ├── feed.py
│   │   └── ...
│   └── server.py
└── frontend/
    ├── app/
    │   ├── trainee/
    │   │   ├── verify-trainer.tsx  # NEW: QR scanner + verification results
    │   │   └── (tabs)/
    │   ├── trainer/
    │   │   ├── badge.tsx           # NEW: Digital trainer badge with QR
    │   │   └── (tabs)/
    │   └── admin/
    │       └── dashboard.tsx       # Updated: Safety tab added
    └── src/
        ├── components/admin/
        │   └── SafetyTab.tsx       # NEW: Admin safety monitoring
        └── services/api.ts         # Updated: safetyCheckAPI methods
```

## Key API Endpoints (Safety Check)
- POST /api/safety-check/generate-token/{session_id} - Generate QR token
- POST /api/safety-check/verify - Verify QR token (client scans)
- GET /api/safety-check/badge/{session_id} - Get badge data
- GET /api/safety-check/active-session - Get trainer's active session
- GET /api/safety-check/timer/{session_id} - Timer status
- POST /api/safety-check/timer/{session_id}/complete - Complete session
- GET /api/safety-check/can-start/{session_id} - Check verification requirement
- GET /api/safety-check/admin/active-sessions - Live session monitoring
- GET /api/safety-check/admin/verification-log - Scan history
- GET /api/safety-check/admin/safety-events - Failed scans, overrides
- GET /api/safety-check/admin/duration-tracking - Booked vs actual
- POST /api/safety-check/admin/override - Manual verification

## DB Collections (Safety Check)
- **verification_tokens:** tokenHash, sessionId, trainerId, traineeId, expiresAt, used
- **verification_logs:** sessionId, result, reason, timestamp, action
- **admin_overrides:** sessionId, adminId, reason, timestamp
- **sessions (updated):** verificationStatus, verificationId, timerState, badgeScanned, sessionStartedAt, expectedEndAt

## Prioritized Backlog
- **P4:** SendGrid Integration (blocked - awaiting API key)
- **P5:** TypeScript strict-mode warnings cleanup (86+ warnings)

## Credentials
- Admin: admin@rapidreps.com / admin123

## Mocked Integrations
- SendGrid (awaiting API key from user)
