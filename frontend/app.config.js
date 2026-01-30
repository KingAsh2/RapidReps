// Dynamic Expo configuration - extends app.json with environment variables
export default ({ config }) => {
  // Determine the production backend URL
  // This should match your deployed Emergent backend URL
  const productionBackendUrl = process.env.EXPO_PUBLIC_PRODUCTION_BACKEND_URL || 
    'https://trainer-finder-9.emergent.sh';
  
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
      productionBackendUrl: productionBackendUrl,
    }
  };
};
