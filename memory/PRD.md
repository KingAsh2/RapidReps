# RapidReps - Fitness Training App PRD

## Original Problem Statement
Full-stack React Native/Expo fitness app connecting trainees with personal trainers. Features: session booking, Zelle payments, messaging, trainer verification, group sessions, streaks/gamification, in-person session verification.

## Tech Stack
- **Frontend:** React Native / Expo (v54) with Expo Router
- **Backend:** FastAPI (Python) + MongoDB
- **Payments:** Zelle (manual verification) | **Auth:** JWT

## Payment Model (Zelle)
- Trainee → RapidReps: Sends Zelle to admin-configurable email/phone
- Admin verifies payment → session auto-confirms
- RapidReps → Trainer: Admin pays trainers to their Zelle accounts
- Fee split: 75% trainer / 25% platform
- Default Zelle: ashtonbundy1@gmail.com / 240-281-0462

## Completed Features (This Session)

### Zelle Payment System
- Platform Zelle settings (admin-configurable)
- Trainee payment flow: View info → Send → Mark sent → Admin verify → Session confirmed
- Trainer Zelle setup for payouts
- Admin pending payments dashboard + verification
- Admin trainer payouts (manual Zelle tracking, batch pay-all)
- Outdoor session location verification required before payment

### UI/UX Improvements
- **Profile Photo Edit**: Trainer edit-profile now has ImagePicker for photo upload/change
- **Group Sessions Visibility**: Changed orange gradient to navy for contrast
- **Achievements Button**: Fixed text overflow with numberOfLines constraint
- **Sessions Clickable**: All session cards navigate to session-detail on tap
- **Distance Slider**: Replaced dropdown with draggable slider (1-30 miles) across trainee home + trainer edit-profile
- **"Earn" Text Visibility**: Increased font size + green color contrast in set-rates
- **508 Compliance**: Fixed low-contrast text colors (0.4→0.75 opacity) across earnings, profile, set-rates screens
- **Trainer Gray Colors**: Improved gray from #5a6785 to #8a95b0 for group sessions

### Onboarding Prompts
- New trainers see Zelle setup banner on home screen
- New trainees see address setup banner on home screen
- GET /api/onboarding/status endpoint checks completion

### Uber-Like Components (Previous Session)
- SessionTimeline, QuickActions, TrainerBottomSheet, LiveTrainerMap integrated

## Key API Endpoints
| Endpoint | Description |
|----------|-------------|
| GET /api/settings/zelle | Platform Zelle info (public) |
| PUT /api/admin/settings/zelle | Admin updates Zelle settings |
| POST /api/payments/zelle/mark-sent | Trainee marks payment sent |
| POST /api/admin/payments/verify-zelle/{id} | Admin verifies payment |
| GET /api/admin/payments/pending-zelle | Pending Zelle payments |
| POST /api/trainer/zelle-info | Trainer saves Zelle info |
| GET /api/trainer/zelle-info | Trainer gets Zelle info |
| GET /api/onboarding/status | Onboarding completion check |
| GET /api/admin/payouts/pending | Trainer payout eligibility |
| POST /api/admin/payouts/pay-trainer | Mark trainer paid |

## Remaining / Blocked
- [ ] EAS iOS Build: Apple Certificate expired
- [ ] SendGrid email integration (needs API key)
- [ ] ~90 non-critical TypeScript warnings

## Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
| Trainee | test_trainee_iter25@test.com | Test123! |
| Trainer | test_trainer_iter25@test.com | Test123! |

## Test Reports
- iteration_46.json: Uber components (18/18 pass)
- iteration_47.json: Zelle payment system (19/19 pass)
- iteration_48.json: Onboarding + outdoor verification + profile photo (13/13 pass)

## MOCKED: SendGrid (awaiting API key)
