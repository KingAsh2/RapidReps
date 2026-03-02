# RapidReps - Product Requirements Document

## Original Problem Statement
Build a fitness trainer-trainee matching platform with Uber-style real-time matching, virtual and in-person sessions, payments via Stripe, and comprehensive admin tools.

## Architecture
- **Frontend**: React Native / Expo (SDK 54) with Expo Router v6
- **Backend**: FastAPI (Python) on port 8001
- **Database**: MongoDB
- **Payments**: Stripe integration
- **Notifications**: Expo Push SDK + Smart Notification Engine

## ALL Features Implemented

### P0 - Top Priority (COMPLETE)
1. Uber-Style Matching Engine (ETA 40%, Rating 25%, Price 15%, Boost 10%, Responsiveness 5%, ProfileComplete 5%)
2. Smart Push Notification Engine
3. Virtual Live Video Screen + Boxing-Bell Sound
4. 508 Compliance

### P1 - Medium Priority (COMPLETE)
5. Advanced GPS Tracking (5s en route, 15s in-progress, 0.25mi/0.1mi proximity)
6. No-Show & Cancellation Automation (>12hr free, 12-2hr 25%, <2hr 50%)
7. Membership System ($19.99/mo, 10% discount, +0.15 matching bonus)
8. Boost System ($9.99/day, $49.99/week, $149.99/month)

### P2 - Secondary (COMPLETE)
9. Session Verification - Selfie Check (3-failure fallback to manual)

### Enhancements (COMPLETE)
10. Post-Session Summary - Auto-generated with calorie estimates
11. User Manual v3.0 - All 12 feedback points verified
12. Testing Checklist - 295 test cases
13. Intro video plays once only - AsyncStorage flag
14. Trainer locations updated to Elkridge, MD area
15. Admin panel: City/State displayed, all data filterable, user photos, verification workflow
16. Logo overlap fix, pulsing animation, button tap animations
17. Travel to Trainer Proximity dropdown (1-35 miles)
18. At Home session type with trainee address capture
19. Dynamic pricing: 80/20 trainer/platform split + $2 service fee
20. Terms of Service & Privacy Policy screens (legal/terms.tsx, legal/privacy.tsx)
21. Clickable Terms & Privacy links on welcome screen
22. Terms & Privacy link added to trainer profile

### Business Rules
- Revenue Split: 80% trainer / 20% platform
- Service Fee: $2.00 (200 cents) paid by trainee
- Pricing Minimums: Virtual=$30, Outdoor=$40, InHome=$60
- Membership: $19.99/month
- Boosts: Daily $9.99, Weekly $49.99, Monthly $149.99

## Test Credentials
- Admin: admin@rapidreps.com / admin123
- Trainers: trainer1@test.com, trainer2@test.com, trainer3@test.com / test123
- Trainees: trainee1@test.com, trainee2@test.com / test123

## E2E Test Results (Mar 2, 2026)
- Backend: 75/75 tests passed (100%) across 19 feature areas
- Test report: /app/test_reports/iteration_22.json
- All auth, profiles, verification, search, sessions, GPS, selfie, messaging, payments, membership, boosts, ratings, achievements, admin, notifications, downloads, pricing, and safety features verified

## Remaining Backlog
1. P3: SendGrid email integration (awaiting API key from user)
2. P4: Toast notifications using sonner component
3. P5: TypeScript strict-mode warnings cleanup (86+)
4. P5: Refactor admin dashboard (1000+ lines) into smaller components

## Mocked/Inactive
- SendGrid: No-op (awaiting API key)
- Stripe: Live keys in use but test-mode PaymentIntents
- Push notifications: Sends to Expo servers (no real devices in preview)

## Known Limitations
- Expo Router web rendering doesn't work in CI mode (pre-existing issue with Metro require.context in static output mode). App works correctly on iOS/Android via Expo Go or native builds.
