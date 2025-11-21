// App Constants
export const APP_NAME = 'RunRoute';

// Colors
export const COLORS = {
  primary: '#007AFF',
  secondary: '#5856D6',
  success: '#34C759',
  danger: '#FF3B30',
  warning: '#FF9500',
  info: '#5AC8FA',

  background: '#FFFFFF',
  backgroundSecondary: '#F2F2F7',
  surface: '#FFFFFF',
  text: '#000000',
  textSecondary: '#8E8E93',
  border: '#C6C6C8',

  // Map markers
  startMarker: '#34C759', // Green
  endMarker: '#FF3B30',   // Red
  waypointMarker: '#007AFF', // Blue

  // Route colors
  plannedRoute: '#007AFF',
  activeRoute: '#34C759',
  completedRoute: '#5856D6',
  plannedRouteOverlay: '#007AFF', // Blue for planned route on tracking screen
  liveTrailActive: '#34C759',      // Green for GPS trail
};

// Typography
export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  semibold: 'System',
};

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Map Configuration
export const MAP_CONFIG = {
  defaultLatitude: 37.78825,
  defaultLongitude: -122.4324,
  defaultLatitudeDelta: 0.0922,
  defaultLongitudeDelta: 0.0421,
  minZoomLevel: 10,
  maxZoomLevel: 20,
};

// Distance & Speed Units
export const UNITS = {
  distance: 'km', // or 'mi'
  speed: 'km/h', // or 'mph'
};

// GPS Tracking
export const GPS_CONFIG = {
  accuracy: 5, // Location.Accuracy.High
  distanceInterval: 10, // meters
  timeInterval: 1000, // milliseconds
};

// API Configuration
export const API_CONFIG = {
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
};

// Route Generation
export const ROUTE_CONFIG = {
  minDistance: 0.5, // km
  maxDistance: 100, // km
  defaultDistance: 5, // km
  distanceTolerancePercent: 10, // Allow 10% variance from target
};

// Social Feed
export const FEED_CONFIG = {
  postsPerPage: 20,
  maxImageSize: 5 * 1024 * 1024, // 5MB
};
