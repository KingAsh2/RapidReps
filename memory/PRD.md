# RapidReps - Fitness Training App

## Original Problem Statement
A full-stack React Native/Expo fitness application connecting trainees with personal trainers. Includes session booking, payments via Stripe, messaging, trainer verification, group sessions, streaks/gamification, and a mandatory in-person session verification system.

## Tech Stack
- **Frontend:** React Native / Expo (v54) with Expo Router
- **Backend:** FastAPI (Python) + MongoDB
- **Payments:** Stripe | **Auth:** JWT | **QR Codes:** react-native-qrcode-svg + expo-camera
- **Current Version:** 3.0.7

## Recent Changes

### Uber-Like UI Components (March 2026 - NEW)
Created reusable components for Uber-style UX:

1. **SessionTimeline Component** (`/src/components/SessionTimeline.tsx`)
   - Visual timeline: Requested → Confirmed → En Route → Arrived → In Progress → Completed
   - Animated step indicators with current status highlighting
   - ETA badge display when trainer is en route
   - Compact mode for inline display

2. **QuickActions Component** (`/src/components/QuickActions.tsx`)
   - Floating action buttons: Call, Message, Cancel
   - Gradient styling matching app theme
   - Haptic feedback on interactions
   - FloatingQuickActions variant for map overlay

3. **TrainerBottomSheet Component** (`/src/components/TrainerBottomSheet.tsx`)
   - Swipe-up bottom sheet for trainer selection
   - Collapsed state shows selected trainer
   - Expanded state shows full trainer list
   - Selection highlighting and "Book Now" button
   - ETA badges and pricing display

### Build Fix (March 2026)
- Fixed yarn.lock version conflicts:
  - `react-native-reanimated`: 4.1.1
  - `react-native-worklets`: 0.5.1
  - `react-native-gesture-handler`: 2.28.0
- Fixed hardcoded URLs in email_service.py

### Previous Features - COMPLETE
- Outdoor Location Agreement (propose/accept location)
- Arrival Confirmation System (both parties)
- Dynamic Data Refresh (15s polling)
- Flexible Session Pricing (per-duration rates)
- All crash fixes (Slider, notification, animation)

## Key API Endpoints
| Endpoint | Description |
|----------|-------------|
| POST /api/sessions/{id}/gps-update | Real-time GPS tracking |
| PUT /api/trainer/location | Update trainer location |
| GET /api/trainer/my-location-status | Get trainer location status |
| POST /api/sessions/{id}/propose-location | Propose outdoor location |
| POST /api/sessions/{id}/trainer-arrived | Trainer confirms arrival |
| POST /api/sessions/{id}/trainee-arrived | Trainee confirms arrival |

## Files Created This Session
- `/app/frontend/src/components/SessionTimeline.tsx` - Activity timeline
- `/app/frontend/src/components/QuickActions.tsx` - Floating action buttons
- `/app/frontend/src/components/TrainerBottomSheet.tsx` - Trainer selection sheet

## Integration Notes
The new Uber-like components are created and ready for integration:

### To integrate SessionTimeline:
```tsx
import { SessionTimeline } from '../src/components/SessionTimeline';
<SessionTimeline currentStatus="en_route" eta="5 min" />
```

### To integrate QuickActions:
```tsx
import { QuickActions, FloatingQuickActions } from '../src/components/QuickActions';
<FloatingQuickActions 
  sessionId={session.id}
  otherPartyName={trainerName}
  otherPartyPhone={trainerPhone}
  otherPartyId={trainerId}
  role="trainee"
/>
```

### To integrate TrainerBottomSheet:
```tsx
import TrainerBottomSheet from '../src/components/TrainerBottomSheet';
<TrainerBottomSheet
  trainers={nearbyTrainers}
  selectedTrainerId={selectedId}
  onSelectTrainer={(t) => setSelectedId(t.id)}
  onBookTrainer={(t) => handleBook(t)}
  isVisible={true}
/>
```

## Remaining Integration Work
- [ ] Add SessionTimeline to session-detail.tsx screens
- [ ] Add FloatingQuickActions to trainer-en-route.tsx
- [ ] Replace trainer list with TrainerBottomSheet on trainee home
- [ ] Add auto-arrival detection notification

## Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |
| Trainee | test_trainee_iter25@test.com | Test123! |
| Trainer | test_trainer_iter25@test.com | Test123! |

## Test Reports
- `/app/test_reports/iteration_45.json` - Location/arrival endpoints verified

## Mocked: SendGrid (awaiting API key)
