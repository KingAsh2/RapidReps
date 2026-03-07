# RapidReps - Product Requirements Document

## Original Problem Statement
A full-stack fitness marketplace application (React Native/Expo frontend, FastAPI backend, MongoDB) connecting trainees with personal trainers. Features include user roles, Stripe payments, session lifecycles, instant matching, group sessions, and community feeds.

## Core Architecture
- **Frontend:** React Native / Expo Router
- **Backend:** FastAPI (Python)
- **Database:** MongoDB
- **Payments:** Stripe (Payment Sheet + Connect Express)
- **Notifications:** expo-server-sdk-python (push)
- **PDF:** wkhtmltopdf

## What's Been Implemented

### UI/UX Updates Batch 2 (March 7, 2026)
1. **Safety Center Screen:** New `/trainee/safety-center` with emergency buttons (Call 911, Report Issue), 6 safety tips, and session sharing info
2. **Report Issue Screen:** New `/trainee/report-issue` with issue type selection and description, integrates with existing `/api/safety/report` endpoint
3. **Session Active:** Added "Report an Issue" button (top-right, red accent) linking to report-issue screen
4. **Trainer Profile:** Added "Share Profile" button using React Native Share API
5. **Trainee Home:** Added "Safety Center" section at bottom of scroll view

### UI/UX Updates Batch 1 (March 7, 2026)
1. **Global Brand Color Update:** All teal buttons (#1FB8B4/#22C1C3) replaced with navy blue (#1a2a5e/#2a3a6e) across 30+ files
2. **Admin Overview:** Revenue split display fixed from 75/25 to 80/20
3. **Admin Profile:** Change password functionality added (modal + /api/auth/change-password endpoint)
4. **Admin Payments:** Cancellation policy info card added (virtual $15, in-person $20, 80/20 split)
5. **Trainer Detail:** Removed "Per Min" column from stats row
6. **Trainer Detail:** Added heart/favorite button to header actions
7. **Quick Book Section:** Improved accessibility (larger fonts, hint text, accessibility labels)
8. **Share Status:** "Train Safely" banner made more visible (white bg, border, larger text)
9. **Saved Trainers:** Heart icon on trainer profile detail page
10. **Home Address:** Added zip code field + brightened input fields
11. **Recurring Sessions:** Multi-day selection (Mon-Sun) + bulk payment pricing display
12. **Trainer Card:** Updated colors from teal to navy

### Previous Features (before this session)
- User auth (JWT), Trainee/Trainer/Admin roles
- Session booking, management, lifecycle
- Stripe payments and payouts
- GPS tracking, Push notifications
- Instant matching, group sessions, community feed placeholders
- Admin dashboard

## Prioritized Backlog

### P0 (Critical)
- Phase 1: Improve Matching & Virtual Accept (ETA-weighted scoring, 10-second accept timer)
- Phase 2: Implement Instant Workout Mode (cascading matching, "Start Workout Now")

### P1 (High)
- Phase 3: Trainer Tools (CRUD for session notes, workout plans, client progress)
- Phase 4: Group Workouts (create/join)

### P2 (Medium)
- Phase 5: Community Feed & User Progress

### P3 (Low)
- SendGrid Integration (awaiting API key)
- TypeScript strict-mode warnings (86+)

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |

## Key Files Modified This Session
- `/app/frontend/app/trainee/safety-center.tsx` - NEW
- `/app/frontend/app/trainee/report-issue.tsx` - NEW
- `/app/frontend/app/trainee/session-active.tsx` - Report Issue button
- `/app/frontend/app/trainer/(tabs)/profile.tsx` - Share Profile
- `/app/frontend/app/trainee/(tabs)/home.tsx` - Safety section
- `/app/frontend/src/constants/design.ts` - Brand colors
- `/app/frontend/src/components/admin/OverviewTab.tsx` - 80/20 split
- `/app/frontend/src/components/admin/ProfileTab.tsx` - Change password
- `/app/frontend/src/components/admin/PaymentsTab.tsx` - Cancellation policy
- `/app/frontend/app/admin/dashboard.tsx` - Password modal
- `/app/frontend/app/trainee/trainer-detail.tsx` - Per Min removed, heart btn
- `/app/frontend/app/trainee/recurring-sessions.tsx` - Multi-day, bulk payment
- `/app/frontend/app/trainee/(tabs)/profile.tsx` - Zip code
- 30+ files: teal → navy color replacement
