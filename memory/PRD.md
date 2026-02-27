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
- [x] Session Management: Enriched sessions with trainer/trainee names, location, home address, duration tracking
- [x] User Management: View all users, remove users (cascade delete), admin self-delete protection
- [x] Transaction Management: Refund payments (Stripe), confirm payments, duplicate refund protection
- [x] Communication: Admin can message any user via chat
- [x] Admin Profile: View and edit own profile
- [x] Verification Tab: Approve/reject trainer verifications
- [x] Overview Dashboard: Stats, revenue, memberships, boosts, pending verifications
- [x] Security: passwordHash excluded from responses, all endpoints require admin auth

#### Streaks / Consistency Points System (Feb 27, 2026)
- [x] Backend: `GET /api/streaks/me` - calculates consecutive-week streaks from completed sessions
- [x] Streak levels: none -> warming (2wk) -> fire (4wk) -> blazing (8wk) -> legend (12wk)
- [x] Consistency points formula: sessions*10 + streak_weeks*25 + total_minutes//10
- [x] Frontend: Streak card on trainee profile with gradient, fire icon pulse animation, progress bar
- [x] Frontend: Streak card on trainer profile with same display
- [x] Frontend: Streak banner on achievements page with detailed stats

#### Achievement System (Updated Feb 27, 2026)
- [x] 12 badges total (10 original + 2 new streak-based)
- [x] New: Streak Star (maintain 4-week streak)
- [x] New: Duration Master (accumulate 500 training minutes)
- [x] Safe access for session fields (prevents KeyError on missing data)

#### UI/UX Visual Polish (Feb 27, 2026)
- [x] Heart pulse animation on saved trainers page
- [x] Enhanced trainer card shadows (deeper shadow depth)
- [x] Animated streak cards with gradient backgrounds

#### Payment System
- [x] Revenue split 75/25, min pricing, fees, Stripe integration
- [x] Frontend: Confirm booking with price breakdown

#### Membership ($19.99/month)
- [x] Subscribe, check status, duplicate prevention

#### Trainer Boosts
- [x] Purchase boosts (daily/weekly/monthly)

#### Trainer Earnings Dashboard
- [x] Enhanced earnings with daily/weekly breakdown, payout requests

#### Messaging System
- [x] Conversations, messages CRUD with participant validation

#### Rating & Review System
- [x] Create ratings with duplicate prevention, get ratings with reviewer names

#### Trainee Profile
- [x] Home address field for in-home training sessions

### Backend Test Results
- Iteration 7: 26/26 PASSED (Admin Panel V2)
- **Iteration 8: 14/14 PASSED** (Streaks + Achievements + Regression)

### API Endpoints Summary
**Admin:**
- `GET /api/admin/dashboard` | `GET /api/admin/sessions` | `GET /api/admin/users`
- `GET /api/admin/transactions-enriched` | `GET /api/admin/verifications/pending`
- `DELETE /api/admin/users/{id}` | `POST /api/admin/refund` | `POST /api/admin/confirm-payment`
- `PUT /api/admin/profile` | `POST /api/admin/message`

**Streaks:**
- `GET /api/streaks/me` - Get current user streak data

### Test Credentials
- **Admin**: admin@rapidreps.com / admin123
- **Trainer**: trainer1@test.com / test123
- **Trainee**: trainee1@test.com / test123

### Remaining P2 Tasks
- [ ] Trainer video intros (looping)
- [ ] Distance labels on map
- [ ] Redesign "Saved Trainers" layout with better card hierarchy
- [ ] Brand continuity pass (cohesive icons, consistent orange glow)
- [ ] Push notifications (tabled by user)
