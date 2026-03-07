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

### UI/UX Updates (March 7, 2026)
1. **Global Brand Color Update:** All teal buttons (#1FB8B4/#22C1C3) replaced with navy blue (#1a2a5e/#2a3a6e) across 30+ files
2. **Admin Overview:** Revenue split display fixed from 75/25 to 80/20
3. **Admin Profile:** Change password functionality added (modal + /api/auth/change-password endpoint)
4. **Admin Payments:** Cancellation policy info card added (virtual $15, in-person $20, 80/20 split)
5. **Trainer Detail:** Removed "Per Min" column from stats row
6. **Trainer Detail:** Added heart/favorite button to header actions
7. **Quick Book Section:** Improved accessibility (larger fonts, hint text, accessibility labels)
8. **Share Status:** "Train Safely" banner made more visible (white bg, border, larger text)
9. **Saved Trainers:** Heart icon on trainer profile detail page
10. **Home Address:** Added zip code field + brightened input fields (borderWidth, higher opacity)
11. **Recurring Sessions:** Multi-day selection (Mon-Sun) + bulk payment pricing display
12. **Trainer Card:** Updated colors from teal to navy for badges and gradients

### Previous Features (Implemented before this session)
- User authentication (JWT)
- Trainee/Trainer/Admin roles
- Session booking, management, lifecycle
- Stripe payments and payouts
- GPS tracking
- Push notifications
- Instant matching, group sessions, community feed placeholders
- Admin dashboard with users, sessions, payments, payouts, verifications

## Prioritized Backlog

### P0 (Critical)
- Phase 1: Improve Matching & Virtual Accept (ETA-weighted scoring, 10-second accept timer)
- Phase 2: Implement Instant Workout Mode (cascading matching, polling-based, "Start Workout Now")

### P1 (High)
- Phase 3: Trainer Tools (CRUD for session notes, workout plans, client progress)
- Phase 4: Group Workouts (create/join group workouts)

### P2 (Medium)
- Phase 5: Community Feed & User Progress (backend logic + frontend screens)

### P3 (Low)
- Enable SendGrid Integration (blocked, awaiting API key)

### P4 (Backlog)
- Resolve 86+ TypeScript strict-mode warnings

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |

## Key Files
- `/app/backend/server.py` - Main backend server
- `/app/frontend/src/constants/design.ts` - Brand colors/design system
- `/app/frontend/app/admin/dashboard.tsx` - Admin dashboard
- `/app/frontend/app/trainee/trainer-detail.tsx` - Trainer detail screen
- `/app/frontend/app/trainee/recurring-sessions.tsx` - Recurring sessions
- `/app/frontend/app/trainee/(tabs)/profile.tsx` - Trainee profile
