# RapidReps - Product Requirements Document

## Original Problem Statement
Build a fitness trainer-trainee matching platform with Uber-style real-time matching, virtual and in-person sessions, payments via Stripe, and comprehensive admin tools.

## Architecture
- **Frontend**: React Native / Expo with Expo Router
- **Backend**: FastAPI (Python) on port 8001
- **Database**: MongoDB
- **Payments**: Stripe integration
- **Notifications**: Expo Push SDK + Smart Notification Engine

## Core Features Implemented

### Authentication & User Management
- JWT-based login/signup with role-based access (trainee, trainer, admin)
- Profile management for both trainers and trainees
- Trainer onboarding with specialization selection

### Uber-Style Matching Engine (P0 - COMPLETE)
- Weighted scoring: ETA 40%, Rating 25%, Price 15%, Boost 10%, Responsiveness 5%, Completeness 5%
- Wave-based trainer notifications (Wave 1: ≤5min, Wave 2: ≤10min, Wave 3: ≤15min)
- First-accept-wins with atomic MongoDB update (race condition prevention)
- Progressive wave expansion for stale requests

### Smart Push Notification Engine (P0 - COMPLETE)
- 6 new notification types: virtual_request, virtual_matched, virtual_taken, missed_acceptance, late_warning, session_started
- Background scheduler: progressive waves, missed acceptance tracking, late warnings, no-show auto-detection

### Virtual Live Video Screen (P0 - COMPLETE)
- Scrollable layout, radar animation, countdown, cancel button, "No trainers found" fallback
- Boxing-bell sound (expo-av) on trainer match

### 508 Compliance (P0 - COMPLETE)
- All orange text removed, replaced with teal/navy
- Text shadows on all image background headers
- Higher font-weight (800-900) on CTAs
- "Time to Lock In" and "Delete Account" verified

### No-Show & Cancellation Automation (P1 - COMPLETE)
**Trainee Cancellation:**
- >12 hours before = $0 penalty
- 12-2 hours before = 25% penalty
- <2 hours before = 50% penalty

**Trainer Cancellation:**
- >12 hours = no penalty, full refund
- ≤12 hours = full refund + virtual session credit, trainer gets performance strike

**Trainee No-Show:**
- Trainer receives 50% payout (platform keeps 25% of that 50%)
- Trainee charged 50% of session price

**Trainer No-Show:**
- Trainee receives 100% refund
- Trainer gets $0 + performance strike
- 3 strikes = account flagged for review

**Stripe Integration:**
- Refunds/partial refunds calculated before payout
- Platform fee adjustments automated

### Advanced GPS Tracking System (P1 - COMPLETE)
**Session Flow:** confirmed → en_route → in_progress → completed

**GPS Update Frequency:**
- En route: every 5 seconds
- In progress: every 15 seconds
- Stops on session end/cancel

**Distance Thresholds:**
- In-person (outdoor/gym): ≤ 0.25 miles (400m) to start
- At-home sessions: ≤ 0.1 miles (160m) to start
- Distance increase >0.5 miles during session triggers warning

**GPS Alerts:**
- Low accuracy (>50m): "Weak signal — confirm location manually"
- Trainer stale movement (2 min): "Are you on the way?"
- Distance warning (>0.5 miles apart during session)
- Address mismatch (>0.25 miles apart at start)

**Privacy:**
- GPS only active during en_route, in_progress, confirmed
- NOT active outside sessions or when idle

### Booking & Payments
- Session scheduling with date/time picker
- Stripe payment integration
- Session confirmation flow
- Payment release after session completion

### Admin Dashboard
- SVG-based charts, real-time leaderboard, session analytics

## Test Credentials
- Admin: admin@rapidreps.com / admin123
- Trainers: trainer1@test.com, trainer2@test.com / test123
- Trainees: trainee1@test.com, trainee2@test.com / test123

## Key Collections (MongoDB)
- users, trainer_profiles, trainee_profiles
- sessions, virtual_requests
- notifications, notification_preferences
- boosts, reviews, messages
- session_gps_tracks (NEW - GPS tracking data)
- session_credits (NEW - virtual session credits)

## API Endpoints (New in this session)
- PATCH /api/sessions/{id}/cancel (time-based penalties, both trainee & trainer)
- PATCH /api/sessions/{id}/no-show?who=trainee|trainer (no-show with proper payouts)
- POST /api/sessions/{id}/start-en-route (en_route status + GPS tracking)
- POST /api/sessions/{id}/gps-update (real-time GPS with alerts)
- GET /api/sessions/{id}/gps-track (live positions + distance)
- POST /api/sessions/{id}/confirm-gps (distance validation)
- POST /api/sessions/{id}/start-session (in_progress status)

## Remaining Tasks

### P1 - Medium Priority (REMAINING)
1. Membership System - True Benefit Stack (priority matching, discounts, free boost)
2. Boost System - Real Power (profile glow, enhanced insights)

### P2 - Secondary
3. Session Verification - Selfie check before session

### P3+ - Backlog
4. SendGrid email integration (awaiting API key)
5. Toast notifications (sonner)
6. TypeScript strict-mode warnings (86+)

## Mocked/Inactive Services
- SendGrid email: No-op mode
- Stripe: Uses mock payment intents for testing (real Stripe for production)
- Push notifications: Sends to Expo servers (no real devices)

## Testing Status
- P0: 16/16 tests passed (iteration_16.json)
- P1: 24/24 tests passed (iteration_17.json)
- Test files: /app/backend/tests/test_p0_smart_matching_engine.py, /app/backend/tests/test_p1_cancellation_noshow_gps.py
