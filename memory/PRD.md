# RapidReps PRD

## Tech Stack
React Native/Expo + FastAPI + MongoDB | Payments: Zelle | Auth: JWT

## Receipt/Invoice System (Complete)
- Receipt-logo, receipts/session/{id}, admin/receipts, trainee/receipts, trainer/receipts endpoints
- Receipts tab in both trainee and trainer bottom nav
- PDF download via expo-print with custom RapidReps Base64 logo
- "Download Receipt" buttons in Sessions tabs after admin Zelle approval

## Earnings Dashboard (Complete)
- Trainer "Funds" tab (renamed from Earnings): Daily/weekly chart, period toggles, pending balance
- Admin Dashboard: Real-time earnings trend charts (daily/weekly/6-month) via admin/earnings-summary

## Push Notifications (Complete)
- Trainee + Trainer notified on Zelle verification with deep-link to receipt screen

## UI/UX Fixes Applied
- Travel Radius: Inline slider (1-30 mi) replacing dropdown/modal on trainer edit-profile
- Achievements button: numberOfLines={1} + adjustsFontSizeToFit preventing text wrap
- Group Sessions: Changed from orange gradient to navy gradient (fixes orange-on-orange)
- "Earnings" tab renamed to "Funds"
- Admin Overview: Filters out "Unknown Trainer" entries from leaderboard
- Nearby Trainers: Web version shows clickable horizontal trainer cards linking to trainer-detail

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
- [ ] Refactor server.py (9,800+ lines) into modular route files
