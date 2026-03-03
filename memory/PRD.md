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
16. Logo overlap fix, pulsing animation (4x enlarged), button tap animations
17. Travel to Trainer Proximity dropdown (1-35 miles)
18. At Home session type with trainee address capture
19. Dynamic pricing: 80/20 trainer/platform split + $2 service fee
20. Terms of Service & Privacy Policy screens (legal/terms.tsx, legal/privacy.tsx)
21. Clickable Terms & Privacy links on welcome screen and both profiles

### Referral System (Mar 2, 2026)
22. **Referral System** - Both trainers & trainees can refer
    - Unique referral codes (format: RR-XXXXXX)
    - $5 credit for referrer + $5 for new user
    - Credits activate ONLY after new user books first session (protects revenue)
    - Credits auto-apply as discount on next booking (deducted from platform fee, not trainer earnings)
    - Max 5 referrals per user
    - Referral code input on signup form
    - Dedicated "Refer & Earn" screen accessible from both trainee and trainer profiles
    - API endpoints: /api/referral/my-code, /api/referral/stats, /api/referral/validate/{code}, /api/referral/credits

### Bug Fixes (Mar 3, 2026)
23. **TestFlight Crash Fix** - Fixed 3 crash-causing animation patterns:
    - Inline `Animated.multiply()`/`Animated.add()` in JSX render → moved to `useRef`
    - Leaked `setInterval` in ring wave animations → replaced with `Animated.loop`
    - Recursive `logoPulse()` callback → replaced with `Animated.loop`
24. **Blue Emergent Icon Fix** - Replaced default Emergent icon.png and adaptive-icon.png with RapidReps logo on brand orange
25. **Splash Screen Fix** - Regenerated splash-image.png with RapidReps branding
26. **DB Query Optimizations** - 4 queries optimized with field projections and count_documents
27. **Change Password** - Users can change their password from profile (both trainee + trainer). Backend validates current password, enforces min 6 chars, updates hash in DB. Accessible via Profile → Change Password.

### Business Rules
- Revenue Split: 80% trainer / 20% platform
- Service Fee: $2.00 (200 cents) paid by trainee
- Pricing Minimums: Virtual=$30, Outdoor=$40, InHome=$60
- Membership: $19.99/month
- Boosts: Daily $9.99, Weekly $49.99, Monthly $149.99
- Referral Credit: $5.00 (500 cents) per activated referral
- Max Referrals: 5 per user

## Test Credentials
- Admin: admin@rapidreps.com / admin123
- Trainers: trainer1@test.com, trainer2@test.com, trainer3@test.com / test123
- Trainees: trainee1@test.com, trainee2@test.com / test123
- Trainee: ashton1@gmail.com / test1234

## E2E Test Results
- Backend iteration 22: 75/75 tests passed (100%) - all core features
- Backend iteration 23: 29/29 tests passed (100%) - referral system + regression

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
- Web preview: Requires patched `_ctx.web.js` in expo-router + Stripe web shim for web rendering. Run `scripts/patch-expo-router.sh` after `yarn install`. Native iOS/Android builds work natively without patches.
- Stripe payments are not available on web (shimmed with no-op). Full Stripe functionality on native only.
- Push notifications: Sends to Expo servers (no real devices in preview)
