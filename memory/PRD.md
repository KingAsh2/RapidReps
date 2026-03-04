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
27. **Change Password** - Users can change their password from profile (both trainee + trainer)
28. **Error Boundary** - App-wide error boundary prevents white-screen crashes, shows recovery UI
29. **Toast Notifications** - `react-native-toast-message` integrated app-wide for non-blocking feedback
30. **UI Fixes (Mar 3):**
    - Back button in signup moved down from `top: 12` to `top: 50` (was overlapping notch/status bar)
    - Referral code input visibility: brighter background (35% white), darker placeholder text (50% black), white icon
    - Travel Radius changed from TextInput to dropdown picker (1-35 miles) in both edit-profile and onboarding
31. **Sound Effects Fix** - Enabled `playsInSilentModeIOS: true` and wired `playTap()` into AnimatedPillButton for all major button taps
32. **P0 Login Fix (Mar 3)** - Fixed critical TestFlight login failure:
    - Root cause: Login screen made a redundant second API call via raw `axios.get(process.env.EXPO_PUBLIC_BACKEND_URL/api/auth/me)` which could fail silently in production builds, and the generic error handler showed "Invalid email or password" for ALL errors including network/URL failures
    - Fix: AuthContext.login() now returns User object directly; login screen uses returned data for routing instead of second API call
    - Added differentiated error messages: 401 (wrong credentials), 429 (rate limit), network errors, and generic failures
    - Added admin redirect to useEffect navigation backup
    - Version bumped to 1.2.0 (build 3) for new TestFlight upload

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
- Backend iteration 24: 22/22 tests passed (100%) - change password, all logins, DB optimizations
- Backend iteration 25: 16/17 tests passed (94%) - bug fixes: cancel, pricing, photos, notifications (1 skipped: session flow needs verified trainer)
- Backend iteration 26: 16/16 tests passed (100%) - Stripe Connect Express payouts: onboard, status, admin pay-trainer, pay-all, history

## Remaining Backlog
1. P3: SendGrid email integration (awaiting API key from user)
2. P4: TypeScript strict-mode warnings cleanup (86+)
3. P5: Refactor admin dashboard (1800+ lines) into smaller components

### Toast Migration (Mar 4, 2026)
45. **Alert.alert → Toast Migration** - Converted 54 of 60 Alert.alert calls to non-blocking toast notifications:
    - 3 styles only: Success (green border), Warning (orange border), Error (red border)
    - Custom toast config with clean, minimal design (white card, colored left border, bold text)
    - 6 confirmation dialogs remain as Alert.alert (require Cancel/OK action buttons)
    - Cleaned unused Alert imports from 7 files
    - Added toast import to 16 files across the app

### Recent Changes (Mar 4, 2026)
33. **Messages Page Fix** - Added back button and proper header to messages screen (was trapping users)
34. **At Home Safety Modal** - Updated "Let's Go" / "Change Session" buttons for at-home session booking consent
35. **Trainee Address Fields** - Replaced single address field with Street Address, City, and US State dropdown
36. **Admin Individual Doc Approval** - Admin can now approve/reject each verification document individually with per-step buttons
37. **Admin Document Viewer** - Admin can now open/view all submitted verification documents (View button)
38. **Trainer Profile Photo on Home** - Profile photo displayed above "Let's Train" banner on trainer home page
39. **Trainer Set Rates Screen** - New dedicated screen for trainers to set hourly rates per session type (Outdoor, Virtual, At Home) with 80/20 split calculation
40. **Admin Attention Section** - Moved "Attention Needed" section above Session Status pie chart for better visibility
41. **Verification Status Text** - "Under Review" / "Approved" states properly reflected in both admin and trainer views
42. **Hide Submit Button** - Hold-to-submit button hidden after all required documents are submitted
43. **Push Notification on Approval** - Backend sends push notification to trainer when admin approves verification (individual step or full approval)
44. **Backend URL Hardcoded Fallback** - Production URL fallback ensures native builds always have valid backend URL

### Bug Fixes & Enhancements (Mar 4, 2026 - Session 2)
46. **P0: Session Cancellation Fix** - Fixed `session._id` → `session.id` in trainee sessions (tab) cancel flow. Backend cancel endpoint was working, frontend was passing undefined
47. **P0: Trainer Navigate/Message Buttons Fix** - Fixed `handleNavigate` to use `traineeLatitude`/`traineeLongitude` fields instead of non-existent `traineeLocation` object. Fixed `handleCall` to also check params.
48. **P0: Trainer Decline Session Fix** - Replaced mock delay with actual `trainerAPI.declineSession()` call in trainee-profile.tsx
49. **P1: Session Pricing Fix** - Added $2 service fee to confirm-booking.tsx price breakdown. Pricing chain now passes `sessionType` and `priceCents` through trainer-detail → schedule-training → confirm-booking
50. **P2: Profile Photos on Session Cards** - Backend `GET /api/trainer/sessions` and `GET /api/trainee/sessions` now do user lookups to populate `trainerName`, `traineeName`, `trainerPhoto`, `traineePhoto`, `traineePhone`
51. **P2: Push Notifications Enhanced** - Push notifications now include `priority: "high"`, `badge: unread_count`, and `channelId: "default"` for reliable background delivery
52. **P2: Unread Message Count Badges** - Added `unreadMessageCount` to NotificationContext, polls every 30s. Tab bars on both trainee and trainer layouts now show badge count on Messages tab
53. **P2: Notification Refresh on Message** - Notification context now also refreshes message counts when push notifications are received

### Stripe Connect Payouts (Mar 4, 2026 - Session 2)
54. **Stripe Connect Express Onboarding** - Trainers can link bank account via Stripe Express. New screen at `/trainer/connect-bank`. Creates Express account + onboarding URL.
55. **Admin Payout Management** - New "Payouts" tab on admin dashboard. Shows pending trainer balances, "Pay Now" per-trainer button, "Pay All" batch button. $35 minimum threshold.
56. **Payout History** - Both admin (all payouts) and trainer-facing (via earnings) payout history with dates, amounts, and Stripe transfer IDs.
57. **Trainer Home Banner** - Shows "Connect Your Bank Account" banner on trainer home if bank not linked.
58. **Updated Earnings Page** - Replaced old payout request modal with Stripe Connect status + manage link. Updated 80/20 split info text.
**NOTE:** Stripe Connect requires activation on the platform Stripe account. Visit https://dashboard.stripe.com/connect to enable it.

## Mocked/Inactive
- SendGrid: No-op (awaiting API key)
- Stripe: Live keys in use but test-mode PaymentIntents
- Push notifications: Sends to Expo servers (no real devices in preview)

## Known Limitations
- Web preview: Requires patched `_ctx.web.js` in expo-router + Stripe web shim for web rendering. Run `scripts/patch-expo-router.sh` after `yarn install`. Native iOS/Android builds work natively without patches.
- Stripe payments are not available on web (shimmed with no-op). Full Stripe functionality on native only.
- Push notifications: Sends to Expo servers (no real devices in preview)
