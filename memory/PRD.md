# RapidReps PRD

## Tech Stack
React Native/Expo + FastAPI + MongoDB | Payments: Zelle | Auth: JWT

## Receipt/Invoice System (Complete)
- **Backend**: `GET /api/receipt-logo` returns Base64-encoded RapidReps logo for PDF rendering
- **Backend**: `GET /api/receipts/session/{id}` returns full receipt data (session details, participants, payment breakdown, Zelle verification status)
- **Backend**: `GET /api/admin/receipts` returns all verified payment receipts for admin
- **Frontend Trainee**: `/trainee/receipt?sessionId=X` receipt screen with RapidReps logo, PDF generation via expo-print
- **Frontend Trainer**: `/trainer/receipt?sessionId=X` trainer-specific receipt showing "Your Earnings" and "Your Payout"
- **PDF Generation**: expo-print generates professional branded PDF receipts with custom RapidReps logo, expo-sharing for share/download
- **Access**: Trainee, Trainer, and Admin can all view receipts for their sessions
- **Navigation**: "Download Receipt" button on trainee + trainer sessions tabs (shown after admin Zelle approval), "Receipt" button in trainee session-detail action bar
- **Logo**: Custom RapidReps logo embedded as Base64 in PDF HTML (stored in `/app/backend/logo_b64.txt`)
- **No email receipts**: Users download PDF directly after admin approves Zelle payment

## Admin Dashboard Tabs
Overview | Users | Verifications | Sessions | Payments | Payouts | **Zelle** | Safety | Profile

### Zelle Tab Features
- Edit platform Zelle email/phone (admin-configurable)
- View pending Zelle payments with "Verify" button
- Confirmation alert before verification

## Uber-Like UI (Complete)
- SessionTimeline, QuickActions, TrainerBottomSheet integrated
- LiveTrainerMap with Google Maps tracking

## 508 Compliance (Complete)
- Color contrast fixes on orange backgrounds
- Minimum touch targets, slider inputs, onboarding banners

## Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
| Trainee | test_trainee_iter25@test.com | Test123! |
| Trainer | test_trainer_iter25@test.com | Test123! |

## Remaining
- [ ] EAS iOS Build: Apple Certificate expired (requires user to run `eas credentials`)
- [ ] SendGrid email integration (needs user API key)
- [ ] ~90 non-critical TypeScript warnings
- [ ] Refactor server.py (9,300+ lines) into modular route files

## MOCKED: SendGrid (awaiting API key)
