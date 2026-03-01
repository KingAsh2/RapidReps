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
1. **Uber-Style Matching Engine** — Weighted scoring, wave-based notifications, first-accept-wins, race condition prevention
2. **Smart Push Notification Engine** — 6 new types, progressive wave expansion, missed acceptance tracking, late warnings, no-show auto-detection
3. **Virtual Live Video Screen** — Scrollable, radar animation, countdown, cancel, "No trainers" fallback, boxing-bell sound
4. **508 Compliance** — All orange text removed, text shadows on image backgrounds, higher CTA font-weight

### P1 — Medium Priority (COMPLETE)
5. **Advanced GPS Tracking** — Real-time en-route/active tracking, distance validation (0.25mi outdoor, 0.1mi at-home), smart alerts (stale movement, low accuracy, distance warnings), privacy controls
6. **No-Show & Cancellation Automation** — Time-based penalties (trainee: 0%/>12h, 25%/12-2h, 50%/<2h; trainer: strike+credit ≤12h), Stripe refunds, 3-strike threshold
7. **Membership System - True Benefit Stack** — 10% session discount, +0.15 matching priority bonus, free monthly boost, member badge
8. **Boost System - Real Power** — isBoosted flag in search results, impression/view/click tracking, boost analytics dashboard

## Key Collections (MongoDB)
- users, trainer_profiles, trainee_profiles, sessions, virtual_requests
- notifications, notification_preferences, memberships, boosts
- session_gps_tracks, session_credits, boost_analytics, reviews, messages

## API Endpoints (Key New Ones)
- POST /api/virtual/request, /api/virtual/accept/{id}, GET /api/virtual/request/{id}
- POST /api/instant/request
- PATCH /api/sessions/{id}/cancel, /api/sessions/{id}/no-show?who=trainee|trainer
- POST /api/sessions/{id}/start-en-route, /api/sessions/{id}/start-session
- POST /api/sessions/{id}/gps-update, GET /api/sessions/{id}/gps-track
- POST /api/sessions/{id}/confirm-gps
- GET /api/boosts/analytics, POST /api/boosts/{id}/track-view
- GET /api/memberships/member-badge/{user_id}

## Test Credentials
- Admin: admin@rapidreps.com / admin123
- Trainers: trainer1@test.com, trainer2@test.com / test123
- Trainees: trainee1@test.com (has membership), trainee2@test.com / test123

## Remaining Tasks

### P2 — Secondary
1. Session Verification - Selfie check before session

### P3+ — Backlog
2. SendGrid email integration (awaiting API key)
3. Toast notifications (sonner)
4. TypeScript strict-mode warnings (86+)

## Testing Status
- P0: 16/16 passed (iteration_16.json)
- P1.1-P1.2: 24/24 passed (iteration_17.json)
- P1.3-P1.4: 14/14 passed (iteration_18.json)
- **Total: 54/54 tests passing**

## Mocked/Inactive
- SendGrid: No-op (awaiting API key)
- Stripe: Mock payment intents for testing
- Push notifications: Sends to Expo servers (no real devices)
