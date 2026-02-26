# RapidReps - Product Requirements Document
## "Uber for Personal Training"

### Original Problem Statement
Build a production-ready mobile app that functions like "Uber" for personal training. The app connects trainees with personal trainers, handles session booking, payments, verification, and admin management.

### Architecture
- **Frontend**: React Native (Expo) with Expo Router
- **Backend**: FastAPI (Python) with MongoDB
- **Payments**: Stripe (requires valid API key)
- **Maps**: Google Maps API
- **Build**: EAS (Expo Application Services)

### Core Features

#### Authentication & Roles
- [x] User signup/login with JWT tokens
- [x] Role-based access: Trainee, Trainer, Admin
- [x] Admin login flow with dashboard redirect
- [x] Logout navigates to welcome screen (fixed)

#### Trainer Verification (7-Step)
- [x] Backend: GET /api/trainer/verification-status
- [x] Backend: POST /api/trainer/submit-verification-step
- [x] Backend: POST /api/trainer/submit-all-verification
- [x] Frontend: Full verification UI with progress tracking
- [x] Frontend: "Hold to Submit" button (2-second long press)
- [x] Steps: Identity, Background Check, Certification, CPR, Insurance, Photo, Video

#### Admin Dashboard
- [x] Backend: Full suite of admin endpoints (dashboard stats, users, sessions, transactions, verifications)
- [x] Frontend: Tab-based dashboard (Overview, Users, Verifications, Sessions, Payments)
- [x] Approve/Reject trainer verifications
- [x] User detail modal with profile, sessions, transactions

#### Payment Model (Backend Ready)
- [x] Revenue split: 75% trainer / 25% platform
- [x] Minimum session pricing: Virtual ($30), Outdoor ($40), In-Home ($60)
- [x] Travel fees, cancellation fees, no-show fees
- [x] Membership model ($19.99/month)
- [x] Boost model (trainer visibility)
- [ ] Frontend payment flow (requires valid Stripe key)

#### Session Booking
- [x] Session types: Virtual, Outdoor, In-Home, Trainee's Home (with safety modal)
- [x] Session CRUD with status management
- [x] Trainer tab navigation matching trainee experience

### Bug Fixes Applied (Feb 2026)
- [x] Trainer verification flow completely rebuilt (was non-functional)
- [x] Logout flow fixed to return to welcome screen
- [x] Profile photo saving fixed (API field mismatch: `_id` vs `id`)
- [x] Admin dashboard auth token key fixed (`token` → `auth_token`)
- [x] Duplicate admin/sessions route removed
- [x] Stripe publishable key added to frontend .env

### Known Issues
- Stripe Secret Key is truncated/invalid - payment API calls fail
- Web preview is non-functional (Expo limitation in this environment)
- Intro video glitch on app open (never investigated)
- Logo overlap on welcome page (background logo visible)

### Test Credentials
- **Admin**: admin@rapidreps.com / admin123
- **Trainer**: trainer1@test.com / test123
- **Trainee**: trainee1@test.com / test123

### Backend Test Status: 28/28 PASSED (Feb 26, 2026)
