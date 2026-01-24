// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  // Privacy settings
  show_on_map?: boolean;
  allow_comments?: boolean;
  public_profile?: boolean;
}

// Privacy settings type for updates
export interface PrivacySettings {
  show_on_map: boolean;
  allow_comments: boolean;
  public_profile: boolean;
}

// Location Types
export interface Location {
  latitude: number;
  longitude: number;
}

export interface LocationWithTimestamp extends Location {
  timestamp: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
}

// Route Types
export interface Waypoint extends Location {
  id: string;
  order: number;
}

export interface Route {
  id?: string;
  user_id?: string;
  name?: string; // User-defined route name
  start_location: Location;
  end_location: Location;
  waypoints: Waypoint[];
  polyline: Location[];
  distance: number; // in kilometers
  estimated_duration?: number; // in seconds
  is_loop: boolean;
  target_distance?: number;
  created_at?: string;
}

// Community Routes Types
export interface RouteWithAttribution extends Route {
  is_community_route?: boolean;
  save_count?: number;
  original_run_id?: string;
  original_user_id?: string;
  source_type?: 'own_run' | 'social_post' | 'manual';
}

export interface RouteSave {
  id: string;
  route_id: string;
  saved_by_user_id: string;
  original_run_id?: string;
  source_post_id?: string;
  source_type: 'own_run' | 'social_post';
  created_at: string;
}

export interface RouteAttributionData {
  route: Route;
  originalUser?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  saveCount: number;
  savedByCurrentUser: boolean;
}

// Pace Interval Types
export interface PaceInterval {
  distance: number; // in kilometers
  pace: number; // seconds per km
  duration: number; // in seconds
  elevationGain?: number; // in meters
}

// Run Types
export interface Run {
  id: string;
  user_id: string;
  route_id?: string;
  start_time: string;
  end_time: string;
  duration: number; // in seconds
  distance: number; // in kilometers
  average_pace: number; // min/km
  average_speed: number; // km/h
  polyline: Location[];
  elevation_gain?: number;
  calories_burned?: number;
  intervals?: PaceInterval[]; // NEW: Pace intervals (km or mile splits)
  created_at: string;
  updated_at: string;
}

// Social Types
export interface RunPost {
  id: string;
  user_id: string;
  run_id: string;
  caption?: string;
  image_url?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;

  // Joined data
  user?: User;
  run?: Run;
  liked_by_current_user?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;

  // Joined data
  user?: User;
}

export interface Like {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  followers_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
}

export interface UserWithFollowStatus extends UserProfile {
  is_following: boolean;
}

// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Routes: undefined;
  History: undefined;
  Social: undefined;
  Profile: undefined;
};

export type PlanStackParamList = {
  RoutePlanner: undefined;
  RoutePreview: { route: Route };
};

export type TrackStackParamList = {
  RunTracker: undefined;
  RunSummary: { run: Run };
};

export type RoutesStackParamList = {
  RoutesHub: undefined;
  PlanRoute: undefined;
  SavedRoutes: undefined;
  RouteDetail: { routeId: string };
  RunTracker: undefined;
  RunSummary: { run: Run };
};

export type HistoryStackParamList = {
  RunHistory: undefined;
  RunDetail: { runId: string };
  Analytics: undefined;
  RunComparison: { runIds: string[] };
};

export type SocialStackParamList = {
  Feed: undefined;
  PostDetail: { postId: string };
  UserProfile: { userId: string };
  CreatePost: undefined;
  Followers: { userId: string };
  Following: { userId: string };
  Search: undefined;
};

export type ProfileStackParamList = {
  UserProfile: undefined;
  Settings: undefined;
  EditProfile: undefined;
};

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Store Types
export interface AuthState {
  user: User | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

export interface RouteState {
  currentRoute: Route | null;
  isGenerating: boolean;
  error: string | null;
  setRoute: (route: Route) => void;
  generateRoute: (params: {
    startLocation: Location;
    endLocation: Location;
    targetDistance: number;
    isLoop: boolean;
  }) => Promise<void>;
  updateWaypoint: (waypointId: string, newLocation: Location) => Promise<void>;
  clearRoute: () => void;
}

export interface TrackingState {
  isTracking: boolean;
  isPaused: boolean;
  currentRun: Partial<Run> | null;
  locations: LocationWithTimestamp[];
  distance: number;
  duration: number;
  pace: number;
  startTracking: () => void;
  pauseTracking: () => void;
  resumeTracking: () => void;
  stopTracking: () => Promise<Run>;
  addLocation: (location: LocationWithTimestamp) => void;
}
