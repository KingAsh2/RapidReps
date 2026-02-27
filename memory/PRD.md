# RapidReps - Product Requirements Document
## "Uber for Personal Training"

### Architecture
- **Frontend**: React Native (Expo) with Expo Router
- **Backend**: FastAPI (Python) with MongoDB
- **Payments**: Stripe | **Maps**: Google Maps API
- **Notifications**: Expo Push API (via `expo-notifications`)
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

#### Security & Hardening (Feb 27, 2026)
- [x] Real Stripe PaymentIntents for memberships and boosts
- [x] API rate limiting (login: 10/min, signup: 5/min, booking: 10/min)
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
6. Timestamp/IP metadata for anti-fraud
- 48-hour rating window after session completion

#### Push Notifications System (Feb 27, 2026) — NEW
- [x] Backend: Expo Push API integration (send_push_notification utility)
- [x] Backend: Push token registration/unregistration endpoints
- [x] Backend: Notification storage with history and mark-as-read
- [x] Backend: Session lifecycle triggers (request, accept, decline, end, complete)
- [x] Backend: New message notification trigger
- [x] Backend: Background scheduler (every 5 min):
  - Session reminders (30 min before start)
  - "Rate Your Session" reminder (30 min after end)
  - Streak warning (6 days without a session)
  - Boost expiry warning (24 hours before expiry)
- [x] Frontend: NotificationContext with push token registration
- [x] Frontend: Notification bell icon with unread badge (trainee + trainer home)
- [x] Frontend: Notifications screen with type-specific icons and time-ago
- [x] Frontend: Mark-all-read functionality

### Test Results
- Iteration 12: 15/15 rating + payment tests passed (100%)
- Iteration 13: 18/18 notification system tests passed (100%)

### Test Credentials
- **Admin**: admin@rapidreps.com / admin123
- **Trainer**: trainer1@test.com / test123
- **Trainee**: trainee1@test.com / test123

### Remaining Backlog
- [ ] Forgot password with email (SendGrid/Resend) — deferred by user
- [ ] Stripe PaymentSheet frontend integration (backend ready)
- [ ] "Share My Streak" social card
- [ ] Inconsistent button states (M2) on some screens — partially done
- [ ] Confirmation modals for critical actions
- [ ] Improve empty state screens
- [ ] Add toast notifications for success/error
- [ ] Pagination on Admin Panel long lists
- [ ] Resolve 86+ TypeScript strict-mode warnings

### Known Limitations
- M4: Base64 images in MongoDB (should migrate to cloud storage at scale)
- Expo Push API notifications are fire-and-forget; actual delivery requires real device tokens
- "Forgot Password" shows "Contact support" message (by user request)
