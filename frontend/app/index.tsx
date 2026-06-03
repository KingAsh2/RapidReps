/**
 * RapidReps Welcome — Design version + A/B variant switcher.
 *
 * Read at bundle time from /app/frontend/.env:
 *   EXPO_PUBLIC_UI_VERSION     = "premium" (default) | "classic"
 *   EXPO_PUBLIC_WELCOME_VARIANT = "A" (default) | "B"     ← only consulted when UI_VERSION='premium'
 *
 * Routing:
 *   classic               → ./index.classic.tsx
 *   premium  + variant=A  → ./index.premium.tsx   ("DELIVERED RAPIDLY" hero)
 *   premium  + variant=B  → ./index.premium-b.tsx ("TRAINERS NEAR YOU" community hero)
 *
 * Rollback: set EXPO_PUBLIC_UI_VERSION=classic and restart Expo.
 */
import { UI_VERSION, WELCOME_VARIANT } from '../src/theme/premium';
import PremiumWelcome from './index.premium';
import PremiumWelcomeB from './index.premium-b';
import ClassicWelcome from './index.classic';

const PremiumComponent = WELCOME_VARIANT === 'B' ? PremiumWelcomeB : PremiumWelcome;

export default UI_VERSION === 'classic' ? ClassicWelcome : PremiumComponent;
