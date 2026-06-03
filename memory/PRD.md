# RapidReps PRD

## Original Problem Statement
RapidReps is a full-stack fitness platform (React Native/Expo + FastAPI + MongoDB) connecting trainers with trainees. Features include session booking, **Stripe-only** payments (Zelle deprecated), trainer verification, personality tags, accent colors, cinematic UI transitions, streaks/achievements, and admin dashboards. Pricing uses tiered take-homes (New 75%, Certified 80%, Specialty 85%) and sessions MUST go through a Propose/Counter/Accept negotiation on time + location before payment is unlocked.


## 2026-06-03 — Iteration 96: DS Sweep Closure + B2B Corporate Wellness 🚀 ✅

### Shipped

**P1 — Design System Token Sweep Closure**
- Verified the prior bulk search/replace on 5 frontend files was syntactically clean (TS parses with zero TS1xxx errors)
- Applied DS token mapping to all remaining tabs/screens:
  - `app/trainer/(tabs)/home.tsx` (already in flight)
  - `app/trainee/(tabs)/messages.tsx` — COLORS map now sources from `DS.colors`
  - `app/trainer/(tabs)/messages.tsx` — COLORS map now sources from `DS.colors`
  - `app/trainee/confirm-booking.tsx` — COLORS map now sources from `DS.colors`
  - `app/trainer/(tabs)/profile.tsx` — COLORS map now sources from `DS.colors`
  - `src/components/admin/AdminShared.tsx` — the central `C = {...}` palette used by the entire admin dashboard now routes through `DS.colors`, unifying every admin tab in one move

**P3 — B2B Corporate Wellness Onboarding (Full Scope)**
- **Backend** (`/app/backend/routes/corporate_routes.py`, 12 endpoints under `/api/corporate/*`):
  - `POST /companies` — self-serve signup; creator auto-promoted to company admin; slug uniqueness enforced
  - `GET /companies` (platform admin only) · `GET /companies/{id}` · `PATCH /companies/{id}` (company admin gated)
  - `POST /companies/{id}/credit-pool` — top-up with ledger row in `corporate_credit_ledger`
  - `POST /companies/{id}/invites` — generates an 8-char alphanumeric invite code with `maxUses`, `creditAllowanceCents`, `expiresInDays`
  - `GET /companies/{id}/invites` · `GET /companies/{id}/employees` (enriches with user.fullName/email) · `GET /companies/{id}/usage`
  - `POST /redeem` — trainee enters code, creates `corporate_memberships` row, increments invite + employee counters, denormalizes `corporateCompanyId` on the user doc
  - `GET /me/company` — current user's affiliation
  - `GET /landing/{slug}` — **public, no auth**; deliberately strips `creditPoolCents`, `adminUserIds`, `contactEmail` from the response
- **Frontend** (5 new screens):
  - `app/corporate/index.tsx` — smart router (employee → company card, admin → dashboard, else → signup/redeem)
  - `app/corporate/signup.tsx` — company self-signup with slug preview ("rapidreps.com/c/<slug>")
  - `app/corporate/dashboard.tsx` — three tabs: Overview (credit pool hero + stat tiles), Invites (generate + list with active/used status), Employees (avatar list + allowance/used)
  - `app/corporate/redeem.tsx` — employee code redemption + success screen with allowance reveal
  - `app/corporate/c/[slug].tsx` — public branded landing page (employer brand color, tagline, feature grid, dual CTAs)
- **API client**: new `corporateAPI` object in `src/services/api.ts` exposes all 12 methods
- **Data models**: `corporate_companies`, `corporate_invites`, `corporate_memberships`, `corporate_credit_ledger`

### Verified
- ✅ **61/61 backend pytest guards pass** (15 new iter96 + 46 carried iter95). Testing agent v3 confirmed 100% pass rate, zero issues, no action items.
- ✅ Public landing endpoint correctly hides sensitive fields (validated with explicit pytest assertions)
- ✅ Role gating: trainee 403s on admin-only routes, outsiders 403 on company-scoped routes
- ✅ Double-enrollment guard (409), expired invite (410), invalid code (404), negative top-up (422)
- ✅ DS token sweep static guards confirm DS.colors in all 6 target files

### Files added
- `backend/routes/corporate_routes.py` (480 lines, 12 endpoints)
- `backend/tests/test_iteration96_corporate.py` (20 guards — 15 live API + 5 static)
- `frontend/app/corporate/index.tsx`
- `frontend/app/corporate/signup.tsx`
- `frontend/app/corporate/redeem.tsx`
- `frontend/app/corporate/dashboard.tsx`
- `frontend/app/corporate/c/[slug].tsx`

### Files modified
- `backend/server.py` — wires `corporate_router` with `/api` prefix
- `frontend/src/services/api.ts` — appends `corporateAPI` object
- `frontend/app/trainer/(tabs)/home.tsx`, `trainee/(tabs)/messages.tsx`, `trainer/(tabs)/messages.tsx`, `trainee/confirm-booking.tsx`, `trainer/(tabs)/profile.tsx`, `src/components/admin/AdminShared.tsx` — DS token adoption

### Still blocked
- SendGrid email — awaiting `SENDGRID_API_KEY` (currently logs to console only)
- Instagram Graph API — awaiting `Instagram App ID` + Secret

### Next up
- Hash-based A/B Welcome variant assignment (currently env-flag controlled via `EXPO_PUBLIC_WELCOME_VARIANT`)
- Wire corporate credit pool into the payment flow so employee bookings actually debit from `creditPoolCents` and `creditUsedCents`
- "Open Corporate" CTA from the auth/welcome screens for inbound B2B traffic


## 2026-06-03 — Iteration 95c: Variant B + Tier Celebration + Chunked Reels + DS Sweep 🎯 ✅

### Shipped (all 4 parts of the batch)
**(b) Welcome Variant B** — real differentiated hero in `app/index.premium-b.tsx`:
  - Community-first headline "TRAINERS / NEAR YOU" (vs. A's "DELIVERED RAPIDLY")
  - Live social-proof strip: pulsing green dot + 5 colored avatars + "237 trainers in your area"
  - Stat tiles (4.9 avg rating, 12k+ sessions, <10m avg match)
  - Reordered CTAs ("MATCH WITH A TRAINER" / "I'M A TRAINER")
  - **Same testIDs as A** so funnel analytics deltas are clean

**(c) Tier Celebration Sheet** — one-shot confetti modal:
  - New backend endpoints: `GET /api/trainer/tier-celebration` (returns shouldShow/tier/takeHomePct) and `POST .../acknowledge` (persists `tierCelebrationAck` on `trainer_profiles`)
  - New component `src/components/TierCelebrationSheet.tsx` — CSS-only confetti, gradient crest, tier label + take-home % stat row, "Set My Rates" primary CTA
  - Wired into `app/trainer/(tabs)/home.tsx`: fires once on first launch after tier assignment, never again

**(d) Chunked Highlight Reel Uploads** — bypasses proxy multipart ceilings:
  - 4 new backend endpoints under `/api/trainer-profiles/{user_id}/highlights/chunked/`: `init` → `append` → `commit` (or `DELETE` to abort)
  - 2 MB chunks (configurable), 100 MB ceiling per reel, 1h session TTL with auto-GC of stale sessions
  - Backend reuses the existing `_store_highlight` pipeline so thumbnails/storage just work
  - Frontend helper `src/utils/uploadHighlightChunked.ts` (200 lines) drives the protocol with progress callbacks + abort signal support
  - Trainer highlight upload screen auto-uses chunked for video paths, falls back to FormData on failure

**(a) DS Token Sweep** — proof-of-concept on top-traffic screens:
  - Added `orangeDeep` and `orangeEmber` semantic tokens to `designSystem.ts`
  - `trainer/session-detail.tsx` — full DS adoption (already shipped iter95b)
  - `trainee/(tabs)/profile.tsx` — local COLORS map now sources from `DS.colors`
  - `trainee/(tabs)/sessions.tsx` — local COLORS map now sources from `DS.colors`
  - Pattern established for the remaining 7 high-traffic screens (Discover, both Homes, Settings, Messages, Booking, Admin Dashboard)

### Verified
- ✅ **66/66 pytest guards green** (iter92+92b+93+94+95+95b+95c). New iter95c suite (`test_iteration95c_batch_all.py`) adds 16 fresh guards including live E2E for:
  - Tier celebration shouldShow / acknowledge / never-show-again lifecycle
  - Chunked upload init → append → commit → highlight stored
  - Chunked init rejects 200 MB declared size
  - Chunked abort cleanup makes subsequent append return 404
- ✅ Variant B differentiation guard ensures B is NOT a re-export of A
- ✅ Live backend logs confirm celebration ack + chunked uploads round-trip cleanly

### Files added
- `frontend/src/components/TierCelebrationSheet.tsx` (new — confetti tier sheet)
- `frontend/src/utils/uploadHighlightChunked.ts` (new — chunked uploader)
- `backend/tests/test_iteration95c_batch_all.py` (16 new guards)

### Files modified
- `frontend/app/index.premium-b.tsx` — full Variant B rewrite (no longer a re-export)
- `frontend/app/trainer/(tabs)/home.tsx` — fetches + renders TierCelebrationSheet
- `frontend/app/trainer/highlight-upload.tsx` — uses chunked path for videos
- `frontend/app/trainee/(tabs)/profile.tsx`, `frontend/app/trainee/(tabs)/sessions.tsx` — DS color tokens
- `frontend/src/theme/designSystem.ts` — added `orangeDeep`, `orangeEmber`
- `backend/routes/payment_routes.py` — added tier-celebration GET + acknowledge endpoints
- `backend/routes/profile_routes.py` — added 4 chunked upload endpoints + GC

### Outstanding (carryover)
- 🟠 P1: Continue DS token sweep on remaining 7 screens (Discover, both Homes, Settings, Messages, Booking, Admin Dashboard) — pattern proven on 4 screens
- 🟠 P1: Rotate the expired Stripe live key (`sk_live_…QtF7`)
- 🟢 P3: B2B corporate wellness onboarding
- ⛔ Blocked on user: Instagram Graph API key, SendGrid API key


## 2026-06-03 — Iteration 95b: Trainer Session Detail + Welcome A/B + Tier Email 📧 ✅

### Shipped
- **Trainer Session Detail screen** (`app/trainer/session-detail.tsx`) — counterpart to the trainee detail screen. Embeds the shared `NegotiationPanel` (so trainers can Propose/Counter/Accept time+location), shows trainee avatar + Message/Call quick-actions, scheduled time, take-home earnings preview, and post-confirmation quick-links (En route / GPS check-in / Start Session). Fully styled with `DS` (designSystem) tokens.
- **Trainer Sessions tab → detail navigation** (`app/trainer/(tabs)/sessions.tsx`): session cards are now `TouchableOpacity` routing to `/trainer/session-detail?sessionId=…`.
- **Welcome A/B harness** (`src/theme/premium.ts`): added `WELCOME_VARIANT: 'A'|'B'` driven by `EXPO_PUBLIC_WELCOME_VARIANT`. New `app/index.premium-b.tsx` placeholder ready for divergent hero/messaging. `app/index.tsx` switcher now routes premium→A or premium→B based on the flag (classic still wins when `EXPO_PUBLIC_UI_VERSION=classic`).
- **Tier-assigned email** (`backend/email_service.py:send_tier_assigned_email`): SendGrid HTML email when admin assigns a trainer to a tier (shows tier label + take-home %). Wired into `routes/payment_routes.py::admin_assign_tier` as fire-and-forget. No-ops cleanly when `SENDGRID_API_KEY` is unset (logs an `[EMAIL-NOOP]` line).

### Verified
- ✅ **50/50 backend pytest guards green** (iter92+92b+93+94+95+95b). New iter95b suite (`test_iteration95b_trainer_detail_and_ab.py`) adds 9 fresh guards covering trainer session-detail, A/B harness wiring, tier-assigned email helper + route wiring, payment-gating preservation, and SessionResponse field surfacing.
- ✅ Metro bundler clean rebundle on every file change.
- ✅ Backend hot-reload picked up `email_service.py` + `payment_routes.py` cleanly.

### Files added
- `frontend/app/trainer/session-detail.tsx` (new trainer-side detail screen)
- `frontend/app/index.premium-b.tsx` (A/B Variant B stub)
- `backend/tests/test_iteration95b_trainer_detail_and_ab.py` (9 new static guards)

### Files modified
- `frontend/app/trainer/(tabs)/sessions.tsx` — cards now navigate to detail
- `frontend/app/index.tsx` — switcher consults `WELCOME_VARIANT`
- `frontend/src/theme/premium.ts` — exported `WELCOME_VARIANT`
- `backend/email_service.py` — added `send_tier_assigned_email`
- `backend/routes/payment_routes.py` — `admin_assign_tier` sends email

### Outstanding (carryover)
- 🟠 **P1 (still pending)**: Apply `designSystem.ts` tokens to top-10 screens (Discover, Trainee/Trainer Home, Profile, Settings, Sessions list, Messages, Booking, Admin Dashboard). Trainer session-detail.tsx is the first screen to fully adopt DS — pattern to replicate.
- 🟡 P2: Chunked multipart uploads for Highlight Reels (still pending).
- 🟢 P3: B2B corporate wellness onboarding.
- ⛔ Blocked on user: Instagram Graph API key, SendGrid API key.
- ⛔ Stripe live key in backend/.env is expired (`sk_live_…QtF7`) — replace before going live.


## 2026-06-03 — Iteration 95: Negotiation UI + Frontend Zelle Strip + Payment Gating 🔒 ✅

### Shipped
Closed the last open seams in the Stripe-only / negotiation-gated payment flow that iter93/94 only handled at the backend boundary.

- **NegotiationPanel component** (`src/components/NegotiationPanel.tsx`): reusable propose/counter/accept/reject UI with time+location editor (native datetime picker), turn-based gating, status badges, expiry countdown, and on-agreed callback. Wired into trainee `session-detail.tsx` immediately after the status timeline — gates the Pay CTA until both parties confirm.
- **`negotiationAPI` helper** in `src/services/api.ts`: typed wrappers around `/api/sessions/{id}/negotiation/{propose,counter,accept,reject,timeline}` plus a `NegotiationTimeline` interface.
- **Server-side payment gate** (`backend/routes/payment_routes.py:create_payment_intent`): when a `session_id` is supplied, the endpoint now (a) resolves the session, (b) verifies the caller is the trainee on that session, (c) requires `negotiationStatus == 'agreed'` AND `paymentReady == True`, else 400 with "Negotiation not yet agreed". Closes a critical loophole where any logged-in user could create payment intents for any session pre-agreement.
- **`SessionResponse` schema extended** (`backend/models.py`): now surfaces `negotiationStatus`, `agreedTime`, `agreedLocation`, `paymentReady`, `proposedTime`, `proposedLocation`, plus iter92 tier-aware fields (`tier`, `modality`, `durationMin`, `baseCents`, `totalCents`). Frontend payment screen no longer needs a separate timeline call to know if checkout is allowed.
- **Frontend Zelle strip** (in-progress carryover from iter94):
  - `app/trainee/confirm-booking.tsx`: "Payment via Zelle" card → "Payment via Stripe", policy line + secure-note updated. Stripe-secured copy throughout.
  - `app/trainer/(tabs)/home.tsx`: `needsZelleSetup` banner → `needsPayoutSetup` with Stripe purple (#635BFF) + card icon + "Set Up Stripe Payouts" copy.
  - `app/trainer/(tabs)/earnings.tsx`: "Set Up Zelle Account" → "Set Up Stripe Payouts"; "Zelle account connected" → "Stripe payouts enabled".
  - `src/components/admin/PayoutsTab.tsx`: full Stripe rewrite — "Mark All Paid via Stripe", tier badge replaces email/phone, "via Stripe" labels in history.
  - `app/trainee/receipt.tsx`, `app/trainer/receipt.tsx`, `app/trainee/(tabs)/receipts.tsx`, `app/trainer/(tabs)/receipts.tsx`: legacy `zellePurple` accent renamed to `accent`/Stripe blue; "Zelle" badge → "Stripe" badge.

### Verified
- ✅ **41 backend pytest guards green** (iter92 + 92b + 93 + 94 + new iter95 e2e) — including 16 fresh live e2e tests covering propose→counter→accept happy path, reject + re-propose, non-participant 403, turn enforcement, 1h expiry auto-flip, pricing-quote matrix, admin tier assignment, **AND payment-intent gating both pre- and post-agreement**.
- ✅ TypeScript: zero new errors in NegotiationPanel.tsx, session-detail.tsx, services/api.ts, payment.tsx, connect-bank.tsx. Pre-existing repo-wide TS errors are unchanged.
- ✅ Metro bundler: 739-module rebundle clean (`Web Bundled 432ms`), no compile errors.
- ✅ Backend hot-reload picked up models + payment_routes changes cleanly.

### Files added
- `frontend/src/components/NegotiationPanel.tsx` (new — reusable propose/counter/accept UI)
- `backend/tests/test_iteration95_negotiation_e2e.py` (added by testing subagent — 16 live e2e tests)

### Files modified
- `backend/models.py` — `SessionResponse` now surfaces negotiation + tier fields
- `backend/routes/payment_routes.py` — `create_payment_intent` enforces paymentReady gate
- `frontend/src/services/api.ts` — added `negotiationAPI` + `NegotiationTimeline` interface
- `frontend/app/trainee/session-detail.tsx` — embedded `<NegotiationPanel />` after status card
- `frontend/app/trainee/confirm-booking.tsx` — Stripe payment card
- `frontend/app/trainer/(tabs)/home.tsx` — Stripe payouts banner
- `frontend/app/trainer/(tabs)/earnings.tsx` — Stripe payouts CTA
- `frontend/src/components/admin/PayoutsTab.tsx` — Stripe-only admin UI
- `frontend/app/trainee/receipt.tsx`, `frontend/app/trainer/receipt.tsx`, `frontend/app/trainee/(tabs)/receipts.tsx`, `frontend/app/trainer/(tabs)/receipts.tsx` — accent rename, Stripe labels

### Outstanding (carryover)
- 🟠 P1: `designSystem.ts` global polish pass on top-10 screens (Discover, Trainee/Trainer Home, Profile, Settings, Sessions list, Messages, Booking, Admin Dashboard) — strictly visual, no logic changes.
- 🟠 P1: Trainer-side session-detail screen + NegotiationPanel embed (trainer currently can only counter/accept from a trainee-initiated proposal via API; no dedicated screen).
- 🟡 P2: Resend email to trainers on tier assignment.
- 🟡 P2: A/B harness for Welcome variants (`EXPO_PUBLIC_WELCOME_VARIANT=A|B`).
- 🟡 P2: Chunked multipart uploads for Highlight Reels.
- 🟢 P3: B2B corporate wellness onboarding.
- ⛔ Blocked on user: Instagram Graph API key, SendGrid API key.
- ⛔ Stripe live key in backend/.env is expired (sk_live_…QtF7) — replace before going live.


## 2026-06-02 — Iteration 90: Premium Redesign Refinement Pass ✨

### Shipped
User reviewed the iter89 premium Welcome screen and asked for a refinement pass — not a rebuild. All 6 polish points + a new logo animation + consistent treatment across all 4 pre-auth premium screens.

- **New transparent logo (`rapidreps-logo-premium.png`)**: user-uploaded RR dumbbell logo with true alpha channel (70 % transparent pixels). Replaces the previous opaque RGB logo that was creating the visible "boxed" appearance on the cinematic background.
- **New `PremiumLogo` component** (`src/components/premium/PremiumLogo.tsx`): cinematic logo treatment — NO solid background. Continuous breathing animation (scale 1.0 → 1.045 over 2.4 s sine), pulsing ember halo (shadow-only glow, no fill box), subtle tilt (±1.6° over 4.2 s), 6 drifting ember sparkles from the bottom. All GPU-accelerated (`useNativeDriver: true`).
- **Hero typography upgrade** (Welcome): `DELIVERED` 56 → 78 / `RAPIDLY` 68 → 92, tighter `letterSpacing -1.5/-2` for premium athletic stencil feel. Stronger shadow on both lines for depth against cinematic bg.
- **Glassmorphism feature badges**: deeper 3-stop linear-gradient glass disk (white → near-black → navy-black), 84 px outer ring up from 76, top-left specular highlight, soft 26 px ember halo behind, dual shadows (deep black + orange glow) for layered depth.
- **Darker "BECOME A TRAINER" surface**: secondary CTA gradient swapped from `rgba(10,10,10,0.92)→rgba(9,26,58,0.85)` to `rgba(4,6,14,0.96)→rgba(8,18,42,0.92)→rgba(4,6,14,0.96)`. Outer orange ring upgraded from 1.5 px → 1.8 px with added 14 px orange shadow ring for stronger edge lighting.
- **More footer breathing room** (all 4 screens): added `paddingBottom`, `marginTop` increments, wider login-tap targets, larger bolt divider, line-heights bumped for terms/links.
- **Same refinement applied to Login + Signup**: both screens now use `PremiumLogo` (auto-blends), bumped hero copy (66/78 on login, 56/66 on signup), wider breathing room around the OR divider + CTA stack, footer padding boosted.
- **New Premium Forgot Password screen** (`auth/forgot-password.premium.tsx` + switcher `auth/forgot-password.tsx`): full cinematic treatment matching the rest of the pre-auth flow — back arrow with subtle glass border, hero "RESET YOUR PASSWORD" copy, glass email input, fiery "SEND RESET LINK" CTA, success state with orange-ringed check icon + email highlight. Classic version preserved at `forgot-password.classic.tsx` for rollback.

### Verified
- TypeScript compile: no new errors introduced (pre-existing errors are unrelated to premium UI).
- Metro bundler: clean rebundle (693 modules, no compile errors).
- `premium-welcome-screen` testID resolves on rendered preview.
- All asset paths now correctly resolve to `../../../assets/images/...` (3 dirs up from `src/components/premium/`).
- Classic rollback still 100 % safe — `*.classic.tsx` byte-equivalent to pre-iter89, switchers still gate on `EXPO_PUBLIC_UI_VERSION`.

### Files added
- `src/components/premium/PremiumLogo.tsx`
- `app/auth/forgot-password.premium.tsx`

### Files modified
- `assets/rapidreps-logo-premium.png` (replaced with transparent v2)
- `app/index.premium.tsx` (logo treatment, typography, spacing)
- `app/auth/login.premium.tsx` (logo treatment, typography, spacing)
- `app/auth/signup.premium.tsx` (logo treatment, typography, spacing)
- `app/auth/forgot-password.tsx` (now a switcher → premium/classic)
- `src/components/premium/PremiumFeatureBadge.tsx` (deeper glassmorphism)
- `src/components/premium/PremiumGradientButton.tsx` (darker secondary surface + stronger orange ring)

### Files renamed
- `app/auth/forgot-password.tsx` → `app/auth/forgot-password.classic.tsx` (classic baseline preserved)



## 2026-06-02 — Iteration 89 round 3: User-supplied premium assets dropped in 🎯 ✅

### Shipped
User provided 4 artifacts: the exact cinematic background image, two final-render Welcome + Login mockups, and the new chrome RR dumbbell+shield logo. Dropped them all directly into the app — no more Nano Banana fakes, no more guessing.

- **`assets/images/premium-welcome-bg.png`** (1.9 MB) — user's exact image: top-left muscular man with dumbbell, top-right female runner, mirrored bottom corners, fiery orange embers + diagonal motion streaks, central negative space for logo & CTAs. **Replaces** the Nano Banana welcome bg.
- **`assets/images/premium-login-bg.png`** (1.9 MB) — same composition (user's design intentionally reuses the bg for cohesion). **Replaces** the Nano Banana login bg.
- **`assets/rapidreps-logo-premium.png`** (1.6 MB) — the new 3D chrome dumbbell + orange "RR" shield logo with ember sparkles. Wired into all 3 premium screens (Welcome, Login, Signup) replacing the older simpler `rapidreps-logo.png` (which stays on disk for Classic rollback).
- **Login `RAPIDREPS` wordmark**: added under the logo on the login screen, white Oswald 900 with skew + orange glow — matches the mockup's hierarchy under the chrome logo.

### Verified
- Updated CI guards: `test_premium_background_assets_exist` now asserts both bg files + new logo (all > 100KB).
- New CI guard: `test_premium_screens_use_new_logo` confirms all 3 premium screen files reference `rapidreps-logo-premium.png`.
- Full regression: **67/67** across iter79/81/85/86/87/88/89 green.
- Metro bundler: clean rebundle on the asset swap, no errors.




### Shipped (D — all three gap-closers from the user's "Do they match?" feedback)
- **Nano Banana image generation**: `scripts/generate_premium_backgrounds.py` calls Gemini `gemini-3.1-flash-image-preview` via the Emergent LLM key to one-shot generate two cinematic hero backgrounds:
  - `assets/images/premium-welcome-bg.png` (574 KB) — two athletic silhouettes facing inward (male boxer + female fighter) in an orange ember storm with negative space top-center for the logo. Verified via `analyze_file_tool`.
  - `assets/images/premium-login-bg.png` (557 KB) — solo weightlifter mid-clean-and-jerk in fiery orange explosion fading to black at the bottom.
- **PremiumHeroBg rewrite**: pure CSS gradients replaced with `ImageBackground` + the generated assets. Top + bottom vignette gradients preserve text legibility. Background is now cinematic photography-level fidelity.
- **Animated ember overlay**: 14 native-driver-animated ember particles drifting upward through the scene with staggered delays + horizontal sway + fade-in/fade-out. Matches the "burning embers floating" energy from the mockups. CPU cost negligible (all on `useNativeDriver: true`).
- **Stencil-style typography**: hero copy ("DELIVERED / RAPIDLY", "LET'S GET / TO WORK", "FIND YOUR / TRAINER") now uses `Oswald_700Bold` (Google Font, already in `@expo-google-fonts/oswald`) with `transform: [{ skewX: '-8deg' }]` to fake the italic stencil cut. Looks dramatically closer to the mockup display font than the previous system-bold-italic.
- **Logo halo**: added a glowing orange halo (60px shadow radius, 90% opacity) behind the RR logo on the Welcome screen — gives the cinematic glow from the mockup.

### Verified
- New CI tests added: `test_premium_background_assets_exist` (both PNGs on disk, > 50KB each).
- Full regression: **66/66** across iter79/81/85/86/87/88/89 green.
- Image content verified via `analyze_file_tool` → confirmed cinematic athletic silhouettes + orange ember storm + central negative space for logo.




### Shipped
- **RapidReps Classic vs RapidReps Premium**: User asked for a premium overhaul of 4 screens (which collapse to 3 files since Find/Become Trainer both route to `auth/signup.tsx` with `?role=`). Built as a **reversible alternate layer**, not a destructive replacement.
- **Switcher architecture**: each entry file (`app/index.tsx`, `app/auth/login.tsx`, `app/auth/signup.tsx`) is now a 5-line module that imports both Classic & Premium variants and picks one at bundle time based on `EXPO_PUBLIC_UI_VERSION` (defaults to `premium`).
- **Rollback in 30s**: set `EXPO_PUBLIC_UI_VERSION=classic` in `/app/frontend/.env` and `sudo supervisorctl restart expo`. Classic backups are byte-for-byte copies of the pre-iter89 code at `*.classic.tsx`.
- **New design system** at `src/theme/premium.ts` — palette `#FF7A00 / #FF9B2F / #091A3A / #0A0A0A`, gradients, glow shadows, italic athletic type ramp. Plus 4 reusable premium components: `PremiumHeroBg`, `PremiumGradientButton` (3 variants: primary/login/secondary), `PremiumGlassInput`, `PremiumFeatureBadge`.
- **Pixel-matched mockups**: Welcome screen ships the "YOUR WORKOUT / DELIVERED / RAPIDLY" italic stencil hero with 3 glowing feature badges (Trainers Near You · Book Instantly · Verified Pros) + navy↘orange "FIND A TRAINER" pill + matte "BECOME A TRAINER" outlined pill — matches the user's screenshot. Login ships "WELCOME BACK / LET'S GET / TO WORK" italic hero + glass email/password inputs + fiery-orange "LOG IN" pill — matches the user's second screenshot. Signup follows the same system with a role toggle pill row.
- **All routes & business logic preserved**: AuthContext, signup/login API calls, SocialAuthButtons (Apple/Google), Stripe, AsyncStorage redirect, forgot-password, terms/privacy, onboarding routing — all untouched.

### Verified
- New CI tests: `tests/test_iteration89_premium_redesign.py` — 12 tests covering rollback safety (Classic backups exist & non-truncated), Premium screens have the right `data-testid` + hero copy + theme imports, switchers gate on `UI_VERSION`, env flag is set to a valid value, theme + 4 components all exist on disk.
- Full regression: **65/65** across iter79/81/85/86/87/88/89.
- Metro bundler restart clean (no compile errors in `/var/log/supervisor/expo.out.log`).

### Files added
- `src/theme/premium.ts`
- `src/components/premium/PremiumHeroBg.tsx`
- `src/components/premium/PremiumGradientButton.tsx`
- `src/components/premium/PremiumGlassInput.tsx`
- `src/components/premium/PremiumFeatureBadge.tsx`
- `app/index.premium.tsx` + `app/index.classic.tsx`
- `app/auth/login.premium.tsx` + `app/auth/login.classic.tsx`
- `app/auth/signup.premium.tsx` + `app/auth/signup.classic.tsx`
- `DESIGN_VERSIONS.md` — rollback instructions

### Files modified
- `app/index.tsx`, `app/auth/login.tsx`, `app/auth/signup.tsx` → thin 5-line switchers
- `.env` — added `EXPO_PUBLIC_UI_VERSION=premium`




### Shipped
- **server.py refactor — final P3 slice**: Extracted convenience block (`/trainee/recent-trainers`, `/trainee/streak`, `/sessions/recurring`, `/trainer/go-live`, `/trainer/go-offline`, `/trainee/toggle-favorite/{id}`, `/trainee/saved-trainers`, `/trainee/favorite-availability` + `RecurringSessionCreate` Pydantic model — 358 LOC) → `routes/convenience_routes.py` (373 lines).
- **Also fixed naming collision**: my iter87 `matching_router` import collided with the pre-existing `routes.matching` import. Renamed iter87 import to `engine_router` to avoid confusion.
- **server.py size**: 1409 → 1057 lines. **Cumulative iter85→88: 2885 → 1057 (-63%, 1,828 lines moved out across 5 new route modules).** Below the 1,100-line stretch target and dramatically simpler to navigate. Remaining content in server.py is what *legitimately belongs* there: imports, FastAPI bootstrap, middleware, public/static routes (root/health/legal/manual downloads), safety/referral/experiments inline mini-blocks (could be next slice if you want), the weekly-digest endpoint, the notification scheduler coroutine, and the startup/seed hook.

### Verified
- New CI tests: `tests/test_iteration88_convenience_extraction.py` — 12 tests (every extracted endpoint reachable, RecurringSessionCreate model moved, static guards: convenience_router imported & wired, no duplicate decorators in server.py, server.py < 1,100 lines).
- Full regression: **79/79** across iter79/81/83a/83b/83c/84/85/86/87/88 green.




### Shipped
- **server.py refactor — round 3**: Extracted the entire **Uber-style matching engine** (`score_trainer`, `get_wave_trainers`, `run_matching_engine` helpers + 9 routes: `/virtual/request`, `/instant/request`, `/virtual/request/{id}`, `/virtual/pending`, `/virtual/accept/{id}`, `/virtual/reject/{id}`, `/virtual/trainee-confirm/{id}`, `/virtual/find-another/{id}`, `/virtual/cancel/{id}`) → `routes/matching_routes.py` (623 lines).
- **server.py size**: 2011 → 1409 lines. **Cumulative iter85+86+87: 2885 → 1409 (-51%, 1,476 lines moved out).** Below the 1,500-line target.

### Verified
- New CI tests: `tests/test_iteration87_matching_extraction.py` — 11 tests (every extracted endpoint reachable, role-based 400s for wrong roles, RBAC/ObjectId error handling preserved, static guards: matching_router imported & wired, no duplicate decorators, helpers exist in new module).
- Full regression: **67/67** across iter79/81/83a/83b/83c/84/85/86/87 green.




### Shipped
- **server.py refactor — round 2**: Extracted location & GPS routes (`PUT /api/trainer/location`, `PUT /api/trainer/availability`, `GET /api/trainer/my-location-status`, `POST /api/sessions/{id}/gps-update`, `GET /api/sessions/{id}/gps-track`, `POST /api/sessions/{id}/start-en-route`, `POST /api/sessions/{id}/start-session`, `GET /api/trainers/nearby`) + Haversine + ETA helpers + 3 Pydantic models → `routes/location_routes.py` (542 lines).
- **server.py size**: 2535 → 2011 lines (cumulative iter85+86: 2885 → 2011, -874 lines, -30%). Goal of "under 1,000 lines" still pending — next slice: virtual-session matching (~700 lines in current server.py).

### Verified
- New CI tests: `tests/test_iteration86_location_extraction.py` — 10 tests (every extracted endpoint smoke-tested live, RBAC retained, ObjectId validation retained, static guards: location_router imported & wired, no duplicate decorators in server.py).
- Full regression: **56/56** across iter79/81/83a/83b/83c/84/85/86 green.




### Shipped
- **server.py refactor (P3)**: Extracted messaging (4 endpoints) → `routes/messaging_routes.py` and notifications/push-tokens/prefs (7 endpoints) → `routes/notification_routes.py`. server.py: 2885 → 2533 lines (-352).
- **Admin Approve All (P2)**: New endpoint `POST /api/admin/verifications/{trainerId}/approve-all-steps` approves every submitted-but-not-yet-approved step in one atomic Mongo update, then fires a single notification + push. Skips steps without uploaded files (returns them in `skipped` array). Frontend: green "APPROVE ALL" pill on the Documents section of the verification modal — only visible when there's something to approve. Estimated ~85% click reduction during moderation.
- **Highlight upload progress (P1)**: Both trainer + trainee highlight-upload screens rewired from `fetch` to `XMLHttpRequest` so `xhr.upload.onprogress` events drive a real-time `0%–100%` indicator inside the upload button + an orange progress bar below. Addresses user's "uploads feel slow" complaint by providing immediate visual feedback during the slow base64/multipart phase.

### Verified
- **New CI tests**: `tests/test_iteration85_refactor_approve_all.py` — 14 tests covering refactor regression (messages/conversations/notifications/prefs/push-tokens still respond 200), Approve-All response shape + RBAC (admin-only, 404 for unknown trainer), static guards (server.py < 2600 lines, no duplicate routes, frontend has Approve All button + XHR progress wiring).
- **Combined regression**: 46/46 across iter79/81/83a/83b/83c/84/85 green.

### Still open / Backlog
- **Instagram Graph API** — endpoints scaffolded, awaiting user's Instagram App ID + App Secret.
- **SendGrid email** — awaiting user's API key.
- **Further server.py extraction** — location/GPS routes (~500 lines) is the next slice once tests scale.


## 2026-06-02 — Iteration 84 round 2: 5-of-6 PDF round-4 fixes shipped ✅

### Shipped
- **#2 Unread notification readability**: Rewrote `app/notifications.tsx`. Unread cards now use `rgba(255,106,0,0.12)` background + 4px orange left border + 900-weight title + 0.92-opacity body text. Read cards stay subtle. Empty/active visual states clearly distinguishable.
- **#3 Swipe-left-to-delete**: Built with native `PanResponder` (no extra dep). 80px red Delete reveal under each row. Backend `DELETE /api/notifications/{id}` added (server.py), returns 403 for cross-user, 400 for invalid ObjectId, 404 for not-found. Frontend wires axios DELETE + refreshes list. Notification GET now projects `id` (was excluded as `_id`).
- **#4 Virtual session deep link**: Backend injects `deepLink: /trainer/trainee-detail?traineeId=X&showAcceptCTA=true` into `virtual_session_request` notifications. Frontend `notifications.tsx` routes by `deepLink` on tap. `trainee-detail.tsx` reads `showAcceptCTA` param and renders sticky green "ACCEPT SESSION" CTA at the bottom of the cinematic showcase. Wired to `/api/sessions/instant-accept` if `sessionRequestId` provided.
- **#7 Intro Video position + editable title/description**: Moved intro video JSX in `trainee/trainer-detail.tsx` from inside the profile-details card to ABOVE `<HighlightReel>`. Added editable `introVideoTitle` + `introVideoDescription` fields to `TrainerProfileCreate` + `TrainerProfileResponse` models. New `PUT /api/trainer-profiles/{id}/intro-video-meta` endpoint with cross-user 403 protection. Edit screen surfaces both as `<TextInput>`s (title 60ch, description 300ch). Public view: video now uses `useNativeControls` + `usePoster` (the profile photo) so the user can actually press Play (also addresses #9). Default title fallback: "INTRO TO MY PROFILE".
- **#8 Safety Center contrast**: Bumped all body text from `rgba(255,255,255,0.6)` (per user "grayed out / not legible") to `0.88` / `0.92`. Cards now have `rgba(10,14,26,0.78)` deep-navy background + `0.18` white border for cleaner contrast.

### Verified
- **New CI tests**: `/app/backend/tests/test_iteration84_pdf_round4.py` — 9 tests covering all 5 fixes (live API + static asserts).
- **Full regression**: 32/32 across iter79/81/83a/83b/83c/84 all green.

### Still open (next turn)
- **#9 Admin can't play intro video**: Partially mitigated by `useNativeControls` on the cinematic view. The admin verification-detail screen still needs the same `useNativeControls` patch — root cause is its raw `<Video shouldPlay isMuted />` block. Will reproduce + fix next turn.
- **#6 leftover — upload success modal**: Add "✓ Uploaded!" auto-dismiss modal after POST returns 200 in `app/trainer/highlight-upload.tsx` + `app/trainee/highlight-upload.tsx`. (Phase B added the toast — user wants a modal instead.)


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
