/**
 * RapidReps dark map theme.
 *
 * Shared Google-Maps JSON style used by:
 *  - NearbyTrainersMap (native): trainee discovery
 *  - EnRouteMap:                 live trainer tracking
 *
 * Palette is deliberately near-black with a subtle orange (#FF6A00) highway
 * accent so the trainer's route pops without visual noise. POIs & transit are
 * hidden — the map is a canvas for our own markers, not a tourist map.
 *
 * Note: `customMapStyle` only takes effect when the underlying provider is
 * Google Maps (Android by default, iOS if PROVIDER_GOOGLE is passed AND the
 * app has the Google Maps SDK linked). On iOS with the default Apple Maps
 * provider, this style is a no-op — Apple Maps uses `mapType` / `userInterfaceStyle`
 * instead. We keep the style unconditional here for consistency; callers can
 * still gate it by Platform if needed.
 */
export const MAP_DARK_STYLE = [
  // Base surfaces
  { elementType: 'geometry', stylers: [{ color: '#080C12' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#080C12' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#2A3545' }] },

  // Roads — muted so trainer markers dominate
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#111822' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0D1117' }] },
  // Subtle brand-orange tint on highways so the "route" reads as RapidReps
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1A1410' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#FF6A00' }, { weight: 0.35 }] },

  // Water & land
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060A10' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0A0E14' }] },

  // Kill noise
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  // Administrative boundaries — barely visible
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#111822' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#344155' }] },
];

export default MAP_DARK_STYLE;
