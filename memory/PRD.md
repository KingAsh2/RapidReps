# RapidReps PRD

## Tech Stack
React Native/Expo + FastAPI + MongoDB | Payments: Zelle | Auth: JWT

## User Profiles (Complete)
### Gallery
- Both trainers and trainees have a photo/video gallery on their profiles
- Gallery items: `{url, type: 'photo'|'video', caption?}`
- Endpoints: `PUT /api/trainer-profiles/{userId}/gallery`, `PUT /api/trainee-profiles/{userId}/gallery`
- ProfileGallery component with image grid, fullscreen viewer, video overlay indicator

### Social Media Links
- Both profiles support: Instagram, TikTok, YouTube, X/Twitter, Website
- Endpoints: `PUT /api/trainer-profiles/{userId}/social-links`, `PUT /api/trainee-profiles/{userId}/social-links`
- SocialLinksDisplay component with branded icons and direct links
- Trainer edit-profile has inline social links input fields

### Clickable Avatars (All Screens)
- Trainee session-detail → tapping trainer avatar opens trainer-detail
- Messages list (both roles) → tapping avatar opens other user's profile
- Chat screen → tapping header name/photo opens profile (role-aware routing)
- Leaderboard → podium and list entries tappable → trainer-detail
- Trainer home session cards → already navigated to trainee-profile
- Nearby Trainers (web) → horizontal card list with profile navigation

## Receipt/Invoice System (Complete)
- Receipt endpoints, PDF download via expo-print with RapidReps logo
- Receipts tab in both trainee/trainer bottom nav
- Download Receipt buttons in Sessions tabs after admin Zelle approval

## Earnings Dashboard (Complete)
- Trainer "Funds" tab (renamed from Earnings)
- Admin real-time earnings trend charts (daily/weekly/6-month)

## Push Notifications (Complete)
- Zelle verification → trainee + trainer notified with receipt deep-link

## UI/UX Fixes Applied
- Travel Radius: Inline slider replacing dropdown/modal
- Achievements button: numberOfLines={1} + adjustsFontSizeToFit
- Group Sessions: Navy gradient (fixes orange-on-orange)
- Earnings renamed to Funds
- Admin Overview: Filters out Unknown Trainers
- Nearby Trainers web: clickable horizontal trainer cards

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
