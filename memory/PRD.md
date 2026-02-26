# RapidReps - Product Requirements Document
## "Uber for Personal Training"

### Original Problem Statement
Build a production-ready mobile app that functions like "Uber" for personal training. The app connects trainees with personal trainers, handles session booking, payments, verification, and admin management.

### Architecture
- **Frontend**: React Native (Expo) with Expo Router
- **Backend**: FastAPI (Python) with MongoDB
- **Payments**: Stripe (requires valid `sk_live_` or `sk_test_` key)
- **Maps**: Google Maps API
- **Build**: EAS (Expo Application Services)

### Core Features

#### Authentication & Roles
- [x] User signup/login with JWT tokens
- [x] Role-based access: Trainee, Trainer, Admin
- [x] Admin login flow with dashboard redirect
- [x] Logout navigates to welcome screen

#### Trainer Verification (7-Step)
- [x] Backend: GET /api/trainer/verification-status
- [x] Backend: POST /api/trainer/submit-verification-step
- [x] Backend: POST /api/trainer/submit-all-verification
- [x] Frontend: Full verification UI with progress tracking
- [x] Frontend: "Hold to Submit" button (2-second long press)

#### Admin Dashboard
- [x] Backend: Full suite of admin endpoints
- [x] Frontend: Tab-based dashboard (Overview, Users, Verifications, Sessions, Payments)
- [x] Approve/Reject trainer verifications
- [x] User detail modal

#### Payment Model
- [x] Revenue split: 75% trainer / 25% platform
- [x] Minimum session pricing: Virtual ($30), Outdoor ($40), In-Home ($60)
- [x] Travel fees, cancellation fees, no-show fees
- [x] Backend: POST /api/payments/create-payment-intent (Stripe)
- [x] Backend: GET /api/payments/pricing-rules
- [x] Backend: POST /api/payments/calculate-session-cost
- [x] Frontend: Confirm booking screen with price breakdown and Stripe payment (demo mode until valid key)

#### Membership System ($19.99/month)
- [x] Backend: POST /api/memberships/subscribe
- [x] Backend: GET /api/memberships/my-membership
- [x] Frontend: Full membership purchase screen with benefits, comparison table, subscribe CTA

#### Trainer Boosts (Visibility)
- [x] Backend: POST /api/boosts/purchase (daily $4.99, weekly $14.99, monthly $29.99)
- [x] Backend: GET /api/boosts/my-boosts
- [x] Frontend: Boost purchase screen with option selection, benefits, purchase CTA

#### Trainer Earnings Dashboard
- [x] Backend: Enhanced GET /api/trainer/earnings (daily/weekly breakdown, payout history)
- [x] Backend: POST /api/trainer/request-payout
- [x] Backend: GET /api/trainer/payout-requests
- [x] Frontend: Animated earnings dashboard with chart, period toggle, request payout modal

#### Trainer Tab Screens
- [x] Sessions screen with filter tabs (upcoming/completed/cancelled)
- [x] Profile screen with stats, verification link, boosts link, logout
- [x] Earnings tab (full dashboard)
- [x] Messages tab (redirect to shared messages)

#### UI/UX Fixes
- [x] Logo overlap on welcome page (solid background behind logo)
- [x] Logout flow fixed (navigates to welcome screen)
- [x] Profile photo saving fixed (`_id` vs `id` mismatch)
- [x] Admin dashboard auth token key fixed

### Known Issues
- **Stripe Secret Key Invalid**: The provided key (`mk_...`) is not a valid Stripe format. Payment intents fail. Frontend gracefully falls back to demo mode. User needs to provide a valid `sk_live_` or `sk_test_` key.
- **Web preview non-functional**: Expo limitation in this environment.

### Test Credentials
- **Admin**: admin@rapidreps.com / admin123
- **Trainer**: trainer1@test.com / test123
- **Trainee**: trainee1@test.com / test123

### Backend Test Status
- Iteration 1: 28/28 PASSED - Core features, admin, verification
- Iteration 2: 15/15 PASSED - Trainer earnings dashboard
- Iteration 3: 16/16 PASSED - Payments, memberships, boosts, sessions + regressions

### New Files Created This Session
- `/app/frontend/app/trainee/membership.tsx` - Membership purchase screen
- `/app/frontend/app/trainer/boosts.tsx` - Boosts purchase screen

### Files Modified This Session
- `/app/backend/server.py` - Added verification, earnings, payout, boosts endpoints
- `/app/frontend/app/trainer/verification.tsx` - Complete rebuild
- `/app/frontend/app/trainee/confirm-booking.tsx` - Real payment flow with Stripe
- `/app/frontend/app/admin/dashboard.tsx` - Full admin UI
- `/app/frontend/app/trainer/(tabs)/sessions.tsx` - Real sessions list
- `/app/frontend/app/trainer/(tabs)/profile.tsx` - Real profile screen
- `/app/frontend/app/trainer/(tabs)/earnings.tsx` - Full earnings dashboard
- `/app/frontend/app/index.tsx` - Logo overlap fix
- `/app/frontend/src/contexts/AuthContext.tsx` - Logout fix
- `/app/frontend/src/services/api.ts` - Profile photo fix + verification APIs
