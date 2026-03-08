# RapidReps - Fitness Training App

## Original Problem Statement
A full-stack React Native/Expo fitness application connecting trainees with personal trainers. The app includes session booking, payments via Stripe, messaging, trainer verification, group sessions, streaks/gamification, and more.

## Core Requirements
1. **UI/UX Alignment:** Trainer-facing and trainee-facing screens must share the same design system (orange gradient backgrounds, white headers, consistent component styles)
2. **508 Compliance:** Min 44x44px touch targets, sufficient color contrast, min 13px font sizes, accessibility labels
3. **Engagement:** Animations, haptic feedback, screen transitions
4. **Functional:** Stripe payments, favorites, sharing, session management, messaging

## Tech Stack
- **Frontend:** React Native / Expo with Expo Router
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Payments:** Stripe
- **Auth:** JWT-based

## What's Been Implemented
- Full trainer/trainee flows (booking, sessions, messaging, profiles)
- Stripe Connect for trainer payouts
- Trainer verification with PII collection
- Group sessions
- Streaks & gamification
- Referral system
- 508 accessibility compliance
- Animations & haptic feedback
- Login screen redesign (orange theme)
- **UI/UX Alignment (COMPLETED):** All trainer screens now use the unified orange gradient background matching the trainee side

## Architecture
```
/app
├── backend/
│   ├── routes/ (users.py, reports.py, etc.)
│   └── server.py
└── frontend/
    ├── app/
    │   ├── trainee/(tabs)/ (home, sessions, profile, saved, messages)
    │   ├── trainer/(tabs)/ (home, sessions, messages, earnings, profile)
    │   └── trainer/ (sub-screens: connect-bank, set-rates, etc.)
    └── src/
        ├── contexts/ (Auth, Alert, Sound, Notification)
        └── services/api.ts
```

## Prioritized Backlog
- **P4:** SendGrid Integration (blocked - awaiting API key)
- **P5:** TypeScript strict-mode warnings cleanup (86+ warnings)

## Key API Endpoints
- POST /api/auth/login
- GET /api/auth/me
- GET /api/sessions/trainer
- GET /api/trainer/earnings
- GET /api/trainer-profiles/{userId}
- POST /api/users/toggle-favorite/{trainer_id}
- POST /api/safety/submit-pii

## Credentials
- Admin: admin@rapidreps.com / admin123

## Mocked Integrations
- SendGrid (awaiting API key from user)
