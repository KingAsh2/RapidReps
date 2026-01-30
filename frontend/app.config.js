// Dynamic Expo configuration - extends app.json with environment variables
export default ({ config }) => {
  // Production backend URL for Emergent deployment
  const productionBackendUrl = 'https://trainer-finder-9.emergent.sh';
  
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
