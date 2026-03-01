# RapidReps - Product Requirements Document

## Original Problem Statement
Build a fitness trainer-trainee matching platform with Uber-style real-time matching, virtual and in-person sessions, payments via Stripe, and comprehensive admin tools.

## Architecture
- **Frontend**: React Native / Expo with Expo Router
- **Backend**: FastAPI (Python) on port 8001
- **Database**: MongoDB
- **Payments**: Stripe integration
- **Notifications**: Expo Push SDK + Smart Notification Engine

## ALL Features Implemented

### P0 — Top Priority (COMPLETE)
1. Uber-Style Matching Engine
2. Smart Push Notification Engine
3. Virtual Live Video Screen + Boxing-Bell Sound
4. 508 Compliance

### P1 — Medium Priority (COMPLETE)
5. Advanced GPS Tracking
6. No-Show & Cancellation Automation
7. Membership System - True Benefit Stack
8. Boost System - Real Power

### P2 — Secondary (COMPLETE)
9. Session Verification — Selfie Check

### Enhancement (COMPLETE)
10. **Post-Session Summary** — Auto-generated after each completed session:
    - Duration (actual start → end)
    - Trainer name + training styles
    - Calorie estimation by workout type (HIIT=650, Strength=420, Yoga=250 cal/hr)
    - Weekly streak counter
    - Shareable deep link (rapidreps://session-summary/{id})
    - Public share card endpoint (styled data, no personal IDs)
    - Summary history with aggregate totals (totalSessions, totalCalories, totalMinutes)
    - Auto-generated when trainer ends session, also available on-demand

## Key Collections (MongoDB)
- users, trainer_profiles, trainee_profiles, sessions, virtual_requests
- notifications, notification_preferences, memberships, boosts
- session_gps_tracks, session_credits, boost_analytics
- session_selfies, session_summaries

## API Endpoints (Summary Endpoints)
- GET /api/sessions/{id}/summary (auth required)
- GET /api/sessions/summaries/my (auth required)
- GET /api/sessions/{id}/share-card (public)

## Test Credentials
- Admin: admin@rapidreps.com / admin123
- Trainers: trainer1@test.com, trainer2@test.com / test123
- Trainees: trainee1@test.com (has membership), trainee2@test.com / test123

## Testing Status
- P0: 16/16 (iteration_16)
- P1.1-P1.2: 24/24 (iteration_17)
- P1.3-P1.4: 14/14 (iteration_18)
- P2: 16/16 (iteration_19)
- Enhancement: 18/18 (iteration_20)
- **Total: 88/88 tests passing**

## Remaining Backlog
1. SendGrid email integration (awaiting API key)
2. TypeScript strict-mode warnings cleanup (86+)

## Mocked/Inactive
- SendGrid: No-op (awaiting API key)
- Stripe: Mock payment intents for testing
- Push notifications: Sends to Expo servers (no real devices)
