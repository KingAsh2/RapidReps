/**
 * RapidReps Login — Design version switcher. See /app/frontend/.env
 * EXPO_PUBLIC_UI_VERSION for rollback.
 */
import { UI_VERSION } from '../../src/theme/premium';
import PremiumLogin from './login.premium';
import ClassicLogin from './login.classic';

export default UI_VERSION === 'classic' ? ClassicLogin : PremiumLogin;
