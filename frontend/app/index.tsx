/**
 * RapidReps Welcome — Design version + A/B variant switcher.
 *
 * iter96b: variant assignment moved from env-flag to per-device hash.
 *
 * Read at bundle time from /app/frontend/.env:
 *   EXPO_PUBLIC_UI_VERSION         = "premium" (default) | "classic"
 *   EXPO_PUBLIC_WELCOME_VARIANT    = "A" | "B"  ← QA force-override only.
 *                                     When unset, variant is chosen by a
 *                                     stable FNV hash of a per-install UUID.
 *
 * Routing:
 *   classic               → ./index.classic.tsx
 *   premium  + variant=A  → ./index.premium.tsx   ("DELIVERED RAPIDLY" hero)
 *   premium  + variant=B  → ./index.premium-b.tsx ("TRAINERS NEAR YOU" community hero)
 */
import React from 'react';
import { UI_VERSION } from '../src/theme/premium';
import { useWelcomeVariant } from '../src/utils/abVariant';
import PremiumWelcome from './index.premium';
import PremiumWelcomeB from './index.premium-b';
import ClassicWelcome from './index.classic';

export default function WelcomeRouter() {
  const variant = useWelcomeVariant();
  if (UI_VERSION === 'classic') return <ClassicWelcome />;
  return variant === 'B' ? <PremiumWelcomeB /> : <PremiumWelcome />;
}
