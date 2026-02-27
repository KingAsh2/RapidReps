# RapidReps - Product Requirements Document
## "Uber for Personal Training"

### Architecture
- **Frontend**: React Native (Expo) with Expo Router
- **Backend**: FastAPI (Python) with MongoDB
- **Payments**: Stripe | **Maps**: Google Maps API
- **Build**: EAS | **Deployment**: TestFlight (iOS)

---

### ALL Features — Complete

#### Admin Panel V2 ✅
#### Streaks / Consistency Points ✅
#### Achievement System (12 badges) ✅
#### Weekly Leaderboard ✅
#### Trainer Video Intros ✅
#### Distance Labels on Map ✅
#### UI/UX Visual Polish (all items) ✅

### Security Fixes Applied (Feb 27, 2026 — QA Audit)
- [x] C1: Forgot Password — removed fake success, now shows honest "Contact support" message
- [x] C2: GET /api/sessions/{id} — requires auth, verifies user is participant or admin
- [x] C3: POST /payments/create-payment-intent — validates amount ($1 min, $5000 max)
- [x] C4: POST /ratings — verifies rater is the actual trainee of the session

### Known Limitations (not fixed yet)
- M1: Membership ($19.99/mo) doesn't charge via Stripe — records DB entry only
- M2: Boost purchases don't charge via Stripe — records DB entry only
- M3: No rate limiting on endpoints
- M4: Base64 images in MongoDB (should migrate to cloud storage at scale)

### Backend Test Results
- Iterations 7-10: 95/96 tests passed (99%)
- QA Audit: 4 critical security issues found and fixed

### Test Credentials
- **Admin**: admin@rapidreps.com / admin123
- **Trainer**: trainer1@test.com / test123
- **Trainee**: trainee1@test.com / test123

### QA Report
- Full audit saved to: `/app/QA_AUDIT_REPORT.md`

### Remaining Backlog
- [ ] Implement real password reset with email (SendGrid/Resend)
- [ ] Add Stripe payment to membership subscribe
- [ ] Add Stripe payment to boost purchase
- [ ] Add rate limiting (slowapi)
- [ ] Push notifications
- [ ] "Share My Streak" social card
