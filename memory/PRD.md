# RapidReps - Product Requirements Document

## Original Problem Statement
Build a fitness trainer-trainee matching platform with Uber-style real-time matching, virtual and in-person sessions, payments via Stripe, and comprehensive admin tools.

## Architecture
- **Frontend**: React Native / Expo with Expo Router
- **Backend**: FastAPI (Python) on port 8001
- **Database**: MongoDB
- **Payments**: Stripe integration
- **Notifications**: Expo Push SDK + Smart Notification Engine

## ALL Features Implemented

### P0 — Top Priority (COMPLETE)
1. Uber-Style Matching Engine (ETA 40%, Rating 25%, Price 15%, Boost 10%, Responsiveness 5%, ProfileComplete 5%)
2. Smart Push Notification Engine
3. Virtual Live Video Screen + Boxing-Bell Sound
4. 508 Compliance

### P1 — Medium Priority (COMPLETE)
5. Advanced GPS Tracking (5s en route, 15s in-progress, 0.25mi/0.1mi proximity)
6. No-Show & Cancellation Automation (>12hr free, 12-2hr 25%, <2hr 50%)
7. Membership System ($19.99/mo, 10% discount, +0.15 matching bonus)
8. Boost System ($9.99/day, $49.99/week, $149.99/month)

### P2 — Secondary (COMPLETE)
9. Session Verification — Selfie Check (3-failure fallback to manual)

### Enhancements (COMPLETE)
10. Post-Session Summary — Auto-generated with calorie estimates
11. User Manual v3.0 — All 12 feedback points verified
12. Testing Checklist — 295 test cases

### Recent Changes (Feb 2026)
13. Intro video plays once only — AsyncStorage flag
14. Trainer locations updated to Elkridge, MD area — All 6 trainers within 20 miles
15. Admin panel: City/State displayed for trainers and trainees
16. Admin panel: All data filterable — Users (search + role), Sessions (status + type), Transactions (status + type)
17. Logo overlap fix — Reduced size, fixed tagline margin, cleaned up backing
18. **Travel to Trainer Proximity dropdown** — 1-35 miles dropdown on trainee home screen, filters trainers by distance

## Key Files Modified
- `/app/frontend/app/trainee/(tabs)/home.tsx` — Proximity dropdown, filter logic
- `/app/frontend/app/admin/dashboard.tsx` — City/State, search, filters
- `/app/frontend/app/index.tsx` — Intro video once, logo fix
- `/app/backend/server.py` — Admin search/filter endpoints

## Test Credentials
- Admin: admin@rapidreps.com / admin123
- Trainers: trainer1@test.com, trainer2@test.com / test123
- Trainees: trainee1@test.com, trainee2@test.com / test123

## Remaining Backlog
1. SendGrid email integration (awaiting API key)
2. TypeScript strict-mode warnings cleanup (86+)
3. Toast notifications using sonner component

## Mocked/Inactive
- SendGrid: No-op (awaiting API key)
- Stripe: Mock payment intents for testing
- Push notifications: Sends to Expo servers (no real devices)
