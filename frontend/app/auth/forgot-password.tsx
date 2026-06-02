/**
 * RapidReps Forgot Password — Design version switcher. See /app/frontend/.env
 * EXPO_PUBLIC_UI_VERSION for rollback.
 */
import { UI_VERSION } from '../../src/theme/premium';
import PremiumForgotPassword from './forgot-password.premium';
import ClassicForgotPassword from './forgot-password.classic';

export default UI_VERSION === 'classic' ? ClassicForgotPassword : PremiumForgotPassword;
