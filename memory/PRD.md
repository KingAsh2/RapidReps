# RapidReps - Fitness Training App

## Original Problem Statement
A full-stack React Native/Expo fitness application connecting trainees with personal trainers. Includes session booking, payments via Stripe, messaging, trainer verification, group sessions, streaks/gamification, and a mandatory in-person session verification system.

## Tech Stack
- **Frontend:** React Native / Expo (v54) with Expo Router
- **Backend:** FastAPI (Python) + MongoDB
- **Payments:** Stripe | **Auth:** JWT | **QR Codes:** react-native-qrcode-svg + expo-camera
- **Current Version:** 2.0.40

## What's Been Implemented

### Session Pricing System (March 2026 - COMPLETE)
- **Per-Duration Pricing:** Trainers can now set custom prices for 30/60/90 minute sessions for each session type (Outdoor, Virtual, At Home)
- **Backend:** `POST /api/trainer/set-rates` accepts `outdoor30Cents`, `outdoor60Cents`, `outdoor90Cents`, etc.
- **Frontend:** `set-rates.tsx` has editable TextInput fields for each duration with earnings preview
- **Legacy Support:** 60-minute rate used as hourly rate for backward compatibility

### Outdoor Location Agreement Flow (March 2026 - COMPLETE)
- **Backend Endpoints:**
  - `POST /api/sessions/{session_id}/propose-location` - Trainer proposes meeting spot
  - `POST /api/sessions/{session_id}/agree-location` - Trainee agrees or counter-proposes
- **Features:** Push notifications for location proposals, counter-proposals, and agreements
- **Frontend:** Needs UI implementation in booking flow (backend is ready)

### Crash Fixes (March 2026 - COMPLETE)
1. **Slider Crash Fix:** Removed `@react-native-community/slider` dependency. Replaced with TouchableOpacity picker modals in `edit-profile.tsx` and `home.tsx`
2. **Notification Cleanup Crash:** Added defensive `typeof .remove === 'function'` check in `NotificationContext.tsx`
3. **Animation Conflict Fix:** Added `stopAnimation()` before starting new animation in `login.tsx`
4. **Toast Fix:** Added missing `toast.info()` method in `src/utils/toast.ts`
5. **Video Timer Cleanup:** Added proper cleanup for video timer in `VerificationsTab.tsx`

### UI/UX Updates (March 2026 - COMPLETE)
- Chat bubble colors changed to orange (sender) and teal/blue (receiver) in `chat/[id].tsx`
- Uber-style map design on trainee home screen with glowing avatars and ETA badges
- Session cards in My Sessions are clickable
- Background info visible in admin verification panel

### Previous Implementations
- Full trainer/trainee flows, Stripe Connect, trainer verification with PII
- Group sessions, Streaks & gamification, referral system
- 508 accessibility compliance, animations & haptic feedback
- Rapid Reps Safety Check System with QR verification
- Session countdown timer with progress bar

## Key API Endpoints
| Endpoint | Description |
|----------|-------------|
| POST /api/auth/login | User login |
| POST /api/trainer/set-rates | Set per-duration pricing |
| GET /api/trainer/sessions | Get trainer's sessions with traineePhone |
| POST /api/sessions/{id}/propose-location | Trainer proposes outdoor location |
| POST /api/sessions/{id}/agree-location | Trainee agrees to location |
| POST /api/safety-check/generate-token/{id} | Generate QR token |
| POST /api/safety-check/verify | Verify QR (client scans) |
| GET /api/admin/verifications | Admin: pending trainer verifications |

## Pending Issues

### P0 - Critical (USER ACTION REQUIRED)
1. **Deploy New Build:** All crash fixes and features are in the codebase but need a new EAS build to be tested on device. User is currently testing old builds.

### P1 - High Priority
1. **Payment/Arrival Confirmation:** Implement system to take payment upon booking and allow both parties to confirm arrival
2. **Admin Video View Issue:** Admin can hear but not see trainer's intro video - may be video encoding issue, not code
3. **Dynamic Data Refresh:** Verify polling works or implement WebSocket for real-time updates

### P2 - Medium Priority
1. **Outdoor Location Agreement UI:** Backend is complete; needs frontend UI in booking flow
2. **Stripe Bank Connection Error:** Handle duplicate Express account creation gracefully
3. **Address Auto-populate:** Pass trainee's address to navigation intent
4. **Trainee Photo/Video in Booking:** Show trainee's media in booking request screen

### P3 - Low Priority
1. **TypeScript Warnings:** ~100+ warnings from strict mode
2. **SendGrid Integration:** Blocked on API key

## Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
| Trainee | test_trainee_iter25@test.com | Test123! |
| Trainer | test_trainer_iter25@test.com | Test123! |

## EAS Build Instructions
To create a new build and test the fixes:
```bash
# In the frontend directory
cd /app/frontend

# For iOS (TestFlight)
eas build --platform ios --profile production

# For Android
eas build --platform android --profile production
```

## Mocked: SendGrid (awaiting API key)
