# RapidReps PRD

## Tech Stack
React Native/Expo + FastAPI + MongoDB + Emergent Object Storage | Payments: Zelle | Auth: JWT

## User Profiles (Complete)
### Gallery — Real Image & Video Upload
- **Upload**: `POST /api/gallery/upload` (multipart form-data) — accepts images (jpg/jpeg/png/gif/webp/heic, 10MB max) and videos (mp4/mov/avi/mkv, 100MB max)
- **Serve**: `GET /api/files/{path}` — serves files from Emergent object storage with correct content-type
- **Delete**: `DELETE /api/gallery/{index}` — removes gallery item by index
- **Storage**: Emergent integrations object storage (persistent cloud storage)
- **Frontend**: expo-image-picker — Take Photo, Photo from Library, Video from Library
- **Gallery UI**: Grid thumbnails, fullscreen viewer with swipe, video play overlay, delete from viewer
- **Both roles**: Trainer and Trainee profiles have editable galleries on self-profile tab
- **Public view**: Gallery + social links visible on trainer-detail and trainee-profile pages

### Social Media Links
- Both profiles: Instagram, TikTok, YouTube, X/Twitter, Website
- CRUD via `PUT /api/{role}-profiles/{userId}/social-links`
- Trainer edit-profile has inline input fields for all 5 platforms
- SocialLinksDisplay component with branded icons linking to platforms

### Clickable Avatars (All Screens)
- Trainee session-detail → trainer avatar opens trainer-detail
- Messages list (both roles) → avatar opens other user's profile
- Chat screen → header name/photo opens profile (role-aware)
- Leaderboard → podium + list entries → trainer-detail
- Trainer home session cards → trainee-profile
- Nearby Trainers (web) → horizontal card list → trainer-detail

## Receipt/Invoice System (Complete)
- PDF download via expo-print with RapidReps logo
- Receipts tab in both trainee/trainer bottom nav
- Download Receipt buttons after admin Zelle approval

## Earnings Dashboard (Complete)
- Trainer "Funds" tab | Admin real-time earnings trend charts

## Push Notifications (Complete)
- Zelle verification → both users notified with receipt deep-link

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
- [ ] Refactor server.py (9,900+ lines) into modular route files
