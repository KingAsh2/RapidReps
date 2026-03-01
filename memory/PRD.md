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
1. Uber-Style Matching Engine — Weighted scoring, wave-based notifications, first-accept-wins, race condition prevention
2. Smart Push Notification Engine — 6 new types, progressive wave expansion, missed acceptance tracking, late warnings, no-show auto-detection
3. Virtual Live Video Screen — Scrollable, radar animation, countdown, cancel, boxing-bell sound
4. 508 Compliance — All orange text removed, text shadows, higher CTA font-weight

### P1 — Medium Priority (COMPLETE)
5. Advanced GPS Tracking — Real-time tracking, distance validation, smart alerts, privacy controls
6. No-Show & Cancellation Automation — Time-based penalties, Stripe refunds, 3-strike threshold
7. Membership System — 10% session discount, +0.15 matching priority, free monthly boost, member badge
8. Boost System — isBoosted flag, impression/view/click tracking, analytics dashboard

### P2 — Secondary (COMPLETE)
9. Session Verification — Selfie Check: Both parties submit selfie before session starts

## Key Collections (MongoDB)
- users, trainer_profiles, trainee_profiles, sessions, virtual_requests
- notifications, notification_preferences, memberships, boosts
- session_gps_tracks, session_credits, boost_analytics
- session_selfies (NEW - selfie verification data)
- reviews, messages

## API Endpoints (All New)
### Matching
- POST /api/virtual/request, /api/virtual/accept/{id}, GET /api/virtual/request/{id}
- POST /api/instant/request

### Session Management
- PATCH /api/sessions/{id}/cancel, /api/sessions/{id}/no-show?who=trainee|trainer
- POST /api/sessions/{id}/start-en-route, /api/sessions/{id}/start-session

### GPS
- POST /api/sessions/{id}/gps-update, GET /api/sessions/{id}/gps-track
- POST /api/sessions/{id}/confirm-gps

### Selfie Verification
- POST /api/sessions/{id}/verify-selfie
- GET /api/sessions/{id}/verification-status

### Membership & Boost
- GET /api/boosts/analytics, POST /api/boosts/{id}/track-view
- GET /api/memberships/member-badge/{user_id}

## Test Credentials
- Admin: admin@rapidreps.com / admin123
- Trainers: trainer1@test.com, trainer2@test.com / test123
- Trainees: trainee1@test.com (has membership), trainee2@test.com / test123

## Testing Status
- P0: 16/16 (iteration_16)
- P1.1-P1.2: 24/24 (iteration_17)
- P1.3-P1.4: 14/14 (iteration_18)
- P2: 16/16 (iteration_19)
- **Total: 70/70 tests passing**

## Remaining Tasks (Backlog)
1. SendGrid email integration (awaiting API key from user)
2. TypeScript strict-mode warnings cleanup (86+)

## Mocked/Inactive
- SendGrid: No-op (awaiting API key)
- Stripe: Mock payment intents for testing
- Push notifications: Sends to Expo servers (no real devices)
