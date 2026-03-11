import { router, useNavigationContainerRef } from 'expo-router';

/**
 * Smart back navigation that handles edge cases:
 * - If there's navigation history, goes back
 * - If no history exists (e.g., deep link), navigates to fallback
 * @param fallbackPath - Path to navigate to if no history exists
 */
export const goBack = (fallbackPath?: string) => {
  try {
    // Check if we can go back
    if (router.canGoBack()) {
      router.back();
    } else if (fallbackPath) {
      // Navigate to fallback if provided
      router.replace(fallbackPath as any);
    } else {
      // Default fallback based on common patterns
      router.replace('/');
    }
  } catch (error) {
    console.warn('Navigation error:', error);
    // Ultimate fallback
    if (fallbackPath) {
      router.replace(fallbackPath as any);
    } else {
      router.replace('/');
    }
  }
};

/**
 * Get appropriate fallback path based on user role
 * @param role - User's role ('trainer', 'trainee', 'admin')
 */
export const getRoleFallback = (role?: string): string => {
  switch (role) {
    case 'trainer':
      return '/trainer/(tabs)/home';
    case 'trainee':
      return '/trainee/(tabs)/home';
    case 'admin':
      return '/admin/dashboard';
    default:
      return '/';
  }
};
