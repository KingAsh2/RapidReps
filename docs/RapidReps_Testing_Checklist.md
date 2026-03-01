# RapidReps v3.0 — Manual Testing Checklist
### Print this document and check off each item as you test

**Test Date:** _______________  
**Tester Name:** _______________  
**App Version:** 3.0  
**Device/Platform:** _______________

---

## Legend
- [ ] = Not tested
- P = Pass
- F = Fail (note issue on the line)
- S = Skipped (note reason)
- N/A = Not applicable

---

## SECTION 1: HEALTH & INFRASTRUCTURE

| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 1.1 | Open the app URL in browser | App loads without errors | [ ] |
| 1.2 | Hit GET /api/health | Returns {"status": "healthy"} | [ ] |
| 1.3 | Hit GET /api/downloads/user-manual | Downloads PDF file (101KB+) | [ ] |

---

## SECTION 2: ACCOUNT & AUTHENTICATION

### 2.1 Sign Up
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 2.1.1 | Tap "Create Account" with valid name, email, password, role=Trainee | Account created, token returned, redirected to home | [ ] |
| 2.1.2 | Tap "Create Account" with valid name, email, password, role=Trainer | Account created, token returned, redirected to trainer home | [ ] |
| 2.1.3 | Try signup with duplicate email | Error: "Email already registered" | [ ] |
| 2.1.4 | Try signup with password < 6 characters | Validation error | [ ] |
| 2.1.5 | Try signup with missing required fields | Validation error | [ ] |
| 2.1.6 | Tap "Already have an account? Log In" | Navigates to login screen | [ ] |
| 2.1.7 | Tap "View Terms of Service" | Opens Terms screen | [ ] |
| 2.1.8 | Tap "View Privacy Policy" | Opens Privacy screen | [ ] |

### 2.2 Log In
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 2.2.1 | Login with valid trainee credentials (trainee1@test.com / test123) | Success, redirected to trainee home | [ ] |
| 2.2.2 | Login with valid trainer credentials (trainer1@test.com / test123) | Success, redirected to trainer home | [ ] |
| 2.2.3 | Login with admin credentials (admin@rapidreps.com / admin123) | Success, redirected to admin dashboard | [ ] |
| 2.2.4 | Login with wrong password | Error: "Invalid credentials" | [ ] |
| 2.2.5 | Login with non-existent email | Error: "Invalid credentials" | [ ] |
| 2.2.6 | Verify tagline "Time to lock in" is displayed | Tagline visible on login screen | [ ] |
| 2.2.7 | Tap "Forgot Password?" | Opens password reset flow | [ ] |
| 2.2.8 | Tap "Don't have an account? Sign Up" | Navigates to signup | [ ] |

### 2.3 Forgot Password / Reset Password
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 2.3.1 | Enter valid email, tap "Send Reset Code" | Returns success message (email mocked via SendGrid) | [ ] |
| 2.3.2 | Enter non-existent email | Error or appropriate message | [ ] |
| 2.3.3 | Enter code + new password, tap "Reset Password" | Password updated successfully | [ ] |
| 2.3.4 | Tap "Back to Login" | Returns to login screen | [ ] |

### 2.4 Get Current User
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 2.4.1 | GET /api/auth/me with valid token | Returns user profile (name, email, role) | [ ] |
| 2.4.2 | GET /api/auth/me without token | Returns 401 Unauthorized | [ ] |

### 2.5 Delete Account
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 2.5.1 | Tap "Delete Account" on Profile tab | Confirmation dialog appears | [ ] |
| 2.5.2 | Confirm deletion | Account permanently deleted, redirected to login | [ ] |
| 2.5.3 | Try logging in with deleted account | Error: "Invalid credentials" | [ ] |

---

## SECTION 3: TRAINEE GUIDE

### 3.1 Home Screen
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 3.1.1 | Open home screen as trainee | Greeting with your name displayed | [ ] |
| 3.1.2 | Check notification bell icon | Shows unread notification count | [ ] |
| 3.1.3 | "Virtual Session" button visible in "Need a Trainer Now" section | Button present and tappable | [ ] |
| 3.1.4 | "In-Person Now" button visible | Button present and tappable | [ ] |
| 3.1.5 | Sort trainers by Rating | Trainers sorted by highest rating first | [ ] |
| 3.1.6 | Sort trainers by Price (Low to High) | Trainers sorted by cheapest first | [ ] |
| 3.1.7 | Sort trainers by Price (High to Low) | Trainers sorted by most expensive first | [ ] |
| 3.1.8 | Sort trainers by Distance | Trainers sorted by nearest first | [ ] |
| 3.1.9 | Active sort option is highlighted in teal | Visual indicator works | [ ] |

### 3.2 Trainer Cards
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 3.2.1 | Each trainer card shows: photo, name, rating, review count | All fields displayed | [ ] |
| 3.2.2 | Training styles shown as tags | Tags visible on card | [ ] |
| 3.2.3 | Price per session shown | Price displayed | [ ] |
| 3.2.4 | Distance shown (if location enabled) | Distance displayed when GPS on | [ ] |
| 3.2.5 | Boosted badge (glow) shown for boosted trainer | Glow indicator visible | [ ] |
| 3.2.6 | Member badge shown for member trainer | Badge visible | [ ] |
| 3.2.7 | Tap "View Profile" | Opens trainer detail screen | [ ] |
| 3.2.8 | Tap "Book Session" | Goes to booking flow | [ ] |

### 3.3 Trainer Detail Screen
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 3.3.1 | Profile photo, name, verification badge visible | All displayed | [ ] |
| 3.3.2 | Average rating and total reviews shown | Data displayed | [ ] |
| 3.3.3 | Bio/description shown | Text displayed | [ ] |
| 3.3.4 | Training styles listed | Styles visible | [ ] |
| 3.3.5 | Session types offered (Virtual/Outdoor/In-Home) | Types shown | [ ] |
| 3.3.6 | Pricing for each session type displayed | Prices shown | [ ] |
| 3.3.7 | Reviews from other trainees visible | Review list shown | [ ] |
| 3.3.8 | Tap "Book Virtual Session" | Opens virtual booking flow | [ ] |
| 3.3.9 | Tap "Book Outdoor Session" | Opens outdoor booking flow | [ ] |
| 3.3.10 | Tap "Book In-Home Session" | Opens in-home booking flow | [ ] |
| 3.3.11 | Tap "Save Trainer" | Trainer added to saved list | [ ] |
| 3.3.12 | Tap "Message" | Opens direct message conversation | [ ] |
| 3.3.13 | Tap "Report" | Opens report dialog | [ ] |
| 3.3.14 | Tap "Back" | Returns to home | [ ] |

### 3.4 Saved Trainers
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 3.4.1 | Open Saved tab (heart icon) | Saved trainers list displayed | [ ] |
| 3.4.2 | Tap "Unsave" | Trainer removed from saved list | [ ] |
| 3.4.3 | Tap "Book" from saved list | Opens booking flow | [ ] |
| 3.4.4 | Tap "View Profile" from saved list | Opens trainer detail | [ ] |

### 3.5 Sessions Tab (Trainee)
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 3.5.1 | Open Sessions tab (calendar icon) | Sessions list displayed | [ ] |
| 3.5.2 | Sessions organized by status: Upcoming, In Progress, Completed, Cancelled | Correct grouping | [ ] |
| 3.5.3 | Each card shows: trainer name/photo, date/time, type, status badge, price | All fields present | [ ] |
| 3.5.4 | Tap "View Details" on a session | Full session info shown | [ ] |
| 3.5.5 | Tap "Cancel" on upcoming session | Cancellation flow starts | [ ] |
| 3.5.6 | Tap "Rate" on completed session | Rating form opens | [ ] |
| 3.5.7 | Tap "View Summary" on completed session | Post-session stats shown | [ ] |
| 3.5.8 | Tap "Mark No-Show" on applicable session | No-show flow starts | [ ] |

### 3.6 Profile Tab (Trainee)
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 3.6.1 | Tap "Edit Profile" | Profile edit form opens | [ ] |
| 3.6.2 | Tap "Membership" | Membership screen opens | [ ] |
| 3.6.3 | Tap "Achievements" | Achievement badges displayed | [ ] |
| 3.6.4 | Tap "Notification Preferences" | Notification settings open | [ ] |
| 3.6.5 | Tap "Sound & Vibration Settings" | Sound settings screen opens | [ ] |
| 3.6.6 | Tap "Privacy Policy" | Opens privacy policy | [ ] |
| 3.6.7 | Tap "Terms of Service" | Opens terms | [ ] |
| 3.6.8 | Tap "Log Out" | User signed out, back to login | [ ] |

---

## SECTION 4: TRAINER GUIDE

### 4.1 Trainer Home Screen
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 4.1.1 | Availability Toggle visible | Toggle switch displayed | [ ] |
| 4.1.2 | Toggle to "Available" | Status changes, trainer appears in search | [ ] |
| 4.1.3 | Toggle to "Unavailable" | Status changes, trainer hidden from search | [ ] |
| 4.1.4 | Today's Sessions section shows upcoming sessions | List displayed | [ ] |
| 4.1.5 | Pending Requests section shows awaiting requests | Requests listed | [ ] |
| 4.1.6 | Quick Stats show: today's earnings, sessions completed, rating | Stats displayed | [ ] |
| 4.1.7 | Tap "Accept" on pending request | Session accepted | [ ] |
| 4.1.8 | Tap "Decline" on pending request | Session declined | [ ] |

### 4.2 Trainer Sessions Tab
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 4.2.1 | Tap "Start En Route" on confirmed session | GPS tracking begins | [ ] |
| 4.2.2 | Tap "Confirm GPS Arrival" | GPS proximity verified | [ ] |
| 4.2.3 | Tap "Start Session" | Session status changes to In Progress | [ ] |
| 4.2.4 | Tap "End Session" | Session completed, summary generated | [ ] |
| 4.2.5 | Tap "Cancel" | Cancellation flow with penalty check | [ ] |
| 4.2.6 | Tap "Mark No-Show" | No-show marked for trainee | [ ] |

### 4.3 Earnings Tab
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 4.3.1 | Total Earnings displayed | Lifetime earnings shown | [ ] |
| 4.3.2 | This Month earnings displayed | Current month total shown | [ ] |
| 4.3.3 | Pending Payout amount displayed | Withdrawal amount shown | [ ] |
| 4.3.4 | Recent Transactions listed | Transaction history visible | [ ] |
| 4.3.5 | Tap "Request Payout" | Payout request submitted | [ ] |
| 4.3.6 | Tap "View All Transactions" | Full transaction list opens | [ ] |

### 4.4 Trainer Profile Tab
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 4.4.1 | Tap "Edit Profile" | Opens profile edit form | [ ] |
| 4.4.2 | Tap "Upload Intro Video" | Video upload flow opens | [ ] |
| 4.4.3 | Tap "Verification" | Verification status/form opens | [ ] |
| 4.4.4 | Tap "Visibility Boosts" | Boost purchase screen opens | [ ] |

### 4.5 Edit Profile (Trainer)
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 4.5.1 | Update Full Name | Name saved successfully | [ ] |
| 4.5.2 | Update Bio (max 500 chars) | Bio saved | [ ] |
| 4.5.3 | Select Training Styles (multi-select) | Styles saved | [ ] |
| 4.5.4 | Set Virtual Rate (verify min $30) | Rate saved, enforces $30 minimum | [ ] |
| 4.5.5 | Set Outdoor Rate (verify min $40) | Rate saved, enforces $40 minimum | [ ] |
| 4.5.6 | Set In-Home Rate (verify min $60) | Rate saved, enforces $60 minimum | [ ] |
| 4.5.7 | Toggle Offers Virtual on/off | Setting saved | [ ] |
| 4.5.8 | Toggle Offers In-Person on/off | Setting saved | [ ] |
| 4.5.9 | Upload Profile Photo | Photo uploaded and displayed | [ ] |

### 4.6 Trainer Verification
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 4.6.1 | Submit Personal Information (name, DOB, address) | Step completed | [ ] |
| 4.6.2 | Upload Certification | Document uploaded | [ ] |
| 4.6.3 | Upload Government ID | Document uploaded | [ ] |
| 4.6.4 | Agree to Background Check | Consent recorded | [ ] |
| 4.6.5 | Check verification status | Shows current verification state | [ ] |

### 4.7 Virtual Request (Trainer Side)
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 4.7.1 | Receive virtual request notification | Trainee name, session type, details shown | [ ] |
| 4.7.2 | Countdown timer visible | Timer counting down | [ ] |
| 4.7.3 | Tap "Accept" | Session accepted (first-accept-wins) | [ ] |
| 4.7.4 | Tap "Decline" | Declined, system finds another | [ ] |
| 4.7.5 | Timer expires | Auto-decline triggered | [ ] |

---

## SECTION 5: SESSION WORKFLOWS

### 5.1 Scheduled Session Booking
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 5.1.1 | Browse trainers on Home tab | Trainer list loads | [ ] |
| 5.1.2 | Tap trainer card to view profile | Profile opens | [ ] |
| 5.1.3 | Select session type (Virtual/Outdoor/In-Home) | Type selected | [ ] |
| 5.1.4 | Pick date and time | Schedule selected | [ ] |
| 5.1.5 | Review price breakdown on confirm screen | Shows: base rate, travel fee, discounts, platform fee, trainer earnings | [ ] |
| 5.1.6 | Verify Multi-session discount (5% on 3rd+ with same trainer) | Discount applied correctly | [ ] |
| 5.1.7 | Verify Membership discount (10% if subscribed) | Discount applied for members | [ ] |
| 5.1.8 | Verify discounts stack (15% for member on 3rd session) | Both discounts applied | [ ] |
| 5.1.9 | Complete Stripe payment | Payment processed | [ ] |
| 5.1.10 | Trainer accepts booking | Both receive confirmation notification | [ ] |
| 5.1.11 | Verify Platform fee = 25% | Correct split shown | [ ] |
| 5.1.12 | Verify Trainer earnings = 75% | Correct split shown | [ ] |

### 5.2 In-Person Session Flow
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 5.2.1 | Session status = Confirmed after both agree | Status correct | [ ] |
| 5.2.2 | Selfie verification prompt appears | Both parties prompted | [ ] |
| 5.2.3 | Trainer taps "Start En Route" | GPS tracking begins (5-sec updates) | [ ] |
| 5.2.4 | GPS Arrival confirmation | Trainer within proximity | [ ] |
| 5.2.5 | Session moves to "In Progress" | GPS switches to 15-sec updates | [ ] |
| 5.2.6 | Trainer taps "End Session" | GPS stops immediately | [ ] |
| 5.2.7 | Summary auto-generated | Post-session stats available | [ ] |
| 5.2.8 | Rate & Review prompt | Trainee can rate trainer | [ ] |

### 5.3 Virtual Session Flow
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 5.3.1 | Both join virtual session room | Video call starts | [ ] |
| 5.3.2 | Session active (In Progress) | Status updated | [ ] |
| 5.3.3 | Verify default duration = 30 minutes | Timer shows 30 min | [ ] |
| 5.3.4 | Verify duration selectable (30 or 60 min) | Option available at booking | [ ] |
| 5.3.5 | Verify maximum duration = 90 minutes | Cannot exceed 90 min | [ ] |
| 5.3.6 | Grace period = 2 minutes after scheduled end | 2-min buffer works | [ ] |
| 5.3.7 | Auto-end after max duration + grace | Session auto-ends, summary generated | [ ] |
| 5.3.8 | Trainer manually ends via "End Session" | Session ends, summary generated | [ ] |

---

## SECTION 6: MATCHING ENGINE

### 6.1 Location Permission Flow
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 6.1.1 | Pre-Permission screen shows explanation | "RapidReps needs your location..." message | [ ] |
| 6.1.2 | OS permission prompt appears (iOS: Allow While Using/Once/Don't Allow) | System dialog shown | [ ] |
| 6.1.3 | Permission denied (Soft Decline) | Warning: "Location access needed..." shown | [ ] |
| 6.1.4 | In-person features disabled after soft decline | "In-Person Now" button disabled | [ ] |
| 6.1.5 | Virtual sessions still available without GPS | Virtual button works | [ ] |
| 6.1.6 | Hard Decline (denied again) | "Enable Location in Settings" message on In-Person button | [ ] |
| 6.1.7 | All in-person matching disabled after hard decline | Cannot use in-person features | [ ] |

### 6.2 Virtual Instant Session
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 6.2.1 | Tap "Virtual Session" on Home | Searching screen appears | [ ] |
| 6.2.2 | Radar animation visible | Animation playing | [ ] |
| 6.2.3 | Elapsed time counter visible | Timer counting up | [ ] |
| 6.2.4 | "Finding your perfect trainer..." text shown | Text visible | [ ] |
| 6.2.5 | "Cancel" button visible | Button present | [ ] |
| 6.2.6 | Top 5 trainers notified simultaneously | Trainers receive notifications | [ ] |
| 6.2.7 | First trainer to accept wins (no double-booking) | Only one trainer matched | [ ] |
| 6.2.8 | Boxing-bell sound plays on match | Sound audible | [ ] |
| 6.2.9 | Matched trainer details shown (name, rating, price, photo) | All details visible | [ ] |
| 6.2.10 | "Trainer Found!" notification sent | Notification received | [ ] |
| 6.2.11 | No match within 3 min → progressive wave expansion | Additional trainers notified | [ ] |
| 6.2.12 | All waves exhausted → "No trainers found" with retry | Fallback message shown | [ ] |
| 6.2.13 | Tap "Cancel Search" | Returns to home | [ ] |
| 6.2.14 | Tap "Start Session" on matched screen | Virtual session begins | [ ] |
| 6.2.15 | Tap "Find Another" on matched screen | New search starts (see 6.4) | [ ] |

### 6.3 Matching Engine Scoring Weights
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 6.3.1 | Verify ETA weight = 40% (primary factor) | ETA is highest weight | [ ] |
| 6.3.2 | Verify Rating weight = 25% | Rating is second | [ ] |
| 6.3.3 | Verify Price weight = 15% | Price is third | [ ] |
| 6.3.4 | Verify Boost weight = 10% | Boost bonus applied | [ ] |
| 6.3.5 | Verify Responsiveness weight = 5% | Historical speed factored | [ ] |
| 6.3.6 | Verify Profile Completeness weight = 5% | Completeness bonus applied | [ ] |

### 6.4 In-Person Instant Session (Wave Logic)
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 6.4.1 | Wave 1: ETA ≤ 5 min, Top 3 trainers, Immediate trigger | First wave fires immediately | [ ] |
| 6.4.2 | Wave 2: ETA ≤ 10 min, Top 3 trainers, if Wave 1 < 2 matches | Second wave triggers | [ ] |
| 6.4.3 | Wave 3: ETA ≤ 15 min, Top 5 trainers, if Wave 2 < 1 match | Third wave triggers | [ ] |
| 6.4.4 | **Hard Maximum ETA Cap = 15 minutes** | No trainer >15 min matched | [ ] |
| 6.4.5 | Matching stops after Wave 3 | No further waves | [ ] |

### 6.5 "Find Another" Trainer Logic
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 6.5.1 | Tap "Find Another" after match | Previous trainer excluded for 10 minutes | [ ] |
| 6.5.2 | New scoring wave runs | Fresh wave of matching | [ ] |
| 6.5.3 | All rejected trainers excluded | No rematching same trainer | [ ] |
| 6.5.4 | All waves exhausted → status "exhausted" | Fallback screen: "All available trainers contacted..." | [ ] |
| 6.5.5 | No infinite loops possible | System stops after exhausting pool | [ ] |

### 6.6 Membership Priority
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 6.6.1 | Member receives +0.15 score bonus | Members matched faster/better | [ ] |

---

## SECTION 7: GPS TRACKING & EN-ROUTE

### 7.1 Starting En Route
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 7.1.1 | Trainer taps "Start En Route" | GPS tracking activates | [ ] |
| 7.1.2 | GPS updates every 5 seconds (en route) | 5-second refresh rate | [ ] |
| 7.1.3 | GPS updates every 15 seconds (in progress) | 15-second refresh rate | [ ] |
| 7.1.4 | GPS stops immediately on session end | No more updates after end | [ ] |
| 7.1.5 | GPS stops immediately on cancellation | No more updates after cancel | [ ] |

### 7.2 Live Tracking View
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 7.2.1 | Trainer's live location on map | Location pin visible | [ ] |
| 7.2.2 | Trainee's location on map | Location pin visible | [ ] |
| 7.2.3 | Distance between parties (miles) | Distance displayed | [ ] |
| 7.2.4 | Estimated time of arrival | ETA displayed | [ ] |

### 7.3 GPS Alerts
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 7.3.1 | Weak Signal alert (accuracy > 50m) | "Weak GPS signal" message | [ ] |
| 7.3.2 | Stale Movement alert (stationary 2+ min en route) | "You appear to be stationary" message | [ ] |
| 7.3.3 | Distance Warning (> 0.5 miles apart during session) | Distance warning shown | [ ] |
| 7.3.4 | Address Mismatch (> 0.25 miles at session start) | Mismatch alert shown | [ ] |
| 7.3.5 | GPS Spoofing (> 2 miles jump in < 30 sec) | "Unusual location change" + account flagged | [ ] |

### 7.4 Arrival Confirmation
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 7.4.1 | Outdoor/Gym: Confirm within 0.25 miles (400m) | Arrival confirmed | [ ] |
| 7.4.2 | At-home: Confirm within 0.1 miles (160m) | Arrival confirmed | [ ] |
| 7.4.3 | Too far away → error | "You are X miles away. Must be within Y miles" | [ ] |

### 7.5 Arrival Time Measurement
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 7.5.1 | Arrival window starts when trainer taps "Start En Route" | Window begins | [ ] |
| 7.5.2 | OR 5 minutes before session start (whichever first) | Automatic start of window | [ ] |

### 7.6 GPS Privacy
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 7.6.1 | GPS only active during: en route, active session, arrival verification | No tracking outside sessions | [ ] |
| 7.6.2 | GPS NOT active when app is idle | Confirm no background tracking | [ ] |

---

## SECTION 8: SELFIE VERIFICATION

### 8.1 Selfie Flow
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 8.1.1 | Selfie prompt appears when session Confirmed/En Route | Prompt shown to both parties | [ ] |
| 8.1.2 | Both trainer and trainee take/submit selfie | Upload successful | [ ] |
| 8.1.3 | Each person sees other's verification status | Status visible | [ ] |
| 8.1.4 | Both submitted → "Both verified — session can start!" | Success message shown | [ ] |

### 8.2 Selfie Buttons
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 8.2.1 | Tap "Take Selfie" | Camera opens | [ ] |
| 8.2.2 | Tap "Submit Selfie" | Selfie uploaded | [ ] |
| 8.2.3 | Tap "Retake" | Camera reopens | [ ] |
| 8.2.4 | Tap "Switch Camera" | Toggles front/rear | [ ] |

### 8.3 Selfie Failure Handling
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 8.3.1 | Camera fails to open | "Try again or switch cameras" with retry button | [ ] |
| 8.3.2 | Upload fails (network error) | "Upload failed. Tap to try again." with retry | [ ] |
| 8.3.3 | Poor lighting detected | "Move to a brighter area" message | [ ] |
| 8.3.4 | One user refuses selfie | Session CANNOT begin until both submit | [ ] |
| 8.3.5 | Selfie fails 3 times → manual verification | "Selfie verification failed multiple times. Manual verification initiated." | [ ] |

### 8.4 Selfie Requirements
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 8.4.1 | Valid image (minimum 100 bytes) | Accepted | [ ] |
| 8.4.2 | Maximum file size 5MB | Files >5MB rejected | [ ] |
| 8.4.3 | Only session participants can submit | Non-participants blocked | [ ] |

---

## SECTION 9: POST-SESSION SUMMARY & SHARING

### 9.1 Summary Generation
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 9.1.1 | Summary auto-generated after session ends | Summary available immediately | [ ] |
| 9.1.2 | Trainer Name shown | Correct trainer name | [ ] |
| 9.1.3 | Workout Type shown (based on trainer specializations) | Types listed | [ ] |
| 9.1.4 | Duration shown (actual minutes) | Correct duration | [ ] |
| 9.1.5 | Calories Burned estimated | Calculation present | [ ] |
| 9.1.6 | Weekly Streak shown | Streak count displayed | [ ] |
| 9.1.7 | Sessions with this Trainer count | Count displayed | [ ] |

### 9.2 Calorie Estimation (Spot Check)
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 9.2.1 | HIIT session = 650 cal/hour | Correct estimation | [ ] |
| 9.2.2 | Strength Training = 420 cal/hour | Correct estimation | [ ] |
| 9.2.3 | Yoga = 250 cal/hour | Correct estimation | [ ] |
| 9.2.4 | Multiple styles → average calories used | Average calculated correctly | [ ] |

### 9.3 Sharing
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 9.3.1 | "Share as Card" generates styled card | Visual card with stats | [ ] |
| 9.3.2 | "Copy Deep Link" copies rapidreps://session-summary/{id} | Link copied to clipboard | [ ] |
| 9.3.3 | "View All Summaries" shows history | Total sessions, calories, minutes | [ ] |
| 9.3.4 | Share card accessible via GET /api/sessions/{id}/share-card | Public endpoint returns data | [ ] |

---

## SECTION 10: MESSAGING

| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 10.1 | Open Messages tab (chat bubble icon) | Conversations list displayed | [ ] |
| 10.2 | Conversations sorted by most recent | Most recent first | [ ] |
| 10.3 | Each conversation shows: name, photo, last message, timestamp, unread count | All fields shown | [ ] |
| 10.4 | Open a conversation | Chat screen opens | [ ] |
| 10.5 | Send a message | Message sent and appears in chat | [ ] |
| 10.6 | Tap "Back" | Returns to conversations list | [ ] |
| 10.7 | Create new conversation with trainer | New conversation created | [ ] |

---

## SECTION 11: PAYMENTS & PRICING

### 11.1 Session Pricing
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 11.1.1 | Virtual session minimum = $30 | Enforced in pricing rules | [ ] |
| 11.1.2 | Outdoor session minimum = $40 | Enforced | [ ] |
| 11.1.3 | In-Home session minimum = $60 | Enforced | [ ] |
| 11.1.4 | Home Visit minimum = $60 | Enforced | [ ] |
| 11.1.5 | Revenue split: Trainer = 75% | Correct split | [ ] |
| 11.1.6 | Revenue split: Platform = 25% | Correct split | [ ] |

### 11.2 Travel Fees (In-Home)
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 11.2.1 | $0.50 per mile over 2 miles | Fee calculated correctly | [ ] |
| 11.2.2 | Minimum travel fee = $0 | No negative fees | [ ] |
| 11.2.3 | Maximum travel fee = $15 | Capped at $15 | [ ] |
| 11.2.4 | Trainer receives 70% of travel fee | Split correct | [ ] |
| 11.2.5 | Platform receives 30% of travel fee | Split correct | [ ] |

### 11.3 Discounts
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 11.3.1 | Multi-Session: 5% off on 3rd+ session with same trainer | Discount applied | [ ] |
| 11.3.2 | Membership: 10% off with active subscription | Discount applied | [ ] |
| 11.3.3 | Stacking: 15% off for member on 3rd+ session | Both discounts stack | [ ] |

### 11.4 Payment Flow
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 11.4.1 | Confirm booking shows price breakdown | All line items visible | [ ] |
| 11.4.2 | Stripe payment completes | Payment successful | [ ] |
| 11.4.3 | Payment held in escrow until session completes | Held status | [ ] |
| 11.4.4 | After session: Trainer gets 75%, Platform keeps 25% | Correct distribution | [ ] |

---

## SECTION 12: MEMBERSHIP PROGRAM

| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 12.1 | Membership price = $19.99/month | Correct price displayed | [ ] |
| 12.2 | Navigate to Profile > Membership | Screen opens | [ ] |
| 12.3 | Benefits listed: 10% discount, free boost, priority matching, early access, badge | All benefits shown | [ ] |
| 12.4 | Tap "Subscribe Now" → Stripe payment $19.99 | Payment processed | [ ] |
| 12.5 | Membership activates immediately after payment | Active status shown | [ ] |
| 12.6 | Tap "Cancel Membership" | Membership cancelled | [ ] |
| 12.7 | Membership active until end of billing period after cancel | Not immediately deactivated | [ ] |
| 12.8 | No pro-rated refunds | No partial refund given | [ ] |

### 12.1 Membership Perk Rules
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 12.1.1 | 10% discount does NOT apply to sessions booked before joining | Only new bookings discounted | [ ] |
| 12.1.2 | Sessions booked while active keep discount even if membership expires | Discount preserved | [ ] |
| 12.1.3 | Active boosts continue when membership expires | Boost runs to its own expiry | [ ] |
| 12.1.4 | Free monthly boost resets on billing renewal | Reset confirmed | [ ] |
| 12.1.5 | Unused free boosts do NOT carry over | No accumulation | [ ] |

---

## SECTION 13: VISIBILITY BOOSTS (Trainers)

### 13.1 Boost Pricing
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 13.1.1 | 1 Day boost = $9.99 | Correct price | [ ] |
| 13.1.2 | 1 Week boost = $49.99 | Correct price | [ ] |
| 13.1.3 | 1 Month boost = $149.99 | Correct price | [ ] |

### 13.2 Boost Effects
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 13.2.1 | Profile Glow indicator visible on boosted trainer | Glow effect shown | [ ] |
| 13.2.2 | isBoosted Badge visible to trainees | Badge displayed | [ ] |
| 13.2.3 | 10% matching engine weight bonus | Higher ranking in matches | [ ] |
| 13.2.4 | Priority placement in search results | Boosted trainer ranked higher | [ ] |

### 13.3 Boost Analytics
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 13.3.1 | Navigate to Profile > Boosts > Analytics | Analytics screen opens | [ ] |
| 13.3.2 | Impressions metric shown | Count displayed | [ ] |
| 13.3.3 | Profile Views metric shown | Count displayed | [ ] |
| 13.3.4 | Clicks metric shown | Count displayed | [ ] |
| 13.3.5 | Click-Through Rate shown | Percentage displayed | [ ] |
| 13.3.6 | Daily Breakdown (last 30 days) | Day-by-day data shown | [ ] |
| 13.3.7 | **Timestamps in trainer's local device time zone** | Correct timezone | [ ] |

### 13.4 Free Boost (Members)
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 13.4.1 | Member gets 1 free boost/month (1-day equivalent) | Free boost available | [ ] |
| 13.4.2 | Resets on billing renewal | New free boost appears | [ ] |
| 13.4.3 | Unused boosts do NOT carry over | No accumulation | [ ] |

---

## SECTION 14: CANCELLATION & NO-SHOW POLICIES

### 14.1 Trainee Cancellation
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 14.1.1 | Cancel > 12 hours before session | $0 penalty (free) | [ ] |
| 14.1.2 | Cancel 12-2 hours before session | 25% penalty charged | [ ] |
| 14.1.3 | Cancel < 2 hours before session | 50% penalty charged | [ ] |
| 14.1.4 | Penalty split: Trainer 75%, Platform 25% | Correct split | [ ] |
| 14.1.5 | Remaining amount refunded via Stripe | Auto-refund processed | [ ] |

### 14.2 Trainer Cancellation
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 14.2.1 | Cancel > 12 hours before | No penalty, full refund to trainee | [ ] |
| 14.2.2 | Cancel ≤ 12 hours before | Full refund + free session credit to trainee | [ ] |
| 14.2.3 | Trainer receives performance strike (≤12hr cancel) | Strike recorded | [ ] |

### 14.3 Trainee No-Show
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 14.3.1 | Trainee doesn't appear within 10 min of session start | No-show detected | [ ] |
| 14.3.2 | Trainee charged 50% of session price | Correct charge | [ ] |
| 14.3.3 | Remaining 50% refunded | Refund processed | [ ] |
| 14.3.4 | Trainer receives 50% (platform keeps 25% of that) | Correct payout | [ ] |

### 14.4 Trainer No-Show
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 14.4.1 | Trainer doesn't appear within 10 min | No-show detected | [ ] |
| 14.4.2 | Trainee receives 100% full refund | Full refund | [ ] |
| 14.4.3 | Trainer receives $0 | No payment | [ ] |
| 14.4.4 | Trainer receives performance strike | Strike recorded | [ ] |

### 14.5 Performance Strikes
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 14.5.1 | 1-2 strikes → warning notification | Warning sent | [ ] |
| 14.5.2 | 3+ strikes → account flagged for review | Account flagged | [ ] |

### 14.6 Automated No-Show Detection
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 14.6.1 | 10 min after start, no GPS arrival → both notified | Notifications sent | [ ] |
| 14.6.2 | Trainee gets "Your trainer has not arrived" message | Message received | [ ] |
| 14.6.3 | Trainer gets "You haven't confirmed arrival" message | Message received | [ ] |

---

## SECTION 15: RATINGS & REVIEWS

| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 15.1 | Rate a trainer (1-5 stars) | Rating submitted | [ ] |
| 15.2 | Star Rating is required | Cannot submit without stars | [ ] |
| 15.3 | Written review is optional | Can submit without text | [ ] |
| 15.4 | Submit with text review | Review saved and displayed | [ ] |
| 15.5 | "Rate Your Session" notification sent 30 min after end | Notification received | [ ] |
| 15.6 | View trainer ratings/reviews | All reviews displayed | [ ] |

---

## SECTION 16: ACHIEVEMENTS & STREAKS

### 16.1 Trainee Achievements
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 16.1.1 | First Session badge | Unlocked after 1 session | [ ] |
| 16.1.2 | 5 Sessions badge | Unlocked after 5 sessions | [ ] |
| 16.1.3 | 10 Sessions badge | Unlocked after 10 sessions | [ ] |
| 16.1.4 | 25 Sessions badge | Progress tracked | [ ] |
| 16.1.5 | 50 Sessions badge | Progress tracked | [ ] |
| 16.1.6 | 100 Sessions badge | Progress tracked | [ ] |

### 16.2 Streaks
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 16.2.1 | Streak counts consecutive weeks with ≥1 session | Count accurate | [ ] |
| 16.2.2 | Streak appears in profile | Streak shown | [ ] |
| 16.2.3 | Streak appears in session summaries | Streak shown | [ ] |
| 16.2.4 | "Don't Lose Your Streak!" sent after 6 days w/o session | Reminder sent | [ ] |

---

## SECTION 17: NOTIFICATIONS

### 17.1 Notification Types (Verify Each Exists)
| # | Notification Type | Trigger | Status |
|---|-------------------|---------|--------|
| 17.1.1 | Session Requested | New booking received | [ ] |
| 17.1.2 | Session Accepted | Trainer accepted | [ ] |
| 17.1.3 | Session Declined | Trainer declined | [ ] |
| 17.1.4 | Session Reminder | 30 min before start | [ ] |
| 17.1.5 | Session Started | Session in progress | [ ] |
| 17.1.6 | Session Ended | Session completed | [ ] |
| 17.1.7 | Session Auto-Ended | Virtual max duration | [ ] |
| 17.1.8 | Virtual Request | Instant match needed | [ ] |
| 17.1.9 | Virtual Matched | Matched with trainer | [ ] |
| 17.1.10 | Virtual Taken | Another trainer accepted | [ ] |
| 17.1.11 | Missed Acceptance | Session still available | [ ] |
| 17.1.12 | Late Warning | Running late | [ ] |
| 17.1.13 | Rate Reminder | Rate after session | [ ] |
| 17.1.14 | Streak Warning | Don't lose streak | [ ] |
| 17.1.15 | Boost Expiring | Boost expires in 24hr | [ ] |
| 17.1.16 | Payment Released | Earnings deposited | [ ] |
| 17.1.17 | New Message | Chat message received | [ ] |
| 17.1.18 | Trainer On The Way | GPS en route | [ ] |
| 17.1.19 | Selfie Verified | Attendance selfie submitted | [ ] |
| 17.1.20 | Summary Ready | Post-session stats ready | [ ] |

### 17.2 Notification Preferences
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 17.2.1 | Navigate to Profile > Notification Preferences | Settings screen opens | [ ] |
| 17.2.2 | Toggle individual notification types on/off | Toggles work | [ ] |
| 17.2.3 | Master Toggle: Push Enabled on/off | All notifications toggled | [ ] |

---

## SECTION 18: SAFETY, FRAUD DETECTION & REPORTING

### 18.1 Automated Safety Protections
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 18.1.1 | GPS Spoofing: location jump > 2mi in < 30sec | Account flagged + warning shown | [ ] |
| 18.1.2 | Trolling: 3+ cancelled/fake requests in 1 hour | Account flagged for fraud | [ ] |
| 18.1.3 | High Cancel Rate: >50% on 5+ sessions | Trainer auto-flagged | [ ] |
| 18.1.4 | Suspicious patterns: rapid requests, mass cancellations | Automated alerts triggered | [ ] |

### 18.2 Report a User
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 18.2.1 | "Report" button on user profile | Button visible | [ ] |
| 18.2.2 | Report reasons: Inappropriate, Harassment, Fraud, Safety, Other | All options present | [ ] |
| 18.2.3 | Submit report | Report saved and acknowledged | [ ] |

### 18.3 Block a User
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 18.3.1 | Tap "Block User" on profile or in chat | User blocked | [ ] |
| 18.3.2 | Blocked user cannot message you | Messaging blocked | [ ] |
| 18.3.3 | Blocked user cannot see your profile | Profile hidden | [ ] |
| 18.3.4 | Blocked user cannot book sessions with you | Booking blocked | [ ] |
| 18.3.5 | Navigate to Profile > Blocked Users | Blocked list shown | [ ] |
| 18.3.6 | Unblock user | User unblocked | [ ] |

---

## SECTION 19: ADMIN DASHBOARD

| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 19.1 | Login as admin (admin@rapidreps.com / admin123) | Admin dashboard loads | [ ] |
| 19.2 | Dashboard: Total Users displayed | Count shown | [ ] |
| 19.3 | Dashboard: Total Sessions displayed | Count shown | [ ] |
| 19.4 | Dashboard: Total Revenue displayed | Revenue shown | [ ] |
| 19.5 | Dashboard: Active Trainers count | Count shown | [ ] |
| 19.6 | Session distribution chart (donut) | Chart renders | [ ] |
| 19.7 | Revenue over time chart (bar) | Chart renders | [ ] |
| 19.8 | View All Users (search + filter) | Users list with search | [ ] |
| 19.9 | View User Detail | Full user info | [ ] |
| 19.10 | Delete User | User deleted | [ ] |
| 19.11 | Send Message to user | Message sent | [ ] |
| 19.12 | Pending Verifications list | Pending trainers shown | [ ] |
| 19.13 | Verify/Approve Trainer | Trainer verified | [ ] |
| 19.14 | Reject Trainer | Trainer rejected | [ ] |
| 19.15 | Revenue Dashboard | Revenue data shown | [ ] |
| 19.16 | Payout Requests | Pending payouts listed | [ ] |
| 19.17 | Process Payout | Payout processed | [ ] |
| 19.18 | Issue Refund | Refund issued | [ ] |
| 19.19 | Transaction History | All transactions listed | [ ] |
| 19.20 | Top Trainer Leaderboard | Weekly sessions, rating, earnings | [ ] |
| 19.21 | Fraud & Safety: View flagged accounts | Flagged accounts shown | [ ] |
| 19.22 | Fraud & Safety: Take action (warn/suspend/ban) | Action applied | [ ] |

---

## SECTION 20: ACCOUNT SETTINGS

### 20.1-20.3 General Settings
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 20.1 | Edit Profile: Update name, photo, bio | Changes saved | [ ] |
| 20.2 | Change Password (via Forgot Password flow) | Password updated | [ ] |
| 20.3 | Notification Preferences: Toggle types on/off | Changes saved | [ ] |

### 20.4 Sound & Vibration Settings
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 20.4.1 | Button Tap Sounds: On/Off (default: On) | Toggle works | [ ] |
| 20.4.2 | Vibration Feedback: On/Off (default: On) | Toggle works | [ ] |
| 20.4.3 | Notification Ringtone: Default/Soft/Silent (default: Default) | Selection works | [ ] |
| 20.4.4 | Mute All During Session: On/Off (default: Off) | Toggle works | [ ] |
| 20.4.5 | Mute mode silences all sounds during active session | Sounds muted | [ ] |

### 20.5 Delete Account
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 20.5.1 | "Delete Account" button at bottom of Profile | Button visible | [ ] |
| 20.5.2 | Confirmation dialog appears | Dialog shown | [ ] |
| 20.5.3 | Confirm: All data permanently deleted | Account gone | [ ] |

---

## SECTION 22: SAMPLE TRAINER PROFILE (Manual Point #11)

| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 22.1 | Sample profile visible in manual/onboarding | "Alex T. — HIIT/Strength/Boxing — 4.9 (284 reviews)" | [ ] |
| 22.2 | Pricing shown: $40 Outdoor, $60 In-Home, $30 Virtual | Prices match | [ ] |

---

## CROSS-CUTTING CONCERNS

### Authentication
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| CC.1 | All protected endpoints return 401 without token | Unauthorized error | [ ] |
| CC.2 | Expired token returns 401 | Token expired error | [ ] |
| CC.3 | Invalid token returns 401 | Invalid token error | [ ] |

### Data Validation
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| CC.4 | Missing required fields → 422 error | Validation error returned | [ ] |
| CC.5 | Invalid data types → 422 error | Validation error returned | [ ] |

### Role-Based Access
| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| CC.6 | Trainee cannot access trainer-only endpoints | 403 Forbidden | [ ] |
| CC.7 | Trainer cannot access admin endpoints | 403 Forbidden | [ ] |
| CC.8 | Admin can access all endpoints | Full access | [ ] |

---

## TEST SUMMARY

| Section | Total Tests | Pass | Fail | Skip |
|---------|------------|------|------|------|
| 1. Infrastructure | 3 | | | |
| 2. Authentication | 17 | | | |
| 3. Trainee Guide | 35 | | | |
| 4. Trainer Guide | 28 | | | |
| 5. Session Workflows | 20 | | | |
| 6. Matching Engine | 28 | | | |
| 7. GPS Tracking | 17 | | | |
| 8. Selfie Verification | 12 | | | |
| 9. Post-Session Summary | 11 | | | |
| 10. Messaging | 7 | | | |
| 11. Payments & Pricing | 15 | | | |
| 12. Membership | 13 | | | |
| 13. Boosts | 14 | | | |
| 14. Cancellation & No-Show | 16 | | | |
| 15. Ratings & Reviews | 6 | | | |
| 16. Achievements & Streaks | 10 | | | |
| 17. Notifications | 23 | | | |
| 18. Safety & Fraud | 10 | | | |
| 19. Admin Dashboard | 22 | | | |
| 20. Settings | 8 | | | |
| 22. Sample Profile | 2 | | | |
| Cross-Cutting | 8 | | | |
| **TOTAL** | **~295** | | | |

---

**Notes / Issues Found:**

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

---

*RapidReps v3.0 Manual Testing Checklist — Generated February 2026*
