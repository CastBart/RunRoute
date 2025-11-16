// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
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

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;

  // Joined data
  friend?: User;
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
  Plan: undefined;
  Track: undefined;
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

export type HistoryStackParamList = {
  RunHistory: undefined;
  RunDetail: { runId: string };
};

export type SocialStackParamList = {
  Feed: undefined;
  PostDetail: { postId: string };
  UserProfile: { userId: string };
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
