# Phase 6: Run History & Analytics

## Overview
This phase implements the run history feature, allowing users to view their past runs in a list format and drill into individual run details with full statistics and map visualization.

## Completed Features

### 1. Run List View (RunHistoryScreen)
- **FlatList Implementation**: Efficient, scrollable list of user's runs
- **Pull-to-Refresh**: RefreshControl for manual data refresh
- **Statistics Header**: Summary showing total runs, total distance, and total time
- **Empty State**: Friendly message when no runs exist
- **Loading State**: Activity indicator while fetching data

### 2. Run List Item Component (RunListItem)
- **Reusable Component**: Standalone component for displaying run summaries
- **Smart Date Formatting**: Shows "Today", "Yesterday", or full date as appropriate
- **Key Metrics Display**: Distance, duration, and average pace
- **Touch Interaction**: Navigates to run detail on press

### 3. Run Detail View (RunDetailScreen)
- **Map Visualization**: Full GPS trail displayed on MapView with:
  - Polyline showing the running route
  - Green marker for start location
  - Red marker for finish location
  - Auto-calculated region to fit the route
- **Comprehensive Statistics**:
  - Distance (km)
  - Duration (formatted as hh:mm:ss or mm:ss)
  - Average Pace (min:sec /km)
  - Average Speed (km/h)
  - Elevation Gain (when available)
  - Calories Burned (when available)
  - Linked Route indicator (when run followed a planned route)
- **Date/Time Information**: Full date and time range of the run
- **Delete Functionality**: Confirmation dialog and database deletion

### 4. Navigation
- **HistoryStackNavigator**: Stack navigator for history tab
- **Typed Navigation**: Full TypeScript support with HistoryStackParamList
- **Proper Headers**: Stack navigator manages headers for child screens

## File Structure

```
src/
├── components/
│   └── RunListItem.tsx          # Reusable run item component
├── screens/
│   └── history/
│       ├── RunHistoryScreen.tsx # Main list view
│       └── RunDetailScreen.tsx  # Individual run detail
├── navigation/
│   └── HistoryStackNavigator.tsx # History tab stack navigator
└── services/
    └── runService.ts            # getUserRuns(), getRunById(), deleteRun()
```

## API Integration

### runService Methods Used
```typescript
// Fetch paginated list of user's runs
getUserRuns(limit: number, offset: number): Promise<Run[]>

// Fetch single run with full details
getRunById(runId: string): Promise<Run>

// Delete a run from database
deleteRun(runId: string): Promise<void>
```

## Data Flow

1. **RunHistoryScreen** mounts → calls `runService.getUserRuns()`
2. User taps a run → navigation to `RunDetail` with `runId` param
3. **RunDetailScreen** mounts → calls `runService.getRunById(runId)`
4. User deletes run → confirmation → `runService.deleteRun()` → navigate back

## UI Components

### Statistics Display
- Main stats row: Distance, Duration, Avg Pace (prominent display)
- Detail card: Additional metrics in key-value format
- Conditional rendering for optional fields (elevation, calories, route link)

### Formatting Functions
- `formatDuration(seconds)`: Converts to hh:mm:ss or mm:ss
- `formatPace(secondsPerKm)`: Converts to m:ss format
- `formatDate(isoString)`: Human-readable date
- `formatTime(isoString)`: Time of day

## Completed Enhancements

### 5. Analytics Screen (AnalyticsScreen)
- **Weekly/Monthly Analytics**: Toggle between week and month views
- **Summary Stats**: Total runs, distance, duration, average pace
- **Weekly Breakdown Chart**: Bar chart showing distance per week (month view)
- **This Week's Runs**: List of runs with quick navigation (week view)
- **Personal Records**: Longest run, fastest pace, longest duration with navigation to run details
- **Lifetime Stats**: Total runs and total distance

### 6. Run Comparison (RunComparisonScreen)
- **Side-by-side comparison**: Compare two runs visually
- **Metrics compared**: Distance, duration, average pace, average speed
- **Visual indicators**: Up/down arrows showing which run performed better
- **Difference display**: Shows exact difference between metrics
- **Summary**: Text summary of key differences

### 7. Export Functionality
- **GPX Export**: Standard GPS exchange format for fitness apps
- **CSV Export**: Spreadsheet-friendly format with GPS points and summary
- **Share Integration**: Uses device sharing capabilities

### 8. Share to Social Feed
- **Direct Sharing**: Share run from Run Detail screen to social feed
- **Caption Support**: Optional caption for the post
- **Already Shared Indicator**: Shows if run has already been shared
- **Prevention of Duplicates**: Cannot share the same run twice

## File Changes

### New Files
- `src/screens/history/AnalyticsScreen.tsx` - Analytics dashboard
- `src/screens/history/RunComparisonScreen.tsx` - Run comparison view

### Modified Files
- `src/services/runService.ts` - Added analytics and export methods
- `src/screens/history/RunDetailScreen.tsx` - Added Compare, Export, Share buttons
- `src/navigation/HistoryStackNavigator.tsx` - Added Analytics and RunComparison screens
- `src/screens/history/RunHistoryScreen.tsx` - Added Analytics button in header
- `src/types/index.ts` - Added Analytics and RunComparison to navigation types
