# RapidReps - Product Requirements Document
## "Uber for Personal Training"

### Architecture
- **Frontend**: React Native (Expo) with Expo Router
- **Backend**: FastAPI (Python) with MongoDB
- **Payments**: Stripe PaymentSheet (native) + PaymentIntents (backend)
- **Maps**: Google Maps API
- **Notifications**: Expo Push API (via `expo-notifications`)
- **Rate Limiting**: slowapi (login: 10/min, signup: 5/min, booking: 10/min)
- **Build**: EAS | **Deployment**: TestFlight (iOS)

---

### ALL Features — Complete

#### Core Features
- Admin Panel V2 (full user/session/transaction management)
- Streaks / Consistency Points
- Achievement System (12 badges)
- Weekly Leaderboard
- Trainer Video Intros
- Distance Labels on Map
- Messaging System

#### Security & Hardening
- [x] Real Stripe PaymentIntents for memberships ($19.99/mo) and boosts ($49.99/wk, $149.99/mo)
- [x] Stripe PaymentSheet integration on iOS (native) with web fallback
- [x] API rate limiting via slowapi
- [x] X-Forwarded-For for correct IP in Kubernetes
- [x] Rating system: 6 server-side rules + 48-hour window
- [x] XSS input sanitization on all user-generated text
- [x] emailVerified field on user model

#### Rating System Rules (6 enforced server-side)
1. Only the session trainee can rate
2. Only 1 rating per session per user
3. Session must be completed before rating
4. Trainers cannot rate their own sessions
5. Require authentication + verified email
6. Timestamp/IP metadata for anti-fraud (clientIp, submittedAt, userAgent)
- 48-hour rating window after session completion

#### Push Notifications System (Full)
- [x] Backend: Expo Push API integration
- [x] Push token registration/unregistration
- [x] Notification storage with history and mark-as-read
- [x] 10 notification types: session_requested, session_accepted, session_declined, session_ended, session_reminder, rate_reminder, payment_released, new_message, streak_warning, boost_expiring
- [x] Background scheduler (every 5 min): session reminders, rate reminders, streak warnings, boost expiry alerts
- [x] Frontend: NotificationContext with push token registration
- [x] Frontend: Notification bell icon with unread badge (trainee + trainer home)
- [x] Frontend: Notifications screen with type-specific icons
- [x] Frontend: Mark-all-read functionality

#### Notification Preferences
- [x] Backend: Per-user preference storage (toggle each notification type)
- [x] Backend: create_and_send_notification respects user preferences
- [x] Frontend: Notification Preferences screen with grouped toggle switches
- [x] Master "Push Notifications" toggle disables all push

#### Stripe PaymentSheet Integration
- [x] Backend: Creates real PaymentIntents with correct amounts
- [x] Frontend: Platform-safe import (native Stripe on iOS, fallback on web)
- [x] Membership: initPaymentSheet → presentPaymentSheet → confirm-payment
- [x] Boosts: Same 3-step flow with free-boost shortcut for members

#### Confirmation Modals
- [x] Trainee: Logout confirmation
- [x] Trainee: Delete account confirmation
- [x] Admin: Remove user confirmation (already existed)
- [x] Trainer: Logout confirmation (added)

### Test Results
- Iteration 12: 15/15 rating + payment tests passed
- Iteration 13: 18/18 notification system tests passed
- Iteration 14: 38/38 comprehensive QA audit passed
- **TOTAL: 71/71 tests passing (100%)**

### Deployment Readiness: PRODUCTION READY

### Test Credentials
- **Admin**: admin@rapidreps.com / admin123
- **Trainer**: trainer1@test.com / test123
- **Trainee**: trainee1@test.com / test123

### Remaining Backlog
- [ ] Forgot password with email (SendGrid/Resend) — deferred by user
- [ ] "Share My Streak" social card
- [ ] Improve empty state screens
- [ ] Pagination on Admin Panel long lists
- [ ] Resolve 86+ TypeScript strict-mode warnings
- [ ] Migrate Base64 images to cloud storage (at scale)

### Known Intentional Behaviors
- "Forgot Password" shows "Contact support" (by user request, no SendGrid)
- emailVerified defaults True (until email verification flow is implemented)
- Stripe PaymentSheet only works on native iOS/Android builds (web uses auto-confirm)
