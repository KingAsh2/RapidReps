// This file re-exports from the platform-specific implementations
// Metro bundler will automatically select .native.tsx for iOS/Android
// and .web.tsx for web platform

import { Platform } from 'react-native';

// For non-native platforms, use the web fallback
const FindTrainersScreen = Platform.select({
  native: () => require('./find-trainers.native').default,
  default: () => require('./find-trainers.web').default,
});

export default FindTrainersScreen();
