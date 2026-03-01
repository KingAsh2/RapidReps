# RapidReps — Complete User Manual

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
18. Safety & Reporting
19. Admin Dashboard
20. Account Settings
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

---

## 2. Account & Authentication

### 2.1 Sign Up

**Screen:** `Sign Up`

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

**Screen:** `Log In`

Tagline: *"Time to lock in"*

| Field | Required |
|-------|----------|
| Email | Yes |
| Password | Yes |

**Buttons:**
- **Log In** — Authenticates and routes to trainee or trainer home
- **Forgot Password?** — Opens password reset flow
- **Don't have an account? Sign Up** — Navigates to sign up

### 2.3 Forgot Password

**Screen:** `Forgot Password`

Enter your email address. If the account exists, a password reset code is sent.

**Buttons:**
- **Send Reset Code** — Sends reset email
- **Back to Login** — Returns to login screen

### 2.4 Reset Password

Enter the reset code received via email and your new password.

**Buttons:**
- **Reset Password** — Sets new password and returns to login

---

## 3. Trainee Guide

### 3.1 Home Screen

**Tab:** Home (house icon)

The trainee home screen is the main hub for finding trainers and starting sessions.

**Sections:**

**Header:**
- Greeting with your name
- Notification bell icon (shows unread count)

**"Need a Trainer Now" Section:**
- **Virtual Session** button — Instantly request a virtual trainer (video call)
- **In-Person Now** button — Find a nearby trainer for an in-person session right now

**Sort & Filter Bar:**
- **Sort Options:** Rating, Price (Low to High), Price (High to Low), Distance
- Active sort is highlighted in teal

**Trainer Cards:**
Each trainer card shows:
- Profile photo
- Full name
- Average rating (stars)
- Training styles (tags)
- Price per session
- Distance (if location enabled)
- **Boosted badge** — Glowing indicator if trainer has an active boost
- **Member badge** — Shown if trainer has a membership

**Buttons on each card:**
- **View Profile** — Opens trainer detail screen
- **Book Session** — Goes to booking flow

**Nearby Trainers Section:**
- Shows trainers within range with distance and ETA
- Scrollable horizontal list

### 3.2 Trainer Detail Screen

**Screen:** `Trainer Detail`

Shows complete trainer profile:
- Profile photo & name
- Verification status badge
- Average rating & total reviews
- Bio/description
- Training styles
- Session types offered (Virtual, Outdoor, In-Home)
- Pricing for each session type
- Intro video (if uploaded)
- Reviews from other trainees

**Buttons:**
- **Book Virtual Session** — Start virtual booking flow
- **Book Outdoor Session** — Start outdoor booking flow
- **Book In-Home Session** — Start in-home booking flow
- **Save Trainer** — Saves to your Saved list
- **Message** — Opens direct message conversation
- **Report** — Report this trainer for safety concerns
- **Back** — Returns to home

### 3.3 Saved Trainers

**Tab:** Saved (heart icon)

View your saved/favorited trainers. Each card shows the trainer's name, rating, and a quick Book button.

**Buttons:**
- **Unsave** — Remove from saved list
- **Book** — Go to booking flow
- **View Profile** — Open trainer detail

### 3.4 Sessions Tab

**Tab:** Sessions (calendar icon)

View all your sessions organized by status:
- **Upcoming** — Confirmed sessions not yet started
- **In Progress** — Currently active sessions
- **Completed** — Past sessions
- **Cancelled** — Cancelled sessions

Each session card shows:
- Trainer name & photo
- Date & time
- Session type
- Status badge (Confirmed, En Route, In Progress, Completed, Cancelled, No-Show)
- Price paid

**Buttons per session:**
- **View Details** — Full session info
- **Cancel** — Cancel the session (penalties may apply — see Section 14)
- **Rate** — Leave a rating (completed sessions only)
- **View Summary** — See your post-session stats (completed only)
- **Mark No-Show** — Report trainer no-show (if applicable)

### 3.5 Profile Tab

**Tab:** Profile (person icon)

View and edit your personal profile.

**Sections:**
- Profile photo, name, email
- Session count & streak
- Membership status

**Buttons & Options:**
- **Edit Profile** — Update name, photo, bio
- **Membership** — View/manage membership
- **Achievements** — View earned badges
- **Notification Preferences** — Customize notifications
- **Sound Effects** — Toggle button tap sounds on/off
- **Privacy Policy** — View privacy policy
- **Terms of Service** — View terms
- **Log Out** — Signs out of the app
- **Delete Account** — Permanently deletes your account (confirmation required)

### 3.6 Membership Screen

**Screen:** `Membership`

**Monthly Price:** $19.99/month

**Benefits:**
- 10% off all sessions (auto-applied at checkout)
- 1 free profile Boost per month
- Priority matching (faster trainer response, +0.15 score bonus)
- Early access to elite trainers

**Buttons:**
- **Subscribe Now** — Starts Stripe payment flow
- **Cancel Membership** — Cancels at end of billing period
- **Back** — Returns to profile

### 3.7 Achievements Screen

**Screen:** `Achievements`

View earned badges and progress:
- Session milestones (5, 10, 25, 50, 100 sessions)
- Streak badges (2-week, 4-week, 12-week streaks)
- Rating badges
- Special event badges

### 3.8 Leaderboard

**Screen:** `Leaderboard`

Weekly leaderboard showing top trainees by session count.

---

## 4. Trainer Guide

### 4.1 Home Screen

**Tab:** Home (house icon)

The trainer home screen shows your daily overview.

**Sections:**
- **Availability Toggle** — Switch between Available/Unavailable
- **Today's Sessions** — List of upcoming sessions for today
- **Pending Requests** — Session requests awaiting your response
- **Quick Stats** — Today's earnings, sessions completed, rating

**Buttons:**
- **Toggle Availability** — Turn on/off your availability for matching
- **Accept** — Accept a pending session request
- **Decline** — Decline a pending session request

### 4.2 Sessions Tab

**Tab:** Sessions (calendar icon)

All sessions organized by status (same as trainee view but from trainer perspective).

**Buttons per session:**
- **Start En Route** — Mark yourself as heading to session location (enables GPS tracking)
- **Start Session** — Begin the session (changes status to In Progress)
- **End Session** — Complete the session (triggers summary generation)
- **Confirm GPS** — Verify your arrival at session location
- **View Details** — Full session info
- **Cancel** — Cancel (penalties may apply)
- **Mark No-Show** — Report trainee didn't show up

### 4.3 Earnings Tab

**Tab:** Earnings (dollar icon)

Track your income:
- **Total Earnings** — Lifetime earnings
- **This Month** — Current month total
- **Pending Payout** — Amount ready to withdraw
- **Recent Transactions** — List of recent session payments

**Buttons:**
- **Request Payout** — Request transfer to your bank account
- **View All Transactions** — See complete earnings history

### 4.4 Messages Tab

**Tab:** Messages (chat icon)

Same as trainee messaging (see Section 10).

### 4.5 Profile Tab

**Tab:** Profile (person icon)

**Sections:**
- Profile photo, name, verification status
- Rating & review count
- Session count
- Training styles
- Pricing

**Buttons & Options:**
- **Edit Profile** — Update bio, training styles, pricing, photos
- **Upload Intro Video** — Record/upload a 30-60 second intro video
- **Verification** — Complete or check verification status
- **Visibility Boosts** — Purchase boosts (see Section 13)
- **Achievements** — View earned badges
- **Notification Preferences** — Customize notifications
- **Sound Effects** — Toggle sounds
- **Log Out** — Sign out
- **Delete Account** — Permanently delete (confirmation required)

### 4.6 Edit Profile Screen

**Screen:** `Edit Profile`

| Field | Notes |
|-------|-------|
| Full Name | Display name |
| Bio | Short description (max 500 chars) |
| Training Styles | Multi-select: HIIT, Strength, Cardio, Yoga, Pilates, Boxing, etc. |
| Virtual Rate | Price per virtual session (min $30) |
| Outdoor Rate | Price per outdoor session (min $40) |
| In-Home Rate | Price per in-home session (min $60) |
| Offers Virtual | Toggle on/off |
| Offers In-Person | Toggle on/off |
| Profile Photo | Upload/change photo |

**Buttons:**
- **Save Changes** — Updates profile
- **Cancel** — Discards changes

### 4.7 Verification Screen

**Screen:** `Verification`

Complete your trainer verification to accept sessions:

**Steps:**
1. **Personal Information** — Full name, date of birth, address
2. **Certification Upload** — Upload personal training certification (base64 image)
3. **ID Verification** — Upload government-issued ID
4. **Background Check Consent** — Agree to background check

**Buttons per step:**
- **Submit** — Submit this verification step
- **Submit All** — Submit all steps at once
- **Back** — Return to previous step

### 4.8 Upload Intro Video

**Screen:** `Upload Video`

Record or upload a 30-60 second video introducing yourself to potential trainees.

**Buttons:**
- **Choose Video** — Select from device gallery
- **Upload** — Upload the selected video
- **Cancel** — Return without uploading

### 4.9 Trainer — Virtual Request Screen

**Screen:** `Virtual Request` (push notification route)

When you receive a virtual or in-person instant request:
- Shows trainee name and session type
- Countdown timer for response
- Session details (type, location if in-person)

**Buttons:**
- **Accept** — Accept the session (first-accept-wins)
- **Decline** — Decline and notify system to find another trainer
- **Timer expires** — Auto-decline after timeout

---

## 5. Session Workflows

### 5.1 Scheduled Session Booking

1. **Find Trainer** — Browse trainers on Home tab or use Search
2. **View Profile** — Tap a trainer card to see full details
3. **Select Session Type** — Choose Virtual, Outdoor, or In-Home
4. **Schedule** — Pick date and time on the Schedule Training screen
5. **Confirm Booking** — Review price breakdown and confirm
6. **Payment** — Complete Stripe payment
7. **Wait for Trainer** — Trainer receives notification and accepts/declines
8. **Session Confirmed** — Both parties receive confirmation notification

**Price Breakdown on Confirm Screen:**
- Base session rate
- Travel fee (in-home only, based on distance)
- Multi-session discount (5% on 3rd+ session with same trainer)
- Membership discount (10% if subscribed)
- Platform fee (25%)
- Trainer earnings (75%)

### 5.2 Session Flow (In-Person)

1. **Confirmed** — Both parties have agreed
2. **Selfie Verification** — Both submit attendance selfie (see Section 8)
3. **Trainer En Route** — Trainer taps "Start En Route" (GPS tracking begins)
4. **GPS Arrival** — Trainer confirms GPS arrival (within 0.25 miles for outdoor, 0.1 miles for at-home)
5. **In Progress** — Session starts
6. **End Session** — Trainer ends session
7. **Client Confirm** — Trainee confirms session completion
8. **Summary Generated** — Post-session stats available (see Section 9)
9. **Rate & Review** — Trainee rates the trainer

### 5.3 Session Flow (Virtual)

1. **Confirmed** — Both parties have agreed
2. **Join Video** — Both join the virtual session room
3. **In Progress** — Session active
4. **End Session** — Trainer ends session
5. **Summary Generated** — Stats available
6. **Rate & Review** — Trainee rates

---

## 6. Matching Engine — "Need a Trainer Now"

### 6.1 Virtual Instant Session

**Button:** "Virtual Session" on Home screen

1. Tap **Virtual Session** button
2. **Searching screen** appears with:
   - Radar animation
   - Elapsed time counter
   - "Finding your perfect trainer..." text
   - **Cancel** button
3. The matching engine scores available trainers using:
   - Rating (25% weight)
   - Price competitiveness (15%)
   - Boost status (10%)
   - Responsiveness history (5%)
   - Profile completeness (5%)
4. Top 5 trainers notified simultaneously
5. **First trainer to accept wins** (atomic — no double-booking)
6. On match:
   - **Boxing-bell sound** plays
   - Trainer details appear (name, rating, price, photo)
   - **"Trainer Found!"** notification sent
7. If no match within 3 minutes:
   - Progressive wave expansion (additional trainers notified)
   - After timeout: **"No trainers found"** fallback with retry option

**Buttons on searching screen:**
- **Cancel Search** — Cancels the request and returns home

**Buttons on matched screen:**
- **Start Session** — Begin the virtual session
- **Find Another** — Reject this match and search again

### 6.2 In-Person Instant Session

**Button:** "In-Person Now" on Home screen

Same flow as virtual but with location-based matching:

**Wave Logic:**
- **Wave 1:** Trainers within 5 min ETA, top 3 by score
- **Wave 2:** (if <2 matches) Trainers within 10 min ETA, top 3
- **Wave 3:** (if still <1) Trainers within 15 min ETA, top 5

Requires GPS permission. If denied: *"Location required to match you with a trainer nearby"*

### 6.3 Membership Priority

Members receive a +0.15 score bonus in the matching engine, meaning they get matched with higher-rated trainers faster.

---

## 7. GPS Tracking & En-Route

### 7.1 Starting En Route

For in-person sessions, the trainer taps **"Start En Route"** to activate GPS tracking.

**Update frequency:**
- En route: GPS refreshes every **5 seconds**
- In progress: GPS refreshes every **15 seconds**
- Stops immediately on session end or cancellation

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
| Stale Movement | Trainer stationary for 2+ min while en route | "You appear to be stationary. Are you on the way?" |
| Distance Warning | Parties > 0.5 miles apart during active session | "You are X miles from the other party" |
| Address Mismatch | Parties > 0.25 miles apart at session start | "You and the other party appear to be at different locations" |

### 7.4 Arrival Confirmation

Trainer must tap **"Confirm Arrival"** to verify GPS proximity:
- **Outdoor/Gym sessions:** Must be within **0.25 miles (400m)**
- **At-home sessions:** Must be within **0.1 miles (160m)**

If too far away: *"You are X miles away. Must be within Y miles to start."*

### 7.5 Privacy

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
2. **Both trainer and trainee** take and submit a selfie via the app
3. Each person sees the other's verification status:
   - "Trainer verified" / "Waiting for trainer"
   - "Trainee verified" / "Waiting for trainee"
4. Once **both selfies are submitted**:
   - "Both verified — session can start!" message
   - Session can proceed

### 8.2 Buttons

- **Take Selfie** — Opens camera
- **Submit Selfie** — Uploads selfie for verification
- **Retake** — Take a new selfie

### 8.3 Requirements

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
| Calories Burned | Estimated by workout type and duration |
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
- **Share as Card** — Generates a styled share card with your stats
- **Copy Deep Link** — `rapidreps://session-summary/{sessionId}` opens the summary in the app
- **View All Summaries** — See complete history with totals (total sessions, total calories, total minutes)

---

## 10. Messaging

### 10.1 Conversations List

**Tab:** Messages (chat bubble icon)

Shows all conversations sorted by most recent message. Each conversation shows:
- Other person's name and photo
- Last message preview
- Timestamp
- Unread message count badge

### 10.2 Chat Screen

**Screen:** `Chat`

Real-time messaging between trainee and trainer.

**Buttons:**
- **Send** — Send the typed message
- **Back** — Return to conversations list

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

Travel fees apply for in-home sessions:
- $0.50 per mile (over 2 miles)
- Minimum: $0 | Maximum: $15
- **Trainer receives:** 70% of travel fee
- **Platform receives:** 30% of travel fee

### 11.3 Discounts

| Discount | Amount | Condition |
|----------|--------|-----------|
| Multi-Session | 5% off base rate | 3rd+ session with same trainer |
| Membership | 10% off base rate | Active membership ($19.99/month) |

*Discounts stack. A member on their 3rd session gets 15% off.*

### 11.4 Payment Flow

1. Select session and confirm booking
2. Price breakdown shown (base + travel - discounts)
3. **Pay with Stripe** — Enter card details or use saved payment method
4. Payment held in escrow until session completes
5. After session ends and trainee confirms:
   - Trainer receives 75% payout
   - Platform retains 25%

---

## 12. Membership Program

**Price:** $19.99/month

### 12.1 Benefits

| Benefit | Details |
|---------|---------|
| Session Discount | 10% off every session (auto-applied at checkout) |
| Free Monthly Boost | 1 free profile visibility boost per month |
| Priority Matching | +0.15 score bonus in matching engine (matched with better trainers faster) |
| Early Access | First access to newly verified elite trainers |
| Member Badge | Exclusive badge on your profile |

### 12.2 Subscribe

1. Navigate to **Profile > Membership**
2. Review benefits and pricing
3. Tap **Subscribe Now**
4. Complete Stripe payment ($19.99)
5. Membership activates immediately

### 12.3 Cancel

1. Navigate to **Profile > Membership**
2. Tap **Cancel Membership**
3. Membership remains active until end of current billing period
4. No pro-rated refunds

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

Navigate to **Profile > Boosts > Analytics** to see:

| Metric | Description |
|--------|-------------|
| Impressions | Times your profile appeared in search results |
| Profile Views | Times trainees viewed your full profile |
| Clicks | Times trainees interacted with your profile |
| Click-Through Rate | Clicks / Impressions (percentage) |
| Daily Breakdown | Day-by-day performance for last 30 days |

### 13.4 Free Boost (Members)

Members receive **1 free boost per month** (equivalent to a 1-day boost).

---

## 14. Cancellation & No-Show Policies

### 14.1 Trainee Cancellation

| Time Before Session | Penalty |
|---------------------|---------|
| More than 12 hours | $0 (free cancellation) |
| 12 to 2 hours | 25% of session price |
| Less than 2 hours | 50% of session price |

- Penalty amount goes to trainer (75%) and platform (25%)
- Remaining amount is refunded via Stripe

### 14.2 Trainer Cancellation

| Time Before Session | Consequence |
|---------------------|-------------|
| More than 12 hours | No penalty, full refund to trainee |
| 12 hours or less | Full refund + free virtual session credit to trainee. Trainer receives a **performance strike** |

### 14.3 Trainee No-Show

- **Definition:** Trainee does not appear within 10 minutes of session start
- **Trainer receives:** 50% of session price (platform keeps 25% of that 50%)
- **Trainee charged:** 50% of session price (remaining 50% refunded)

### 14.4 Trainer No-Show

- **Definition:** Trainer does not appear or start session within 10 minutes
- **Trainee receives:** 100% full refund
- **Trainer receives:** $0
- **Trainer penalty:** Performance strike

### 14.5 Performance Strikes (Trainers)

| Strikes | Consequence |
|---------|-------------|
| 1-2 | Warning notification |
| 3+ | Account flagged for review (may be suspended) |

Strikes are issued for:
- Late cancellation (within 12 hours)
- No-show

---

## 15. Ratings & Reviews

### 15.1 Rating a Trainer

After a completed session, trainees are prompted to leave a rating:

| Field | Required | Notes |
|-------|----------|-------|
| Star Rating | Yes | 1-5 stars |
| Written Review | No | Optional text feedback |

### 15.2 Rating Prompt

A "Rate Your Session" notification is sent 30 minutes after session ends if no rating has been submitted.

### 15.3 Viewing Ratings

- Trainer profile shows average rating and total review count
- Full review list available on the trainer detail screen

---

## 16. Achievements & Streaks

### 16.1 Trainee Achievements

Earned by completing sessions:
- **First Session** — Complete your first session
- **5 Sessions** — Regular badge
- **10 Sessions** — Dedicated badge
- **25 Sessions** — Committed badge
- **50 Sessions** — Elite badge
- **100 Sessions** — Legend badge

### 16.2 Streak Tracking

- Streaks count consecutive **weeks** with at least 1 completed session
- Streak appears in your profile and session summaries
- **Don't Lose Your Streak** — Reminder sent after 6 days without a session

### 16.3 Trainer Achievements

- Session count milestones
- Rating milestones (maintain 4.5+ average)
- Revenue milestones

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

Navigate to **Profile > Notification Preferences** to toggle individual types on/off.

**Master Toggle:** Push Enabled (on/off for all notifications)

Each notification type can be individually enabled or disabled.

---

## 18. Safety & Reporting

### 18.1 Report a User

**Button:** Report (available on any user profile)

Report reasons:
- Inappropriate behavior
- Harassment
- Fraud/scam
- Safety concern
- Other

### 18.2 Block a User

**Button:** Block User (on profile or in chat)

Blocked users:
- Cannot message you
- Cannot see your profile
- Cannot book sessions with you

### 18.3 Unblock

Navigate to **Profile > Blocked Users** to view and unblock users.

---

## 19. Admin Dashboard

**Access:** Login as admin (admin@rapidreps.com)

### 19.1 Dashboard Overview

- **Total Users** — Count of all registered users
- **Total Sessions** — All sessions across all statuses
- **Total Revenue** — Platform earnings
- **Active Trainers** — Currently available trainers

**Charts:**
- Session distribution (donut chart)
- Revenue over time (bar chart)

### 19.2 User Management

- **View All Users** — List with search and filter
- **User Detail** — View any user's profile, sessions, earnings
- **Delete User** — Remove user account
- **Send Message** — Message any user directly

### 19.3 Trainer Management

- **Pending Verifications** — Review and approve/reject trainer applications
- **Verify Trainer** — Approve trainer's documents and certifications
- **Reject Trainer** — Decline with reason

### 19.4 Financial Management

- **Revenue Dashboard** — Platform income breakdown
- **Payout Requests** — Process trainer payout requests
- **Process Payout** — Transfer earnings to trainer
- **Issue Refund** — Refund a session payment
- **Transaction History** — All financial transactions with enriched details

### 19.5 Top Trainer Leaderboard

Real-time leaderboard showing top trainers by:
- Sessions completed this week
- Average rating
- Total earnings

---

## 20. Account Settings

### 20.1 Edit Profile

Update your name, photo, bio, and preferences.

### 20.2 Change Password

Via Forgot Password flow from the login screen.

### 20.3 Notification Preferences

Toggle individual notification types on/off.

### 20.4 Sound Effects

Toggle button tap sounds on/off (global setting).

### 20.5 Delete Account

**Button:** Delete Account (bottom of Profile screen)

- Confirmation dialog appears
- All data permanently deleted
- Cannot be undone

---

## 21. Legal

### 21.1 Terms of Service

Full terms available at **Profile > Terms of Service** or during sign-up.

### 21.2 Privacy Policy

Full policy available at **Profile > Privacy Policy** or during sign-up.

---

## 22. FAQ

**Q: How quickly will I be matched with a trainer?**
A: The instant matching engine typically finds a trainer within 1-3 minutes. Members get priority matching for faster results.

**Q: What happens if no trainer is available?**
A: The system progressively expands the search radius over 3 minutes. If still no match, you'll see a "No trainers found" message with a retry option.

**Q: Can two trainers accept the same request?**
A: No. The system uses atomic first-accept-wins logic — only the first trainer to accept gets the session.

**Q: How is my location used?**
A: GPS is only active during en-route and active sessions. It is never tracked when the app is idle.

**Q: What if my trainer doesn't show up?**
A: You'll receive a full 100% refund. The trainer receives a performance strike. After 3 strikes, their account is reviewed.

**Q: Can I cancel for free?**
A: Yes, if you cancel more than 12 hours before the session. See Section 14 for full cancellation policies.

**Q: How are calories calculated?**
A: Based on your trainer's specializations and session duration using established exercise science averages (see Section 9.2).

**Q: What does a membership include?**
A: 10% off all sessions, priority matching, 1 free boost/month, and a member badge. $19.99/month.

**Q: How do boosts work?**
A: Boosts increase your visibility in search results and the matching engine. You can track impressions, views, and clicks in your analytics dashboard.

**Q: How do I get paid as a trainer?**
A: You earn 75% of each session. Request a payout from your Earnings tab — processed via Stripe.

---

*RapidReps — Train smarter. Match faster. Get results.*

*Manual Version: 2.0 | Last Updated: March 2026*
