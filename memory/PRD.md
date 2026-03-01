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
- Wave-based trainer notifications:
  - Wave 1: ETA ≤ 5 min, top 3 trainers
  - Wave 2: ETA ≤ 10 min, top 3 trainers
  - Wave 3: ETA ≤ 15 min, top 5 trainers
- Virtual sessions: All eligible, top 5 by score
- First-accept-wins with atomic MongoDB update (race condition prevention)
- Progressive wave expansion for stale requests (background scheduler)

### Smart Push Notification Engine (P0 - COMPLETE)
- New notification types: virtual_request, virtual_matched, virtual_taken, missed_acceptance, late_warning, session_started
- Intelligent routing: Only qualified trainers notified based on ETA/score
- Background scheduler with:
  - Progressive wave expansion for stale requests (2+ minutes)
  - Missed acceptance tracking (3+ minutes, re-notifies non-responders)
  - Late warning for in-person sessions (10+ minutes past start)
  - Session reminders (30 minutes before)
  - Streak warnings (6 days since last session)
  - Boost expiry alerts (24 hours before)

### Virtual Live Video Screen (P0 - COMPLETE)
- Scrollable layout with SafeAreaView
- Radar animation during trainer search
- Visible countdown timer
- Cancel button functionality
- "No trainers found" fallback UI
- Boxing-bell sound (expo-av) on trainer acceptance

### 508 Compliance (P0 - COMPLETE)
- All orange text (#FF7F00, #F7931E) removed from text elements
- Replaced with navy (#1a2a5e) or teal (#1FB8B4) for better contrast
- "Time to Lock In" subtitle: White with text shadow (was orange/warning)
- "Delete Account" button: Dark red (#CC0000) with text shadow, fontWeight 800
- Text shadows on all image background headers across app:
  - trainee: home, profile, confirm-booking, membership, schedule-training, virtual-confirm
  - trainer: boosts, earnings, profile
  - auth: login
- Higher font-weight (800-900) on all CTA buttons

### Booking & Payments
- Session scheduling with date/time picker
- Stripe payment integration
- Session confirmation flow
- Payment release after session completion

### Admin Dashboard
- User management (view/edit/block users)
- SVG-based charts (DonutChart, BarChart)
- Real-time "Top Trainer This Week" leaderboard
- Session and revenue analytics

### Additional Features
- Trainer boost system (visibility enhancement)
- Membership plans with Stripe
- In-app messaging
- Review and rating system
- Sound effects with settings toggle (SoundContext)
- Animated UI components (AnimatedPillButton)

## Test Credentials
- Admin: admin@rapidreps.com / admin123
- Trainers: trainer1@test.com, trainer2@test.com / test123
- Trainees: trainee1@test.com, trainee2@test.com / test123

## Key Collections (MongoDB)
- users, trainer_profiles, trainee_profiles
- sessions, virtual_requests
- notifications, notification_preferences
- boosts, reviews, messages

## API Endpoints (Key)
- POST /api/auth/login, /api/auth/signup
- POST /api/virtual/request (create virtual session request)
- POST /api/instant/request (create in-person instant request)
- POST /api/virtual/accept/{request_id} (trainer accepts)
- GET /api/virtual/request/{request_id} (check status)
- GET /api/notifications, /api/notification-preferences
- GET /api/admin/dashboard, /api/admin/top-trainers

## Remaining Tasks

### P1 - Medium Priority (UPCOMING)
1. Advanced GPS System - Live en-route tracking
2. No-Show & Cancellation Automation - Stripe penalties
3. Membership System - True benefit enforcement
4. Boost System - Enhanced features (profile glow, insights)

### P2 - Secondary
5. Session Verification - Selfie check before session

### P3+ - Backlog
6. SendGrid email integration (awaiting API key)
7. Toast notifications (sonner)
8. TypeScript strict-mode warnings (86+)

## Mocked/Inactive Services
- SendGrid email: No-op mode (awaiting API key)
- Push notifications: Sends to Expo servers but no real devices registered

## Testing Status
- Backend: 16/16 tests passed (iteration_16.json)
- Test file: /app/backend/tests/test_p0_smart_matching_engine.py
