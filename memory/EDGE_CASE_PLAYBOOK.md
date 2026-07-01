# RapidReps — Edge-Case Playbook

**Owner:** Engineering · **Last reviewed:** 2026-06-30 · **Status:** Contract locked. Critical Batch 1 shipped (iter106an).

---

## Critical Batch 1 — Shipped 2026-06-30 (iter106an) ✅

Three of the highest-risk gaps identified in this playbook are now closed. Shared infrastructure:

- `/app/backend/config/edge_cases.py` — env-driven timeout config (14 knobs).
- `/app/backend/audit.py` — `log_edge_case_action` writes to `db.edge_case_audit` (indexed, idempotent).
- `/app/backend/edge_case_scheduler.py` — single async loop, 60 s cadence (configurable), 3 idempotent jobs.
- `/app/backend/routes/webhook_routes.py` — Stripe webhook + admin debug endpoints.
- All state transitions use atomic MongoDB compare-and-set (`update_one` with status filter).

**Gaps now closed:** G1 (auto trainer no-show), G11 (auto-decline unresponsive request), G12 (responsiveness strike), G17 (Stripe webhook), G18 (orphan-payment auto-refund), G19 (Stripe idempotency keys).

**Env vars (all optional; safe defaults shipped):**
`EDGE_CASE_LOOP_INTERVAL_SEC`, `NO_SHOW_GRACE_MIN`, `NO_SHOW_BATCH_SIZE`, `REQUEST_TIMEOUT_MIN`, `REQUEST_NUDGE_MIN`, `RESPONSIVENESS_STRIKE_IGNORES`, `RESPONSIVENESS_WINDOW_DAYS`, `REQUEST_TIMEOUT_BATCH_SIZE`, `ORPHAN_RECONCILE_LOOKBACK_MIN`, `ORPHAN_RECONCILE_MIN_AGE_MIN`, `ORPHAN_BATCH_SIZE`, `STRIPE_WEBHOOK_SECRET`, `ENABLE_AUTO_NO_SHOW`, `ENABLE_AUTO_DECLINE`, `ENABLE_ORPHAN_RECONCILE`.

**Admin endpoints:** `GET /api/admin/edge-case-audit` (filterable), `GET /api/admin/edge-case-config` (live snapshot).

**Test coverage:** 14 pytest cases in `/app/backend/tests/test_iter106an_critical_batch_1.py` — all passing.

---

Defines the expected outcome for the 9 failure modes that produce the most user pain or financial dispute. This is a contract — code is reviewed *against* it.

> **Status legend per scenario field:**
> ✅ Wired & correct — 🟡 Partially wired (gap noted) — ❌ Not wired

---

## Scenario 1 — Trainer accepts but never arrives

### 1. Current implementation status
🟡 Partial. `PATCH /api/sessions/{id}/no-show?who=trainer` exists and gives the trainee a 100% refund + trainer a strike. But there's **no automatic detection** — someone (trainee or admin) has to push the button. There's no scheduled job that watches confirmed sessions whose `sessionDateTimeStart` passed and the trainer never check-in / went `en_route`.

### 2. Intended business rule
A trainer who accepted a session but does not check in within **10 minutes after the scheduled start** is a no-show. After T+10, the session auto-flips to `NO_SHOW` with `noShowParty=trainer`. Trainee is offered the no-show button at T+5 in the UI.

### 3. User-facing outcome (trainee)
- T+0 → push "Where's your trainer?" if no `enRouteStartedAt`.
- T+5 → in-app banner "Trainer is late — report no-show" CTA.
- T+10 → auto-no-show triggers full refund (100% of `finalSessionPriceCents`) + 1 free virtual-session credit + push "Trainer no-show. Full refund issued."

### 4. Trainer-facing outcome
- Performance strike applied (`+1 performanceStrikes`, entry in `strikeHistory` with reason `no_show`).
- 3rd strike → `accountUnderReview=true` and account flagged for admin review (already wired in `mark_no_show`).
- Earnings for this session: **$0**.
- Push: "No-Show Strike — A performance strike has been applied."

### 5. Payment / refund / penalty outcome
- `traineeRefundCents` = `finalSessionPriceCents`.
- `trainerEarningsCents` = 0. `platformFeeCents` = 0.
- Stripe refund: full `Refund.create(payment_intent=..., reason='requested_by_customer')`.
- 1 virtual-session credit issued to trainee (`session_credits` insert).

### 6. Booking status outcome
- `status` → `NO_SHOW`, `noShowParty` = `trainer`, `cancelledAt` = T+10.
- Session NOT eligible for "Rate Your Session" reminder.

### 7. Required notifications
- T+0 push "Where's your trainer?" → trainee
- T+5 in-app banner with no-show CTA → trainee
- T+10 push "Trainer no-show — refund issued." → trainee
- T+10 push "No-Show Strike applied." → trainer
- T+10 admin Slack/email (currently mocked SendGrid → only DB notification today)

### 8. Admin / dispute handling
- Trainee can open a dispute on top of the auto-no-show (e.g. "Trainer was at wrong location, force me to drive 20mi") via `POST /api/sessions/{id}/disputes`. Admin can then convert the strike into a tier downgrade or chargeback.

### 9. What is already wired
- `mark_no_show(who='trainer')` endpoint and all its side-effects (refund, strike, 3-strike flag, virtual credit) — implemented in `/app/backend/routes/session_routes.py` lines 1543-1600.
- Dispute flow can be opened on top — implemented in iter106aj.
- Strike + `accountUnderReview` flag — implemented.

### 10. Gaps
- **G1 (Critical):** No background job auto-flips the session at T+10. Today it requires manual trigger. ✗
- **G2 (High):** No "Where's your trainer?" push at T+0 or in-app banner at T+5. ✗
- **G3 (Medium):** No admin alert when 3rd strike triggers `accountUnderReview` (DB-only). ✗

### 11. Priority
**Critical** — silent trainer no-shows are the worst-possible trainee experience and the highest dispute trigger.

---

## Scenario 2 — Trainer cancels at the last minute

### 1. Current implementation status
✅ Wired. `PATCH /api/sessions/{id}/cancel` with `cancelled_by="trainer"` applies the time-based penalty rules.

### 2. Intended business rule
- > 12h before start → no penalty, full refund to trainee.
- ≤ 12h before start → full refund to trainee + virtual-session credit + trainer strike.

### 3. User-facing outcome (trainee)
- Push: "Session Cancelled by Trainer — full refund processed" (+ "free virtual session credit" if < 12h).
- Refund hits Stripe (test mode today) within 5-10 business days.

### 4. Trainer-facing outcome
- If < 12h: `performanceStrikes +1` with reason `late_cancellation`; 3+ strikes flag.
- If > 12h: no strike, just status update.
- No earnings on the session.

### 5. Payment / refund / penalty outcome
- Full Stripe refund regardless of timing.
- `cancellationPenaltyCents` = 0 (trainer always eats it).
- `gives_credit=true` only if ≤ 12h before start.

### 6. Booking status outcome
- `status` → `CANCELLED`, `cancelledBy=trainer`, `cancellationPenaltyPercent` set, `refundAmountCents` recorded.

### 7. Required notifications
- Push to trainee: "Session Cancelled by Trainer. Full refund processed."
- Push to trainer: (none today — gap).

### 8. Admin / dispute handling
- Trainee may file dispute if refund stuck. Admin can manually push refund via `/admin/disputes/{id}/refund-partial` or `/refund-full` (iter106ak).
- 3rd strike → `accountUnderReview=true`.

### 9. What is already wired
- Time-based penalty calculation in `calculate_time_based_cancellation_penalty()` (`deps.py`).
- Stripe refund attempt in `cancel_session` (lines 1379-1390).
- Strike + virtual-credit issuance (lines 1392-1422).

### 10. Gaps
- **G4 (Medium):** Trainer doesn't get a confirmation push for their own cancellation ("OK, cancelled. Strike applied: yes/no.").
- **G5 (Medium):** If Stripe refund fails, the error is silently stored in `stripeRefundError` — no admin alert, no retry queue.

### 11. Priority
**High** — flow works, but silent refund failures will erode trust if Stripe rejects a refund (e.g., the original charge is older than 180 days).

---

## Scenario 3 — Client cancels after acceptance

### 1. Current implementation status
✅ Wired. Same `PATCH /api/sessions/{id}/cancel` endpoint with `cancelled_by="trainee"`.

### 2. Intended business rule
- > 12h before start → no penalty, 100% refund.
- 12h–2h before start → 25% penalty (trainer paid 25% of price, trainee refunded 75%).
- < 2h before start → 50% penalty (trainer paid 50%, trainee refunded 50%).

### 3. User-facing outcome (trainee)
- Push: "Session cancelled. Penalty: $X. Refund: $Y."
- Refund hits Stripe in 5-10 business days.

### 4. Trainer-facing outcome
- Push: "The trainee has cancelled the session. Penalty: $X (your earnings)."
- Trainer earnings = `penalty_cents − platform_fee_cents` per `calculate_time_based_cancellation_penalty()`.
- No strike.

### 5. Payment / refund / penalty outcome
- Partial Stripe refund (only the trainee-refund portion).
- `trainerPayoutCents` set on session; counted toward next admin manual payout cycle.

### 6. Booking status outcome
- `status` → `CANCELLED`, `cancelledBy=trainee`, `cancellationPenaltyPercent` in {0, 25, 50}.

### 7. Required notifications
- Push to trainer with penalty amount.
- Push to trainee with refund amount (currently missing — only the trainer side gets one in `cancel_session`).

### 8. Admin / dispute handling
- Trainer can dispute the penalty calculation via `/sessions/{id}/disputes` (e.g. claims trainee gave 14h notice but clock said 11h59m — boundary case).

### 9. What is already wired
- All three penalty tiers in `calculate_time_based_cancellation_penalty`.
- Stripe partial refund.
- Trainer notification.

### 10. Gaps
- **G6 (Medium):** Trainee gets no push after their own cancellation. Today they only see the response payload — if they kill the app immediately, they have no record.
- **G7 (Low):** No "Are you sure?" confirm step with cost-shown on the trainee side (this is frontend — already exists per `/app/frontend/app/trainee/confirm-booking.tsx` family of screens; verify the cancel-modal also surfaces the penalty before submit).

### 11. Priority
**Medium** — works correctly; UX polish gaps.

---

## Scenario 4 — GPS is inaccurate

### 1. Current implementation status
🟡 Partial. `POST /api/sessions/{id}/gps-checkin` records the check-in with a configurable radius (default **5 mi**, configurable 1–35 mi via `gpsCheckinRadiusMiles`). It calculates `distanceMiles` via Haversine and sets `withinRadius` boolean. **It does NOT accept or validate device GPS `accuracy` (±meters).** A device with a 500m accuracy circle can still false-positive a check-in.

### 2. Intended business rule
- GPS check-in succeeds only if `(distance + accuracy) ≤ radiusMiles`.
- If device GPS accuracy worse than **100m**, reject the check-in and force the user to either retry or use a fallback (manual confirm by the other party).
- If GPS unavailable (permission denied / no signal), session can still proceed via the `proceed` no-show-action by the trainer (already wired).

### 3. User-facing outcome (trainee)
- "Check in" button greys out and shows "Your GPS accuracy is too low (±X m). Move outside or retry."
- If trainer used `proceed` to skip GPS: in-app banner "Session started without GPS confirmation — proceed at your own risk."

### 4. Trainer-facing outcome
- Same accuracy gate.
- After 2 failed check-ins within 60s: surface the "no-show-action" sheet (cancel / wait / proceed).

### 5. Payment / refund / penalty outcome
- No financial effect of an inaccurate GPS; check-in just doesn't confirm. The session can still proceed via `noShowAction=proceed` which sets `status=IN_PROGRESS` and `startedAt=now`.

### 6. Booking status outcome
- Unchanged unless trainer takes a no-show action.
- `proceed` path stores `noShowNotes='Proceeding without GPS confirmation'`.

### 7. Required notifications
- Push to other party: "{Trainer/Trainee} Check-in Warning — they're X mi away" (already wired when `withinRadius=false`).
- Push when `proceed` is chosen: "Session Started without GPS confirmation" (already wired).

### 8. Admin / dispute handling
- If a trainee disputes "trainer never arrived" but trainer used `proceed`, admin checks `noShowNotes` + selfie-verification timestamps + GPS history to decide.

### 9. What is already wired
- Haversine distance check.
- Configurable per-session radius.
- Both-parties-confirmed flag.
- Trainer override (`cancel`/`wait`/`proceed`).
- Selfie verification as a 2nd attestation layer (`/app/backend/routes/session_routes.py` lines 380-420).

### 10. Gaps
- **G8 (High):** `GpsCheckinRequest` model does not accept `accuracy` field; backend has no concept of GPS quality. ✗
- **G9 (High):** No automatic "your GPS is too noisy" client-side gate. Frontend always sends whatever it has. ✗
- **G10 (Medium):** No GPS spoofing detection (e.g., teleport from 50mi away in 30s). For now, trust the device.

### 11. Priority
**High** — GPS false-positives directly cause disputes ("trainer was 8mi away but the app said they arrived"). Tightening this is a top-3 customer-trust fix.

---

## Scenario 5 — Trainer marks themselves available but ignores requests

### 1. Current implementation status
❌ Mostly not wired for **scheduled session requests**. The instant-match flow has a 15s/candidate cascade with 5-min overall expiry (`/app/backend/routes/matching.py` lines 215-296), so an ignoring trainer is bypassed automatically. But a regular session **request** (`POST /api/sessions` → status `requested`) has **no auto-decline timeout** and no metric for trainer responsiveness.

### 2. Intended business rule
- Scheduled session request → trainer must accept/decline within **60 minutes** (or X hours configurable). If silent, auto-decline + suggest 3 backup trainers to trainee.
- Trainer with > 30% silent-decline rate over 30 days → automatically toggled `isAvailable=false` and pushed a "Please update your availability or you'll be hidden from search" reminder.
- Three consecutive silent ignores in 7 days → 1 strike (`strikeHistory.reason = 'unresponsive'`).

### 3. User-facing outcome (trainee)
- After 60min of no trainer response → push "Trainer hasn't responded. Want to try a different trainer? Tap to see 3 backups."
- Original session auto-cancelled, no charge (payment wasn't captured yet — payment only fires after trainer accepts).

### 4. Trainer-facing outcome
- T+30min reminder push "Pending session request from {name} — respond now."
- T+60min strike if 3rd ignore in 7 days.
- Marked `accountUnderReview` at 3 strikes.

### 5. Payment / refund / penalty outcome
- No financial effect — trainee hasn't paid yet (payment is unlocked only on `accept`).

### 6. Booking status outcome
- `status: requested` → `DECLINED` with `declinedReason='trainer_timeout'`.

### 7. Required notifications
- T+30: push to trainer "Pending request — respond now."
- T+60: push to trainee with 3 backup trainers.
- 3rd strike: push to trainer + admin alert.

### 8. Admin / dispute handling
- Trainer Admin view shows responsiveness rate (24h/7d/30d windows). Admin can manually disable a chronically unresponsive trainer.

### 9. What is already wired
- `isAvailable` flag and search filter on it (`matching.py` lines 80, 176, 179).
- Instant-match cascade (5min expiry + 15s/candidate).
- Negotiation expires after 1h (`negotiation_routes.py` line 109 `_maybe_expire`).

### 10. Gaps
- **G11 (Critical):** No auto-decline for plain session-requests after timeout. ✗
- **G12 (High):** No responsiveness metric / strike for chronic ignoring. ✗
- **G13 (Medium):** No "show 3 backup trainers" deep-link on timeout. ✗

### 11. Priority
**Critical** — unresponsive trainers are the #1 cited friction in early UX research and directly blocks trainee retention.

---

## Scenario 6 — Session timer starts too early or too late

### 1. Current implementation status
🟡 Partial. `POST /api/sessions/{id}/start-session` sets `sessionActualStart=now` whenever the trainer (or trainee — see code at `location_routes.py:447-450`) hits it. There is **no guard** preventing it from being called 2 hours early or 3 hours late. `generate_session_summary()` calculates `durationMinutes = (ended − started)` with no upper cap, so a late-end can record absurd durations (and absurd calorie estimates).

### 2. Intended business rule
- `start-session` callable only between **T−15 min and T+30 min** relative to `sessionDateTimeStart`. Outside that window → 400 with explanation.
- `end-session` enforced to be ≥ T_actual_start + 10 min (no instant complete) and ≤ T_actual_start + (`durationMinutes × 2`). Outside → 400.
- If a trainer tries to start > 30 min late, force a "session-shortened" acknowledgement: agreed price stays the same but the trainee gets a 50% credit toward next session. This is the late-start trainer penalty.

### 3. User-facing outcome (trainee)
- Trainee gets a push the moment start fires: "Session started at HH:MM."
- If trainer late-starts > 30 min: in-app banner "Your trainer started late — you've earned a 50% credit toward your next session."
- If session ends with `duration > 2× planned`: trainee sees a "Was this duration correct?" sheet before rating.

### 4. Trainer-facing outcome
- Early-start (< T−15) → blocked with toast "You can start 15 min before the scheduled time."
- Late-start (> T+30) → soft warning, but allowed with `lateStartCredit=true` stamped on session.
- Late-end (> 2× planned) → confirmation modal "This will record X min. Confirm?".

### 5. Payment / refund / penalty outcome
- Late-start > 30 min → trainee credit issued (50% of `finalSessionPriceCents` as virtual credit).
- Otherwise unaffected — full agreed price still settles on completion.

### 6. Booking status outcome
- Adds `lateStartCredit` boolean and `actualStartDelayMinutes` int for analytics.

### 7. Required notifications
- "Session started" push (already wired).
- "Late-start credit issued" push (new).

### 8. Admin / dispute handling
- Late-start credit appears on admin's daily reconciliation report so they know to credit before paying the trainer.

### 9. What is already wired
- `start-session` endpoint stamping `sessionActualStart`.
- `end-session` stamping `sessionEndedAt` and flipping to `COMPLETED`.
- Duration calculation in `generate_session_summary` (no cap).
- Rate-reminder scheduled at +30 min after end.

### 10. Gaps
- **G14 (High):** No T−15 / T+30 start gate. ✗
- **G15 (High):** No max-duration cap on end. ✗
- **G16 (Medium):** No "late-start credit" path. ✗

### 11. Priority
**High** — bad timestamps poison earnings reports, calorie/duration analytics, and downstream dispute resolution. Cheap to gate.

---

## Scenario 7 — Payment succeeds but booking fails

### 1. Current implementation status
🟡 Partially safe by design but **no Stripe webhook** is wired. Today the flow is:
1. Client calls `POST /api/payments/create-payment-intent` with `sessionId`. Backend creates Stripe PI and **stamps `paymentIntentId` on the session immediately** (this is the resilience: even if the client crashes, the session knows which PI belongs to it).
2. Native PaymentSheet completes.
3. Client calls `POST /api/payments/sessions/confirm` with `paymentIntentId`, backend re-verifies status with Stripe, marks `paymentStatus=paid`.

The hole: if step 3 never fires (client killed mid-confirmation), the customer has paid but the session never flips to `paid`. There's **no webhook** as backup.

### 2. Intended business rule
- Stripe `payment_intent.succeeded` webhook is the authoritative source of truth. On webhook receipt:
  - Find session by `paymentIntentId`.
  - If found, set `paymentStatus=paid`, `paidAt=event.created`, idempotently.
  - If session deleted / not found, automatically refund the PI ("orphan payment") and log to admin queue.
- Client-side `/payments/sessions/confirm` is a fast-path but no longer the only path.

### 3. User-facing outcome (trainee)
- Even if app crashes after PaymentSheet success: by the time the user re-opens the app within a minute, the session shows as paid (webhook fired in the background).
- If a true orphan payment occurs (session was deleted between PI creation and webhook): user gets an auto-refund + push "We refunded $X because the session was no longer available."

### 4. Trainer-facing outcome
- No effect unless the orphan triggers. In that case, no earnings change.

### 5. Payment / refund / penalty outcome
- Idempotent: `paymentStatus` only set if not already paid.
- Orphan path: auto-refund via `stripe.Refund.create`.

### 6. Booking status outcome
- `paymentStatus=paid`, `paidAt` set, session ready for execution.

### 7. Required notifications
- Push "Payment confirmed — see you at HH:MM" (today this only fires on client-confirm; should also fire on webhook).
- Orphan: push + admin email.

### 8. Admin / dispute handling
- Admin queue of orphan payments (today: none).
- Manual reconciliation tool to look up PI ID → session ID.

### 9. What is already wired
- `paymentIntentId` is stamped on the session at PI creation (good).
- `confirm_session_payment` re-verifies the PI with Stripe (good — doesn't trust the client).
- Corporate fully-subsidised shortcut (handles `corp_full_subsidy_*` IDs).

### 10. Gaps
- **G17 (Critical):** No Stripe webhook endpoint. ✗
- **G18 (High):** No orphan-payment detection / auto-refund. ✗
- **G19 (Medium):** No idempotency key sent on `Refund.create` / `PaymentIntent.create` — a network blip during retry can double-charge or double-refund. ✗

### 11. Priority
**Critical** — money was taken but service wasn't delivered. This is the worst possible user outcome and a chargeback magnet.

---

## Scenario 8 — Push notifications don't arrive

### 1. Current implementation status
🟡 Partial. `send_push_notification` posts to Expo Push API, swallows failures with a log warning (`deps.py:387-388`). Every push is *also* stored as an in-app notification (`create_and_send_notification` inserts into `db.notifications` first, then fires push as a fire-and-forget task). So the user can always see the message in-app — they just may not see the OS-level notification.

### 2. Intended business rule
- Push is best-effort. The in-app notification feed (`/api/notifications/list`) is the source of truth.
- Push tokens older than 60 days without a refresh are removed (Expo invalidates them anyway).
- For **critical** events (payment confirmed, session starting in 10 min, trainer arrived), a 2nd fallback channel is required:
  - SMS via Twilio (currently mocked).
  - Email via SendGrid (currently mocked).
- Two-strikes-and-cleanup: if Expo Push returns `DeviceNotRegistered` for a token twice, delete it from `db.push_tokens` so we stop hammering.

### 3. User-facing outcome (trainee)
- If no OS push: red dot on the app icon (badge count from Expo `badge` field, already set in `deps.py:380`) + the notification appears in the in-app feed on next foreground.
- For critical events: SMS fallback (when wired).

### 4. Trainer-facing outcome
- Same.

### 5. Payment / refund / penalty outcome
- None directly.

### 6. Booking status outcome
- None.

### 7. Required notifications
- Self-test screen ("Notifications") that fires a test push and tells the user whether their token is registered + reachable.

### 8. Admin / dispute handling
- "Trainer says they never got the request" — admin can query `db.push_tokens` for that user + `db.notifications` for the message → confirm whether it was sent, was opened, etc.

### 9. What is already wired
- Expo Push send with badge count.
- In-app notification persistence (always works even if push fails).
- `notification_preferences` respected per-type.
- Token registration on app launch (`NotificationContext.tsx` lines 167-194).

### 10. Gaps
- **G20 (High):** No SMS / email fallback for critical events. ✗
- **G21 (Medium):** No automatic cleanup of `DeviceNotRegistered` tokens. ✗
- **G22 (Low):** No user-facing "test push" diagnostic screen. ✗

### 11. Priority
**Medium** — annoying but rarely catastrophic because the in-app feed always works. SMS fallback for `session_starting_soon` would meaningfully improve attendance.

---

## Scenario 9 — Network drops during an active session

### 1. Current implementation status
❌ Largely not wired client-side. The WebSocket at `/api/ws/sessions/{id}/track` has no reconnect logic in `EnRouteMap.tsx`. There's no `NetInfo` listener anywhere in the frontend. The GPS-checkin polling falls back gracefully if requests fail (silent catch), but there's no UI indication of offline state.

### 2. Intended business rule
- Active sessions tolerate up to **2 min** of connectivity loss without consequence.
- During offline: GPS pings + WebSocket frames are queued locally (AsyncStorage). On reconnect, they're flushed in order with original timestamps.
- If a session ends while offline: the `end-session` request is queued and retried on reconnect. Until it succeeds, the trainer sees an "Offline — your changes will sync" banner and a Retry button.
- Backend WebSocket auto-disconnects idle clients after 5 min; client must reconnect with exponential backoff (1s, 2s, 4s, 8s, 16s, cap 30s).

### 3. User-facing outcome (trainee/trainer)
- "Offline" banner appears at the top of the session screen.
- Map shows last-known position with a "🔌 Reconnecting…" pill instead of the live dot.
- Once reconnected: banner flips to "Synced" for 3s, then disappears.

### 4. Trainer-facing outcome
- Same banner. End-session is the only critical action that **must** sync; the local queue ensures it does.

### 5. Payment / refund / penalty outcome
- None directly. If trainer ends while offline and request is later rejected (e.g. status race), trainer can re-end without penalty.

### 6. Booking status outcome
- Session keeps last known status during disconnect; status transitions are queued.

### 7. Required notifications
- None at the OS level. Offline state is in-app only.

### 8. Admin / dispute handling
- Trainee dispute "session never ended on time" — admin checks GPS-track timestamps + end-session timestamp. If the gap was network-loss (look for `clientQueuedAt` vs `serverReceivedAt` skew > 30s on the end-session call), no penalty applied.

### 9. What is already wired
- WebSocket server (`session_tracking_ws.py`).
- GPS polling fallback (`EnRouteMap.tsx` polls every 8s if WS dies — but no explicit reconnect of the WS itself).
- All backend writes are idempotent on `sessionId`.

### 10. Gaps
- **G23 (High):** No client-side WS reconnect with backoff. ✗
- **G24 (High):** No `NetInfo` listener. ✗
- **G25 (High):** No offline queue for GPS pings / end-session. ✗
- **G26 (Medium):** No "offline" banner / "Synced" toast. ✗
- **G27 (Medium):** No server-side replay protection if a stale queued ping arrives 5 min late and overwrites a newer position. ✗

### 11. Priority
**High** — outdoor sessions in parks, gym basements, and elevators routinely drop connectivity. Today the app simply forgets the GPS history, which weakens dispute defense.

---

# Top 3 Highest-Risk Gaps to Implement Next

Ranked by (a) financial risk × (b) user-trust impact × (c) implementation effort.

### 🔴 1. Stripe webhook + orphan-payment recovery (Scenario 7 — Gaps G17 + G18)
**Why this is #1:** A user has paid money for a service that doesn't exist on the platform. This is irreversibly the worst outcome: chargebacks, App Store complaints, and PR risk. The fix is well-bounded (one new route + one signed-secret env var) and unblocks the move to live Stripe keys.
**Effort:** ~3 hours backend + 30 min frontend banner. No new dependencies.
**Acceptance:** kill the app immediately after PaymentSheet success → reopen → session shows `paymentStatus=paid` within 60s.

### 🔴 2. Trainer auto-no-show + late-start enforcement (Scenarios 1 + 6 — Gaps G1 + G14 + G15)
**Why:** Silent trainer no-shows are the single biggest dispute trigger today. Combining this with start/end-time gates closes a whole class of "the math doesn't add up" issues that admins currently have to resolve manually. Both need the same primitive (a periodic-task runner / Mongo TTL watcher).
**Effort:** ~6 hours backend (background task or APScheduler), ~2 hours frontend (in-app banner + late-start credit display).
**Acceptance:** confirmed session whose `sessionDateTimeStart` is in the past 10 min with no `enRouteStartedAt` flips to `NO_SHOW` with full refund + credit, without anyone tapping anything.

### 🔴 3. Trainer request auto-decline + responsiveness metric (Scenario 5 — Gaps G11 + G12)
**Why:** Trainees abandon the app when they wait > 30 min for an unresponsive trainer to respond. This is the #1 friction reported in early UX. Same scheduler primitive as #2 — implementing both at once amortizes the cost.
**Effort:** ~4 hours backend + ~2 hours frontend ("3 backup trainers" deep-link on timeout).
**Acceptance:** session in `requested` state for 60 min → status flips to `DECLINED` with `declinedReason='trainer_timeout'`, trainee receives push + 3 trainer suggestions; trainer with 3 ignores in 7 days gets a strike.

---

## Appendix: full gap index (cross-referenced)

| Gap | Scenario | Priority | Effort | Where |
|---|---|---|---|---|
| G1 — auto trainer no-show | 1 | Critical | M | `session_routes.py` + scheduler |
| G2 — T+0 / T+5 trainee warnings | 1 | High | S | `session_routes.py` + scheduler |
| G3 — 3-strike admin alert | 1 | Medium | S | `deps.py` + email |
| G4 — trainer-side cancel push | 2 | Medium | S | `cancel_session` |
| G5 — Stripe refund retry queue | 2 | Medium | M | new `failed_refunds` collection |
| G6 — trainee-side cancel push | 3 | Medium | S | `cancel_session` |
| G7 — trainee cancel confirm-modal copy | 3 | Low | S | frontend |
| G8 — accept GPS `accuracy` field | 4 | High | S | `gps_checkin_routes.py` |
| G9 — frontend GPS-quality gate | 4 | High | S | `LiveTrainerMap.tsx` |
| G10 — GPS spoof detection | 4 | Low | L | future |
| G11 — auto-decline session request | 5 | Critical | M | new scheduler |
| G12 — trainer responsiveness metric | 5 | High | M | new collection |
| G13 — 3-backup-trainer deep-link | 5 | Medium | S | frontend |
| G14 — start-session time gate | 6 | High | S | `location_routes.py` |
| G15 — end-session max-duration | 6 | High | S | `session_routes.py` |
| G16 — late-start credit | 6 | Medium | S | `location_routes.py` |
| G17 — Stripe webhook | 7 | Critical | M | new `webhooks_routes.py` |
| G18 — orphan-payment auto-refund | 7 | High | S | inside webhook |
| G19 — idempotency keys | 7 | Medium | S | `payment_routes.py` |
| G20 — SMS/email fallback | 8 | High | M | Twilio + SendGrid wiring |
| G21 — cleanup dead push tokens | 8 | Medium | S | `deps.py` |
| G22 — test-push diagnostic | 8 | Low | S | frontend |
| G23 — WS reconnect w/ backoff | 9 | High | S | `EnRouteMap.tsx` |
| G24 — NetInfo listener | 9 | High | S | new context |
| G25 — offline queue | 9 | High | M | new `offlineQueue.ts` |
| G26 — offline banner / Synced toast | 9 | Medium | S | frontend |
| G27 — server replay protection | 9 | Medium | S | `session_tracking_ws.py` |

S = ≤ 4h, M = 4–12h, L = > 12h.

---

**End of playbook.** No backend behavior was changed by writing this document.
