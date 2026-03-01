# RapidReps — Complete User Manual v3.0

---

## Table of Contents

1. Getting Started
2. Account & Authentication
3. Trainee Guide
4. Trainer Guide
5. Session Workflows
6. Matching Engine — "Need a Trainer Now"
7. GPS Tracking & En-Route
8. Selfie Verification
9. Post-Session Summary & Sharing
10. Messaging
11. Payments & Pricing
12. Membership Program
13. Visibility Boosts (Trainers)
14. Cancellation & No-Show Policies
15. Ratings & Reviews
16. Achievements & Streaks
17. Notifications
18. Safety, Fraud Detection & Reporting
19. Admin Dashboard
20. Account Settings & Sound/Vibration
21. Legal
22. FAQ

---

## 1. Getting Started

RapidReps connects fitness trainees with certified personal trainers for virtual, outdoor, and in-home sessions. Think of it as an Uber-style experience for personal training — open the app, request a trainer, get matched in real time, and start your workout.

**Supported Platforms:** iOS, Android, Web (via Expo)

**Key Roles:**
- **Trainee** — Books and attends training sessions
- **Trainer** — Provides training services, earns income
- **Admin** — Manages the platform, users, and payouts

### Example Trainer Profile

> **Alex T.** — HIIT / Strength / Boxing — 4.9 (284 reviews)
> $40 Outdoor | $60 In-Home | $30 Virtual
> Certified NASM Personal Trainer | 5 years experience
> "I specialize in high-intensity functional training that builds real-world strength."

---

## 2. Account & Authentication

### 2.1 Sign Up

**Screen:** Sign Up

| Field | Required | Notes |
|-------|----------|-------|
| Full Name | Yes | Your display name |
| Email | Yes | Must be unique |
| Password | Yes | Minimum 6 characters |
| Role | Yes | Choose "Trainee" or "Trainer" |
| Profile Photo | No | Upload during or after sign-up |

**Buttons:**
- **Create Account** — Submits registration form
- **Already have an account? Log In** — Navigates to login screen
- **View Terms of Service** — Opens Terms screen
- **View Privacy Policy** — Opens Privacy screen

### 2.2 Log In

**Screen:** Log In

Tagline: *"Time to lock in"*

| Field | Required |
|-------|----------|
| Email | Yes |
| Password | Yes |

**Buttons:**
- **Log In** — Authenticates and routes to trainee or trainer home
- **Forgot Password?** — Opens password reset flow
- **Don't have an account? Sign Up** — Navigates to sign up

### 2.3 Forgot Password / Reset Password

Enter your email to receive a reset code. Then enter the code and your new password.

**Buttons:**
- **Send Reset Code** — Sends reset email
- **Reset Password** — Sets new password
- **Back to Login** — Returns to login screen

---

## 3. Trainee Guide

### 3.1 Home Screen

**Tab:** Home (house icon)

**Header:**
- Greeting with your name
- Notification bell icon (shows unread count)

**"Need a Trainer Now" Section:**
- **Virtual Session** button — Instantly request a virtual trainer (video call)
- **In-Person Now** button — Find a nearby trainer for an in-person session right now

**Sort & Filter Bar:**
- **Sort Options:** Rating, Price (Low to High), Price (High to Low), Distance
- Active sort is highlighted in teal

**Trainer Cards — each shows:**
- Profile photo and full name
- Average rating (stars) and review count
- Training styles (tags)
- Price per session
- Distance (if location enabled)
- **Boosted badge** — Glowing indicator if trainer has an active visibility boost
- **Member badge** — Shown if trainer has a membership

**Buttons on each card:**
- **View Profile** — Opens trainer detail screen
- **Book Session** — Goes to booking flow

**Nearby Trainers Section:**
- Shows trainers within range with distance and ETA
- Scrollable horizontal list

### 3.2 Trainer Detail Screen

**Screen:** Trainer Detail

Shows complete trainer profile:
- Profile photo, name, verification status badge
- Average rating and total reviews
- Bio/description
- Training styles
- Session types offered (Virtual, Outdoor, In-Home)
- Pricing for each session type
- Intro video (if uploaded)
- Reviews from other trainees

**Buttons:**
- **Book Virtual Session** / **Book Outdoor Session** / **Book In-Home Session**
- **Save Trainer** — Saves to your Saved list
- **Message** — Opens direct message conversation
- **Report** — Report this trainer for safety concerns
- **Back** — Returns to home

### 3.3 Saved Trainers

**Tab:** Saved (heart icon)

View your saved/favorited trainers.

**Buttons:** Unsave, Book, View Profile

### 3.4 Sessions Tab

**Tab:** Sessions (calendar icon)

Sessions organized by status: Upcoming, In Progress, Completed, Cancelled.

Each session card shows trainer name/photo, date/time, session type, status badge, price.

**Buttons per session:**
- **View Details** — Full session info
- **Cancel** — Cancel the session (penalties may apply — see Section 14)
- **Rate** — Leave a rating (completed sessions only)
- **View Summary** — See post-session stats (completed only)
- **Mark No-Show** — Report trainer no-show (if applicable)

### 3.5 Profile Tab

**Tab:** Profile (person icon)

**Buttons & Options:**
- **Edit Profile** — Update name, photo, bio
- **Membership** — View/manage membership (see Section 12)
- **Achievements** — View earned badges
- **Notification Preferences** — Customize notifications
- **Sound & Vibration Settings** — Toggle sounds, vibration, ringtone, mute-during-session (see Section 20.4)
- **Privacy Policy** / **Terms of Service**
- **Log Out** — Signs out
- **Delete Account** — Permanently deletes your account (confirmation required)

### 3.6 Membership Screen

See Section 12 for full details.

---

## 4. Trainer Guide

### 4.1 Home Screen

**Tab:** Home (house icon)

- **Availability Toggle** — Switch between Available/Unavailable
- **Today's Sessions** — List of upcoming sessions for today
- **Pending Requests** — Session requests awaiting your response
- **Quick Stats** — Today's earnings, sessions completed, rating

**Buttons:**
- **Toggle Availability** — Turn on/off your availability for matching
- **Accept** / **Decline** — Respond to pending session requests

### 4.2 Sessions Tab

Same layout as trainee but with trainer actions:
- **Start En Route** — Mark yourself heading to session (enables GPS tracking)
- **Confirm GPS Arrival** — Verify you're at the session location
- **Start Session** — Begin the session (In Progress)
- **End Session** — Complete the session (triggers summary)
- **Cancel** / **Mark No-Show** — Cancel or report trainee no-show

### 4.3 Earnings Tab

**Tab:** Earnings (dollar icon)

- **Total Earnings** — Lifetime earnings
- **This Month** — Current month total
- **Pending Payout** — Amount ready to withdraw
- **Recent Transactions** — List of recent session payments

**Buttons:** Request Payout, View All Transactions

### 4.4 Profile Tab

**Buttons & Options:**
- **Edit Profile** — Update bio, training styles, pricing, photos
- **Upload Intro Video** — Record/upload a 30-60 second intro video
- **Verification** — Complete or check verification status
- **Visibility Boosts** — Purchase boosts (see Section 13)
- **Achievements** / **Notification Preferences** / **Sound & Vibration Settings**
- **Log Out** / **Delete Account**

### 4.5 Edit Profile Screen

| Field | Notes |
|-------|-------|
| Full Name | Display name |
| Bio | Short description (max 500 chars) |
| Training Styles | Multi-select: HIIT, Strength, Cardio, Yoga, Pilates, Boxing, etc. |
| Virtual Rate | Price per virtual session (min $30) |
| Outdoor Rate | Price per outdoor session (min $40) |
| In-Home Rate | Price per in-home session (min $60) |
| Offers Virtual / Offers In-Person | Toggle on/off |
| Profile Photo | Upload/change photo |

### 4.6 Verification Screen

Complete your trainer verification:
1. **Personal Information** — Full name, date of birth, address
2. **Certification Upload** — Upload personal training certification
3. **ID Verification** — Upload government-issued ID
4. **Background Check Consent** — Agree to background check

### 4.7 Trainer — Virtual Request Screen

When you receive an instant request:
- Trainee name, session type, and details shown
- Countdown timer for response
- **Accept** — Accept the session (first-accept-wins, no double-booking)
- **Decline** — Decline and system finds another trainer
- Timer expires — Auto-decline

---

## 5. Session Workflows

### 5.1 Scheduled Session Booking

1. **Find Trainer** — Browse trainers on Home tab
2. **View Profile** — Tap a trainer card
3. **Select Session Type** — Virtual, Outdoor, or In-Home
4. **Schedule** — Pick date and time
5. **Confirm Booking** — Review price breakdown
6. **Payment** — Complete Stripe payment
7. **Trainer Responds** — Accepts or declines
8. **Session Confirmed** — Both receive notification

**Price Breakdown on Confirm Screen:**
- Base session rate
- Travel fee (in-home only, based on distance)
- Multi-session discount (5% on 3rd+ session with same trainer)
- Membership discount (10% if subscribed)
- Platform fee (25%)
- Trainer earnings (75%)

### 5.2 Session Flow (In-Person)

1. **Confirmed** — Both parties agreed
2. **Selfie Verification** — Both submit attendance selfie (see Section 8)
3. **Trainer En Route** — Trainer taps "Start En Route" (GPS tracking begins, 5-second updates)
4. **GPS Arrival** — Trainer confirms GPS proximity (within 0.25 miles outdoor, 0.1 miles at-home)
5. **In Progress** — Session starts (GPS switches to 15-second updates)
6. **End Session** — Trainer ends session (GPS stops immediately)
7. **Summary Generated** — Post-session stats available (see Section 9)
8. **Rate & Review** — Trainee rates the trainer

### 5.3 Session Flow (Virtual)

1. **Confirmed** — Both parties agreed
2. **Join Video** — Both join the virtual session room
3. **In Progress** — Session active

**Virtual Session Duration Rules:**
- **Default duration:** 30 minutes (selectable: 30 or 60 minutes at booking)
- **Maximum duration:** 90 minutes
- **Grace period:** 2 minutes after scheduled end for wrap-up
- **Auto-end:** If the session exceeds maximum duration + grace period, the system automatically ends it and generates a summary
- Trainer can manually end the session at any time via the **End Session** button

4. **End Session** — Trainer ends session (or auto-end after max duration)
5. **Summary Generated** — Stats available
6. **Rate & Review** — Trainee rates

---

## 6. Matching Engine — "Need a Trainer Now"

### 6.1 Location Permission Flow (Required)

Before using "Need a Trainer Now," the app requires GPS permission:

**Step 1 — Pre-Permission Screen:**
> "RapidReps needs your location to match you with nearby trainers."

**Step 2 — OS System Permission Prompt:**
- iOS: "Allow While Using App" / "Allow Once" / "Don't Allow"
- Android: "Allow" / "Deny"

**Step 3 — If Permission Denied (Soft Decline):**
> "Location access is needed for in-person and instant sessions. You can enable it in Settings."
- In-person features remain disabled until permission is granted
- Virtual sessions remain available without GPS

**Step 4 — If Permission Denied Again (Hard Decline):**
- All in-person matching features disabled
- "In-Person Now" button shows: "Enable Location in Settings to use this feature"
- Virtual sessions still available

**Note:** Without location permission, Apple/Google will reject in-person matching features. This flow is required for App Store compliance.

### 6.2 Virtual Instant Session

**Button:** "Virtual Session" on Home screen

1. Tap **Virtual Session** button
2. **Searching screen** appears with:
   - Radar animation
   - Elapsed time counter
   - "Finding your perfect trainer..." text
   - **Cancel** button
3. The matching engine scores available trainers using:

| Factor | Weight | Description |
|--------|--------|-------------|
| **ETA** | **40%** | **Primary factor.** Estimated time to arrive (even for virtual, measures responsiveness) |
| Rating | 25% | Average star rating from reviews |
| Price | 15% | Price competitiveness relative to session type |
| Boost | 10% | Active visibility boost bonus |
| Responsiveness | 5% | Historical acceptance speed |
| Profile Completeness | 5% | Bio, photo, certifications filled out |

4. Top 5 trainers notified simultaneously
5. **First trainer to accept wins** (atomic — no double-booking possible)
6. On match:
   - **Boxing-bell sound** plays
   - Trainer details appear (name, rating, price, photo)
   - **"Trainer Found!"** notification sent
7. If no match within 3 minutes:
   - Progressive wave expansion (additional trainers notified)
   - After all waves exhausted: **"No trainers found"** fallback with retry option

**Buttons on searching screen:**
- **Cancel Search** — Cancels the request and returns home

**Buttons on matched screen:**
- **Start Session** — Begin the virtual session
- **Find Another** — Reject this match and search again (see Section 6.4)

### 6.3 In-Person Instant Session

**Button:** "In-Person Now" on Home screen

Same flow as virtual but with location-based ETA matching:

**Wave Logic:**

| Wave | ETA Limit | Trainers Notified | Trigger |
|------|-----------|-------------------|---------|
| Wave 1 | 5 min or less | Top 3 by score | Immediate |
| Wave 2 | 10 min or less | Top 3 by score | If Wave 1 has < 2 matches |
| Wave 3 | 15 min or less | Top 5 by score | If Wave 2 has < 1 match |

**Hard Maximum ETA Cap: 15 minutes.** No trainer outside 15 min ETA can ever be matched. Matching stops after Wave 3. This prevents far-away trainers being selected in low-supply areas.

### 6.4 "Find Another" Trainer Logic

When you tap **"Find Another"** after being matched:

1. The previously matched trainer is **excluded for 10 minutes** (cooldown)
2. A new wave of scoring runs using the same ETA/rating/price rules
3. All previously rejected trainers are excluded from the new search
4. If all waves are exhausted and no trainers remain:
   - Status changes to "exhausted"
   - Fallback screen: "All available trainers have been contacted. Please try again later or adjust your preferences."
5. This prevents infinite loops and rematching the same trainer

### 6.5 Membership Priority

Members receive a **+0.15 score bonus** in the matching engine. This means members are matched with higher-rated, closer trainers faster than non-members.

---

## 7. GPS Tracking & En-Route

### 7.1 Starting En Route

For in-person sessions, the trainer taps **"Start En Route"** to activate GPS tracking.

**Update frequency:**
- En route: GPS refreshes every **5 seconds**
- In progress: GPS refreshes every **15 seconds**
- GPS stops **immediately** on session end or cancellation

### 7.2 Live Tracking View

Both parties can see:
- Trainer's live location on map
- Trainee's location
- Distance between parties (in miles)
- Estimated time of arrival

### 7.3 GPS Alerts

| Alert | Trigger | Message |
|-------|---------|---------|
| Weak Signal | GPS accuracy > 50 meters | "Weak GPS signal — confirm location manually" |
| Stale Movement | Trainer stationary 2+ min while en route | "You appear to be stationary. Are you on the way?" |
| Distance Warning | Parties > 0.5 miles apart during active session | "You are X miles from the other party" |
| Address Mismatch | Parties > 0.25 miles apart at session start | "You and the other party appear to be at different locations" |
| GPS Spoofing | Location jump > 2 miles in < 30 seconds | "Unusual location change detected. GPS may be inaccurate." (account flagged) |

### 7.4 Arrival Confirmation

Trainer must tap **"Confirm Arrival"** to verify GPS proximity:
- **Outdoor/Gym sessions:** Must be within **0.25 miles (400m)**
- **At-home sessions:** Must be within **0.1 miles (160m)**

If too far: *"You are X miles away. Must be within Y miles to start."*

### 7.5 Arrival Time Measurement

**Official arrival time begins when:**
- The trainer taps "Start En Route," **OR**
- **5 minutes before the scheduled session start time** — whichever happens first.

This prevents users from skipping "Confirm Arrival" to avoid no-show penalties. If neither party has started the session within 10 minutes of the scheduled start time, the system triggers automated no-show alerts (see Section 14).

### 7.6 Privacy

GPS is **ONLY active during:**
- En route to session
- Active session
- Arrival verification

GPS is **NOT active** when the app is idle or outside a session.

---

## 8. Selfie Verification

Before an in-person session begins, both parties must submit a selfie to verify attendance.

### 8.1 Flow

1. Session status changes to Confirmed or En Route
2. Both trainer and trainee take and submit a selfie
3. Each person sees the other's verification status
4. Once both selfies are submitted: "Both verified — session can start!"

### 8.2 Buttons

- **Take Selfie** — Opens camera
- **Submit Selfie** — Uploads selfie for verification
- **Retake** — Take a new selfie
- **Switch Camera** — Toggle front/rear camera

### 8.3 Failure Handling

| Scenario | System Response |
|----------|----------------|
| Camera fails to open | "Try again or switch cameras" with retry button |
| Upload fails (network error) | "Upload failed. Tap to try again." with retry button |
| Poor lighting detected | "Move to a brighter area for a clearer photo" |
| One user refuses selfie | Session **cannot begin** until both selfies are submitted |
| Selfie fails 3 times | **Manual verification fallback** initiated — a support agent reviews the session. Message: "Selfie verification failed multiple times. Manual verification initiated." |

### 8.4 Requirements

- Selfie must be a valid image (minimum 100 bytes)
- Maximum file size: 5MB
- Only session participants can submit selfies

---

## 9. Post-Session Summary & Sharing

After every completed session, a summary is automatically generated.

### 9.1 Summary Contents

| Field | Description |
|-------|-------------|
| Trainer Name | Who trained you |
| Workout Type | Based on trainer's specializations (e.g., "strength, hiit, cardio") |
| Duration | Actual session time in minutes |
| Calories Burned | Estimated by workout type and duration (see chart below) |
| Weekly Streak | Consecutive weeks with at least 1 session |
| Sessions with Trainer | Total completed sessions with this trainer |

### 9.2 Calorie Estimation

| Workout Type | Calories/Hour |
|--------------|---------------|
| HIIT | 650 |
| CrossFit | 600 |
| Boxing | 580 |
| Kickboxing | 570 |
| Running | 550 |
| Martial Arts | 550 |
| Circuit Training | 500 |
| Cardio | 500 |
| Cycling | 480 |
| Swimming | 450 |
| Zumba | 450 |
| Dance | 400 |
| Strength Training | 420 |
| Weightlifting | 400 |
| Bodybuilding | 400 |
| Functional Training | 380 |
| Pilates | 280 |
| Yoga | 250 |
| Prenatal | 220 |
| Senior Fitness | 200 |
| Rehabilitation | 200 |
| Stretching | 180 |

*For trainers with multiple styles, the average calories/hour is used.*

### 9.3 Sharing

**Share Text Example:**
> "Just crushed a 45-min strength, hiit, cardio session with Alex Trainer! 392 cal burned. 3-week streak!"

**Options:**
- **Share as Card** — Generates a styled share card with your stats (screenshot-friendly)
- **Copy Deep Link** — rapidreps://session-summary/{sessionId} opens the summary in the app
- **View All Summaries** — See complete history with totals (total sessions, total calories, total minutes)

---

## 10. Messaging

### 10.1 Conversations List

**Tab:** Messages (chat bubble icon)

Shows all conversations sorted by most recent message. Each shows name, photo, last message preview, timestamp, unread count.

### 10.2 Chat Screen

Real-time messaging between trainee and trainer.

**Buttons:** Send, Back

---

## 11. Payments & Pricing

### 11.1 Session Pricing

All payments are processed through **Stripe**.

**Minimum Session Rates:**

| Session Type | Minimum Price |
|--------------|---------------|
| Virtual | $30.00 |
| Outdoor | $40.00 |
| In-Home (at trainer's location) | $60.00 |
| Home Visit (at trainee's location) | $60.00 |

**Revenue Split:**
- **Trainer:** 75% of session price
- **Platform (RapidReps):** 25% of session price

### 11.2 Travel Fees (In-Home Sessions)

- $0.50 per mile (over 2 miles)
- Minimum: $0 | Maximum: $15
- Trainer receives 70% of travel fee | Platform receives 30%

### 11.3 Discounts

| Discount | Amount | Condition |
|----------|--------|-----------|
| Multi-Session | 5% off base rate | 3rd+ session with same trainer |
| Membership | 10% off base rate | Active membership ($19.99/month) |

*Discounts stack. A member on their 3rd session gets 15% off.*

### 11.4 Payment Flow

1. Confirm booking and review price breakdown
2. Pay with Stripe (card or saved payment method)
3. Payment held in escrow until session completes
4. After session ends: Trainer receives 75%, Platform retains 25%

---

## 12. Membership Program

**Price:** $19.99/month

### 12.1 Benefits

| Benefit | Details |
|---------|---------|
| Session Discount | 10% off every session (auto-applied at checkout) |
| Free Monthly Boost | 1 free profile visibility boost per month |
| Priority Matching | +0.15 score bonus in matching engine |
| Early Access | First access to newly verified elite trainers |
| Member Badge | Exclusive badge on your profile |

### 12.2 Subscribe

1. Navigate to Profile > Membership
2. Review benefits and pricing
3. Tap **Subscribe Now**
4. Complete Stripe payment ($19.99)
5. Membership activates immediately

### 12.3 Cancel

1. Navigate to Profile > Membership
2. Tap **Cancel Membership**
3. Membership remains active until end of current billing period
4. No pro-rated refunds

### 12.4 Membership Perk Rules

| Question | Answer |
|----------|--------|
| Does 10% discount apply to sessions already booked before joining? | **No.** The discount applies only to sessions booked **after** membership activation. |
| If membership expires mid-booking, does the discount stay? | **Yes.** Sessions booked while membership was active preserve the discounted rate, even if the membership expires before the session date. |
| Do active boosts continue when membership expires? | **Yes.** Any boost already activated (including free monthly boost) runs until its own expiry date, regardless of membership status. |
| When does the free monthly boost reset? | On each monthly billing renewal date. Unused free boosts do not carry over. |

---

## 13. Visibility Boosts (Trainers)

Boosts increase your visibility in search results and the matching engine.

### 13.1 Boost Pricing

| Duration | Price |
|----------|-------|
| 1 Day | $9.99 |
| 1 Week | $49.99 |
| 1 Month | $149.99 |

### 13.2 Boost Effects

- **Profile Glow** — Your profile card shows a visual glow indicator
- **isBoosted Badge** — Visible to trainees searching for trainers
- **Higher Matching Score** — 10% weight in the matching engine scoring
- **Priority Placement** — Appear higher in search results

### 13.3 Boost Analytics

Navigate to Profile > Boosts > Analytics to see:

| Metric | Description |
|--------|-------------|
| Impressions | Times your profile appeared in search results |
| Profile Views | Times trainees viewed your full profile |
| Clicks | Times trainees interacted with your profile |
| Click-Through Rate | Clicks / Impressions (percentage) |
| Daily Breakdown | Day-by-day performance for last 30 days |

**Time Zone:** All analytics timestamps use the trainer's **local device time zone**. Daily breakdowns are calculated in your local time.

### 13.4 Free Boost (Members)

Members receive **1 free boost per month** (equivalent to a 1-day boost). Resets on billing renewal. Unused free boosts do not carry over.

---

## 14. Cancellation & No-Show Policies

### 14.1 Trainee Cancellation

| Time Before Session | Penalty |
|---------------------|---------|
| More than 12 hours | $0 (free cancellation) |
| 12 to 2 hours | 25% of session price |
| Less than 2 hours | 50% of session price |

- Penalty amount split: Trainer receives 75%, Platform receives 25%
- Remaining amount is refunded via Stripe automatically

### 14.2 Trainer Cancellation

| Time Before Session | Consequence |
|---------------------|-------------|
| More than 12 hours | No penalty, full refund to trainee |
| 12 hours or less | Full refund + free virtual session credit to trainee. Trainer receives **performance strike** |

### 14.3 Trainee No-Show

- **Definition:** Trainee does not appear within **10 minutes** of session start time
- **Arrival window begins when:** the trainer taps "Start En Route" **OR** 5 minutes before scheduled start — whichever happens first
- **Trainer receives:** 50% of session price (platform keeps 25% of that 50%)
- **Trainee charged:** 50% of session price (remaining 50% refunded)

### 14.4 Trainer No-Show

- **Definition:** Trainer does not appear or start session within **10 minutes**
- **Trainee receives:** 100% full refund
- **Trainer receives:** $0
- **Trainer penalty:** Performance strike

### 14.5 Performance Strikes (Trainers)

| Strikes | Consequence |
|---------|-------------|
| 1-2 | Warning notification |
| 3+ | Account flagged for review (may be suspended) |

Strikes are issued for: late cancellation (within 12 hours) and no-shows.

### 14.6 Automated No-Show Detection

The system automatically detects potential no-shows:
- 10 minutes after scheduled start, if the trainer has not confirmed GPS arrival, both parties are notified
- Trainee receives: "Your trainer has not arrived. You can mark this as a no-show."
- Trainer receives: "You haven't confirmed arrival. Please update your trainee."

---

## 15. Ratings & Reviews

### 15.1 Rating a Trainer

After a completed session:

| Field | Required | Notes |
|-------|----------|-------|
| Star Rating | Yes | 1-5 stars |
| Written Review | No | Optional text feedback |

### 15.2 Rating Prompt

A "Rate Your Session" notification is sent **30 minutes** after session ends if no rating submitted.

---

## 16. Achievements & Streaks

### 16.1 Trainee Achievements

- **First Session** / **5 Sessions** / **10 Sessions** / **25 Sessions** / **50 Sessions** / **100 Sessions**

### 16.2 Streak Tracking

- Streaks count consecutive **weeks** with at least 1 completed session
- Appears in your profile and session summaries
- **Reminder:** "Don't Lose Your Streak!" sent after 6 days without a session

---

## 17. Notifications

### 17.1 Notification Types

| Type | Description |
|------|-------------|
| Session Requested | New booking request received |
| Session Accepted | Trainer accepted your booking |
| Session Declined | Trainer declined your booking |
| Session Reminder | 30 minutes before session starts |
| Session Started | Session is now in progress |
| Session Ended | Session completed |
| Session Auto-Ended | Virtual session auto-ended at max duration |
| Virtual Request | Instant matching — trainer needed now |
| Virtual Matched | You've been matched with a trainer |
| Virtual Taken | Another trainer already accepted |
| Missed Acceptance | Session still available — accept now |
| Late Warning | Trainer/trainee running late |
| Rate Reminder | Rate your recent session |
| Streak Warning | Don't lose your training streak |
| Boost Expiring | Your visibility boost expires in 24 hours |
| Payment Released | Earnings deposited |
| New Message | New chat message received |
| Trainer On The Way | GPS tracking — trainer heading to you |
| Selfie Verified | Other party submitted attendance selfie |
| Summary Ready | Post-session stats available |

### 17.2 Notification Preferences

Navigate to Profile > Notification Preferences to toggle individual types on/off.

**Master Toggle:** Push Enabled (on/off for all notifications)

---

## 18. Safety, Fraud Detection & Reporting

### 18.1 Automated Safety Protections

RapidReps includes automated systems to protect all users:

| Protection | How It Works |
|------------|--------------|
| **GPS Spoofing Detection** | If a user's GPS location jumps > 2 miles in < 30 seconds, the system flags the account for review and shows a warning |
| **Trolling Detection** | If a trainee creates 3+ cancelled/fake virtual requests within 1 hour, the account is flagged for fraud review |
| **High Cancellation Rate** | Trainers with a cancellation + no-show rate above 50% (on 5+ sessions) are automatically flagged for account review |
| **Suspicious Behavior Patterns** | Repeated rapid requests, mass cancellations, and unusual booking patterns trigger automated alerts |

### 18.2 Report a User

**Button:** Report (available on any user profile)

Report reasons: Inappropriate behavior, Harassment, Fraud/scam, Safety concern, Other.

### 18.3 Block a User

**Button:** Block User (on profile or in chat)

Blocked users cannot message you, see your profile, or book sessions with you.

**Unblock:** Navigate to Profile > Blocked Users.

---

## 19. Admin Dashboard

**Access:** Login as admin

### 19.1 Dashboard Overview

- Total Users, Total Sessions, Total Revenue, Active Trainers
- Session distribution (donut chart), Revenue over time (bar chart)

### 19.2 User Management

- View All Users (search + filter), User Detail, Delete User, Send Message

### 19.3 Trainer Management

- Pending Verifications, Verify/Reject Trainer

### 19.4 Financial Management

- Revenue Dashboard, Payout Requests, Process Payout, Issue Refund, Transaction History

### 19.5 Top Trainer Leaderboard

Real-time leaderboard: sessions completed this week, average rating, total earnings.

### 19.6 Fraud & Safety Review

- View flagged accounts (GPS spoofing, trolling, high cancel rate)
- Review and take action (warn, suspend, ban)

---

## 20. Account Settings & Sound/Vibration

### 20.1 Edit Profile

Update your name, photo, bio, and preferences.

### 20.2 Change Password

Via Forgot Password flow from the login screen.

### 20.3 Notification Preferences

Toggle individual notification types on/off.

### 20.4 Sound & Vibration Settings

| Setting | Options | Default |
|---------|---------|---------|
| Button Tap Sounds | On / Off | On |
| Vibration Feedback | On / Off | On |
| Notification Ringtone | Default / Soft / Silent | Default |
| Mute All During Session | On / Off | Off (when enabled, all sounds and vibrations are silenced during an active session) |

### 20.5 Delete Account

**Button:** Delete Account (bottom of Profile screen)
- Confirmation dialog appears
- All data permanently deleted
- Cannot be undone

---

## 21. Legal

- **Terms of Service** — Available at Profile > Terms of Service
- **Privacy Policy** — Available at Profile > Privacy Policy

---

## 22. FAQ

**Q: How quickly will I be matched with a trainer?**
A: The instant matching engine typically finds a trainer within 1-3 minutes. Members get priority matching for faster results.

**Q: What happens if no trainer is available?**
A: The system progressively expands the search in 3 waves (5 min, 10 min, 15 min ETA). After all waves are exhausted, you'll see "All available trainers have been contacted" with a retry option.

**Q: Is there a maximum distance for in-person matching?**
A: Yes. The hard maximum ETA is 15 minutes. No trainer outside 15 min ETA will be matched, even in low-supply areas.

**Q: Can two trainers accept the same request?**
A: No. The system uses atomic first-accept-wins logic — only the first trainer to accept gets the session.

**Q: What happens when I tap "Find Another"?**
A: The matched trainer is excluded for 10 minutes. A new wave of scoring runs. If all trainers have been contacted, a fallback screen appears.

**Q: How is my location used?**
A: GPS is only active during en-route and active sessions. It is never tracked when the app is idle.

**Q: What if my trainer doesn't show up?**
A: You'll receive a full 100% refund. The trainer receives a performance strike. After 3 strikes, their account is reviewed.

**Q: Can I cancel for free?**
A: Yes, if you cancel more than 12 hours before the session.

**Q: How long are virtual sessions?**
A: Default is 30 minutes (selectable: 30 or 60 minutes). Maximum is 90 minutes with a 2-minute grace period for wrap-up. Sessions auto-end after the maximum.

**Q: What if my selfie keeps failing?**
A: After 3 failed attempts, the system initiates manual verification. A support agent will review your session.

**Q: How are calories calculated?**
A: Based on your trainer's specializations and session duration using established exercise science averages.

**Q: What does a membership include?**
A: 10% off all new sessions, priority matching, 1 free boost/month, member badge. $19.99/month.

**Q: Does the 10% membership discount apply to sessions I already booked?**
A: No. The discount only applies to sessions booked after membership activation. Sessions booked while active keep the rate even if membership later expires.

**Q: How do boosts work?**
A: Boosts increase your visibility in search results and matching. Track impressions, views, and clicks in your analytics dashboard.

**Q: How do I get paid as a trainer?**
A: You earn 75% of each session. Request a payout from your Earnings tab — processed via Stripe.

**Q: What prevents GPS spoofing?**
A: The system detects impossible location jumps (>2 miles in <30 seconds) and flags the account for review.

---

*RapidReps — Train smarter. Match faster. Get results.*

*Manual Version: 3.0 | Last Updated: March 2026*
