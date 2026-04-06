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

## Completed Features

### Admin Zelle Settings Tab
- New "Zelle" tab in admin dashboard
- View/edit platform Zelle email and phone
- Pending Zelle payments list with one-click "Verify" button (with confirmation alert)
- Auto-refreshes data on tab load

### Zelle Payment System
- Platform Zelle settings (admin-configurable)
- Trainee payment flow: View info → Send → Mark sent → Admin verify → Session confirmed
- Trainer Zelle setup for payouts
- Admin pending payments dashboard + verification
- Admin trainer payouts (manual Zelle tracking, batch pay-all)
- Outdoor session location verification required before payment

### UI/UX Improvements
- Profile Photo Edit: Trainer edit-profile with ImagePicker
- Group Sessions Visibility: Navy gradient (fixed orange-on-orange)
- Achievements Button: Fixed text overflow
- Sessions Clickable: Navigate to session-detail on tap
- Distance Slider: 1-30 miles (replaced dropdown) across all screens
- "Earn" Text: Improved font size and green color
- 508 Compliance: Fixed low-contrast text across all screens
- Onboarding Prompts: Trainer → Zelle setup banner; Trainee → Address banner

### Uber-Like Components
- SessionTimeline, QuickActions, TrainerBottomSheet, LiveTrainerMap

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
- iteration_46: Uber components (18/18 pass)
- iteration_47: Zelle payment system (19/19 pass)
- iteration_48: Onboarding + outdoor verification (13/13 pass)

## MOCKED: SendGrid (awaiting API key)
