# RapidReps — Complete User Workflow Guide

---

## 1. USER SIDE (Trainee)

### 1.1 Onboarding
1. **Sign Up**: User creates an account with full name, email, password, and selects the "Trainee" role. An optional referral code can be entered during signup for both parties to earn credit.
2. **Trainee Onboarding**: After signup, the trainee completes an onboarding flow where they select their fitness level (beginner, intermediate, advanced), training goals, preferred training styles, and location preferences.
3. **Home Dashboard**: The trainee lands on a tabbed home screen with five tabs: Home, Sessions, Saved, Messages, and Profile.

### 1.2 Discovering & Booking Trainers
1. **Search Trainers**: From the Home tab, trainees can search for trainers with filters including location proximity, specialty, training style, availability, and rating. The search uses a Haversine distance formula to find nearby trainers.
2. **Trainer Detail View**: Tapping a trainer shows their full profile — name, bio, avatar, intro video, certifications, experience years, training styles, session types offered (virtual, outdoor, in-home), rates per session type, average rating, total reviews, and availability schedule.
3. **Calculate Price**: The trainee selects a session type (virtual/outdoor/in-home), duration (30/45/60 min), date, and time. Price is calculated using the formula: `(Trainer's hourly rate / 0.80) × (duration / 60) + $2.00 service fee`. Travel fees apply for in-home sessions based on distance.
4. **Discounts Applied Automatically**:
   - **Multi-session discount**: 5% off after 3+ completed sessions with the same trainer.
   - **Membership discount**: 10% off all sessions for active members.
   - **Referral credits**: Deducted from the platform fee portion (never reduces trainer earnings).
5. **Confirm Booking**: The trainee reviews the full price breakdown (base rate, travel fee, discounts, service fee, total) and proceeds to pay via Stripe Payment Sheet (native card/Apple Pay UI). A success modal confirms the booking.
6. **Session Created**: The session is created with status "requested." The trainer receives a push notification about the new session request.

### 1.3 Session Types
- **Outdoor**: Trainer meets trainee at a park, gym, or outdoor location. Standard pricing.
- **In-Home**: Trainer travels to the trainee's home. Travel fee is calculated based on distance (70% goes to trainer, 30% to platform). A 4-digit safety PIN is generated for the trainee to share with the trainer upon arrival.
- **Virtual (Instant Match)**: Trainee requests an instant virtual session. The system auto-matches with the best available virtual trainer (sorted by rating and session count). Session starts immediately via Zoom. Fixed pricing at $18/30 min.

### 1.4 Recurring Sessions
Trainees can set up recurring sessions with a specific trainer — choosing day of week, time slot, duration, recurrence type (weekly or biweekly), and number of sessions. All sessions are created as individual bookings that the trainer must accept.

### 1.5 During a Session
1. **Track Trainer En Route**: When the trainer marks themselves as en route, the trainee sees a real-time tracking screen showing the trainer's distance, estimated time of arrival (ETA), and an animated progress bar. The trainee can message the trainer directly from this screen.
2. **Safety PIN (In-Home)**: For in-home sessions, the trainee shares their 4-digit safety PIN with the trainer. The trainer must enter it to start the session.
3. **Selfie Verification**: Both trainer and trainee submit attendance selfies before the session begins. The system tracks both submissions; the session can only officially start once both are verified.
4. **Active Session View**: For virtual sessions, the trainee sees a timer, session details, and can join the Zoom call.

### 1.6 Post-Session
1. **Session Complete**: After the trainer ends the session, the trainee confirms the session end. Both parties see a session summary with duration, price, and a share card.
2. **Rate Trainer**: The trainee can rate the trainer (1-5 stars) with a text review within 48 hours of session completion. Anti-gaming rules enforce: one rating per session, no self-rating, verified email required, and a cooldown period between ratings.
3. **Share Status**: The trainee can share their workout status/streak to social media via a shareable card.

### 1.7 Cancellation & No-Show Rules (Trainee)
- **>12 hours before session**: $0 penalty, full refund.
- **12h–2h before**: 25% penalty, 75% refund.
- **<2 hours before**: 50% penalty, 50% refund.
- **Trainee no-show** (doesn't appear within 10 min): Charged 50% of session price. Trainer receives 50% payout minus platform fee.

### 1.8 Membership
- **Price**: $19.99/month via Stripe Payment Sheet.
- **Benefits**: 10% discount on all sessions, 1 free visibility boost per month, priority support, and a member badge visible on their profile.

### 1.9 Messaging
Trainees can message trainers directly from the trainer detail page, en-route tracking screen, or the Messages tab. Conversations are persistent and show message history. Both parties receive push notifications for new messages.

---

## 2. TRAINER SIDE

### 2.1 Onboarding
1. **Sign Up**: User creates an account and selects the "Trainer" role.
2. **Trainer Onboarding**: Multi-step onboarding flow:
   - **Profile Setup**: Bio, experience years, certifications, training styles (strength, cardio, HIIT, yoga, boxing, etc.), gyms worked at, primary gym.
   - **Session Settings**: Session types offered (in-person, virtual), session durations (30/45/60 min), travel radius (miles), cancellation policy.
   - **Rate Setting**: Set hourly rates per session type (virtual, outdoor, in-home). Minimum rates enforced: Virtual $15/hr, Outdoor $20/hr, In-Home $30/hr.
   - **Media Upload**: Profile photo URL and intro video URL.
   - **Location**: Set home location (latitude/longitude) for distance calculations and nearby trainee matching.

### 2.2 Verification (Required Before Going Live)
Trainers must complete a multi-step verification process before they can accept sessions:
1. **Government ID**: Upload a photo of a valid government-issued ID.
2. **Certification**: Upload professional fitness certification documents.
3. **Insurance**: Upload proof of liability insurance.
4. **Background Check Consent**: Acknowledge consent for a background check.
5. **Submit All**: Press and hold the submit button (2-second hold to prevent accidental submission). A success modal confirms documents have been submitted to the admin team for review (1-3 business days).

### 2.3 Session Management
1. **Session Requests**: Incoming session requests appear in the Sessions tab. The trainer can accept or decline each request. Accepting confirms the session and notifies the trainee.
2. **En Route Navigation**: For in-person sessions, the trainer taps "Navigate" to open the en-route screen:
   - GPS location sharing starts automatically (updates every 5 seconds).
   - Distance and ETA to the trainee are calculated and displayed in real-time.
   - "Open Maps" button launches Google Maps/Apple Maps for turn-by-turn navigation.
   - "Message" button to communicate with the trainee.
   - "I've Arrived" button stops GPS sharing and triggers an arrival modal with the option to start the session immediately.
3. **PIN Verification (In-Home)**: For in-home sessions, the trainer enters the 4-digit safety PIN provided by the trainee to verify arrival and start the session.
4. **GPS Confirmation**: The system can verify the trainer's GPS location matches the session location (within a configurable radius).
5. **Start Session**: Timer begins. The trainer manages the session from the active session screen.
6. **End Session**: Trainer ends the session. The trainee must confirm the end. A session summary is generated with actual duration and earnings breakdown.

### 2.4 Cancellation & No-Show Rules (Trainer)
- **>12 hours before**: No penalty, session refunded to trainee.
- **≤12 hours before**: Full refund to trainee + free virtual session credit issued to trainee + **performance strike** applied to trainer.
- **Trainer no-show** (doesn't arrive within 10 min): 100% refund to trainee, trainer gets $0 + performance strike.
- **3 strikes = account under review**: Admin is notified, trainer's account is flagged.

### 2.5 Earnings & Payouts
1. **Earnings Dashboard**: Shows total earnings, pending payouts, completed payouts, and per-session breakdowns. The trainer earns their full set rate (the platform fee is added on top, not deducted from their rate).
2. **Revenue Split**: Trainer keeps 100% of their set rate. Platform adds 25% on top for the trainee. Service fee ($2) goes entirely to the platform.
3. **Stripe Connect**: Trainers connect their bank account via Stripe Connect Express onboarding. The system generates a real Stripe onboarding URL that opens in the browser.
4. **Payout Requests**: Trainers can request payouts of their accumulated earnings. Admin processes payouts through the admin dashboard.
5. **Stripe Dashboard**: Trainers can access their Stripe Express dashboard to view transaction history and manage their connected account.

### 2.6 Visibility Boosts
Trainers can purchase visibility boosts to appear higher in search results:
- **Daily Boost**: $4.99/day
- **Weekly Boost**: $24.99/week
- **Monthly Boost**: $79.99/month
- Members get 1 free boost per month. Boost analytics show views generated by the boost. Boosts are paid via Stripe Payment Sheet.

### 2.7 Go Live / Available Now
Trainers can toggle "Available Now" status. When a trainer goes live:
- Their profile is marked as "Live Now" in search results.
- All past trainees who have completed sessions with this trainer receive a push notification that the trainer is available.
- Nearby trainees see the trainer highlighted in their discovery feed.

### 2.8 Profile Management
The Edit Profile screen allows trainers to update:
- Bio, experience years, certifications, training styles
- Session offerings (in-person, virtual), durations, travel radius
- Location, cancellation policy, availability status
- Profile photo URL and intro video URL
- Hourly rates per session type

---

## 3. ADMIN LOGIC

### 3.1 Admin Dashboard
The admin dashboard is a tabbed interface with the following sections:

### 3.2 User Management
- **View All Users**: List of all registered users with their roles, email, verification status, and account status.
- **Edit User**: Modify user details, roles, admin status, and account flags.
- **Delete User**: Remove a user account and cascade-delete their sessions, ratings, and profile data.

### 3.3 Trainer Verification
- **Review Documents**: Admin can view uploaded verification documents (ID, certification, insurance) submitted by trainers.
- **Approve/Reject**: Toggle trainer verification status. Verified trainers can accept sessions; unverified trainers cannot.
- **Document Viewer**: Inspect uploaded images/PDFs for each verification step.

### 3.4 Revenue & Analytics
- **Platform Revenue**: Total platform fees collected, total session value processed, average session value, number of completed sessions.
- **Session Breakdown**: Revenue split visualization (trainer earnings vs. platform fees).

### 3.5 Payout Management
- **Pending Payouts**: View all trainers with unpaid balances, including total owed, number of unpaid sessions, and Stripe account status.
- **Pay Individual Trainer**: Process payout for a specific trainer via Stripe Transfer to their connected account.
- **Pay All**: Batch process all pending payouts.
- **Payout History**: Log of all processed payouts with amounts, dates, and Stripe transfer IDs.

### 3.6 Refund Management
- Admin can issue manual refunds for any session with an active Stripe PaymentIntent.
- Refund options: full or partial amount, with a reason field.
- Refund is processed through Stripe and reflected on both the trainee's payment and the session record.

---

## 4. MATCHING ENGINE

### 4.1 Trainer Search & Discovery
The search system uses multiple signals to rank and filter trainers:
1. **Location Proximity**: Haversine formula calculates distance between trainee and trainer. Results can be filtered by maximum distance.
2. **Availability**: Only trainers marked as available and who have completed verification are shown.
3. **Specialties & Training Styles**: Filter by specific training styles (strength, cardio, HIIT, yoga, boxing, crossfit, etc.).
4. **Session Type**: Filter by virtual, outdoor, or in-home session offerings.
5. **Rating**: Sort by average rating and total review count.
6. **Boost Priority**: Trainers with active visibility boosts appear higher in search results.

### 4.2 Virtual Session Auto-Matching
For instant virtual sessions, the matching engine:
1. Queries all trainer profiles where `isAvailable=true`, `isVirtualTrainingAvailable=true`, and `offersVirtual=true`.
2. Sorts by `averageRating` (descending) then `totalSessionsCompleted` (descending) — prioritizing experienced, highly-rated trainers.
3. Selects the top-ranked available trainer.
4. Auto-creates a confirmed session starting immediately (no trainer acceptance needed).
5. Returns the trainer's name, bio, rating, Zoom meeting link, and pricing.

### 4.3 Nearby Trainer Discovery
The system finds nearby trainers using GPS coordinates:
1. Retrieves all trainer profiles with valid latitude/longitude and `isAvailable=true`.
2. Calculates distance from the trainee's current position to each trainer using the Haversine formula.
3. Filters by a configurable radius (default 20 miles).
4. Estimates ETA using average urban driving speed (20 mph + 3-minute buffer; walking distance if < 0.5 miles).
5. Returns trainers sorted by distance with their profile data, distance in miles, and ETA in minutes.

### 4.4 Favorite Trainer Availability
Trainees who have "saved" trainers can view their weekly availability windows, live/available-now status, average rating, and rates — enabling quick rebooking with preferred trainers.

---

## 5. PAYMENT FLOW

### 5.1 Session Payment (Trainee Pays)
1. **Price Calculation**: `(Trainer Rate / 0.80) + $2.00 service fee + travel fee (if in-home)`. Discounts applied: multi-session 5%, membership 10%, referral credits.
2. **Stripe PaymentIntent**: Backend creates a Stripe PaymentIntent with the calculated amount.
3. **Payment Sheet**: Frontend presents the native Stripe Payment Sheet (Apple Pay, Google Pay, or card entry).
4. **Confirmation**: On successful payment, the session is booked and both parties are notified.
5. **Minimum Prices Enforced**: Virtual $15 (30 min), Outdoor $20 (30 min), In-Home $30 (30 min).

### 5.2 Revenue Split
| Component | Recipient | Calculation |
|-----------|-----------|-------------|
| Trainer Rate | Trainer | Their set hourly rate, pro-rated by duration |
| Platform Commission | Platform | 25% of what trainee pays (rate / 0.80 - rate) |
| Service Fee | Platform | Flat $2.00 per session |
| Travel Fee (in-home) | 70% Trainer / 30% Platform | Distance-based: $2/mile for first 5mi, $1.50/mile after |

### 5.3 Trainer Payouts
1. Earnings accumulate in the platform as sessions complete.
2. Trainer requests payout from the Earnings tab.
3. Admin reviews and processes payout via Stripe Transfer to the trainer's connected Stripe account.
4. Payout history is tracked with timestamps and Stripe transfer IDs.

### 5.4 Stripe Connect Onboarding
1. Trainer navigates to "Connect Bank Account."
2. Backend creates a Stripe Connect Express account and generates an onboarding link.
3. Trainer completes Stripe's onboarding flow (identity verification, bank account details) in their browser.
4. On completion, the trainer's Stripe account ID is stored and onboarding status is marked as complete.

### 5.5 Refunds
- **Cancellation refunds**: Automatic, time-based (see cancellation rules above).
- **No-show refunds**: Automatic based on no-show party (trainee no-show = partial; trainer no-show = full).
- **Admin refunds**: Manual refund of any amount with reason, processed via Stripe Refund API.

### 5.6 Membership Payment
- $19.99/month via Stripe PaymentIntent → Payment Sheet → confirm payment → membership activated with 10% discount and 1 free boost.

### 5.7 Boost Payment
- Daily ($4.99), Weekly ($24.99), or Monthly ($79.99) via Stripe PaymentIntent → Payment Sheet → boost activated. Members get 1 free boost per month (no payment needed).

---

## 6. SAFETY FEATURES

### 6.1 Session Safety PIN
- For in-home sessions, a random 4-digit PIN is generated when the session is booked.
- The trainee receives the PIN and must share it verbally with the trainer upon arrival.
- The trainer enters the PIN in the app to verify they are at the correct location with the correct person.
- Session cannot officially start until the PIN is verified.

### 6.2 Selfie Verification
- Before a session starts, both the trainer and trainee must submit a selfie via the app.
- The system tracks both submissions. The session can only begin once both selfies are verified.
- Maximum 3 selfie attempts per person per session. After 3 failures, manual verification is triggered — a support agent reviews the session.
- Selfie data is stored as a thumbnail reference only (privacy-preserving).

### 6.3 GPS Verification
- For in-person sessions, the trainer's GPS coordinates are verified against the session location.
- The system calculates the distance between the trainer's current position and the expected meeting point.
- If the distance exceeds the allowed radius, the GPS confirmation fails and the trainer is prompted to move closer.
- Real-time GPS tracking during en-route provides live location sharing between both parties.

### 6.4 Real-Time Location Tracking
- When a trainer marks a session as "en route," their GPS coordinates are broadcast to the trainee every 5 seconds.
- The trainee sees the trainer's distance, ETA, and movement on a visual progress tracker.
- Speed alerts are generated if the trainer exceeds expected speeds or appears stationary for too long.
- Both parties can message each other during the en-route phase.

### 6.5 User Reporting
- Any user can report another user for safety concerns, inappropriate behavior, or policy violations.
- Reports are stored with the reporter's ID, the reported user's ID, reason, and timestamp.
- Reports are surfaced to the admin for review.

### 6.6 User Blocking
- Any user can block another user, preventing all future interactions (messaging, booking, search visibility).
- Blocks can be removed at any time.
- The blocked user is not notified of the block.

### 6.7 Trainer Performance Strikes
- Trainers receive performance strikes for: late cancellations (≤12h before session) and no-shows.
- **3 strikes** = account flagged for admin review. The trainer's account is marked "under review" with the reason logged.
- Strike history is maintained with session IDs, reasons, and timestamps.

### 6.8 Input Sanitization
- All user-generated text (bios, messages, reviews, notes) is sanitized server-side to prevent script injection and inappropriate content.

---

## 7. GAMIFICATION

### 7.1 Trainer Badges (10 Badges)
| Badge | Requirement | Reward |
|-------|-------------|--------|
| Milestone Master | 25 total completed sessions | 5% service fee discount on next 5 sessions |
| Weekend Warrior | 10 sessions on Saturday or Sunday | Recognition badge |
| Streak Star | 10 sessions/week for 3 consecutive weeks | Recognition badge |
| Early Bird | 10 sessions before 11:59 AM | Recognition badge |
| Night Owl | 10 sessions at or after 6:00 PM | Recognition badge |
| Top Trainer of the Month | Rank #1 in monthly completed sessions | Monthly recognition |
| New Client Champ | Sessions with 10 unique first-time clients | Recognition badge |
| Flexibility Guru | 10 sessions across morning, afternoon, and evening | Recognition badge |
| Feedback Favorite | 10 five-star ratings from clients | Recognition badge |
| Double Duty | 2 back-to-back sessions within 15 minutes | Recognition badge |

Badges are tracked with progress bars showing current progress vs. target. Newly unlocked badges trigger notifications.

### 7.2 Trainee Badges
Trainees have their own achievement system tracking session milestones, consistency, and engagement.

### 7.3 Streaks & Consistency Points
- A **streak** is consecutive weeks with at least 1 completed session (applies to both trainers and trainees).
- **Consistency Points** formula: `(total_sessions × 10) + (streak_weeks × 25) + (total_minutes / 10)`.
- **Streak Levels**:
  - None: 0-1 weeks
  - Warming: 2-3 weeks
  - Fire: 4-7 weeks
  - Blazing: 8-11 weeks
  - Legend: 12+ weeks
- **Milestones**: 2, 4, 8, 12, 26, 52 weeks. The next milestone is always displayed.
- Streaks can be shared via a shareable streak card.

### 7.4 Weekly Leaderboard
- A weekly leaderboard ranks users by consistency points earned during the current week.
- Shows top 20 users with their names, avatars, points, session counts, and streak levels.
- Separate tracking for trainers and trainees.

### 7.5 Referral Program
- Each user gets a unique referral code (format: `RR-XXXXXX`).
- When a referred user signs up with the code and books their first session:
  - **Referrer** earns $5.00 credit.
  - **Referred user** earns $5.00 credit.
- Credits are applied as a discount on the platform fee portion of future sessions (never reduces trainer earnings).
- Maximum 20 referrals per user.
- Referral stats dashboard shows: total referrals, activated referrals, pending referrals, total credits earned, available credits, and history.

---

## 8. RETENTION

### 8.1 Push Notifications
The app uses Expo Push Notifications to keep users engaged. Notification types include:
- **Session Request**: Trainer notified when a trainee requests a booking.
- **Session Confirmed/Declined**: Trainee notified when trainer accepts or declines.
- **Session Cancelled**: Both parties notified with penalty/refund details.
- **Trainer En Route**: Trainee notified when trainer starts heading to them.
- **No-Show**: Both parties notified with financial outcome.
- **Trainer Available Now**: Past trainees notified when their trainer goes live.
- **Referral Activated**: Referrer notified when their referral books their first session.
- **New Message**: Recipient notified of incoming messages.
- **Badge Unlocked**: User notified of new achievement.
- **Session Reminder**: Scheduled reminders before upcoming sessions (via background scheduler).

### 8.2 Notification Preferences
Users can customize notification preferences per category (session updates, marketing, chat messages, etc.) through a dedicated settings screen.

### 8.3 Recurring Sessions
Trainees can set up weekly or biweekly recurring sessions with a preferred trainer. This creates commitment and reduces booking friction. Each session is individually payable.

### 8.4 Saved/Favorite Trainers
Trainees can save trainers to a favorites list. The Saved tab shows:
- All favorited trainers with their availability status.
- Quick access to rebook or message a saved trainer.
- Availability windows for favorite trainers to enable easy scheduling.

### 8.5 Favorite Trainer Availability Alerts
When a saved/favorite trainer goes "Available Now" (live), the trainee receives an immediate push notification, creating urgency and encouraging rebooking.

### 8.6 Streak System (Retention Loop)
The streak system creates a powerful retention loop:
1. User completes a session → streak increments.
2. Streak level rises (Warming → Fire → Blazing → Legend) → user feels accomplishment.
3. User is motivated to maintain streak → books another session.
4. Consistency points accumulate → leaderboard ranking rises → competitive motivation.
5. Shareable streak cards enable social proof and organic user acquisition.

### 8.7 Membership Benefits
The $19.99/month membership creates recurring revenue and retention:
- 10% discount incentivizes more frequent bookings.
- Free monthly boost for trainers drives platform engagement.
- Member badge creates status/identity attachment.

### 8.8 Post-Session Engagement
After each session:
- Session summary with shareable card.
- Rating prompt within 48-hour window.
- Achievement/badge progress update.
- Streak update with visual progress.
- Option to rebook the same trainer.

### 8.9 Referral Flywheel
The referral program creates a growth/retention loop:
1. Existing user shares referral code → acquires new user.
2. New user books first session → both earn $5 credit.
3. Credits incentivize the next session → higher retention.
4. Satisfied users refer more friends → organic growth.

### 8.10 Trainer Retention via Boosts
Visibility boosts create a spend-to-earn dynamic:
1. Trainer purchases boost → appears higher in search → gets more bookings → earns more.
2. This investment creates platform commitment and encourages active engagement.
3. Membership includes a free monthly boost, tying trainer retention to the subscription model.

---

*Document generated for AI evaluation of the RapidReps fitness platform.*
