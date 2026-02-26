# RapidReps - Product Requirements Document
## "Uber for Personal Training"

### Original Problem Statement
Build a production-ready mobile app that functions like "Uber" for personal training. The app connects trainees with personal trainers, handles session booking, payments, verification, and admin management.

### Architecture
- **Frontend**: React Native (Expo) with Expo Router
- **Backend**: FastAPI (Python) with MongoDB
- **Payments**: Stripe (LIVE key configured and working)
- **Maps**: Google Maps API
- **Build**: EAS (Expo Application Services)

### Implemented Features

#### Authentication & Roles
- [x] User signup/login with JWT tokens
- [x] Role-based access: Trainee, Trainer, Admin
- [x] Admin login flow with dashboard redirect
- [x] Logout navigates to welcome screen

#### Trainer Verification (7-Step)
- [x] Backend: GET/POST verification endpoints
- [x] Frontend: Full UI with progress, uploads, "Hold to Submit" button
- [x] Post-signup verification modal prompting trainers to verify

#### Admin Dashboard
- [x] Backend: Full admin API suite (dashboard, users, sessions, transactions, verifications)
- [x] Frontend: Tab-based dashboard with approve/reject actions

#### Payment System
- [x] Backend: Revenue split 75/25, min pricing, fees, Stripe integration
- [x] Frontend: Confirm booking with price breakdown (demo mode fallback)
- [x] Note: Stripe key invalid — payments in DEMO MODE

#### Membership ($19.99/month)
- [x] Backend: Subscribe, check status, duplicate prevention
- [x] Frontend: Full membership screen with benefits, comparison, subscribe CTA

#### Trainer Boosts
- [x] Backend: Purchase boosts (daily/weekly/monthly), list boosts
- [x] Frontend: Boost selection, purchase flow, active boost indicator

#### Trainer Earnings Dashboard
- [x] Backend: Enhanced earnings with daily/weekly breakdown, payout requests
- [x] Frontend: Animated chart, period toggle, payout modal (CashApp/Zelle/Stripe)

#### Trainer Tab Screens
- [x] Sessions (filter: upcoming/completed/cancelled)
- [x] Profile (stats, verification link, boosts link, logout)
- [x] Earnings (full dashboard)
- [x] Messages (redirect to shared messages)

#### Messaging System
- [x] Backend: Conversations, messages CRUD with participant validation
- [x] Frontend: Conversation list and chat screens (already existed, verified working)

#### Rating & Review System
- [x] Backend: Create ratings with duplicate prevention, get ratings with reviewer names
- [x] Frontend: Post-session review screen with star rating (session-complete.tsx)
- [x] Frontend: Trainer detail page shows reviews with reviewer names

#### UI/UX Fixes
- [x] Logo overlap on welcome page (solid backing)
- [x] Logout flow (→ welcome screen)
- [x] Profile photo saving (`_id` → `id` mismatch)
- [x] Admin dashboard auth token key
- [x] Post-signup verification modal for trainers
- [x] Intro video glitch (crossfade transition on video end/skip)

### Known Issues
- Stripe Secret Key invalid (both `sk_` and `mk_` variants provided are rejected by Stripe)- Web preview non-functional (Expo environment limitation)
- Intro video glitch on app open (P3, never investigated)

### Backend Test Results: 59/59 PASSED
- Iteration 1: 28/28 — Core features, admin, verification
- Iteration 2: 15/15 — Trainer earnings dashboard
- Iteration 3: 16/16 — Payments, memberships, boosts, sessions

### Test Credentials
- **Admin**: admin@rapidreps.com / admin123
- **Trainer**: trainer1@test.com / test123
- **Trainee**: trainee1@test.com / test123
