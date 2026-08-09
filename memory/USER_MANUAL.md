# RapidReps — Complete User Manual & Feature Reference

_Last updated: iter118l (Feb 2026). Beta build._
_Bundle: `app.emergent.trainerfinder9f806c77e` · Backend: `trainer-finder-9.emergent.host`_

This is a soup-to-nuts walkthrough of every screen, every button, and every flow in the RapidReps app — usable as both an internal training doc and an external Q&A reference when explaining the app to investors, coaches, or beta users.

---

## Table of Contents

1. [What RapidReps is](#what-rapidreps-is)
2. [First launch & account creation](#1-first-launch--account-creation)
3. [Onboarding](#2-onboarding)
4. [Trainee side — every screen](#3-trainee-side)
5. [Trainer side — every screen](#4-trainer-side)
6. [Shared surfaces (Notifications, Messages, Safety, Legal)](#5-shared-surfaces)
7. [End-to-end booking flow](#6-end-to-end-booking-flow)
8. [Payments & Refunds](#7-payments--refunds)
9. [Push Notifications](#8-push-notifications)
10. [Admin Panel](#9-admin-panel)
11. [Beta testing helpers](#10-beta-testing-helpers)
12. [Troubleshooting cheatsheet](#11-troubleshooting-cheatsheet)

---

## What RapidReps is

RapidReps is a **two-sided fitness marketplace** — trainees book verified in-person or virtual training sessions with local trainers. The Uber-style experience:

- **Trainee** opens app → sees nearby trainers on a map + a persistent "Available Now" sheet → taps **Book [Trainer] Now** → picks a session type/time → pays with Stripe → session tracked with GPS check-in.
- **Trainer** goes ONLINE → gets matched requests → confirms → drives/joins virtually → completes session → gets paid (Stripe on the platform; payout to trainer via Zelle).

Every session is verified through GPS check-in, ratings, and platform-mediated payment.

---

## 1. First launch & account creation

### Splash / landing (`app/index.tsx`)
- RapidReps hero, logo, tagline
- **[Get Started]** → auth signup
- **[Log In]** link (bottom) → login screen

### Sign up (`app/auth/signup.tsx`)
Collects: Full name · Email · Phone (US format) · Password (min 8 chars) · Role selection (**"I want to train"** = trainee, **"I'm a trainer"** = trainer).

Buttons:
- **[Create Account]** — creates user, returns JWT, routes to onboarding
- **[Log in instead]** — swap to login
- **[Continue with Google]** — Emergent-managed Google OAuth (bypasses password)

### Log in (`app/auth/login.tsx`)
- Email + password
- **[Log In]** — auth + route to correct home tab
- **[Forgot password?]** → `forgot-password.tsx` (email reset link)
- **[Sign up instead]** → back to signup

### Forgot password (`app/auth/forgot-password.tsx`)
- Enter email → **[Send reset link]**
- Reset link deep-links back into the app → `change-password.tsx`

---

## 2. Onboarding

### Trainee onboarding (`app/auth/onboarding-trainee.tsx`)
1. **Location permission** — required for map + nearby feature. If denied, the app still works but nearby is empty.
2. **Notification permission** — required for booking updates.
3. **Fitness goals** — tag picker (fat loss, strength, mobility, competition prep, etc.).
4. **Experience level** — beginner / intermediate / advanced.
5. **Preferred session types** — outdoor / in-home / virtual / gym-based.
6. **[Start Training]** → trainee home.

### Trainer onboarding (`app/auth/onboarding-trainer.tsx` + `app/trainer/onboarding.tsx`)
1. Personal info — legal name, phone, DOB, address.
2. **Certifications upload** — photos of NASM/ACE/etc.
3. **CPR/AED cert upload** — mandatory.
4. **Government ID** — driver's license front/back.
5. **SSN entry** — encrypted with Fernet (`pii_crypto.py`); stored as `ssnEncrypted` + `ssnLast4`.
6. **Bio + training styles** — free text + tag picker.
7. **Gyms worked at** + primary gym.
8. **Availability** — hours per day + session durations offered.
9. **Rate setup** — outdoor, in-home, virtual rates (cents).
10. **Submit** — status = `PENDING`. Admin approves → `canGoLive: true`.

Until approved, the trainer sees a "Verification pending" home and cannot appear in trainee searches or accept bookings.

---

## 3. Trainee side

### Bottom tab bar (6 tabs)
`Home` · `Sessions` · `Receipts` · `Chat` · `Saved` · `Profile`

---

### 3.1 Home tab (`app/trainee/(tabs)/home.tsx`)

**Header (top of every scroll)**
- **RAPIDREPS wordmark lockup** (barbell + italic RAPID/REPS)
- **[🔔 Bell]** — opens `notifications.tsx`; red badge = unread count
- **[☰ Menu]** — dropdown:
  - Verify Trainer (QR code scan flow)
  - Safety Center (moved off home in iter118f — safety tips + SOS)
  - Log out
  - Delete account

**Hero card**
- Orange-outlined card, right-anchored trainer photo, headline: "LET'S GET / AFTER IT, / [NAME]! 💪🔥" (name in white, "AFTER IT," in orange)
- Subtitle "Your next workout is / just one tap away"
- Location pill under subtitle showing your current city if GPS granted
- Card is decorative — tapping it does nothing

**Action cards row (3 tiles)**
- **[GROUP WORKOUTS]** (orange) → `group-sessions.tsx` — open group workouts to join
- **[COMMUNITY FEED]** (purple) → `feed.tsx` — posts, tips, highlights
- **[MY PROGRESS]** (pink) → `user-progress.tsx` — history, streak calendar, badges

**Search bar**
- `PeopleSearchBar` — search trainers by name/email/phone across the whole platform
- Filter icon on right → placeholder (P2 backlog)
- Hint: "Find any trainer nationwide — not limited to your area"

**"Available Now" sheet (persistent, Uber-style)**
- Fixed to bottom, always visible when trainers exist within radius
- Each row shows: avatar + name + rating + distance + ETA + `$XX / session`
- Badges: **"Fastest match"** (blue, shortest ETA) or **"Top rated"** (green, highest rating)
- Tapping a row **selects** that trainer (orange border, Book Now label updates)
- Auto-selects the fastest match on open → book is one tap from open
- **[Book [Name] Now]** — persistent orange gradient bottom bar → `trainer-detail.tsx`
- Handle at top: drag up to expand (78% of screen), drag down to collapse (~340px)

**Map behind the sheet** (`NearbyTrainersMap`)
- Dark-themed Google Maps (`PROVIDER_GOOGLE` forced on iOS via `mapDark.ts`)
- Blue avatar pins at each trainer's location
- Your location = blue dot
- Tap a pin → selects same trainer in the sheet

---

### 3.2 Sessions tab (`app/trainee/(tabs)/sessions.tsx`)

**Segmented control:** `Upcoming` · `Past` · `Requests` · `Recurring`

**Upcoming cards** — each shows:
- Trainer avatar + name, date/time, duration, session-type badge, location or "Virtual"
- **[View]** → `session-detail.tsx`
- **[Cancel]** (visible >24h before start) → confirm modal → automatic refund

**Past cards**
- Same layout + **[Rate]** if not rated → `rate-session.tsx` (5-star + review + trainer badges)

**Requests**
- Sessions awaiting trainer confirmation
- **[Cancel Request]** → refund + notify trainer

**Recurring**
- Auto-repeat weekly bookings → `recurring-sessions.tsx`

**FAB** — **[+ New Session]** → `schedule-training.tsx`

---

### 3.3 Receipts tab (`app/trainee/(tabs)/receipts.tsx`)

- Chronological list of all successful payments (Stripe pill removed in iter118f)
- Row: date, trainer name, session type, amount paid
- **[View]** → `receipt.tsx` — printable invoice with line items, platform fee, Stripe last-4
- Inside the receipt: **[Report Issue]** → `report-issue.tsx` (dispute intake)
- Date-range filter (top-right)

---

### 3.4 Chat tab (`app/trainee/(tabs)/messages.tsx`)

- List of active conversations (one per trainer you've ever booked)
- Green dot = trainer online now
- Tap a conversation → `messages/chat.tsx` — real-time via WebSocket, photo/video attach, read receipts, typing indicator
- **[+]** header — start a new convo with any saved trainer
- Video call icon in chat header — starts virtual session

---

### 3.5 Saved tab (`app/trainee/(tabs)/saved.tsx`)

- Grid of favorited trainers
- Tap card → `trainer-detail.tsx`
- **[❤️]** on card = un-favorite
- **[Book]** shortcut → skip detail, straight into booking form

---

### 3.6 Profile tab (`app/trainee/(tabs)/profile.tsx`)

**Header block**
- Large avatar (tap to upload new photo)
- Full name + email + phone
- Streak counter (days trained in a row)
- Accent color picker

**Trainer Vibe Player** — auto-plays your set anthem on visit
- **[Change Your Anthem]** (iter118f) — → `vibe-setup.tsx`. Label swaps to "Change" when set + shows current track/artist. When unset, label is "Set Your Anthem".

**Training Preferences section**
- Preferred session types (in-person / virtual / in-home) — toggles
- Preferred training styles (multi-select tag)
- **Virtual Training** toggle — allow virtual bookings
- **Trainer Proximity** (iter118i, live-persisted):
  - Slider 1-100 mi + quick chips (5 / 10 / 25 / 50 / 100)
  - Writes to `AsyncStorage['trainee_proximity_miles']` immediately
  - Home re-reads on tab focus → instantly re-filters the map + Available Now sheet

**Account section**
- **[Edit Profile]** — full name, bio, photo
- **[Notification Preferences]** → `notification-preferences.tsx` (per-category toggles)
- **[Change Password]** → `change-password.tsx`
- **[Referrals]** → `referral/*` (invite for credits)
- **[Membership]** → `membership.tsx` (subscription tier)
- **[Legal]** — Terms + Privacy
- **[Log out]**
- **[Delete Account]** (confirm modal)

---

### 3.7 Booking flow (deep dive) — `trainer-detail.tsx`

After tapping Book Now from the sheet:
1. **Profile view** — bio, certs, gyms, rates, reviews, gallery
2. **[Book This Trainer]** (bottom)
3. **Session type picker** — Outdoor / In-Home / Virtual (only what the trainer offers)
4. **Duration picker** — 30 / 45 / 60 / 90 min
5. **Date + time picker** — trainer's available slots
6. **Location picker** — your address (in-home) or address picker (outdoor)
7. **[Continue to payment]** → `confirm-booking.tsx`

**`confirm-booking.tsx`**
- Session summary card
- Price breakdown: session fee + platform fee + total
- **[Add tip]** optional
- **[Pay $X.XX]** → Stripe payment sheet
- Success → session created, both users get push, chat thread opens

---

## 4. Trainer side

### Bottom tab bar (6 tabs)
`Home` · `Sessions` · `Receipts` · `Chat` · `Funds` (Earnings) · `Profile`

---

### 4.1 Home tab (`app/trainer/(tabs)/home.tsx`) — **PIXEL-LOCKED per approved mockup**

**Header**
- RAPIDREPS wordmark lockup + barbell logo (left)
- **[🔔 Bell]** — → `notifications.tsx`, red unread badge
- **[☰ Menu]** — same dropdown as trainee side

**Hero + ONLINE toggle (single orange-outlined card, iter118d)**
- Right-anchored trainer photo (78% width)
- Left: orange "WELCOME BACK," + white "LET'S TRAIN," + orange first name + "💪🔥"
- Bottom of same card: **ONLINE & AVAILABLE** row with green dot + iOS-style toggle
  - **[Toggle ON]** — visible in trainee searches; requests + push flow enabled
  - **[Toggle OFF]** — invisible; no incoming requests
  - Uses `handleToggleAvailability` — writes location perms + server availability

**4 stat cards row**
- **Today's Sessions** (orange calendar) — filters today's confirmed/in-progress sessions; subtitle shows "Next: HH:MM" or count fallback. Tap → Sessions tab.
- **Nearby Trainees** (purple pin) — count within 5 mi (from `getNearbyTrainees`). Tap → `discover-trainees.tsx`.
- **Rating** (blue star) — `averageRating` + review count from `getOnboardingStatus`. Tap → Profile tab.
- **Level** (pink chart) — Newbie / Rising / Pro / Elite + subtitle: Top 10% / Top 25% / Growing. Tap → `achievements.tsx`.

**Total Earnings card**
- Wallet badge + "TOTAL EARNINGS" label
- **[Period pill]** dropdown (top-right) — This Week / This Month / All Time; swaps the headline $ amount
- Big $ number
- **Orange sparkline** (SVG smoothed via `react-native-svg`) — last 12 weeks from `weeklyBreakdown`
- 3-column breakdown row: THIS WEEK / THIS MONTH / ALL TIME with ↑/↓ % change vs previous period

**"Visible to nearby trainees" banner** (green outline, only when ONLINE)
- Broadcast icon + "You are visible in [city]…"
- **[Manage]** → `edit-profile.tsx`

**Single-row action grid (4 tiles) — iter118d pixel-locked**
- **[Edit Profile]** (orange person) → `edit-profile.tsx`
- **[Verification]** (purple shield + green ✓ badge if verified) → `verification.tsx`
- **[Set Rates]** (blue $ circle) → `set-rates.tsx` (locked padlock if unverified — tap sends to verification)
- **[Settings]** (red gear) → Profile tab

**Pending Requests section** (only if any pending)
- Card per request with trainee name/photo, when, session type, location
- **[Accept]** / **[Decline]** buttons

**Upcoming Sessions section**
- Same layout as trainee side
- **[Start Session]** button appears 15 min before start → `start-session.tsx`

---

### 4.2 Sessions tab (`app/trainer/(tabs)/sessions.tsx`)

**Segments:** `Today` · `Upcoming` · `Past` · `Requests`

Actions per session card:
- **[View]** → `session-detail.tsx`
- **[Start Session]** → `start-session.tsx` (pre-flight checklist + GPS lock)
- **[Mark Complete]** → `session-complete.tsx`
- **[Cancel]** → confirm modal (with penalty warning if <24h)
- **[Message Trainee]** → chat

---

### 4.3 Receipts tab (`app/trainer/(tabs)/receipts.tsx`)

- Every completed session with payment
- Row: date, trainee, session type, gross amount, platform fee, **net to trainer**
- **[View Details]** → `receipt.tsx`

---

### 4.4 Chat tab

Same UX as trainee side — one thread per trainee you've had sessions with.

---

### 4.5 Funds tab (`app/trainer/(tabs)/earnings.tsx`)

**Top card:** Available Balance (cleared, ready for payout)

**Pending Payouts card:** funds in Stripe's 2-day rolling reserve

**[Withdraw]** → payout flow — Zelle-based (no Stripe Connect). Admin batches Zelle sends weekly or on-demand.

**Withdrawal history** below

**Bank / Payout Method section**
- **[Connect Bank]** → `connect-bank.tsx` — Zelle email/phone verification

---

### 4.6 Profile tab (`app/trainer/(tabs)/profile.tsx`)

**Public profile preview** — what trainees see:
- Cover photo + avatar
- Name, tier badge, rating + review count
- Bio
- Certifications list
- Gyms worked at
- Training styles chips
- Rates table (outdoor / in-home / virtual)

**Vibe Player** — auto-plays your anthem
- **[Change Your Anthem]** (iter118i) — → `vibe-setup.tsx`. Same behavior as trainee side — label swaps to "Change Your Anthem" when set.

**Trainer Tools section**
- **[My Tools]** → `trainer-tools.tsx` (calendar sync, availability blocks, session templates)
- **[Group Sessions]** → `group-sessions.tsx` (create open group workouts)
- **[Achievements]** → `achievements.tsx` (badges earned)
- **[Boosts]** → `boosts.tsx` (paid visibility promotions — appear higher in nearby list)

**Account section**
- **[Edit Profile]**
- **[Verification]** (status)
- **[Set Rates]**
- **[KYC]** → `kyc.tsx` (background check + SSN status)
- **[Notification Preferences]**
- **[Change Password]**
- **[Referrals]**
- **[Legal]**
- **[Log out]** / **[Delete Account]**

---

### 4.7 Discover Trainees screen (`app/trainer/discover-trainees.tsx`)

- Grid/map of nearby trainees
- Only accessible from Home stat card (not a tab)
- Tap → `trainee-profile.tsx` — goals, past sessions, preferences

---

### 4.8 Trainer-specific deep screens

- **`start-session.tsx`** — pre-session checklist, GPS lock, "I'm here" button that pushes trainee
- **`en-route.tsx`** — live Google Maps polyline routing to trainee
- **`gps-checkin.tsx`** — mid-session location proof
- **`session-detail.tsx`** — trainer-side session view
- **`highlight-upload.tsx`** — post-session highlight video/photo → appears in trainee feed
- **`upload-video.tsx`** — profile intro video
- **`badge.tsx`** — earned badges detail
- **`trainee-detail.tsx`** — full trainee history + preferences before session
- **`virtual-request.tsx`** — incoming virtual session request screen

---

## 5. Shared surfaces

### 5.1 Notifications (`app/notifications.tsx`)

- Chronological list of push + in-app notifications
- Each: icon, title, body, timestamp
- Tap → deep link (session detail, chat, etc.)
- **[Mark all read]** at top
- Gear icon → `notification-preferences.tsx` (per-category toggles: bookings, chat, promos, streaks, safety)

### 5.2 Messages (`app/messages/*`)

- **`index.tsx`** — all conversations
- **`chat.tsx`** — one-on-one thread
  - Real-time via WebSocket
  - Photo/video attach
  - **[📞 Video Call]** header button — starts a virtual session inline
  - Read receipts + typing indicator

### 5.3 Safety Center (`app/trainee/safety-center.tsx`) — lives in hamburger menu

- Session safety tips ("meet in public first session," GPS-share with a friend, etc.)
- **[🚨 SOS button]** — 3-second hold triggers 911 dial prompt + push to emergency contact + GPS ping to admin
- Emergency contact management
- Incident report form
- Community guidelines

### 5.4 Legal

- **`legal/terms.tsx`** — Terms of Service
- **`legal/privacy.tsx`** — Privacy Policy (includes PII/SSN encryption disclosure)
- **`dispute/*`** — Chargeback + issue-reporting flow

---

## 6. End-to-end booking flow

### Trainee's view

1. Open app → home with "Available Now" sheet
2. Auto-selected trainer with **[Book [Marcus] Now]**
3. Tap → `trainer-detail.tsx`
4. **[Book This Trainer]** → session type → duration → date/time → location
5. **[Continue to payment]** → `confirm-booking.tsx`
6. Enter/select payment method → **[Pay $X.XX]**
7. Stripe processes → PaymentIntent succeeds → backend creates session doc
8. Push notifications fire to both users
9. Chat thread opens with a "Session Booked" system message

### Trainer's view (in parallel)

1. Push notification: "New session request from [Trainee]"
2. Tap → request screen → **[Accept]** / **[Decline]**
3. If accepted: session moves from Requests to Upcoming
4. 15 min before start: **[Start Session]** appears
5. Trainer taps → `start-session.tsx` → GPS lock → **[I'm here]** or **[En route]**
6. `en-route.tsx` shows live polyline map to trainee
7. Trainer arrives → **[GPS Check-in]** → session starts, timer runs
8. Mid-session GPS proof (`gps-checkin.tsx`)
9. Session ends → **[Mark Complete]**
10. Trainee sees `rate-session.tsx` prompt
11. Payment settles to trainer's balance (Funds tab, 2-day rolling)

---

## 7. Payments & Refunds

### Live Stripe (iter118j)

- **Publishable key** — `pk_live_51T7L4j…` (frontend `.env` + `eas.json` production profile)
- **Secret key** — `sk_live_51T7L4j…` (backend `.env`)
- **Webhook** — `https://trainer-finder-9.emergent.host/api/webhooks/stripe` (signature-verified)
- **Events**: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`
- Statement descriptor: as configured in your Stripe dashboard → Business settings → Public details

### Refund policy

- **Trainee cancel >24h before start:** full refund (automatic)
- **Trainee cancel <24h:** 50% refund (configurable in admin); remainder held as platform revenue
- **Trainer cancel:** full refund to trainee + trainer strike (3 strikes = review)
- **Dispute:** `dispute/*` flow — admin arbitrates, funds held in escrow

### Trainer payouts

- **NOT Stripe Connect** — payouts via **Zelle** (US-only initially)
- Trainer registers Zelle email/phone in `connect-bank.tsx`
- **[Withdraw]** in Funds tab → admin processes Zelle send (weekly or on-demand)

---

## 8. Push Notifications

### Architecture (iter118k — direct FCM + APNs)

- Backend sends **directly** to Google FCM V1 (Android) + Apple APNs (iOS) using credentials at `/app/backend/credentials/`
- Bypasses Expo Push Service in production
- Legacy Expo tokens still work (Expo Go, dev builds)

### Token registration (`NotificationContext.tsx`)

1. App starts → asks for notification permission
2. If granted → `getDevicePushTokenAsync()` returns native FCM/APNs token
3. Falls back to `getExpoPushTokenAsync()` for dev builds
4. Backend `POST /api/push-tokens/register` stores `{userId, token, tokenType, bundleId}`

### Testing your own push

- `POST /api/push-tokens/test` (auth required) — sends a "RapidReps test push" to all your registered devices
- Returns per-token routing summary so you can see fcm vs apns vs expo

### Foreground vs background

- **Foreground**: banner shown by `Notifications.setNotificationHandler`
- **Background/killed**: OS delivers via APNs/FCM directly; tap opens the app to the deep link

---

## 9. Admin panel

**Routes:** `app/admin/dashboard.tsx` + `app/admin/disputes.tsx`

**Access:** log in as an admin user (any user with `isAdmin: true`). Default: `admin@rapidreps.com` / `admin123`.

**Dashboard sections:**
- User counts (trainees / trainers / verified)
- Pending trainer verification queue → per-trainer approve/reject
- Recent bookings + revenue
- Dispute queue → `disputes.tsx`
- **Beta seed status** (iter118l) — see Section 10

**Trainer approval flow:**
1. Trainer submits verification in `verification.tsx`
2. Admin sees them in dashboard → clicks trainer
3. Reviews: ID photos, SSN last-4, certs, background check status
4. **[Reveal SSN]** — audit-logged Fernet-decrypt (only for suspicious cases; every reveal recorded to `admin_audit_log`)
5. **[Approve]** — flips `isVerified: true`, `verificationStatus: 'verified'`, `canGoLive: true`
6. Admin also assigns tier (Newbie / Rising / Pro / Elite)

**Dispute handling:**
1. Trainee/trainer reports issue in `report-issue.tsx`
2. Appears in admin `disputes.tsx` queue
3. Admin reviews evidence, chat log, session GPS
4. Options: refund trainee / release funds to trainer / partial split / escalate to Stripe dispute

---

## 10. Beta testing helpers

### Auto-seed nearby trainers (iter118l)

- When a fresh trainee first calls `GET /api/trainers/nearby`, backend spawns **3 verified sample trainers** 3-15 mi from their GPS
- All flagged `isBetaSeed: true`
- Idempotent — same trainee never gets duplicates

**Turn OFF for production:**
1. Log in as admin
2. `POST /api/admin/beta-seed/purge` (or use the Purge button when the UI ships)
3. Edit `backend/.env` → set `BETA_AUTO_SEED_TRAINERS=false`
4. Restart: `sudo supervisorctl restart backend`

**Check status any time:**
- `GET /api/admin/beta-seed/status` → `{ featureEnabled, seededUsers, seededTrainerProfiles, traineesEverSeeded }`

### Pre-existing seeded trainers (iter118i, permanent)

5 permanent verified trainers in the MD corridor (Elkridge, Hanover, Laurel, College Park) — NOT flagged `isBetaSeed`, so they survive the beta purge.

- **Password for all:** `SamplePass!2025`
- **Emails:** `<firstname>.<city>@rapidreps-seed.com`
- **Re-seed anytime:**
  ```
  cd /app/backend && python -m scripts.seed_sample_trainers
  ```

---

## 11. Troubleshooting cheatsheet

| Symptom | Likely cause | Fix |
|---|---|---|
| "No trainers nearby" on trainee home | Radius too small OR no trainers in area | Profile → Trainer Proximity → widen. Wait ~2s (beta auto-seed spawns 3 on first call) |
| Trainer can't go online — toggle bounces | Not verified OR no location permission | Complete Verification. Settings → Location permission ON |
| Payment sheet: "Publishable key error" | Frontend using test key on live backend or vice versa | Restart Expo, verify `.env` + `eas.json` have matching mode |
| Push arrives in foreground only | Production build not yet rebuilt with FCM/APNs entitlements | Run `eas build --platform ios/android --profile production`. Test via `POST /api/push-tokens/test` |
| Chat messages don't arrive | WebSocket disconnected | Pull to refresh conversation or restart app |
| GPS check-in fails | Location perm revoked mid-session OR trainer >100 m from booked address | Trainer re-grants location, re-taps check-in |
| Trainer profile shows "unverified" after approval | UI cache | Trainer logs out → back in |
| Available Now sheet doesn't update after distance change | Home not re-focused | Switch to another tab and back — home reads AsyncStorage on focus |
| Trainer earnings show $0 after session | Payout in Stripe rolling reserve (2 days) | Wait 48h |
| Refund not received by trainee | Bank processing (5-10 business days for card refunds) | Check Stripe → Payments → Refunds |
| Admin approve button doesn't flip trainer live | `assignedTier` field missing | `POST /api/admin/backfill-trainer-visibility` |

---

## 12. Quick reference — every big button

### Trainee — home
| Button | Action |
|---|---|
| **[🔔 Bell]** | Open notifications |
| **[☰ Menu]** | Log out / Safety Center / Verify Trainer / Delete Account |
| **[GROUP WORKOUTS]** | Open group-sessions.tsx |
| **[COMMUNITY FEED]** | Open feed.tsx |
| **[MY PROGRESS]** | Open user-progress.tsx |
| **[Book [Name] Now]** | Go to trainer-detail booking flow |
| Trainer row tap | Select as booking candidate |
| Map pin tap | Select same trainer in sheet |

### Trainee — profile
| Button | Action |
|---|---|
| **[Change Your Anthem]** | vibe-setup.tsx to pick/change song |
| **Proximity slider** | Live-persists trainer radius filter |
| **Proximity quick chip (5/10/25/50/100)** | Sets exact radius |
| **[Edit Profile]** | Full name / bio / photo |
| **[Notification Preferences]** | Per-category toggles |
| **[Change Password]** | change-password.tsx |
| **[Referrals]** | referral/* |
| **[Membership]** | Subscription tier |
| **[Log out]** | Ends session |
| **[Delete Account]** | Permanent (confirm modal) |

### Trainer — home
| Button | Action |
|---|---|
| **[🔔 Bell]** | Open notifications |
| **[☰ Menu]** | Log out / delete / safety |
| **[ONLINE toggle]** | Go online (visible) / offline |
| Today's Sessions card | Jump to Sessions tab |
| Nearby Trainees card | discover-trainees.tsx |
| Rating card | Profile tab |
| Level card | achievements.tsx |
| Period pill (Total Earnings) | Swap headline $ (week/month/all-time) |
| **[Manage]** on Visible banner | edit-profile.tsx |
| **[Edit Profile]** | edit-profile.tsx |
| **[Verification]** | verification.tsx |
| **[Set Rates]** | set-rates.tsx (or verification if unverified) |
| **[Settings]** | Profile tab |
| **[Accept] / [Decline]** on pending | Confirm/reject booking request |
| **[Start Session]** on upcoming | start-session.tsx (GPS check-in) |

### Trainer — profile
| Button | Action |
|---|---|
| **[Change Your Anthem]** | vibe-setup.tsx |
| **[My Tools]** | trainer-tools.tsx |
| **[Group Sessions]** | Create/manage group workouts |
| **[Achievements]** | Earned badges |
| **[Boosts]** | Paid visibility promotion |
| **[KYC]** | Background check + SSN status |
| **[Referrals]** | referral/* |
| **[Log out]** / **[Delete Account]** | Standard |

---

## Where the data lives

- **Backend:** FastAPI at `trainer-finder-9.emergent.host` (production) or `highlight-vibe-bugs.preview.emergentagent.com` (preview)
- **Database:** MongoDB — key collections: `users`, `trainer_profiles`, `sessions`, `payment_transactions`, `push_tokens`, `notifications`, `messages`, `beta_seeded_trainees`, `admin_audit_log`
- **File storage:** Emergent-managed object storage
- **Push credentials:** `/app/backend/credentials/` (gitignored — rotate the leaked ones ASAP)
- **Stripe:** live keys in `backend/.env` from iter118j onwards
- **Feature flags in `backend/.env`:**
  - `BETA_AUTO_SEED_TRAINERS=true` — spawn 3 trainers per new trainee (turn off for prod)

---

## Critical pre-launch checklist

- [ ] Revoke leaked APNs key `AW9VZJC7TF` at developer.apple.com and regenerate
- [ ] Revoke leaked Firebase service-account key `7b1f912684` at Firebase Console and regenerate
- [ ] Replace files at `/app/backend/credentials/apns-key.p8` and `firebase-service-account.json` with fresh ones
- [ ] `POST /api/admin/beta-seed/purge` to remove all `isBetaSeed=true` trainers
- [ ] Set `BETA_AUTO_SEED_TRAINERS=false` in `backend/.env`
- [ ] `eas build --platform ios --profile production && eas build --platform android --profile production`
- [ ] Do a real $0.50 booking → refund end-to-end on production URL
- [ ] Verify Stripe live dashboard shows the charge + webhook delivery 200s

---

_This document reflects RapidReps at iter118l. When shipping to production, the beta-seed feature MUST be turned off (Section 10) and leaked credentials rotated (checklist above)._
