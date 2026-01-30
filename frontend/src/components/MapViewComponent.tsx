// MapViewComponent.tsx - Default export (redirects based on platform)
// This file is a fallback - Metro will prefer .native.tsx or .web.tsx
import MapViewComponent from './MapViewComponent.native';
export default MapViewComponent;
export { MapView, PROVIDER_GOOGLE } from './MapViewComponent.native';
