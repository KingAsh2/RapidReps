# RapidReps - Fitness Training App

## Original Problem Statement
A full-stack React Native/Expo fitness application connecting trainees with personal trainers. Includes session booking, Zelle payments, messaging, trainer verification, group sessions, streaks/gamification, and a mandatory in-person session verification system.

## Tech Stack
- **Frontend:** React Native / Expo (v54) with Expo Router
- **Backend:** FastAPI (Python) + MongoDB
- **Payments:** Zelle (manual verification) | **Auth:** JWT | **QR Codes:** react-native-qrcode-svg + expo-camera

## Payment Model (Zelle)
- **Trainee → RapidReps**: Trainee sends Zelle to platform's admin-configurable email/phone
- **Admin verifies**: Admin confirms receipt, session auto-confirms
- **RapidReps → Trainer**: Admin pays trainers to their Zelle accounts
- **Fee split**: 75% trainer / 25% platform (unchanged from Stripe era)
- **Default Zelle**: ashtonbundy1@gmail.com / 240-281-0462 (admin-configurable)

## Completed Features

### Zelle Payment System (April 2026)
- **Platform Zelle Settings**: Admin-configurable email/phone for receiving payments
- **Trainee Payment Flow**: View Zelle info → Send payment → Mark as sent → Admin verifies → Session confirmed
- **Trainer Zelle Setup**: Trainers save their Zelle email/phone for payouts
- **Admin Payment Verification**: Pending Zelle payments dashboard, one-click verify
- **Admin Trainer Payouts**: Manual Zelle payout tracking, batch pay-all
- **Stripe Connect fully replaced** with Zelle throughout all screens

### Uber-Like UI Components (April 2026 - COMPLETE)
1. **SessionTimeline** - Visual step-by-step progress (trainee + trainer screens)
2. **QuickActions** - Floating call/message/cancel buttons (trainee + trainer screens)
3. **TrainerBottomSheet** - Swipe-up trainer selection overlay (trainee home)
4. **LiveTrainerMap** - Real-time animated trainer position tracker (trainee tracking screen)

### Integration Map
| Screen | Components Used |
|--------|----------------|
| `trainee/(tabs)/home.tsx` | TrainerBottomSheet |
| `trainee/trainer-en-route.tsx` | SessionTimeline, QuickActions, LiveTrainerMap |
| `trainee/session-detail.tsx` | SessionTimeline (compact) |
| `trainer/en-route.tsx` | SessionTimeline, QuickActions |
| `trainee/payment.tsx` | Zelle payment instructions + mark-sent |
| `trainee/confirm-booking.tsx` | Zelle payment badge |
| `trainer/connect-bank.tsx` | Zelle setup form |
| `trainer/(tabs)/earnings.tsx` | Zelle account status |
| `admin/PayoutsTab.tsx` | Zelle payout tracking |

## Key API Endpoints
| Endpoint | Description |
|----------|-------------|
| GET /api/settings/zelle | Platform Zelle info (public) |
| PUT /api/admin/settings/zelle | Admin updates Zelle settings |
| POST /api/payments/zelle/mark-sent | Trainee marks payment sent |
| POST /api/admin/payments/verify-zelle/{id} | Admin verifies → session confirmed |
| GET /api/admin/payments/pending-zelle | Pending Zelle payments |
| POST /api/trainer/zelle-info | Trainer saves Zelle info |
| GET /api/trainer/zelle-info | Trainer gets Zelle info |
| GET /api/trainer/connect/status | Zelle-based connect status |
| GET /api/admin/payouts/pending | Trainer payout eligibility |
| POST /api/admin/payouts/pay-trainer | Mark trainer paid via Zelle |

## Remaining / Blocked Work
- [ ] EAS iOS Build: Apple Distribution Certificate expired
- [ ] SendGrid email integration (needs user API key)
- [ ] ~90 non-critical TypeScript warnings

## Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
| Trainee | test_trainee_iter25@test.com | Test123! |
| Trainer | test_trainer_iter25@test.com | Test123! |

## Test Reports
- `/app/test_reports/iteration_46.json` - Uber components API test (18/18 pass)
- `/app/test_reports/iteration_47.json` - Zelle payment system test (19/19 pass)

## MOCKED: SendGrid (awaiting API key)
