/**
 * RapidReps Welcome — Design version switcher.
 * Reads EXPO_PUBLIC_UI_VERSION from /app/frontend/.env at bundle time.
 *   - "premium" (default) → ./index.premium.tsx (Iteration 89 redesign)
 *   - "classic"           → ./index.classic.tsx (preserved original)
 * Rollback path: set EXPO_PUBLIC_UI_VERSION=classic and restart Expo.
 */
import { UI_VERSION } from '../src/theme/premium';
import PremiumWelcome from './index.premium';
import ClassicWelcome from './index.classic';

export default UI_VERSION === 'classic' ? ClassicWelcome : PremiumWelcome;
