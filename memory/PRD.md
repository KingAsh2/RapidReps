# RapidReps - Product Requirements Document

## Original Problem Statement
A full-stack fitness marketplace application (React Native/Expo frontend, FastAPI backend, MongoDB) connecting trainees with personal trainers.

## Core Architecture
- **Frontend:** React Native / Expo Router
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Payments:** Stripe (Payment Sheet + Connect Express)
- **Notifications:** expo-server-sdk-python (push)

## Implementation Status

### All Phases Complete

**Phase 1: Matching & Virtual Accept** - COMPLETE
- ETA-weighted composite scoring (distance 40%, rating 20%, sessions 15%, price 10%, boost 10%, responsiveness 5%)
- `/api/trainers/ranked-search` returns trainers sorted by compositeScore
- 10-second accept timer for virtual sessions

**Phase 2: Instant Workout Mode** - COMPLETE
- Cascading polling-based matching at `/api/sessions/instant-match`
- Accept/decline/cancel flows with status polling
- Frontend screen at `/trainee/instant-match`

**Phase 3: Trainer Tools** - COMPLETE
- CRUD for workout plans, session notes, client progress
- Backend: `/api/trainer-tools/*` endpoints
- Frontend: `/trainer/trainer-tools` with tabs (clients/plans/notes)

**Phase 4: Group Workouts** - COMPLETE
- Create/join/leave/start/complete group sessions
- Backend: `/api/group-sessions/*` endpoints
- Frontend screens for both trainee and trainer

**Phase 5: Community Feed & User Progress** - COMPLETE
- Feed with auto-generated posts (session complete, badge unlock, streak milestone)
- User-created posts, likes system
- Progress tracking with streak levels, calorie estimates, consistency scores
- Backend: `/api/feed/*` and `/api/progress/*`
- Frontend: `/trainee/feed` and `/trainee/user-progress`

### UI/UX Updates (March 7, 2026)
- Global teal→navy blue (#1a2a5e/#2a3a6e) across 40+ files
- Admin: 80/20 revenue split, change password, cancellation policy card
- Trainer Detail: Removed Per Min column, added heart/favorite button
- Quick Book: Improved accessibility
- Share Status: "Train Safely" banner visibility improved
- Home Address: Added zip code field, brightened inputs
- Recurring Sessions: Multi-day selection, bulk payment pricing
- Safety Center screen, Report Issue screen
- Share Profile button on trainer profile
- Safety section on trainee home

### 23 UI/UX Screenshot Updates (March 8, 2026)
All 23 requested changes implemented and tested (iteration_37.json - 100% pass):

1. **#1 Location text visibility** - Changed gray help text to white on orange background (onboarding-trainer.tsx)
2. **#2 Scan ID** - Identity verification now opens camera with "Scan ID" button instead of file upload
3. **#3 TruthFinder PII modal** - Background check collects PII (name, DOB, SSN, address) for admin review via TruthFinder, replacing Checkr
4. **#4 Not Certified option** - Added "Not Certified" button for Fitness & CPR certifications
5. **#5 Hold for Resubmission** - Submit button always visible; shows "Hold for Resubmission" on updates
6. **#6 Clickable admin stat tiles** - Platform Stats tiles navigate to relevant tabs on tap
7. **#7 Hamburger menu** - Replaced 4 header icons with single hamburger menu + dropdown (both home screens)
8. **#8 Larger profile photo + fix name** - Hero profile photo enlarged to 90px, greeting shows actual first name
9. **#9 Stripe Connect duplicate fix** - Backend handles existing accounts gracefully, finds by email if duplicate error
10. **#10 Boosts audit** - Confirmed end-to-end: purchase, activation, search ranking boost, analytics tracking
11. **#11 Referrals audit** - Confirmed end-to-end: code generation, tracking, credit system
12. **#12 Share Profile deep link** - Updated to use `rapidreps://trainer/{id}` deep link + download link
13. **#13 Keyboard overlap fix** - Added KeyboardAvoidingView to onboarding, verification, and profile screens
14. **#14 Remove floating Start Training** - Removed obstructive floating action button from trainee home
15. **#15 Push notifications audit** - Confirmed Expo Push API implementation for instant match and sessions
16. **#16 Favorites toggle** - New `/api/trainee/toggle-favorite/{id}` endpoint + wired heart button
17. **#17 Hide price split** - Removed trainer/platform split from trainee booking confirmation
18. **#18 Recurring sessions redesign** - "Sessions Per Week" (2-7), price from trainer rates, no split shown
19. **#19 Trainee sessions show bootcamps** - Group sessions appear in trainee "Upcoming" tab
20. **#20 Achievements alignment** - Fixed tile text size and alignment
21. **#21 Group session edit** - New PUT `/api/group-sessions/{id}` endpoint + edit modal for creator
22. **#22 Trainer sessions show group sessions** - Group sessions appear in trainer "Upcoming" tab
23. **#23 Login page brightness** - Reduced overlay opacity from 0.85 to 0.65

### 508 ADA Compliance & UX Animations (March 8, 2026)
- All text colors upgraded to 4.5:1+ contrast ratio (WCAG 2.1 AA)
- All font sizes enforced minimum 13px (no text below 13px in entire app)
- Haptic feedback added to key interactions (booking, rating, verification, navigation)
- Accessibility labels on all tab navigation screens (10 tabs labeled)
- KeyboardAvoidingView on all form screens
- Created utility modules: accessibility.ts, animations.ts, haptics.ts
- Testing: iteration_38.json - 100% pass (11/11 backend, full frontend code verification)

### Login Screen Redesign (March 8, 2026)
- Rewrote login screen to match main/welcome screen design exactly
- Same bright orange gradient overlay, background image (battle ropes), pulsating logo with glow
- Same "WELCOME BACK / LET'S GET TO WORK" tagline style matching "YOUR WORKOUT / DELIVERED RAPIDLY"
- Input icons use white circles (matching main screen value prop icons)
- AnimatedPillButton for login button (same as main screen CTAs)
- Haptic feedback on login, error, and warning states
- Lock shake animation on password focus
- Full 508 compliance maintained

### Screen Transitions (March 8, 2026)
- Added `AnimatedScreen` reusable wrapper component (fade + slide-up entrance, 350ms)
- Applied transitions to Safety Center and Report Issue screens
- Verified all other screens already had entrance animations
- Tasteful, not overdone - 350ms duration, 18px slide distance

## Remaining Backlog
- P3: SendGrid Integration (awaiting API key)
- P4: TypeScript strict-mode warnings (86+)

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
