# RapidReps - Product Requirements Document

## Overview
RapidReps is a full-stack fitness marketplace connecting trainees with personal trainers for outdoor, virtual, and group workout sessions. Built with React Native (Expo) + FastAPI + MongoDB.

## Core Architecture
- **Frontend:** React Native (Expo Router) - Mobile-first app
- **Backend:** FastAPI (Python) - Modular route architecture
- **Database:** MongoDB
- **Payments:** Stripe (Payment Sheet + Connect Express)
- **Notifications:** Expo Push Notifications

## Implemented Features (Completed)

### Core Platform (v1)
- Two-sided user roles (trainee, trainer, admin)
- JWT authentication with token refresh
- Full session lifecycle (book → confirm → arrive → selfie → active → complete)
- Stripe Payment Sheet for session booking
- Stripe Connect Express for trainer payouts
- Push notifications
- Trainer verification system
- Safety features (selfie check-in, SOS button)
- Gamification (badges, streaks, achievements)
- En-route GPS tracking (trainer ↔ trainee)
- User-friendly modals for key actions

### Platform Features v2 (Completed Feb 2026)
1. **ETA-Weighted Trainer Matching** - Composite scoring: 40% ETA, 20% rating, 15% sessions, 10% price, 10% boost, 5% responsiveness
2. **Instant Workout Mode** - Uber-style cascading match with 15-second accept windows
3. **Trainer Tools** - Workout plan builder, session notes, client progress tracker
4. **Group Workout Sessions** - Create, manage, join/leave group workouts with Stripe payments
5. **Community Activity Feed** - Auto-generated posts for session completions, badge unlocks, user posts, likes
6. **Virtual Session Instant Match** - 10-second auto-matching for virtual sessions
7. **User Progress Tracking** - Total sessions, calories, minutes, streak levels, badges, workout history
8. **Navigation Entry Points** - Quick action buttons on trainee/trainer home screens for all new features

### Backend Architecture
```
backend/
├── routes/
│   ├── __init__.py       # Shared utilities (serialize_doc, get_current_user, etc.)
│   ├── matching.py       # ETA-weighted search + instant match cascading
│   ├── feed.py           # Community feed CRUD + auto-post generation
│   ├── group_sessions.py # Group workout lifecycle
│   ├── progress.py       # User progress stats + workout history
│   └── trainer_tools.py  # Plans, notes, client progress
├── server.py             # Main server (routes registered at bottom)
└── shared.py             # Shared utilities
```

### Key API Endpoints
- `GET /api/trainers/ranked-search` - ETA-weighted composite score search
- `POST /api/sessions/instant-match` - Start instant workout
- `GET /api/sessions/instant-match/{id}/status` - Poll match status
- `POST /api/sessions/instant-match/{id}/accept|decline|cancel`
- `POST /api/sessions/virtual-instant` - Virtual instant match
- `GET/POST /api/feed` - Community feed
- `POST /api/feed/{id}/like` - Toggle like
- `GET/POST /api/group-sessions` - Group sessions
- `POST /api/group-sessions/{id}/join|leave|start|complete`
- `GET /api/progress/{userId}` - User progress
- `GET /api/progress/{userId}/history` - Workout history
- `GET/POST /api/trainer-tools/workout-plans`
- `GET/POST /api/trainer-tools/session-notes`
- `GET/POST /api/trainer-tools/client-progress/{traineeId}`
- `GET /api/trainer-tools/my-clients`

### DB Collections (New)
- `feed_posts`, `group_sessions`, `instant_matches`
- `workout_plans`, `session_notes`, `client_progress`, `progress_tracking`

## Testing Status
- Backend: 100% (33/33 tests passed - iteration_32)
- All 25+ endpoints verified working
- Role-based access control confirmed
- Datetime timezone bug fixed in instant match

## Mocked Services
- SendGrid email (awaiting API key)

## Backlog
- P4: Enable SendGrid integration (blocked - needs API key)
- P5: Address 86+ TypeScript strict-mode warnings
- P5: File cleanup/refactoring

## Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
| Test Trainer | test_trainer_iter25@test.com | test123 |
| Test Trainee | test_trainee_iter25@test.com | test123 |
