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
- Converted entire app from orange overlay theme to premium dark navy/black
- Orange (`#FF6A00`) used as accent only — no more heavy orange overlays
- Glassmorphism cards with dark backgrounds (`#141929`)
- Dark bottom tab bars (`#0D1117`) with orange accent
- Clear selected/active states on all tabs and buttons (orange gradient + glow)
- Updated all screens: Home, Sessions, Profile, Trainer Detail, Messages, Admin
- Added "Top Trainers Near You" section with horizontal scroll
- Added "New Trainers" section for trainers with <5 sessions
- Added active status indicators on message avatars
- Removed URL-based media inputs (profile photo URL, intro video URL)
- Fixed NearbyTrainersMap "Book Trainer" button z-index/visibility
- Created shared theme constants (`/app/frontend/src/theme.ts`)
- Created design guidelines (`/app/design_guidelines.md`)

## Prioritized Backlog

### P0 — High Priority
- None (current UI/UX bugs resolved)

### P1 — Medium Priority
- Pulsing "Available Now" toggle animation on trainer cards
- Smooth card entrance animations (staggered reveals)
- Animated earnings graph in admin dashboard
- Profile preview cards when tapping names in feed/messages
- Full trainer profile hero section with video content area

### P2 — Important
- SendGrid email integration (needs user API key)
- Resolve remaining TypeScript warnings (~90)
- Refactor `server.py` (9,750+ lines) into modular route files

### P3 — Nice to Have
- EAS iOS build (blocked on Apple certificate — user action required)
- Dark theme for remaining edge-case screens (legal, onboarding flows)

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
| Trainee | test_trainee_iter25@test.com | Test123! |
| Trainer | test_trainer_iter25@test.com | Test123! |

## Key API Endpoints
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Current user
- `GET /api/trainer-profiles/{userId}` — Trainer profile
- `POST /api/gallery/upload` — Upload media
- `PUT /api/trainer-profiles/{userId}/social-links`
- `PUT /api/trainer-profiles/{userId}/gallery`
- `GET /api/admin/earnings-summary`
