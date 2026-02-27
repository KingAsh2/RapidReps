# RapidReps - Product Requirements Document
## "Uber for Personal Training"

### Original Problem Statement
Build a production-ready mobile app that functions like "Uber" for personal training. The app connects trainees with personal trainers, handles session booking, payments, verification, and admin management.

### Architecture
- **Frontend**: React Native (Expo) with Expo Router
- **Backend**: FastAPI (Python) with MongoDB
- **Payments**: Stripe (LIVE key configured)
- **Maps**: Google Maps API
- **Build**: EAS (Expo Application Services)
- **Deployment**: TestFlight (iOS)

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

#### Admin Dashboard V2 (Feb 27, 2026)
- [x] **Session Management**: Enriched sessions showing trainer/trainee names, session location, trainee home address for in-home sessions, scheduled vs actual duration, start/stop timestamps
- [x] **User Management**: View all users, view user detail, remove users (cascade deletes all related data), admin self-delete protection
- [x] **Transaction Management**: Enriched transactions with user names, refund payments (with Stripe integration), confirm payments, duplicate refund protection
- [x] **Communication**: Admin can message any trainer/trainee through existing chat system
- [x] **Admin Profile**: View and edit own profile (name, email, phone)
- [x] **Verification Tab**: Approve/reject trainer verifications with checklist
- [x] **Overview Dashboard**: Total users, trainers, trainees, sessions, revenue breakdown, memberships, boosts, pending verifications
- [x] **Security**: passwordHash excluded from all user responses, all endpoints require admin auth

#### Payment System
- [x] Backend: Revenue split 75/25, min pricing, fees, Stripe integration
- [x] Frontend: Confirm booking with price breakdown (demo mode fallback)

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
- [x] Frontend: Conversation list and chat screens

#### Rating & Review System
- [x] Backend: Create ratings with duplicate prevention, get ratings with reviewer names
- [x] Frontend: Post-session review screen with star rating, trainer detail shows reviews

#### Trainee Profile
- [x] Home address field for in-home training sessions (NEW)

### Known Issues
- Stripe Secret Key may be invalid for production (test refunds work without live payment intents)
- Web preview non-functional (Expo environment limitation)

### Backend Test Results
- Iteration 1-3: 59/59 PASSED (Core features)
- Iteration 4-6: Additional test suites
- **Iteration 7: 26/26 PASSED** (Admin Panel V2 - all new endpoints verified)

### New Admin API Endpoints (Feb 27, 2026)
- `GET /api/admin/sessions` - Enriched with trainerName, traineeName, traineeHomeAddress, actualDurationMinutes
- `GET /api/admin/transactions-enriched` - Transactions with user names
- `DELETE /api/admin/users/{user_id}` - Remove user with cascade delete
- `POST /api/admin/refund` - Refund session payment (Stripe + record)
- `POST /api/admin/confirm-payment` - Confirm session payment
- `PUT /api/admin/profile` - Update admin profile
- `POST /api/admin/message` - Send message to any user

### Test Credentials
- **Admin**: admin@rapidreps.com / admin123
- **Trainer**: trainer1@test.com / test123
- **Trainee**: trainee1@test.com / test123
