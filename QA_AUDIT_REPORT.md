# RapidReps — Full QA Audit Report
## Pre-Deployment TestFlight Readiness

---

## SUMMARY — Overall Readiness: YELLOW (Proceed with Caution)

The app is feature-complete and passes 95/96 backend tests. However, this audit uncovered **4 Critical, 6 Major, and 8 Minor issues** that range from security vulnerabilities to missing backend functionality to UX dead ends. The critical issues should be fixed before any real user touches the app.

---

## STEP 1 — App Map (Every Screen, Button, Flow)

| # | Screen | Description | Entry Point | Criticality |
|---|--------|-------------|-------------|-------------|
| 1 | Welcome/Index | Landing page with Login/Signup buttons | App launch | High |
| 2 | Login | Email + password form, "Forgot Password" link | Welcome screen | High |
| 3 | Signup | Full name, email, phone, password, role picker (Trainer/Trainee) | Welcome screen | High |
| 4 | Forgot Password | Email input, "send reset" button | Login screen | Medium |
| 5 | Trainee Onboarding | Profile creation: goals, fitness level, preferences, location | Post-signup | High |
| 6 | Trainer Onboarding | Profile creation: bio, experience, specialties, pricing, location | Post-signup | High |
| 7 | Trainee Home | Map with nearby trainers, trainer cards, search/filters | Tab bar | High |
| 8 | Trainer Detail | Full trainer profile, reviews, book/message/save buttons, video intro | Tapping a trainer card | High |
| 9 | Schedule Training | Date/time/type picker for booking | Trainer detail "Book" button | High |
| 10 | Confirm Booking | Price breakdown, payment confirmation | Schedule training | High |
| 11 | Payment | Stripe payment flow | Confirm booking | High |
| 12 | Trainee Sessions | List of upcoming/completed/cancelled sessions | Tab bar | High |
| 13 | Session Active | Live session view with timer, PIN display | Active session | High |
| 14 | Session Complete | Post-session summary | Session end | Medium |
| 15 | Rate Session | Star rating + review text | Session complete | Medium |
| 16 | Saved Trainers | List of favorited trainers with book/remove | Tab bar | Medium |
| 17 | Messages List | All conversations | Tab bar | Medium |
| 18 | Chat | Individual message thread | Tapping a conversation | Medium |
| 19 | Trainee Profile | Profile info, streak card, achievements link, settings, logout | Tab bar | Medium |
| 20 | Achievements | 12 badge cards, streak banner, progress bars | Profile link | Low |
| 21 | Leaderboard | Weekly rankings, podium top 3, personal rank | Profile link | Low |
| 22 | Membership | Subscription benefits, subscribe button ($19.99/mo) | Profile link | High |
| 23 | Trainer Home | Dashboard, nearby trainees, toggle availability | Tab bar | High |
| 24 | Trainer Sessions | Incoming requests (accept/decline), active/completed | Tab bar | High |
| 25 | Trainer Earnings | Revenue chart, weekly/daily breakdown, payout request | Tab bar | High |
| 26 | Trainer Profile | Stats, streak card, menu links, verification status, logout | Tab bar | Medium |
| 27 | Trainer Edit Profile | Edit bio, specialties, pricing, location | Profile menu | Medium |
| 28 | Trainer Verification | 7-step verification flow (ID, certs, background check, video) | Profile menu | High |
| 29 | Trainer Upload Video | Intro video upload | Verification or profile | Low |
| 30 | Trainer Boosts | Purchase visibility boosts (daily/weekly/monthly) | Profile menu | Medium |
| 31 | Start Session (Trainer) | PIN entry, GPS confirmation, start/end controls | Session card | High |
| 32 | Admin Dashboard | 6-tab panel: Overview, Users, Verify, Sessions, Payments, Profile | Admin login | High |
| 33 | Privacy Policy | Legal text | Auth/Settings links | Low |
| 34 | Terms of Service | Legal text | Auth/Settings links | Low |
| 35 | Share Status | Share session status | Session flow | Low |
| 36 | Virtual Confirm | Virtual session confirmation | Booking flow | Medium |

---

## STEP 2 — Full Test Plan

### Authentication Flow

| Scenario | Preconditions | Steps | Expected Result | Risk |
|----------|---------------|-------|-----------------|------|
| Successful signup (trainee) | None | Enter name, email, phone, password, select "Trainee", tap Signup | Account created, token returned, redirect to onboarding | High |
| Successful signup (trainer) | None | Enter valid data, select "Trainer", tap Signup | Account created, redirect to trainer onboarding | High |
| Signup with existing email | Email already registered | Enter same email | Error: "Email already registered" | Medium |
| Signup with short password | None | Enter 5-char password | Error: "Password must be at least 6 characters" | Medium |
| Successful login | Account exists | Enter correct email/password | Token returned, redirect to correct role dashboard | High |
| Login with wrong password | Account exists | Enter wrong password | Error: "Invalid email or password" | High |
| Login with non-existent email | No account | Enter random email | Error: "Invalid email or password" | Medium |
| Token expiry | Token older than JWT_EXPIRATION_HOURS | Make any authenticated request | 401 "Token has expired" | High |
| **Forgot password** | Account exists | Enter email, tap "Reset" | **SEE CRITICAL ISSUE #1** | **High** |

### Session Booking Flow

| Scenario | Preconditions | Steps | Expected Result | Risk |
|----------|---------------|-------|-----------------|------|
| Book outdoor session | Trainee logged in, trainer verified | Select trainer → Schedule → Pick date/time → Confirm → Pay | Session created with status "requested" | High |
| Book in-home session | Both have location | Same flow, select "In-Home" | Session created with safety PIN, travel fee applied | High |
| Book virtual session | Trainer has virtual enabled | Select virtual type | Session created, no travel fee | High |
| Trainer accepts session | Session status = requested | Trainer taps "Accept" | Status changes to "confirmed" | High |
| Trainer declines session | Session status = requested | Trainer taps "Decline" | Status changes to "declined" | High |
| Trainee cancels requested session | Status = requested | Trainee taps "Cancel" | Cancelled, no fee, full refund | High |
| Trainee cancels confirmed session | Status = confirmed | Trainee taps "Cancel" | Cancelled, cancellation fee applied | High |
| Cancel already completed session | Status = completed | Try to cancel | Error: "Cannot cancel completed session" | Medium |
| Session with unverified trainer | Trainer not verified | Try to create session | Error 403: "Trainer is not verified" | High |
| **Session GET by anyone** | Session exists | GET /api/sessions/{id} with no auth | **SEE CRITICAL ISSUE #2** | **High** |

### Payment & Money Flow (see Step 3 below)

### Admin Panel Flow

| Scenario | Preconditions | Steps | Expected Result | Risk |
|----------|---------------|-------|-----------------|------|
| Admin login | Admin account | Login with admin credentials | Redirect to admin dashboard | High |
| View all users | Admin logged in | Go to Users tab | All users listed without passwordHash | High |
| Remove user | Non-admin user exists | Tap trash icon → Confirm | User and all data cascade deleted | High |
| Remove self (admin) | Admin logged in | Try to delete own account | Error: "Cannot delete your own admin account" | Medium |
| Refund session | Session exists, not yet refunded | Go to Payments → Tap Refund → Confirm | Session marked refunded, transaction recorded | High |
| Double refund | Session already refunded | Try to refund again | Error: "Session already refunded" | High |
| Confirm payment | Unconfirmed session | Tap Confirm | Payment marked confirmed | Medium |
| Send message | User exists | Open message modal → Type → Send | Message delivered to user's chat | Medium |
| Update admin profile | Admin logged in | Go to Profile → Edit → Save | Profile updated | Low |
| Approve verification | Pending verification exists | Tap Approve | Trainer marked verified | High |

---

## STEP 3 — Payment & Money Flows (CRITICAL)

### Payment Screens & Actions
1. **Confirm Booking** — shows price breakdown (base + travel fee + platform fee)
2. **Payment Screen** — Stripe payment intent creation
3. **Membership Subscribe** — $19.99/mo subscription
4. **Boost Purchase** — $4.99 / $14.99 / $29.99
5. **Admin Refund** — refund via Stripe or record-only
6. **Trainer Payout** — admin processes payout to trainer

### Payment Test Cases

| Scenario | Expected | Risk |
|----------|----------|------|
| Successful payment | Payment intent created, session linked | High |
| **Negative or zero amount payment** | **SEE CRITICAL ISSUE #3** | **High** |
| Card declined | Stripe error caught, user sees friendly message | High |
| Double-tap "Pay" button | Only one payment intent should be created | Medium |
| Refund after Stripe payment | Stripe refund API called, session marked refunded | High |
| Refund with mock payment intent | Record refund only (no Stripe call) | Medium |
| Membership duplicate subscribe | Error: "Already have an active membership" | Medium |
| **Membership has no actual Stripe charge** | **SEE MAJOR ISSUE #1** | **High** |
| **Boost has no actual Stripe charge** | **SEE MAJOR ISSUE #2** | **High** |
| Fee calculation: 75/25 split | Platform gets 25%, trainer gets 75% | High |
| Cancellation fee: Virtual $15 | Correct fee deducted from refund | High |
| Cancellation fee: Outdoor $25 | Correct fee deducted | High |
| Cancellation fee: In-Home $35 | Correct fee deducted | High |

---

## STEP 4 — Security, Privacy & Data Integrity

| Area / Screen | Potential Risk | Impact | Suggested Fix |
|---|---|---|---|
| **GET /api/sessions/{id}** | **No auth required — anyone with a session ID can view full session details including safety PIN, pricing, user IDs** | **HIGH — data leak, safety risk** | **Add `Depends(get_current_user)` and verify user is participant or admin** |
| **POST /payments/create-payment-intent** | **No minimum/maximum amount validation — attacker could create $0.01 or $999,999 payment intents** | **HIGH — financial abuse** | **Validate `amount_cents >= 100` (Stripe minimum) and add reasonable max** |
| **Forgot Password** | **No backend endpoint exists — frontend shows success but nothing actually happens** | **HIGH — users locked out permanently** | **Implement actual password reset with email token** |
| CORS `allow_origins=["*"]` | All origins allowed | MEDIUM — okay for mobile API, but if web is ever added, this is a vulnerability | Restrict to known origins in production |
| JWT tokens | No refresh token mechanism; token valid for full `JWT_EXPIRATION_HOURS` | MEDIUM — if token is stolen, no way to revoke | Add refresh tokens and token revocation |
| Rating system | No check if the rating user is the actual trainee of that session | MEDIUM — any user could rate any trainer's session | Add `traineeId == current_user._id` check |
| Admin message endpoint | Admin can create conversation with empty userId | LOW — won't crash but creates orphan data | Validate `receiverId` is a valid ObjectId |
| GET /api/trainer-profiles/{id} | No auth required — public endpoint | LOW — by design for profile browsing | Acceptable |
| GET /api/trainers/{id}/ratings | No auth required — public endpoint | LOW — by design | Acceptable |
| `passwordHash` in responses | Already fixed — stripped from admin user list and profile responses | RESOLVED | N/A |

---

## STEP 5 — UX & Confusion Audit

### As a First-Time User:
| Area | Issue | Suggestion |
|---|---|---|
| Forgot Password | User enters email, sees "Check your email" success — but NO email is ever sent. User is permanently locked out. | Display honest message: "Password reset is not available yet. Contact support." OR implement the feature. |
| Trainee Home → Map | If location permissions denied, unclear what happens | Add a clear "Enable Location" prompt with instructions |
| Trainer Verification | 7-step process is thorough but may feel overwhelming | Add a "You can come back later" reassurance message |
| Booking → Payment | If Stripe payment fails, the session is still created with status "requested" but no payment | Either require payment before session creation, or clearly mark as "unpaid" |
| Membership screen | "Subscribe" button — no indication this is a real charge | Add price confirmation: "You will be charged $19.99/month" |
| Admin Panel | No search/filter on users list (loads up to 100) | Add search by name/email for large user bases |
| Session Active | No countdown timer shown for scheduled duration | Add visible timer so both parties know how long is left |
| Chat | No typing indicator, no read receipts | Consider adding for better messaging UX |

### As a Non-Technical User:
| Area | Issue | Suggestion |
|---|---|---|
| Safety PIN | Trainee sees a 4-digit PIN but may not understand they need to give it to the trainer verbally | Add clear instruction: "Share this PIN with your trainer when they arrive" |
| Cancellation fees | Fee amounts are in the code but not clearly displayed to the user BEFORE they cancel | Show fee warning: "Cancelling will cost $25" in the confirmation dialog |
| Trainer Earnings | "Request Payout" — unclear what happens next, how long it takes | Add estimated timeline and status tracking |

### As a Power User:
| Area | Issue | Suggestion |
|---|---|---|
| No pull-to-refresh on some screens | Users expect this behavior everywhere on mobile | Ensure RefreshControl on all list screens |
| No pagination on sessions/messages | Loads up to 100 items at once | Add infinite scroll for heavy users |
| No session search/date filter (trainee) | Hard to find old sessions | Add date range filter |

---

## STEP 6 — Error Handling & Empty States

| Screen / Flow | What if it fails? | Current Behavior | Suggested Fix |
|---|---|---|---|
| Login | Wrong credentials | Shows "Invalid email or password" | Good |
| Signup | Server error | Generic error | Show "Something went wrong. Please try again." |
| Trainer search / Nearby | No trainers found | Shows empty trainer list | Shows "No trainers nearby" with illustration — Good |
| Sessions list | No sessions | Shows empty state | Needs clear "Book your first session" CTA |
| Messages | No conversations | Shows empty list | Add "No messages yet" with illustration |
| Achievements | No badges earned yet | Shows all badges as locked/gray | Good |
| Leaderboard | No participants | Shows "No Rankings Yet" with trophy icon | Good |
| Saved trainers | No saved trainers | Shows "No saved trainers yet" | Good |
| Stripe payment fails | API error | `stripe.error.StripeError` caught, returns 400 | Good — but frontend should show user-friendly message, not raw error |
| Network offline | Any API call | App likely shows loading spinner forever | Add timeout + "Check your connection" message |
| Admin refund with invalid session | Bad ID | Returns 400 "Invalid session ID" | Good |

---

## STEP 7 — Device & Performance

| Concern | Details | Suggestion |
|---|---|---|
| Leaderboard computation | `GET /api/leaderboard/weekly` fetches ALL users (up to 500), then for EACH computes streak data (multiple DB queries per user) | Cache leaderboard results for 5-10 minutes. Will be very slow with 500+ users. |
| Trainer avatar images | Profile photos stored as base64 in MongoDB | Consider cloud storage (S3/Cloudinary) for images. Base64 in DB bloats documents and makes queries slow. |
| Map with many trainers | All nearby trainers rendered as markers | Already limited to 50 — acceptable. Consider clustering for density. |
| Large chat history | Messages loaded up to 200 at once | Add pagination / lazy loading for old messages |
| Session list | Loads up to 100 sessions at once | Add pagination for power users |
| Achievement computation | Runs multiple DB aggregations on every page load | Consider caching badges for 1 hour |

---

## STEP 8 — Final QA Report

### CRITICAL ISSUES (Must Fix Before Launch)

| # | Area | Issue | How to Reproduce | Severity | Fix |
|---|------|-------|------------------|----------|-----|
| C1 | **Auth** | **Forgot Password is completely fake** — frontend shows "Check your email" success but NO backend endpoint exists. User is permanently locked out. | Go to Login → "Forgot Password" → Enter email → Submit. No email is ever sent. | **CRITICAL** | Either implement real password reset (with email token) OR remove the button and add "Contact support" text. |
| C2 | **Security** | **GET /api/sessions/{session_id} has NO authentication** — anyone who guesses/intercepts a session ID can see the full session including safety PIN, pricing, user IDs, location | `curl GET /api/sessions/{any_valid_id}` with no auth header | **CRITICAL** | Add `Depends(get_current_user)` and verify the requesting user is a participant or admin. |
| C3 | **Payments** | **POST /payments/create-payment-intent accepts any amount** — no min/max validation. Attacker could create $0 or $999,999 payment intents on your Stripe account. | `curl -X POST /api/payments/create-payment-intent?amount_cents=1` | **CRITICAL** | Add validation: `if amount_cents < 100: raise HTTPException(400, "Minimum amount is $1.00")` and cap at reasonable max. |
| C4 | **Ratings** | **No check that the rater is the actual trainee of the session** — any authenticated user can rate any session by any trainer. | Login as User A, submit rating for a session between User B and Trainer C. | **CRITICAL** | Add check: `if str(current_user['_id']) != session['traineeId']: raise HTTPException(403)` |

### MAJOR ISSUES

| # | Area | Issue | Severity | Fix |
|---|------|-------|----------|-----|
| M1 | **Payments** | **Membership ($19.99/mo) creates a DB record but never charges the user** — no Stripe PaymentIntent or Subscription is created. It's free money. | **HIGH** | Integrate Stripe subscription or at minimum create a PaymentIntent before activating membership. |
| M2 | **Payments** | **Boost purchases ($4.99-$29.99) create DB records but never charge the user** — same as membership, no actual payment collected. | **HIGH** | Add Stripe payment before activating boost. |
| M3 | **Sessions** | **Session creation doesn't require payment upfront** — session is created in "requested" status with no payment. If trainee never pays, trainer wasted time accepting. | **HIGH** | Consider requiring payment hold (PaymentIntent with capture_method=manual) at booking time. |
| M4 | **Data** | **Trainer profile photos and intro videos stored as base64 strings in MongoDB** — this will severely degrade DB performance as user base grows. | **MEDIUM** | Migrate to cloud storage (S3/Cloudinary) and store URLs only. |
| M5 | **Security** | **No rate limiting on any endpoint** — login, signup, payment creation, message sending all have unlimited request rates. Brute-force attacks possible. | **MEDIUM** | Add FastAPI rate limiting middleware (e.g., slowapi). |
| M6 | **Admin** | **Admin message creates conversation with ObjectId format assumption** — if receiverId is not a valid MongoDB user, it silently creates orphan data | **MEDIUM** | Validate receiverId exists as a user before creating conversation. |

### MINOR ISSUES / Nice-to-Have

| # | Area | Issue | Fix |
|---|------|-------|-----|
| m1 | UX | Cancellation fee not displayed to user BEFORE they confirm cancellation | Show fee amount in the cancel confirmation dialog |
| m2 | UX | No loading timeout — if API is slow, spinner shows forever | Add 15-second timeout with "Something went wrong" fallback |
| m3 | UX | Admin users tab has no search/filter functionality | Add name/email search for large user bases |
| m4 | Performance | Leaderboard fetches all users and computes streaks per-request | Cache results for 5-10 minutes |
| m5 | UX | Membership screen doesn't explicitly confirm the charge amount before subscribing | Add price confirmation step |
| m6 | Data | `datetime.utcnow()` used throughout (deprecated in Python 3.12+) | Use `datetime.now(timezone.utc)` |
| m7 | UX | No way for trainee to add/edit home address from profile | Add home address field to trainee profile edit form |
| m8 | Sessions | Session duration max not enforced — could book a 10,000 minute session | Add `durationMinutes` validation (e.g., 30-180 min) |

---

### Payment & Money Flow Risks Summary

| Risk | Status | Details |
|------|--------|---------|
| 75/25 revenue split calculation | ✅ Correct | Verified in pricing logic |
| Cancellation fees by type | ✅ Correct | Virtual $15, Outdoor $25, In-Home $35 |
| Travel fee calculation | ✅ Correct | Distance-based with trainer/platform split |
| Multi-session discount | ✅ Implemented | 10% after 3+ sessions |
| Stripe payment intent creation | ⚠️ No amount validation | See C3 |
| Membership payment | ❌ Not collected | See M1 |
| Boost payment | ❌ Not collected | See M2 |
| Refund flow | ✅ Working | Stripe + DB record, duplicate protection |
| Payout to trainer | ⚠️ Admin manual process | No automated payout — acceptable for MVP |

---

### What a Human Tester Should Verify on TestFlight

1. **Cold launch** — Does the app load the welcome screen cleanly?
2. **Signup flow** — Create fresh trainee and trainer accounts. Verify onboarding completes.
3. **Location permissions** — Grant/deny location. Does the map work? Does it fail gracefully?
4. **Trainer verification** — Complete all 7 steps as a trainer. Verify admin can approve.
5. **Book a session** — Full flow: browse trainer → book → confirm → pay. Check price breakdown matches.
6. **Session lifecycle** — Trainer accepts → Start session (PIN if in-home) → End session → Trainee confirms → Rate.
7. **Messaging** — Send messages between trainee and trainer. Verify they appear in both accounts.
8. **Admin panel** — Login as admin. Test every tab: view users, refund a session, send a message, edit profile.
9. **Streaks** — Complete sessions across multiple weeks. Verify streak count updates.
10. **Leaderboard** — Check it loads, shows correct rankings.
11. **Back button behavior** — On every screen, tap back. Does it go to the right place?
12. **Pull-to-refresh** — On every list screen (sessions, messages, saved), pull down. Does it refresh?
13. **Logout** — Does it clear all state and return to welcome screen?
14. **Deep link handling** — If app is killed and reopened, does it restore auth state?
