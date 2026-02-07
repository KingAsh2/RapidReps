// Dynamic Expo configuration - extends app.json with environment variables
export default ({ config }) => {
  // Backend URL from environment variable - no hardcoded URLs
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
  
  return {
    ...config,
    ios: {
      ...config.ios,
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''
      }
    },
    android: {
      ...config.android,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''
        }
      }
    },
    extra: {
      ...config.extra,
      backendUrl: backendUrl,
    }
  };
};
