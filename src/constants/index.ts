// App Constants
export const APP_NAME = 'RunRoute';

// Colors - Vibrant Running Theme
export const COLORS = {
  // Primary brand colors
  primary: '#FF6B35',      // Energetic orange - represents energy/running
  secondary: '#4ECDC4',    // Teal - complementary accent
  success: '#10B981',      // Emerald green
  danger: '#EF4444',       // Red
  warning: '#F59E0B',      // Amber
  info: '#3B82F6',         // Blue

  // Surface colors
  background: '#FAFAFA',   // Warm off-white
  backgroundSecondary: '#F3F4F6',  // Light gray
  surface: '#FFFFFF',      // Pure white for cards
  text: '#1F2937',         // Dark gray (softer than black)
  textSecondary: '#6B7280', // Medium gray
  border: '#E5E7EB',       // Light border

  // Map markers
  startMarker: '#10B981',  // Green
  endMarker: '#EF4444',    // Red
  waypointMarker: '#FF6B35', // Primary orange

  // Route colors
  plannedRoute: '#FF6B35', // Primary orange for planned routes
  activeRoute: '#10B981',  // Green for active tracking
  completedRoute: '#4ECDC4', // Teal for completed
  plannedRouteOverlay: '#FF6B35', // Orange for planned route on tracking screen
  liveTrailActive: '#10B981',      // Green for GPS trail
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
