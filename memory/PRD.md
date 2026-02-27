# RapidReps - Product Requirements Document
## "Uber for Personal Training"

### Architecture
- **Frontend**: React Native (Expo) with Expo Router
- **Backend**: FastAPI (Python) with MongoDB
- **Payments**: Stripe PaymentSheet (native) + PaymentIntents (backend)
- **Maps**: Google Maps API
- **Notifications**: Expo Push API (via `expo-notifications`)
- **Email**: SendGrid (8 templates, NOOP until API key provided)
- **Rate Limiting**: slowapi (login: 10/min, signup: 5/min, booking: 10/min)
- **Build**: EAS | **Deployment**: TestFlight (iOS)

---

### ALL Features — Complete

#### Core Features
- Admin Panel V2 (full user/session/transaction management + **pagination**)
- Streaks / Consistency Points
- Achievement System (12 badges)
- Weekly Leaderboard
- Trainer Video Intros
- Distance Labels on Map
- Messaging System
- **"Share My Streak" Social Card** — shareable card with streak stats, animated fire icon

#### Security & Hardening
- [x] Real Stripe PaymentIntents for memberships ($19.99/mo) and boosts
- [x] Stripe PaymentSheet on iOS (native) with web fallback
- [x] API rate limiting via slowapi
- [x] Rating system: 6 server-side rules + 48-hour window
- [x] XSS input sanitization on all user-generated text
- [x] emailVerified field on user model

#### Push Notifications System (Full — 10 types)
- session_requested, session_accepted, session_declined, session_ended, session_reminder
- rate_reminder, payment_released, new_message, streak_warning, boost_expiring
- Background scheduler (every 5 min), notification bell on home screens
- **Notification Preferences** screen with per-type toggles

#### Password Reset (Full Flow)
- [x] POST /api/auth/forgot-password — generates token, sends email (or NOOP)
- [x] POST /api/auth/reset-password — validates token, expires after 1h, marks used
- [x] Frontend forgot-password screen now calls real API
- [x] No email enumeration (same response for existing/non-existing emails)

#### Weekly Digest
- [x] GET /api/weekly-digest — returns training summary (sessions, minutes, streak, rank)
- [x] Triggers email send via SendGrid (NOOP until API key provided)

#### Email Infrastructure (SendGrid — 8 Templates Ready)
1. Password Reset
2. Welcome / Email Verification
3. Session Booked Confirmation
4. Payment Receipt
5. Weekly Digest
6. Streak Warning
7. Trainer Payout Notification
8. Admin Alert
- All run in NOOP mode (logged) until SENDGRID_API_KEY is set in backend/.env

#### Admin Panel Pagination
- [x] Users, Sessions, Transactions — 20 per page with prev/next controls
- [x] Backend supports arbitrary limit/skip params with total count

#### Improved Empty States
- [x] Trainer sessions: context-specific messages per filter tab
- [x] Trainer earnings: helpful CTA text
- [x] All existing screens already had good empty states

#### Confirmation Modals
- [x] Trainer logout, Trainee logout, Trainee delete account, Admin remove user

### Test Results
- Iteration 12: 15/15 (rating + payment)
- Iteration 13: 18/18 (notifications)
- Iteration 14: 38/38 (comprehensive QA)
- Iteration 15: 27/27 (password reset, digest, pagination, email infra)
- **TOTAL: 98/98 tests passing (100%)**

### Deployment Readiness: PRODUCTION READY

### Test Credentials
- **Admin**: admin@rapidreps.com / admin123
- **Trainer**: trainer1@test.com / test123
- **Trainee**: trainee1@test.com / test123

### To Activate Email Sending
Add to `/app/backend/.env`:
```
SENDGRID_API_KEY=your_key_here
FROM_EMAIL=noreply@rapidreps.com
```

### Remaining Backlog
- [ ] Resolve 86+ TypeScript strict-mode warnings
- [ ] Migrate Base64 images to cloud storage (at scale)
- [ ] In-app Weekly Report screen (currently API-only + email)
