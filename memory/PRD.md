# RapidReps - Product Requirements Document
## "Uber for Personal Training"

### Original Problem Statement
Build a production-ready mobile app connecting trainees with personal trainers. Handles session booking, payments, verification, and admin management.

### Architecture
- **Frontend**: React Native (Expo) with Expo Router
- **Backend**: FastAPI (Python) with MongoDB
- **Payments**: Stripe | **Maps**: Google Maps API
- **Build**: EAS | **Deployment**: TestFlight (iOS)

---

### Implemented Features

#### Core
- [x] Auth (JWT, role-based: Trainee/Trainer/Admin)
- [x] Trainer 7-step verification
- [x] Session booking with Stripe payments (75/25 revenue split)
- [x] Membership ($19.99/mo), Trainer Boosts, Earnings Dashboard
- [x] Messaging system, Rating/Review system

#### Admin Dashboard V2 (Feb 27)
- [x] Enriched sessions (trainer/trainee names, location, home address, duration tracking)
- [x] User management (view, detail, remove with cascade delete)
- [x] Transaction management (refund via Stripe, confirm payments)
- [x] Admin messaging to any user
- [x] Admin profile editing
- [x] Verification tab (approve/reject)
- [x] Overview stats dashboard
- [x] Security (passwordHash excluded, auth required)

#### Streaks / Consistency Points (Feb 27)
- [x] `GET /api/streaks/me` - consecutive-week streaks + consistency points
- [x] Streak levels: none -> warming (2wk) -> fire (4wk) -> blazing (8wk) -> legend (12wk)
- [x] Points: sessions*10 + streak_weeks*25 + total_minutes//10
- [x] Animated streak cards on trainee + trainer profiles
- [x] Streak banner on achievements page

#### Achievement System (Updated Feb 27)
- [x] 12 badges: 10 original + Streak Star (4-week streak) + Duration Master (500 min)
- [x] Safe access for missing session fields

#### Weekly Leaderboard (Feb 27)
- [x] `GET /api/leaderboard/weekly` - ranked by consistency points
- [x] Animated podium for top 3, personal rank banner
- [x] Accessible from trainee + trainer profile pages
- [x] Admin users excluded from rankings

#### Trainer Video Intros (Feb 27)
- [x] Video playback on trainer detail page using expo-av
- [x] Auto-playing, looping, muted video section with overlay

#### Distance Labels (Feb 27)
- [x] Distance displayed on map pins below trainer markers
- [x] Distance already on trainer cards (home screen + saved)
- [x] Enhanced saved trainer cards with distance display

#### UI/UX Visual Polish (Feb 27)
- [x] Heart pulse animation on saved trainers
- [x] Enhanced card shadows (deeper depth on trainer + saved cards)
- [x] CTA button elevation shadows (book buttons with orange glow)
- [x] Brand continuity: emoji removed from headers, consistent Ionicons

#### Trainee Profile
- [x] Home address field for in-home training sessions

---

### Backend Test Results
- Iteration 7: 26/26 PASSED (Admin Panel V2)
- Iteration 8: 14/14 PASSED (Streaks + Achievements)
- **Iteration 9: 15/15 PASSED** (Leaderboard + Full Regression)
- **Total: 55/55 tests passed across all iterations**

### API Endpoints
**Admin:** dashboard, sessions, users, transactions-enriched, verifications, delete user, refund, confirm-payment, profile update, message
**Streaks:** `GET /api/streaks/me`
**Leaderboard:** `GET /api/leaderboard/weekly`

### Test Credentials
- **Admin**: admin@rapidreps.com / admin123
- **Trainer**: trainer1@test.com / test123
- **Trainee**: trainee1@test.com / test123

### Remaining Backlog
- [ ] Push notifications (tabled by user)
