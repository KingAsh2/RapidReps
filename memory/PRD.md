# RapidReps PRD — Product Requirements Document

## Original Problem Statement
RapidReps is a fitness training marketplace app (React Native/Expo + FastAPI + MongoDB) connecting trainers and trainees for in-person and virtual sessions, featuring Zelle payments, push notifications, and admin management.

## Architecture
- **Frontend**: React Native (Expo) — `/app/frontend/`
- **Backend**: FastAPI — `/app/backend/server.py`, `storage.py`
- **Database**: MongoDB (local)
- **Storage**: Emergent Object Storage via `emergentintegrations`

## What's Been Implemented

### Core Features (Complete)
- User auth (JWT), roles (admin/trainer/trainee)
- Session booking, scheduling, cancellation
- Zelle payment flow with receipt/invoice PDF generation
- Push notifications with deep-linking
- Admin dashboard (users, sessions, payments, earnings summary)
- Trainer/trainee profiles with gallery, social links
- Nearby trainers map, travel radius
- Group sessions
- Chat/messaging system
- Receipt history tabs
- Object storage for media uploads

### Premium Dark Theme Redesign (April 2026)
- Dark navy/black backgrounds (`#0A0E1A`, `#141929`)
- Orange (`#FF6A00`) as accent only
- Glassmorphism cards with dark backgrounds
- Dark bottom tab bars (`#0D1117`) with orange accent
- Clear selected/active states (orange gradient + glow)
- Batch replaced all 100+ color references across 50+ files

### Premium Feature Pack (April 2026)
1. **Pulsing "Available Now" Toggle** — Dramatic pulse animation (0.85→1.15 scale) with expanding glow ring on trainer home screen
2. **Card Entrance Animations** — Staggered translate + scale spring animations on trainer cards via `cardAnim` values  
3. **Animated Earnings Graph** — New `AnimatedBarChart` component with staggered bar growth (delay per bar, 600ms duration) in admin dashboard
4. **Profile Preview Cards** — New `ProfilePreviewCard` component: long-press any trainer avatar → modal with photo, name, stats, specialties, bio, "View Full Profile" CTA with spring animation
5. **Social Media Trainer Profile** — Full hero section with blurred avatar background, IG-style stats row (Years/Sessions/Radius/Reviews), Message + Save quick-action buttons, specialties tags, video content section
6. **Sticky "Book Now" Button** — Always-visible bottom bar on trainer detail with price, duration, and gradient Book Now CTA
7. **Clickable Avatars Everywhere** — Trainer avatars in sessions, messages, home → navigate to trainer-detail. Active green dot indicators on messages.
8. **"Top Trainers Near You"** horizontal scroll section on trainee home
9. **"New Trainers"** section for trainers with <5 sessions
10. **Active Status Indicators** — Green dot on message avatars
11. **Removed URL-based media inputs** — Only file uploads via expo-image-picker

### New Components Created
- `/app/frontend/src/components/ProfilePreviewCard.tsx`
- `/app/frontend/src/components/AnimatedBarChart.tsx`
- `/app/frontend/src/theme.ts` (shared design tokens)

### Dark Theme Visibility Fixes (April 2026)
- Fixed 10 corrupted color strings across 7 files (bulk sed replacement `Light`/`Dark` suffix)
- Added `test_credentials.md` to `.gitignore`
- Verified clean build via `npx expo export --platform web`

### Comprehensive Dark Theme UI Audit (April 2026)
- **Admin Panel**: Dark modal bg (#141929), dark text inputs (#1A2035) with white text, white donut chart center value, dark growth tags, dark dividers, dark pagination buttons
- **Tab Bars**: Renamed "Messages" to "Chat" on both trainee and trainer bottom menus
- **Signup Form**: Dark gradient form card (#0A0E1A→#141929), white input labels, dark referral input
- **Onboarding-Trainer**: Dark glass inputs (rgba 10% white), white labels/chips/toggles/duration chips, dark back button borders, white text throughout
- **Trust & Safety (Verification)**: Dark card bg (rgba 20,25,41,0.95), white title/text
- **ID Verification**: "Please Hold Still" scanning text displays immediately on camera click (scan illusion)
- **Safety Center**: Solid dark fallback bg (#0A0E1A)  
- **Nearby Trainees**: Dark cards (#141929) with white text, clickable profiles (TouchableOpacity → router.push)
- **Leaderboard**: Dark list items with white text, orange points
- **Sessions Empty State**: Solid dark bg (#141929) instead of foggy rgba
- **Trainer Onboarding**: Dark status card gradient, orange progress bar fill
- **FavoriteAvailability**: Dark card backgrounds
- **Admin Safety/Verifications Tabs**: Dark card and modal backgrounds

## Prioritized Backlog

### P0 — Deployment
- ✅ All build-blocking syntax errors resolved
- ✅ `.gitignore` updated with `test_credentials.md`
- EAS iOS build still blocked on Apple Distribution Certificate (user action needed: `eas credentials`)

### P1 — Medium Priority
- SendGrid email integration (needs user API key)
- Resolve remaining TypeScript warnings (~90)
- Refactor `server.py` (9,750+ lines) into modular route files

### P2 — Nice to Have
- "Trainer Stories" feature (ephemeral workout clips, IG Stories-style)
- Card hover/press feedback animations (scale down on press)
- Entrance animations for session cards on sessions tab
- Dark theme for edge-case screens (legal, onboarding flows)

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
| Trainee | test_trainee_iter25@test.com | Test123! |
| Trainer | test_trainer_iter25@test.com | Test123! |

## Key API Endpoints
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/trainer-profiles/{userId}`
- `POST /api/gallery/upload`
- `PUT /api/trainer-profiles/{userId}/social-links`
- `PUT /api/trainer-profiles/{userId}/gallery`
- `GET /api/admin/earnings-summary`
