// Re-export the platform-specific implementation
import { Platform } from 'react-native';

// This file serves as a resolver for the platform-specific implementations
// - NearbyTrainersMap.native.tsx for iOS/Android
// - NearbyTrainersMap.web.tsx for web

export { default } from './NearbyTrainersMap.native';
