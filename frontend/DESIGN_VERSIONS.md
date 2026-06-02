# RapidReps Design Versions — Classic ↔ Premium

The Welcome, Login, and Signup screens ship in **two** complete designs:

| Version | Aesthetic | Default? |
|---|---|---|
| **RapidReps Classic** | Original v1.0 mockups (preserved verbatim) | No |
| **RapidReps Premium** | Iteration 89 — Nike × Uber × Gymshark cinematic | ✅ Yes |

## How the switcher works

Each entry file (`/app/frontend/app/index.tsx`, `/app/frontend/app/auth/login.tsx`,
`/app/frontend/app/auth/signup.tsx`) is a 5-line module that imports both
variants and picks one at bundle time based on `EXPO_PUBLIC_UI_VERSION`:

```ts
import { UI_VERSION } from '../src/theme/premium';
import PremiumWelcome from './index.premium';
import ClassicWelcome from './index.classic';
export default UI_VERSION === 'classic' ? ClassicWelcome : PremiumWelcome;
```

## Rollback to Classic in 30 seconds

```bash
# 1. Open /app/frontend/.env and change:
EXPO_PUBLIC_UI_VERSION=classic

# 2. Restart Expo to re-bake env vars into the bundle:
sudo supervisorctl restart expo
```

No git, no rebuild, no data loss. The classic implementations are byte-for-byte
copies of what shipped before iter89 and live alongside the premium versions:

```
/app/frontend/app/
  index.tsx              ← thin switcher
  index.premium.tsx      ← iter89 premium
  index.classic.tsx      ← original (rollback target)
  auth/
    login.tsx            ← thin switcher
    login.premium.tsx
    login.classic.tsx
    signup.tsx           ← thin switcher
    signup.premium.tsx
    signup.classic.tsx
```

## Forward (re-enable Premium)

```bash
# /app/frontend/.env
EXPO_PUBLIC_UI_VERSION=premium

sudo supervisorctl restart expo
```

## Design system tokens

`/app/frontend/src/theme/premium.ts` is the single source of truth for the
premium color palette, gradients, shadows, type ramp, and the runtime
`UI_VERSION` flag.

## What's preserved (untouched)

- All auth APIs and `useAuth().login / signup`
- Apple + Google `SocialAuthButtons`
- All routing (`/auth/forgot-password`, `/legal/terms`, `/legal/privacy`,
  `/auth/onboarding-trainee`, `/auth/onboarding-trainer`)
- Every other screen in the app (admin, trainer dashboard, sessions,
  messaging, GPS, etc.)
