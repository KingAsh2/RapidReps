/**
 * RapidReps Signup — Design version switcher. See /app/frontend/.env
 * EXPO_PUBLIC_UI_VERSION for rollback.
 */
import { UI_VERSION } from '../../src/theme/premium';
import PremiumSignup from './signup.premium';
import ClassicSignup from './signup.classic';

export default UI_VERSION === 'classic' ? ClassicSignup : PremiumSignup;
