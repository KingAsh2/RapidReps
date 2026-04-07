# RapidReps PRD

## Tech Stack
React Native/Expo + FastAPI + MongoDB | Payments: Zelle | Auth: JWT

## Receipt/Invoice System (Complete)
- `GET /api/receipt-logo` - Base64-encoded RapidReps logo for PDFs
- `GET /api/receipts/session/{id}` - Full receipt data for any authorized role
- `GET /api/admin/receipts` - Admin: all verified receipts
- `GET /api/trainee/receipts` - Trainee: their verified receipt history
- `GET /api/trainer/receipts` - Trainer: their receipt history with earnings
- Trainee + Trainer: "Receipts" tab in bottom nav showing all verified Zelle payments
- PDF download via expo-print with custom RapidReps logo (Base64 embedded)
- "Download Receipt" buttons in Sessions tabs after admin Zelle approval

## Earnings Dashboard (Complete)
- **Trainer Earnings Tab**: Daily/weekly bar chart, period toggles, pending balance, Zelle connect status, recent sessions, payout requests
- **Admin Dashboard Earnings Trend**: Real-time revenue charts replacing hardcoded data
  - `GET /api/admin/earnings-summary` - Platform-wide earnings with daily (7 days), weekly (current month), monthly (6 months) breakdowns
  - Period toggles: This Week / This Month / 6 Months
  - Revenue total with % change vs last period
  - Platform revenue (20%) breakdown per period
  - Bar charts driven by real verified Zelle payment data

## Admin Dashboard Tabs
Overview (with earnings charts) | Users | Verifications | Sessions | Payments | Payouts | Zelle | Safety | Profile

## Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
| Trainee | test_trainee_iter25@test.com | Test123! |
| Trainer | test_trainer_iter25@test.com | Test123! |

## Remaining
- [ ] EAS iOS Build: Apple Certificate expired (user must run `eas credentials`)
- [ ] SendGrid email integration (needs user API key)
- [ ] ~90 non-critical TypeScript warnings
- [ ] Refactor server.py (9,700+ lines) into modular route files

## MOCKED: SendGrid (awaiting API key)
