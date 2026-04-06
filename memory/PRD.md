# RapidReps PRD

## Tech Stack
React Native/Expo + FastAPI + MongoDB | Payments: Zelle | Auth: JWT

## Receipt/Invoice System (Latest)
- **Backend**: `GET /api/receipts/session/{id}` returns full receipt data (session details, participants, payment breakdown, Zelle verification status)
- **Backend**: `GET /api/admin/receipts` returns all verified payment receipts for admin
- **Frontend**: `/trainee/receipt?sessionId=X` beautiful receipt screen with RapidReps branding
- **PDF Generation**: expo-print generates professional PDF receipts, expo-sharing for share/download
- **Access**: Trainee, Trainer, and Admin can all view receipts for their sessions
- **Navigation**: "Receipt" button added to session-detail action bar

## Admin Dashboard Tabs
Overview | Users | Verifications | Sessions | Payments | Payouts | **Zelle** | Safety | Profile

### Zelle Tab Features
- Edit platform Zelle email/phone (admin-configurable)
- View pending Zelle payments with "Verify" button
- Confirmation alert before verification

## Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
| Trainee | test_trainee_iter25@test.com | Test123! |
| Trainer | test_trainer_iter25@test.com | Test123! |

## Remaining
- [ ] EAS iOS Build: Apple Certificate expired
- [ ] SendGrid email integration (needs API key)
- [ ] Replace text logo with actual RapidReps logo (user will share)
- [ ] ~90 non-critical TypeScript warnings

## MOCKED: SendGrid (awaiting API key)
