# Phase 8: Profile & Settings

## Overview
This phase implements the user profile feature, allowing users to view their profile with statistics, edit their profile information, and manage app settings including logout functionality.

## Completed Features

### 1. Profile Service (profileService.ts)
- **getProfile()**: Fetch user profile with stats
- **getUserStats()**: Calculate running statistics from runs table
- **updateProfile()**: Update user profile information
- **getRecentRuns()**: Fetch recent runs for profile display

### 2. Profile Screen (ProfileScreen.tsx)
- **User Header**:
  - Avatar (image or initial placeholder)
  - Name and email display
  - Edit Profile and Settings buttons
- **Statistics Section**:
  - Total runs count
  - Total distance (km)
  - Total time
  - Average pace
- **Personal Records**:
  - Longest run
  - Fastest pace
- **Recent Runs**: Last 5 runs with date, distance, duration, pace
- **Logout Button**: Red logout button at bottom
- **Pull-to-Refresh**: Refresh profile data

### 3. Edit Profile Screen (EditProfileScreen.tsx)
- **Avatar Preview**: Shows current avatar or initial
- **Form Fields**:
  - Name input (editable)
  - Email display (read-only)
  - Avatar URL input (optional)
- **Action Buttons**: Cancel and Save Changes
- **Validation**: Name is required
- **Success/Error Alerts**: Feedback on save

### 4. Settings Screen (SettingsScreen.tsx)
- **Units Section**:
  - Metric/Imperial toggle
- **Privacy Section**:
  - Public profile toggle
  - Show on map toggle
  - Allow comments toggle
- **About Section**:
  - App version
  - Terms of Service link
  - Privacy Policy link
- **Account Section**:
  - Log out option
  - Delete account option (with confirmation)

### 5. Navigation
- **ProfileStackNavigator**: Stack navigator for Profile tab
  - UserProfile screen (main)
  - EditProfile screen
  - Settings screen
- **Typed Navigation**: Full TypeScript support with ProfileStackParamList

## File Structure

```
src/
├── screens/
│   └── profile/
│       ├── ProfileScreen.tsx      # Main profile view with stats
│       ├── EditProfileScreen.tsx  # Edit profile form
│       └── SettingsScreen.tsx     # App settings
├── navigation/
│   └── ProfileStackNavigator.tsx  # Profile tab stack navigator
└── services/
    └── profileService.ts          # Profile API operations
```

## API Integration

### profileService Methods
```typescript
// Get user profile with stats
getProfile(userId: string): Promise<ProfileData | null>

// Get user statistics
getUserStats(userId: string): Promise<UserStats>

// Update profile
updateProfile(userId: string, updates: Partial<User>): Promise<User>

// Get recent runs
getRecentRuns(userId: string, limit: number): Promise<Run[]>
```

### UserStats Interface
```typescript
interface UserStats {
  totalRuns: number;
  totalDistance: number;     // in km
  totalDuration: number;     // in seconds
  averagePace: number;       // seconds per km
  longestRun: number;        // in km
  fastestPace: number;       // seconds per km
}
```

## Data Flow

1. **Profile Screen**:
   - Fetches user from auth store
   - Calls profileService.getUserStats() and getRecentRuns()
   - Displays formatted statistics

2. **Edit Profile**:
   - Loads current user data from auth store
   - User edits name/avatar URL
   - Calls authStore.updateProfile()
   - Navigates back on success

3. **Settings**:
   - Toggles stored locally (would persist in real app)
   - Logout calls authStore.signOut()
   - Delete account shows contact info

## UI Components

### Profile Header
- Large circular avatar (100x100)
- Name and email
- Two action buttons side by side

### Statistics Grid
- 2x2 grid of stat cards
- Primary color for values
- Descriptive labels

### Personal Records Card
- Conditional display (only if runs exist)
- Key-value pairs

### Recent Runs List
- Compact run summaries
- Date + stats in single row

### Settings Rows
- Toggle switches with descriptions
- Link rows with arrows
- Destructive actions in red

## Auth Store Integration

The profile feature uses the existing auth store:
- `user`: Current user data
- `signOut()`: Logout functionality
- `updateProfile()`: Profile updates

## Future Enhancements
- [ ] Avatar image upload (camera/gallery)
- [ ] Units preference persistence
- [ ] Privacy settings persistence
- [ ] Theme selection (light/dark)
- [ ] Change password functionality
- [ ] Email verification
- [ ] Export user data
- [ ] Account deletion API integration
