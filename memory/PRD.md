# RapidReps - Product Requirements Document

## Problem Statement
RapidReps is a mobile fitness platform connecting personal trainers with trainees. Trainers can manage profiles, sessions, and get paid via Stripe Connect. Trainees can discover, book, and track sessions with trainers. The platform handles pricing, payments, scheduling, messaging, and real-time en-route tracking.

## Architecture
- **Frontend**: React Native (Expo) with Expo Router, TypeScript
- **Backend**: FastAPI (Python) with MongoDB
- **Payments**: Stripe (Elements + Connect Express)
- **Push Notifications**: Expo Push API
- **Build System**: EAS Build

## What's Been Implemented

### Core Features (Complete)
- User auth (JWT-based) with role-based routing (admin, trainer, trainee)
- Trainer profile creation, editing (bio, rates, certifications, photo/video URLs)
- Trainer search with filters (location, specialty, availability)
- Session booking flow with pricing calculator
- Stripe payment integration (payment intents, Connect onboarding)
- Real-time messaging (conversations, messages)
- Admin dashboard (user management, verification, payouts)

### Bug Fixes (March 5, 2026)
- **P0**: Fixed pricing formula to `(trainer_rate / 0.8) + $2 service fee` — trainers earn their full set rate
- **P1**: Fixed Stripe Connect logging and error handling
- **P1**: Fixed trainer profile endpoint to enrich fullName from users collection
- **P2**: Added profilePhotoUrl and introVideoUrl fields to edit profile
- **P3**: Replaced orange gym backgrounds with blue-themed version

### Stripe Payment Integration (March 5, 2026)
- **Payment Sheet**: Wired up `@stripe/stripe-react-native` Payment Sheet in confirm-booking flow
  - Creates PaymentIntent via backend → initializes Payment Sheet → presents native card UI → handles success/cancel/error
  - Graceful fallback for web preview where native SDK isn't available
- **Connect Express**: Stripe Connect onboarding generates real onboarding URLs for trainers
- Both live keys configured (backend `STRIPE_SECRET_KEY`, frontend `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`)
- **Auth resilience**: Token only cleared on 401, not on transient network errors
- **Success modals**: Verification submission, booking confirmation, and en-route arrival show proper modals instead of toasts + redirects
- **Trainer en-route screen** (`/trainer/en-route`): GPS sharing, distance/ETA tracking, navigation via native maps, "I've Arrived" modal, message trainee
- **Trainee tracking screen** (`/trainee/trainer-en-route`): Real-time distance tracker, animated progress bar, ETA display, message trainer
- **Session tracking API integration**: startEnRoute, gpsUpdate, getGpsTrack, startSession added to frontend API service
- **Track Trainer button**: Trainee sessions tab shows "Track Trainer" for en_route sessions
- **Metro config fix**: Reduced file watcher usage via blockList to prevent ENOSPC crashes

## Key API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| GET/POST | /api/trainer-profiles/{userId} | Get/create trainer profile (enriched with fullName) |
| POST | /api/sessions/book | Book a session |
| POST | /api/sessions/{id}/start-en-route | Trainer starts en-route |
| POST | /api/sessions/{id}/gps-update | Update GPS position |
| GET | /api/sessions/{id}/gps-track | Get live GPS positions |
| POST | /api/sessions/{id}/start-session | Start the session |
| POST | /api/payments/calculate-session-cost | Calculate pricing |
| POST | /api/messages | Send a message |
| GET | /api/conversations | List conversations |
| POST | /api/trainer/connect/onboard | Stripe Connect onboarding |

## DB Schema (Key Collections)
- **users**: fullName, email, passwordHash, roles, profilePhoto, stripeAccountId
- **trainer_profiles**: userId, bio, rates, certifications, avatarUrl, introVideoUrl, location
- **sessions**: traineeId, trainerId, status (requested/confirmed/en_route/in_progress/completed), GPS positions
- **messages**: senderId, receiverId, content, conversationId
- **conversations**: participants, lastMessage

## Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rapidreps.com | admin123 |

## Backlog
- P4: Enable SendGrid email integration (blocked: awaiting API key)
- P5: Resolve 86+ TypeScript strict-mode warnings
- Future: Push notification testing on real devices
- Future: Stripe payment sheet integration for production
