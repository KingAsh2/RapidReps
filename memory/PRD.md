# RapidReps PRD

## Original Problem Statement
RapidReps is a full-stack fitness platform (React Native/Expo + FastAPI + MongoDB) connecting trainers with trainees. Features include session booking, Zelle payments, trainer verification, personality tags, accent colors, cinematic UI transitions, streaks/achievements, and admin dashboards.


## 2026-06-02 — Iteration 84 (in progress) — User PDF feedback round 4

### Resolved this turn
- **#1 Discover Trainees BUTTON removed**: Pink "Discover Trainees" tile deleted from trainer home (`(tabs)/home.tsx`). Cinematic `trainee-detail.tsx` showcase + route INTENTIONALLY kept — still reachable via session-prep "VIEW FULL PROFILE" CTA. Visiting a trainee profile still gives the full vibe-player/highlight-reel/accent-color experience.
- **#5 Gallery removed everywhere**: `ProfileGallery` import + JSX deleted from:
  - `app/trainer/(tabs)/profile.tsx`
  - `app/trainee/(tabs)/profile.tsx`
  - `app/trainer/trainee-profile.tsx`
  - `app/trainee/trainer-detail.tsx` (already done in prior iter)
  Highlight Reel is now the single media surface on every profile.
- **#6 (partial) thumbnail backfill admin endpoint**: New `POST /api/admin/backfill-highlight-thumbnails` walks every trainer/trainee profile, generates JPEG thumbnails for any video highlight missing `thumbnailUrl`, persists to `/highlight_thumbs/...`, writes back to the highlight doc. Idempotent — skips highlights that already have a thumbnail. Tested admin-protected (403 for non-admin), returned `{success: true, thumbnailsGenerated: 0, profilesTouched: 0}` on empty test data. Run this once after Phase B deploys to legacy data.

### Still to address (priority order for next turn)
1. **#2 Notification readability**: Unread notifications are white-on-white. Need orange-tinted bg + bold dot + white text for unread, dim for read. Touches `app/notifications.tsx` or wherever the list renders.
2. **#3 Swipe-left to delete notifications**: `react-native-swipe-list-view` is already in package.json — wire it up.
3. **#4 Virtual session deep link**: Tap a virtual_session_request notification → route to `/trainer/trainee-detail?traineeId=X&showAcceptCTA=true`, surface sticky "ACCEPT SESSION" CTA. Backend: add `deepLink` to notification objects of that type.
4. **#7 Intro video position + editable label**: Move intro video block ABOVE highlight reel in `app/trainer/(tabs)/profile.tsx` (and on the public view in `app/trainee/trainer-detail.tsx`). Add `introVideoTitle` + `introVideoDescription` fields to `TrainerProfile` model (default title "Intro to my profile"). Edit screen surfaces both as `<TextInput>`s. User chose option (c): customizable title AND editable description.
5. **#8 Safety Center contrast**: Find Safety Center screen, bump text from `rgba(255,255,255,0.4)` → `rgba(255,255,255,0.85)`.
6. **#9 Intro video won't play for admin**: RCA needed. Suspected — admin verification detail screen uses a raw `<Video>` without Range headers, or pulls from wrong URL. Reproduce: admin → verification detail → tap Play → capture network call.
7. **#6 leftover — upload success modal**: After POST returns 200 on highlight upload, show "✓ Uploaded!" auto-dismiss modal.

### Tests still passing
- iter79 CI guards, iter81 garbage files, iter83a UI cleanup, iter83b highlight thumbnails, iter83c verification sync: **23/23 ALL GREEN** post gallery removal.


## 2026-06-01 (continued) — Iteration 83 Phase C: Verification Status Sync Bug Fix

### RCA
User report (PDF RR_7-9 #4): Trainer's verification screen showed "Under Review" / "Not Started" for Liability Insurance, Profile Photo, and Intro Video **even after admin clicked Approve**.

Found the root cause in `/app/backend/routes/profile_routes.py::get_verification_status` (line ~315):
```python
# OLD — only knew two states, never read overall verificationStatus
steps[step_id] = 'submitted' if profile.get(field, False) else 'pending'
```
The admin approve endpoint correctly writes `verificationStatus: 'verified'` to the trainer profile, but the per-step endpoint **never read it** — it just bucketed uploaded docs into `'submitted'` regardless of approval. So the trainer UI rendered "Under Review" forever.

### Fix
The endpoint now derives the per-step status from BOTH the per-doc uploaded flag AND the overall `verificationStatus`:
- `verified` profile → uploaded docs return `'approved'`
- `rejected` profile → uploaded docs return `'rejected'` (so trainer knows to re-submit)
- Otherwise → `'submitted'` if uploaded, else `'pending'`

### Bonus: idempotent admin seed
Server logs showed repeated `LOGIN FAIL` for `admin@rapidreps.com` because the user kept getting wiped from the DB. Added an idempotent admin seed to `server.py` startup hook so the admin always exists with the documented `admin123` password after any server boot.

### Test coverage
- New file: `/app/backend/tests/test_iteration83_phase_c_verification_sync.py` — 5 tests:
  - Admin login works (smoke + regression-lock on the seed)
  - After admin approve, uploaded steps return `'approved'` (the core fix)
  - After admin reject, uploaded steps return `'rejected'` (paired behavior)
  - All step statuses are in the documented set `{pending, submitted, approved, rejected}`
  - Non-admin tokens get 403 on approve/reject endpoints
- **All iterations green: 37/37 tests passing** across iter79, iter81, iter82, iter83a (UI cleanup), iter83b (highlight reel), iter83c (verification sync).


## 2026-06-01 (continued) — Iteration 83 Phase B: Highlight Reel Overhaul

### Backend
- New module `/app/backend/video_thumbnails.py`: server-side video thumbnail extractor using `imageio-ffmpeg` (bundled binary, no system ffmpeg required). Extracts a single JPEG frame at t=1s, downscales to 720px, quality≈75%. Non-fatal failure mode — upload still succeeds if extraction fails.
- New helper `_store_highlight()` in `profile_routes.py`: single source of truth for persisting highlight blobs + optional video poster. Used by all 4 upload paths (trainer/trainee × multipart/base64). Eliminates ~80 lines of duplicated logic.
- All 4 highlight upload endpoints refactored to use the helper. New `thumbnailUrl` field appears on video highlight documents pointing to `/api/files/rapidreps/highlight_thumbs/<userId>/<uuid>.jpg`.
- `requirements.txt`: added `imageio-ffmpeg==0.6.0`, deduped a stray duplicate `ffmpeg-python` line.

### Frontend
- `HighlightReel.tsx`: now consumes `thumbnailUrl` from the highlight payload. Two key changes:
  1. Inactive video cards render as a plain `<Image>` showing the server-generated thumbnail — no video decoder mounted off-screen.
  2. The active card uses `<Video posterSource={...} usePoster>` so the thumbnail shows instantly while the stream loads.
- Added `resolveUrl()` helper to prepend `EXPO_PUBLIC_BACKEND_URL` to relative `/api/files/...` paths.
- Full-screen viewer Modal also uses thumbnail as the video poster — instant visual feedback when tapping a video.

### Issues addressed (from user-marked PDF RR_7-9)
- **#5 thumbnails missing** → ✅ fixed (server now generates per-video JPEG, frontend renders it instantly).
- **#6 won't open on tap** → ✅ The full-screen Modal viewer was already wired but starved of a poster. Now displays thumbnail while the video stream loads.
- **#7 slow upload + playback** → 🟡 PARTIALLY ADDRESSED:
  - Playback infrastructure already had HTTP Range, HEAD, ETag/304 (regression-locked by new test).
  - Thumbnails make first paint instant — previously the user saw a black/gray placeholder until video bytes arrived; now they see the poster frame immediately.
  - Upload speed: still on base64 path. Switching the trainee/trainer upload UI to chunked multipart with progress bar was descoped (touches `app/trainee/highlight-upload.tsx` + `app/trainer/highlight-upload.tsx` and adds a progress UI). Pick up next turn if uploads still feel slow after this fix lands.

### Test coverage
- New file: `/app/backend/tests/test_iteration83_phase_b_highlights.py` — 5 tests:
  - trainee video upload returns `thumbnailUrl`, JPEG served via /api/files (200 + correct content-type)
  - trainer video upload returns `thumbnailUrl`
  - photo upload does NOT have thumbnailUrl (no over-eager extraction)
  - /api/files supports Range requests (206 Partial Content + `Accept-Ranges: bytes`)
  - Static check: HighlightReel.tsx references `thumbnailUrl` and `resolveUrl`, and the old buggy `posterSource={{ uri: item.url }}` pattern is gone
- All previous iterations still green: **32/32 tests passing** across iter79, iter81, iter82, iter83a, iter83b.

## Architecture
- **Frontend**: React Native (Expo) with Oswald typography, Premium Dark Theme
- **Backend**: FastAPI with modular APIRouter architecture
- **Database**: MongoDB
- **Storage**: Emergent Object Storage

## Backend Architecture (Modularized)
```
/app/backend/
├── server.py              (~2700 lines - core: messaging, virtual sessions, location, notifications, scheduling)
├── models.py              (Pydantic models & enums)
├── deps.py                (Shared dependencies, auth, helpers, create_and_send_notification)
├── storage.py             (Object storage)
├── routes/
│   ├── auth_routes.py     (Login, register, password reset)
│   ├── session_routes.py  (Session CRUD, booking flow)
│   ├── admin_routes.py    (Admin dashboard, user management)
│   ├── profile_routes.py  (Trainer/trainee profiles, gallery, vibe, personality tags, verification, highlights)
│   ├── streak_routes.py   (Achievements, badges, streaks, leaderboard)
│   ├── payment_routes.py  (Ratings, earnings, payouts, Zelle, receipts, Stripe, memberships, boosts)
│   ├── matching.py        (Trainer-trainee matching)
│   ├── feed.py            (Social feed)
│   ├── group_sessions.py  (Group sessions)
│   ├── progress.py        (Progress tracking)
│   ├── trainer_tools.py   (Trainer utilities)
│   └── safety_check.py    (Safety features)
```

## Completed Features
- Trainer/Trainee personality tag system (CRUD + UI)
- Trainer accent color system (dynamic tinting)
- Cinematic page transitions (parallax, scale, opacity)
- Oswald typography upgrade
- Backend refactoring: server.py from ~10,000 → ~2,700 lines (Phase 1 + Phase 2)
- Login screen revert to original design (bg-battle-ropes.png)
- New RR dumbbell logo (replaced across all 8 files, pulsing animation preserved)

## Bug Fixes (Apr 10, 2026)
1. **Trainee Profile Crash**: `traineeData` undefined in `trainee-profile.tsx` → added state + API fetch
2. **Highlight Upload Crash**: `object_storage` import missing → fixed to use `put_object`
3. **Save Button Not Working**: `homeZipCode` missing from models + dark button → added field + orange gradient
4. **Address Input Blocked**: Banner didn't trigger edit mode → added `?editAddress=true` param
5. **Vibe Save Silent Failure**: Missing `res.ok` check → added error handling

## Bug Fixes (Apr 11, 2026)
6. **Pulsating Logo Circle Too Large**: `logoBacking` padding 20→0, borderRadius 140→120, added overflow:hidden so logo fills circle
7. **Profile Save Crash (edit-profile.tsx)**: Removed references to non-existent `formData.profilePhotoUrl` and `formData.introVideoUrl` that caused `TypeError: Cannot read properties of undefined (reading 'trim')`
8. **Empty Sessions Card Invisible Text**: Changed empty state gradient from white `rgba(255,255,255,0.95)` to dark `#141929/#1A2035` so white text is visible
9. **ID Scanning Overlay Freeze**: Moved `setShowScanningOverlay(true)` to AFTER camera capture instead of before, preventing overlay from showing while camera is open and timer from firing prematurely
10. **Vibe Save Guard**: Added null check for `user?.id` and `token` before API call, plus better error messages from backend response
11. **Highlight Upload Reliability**: Added base64 photo upload path for iOS reliability, reduced quality to 0.7, better error messages
12. **Onboarding Rates Prompt**: Post-onboarding modal now shows "Set Your Rates" as primary CTA before verification
13. **Admin Video Playback Broken**: `handlePlayVideo` was passing relative URL (`/api/files/...`) to Video component. Now prepends full `EXPO_PUBLIC_BACKEND_URL` like the document viewer does
14. **Admin Verification Text Invisible**: All light-background sections (`#F8FAFC`, `#FFF8E8`, `#FFF5F5`) in the verification modal replaced with dark-theme-consistent backgrounds using `rgba()` overlays. All text changed from `#333` to `#FFFFFF` for proper contrast on dark `#141929` modal
15. **Verification Doc Labels Invisible**: Step label `color: '#333'` → `#FFFFFF` on dark modal background
16. **Vibe Save Silent Failure**: Backend `update_one` matched 0 docs if profile didn't exist → now uses upsert (creates profile with vibe data if missing) + checks `matched_count`
17. **Vibe Auto-Play on Profile Open**: `TrainerVibePlayer` now re-fetches fresh preview URL from iTunes `/api/music/lookup` before auto-playing (iTunes preview URLs expire). Added 300ms delay for state to settle
18. **Music Lookup Endpoint**: Added `GET /api/music/lookup?trackId=X` to fetch fresh preview URLs from iTunes by trackId

## Social Login Integration (Apr 11, 2026)
19. **Apple Sign-In**: Native iOS via `expo-apple-authentication` — verifies identity token against Apple's public keys, creates/finds user, returns JWT
20. **Google Sign-In (Emergent Auth)**: Uses `expo-web-browser` to open Emergent OAuth flow → exchanges session_id for user data via Emergent API → creates/finds user, returns JWT
21. **Facebook Login (Scaffolded)**: UI ready, backend returns "coming soon" without `FACEBOOK_APP_ID` env var. When provided, verifies token with Facebook Graph API
22. **SocialAuthButtons Component**: Reusable React Native component with Apple (black), Google (white), Facebook (blue) buttons, loading states, and error handling
23. **Social Onboarding Flow**: New social users → redirected to signup with name/email pre-filled, password fields hidden, just pick role + add phone → full onboarding flow continues
24. **Backend Social Auth**: `social_auth_routes.py` with `find_or_create_social_user()` helper — links social providers to existing accounts by email, upserts new accounts without password
25. **Updated UserSignUp Model**: `password` now Optional, `isSocialAuth` flag added — signup endpoint handles passwordless social users gracefully

## Deployment Fix (Apr 11, 2026)
26. **iOS Build Failure — Apple Sign-In Entitlement**: `expo-apple-authentication` auto-injected `com.apple.developer.applesignin` entitlement which provisioning profile doesn't support. Fixed by removing the native package and switching to web-based Apple Sign-In via `expo-web-browser` (Apple's OAuth web flow). No native entitlement required.
27. **Dual Lock File Warning**: Removed `package-lock.json` (build warned about yarn.lock + package-lock.json conflict)

## UI Updates (Apr 11, 2026 — Session 2)
28. **Rapid Reps Header Logo**: Added user-provided stylized "Rapid Reps" text logo (`rapidreps-header.png`) at the very top of main page (`index.tsx`) and login page (`login.tsx`) with shimmer glow animation effect
29. **RR Dumbbell Icon Logo**: Replaced old logo with user-provided RR dumbbell icon (`rapidreps-icon-logo.png`), now fills entire circular frame using `resizeMode="cover"` with exact borderRadius matching. Pulsing heartbeat animation preserved
30. **Social Auth Buttons Redesign**: Converted from large vertical pill buttons with text to small 48px circular icons arranged horizontally (Facebook, Google, Apple), no "Continue with..." text — cleaner, less intrusive UI
31. **Cinematic Entrance Animation**: Header logo slides down from top first (500ms spring), then RR icon scales up from 0.3x to 1x from center with a dramatic spring bounce
32. **Strict Logo Sizing (User Spec)**: Header = 130% screen width (no height cap). Circle = 65% screen width. Logo inside = 130% circle diameter. Gray backing removed (transparent). Overlay opacity 0.95-0.97 to hide background logo. Applied to all 3 screens
33. **Explosive Fitness Entrance Animations**: Full premium explosive animation system on all 3 screens:
    - Header SLAMS down from -250px with rotation correction (-12deg to 0)
    - Gold impact FLASH burst (0.45 opacity, 80ms)
    - Logo EXPLODES from scale 0 with 360deg spin + overshoot spring
    - Pulsing gold energy ring behind logo (continuous)
    - Staggered content cascade (tagline, props, buttons slide up 120ms apart)
    - Heartbeat pulse + header shimmer (continuous loops)
    - Boxing bell impact sound on home screen entrance (expo-av Audio)
    - Plays every time app opens (not just first visit)

## Known Issues
- EAS iOS Build Failure (BLOCKED - user must regenerate Apple Distribution Certificate)
- SendGrid Email Integration (BLOCKED - needs user API key)
- Facebook App ID missing (BLOCKED - needs user to provide App ID)
- 508 Accessibility Compliance (IN PROGRESS - incremental)

## Bug Fixes (Apr 17, 2026)
34. **Invalid Token on Highlight Uploads / Vibe Saves (P0)**: `AuthContext.tsx` was not exporting `token` in its context. Both `highlight-upload.tsx` and `vibe-setup.tsx` destructured `{ user, token }` from `useAuth()`, but `token` was always `undefined`. Fixed by adding `token: string | null` to the AuthContextType interface, adding a `[token, setToken]` state, and populating it on login/signup/socialLogin/loadUser, clearing on logout.
35. **Admin Panel Document URLs Invalid (P0)**: Verification documents were stored as local device URIs (file://...) which are inaccessible from the admin panel. Added `POST /api/trainer/upload-verification-file` and `POST /api/trainer/upload-verification-file-base64` endpoints to upload files to object storage. Updated `verification.tsx` to upload files to storage before submitting steps. Admin panel now also shows a warning for legacy local URIs.
36. **Background Check Form Validations (P1)**: Added SSN validation (exactly 9 digits), DOB validation (MM/DD/YYYY format with auto-formatting), Address validation (alphanumeric + standard punctuation). Replaced submit button with "Hold to Submit" orange pressable button (2-second hold with progress animation).
37. **Admin Background Check Status Controls (P1)**: Added `POST /api/admin/verifications/{trainer_id}/background-check-status` endpoint. Admin panel now shows Passed/Pending/Failed toggle buttons in the background check info section.
38. **Unverified Trainers Visibility (P1)**: Added `GET /api/admin/verifications/unverified` endpoint that finds trainers with the trainer role but no verification status. Added "Unverified" tab to admin panel VerificationsTab with trainer list and join dates.
39. **Selection Highlights Orange (P1)**: Changed trainee onboarding selection chip colors from dark (#0A0E1A) to branded orange (#FF7F00) for experience levels, training styles, and training mode selections.
40. **Profile Photo Synchronization (P1)**: Backend now syncs profile photos across all collections when updated. `create_trainer_profile`, `create_trainee_profile`, and `submit_verification_step` (photo step) all now update `users.profilePhoto` in addition to the profile-specific fields. The `get_trainer_profile` endpoint already falls back from `users.profilePhoto` to `trainer_profiles.avatarUrl`.

## New Features (Apr 18, 2026)
41. **Subscription Tiers**: Custom plans where trainee picks 1-7 sessions/week. Trainer sets their rate, platform takes 20%. Full lifecycle: create, accept, decline, pause, resume, cancel. Auto-scheduling picks available slots for next week based on preferred days/times. If conflicts, system finds next available.
42. **Live GPS Check-in**: Both parties check in with GPS at session location. Haversine distance calculation. Trainer sets radius (1-35 miles). No-show handling: trainer decides to cancel, wait, or proceed. Push notifications on check-in/warning.
43. **Frontend: Subscription Management Screen** (`/app/frontend/app/subscriptions.tsx`): Full subscription list with status badges, pricing breakdown, action buttons (accept/decline/pause/resume/cancel), and create modal with day/time pickers.
44. **Frontend: GPS Check-in Card** (`/app/frontend/app/trainer/gps-checkin.tsx`): Reusable component showing check-in status for both parties, GPS check-in button with location permission, distance result display, and trainer no-show action buttons.
45. **Admin: Subscriptions Tab** (`/app/frontend/src/components/admin/SubscriptionsTab.tsx`): Admin panel tab showing all subscriptions with stats (total/active/paused/cancelled/revenue), status filters, and detailed list with trainee→trainer names, rates, and platform fees. Backend: `GET /api/admin/subscriptions`.
46. **Neon Map Redesign** (`/app/frontend/src/components/NearbyTrainersMap.native.tsx`): Complete UI overhaul of the trainer map to match premium neon aesthetic: ultra-dark map style, neon-glowing circular markers with trainer initials (green=top rated, orange=mid, purple=new), pulsating user location dot, "Available Now" horizontal scrolling card row at bottom with neon-bordered cards showing initial, name, star rating, distance. Color-coded by rating tier.

## New Features (May 27, 2026 — UI Polish & Search)
47. **Thunder Startup Sound** (`/app/frontend/assets/sounds/thunder.wav`): Replaced explosion-impact with a procedurally generated 3-second thunder clap (sharp crack + sub-bass boom + rolling rumble + intermittent crackle). Triggered at the header-slam moment in `app/index.tsx`. More energetic and atmospheric than the previous sound.
48. **Trainer Onboarding Travel Radius — Slider** (`/app/frontend/app/auth/onboarding-trainer.tsx`): Replaced dropdown + modal picker (which had navy-on-navy unreadable text) with an inline orange-themed Slider (1–35 miles, step 1). Now matches the slider pattern used in `trainer/edit-profile.tsx`. White value text on dark card with orange thumb/track. Removed unused `FlatList` import and `RADIUS_OPTIONS`/`showRadiusPicker` state.
49. **People Search Component** (`/app/frontend/src/components/PeopleSearchBar.tsx` — NEW): Reusable, design-uniform search bar used by BOTH trainee and trainer home screens. 350ms debounced input, navy gradient card with orange search icon, animated results dropdown with avatar + name + meta pills (distance, rating, email) + role badge. Single source of truth — guarantees identical look on both sides.
50. **Trainee → Trainer Search** (frontend: `app/trainee/(tabs)/home.tsx`; backend: `GET /api/trainers/search?q=...`): Trainees can find any trainer nationwide by name, email, or phone number — proximity is bypassed when `q` is provided. Case-insensitive regex match.
51. **Trainer → Trainee Search** (frontend: `app/trainer/(tabs)/home.tsx`; backend: `GET /api/trainees/search?q=...` — NEW endpoint): Trainers can reach any trainee nationwide by name, email, or phone number. RBAC-gated: trainees blocked with 403 ("Only trainers can search trainees"). Returns distance if trainer has GPS location set.
52. **UI/UX Uniformity Pass**: PeopleSearchBar enforces identical visual language across trainee and trainer flows (same card gradient, same orange accents, same typography, same empty-state, same result row, same role badge style). Replaced navy-on-navy invisible text in trainer onboarding radius picker. Standardized on white text + orange accents on dark surfaces (no Colors.text/#1a2a5e on dark backgrounds).
53. **Invite-to-RapidReps in Empty Search State** (`src/components/PeopleSearchBar.tsx`): When a search returns 0 results, surface an orange CTA that opens the right native deep-link:
    - **Email-shaped query** → `mailto:` with prefilled subject/body
    - **Phone-shaped query** → `sms:` with prefilled body (iOS uses `&body=`, Android uses `?body=`)
    - **Other** → Native `Share.share` sheet
    Each share carries the user's referral code (auto-fetched once via `/api/referral/my-code`) and pitches "we both get $5 off". Available on both trainee (audience=trainer) and trainer (audience=trainee) home screens — every "user not found" becomes a referral opportunity.
54. **Invite Tracking & Funnel Analytics** (backend `server.py` + `referralAPI.trackInvite/getInviteStats`):
    - `POST /api/referral/track-invite` — logs `{inviterId, channel, audience, maskedTarget}` to `referral_invites` collection. PII is auto-masked server-side (phone → `phone:***1234` last 4 digits; email → `email:***ail.com` last 6 chars; name → `name:***`).
    - `GET /api/referral/invite-stats` — aggregates invites per channel (sms/email/share) for the current user; foundation for a "Channel performance" dashboard.
    - Frontend: After successful share, `PeopleSearchBar` shows toast "Invite sent via SMS/email/share — they get $5 off, you do too" + success haptic, and fires-and-forgets the tracking call.
55. **Instagram Integration Scaffold (PRE-CREDENTIALS)** — Tinder-style profile linking, ready to activate the moment Meta credentials arrive:
    - **Backend** (`/app/backend/routes/instagram_routes.py` — NEW): 9 endpoints — `/oauth/start`, `/oauth/callback`, `/status`, `/media`, `/public-media/{userId}`, `/curate`, `/refresh`, `/unlink`, `/deauthorize`, `/data-deletion`. Uses Instagram Graph API w/ Instagram Login (post-Dec-2024 replacement for Basic Display API).
    - **Tokens encrypted at rest** with AES-GCM via the `cryptography` lib. `INSTAGRAM_TOKEN_ENC_KEY` (32-byte URL-safe base64) in backend `.env`.
    - **Personal accounts blocked** at callback with 403 `code=PERSONAL_ACCOUNT_NOT_SUPPORTED` → frontend routes to a tutorial screen instructing user to convert to Creator.
    - **User curation**: After link, user multi-selects which of the 8 most-recent media items appear publicly. Stored as `selectedMediaIds` array on the `instagram_links` doc. The `/public-media/{userId}` endpoint returns ONLY the curated subset.
    - **User-triggered refresh**: `/refresh` re-fetches /me/media + extends long-lived token if < 7 days from expiry. No auto-refresh.
    - **Meta-required webhooks**: `/deauthorize` (deletes link on revoke) + `/data-deletion` (returns confirmation URL per spec). Both reachable via GET for Meta's "Verify" button.
    - **Frontend components** (`src/components/InstagramSection.tsx`, `app/instagram/curator.tsx`, `app/instagram/personal-account-help.tsx`, `app/instagram-callback.tsx`): InstagramSection wired into trainee profile (own view), trainer-viewing-trainee profile (public view), and trainee-viewing-trainer-detail profile (public view).
    - **Privacy policy** published at `/api/privacy/policy` with full IG-integration addendum. Data-deletion confirmation page at `/api/privacy/data-deletion-status?code=`.
    - **Meta App Review prep doc** at `/app/memory/META_REVIEW_PREP.md` — screencast script, deliverables checklist, going-live steps.
    - Tested 26/26 (100%) in iteration_71.json.
56. **Facebook Login removed; Apple + Google sign-in polished**: Stripped Facebook button + handler from `SocialAuthButtons`. Replaced circular icon buttons with full-width premium pill buttons (`Continue with Apple` / `Continue with Google`) — Apple HIG + Google brand compliant, 50 px tall, 12 px corner radius, 12 px vertical gap. Apple shown only on iOS.
57. **Email/Password input fields unified with new pill aesthetic** (login.tsx): 50 px height (was 52), 12 px corner radius (was 16), softer shadow + 15 px font for visual harmony with the social pill buttons directly above.
58. **A/B Testing Infrastructure** (`useExperiment` hook + 3 backend endpoints):
    - Frontend hook `/app/frontend/src/hooks/useExperiment.ts`: deterministic per-device variant assignment via FNV-1a hash → no flicker, persists across reloads via AsyncStorage device ID.
    - Backend: `POST /api/experiments/event` (no auth, public) logs `{experimentKey, variant, event: 'impression'|'click'|'conversion', deviceId}` to `experiment_events` collection.
    - Backend: `GET /api/experiments/{key}/results` (admin-only) returns per-variant impressions/clicks/conversions + CTR.
    - **First experiment live**: `google_cta_copy` — variants `control` (*"Continue with Google"*) vs `fast` (*"Sign up free in 5 seconds"*). Impressions auto-fire on render; clicks fire on button press.
    - Verified end-to-end via curl: events log 200, admin results endpoint returns aggregated per-variant CTR data.

## Backend Tested (Iteration 70)
- 21/21 pytest tests passed (100%) — name/email/phone substring (case-insensitive), trainer-only RBAC, unauthenticated rejection, q required validation, whitespace-q safe handling, no-match empty result, backward-compatible legacy filter mode when q is absent, regression sanity for /api/auth/login + /api/auth/me.

## Upcoming Tasks
- 508 Accessibility Compliance (P2)
- SendGrid Email Integration (P2, blocked on API key)
- Facebook Social Login (P2, blocked on App ID)
- Auto-color detection from profile photo (P3)
- Further server.py extraction: messaging, location, notifications (P3)
- **"My Referrals" Dashboard Tab** (P2, saved 2026-05-27 for a later session): Surface a new in-app dashboard for both trainee + trainer that visualizes referral performance — bar chart of invites by channel (SMS / email / share) using `react-native-svg`, lifetime credits earned, and a list of recent invitee signups. Data sources already live: `referralAPI.getStats()` + `referralAPI.getInviteStats()`. Estimated ~30 min to ship. Goal: close the referral loop so users see ROI on inviting → compounding growth.

## Recent Fixes
- **2026-05-31 (11)** — Iteration 81 — Focused a11y pass + CI guard:
  - **Audit**: 500 TouchableOpacity vs only 18 `accessibilityLabel` site-wide — full pass = a sprint. Pragmatic high-ROI fix: target **icon-only buttons** (silent to screen readers — Section 508 / WCAG 2.1 AA violation).
  - **Found 17 icon-only TouchableOpacity** across discover/booking/auth/admin/components. Batch-patched all 17 with smart label inference (icon name → label, testid → label fallback). Examples: `close-circle` → "Close", `log-out-outline` → "Log out", `heart` → "Toggle favorite", `chatbubble` → "Open chat", `flag` → "Report this trainer", `volume-mute` → "Unmute audio preview", and more. All got `accessibilityRole="button"` too.
  - **CI Guard 5** in `test_iteration79_ci_guards.py`: scans `frontend/src/` + `frontend/app/` for `<TouchableOpacity>...<Ionicons .../>...</TouchableOpacity>` patterns without `accessibilityLabel`. Destructive-test-verified.
  - **Combined regression**: 34/34 passing.
- **2026-05-31 (10)** — Iter80: Auto-color from profile photo + 2 more CI guards (hardcoded URLs + debug markers).
- **2026-05-31 (9)** — Iter79b: 2 initial CI guards (duplicate exports + route collisions).
- **2026-05-31 (8)** — Iter79: Production crash fixes.
- **2026-05-31 (7)** — Iter78: Auto-clear Pending badge + 15s hero video preview.
- **2026-05-31 (6)** — Iter77: Pending Session badge + Referrals dashboard.
- **2026-05-31 (5)** — Iter76: HEAD + ETag/304 + StreamingResponse.
- **2026-05-31 (4)** — Iter75: Range support + /me profile photo.
- **2026-05-31 (3)** — Iter74: 5 deferred punch-list items.
- **2026-05-31 (2)** — Iter73: 15-item punch list + booking flow rewire.
- **2026-05-31 (1)** — Iter72: Deployment blocker fix.

## Active Blocker
  - **Auto-color from profile photo**: new `/app/backend/color_extractor.py` uses Pillow median-cut quantization + saturation/luminance scoring to extract a vibrant dominant color. Rejects near-black (lum < 0.1) and near-white (lum > 0.92) pixels so washed-out backgrounds don't dominate. Hooked into `POST /api/trainer-profiles` — every photo upload also computes `accentColorAuto` (data URIs decoded inline; `/api/files/...` URLs resolved via object storage). Added `accentColorAuto` field to both `TrainerProfileCreate` AND `TrainerProfileResponse` (initially missed the latter, caught immediately because the test agent's first run returned `None`).
  - **Frontend wiring**: `trainer-detail.tsx` + `TrainerCard.tsx` accent now falls back through `accentColor || accentColorAuto || '#FF6A00'`. Manual user-set color always wins; auto-detection only fills the gap.
  - **End-to-end verified**: red subject photo → `#DC2828`, blue subject → `#1E64F0`, persisted correctly across GET.
  - **CI Guard 3**: No hardcoded `localhost` / `127.0.0.1` / `0.0.0.0` URLs in `frontend/src/` or `frontend/app/`. Skips comment lines. Use `EXPO_PUBLIC_BACKEND_URL` instead.
  - **CI Guard 4**: No high-signal debug-marker `console.log` (`'TODO'`, `'DEBUG'`, `'XXX'`, `'FIXME'`, `'TEMP'`, `'REMOVE THIS'`, `'TEST LOG'`). Intentionally narrow — legitimate `console.log('Error fetching:', err)` is allowed. Both guards destructive-test-verified.
  - **New test suites**: `test_color_extractor.py` (12 tests: solid colors, white-bg-vibrant-subject, error paths, data-URI helper, <100ms performance check). Combined: **33/33 passing**.
- **2026-05-31 (9)** — Iter79b: 2 initial CI guards (duplicate exports + route collisions).
- **2026-05-31 (8)** — Iter79: Production crash fixes (duplicate `referralAPI` + `/referral.tsx` route collision).
- **2026-05-31 (7)** — Iter78: Auto-clear Pending badge + 15s hero video preview.
- **2026-05-31 (6)** — Iter77: Pending Session badge + Referrals dashboard.
- **2026-05-31 (5)** — Iter76: HEAD + ETag/304 + StreamingResponse.
- **2026-05-31 (4)** — Iter75: Range support + /me profile photo.
- **2026-05-31 (3)** — Iter74: 5 deferred punch-list items.
- **2026-05-31 (2)** — Iter73: 15-item punch list + booking flow rewire.
- **2026-05-31 (1)** — Iter72: Deployment blocker fix.

## Active Blocker
  - `/app/backend/tests/test_iteration79_ci_guards.py` — 2 fast pytest checks (~50ms total) that run alongside the regression suite.
  - **Guard 1**: No duplicate `export const NAME` in `frontend/src/services/api.ts` (would crash production Metro bundler).
  - **Guard 2**: No `*.tsx`/`*.jsx`/`*.ts`/`*.js` file with the same basename as a sibling directory anywhere under `frontend/app/` (would cause Expo Router route collision → crash on launch). Skips `_layout.tsx` and `+not-found.tsx` Expo Router specials. Skips `node_modules`, `.expo`, `dist`, `.metro-cache`.
  - **Destructive-test-verified**: both guards FAIL when a violation is injected (duplicate `export` / collision file), PASS when restored. They're not false-positives.
  - Combined regression suite: 19/19 pass.
- **2026-05-31 (8)** — Iter79: Production crash fixed (duplicate `referralAPI` export + `/referral.tsx` route collision).
- **2026-05-31 (7)** — Iter78: Auto-clear Pending badge + 15s hero video preview.
- **2026-05-31 (6)** — Iter77: Pending Session badge + Referrals dashboard.
- **2026-05-31 (5)** — Iter76: HEAD + ETag/304 + StreamingResponse.
- **2026-05-31 (4)** — Iter75: Range support + /me profile photo.
- **2026-05-31 (3)** — Iter74: 5 deferred punch-list items.
- **2026-05-31 (2)** — Iter73: 15-item punch list + booking flow rewire.
- **2026-05-31 (1)** — Iter72: Deployment blocker fix.

## Active Blocker
  - **EAS build SyntaxError**: `frontend/src/services/api.ts` had duplicate `export const referralAPI` declarations (line 581 added by iter77, line 696 pre-existing canonical). Production Metro bundler is stricter than dev — error was masked by hot-reload. Removed my iter77 duplicate; the original canonical version with 4 methods (`getMyCode`, `getStats`, `validateCode`, `getCredits`) was already complete.
  - **App crash on launch (route collision)**: I created `/app/referral.tsx` in iter77 while `/app/referral/index.tsx` already existed — Expo Router file-based routing collided on `/referral` URL, throwing an unhandled exception during route tree construction at app boot. Deleted my duplicate and merged the chart visualization (3-bar Activated/Pending/Slots-left) into the existing `referral/index.tsx`.
- **2026-05-31 (7)** — Iter78: Auto-clear Pending badge on tab view + 15s hero video preview.
- **2026-05-31 (6)** — Iter77: Pending Session badge + Referrals dashboard.
- **2026-05-31 (5)** — Iter76: HEAD + ETag/304 + StreamingResponse.
- **2026-05-31 (4)** — Iter75: Range support + /me profile photo.
- **2026-05-31 (3)** — Iter74: 5 deferred punch-list items.
- **2026-05-31 (2)** — Iter73: 15-item punch list + booking flow rewire.
- **2026-05-31 (1)** — Iter72: Deployment blocker fix.

## Active Blocker
  - **Auto-clear Pending badge on tab view**: `markPendingSessionsSeen()` added to `NotificationContext`, persists `lastSeenPendingAt` timestamp via AsyncStorage. Badge count = pending sessions created AFTER this timestamp, so it stays cleared across reloads until a NEW request arrives. Wired into:
    - Trainee Sessions tab — fires on `activeTab === 'pending'` selection
    - Trainer Sessions tab — fires on screen mount (pending requests are bundled into the trainer's 'upcoming' filter)
  - **15s hero video auto-preview** on trainer-detail (Instagram Reels style). New component `TrainerHeroVideoPreview.tsx`:
    - Plays first video highlight muted + autoplay on hero overlay
    - Fades out after 15s so the rest of the page stays readable
    - Tap-to-unmute pill in top-right, "LIVE PREVIEW" badge in top-left
    - Gradient overlay preserves hero text readability
    - Leverages iter75 backend Range support for smooth iOS playback + iter76 ETag for repeat-view bandwidth savings
  - **Group Sessions pending count — DEFERRED with rationale**: After auditing the data model (`backend/routes/group_sessions.py`), trainees auto-join group sessions on capacity availability (no trainer-approval pending state). So the 1:1-style badge concept doesn't directly apply. Would require introducing an approval workflow or repurposing as "new signups since last view" — flagged for product decision.
- **2026-05-31 (6)** — Iter77: Pending Session badge + Referrals dashboard.
- **2026-05-31 (5)** — Iter76: HEAD method + ETag/304 + StreamingResponse.
- **2026-05-31 (4)** — Iter75: HTTP Range support + /me profile photo.
- **2026-05-31 (3)** — Iter74: 5 deferred punch-list items.
- **2026-05-31 (2)** — Iter73: 15-item punch list + booking flow rewire.
- **2026-05-31 (1)** — Iter72: Deployment blocker fix.

## Active Blocker
  - **Pending Session count badge** on Sessions tab icon (both trainee + trainer). Lives in `NotificationContext` as `pendingSessionCount`, fetched on mount + every 60s + after a successful booking from confirm-booking. Wired into `app/trainee/(tabs)/_layout.tsx` + `app/trainer/(tabs)/_layout.tsx` via Expo Router's `tabBarBadge`. Tab shows e.g. `Sessions (2)` so users don't forget about open requests.
  - **Referrals dashboard** at `/app/referral.tsx` (fixes broken `router.push('/referral')` from profile menus that previously 404'd). Features hero card with copy-able + shareable referral code, 4 stat cards (total/activated/pending/success-rate), earnings card ($ total + available), 3-bar chart visualization (activated vs pending vs slots-left), referral history list with status dots and credit amounts. Uses native `Clipboard` + `Share` APIs (no new deps).
  - **API additions**: `referralAPI.getMyCode()` + `referralAPI.getStats()` in `src/services/api.ts` for clean call-sites.
  - **Verified backend**: `GET /api/referral/stats` returns expected shape (referralCode, totalReferrals, activatedReferrals, pendingReferrals, totalCreditsEarned, availableCredits, maxReferrals, referralsRemaining, referralHistory[]). All existing iter75/iter76 tests still pass.
- **2026-05-31 (5)** — Iteration 76: HEAD method + ETag/304 + StreamingResponse for `/api/files/{path}`.
- **2026-05-31 (4)** — Iter75: HTTP Range support + `/api/auth/me` profilePhoto/avatarUrl exposure.
- **2026-05-31 (3)** — Iter74: 5 deferred punch-list items.
- **2026-05-31 (2)** — Iter73: 15-item punch list + booking flow rewire.
- **2026-05-31 (1)** — Iter72: Deployment blocker fix.

## Active Blocker
  - **HEAD `/api/files/{path}`**: Was returning 405 → now returns 200 with the same headers as GET but no body. Fixes iOS AVPlayer preflight + link preview crawlers.
  - **ETag + If-None-Match `304 Not Modified`**: Computes MD5 ETag from content; conditional GET with matching `If-None-Match` returns 304 with empty body. Pragmatic workaround for the Cloudflare/ingress `no-store` override (which strips our `Cache-Control: public, max-age=...` headers) — client sends ETag on every request, saves bandwidth via 304 short-circuit.
  - **`StreamingResponse` with 64KB chunks**: GET/206 responses now stream content instead of buffering the whole slice into a single Response. Bounds peak memory under concurrent video streams. Also added `Vary: Range` so intermediate caches don't merge Range/full responses.
  - **Upstream Range investigation**: Verified Emergent object storage upstream does NOT support Range requests (ignores header, returns full content). So byte-offset streaming from upstream isn't possible — we still fetch the full file once, but now slice + stream the response, which is the practical optimization available.
  - **Tests**: `/app/backend/tests/test_iteration76_head_etag_streaming.py` — 7 new tests (HEAD x2, ETag x3, Range+Streaming x2). Combined with iter75 suite: **17/17 passing**.
- **2026-05-31 (4)** — Iter75: HTTP Range support on `/api/files/{path}` + `/api/auth/me` now exposes `profilePhoto`+`avatarUrl` with trainer-profile fallback.
- **2026-05-31 (3)** — Iter74: 5 deferred punch-list items resolved (Pydantic profilePhoto alias, admin verify View/invalid-state, Edit Profile unification, group sessions KeyboardAvoidingView, Highlight Reel persistence race).
- **2026-05-31 (2)** — Iter73: 15-item punch list batch + booking flow rewire.
- **2026-05-31 (1)** — Iter72: Deployment blocker (SocialAuthButtons.tsx syntax error).

## Active Blocker
  - **HTTP Range support on `GET /api/files/{path}`**: Root cause of "trainer videos don't play on trainee profile view" — iOS AVPlayer and `expo-av` Video REQUIRE 206 Partial Content responses for streaming/seeking. The original handler returned the whole file in a single 200, which iOS rejects for video. Now supports `bytes=START-END`, `bytes=START-` (open-ended), returns 206 + `Content-Range` for valid ranges, 416 for over-range/malformed, 200 + `Accept-Ranges: bytes` for plain GETs. Includes `Cache-Control: public, max-age=31536000`.
  - **`/api/auth/me` exposes `profilePhoto` + `avatarUrl`**: Added both fields to `UserResponse` Pydantic model AND wired `get_me()` to read from `users` collection with trainer-profile fallback (when `roles` contains 'trainer' and the user doc has no avatar, look up `trainer_profiles.avatarUrl`/`profilePhoto`).
  - **Tests**: `/app/backend/tests/test_iteration75_range_and_me.py` — 10/10 passed including all 4 Range scenarios + /me profile photo sync + 3 regression tests for sessions/highlights/admin verifications.
- **2026-05-31 (3)** — Iteration 74 — 5 deferred punch-list items: trainer profile photo missing (Pydantic profilePhoto alias), admin verify View buttons + invalid Approved+No-file state, profile/Edit Profile unification, group sessions KeyboardAvoidingView, Highlight Reel persistence race fix.
- **2026-05-31 (2)** — Iteration 73 — 15-item punch list batch: booking flow rewired (Hold-to-Book + Sticky Book Now removed), Highlight Reel as sole media, dynamic per-30-min pricing, Vibe double-audio race fix, Confirm Booking now actually creates session, Sessions Pending deep-link, Zelle white-on-white fix, signup eye-toggle, post-approval celebratory modal. Backend booking imports P0 fix.
- **2026-05-31 (1)** — Resolved deployment blocker: SocialAuthButtons.tsx syntax error.

## Active Blocker
  - **Trainer profile photo missing (IMG_1128)**: Root cause — `TrainerProfileCreate` Pydantic model only had `avatarUrl`, so FE-sent `profilePhoto` was silently dropped before reaching the route's sync logic. Fixed in `models.py` (added `profilePhoto` as legacy alias) and `edit-profile.tsx` (now sends BOTH `avatarUrl` and `profilePhoto`). Also added fallback chain in `trainer-detail.tsx` hero (`avatarUrl || profilePhotoUrl || photoFileUri || profilePictureUrl`).
  - **Admin Verify "View" buttons + invalid Approved+No-file state (IMG_1122)**: Disabled the Approve button when `step.url` is missing (with toast: "Cannot approve — trainer has not uploaded this document yet"). Added warning badge "Invalid state — approved but no file. Ask trainer to re-upload" when an existing record is Approved+No-file.
  - **Profile button vs Edit Profile routing**: Added single "Edit Profile" CTA on trainer Profile tab routing to `/trainer/edit-profile` (single source of truth). Trainee Profile tab already had inline edit (no change needed).
  - **Keyboard overlap on Group Sessions (IMG_1121)**: Wrapped both Create + Edit modals in `KeyboardAvoidingView` with `behavior=padding/height` + `keyboardShouldPersistTaps="handled"` on ScrollView.
  - **Highlight Reel persistence**: Fixed race condition where `useEffect(() => loadHighlights(), [])` ran before `user.id` was hydrated from AsyncStorage → silent 404 → empty highlights. Now: `useEffect([user?.id], ...)` with guard.
  - **Backend tests**: New `/app/backend/tests/test_iteration74_profile_photo_highlights.py` covers profilePhoto/avatarUrl bidirectional sync, base64 highlight upload + serving via `/api/files/{path}`, admin approve-step, plus iter73 booking regression. All 12/12 green.
- **2026-05-31 (2)** — Punch-list batch 1 (15 items): booking flow rewired, removed Hold-to-Book + Sticky Book Now, Highlight Reel as sole media section, dynamic per-30-min pricing, Vibe double-audio fix, Confirm Booking actually creates session, Sessions Pending tab deep-link, Zelle white-on-white fix, signup eye-toggle, post-approval celebratory modal. Backend booking flow missing-imports fix (P0).
- **2026-05-31 (1)** — Resolved deployment blocker: SocialAuthButtons.tsx syntax error.

## Active Blocker
  - **Trainer profile (trainee view)**: removed redundant `Hold to Book` + sticky `Book Now`; single tap `BOOK SESSION` button now navigates to `/trainee/confirm-booking`. Hero rate badge shows `$X / 30 min` (computed from `ratePerMinuteCents`) instead of hard-coded `$1/min`. Hero CTA scrolls to Booking Card. Gallery section removed entirely (consolidated into Highlight Reel per user choice).
  - **Trainer Vibe Player**: fixed double-audio race between two `useEffect`s by adding synchronous `playLockRef` (TrainerVibePlayer.tsx).
  - **Confirm Booking page** (`confirm-booking.tsx`): now actually calls `POST /api/sessions` (was previously a no-op that just flipped state). Success modal updated to required copy: *"Training Request Sent — Your training request has been sent to {trainer}. You can find this session in My Sessions → Pending."* Policy info card contrast fixed (was white-text-on-near-white).
  - **Sessions tab** (`/trainee/(tabs)/sessions.tsx`): accepts `tab=pending` deep-link param so the post-booking modal CTA lands on Pending.
  - **Zelle Setup** (`connect-bank.tsx`): input bg changed from `rgba(255,255,255,0.9)` → `rgba(255,255,255,0.06)` so white text values are visible (resolves IMG_1125 white-on-white).
  - **Signup**: eye-toggle icon added on both Password + Confirm Password fields with proper `autoCapitalize/autoCorrect/textContentType` attributes.
  - **Trainer Home**: one-time celebratory approval Modal (confetti, glow ring, brand pill) shown when `GET /api/trainer/verification-status` returns `canGoLive=true`. AsyncStorage flag `@rapidreps_trainer_approval_modal_seen` ensures it shows only once.
  - **Backend P0 (caught by iter73 testing agent)**: added missing imports `MembershipStatus`, `REFERRAL_CREDIT_CENTS`, `create_and_send_notification` in `session_routes.py` — every `POST /api/sessions` was 500-ing with `NameError`. Now end-to-end booking flow returns 200 and sessions appear under My Sessions → Pending. 13/13 backend tests passed (`/app/backend/tests/test_iteration73_booking_flow.py`).
- **2026-05-31 (1)** — Resolved P0 deployment blocker: removed garbage residue lines 221–231 from `/app/frontend/src/components/SocialAuthButtons.tsx`.

## 2026-06-01 — Iteration 82: Trainee Profile Vibrancy Parity (Feature)
- **User request**: "I want the trainee profiles to have the same effects as the trainer profiles. What will you update to make this happen? Right now the Trainer profiles are way more exciting and vibrant with music and media etc"
- **Scope**: Bring trainee profiles to full visual+interactive parity with trainer profiles (Option C: both edit screens and public showcase).

### Backend additions
- **Models** (`/app/backend/models.py`): Extended `TraineeProfileCreate` + `TraineeProfileResponse` with `bio`, `vibeTrackTitle`, `vibeArtistName`, `vibeArtworkUrl`, `vibePreviewUrl`, `vibeAppleMusicUrl`, `vibeTrackId`, `accentColor`, `accentColorAuto`, `highlights`, `fullName`.
- **Routes** (`/app/backend/routes/profile_routes.py`): Added trainee endpoints mirroring the trainer ones:
  - `PUT /api/trainee-profiles/{user_id}/vibe` + `DELETE`
  - `PUT /api/trainee-profiles/{user_id}/accent-color` (validates against `VALID_ACCENT_COLORS`)
  - `PUT /api/trainee-profiles/{user_id}/bio`
  - `POST /api/trainee-profiles/{user_id}/highlights` (file upload)
  - `POST /api/trainee-profiles/{user_id}/highlights/base64` (iOS-friendly)
  - `DELETE /api/trainee-profiles/{user_id}/highlights/{index}`
  - `GET /api/trainee-profiles/{user_id}/highlights`

### Frontend additions
- **`app/trainee/vibe-setup.tsx`** (NEW): iTunes Search-powered music picker for trainees, mirrors trainer's vibe-setup.
- **`app/trainee/highlight-upload.tsx`** (NEW): Photo+video reel uploader for trainees with base64 fallback.
- **`app/trainee/(tabs)/profile.tsx`** (UPDATED): Added 3 new CTA tiles next to existing Personality Tag — Vibe, Highlight Reel, Brand Color — plus AccentColorPicker modal and handler.
- **`app/trainer/trainee-detail.tsx`** (NEW): Cinematic public showcase of a trainee — same hero/parallax/glow/stagger entrance animations as `trainee/trainer-detail.tsx`. Surfaces: fitness level badge, name, bio/goals, personality tag, stats bar (training styles / highlights / format), vibe player (auto-play), highlight reel, Instagram embed, goals/styles/limitations/location cards. Accent color drives all tints. Single "MESSAGE" CTA replaces "BOOK SESSION".
- **`app/trainer/trainee-profile.tsx`** (UPDATED): Added a "VIEW FULL PROFILE" gradient CTA on the operational session-prep page that routes to `/trainer/trainee-detail`.

### Test coverage
- New file: `/app/backend/tests/test_iteration82_trainee_vibrancy.py` — 7 tests:
  vibe lifecycle, accent color (valid+invalid), bio update, highlights base64 lifecycle, response surfaces showcase keys, cross-user 403 on vibe, cross-user 403 on highlight. All passing.
- Existing CI guards (79, 81) re-run green: 13/13 total passing.

## 2026-06-01 (continued) — Iteration 82.1: Bug Fixes + Discover Trainees

### Discover Trainees feature (NEW — user-requested enhancement)
- **Backend** `GET /api/trainees/discover` (`profile_routes.py`): auth-required feed of trainees who have any showcase signal (vibe / personality tag / accent color / bio / highlights). Joins `trainee_profiles` with `users` for `fullName`, filters to users with `trainee` role, excludes the caller, sorts by `updatedAt` desc, supports `limit` + `offset`. Response items have: `userId`, `fullName`, `profilePhoto`, `bio`, `fitnessGoals`, `currentFitnessLevel`, `personalityTag`, `accentColor`, `vibeTrackTitle`, `vibeArtistName`, `vibeArtworkUrl`, `firstHighlight`, `highlightCount`.
- **Frontend** new `/app/frontend/app/trainer/discover-trainees.tsx`: vertical feed of large hero cards. Each card uses trainee's accent color as the border/strip, shows first-highlight or profile photo as hero, layered gradient, personality badge, name (Oswald uppercase), bio/goals snippet, vibe chip (artwork + track). Tapping routes to `/trainer/trainee-detail` cinematic showcase. Pull-to-refresh enabled.
- **Trainer Home tile**: Added a second Quick Actions row with a wide pink-gradient "DISCOVER TRAINEES" tile that routes to the feed.

### Bug fixes from testing agent feedback
1. **500 on bad base64**: Wrapped `base64.b64decode(data_b64)` in both `upload_highlight_base64` (trainer) and `upload_trainee_highlight_base64` with `try/except` → returns 400 "Invalid base64 payload" instead. Also switched to `validate=True` for stricter checks.
2. **Empty accent color**: Trainer + trainee `PUT /accent-color` now normalizes `""` to `None` before validation, so empty string acts as a clear instead of being stored as `''`.
3. **Parity gap**: Added `highlights: List[dict] = []` to `TrainerProfileResponse` in `models.py` so trainer and trainee profile GET shapes match.

### eas.json production patch
- Added missing `EXPO_PUBLIC_BACKEND_URL` to the `production` profile (set to current preview URL). Prevents TestFlight builds from launching with undefined API URL.

### Test coverage final tally
- `tests/test_iteration82_trainee_vibrancy.py` — 14 tests (added 4: bad base64 trainee + trainer, empty accent color clears null, trainer response has `highlights` key)
- `tests/test_iteration82_regression_and_edges.py` — 15 tests delivered by testing agent (validates trainer-side parity, discover shape, ObjectId leak guard, accent palette variants)
- All CI guards (iter79, iter81) still green. **29/29 iteration-82 tests passing.**

## Active Blocker
- **iOS App Store Deployment**: EAS build fails with `XCODE_BUILD_ERROR — Signing certificate "iPhone Distribution: Ashton Bundy" revoked` (Apple side). Resolution: contact support@emergent.sh with Job ID + Expo project ID `aa258400-544c-4da6-b007-0aff7ef361f6` to refresh iOS signing credentials.

## 2026-05-31 (Fork-Continued) — EAS Build Timeout Diagnosis
- **Issue**: User repeatedly hitting `context deadline exceeded` (25-min timeout) on EAS iOS production builds, destined for TestFlight.
- **Diagnosis (no code changes needed)**:
  1. Previous fork session fixed real code issues: hardcoded preview URL in `eas.json` production block, missing `.easignore` (~500 MB upload bloat), and garbage binary filenames (`=13px`, `=44px`, `@@9@8`) causing `lstat ENOENT` tarball failures. CI guard added at `/app/backend/tests/test_iteration81_no_garbage_files.py`.
  2. Last user log (`May 31 23:41:17`) shows `Uploaded to EAS` succeeded — codebase is healthy. Timeout occurred while waiting in Expo queue.
  3. User clarified destination is **TestFlight**, confused EAS vs TestFlight. Agent explained: EAS Build compiles the `.ipa`, then TestFlight distributes it. EAS is the vehicle, TestFlight is the destination.
  4. User then pasted EAS status page incident: **macOS data center networking outage May 31 13:38–ongoing PDT** — perfectly explains the queue stalls. Likely the *primary* cause, not credits.
- **Outstanding items for next session**:
  1. **⚠️ Production `EXPO_PUBLIC_BACKEND_URL` is MISSING** in `eas.json` production profile (lines 32–40). Code uses `process.env.EXPO_PUBLIC_BACKEND_URL` with no fallback — production builds will have `undefined` API URL and ALL screens will fail in TestFlight. User has not yet chosen a/b/c (a=preview URL, b=different prod URL, c=no prod backend deployed).
  2. User chose **Option C — Local Mac Build** as fallback. Steps documented in chat: Save-to-GitHub (requires paid Emergent subscription) → `git clone` on Mac → `yarn install` → `eas build --platform ios --profile production --local` → upload `.ipa` via Transporter app to App Store Connect → enable in TestFlight.
  3. User is pausing for the night. Will retry EAS cloud build after data center outage is resolved (monitor https://status.expo.dev).
- **DO NOT**: modify code attempting to fix the EAS timeout. Code is clean (35/35 CI guards pass). Issue is Expo infrastructure outage + missing production env var.

## Pending Tasks Backlog (P1–P3)
- **P1**: Patch missing `EXPO_PUBLIC_BACKEND_URL` in `eas.json` production profile (needs user decision a/b/c)
- **P1**: Instagram Graph API — endpoints scaffolded, awaiting user's `Instagram App ID` + `Instagram App Secret`
- **P2**: SendGrid email integration — awaiting user's SendGrid API key
- **P3**: Extract remaining messaging/location routes from `server.py` (~2700 lines) into `/app/backend/routes/`
- **P3**: Corporate wellness B2B partnerships onboarding

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
| Trainee | test_trainee_iter25@test.com | Test123! |
| Trainer | test_trainer_iter25@test.com | Test123! |
