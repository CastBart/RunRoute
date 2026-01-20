# Phase 9A: Routes Hub & UX Improvements

## Overview

Phase 9A introduces a major user experience improvement by consolidating route planning, saved routes, and run tracking into a unified "Routes" hub screen. This simplifies the app's navigation by removing the separate Plan and Track tabs and replacing them with a single, more intuitive Routes tab.

## Key Changes

### 1. New Routes Hub Screen
Created a central hub (`RoutesHubScreen.tsx`) with three action cards:
- **Plan a Route**: Navigate to the route planner to create custom routes
- **Saved Routes**: View and manage previously saved routes
- **Start Free Run**: Begin tracking immediately without a planned route

### 2. Save Route Functionality
Enhanced the RoutePlannerScreen with the ability to save generated routes:
- Added "Save Route for Later" button
- Prompts user for a route name via `Alert.prompt`
- Saves route to Supabase database with all details (polyline, distance, duration, etc.)

### 3. Saved Routes List
Created SavedRoutesScreen to display user's saved routes:
- Card-based list showing route name, distance, type (loop/point-to-point), and creation date
- Pull-to-refresh functionality
- Empty state with call-to-action to plan a new route
- Tap navigation to route details

### 4. Route Detail Screen
Created RouteDetailScreen for viewing saved route details:
- Full-screen map with route polyline and markers
- Route statistics (distance, estimated time, target distance)
- "Start This Route" button to begin tracking
- "Delete Route" button with confirmation dialog

### 5. Navigation Restructure
- Removed Plan and Track tabs from bottom navigation
- Added single Routes tab using RoutesStackNavigator
- Bottom tabs now: Routes, History, Social, Profile

## Files Created

| File | Description |
|------|-------------|
| `src/screens/routes/RoutesHubScreen.tsx` | Main hub with action cards |
| `src/screens/routes/SavedRoutesScreen.tsx` | List of saved routes |
| `src/screens/routes/RouteDetailScreen.tsx` | Route detail with map |
| `src/navigation/RoutesStackNavigator.tsx` | Stack navigator for Routes tab |

## Files Modified

| File | Changes |
|------|---------|
| `src/screens/plan/RoutePlannerScreen.tsx` | Added save route functionality |
| `src/navigation/MainTabNavigator.tsx` | Replaced Plan/Track tabs with Routes |
| `src/services/routeService.ts` | Added name field support in saveRoute |
| `src/types/index.ts` | Added RoutesStackParamList, updated MainTabParamList |

## Navigation Flow

```
Routes Tab (RoutesHubScreen)
├── Plan a Route → RoutePlannerScreen
│   └── Save Route → Back to Hub
│   └── Start Run → RunTrackerScreen
├── Saved Routes → SavedRoutesScreen
│   └── Route Card → RouteDetailScreen
│       └── Start This Route → RunTrackerScreen
│       └── Delete Route → Back to Saved Routes
└── Start Free Run → RunTrackerScreen (no planned route)
```

## User Experience Improvements

1. **Simplified Navigation**: Reduced bottom tabs from 5 to 4, making the interface cleaner
2. **Unified Route Access**: All route-related functionality accessible from one place
3. **Route Persistence**: Users can now save routes for future use instead of losing them
4. **Free Run Option**: Easy access to start tracking without planning, addressing spontaneous workout needs
5. **Route Management**: Full CRUD operations for saved routes (Create, Read, Delete)

## Technical Notes

- Routes are saved to Supabase `routes` table with full polyline data
- Route detail screen uses `fitToCoordinates` to auto-zoom map to route bounds
- Tracking store's `setPlannedRoute` is used to pass routes to RunTrackerScreen
- All screens use consistent styling from COLORS and SPACING constants

## Status

**COMPLETED** - All tasks finished and tested.
