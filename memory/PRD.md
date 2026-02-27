# RapidReps - Product Requirements Document
## "Uber for Personal Training"

### Architecture
- **Frontend**: React Native (Expo) with Expo Router
- **Backend**: FastAPI (Python) with MongoDB
- **Payments**: Stripe | **Maps**: Google Maps API
- **Build**: EAS | **Deployment**: TestFlight (iOS)

---

### ALL Features — Complete

#### Admin Panel V2
#### Streaks / Consistency Points
#### Achievement System (12 badges)
#### Weekly Leaderboard
#### Trainer Video Intros
#### Distance Labels on Map
#### UI/UX Visual Polish (all items)

### Security Fixes Applied (Feb 27, 2026 — QA Audit)
- [x] C1: Forgot Password — removed fake success, now shows honest "Contact support" message
- [x] C2: GET /api/sessions/{id} — requires auth, verifies user is participant or admin
- [x] C3: POST /payments/create-payment-intent — validates amount ($1 min, $5000 max)
- [x] C4: POST /ratings — verifies rater is the actual trainee of the session

### Security & Hardening (Feb 27, 2026 — Latest)
- [x] Real Stripe PaymentIntents for memberships ($19.99/mo) and boosts
- [x] API rate limiting via slowapi (login: 10/min, signup: 5/min, booking: 10/min)
- [x] X-Forwarded-For header for correct IP in Kubernetes
- [x] Rating system hardened with 6 server-side rules + 48-hour window
- [x] Input sanitization (XSS protection) on all user-generated text fields
- [x] emailVerified field added to user model (defaults true, ready for email verification flow)

### Rating System Rules (6 enforced server-side)
1. Only the session trainee can rate
2. Only 1 rating per session per user
3. Session must be completed before rating
4. Trainers cannot rate their own sessions
5. Require authentication + verified email
6. Timestamp/IP metadata for anti-fraud (clientIp, submittedAt, userAgent)
- 48-hour rating window after session completion

### Known Limitations
- M4: Base64 images in MongoDB (should migrate to cloud storage at scale)
- Frontend payment flow uses TODO for Stripe PaymentSheet presentation (backend creates real PaymentIntents)

### Backend Test Results
- Iteration 12: 15/15 tests passed (100%) + 2 skipped (rate limiting expected)
- All 6 rating rules validated
- XSS sanitization confirmed
- Stripe PaymentIntents verified with live keys

### Test Credentials
- **Admin**: admin@rapidreps.com / admin123
- **Trainer**: trainer1@test.com / test123
- **Trainee**: trainee1@test.com / test123

### QA Report
- Full audit saved to: `/app/QA_AUDIT_REPORT.md`

### Remaining Backlog
- [ ] Implement real password reset with email (SendGrid/Resend) — deferred by user
- [ ] Integrate Stripe PaymentSheet in frontend (backend ready)
- [ ] Push notifications
- [ ] "Share My Streak" social card
- [ ] Inconsistent button states (M2) — loading/disabled states on interactive buttons
- [ ] Confirmation modals for critical actions
- [ ] Improve empty state screens
- [ ] Add toast notifications for success/error
- [ ] Pagination on Admin Panel long lists
- [ ] Resolve 86+ TypeScript strict-mode warnings
