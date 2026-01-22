# Enhanced Start Run UX

## Overview

The Enhanced Start Run UX provides users with comprehensive visual feedback and control during the run initialization process. This feature addresses the poor user experience of the original "silent" start button by introducing GPS pre-acquisition, a state machine with visual indicators, a countdown timer with haptic feedback, and clear GPS signal strength monitoring.

**Problem Solved**: Users previously experienced a 3-5 second "black hole" after tapping START RUN with no feedback about permissions, GPS acquisition, or background service startup. This created confusion and uncertainty about whether the button press registered.

**Solution**: A multi-stage initialization flow with clear visual feedback at every step, GPS quality assurance, and a countdown timer that gives users time to prepare before tracking starts.

## Architecture

### Components Involved

- `src/screens/track/RunTrackerScreen.tsx` - Main UI component with state machine
- `src/services/backgroundLocationService.ts` - Background GPS tracking service
- `src/store/trackingStore.ts` - Zustand store for tracking state
- `expo-location` - Location and GPS APIs
- `expo-haptics` - Haptic feedback for countdown

### State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                    Start Run Flow                            │
└─────────────────────────────────────────────────────────────┘

   Screen Mount
        ↓
   [idle] ──────────────────→ Start GPS Pre-Acquisition
        ↓
   [gps_searching] ──────────→ Watching location with Balanced accuracy
        ↓                      (Shows: 🔴 "SEARCHING GPS...")
        ↓                      Button: DISABLED
        ↓
   GPS accuracy < 20m?
        ↓ YES
   [gps_ready] ───────────────→ GPS locked, button enabled
        ↓                       (Shows: 🟢 "START RUN")
        ↓                       Button: ENABLED
        ↓
   User taps START RUN
        ↓
   Permissions granted?
        ↓ NO
   [requesting] ──────────────→ Request foreground & background permissions
        ↓                       (Shows: "PREPARING..." with spinner)
        ↓ YES
        ↓
   [countdown] ───────────────→ Show countdown overlay: 3... 2... 1... GO!
        ↓                       Haptic feedback on each second
        ↓                       User can tap to skip
        ↓
   Countdown complete (or skipped)
        ↓
   [starting] ────────────────→ Start background location tracking
        ↓                       Switch to BestForNavigation accuracy
        ↓
   Success
        ↓
   isTracking = true ─────────→ Show tracking UI with live metrics
```

### Data Flow

```
Component Mount
    ↓
GPS Pre-Acquisition (Balanced accuracy)
    ↓
Location Updates → Update gpsAccuracy state
    ↓
GPS Ready (accuracy < 20m)
    ↓
User Taps START RUN
    ↓
Request Permissions (if needed)
    ↓
Start Countdown → Haptic Feedback
    ↓
Start Background Tracking (BestForNavigation)
    ↓
trackingStore.startTracking()
    ↓
Live GPS Updates → Update metrics in real-time
```

## Implementation Details

### Key Files

| File | Purpose |
|------|---------|
| `src/screens/track/RunTrackerScreen.tsx` | Main component with state machine, GPS pre-acquisition, countdown overlay |
| `package.json` | Added expo-haptics dependency for countdown vibration |

### Key Types

| Type | Location | Purpose |
|------|----------|---------|
| `StartRunState` | `RunTrackerScreen.tsx:29` | State machine type for start run flow |

```typescript
type StartRunState =
  | 'idle'           // Initial state
  | 'gps_searching'  // Acquiring GPS on mount
  | 'gps_ready'      // Good GPS signal (< 20m accuracy)
  | 'requesting'     // Requesting permissions
  | 'countdown'      // 3-2-1 countdown active
  | 'starting';      // Starting background service
```

### Key State Variables

| Variable | Type | Purpose |
|----------|------|---------|
| `startRunState` | `StartRunState` | Current state in the start run flow |
| `gpsAccuracy` | `number \| null` | Current GPS accuracy in meters |
| `showCountdown` | `boolean` | Whether countdown overlay is visible |
| `countdownValue` | `number` | Current countdown number (3, 2, 1, 0) |

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `startGPSPreAcquisition()` | `RunTrackerScreen.tsx:74` | Starts GPS watching on mount with cleanup |
| `handleStartRun()` | `RunTrackerScreen.tsx:108` | Enhanced start run flow with state machine |
| `startCountdown()` | `RunTrackerScreen.tsx:181` | Initiates 3-2-1 countdown with haptics |
| `actuallyStartTracking()` | `RunTrackerScreen.tsx:205` | Starts background tracking after countdown |

## GPS Pre-Acquisition Implementation

### Hook for Background GPS Watching

```typescript
useEffect(() => {
  let locationWatcher: Location.LocationSubscription | null = null;

  const startGPSPreAcquisition = async () => {
    try {
      // Only start if not already tracking
      if (isTracking) return;

      // Check if we already have permission
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        setStartRunState('gps_searching'); // Show disabled button
        return;
      }

      setStartRunState('gps_searching');

      // Start watching location with balanced accuracy (saves battery)
      locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced, // Lower power during waiting
          distanceInterval: 10,
          timeInterval: 2000,
        },
        (location) => {
          const accuracy = location.coords.accuracy || 999;
          setGpsAccuracy(accuracy);

          // Update state based on accuracy
          if (accuracy < 20) {
            setStartRunState('gps_ready'); // Good GPS - enable button
          } else if (accuracy < 50) {
            setStartRunState('gps_searching'); // Fair GPS - keep searching
          } else {
            setStartRunState('gps_searching'); // Poor GPS - keep searching
          }
        }
      );
    } catch (error) {
      console.error('GPS pre-acquisition error:', error);
      setStartRunState('gps_searching');
    }
  };

  if (!isTracking) {
    startGPSPreAcquisition();
  }

  // CRITICAL: Cleanup to prevent battery drain
  return () => {
    if (locationWatcher) {
      locationWatcher.remove();
      locationWatcher = null;
    }
  };
}, [isTracking]);
```

**Key Points**:
- Uses `Location.Accuracy.Balanced` to minimize battery usage during waiting
- Updates `gpsAccuracy` state on every location update
- Only enables button when accuracy < 20 meters
- Cleanup on unmount prevents orphaned GPS watchers

### GPS Accuracy Thresholds

| Accuracy | Status | Button State | Indicator |
|----------|--------|--------------|-----------|
| null or > 50m | Searching | Disabled | 🔴 Red |
| 20m - 50m | Fair | Disabled | 🟡 Yellow |
| < 20m | Ready | Enabled | 🟢 Green |

## Enhanced Start Run Flow

### State Transitions

```typescript
const handleStartRun = async () => {
  try {
    // State: gps_ready → requesting
    setStartRunState('requesting');

    // Step 1: Request foreground permission
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();

    if (foregroundStatus !== 'granted') {
      Alert.alert('Permission Required', '...');
      setStartRunState('gps_ready'); // Reset
      return;
    }

    // Step 2: Request background permission (Android 2-step dialog)
    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();

    if (backgroundStatus !== 'granted') {
      Alert.alert('Background Permission Required', '...');
      setStartRunState('gps_ready'); // Reset
      return;
    }

    // State: requesting → countdown
    startCountdown();
  } catch (err) {
    console.error('Error starting run:', err);
    Alert.alert('Error', 'Failed to start run');
    setStartRunState('gps_ready'); // Reset
  }
};
```

## Countdown Implementation

### Countdown with Haptic Feedback

```typescript
const startCountdown = () => {
  setShowCountdown(true);
  setCountdownValue(3);
  setStartRunState('countdown');

  let currentCount = 3;

  const countdownInterval = setInterval(() => {
    currentCount -= 1;

    if (currentCount === 0) {
      clearInterval(countdownInterval);
      setShowCountdown(false);
      actuallyStartTracking(); // Start the run
    } else {
      setCountdownValue(currentCount);
      // Haptic feedback on each count
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (err) {
        // Gracefully degrade if haptics not available
      }
    }
  }, 1000); // 1 second intervals
};
```

### Countdown Overlay UI

```tsx
{showCountdown && (
  <Modal transparent animationType="fade" visible={showCountdown}>
    <TouchableOpacity
      style={styles.countdownOverlay}
      activeOpacity={1}
      onPress={() => {
        setShowCountdown(false);
        actuallyStartTracking(); // Skip countdown
      }}
    >
      <Text style={styles.countdownText}>
        {countdownValue > 0 ? countdownValue : 'GO!'}
      </Text>
      <Text style={styles.countdownSkipText}>Tap anywhere to skip</Text>
    </TouchableOpacity>
  </Modal>
)}
```

**Features**:
- Semi-transparent dark background (`rgba(0,0,0,0.8)`)
- Large countdown text (80px font size)
- "Tap anywhere to skip" instruction
- Tapping anywhere calls `actuallyStartTracking()` immediately

### Starting Tracking After Countdown

```typescript
const actuallyStartTracking = async () => {
  try {
    setStartRunState('starting');

    // Get high-accuracy GPS position for start point
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation, // Switch to high accuracy
    });

    const startPosition: GPSPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude || undefined,
      accuracy: location.coords.accuracy || 0,
      speed: location.coords.speed || undefined,
      timestamp: Date.now(),
    };

    // Update tracking store
    startTracking({ startPosition });

    // Start background location tracking
    const started = await startBackgroundLocationTracking((newPosition) => {
      updatePosition(newPosition);
    });

    if (!started) {
      throw new Error('Failed to start background tracking');
    }

    setGPSStatus('active');
  } catch (err) {
    console.error('Error starting tracking:', err);
    Alert.alert('Error', 'Failed to start GPS tracking');
    setStartRunState('gps_ready'); // Reset
  }
};
```

## Visual Components

### GPS Signal Strength Indicator

```tsx
{!isTracking && (
  <View style={styles.gpsPreAcquisitionContainer}>
    <View style={styles.gpsSignalIndicator}>
      <View
        style={[
          styles.gpsSignalDot,
          gpsAccuracy === null || gpsAccuracy > 50
            ? styles.gpsSignalRed
            : gpsAccuracy >= 20
            ? styles.gpsSignalYellow
            : styles.gpsSignalGreen,
        ]}
      />
      <Text style={styles.gpsSignalText}>
        {gpsAccuracy === null
          ? 'No GPS'
          : gpsAccuracy > 50
          ? 'Searching'
          : gpsAccuracy >= 20
          ? 'Fair Signal'
          : 'GPS Ready'}
      </Text>
    </View>
    <Text style={styles.gpsAccuracyText}>
      {gpsAccuracy !== null && `±${gpsAccuracy.toFixed(0)}m`}
    </Text>
  </View>
)}
```

### Enhanced START RUN Button

```tsx
<Button
  title={
    startRunState === 'gps_searching'
      ? 'SEARCHING GPS...'
      : startRunState === 'requesting'
      ? 'PREPARING...'
      : startRunState === 'countdown'
      ? `STARTING IN ${countdownValue}...`
      : startRunState === 'starting'
      ? 'STARTING...'
      : 'START RUN'
  }
  onPress={handleStartRun}
  disabled={startRunState !== 'gps_ready'}
  loading={startRunState === 'requesting' || startRunState === 'starting'}
/>
```

## Battery Optimization

### Two-Tier Accuracy Strategy

| Phase | Accuracy Mode | Power Usage | Purpose |
|-------|---------------|-------------|---------|
| Pre-Acquisition | `Accuracy.Balanced` | Low | Find GPS signal efficiently |
| Active Tracking | `Accuracy.BestForNavigation` | High | High-precision tracking |

### Cleanup Strategy

```typescript
// Cleanup on unmount
return () => {
  if (locationWatcher) {
    locationWatcher.remove(); // Stop GPS watching
    locationWatcher = null;
  }
};

// Cleanup when tracking starts
if (!isTracking) {
  startGPSPreAcquisition();
} else {
  // GPS watcher automatically removed when isTracking becomes true
}
```

**Impact**:
- Pre-acquisition uses ~10% battery of full tracking
- Watcher removed immediately when run starts
- No orphaned subscriptions
- Minimal battery impact for users who open screen but don't start run

## Error Handling

### Permission Denied

```typescript
if (foregroundStatus !== 'granted') {
  Alert.alert(
    'Location Permission Required',
    'RunRoute needs access to your location to track your run.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Try Again', onPress: () => handleStartRun() }
    ]
  );
  setStartRunState('gps_ready');
  return;
}
```

### Background Permission Denied (Android)

```typescript
if (backgroundStatus !== 'granted') {
  Alert.alert(
    'Background Location Permission Required',
    'Please grant "Allow all the time" permission for accurate tracking.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Try Again', onPress: () => handleStartRun() }
    ]
  );
  setStartRunState('gps_ready');
  return;
}
```

### GPS Acquisition Failure

```typescript
catch (err) {
  console.error('GPS pre-acquisition error:', err);
  setStartRunState('gps_searching');
  // Button stays disabled, user sees "SEARCHING GPS..."
  // Will retry automatically via watchPositionAsync
}
```

### Background Tracking Failure

```typescript
const started = await startBackgroundLocationTracking(...);

if (!started) {
  throw new Error('Failed to start background tracking');
}

// Caught by try-catch:
catch (err) {
  Alert.alert(
    'GPS Tracking Error',
    'Failed to start background tracking. Please try again.',
    [
      { text: 'OK' },
      { text: 'Try Again', onPress: () => handleStartRun() }
    ]
  );
  setStartRunState('gps_ready'); // Reset to ready state
}
```

## Haptic Feedback

### Implementation

Uses `expo-haptics` with graceful degradation:

```typescript
import * as Haptics from 'expo-haptics';

// In countdown:
try {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
} catch (err) {
  // Haptics not available - continue without vibration
  console.log('Haptics not available:', err);
}
```

### Impact Styles

- `Haptics.ImpactFeedbackStyle.Medium` - Balanced vibration for countdown
- Triggered on each countdown tick (3, 2, 1)
- Not triggered on "GO!" (tracking starts immediately)

### Platform Support

| Platform | Support | Notes |
|----------|---------|-------|
| iOS | ✅ Full | Uses Taptic Engine |
| Android | ✅ Partial | Varies by device hardware |
| Web | ❌ None | Gracefully degrades |
| Simulator | ❌ None | Must test on physical device |

## Testing

### Automated Testing

Not applicable - requires physical device for GPS and haptics.

### Manual Testing Checklist

#### GPS Pre-Acquisition Test
1. Open RunRoute app
2. Navigate to Track tab
3. Observe GPS indicator appear
4. Expected: 🔴 "Searching" → 🟡 "Fair Signal" → 🟢 "GPS Ready"
5. Expected: Button disabled until GPS ready
6. Expected: Accuracy text shows ±Xm

#### Permission Flow Test
1. Uninstall and reinstall app (or clear app data)
2. Navigate to Track tab
3. Wait for GPS ready
4. Tap "START RUN"
5. Expected: "PREPARING..." shows briefly
6. Expected: Permission dialogs appear
7. Grant permissions
8. Expected: Countdown starts

#### Countdown Test (Physical Device Required)
1. With permissions granted and GPS ready
2. Tap "START RUN"
3. Expected: Countdown overlay appears
4. Expected: See "3... 2... 1... GO!"
5. **Expected: Feel haptic vibration on 3, 2, 1**
6. Expected: Tracking starts after "GO!"

#### Skip Countdown Test
1. Start countdown
2. Tap anywhere on overlay during countdown
3. Expected: Countdown dismisses immediately
4. Expected: Tracking starts without waiting

#### Poor GPS Test
1. Test indoors or in parking garage
2. Observe GPS indicator
3. Expected: Stays in "Searching" or "Fair Signal"
4. Expected: Button stays disabled
5. Expected: Accuracy shows >20m

#### Cleanup Test
1. Navigate to Track tab
2. Wait for GPS ready
3. Navigate away (back to home or another tab)
4. Wait 5-10 seconds
5. Check device battery usage (Settings → Battery)
6. Expected: RunRoute not using GPS in background
7. Expected: No orphaned location watchers

#### Error Handling Test
1. Deny location permission
2. Expected: Alert with "Try Again" option
3. Try again and grant permission
4. Expected: Flow continues normally

### Device Requirements

**Minimum**:
- iOS 13+ or Android 8+
- GPS/Location hardware
- Permission to access location

**Recommended**:
- Physical device (not simulator) for full testing
- Haptic feedback hardware (most modern phones)
- Clear view of sky for GPS testing

## Known Limitations

### 1. Haptic Feedback Requires Physical Device
- **Issue**: Simulators don't support haptic feedback
- **Impact**: Cannot test vibration in development
- **Workaround**: Test on physical device, graceful degradation in code

### 2. GPS Pre-Acquisition Battery Impact
- **Issue**: Continuous GPS watching uses battery even if run never starts
- **Impact**: ~10% of full tracking battery usage
- **Mitigation**: Uses `Accuracy.Balanced` (low power mode)
- **Future**: Add settings toggle to disable pre-acquisition

### 3. Accuracy Threshold May Be Too Strict
- **Issue**: 20m accuracy threshold may be hard to achieve indoors or in dense urban areas
- **Impact**: Button may stay disabled in poor GPS environments
- **Workaround**: Manual override option in future
- **Future**: Add "Start Anyway" button after 30 seconds

### 4. Countdown Cannot Be Customized
- **Issue**: Fixed 3-second countdown
- **Impact**: Some users may prefer longer/shorter/no countdown
- **Future**: Add settings for countdown duration (0, 3, 5, 10 seconds)

### 5. No Audio Cues
- **Issue**: Only visual countdown, no voice announcements
- **Impact**: Users must look at screen during countdown
- **Future**: Add optional audio countdown "3... 2... 1... Go!"

### 6. GPS Accuracy Varies by Environment
- **Issue**: Urban canyons, indoor spaces, cloud cover affect GPS
- **Impact**: Pre-acquisition may take longer or never reach "ready" state
- **Workaround**: Move to open area with clear sky view
- **Future**: Provide user guidance on improving GPS signal

## Future Improvements

### Settings & Customization
- [ ] Toggle to enable/disable GPS pre-acquisition (save battery)
- [ ] Customizable countdown duration (0, 3, 5, 10 seconds)
- [ ] Toggle to skip countdown entirely
- [ ] Adjustable GPS accuracy threshold (10m, 20m, 50m)

### Audio Enhancements
- [ ] Voice countdown: "Starting in 3... 2... 1... Go!"
- [ ] Beep sound on each countdown tick
- [ ] Success chime when GPS ready
- [ ] Audio feedback for permission requests

### Visual Enhancements
- [ ] GPS signal strength bars (like cell signal)
- [ ] Satellite count indicator
- [ ] Map preview showing current location during pre-acquisition
- [ ] Animated countdown with circular progress indicator

### Smart Features
- [ ] "Start Anyway" override button after 30 seconds of searching
- [ ] Auto-start when GPS becomes ready (opt-in setting)
- [ ] GPS quality history/trending (show if getting better/worse)
- [ ] Warm-up timer (5 min countdown before run starts)

### Developer Experience
- [ ] Mock GPS mode for simulator testing
- [ ] Debug panel showing GPS accuracy, satellite count, etc.
- [ ] Performance metrics for GPS acquisition time

### Accessibility
- [ ] VoiceOver/TalkBack announcements for countdown
- [ ] High contrast mode for GPS indicator
- [ ] Larger touch targets for skip button
- [ ] Reduced motion option (disable countdown animations)

## Related Documentation

- **Change Note**: `docs/changes/2026-01-22-feat-enhanced-start-run-ux.md`
- **Implementation**: `src/screens/track/RunTrackerScreen.tsx`
- **Background Service**: `src/services/backgroundLocationService.ts`
- **Tracking Store**: `src/store/trackingStore.ts`

## References

- [Expo Location API Documentation](https://docs.expo.dev/versions/latest/sdk/location/)
- [Expo Haptics API Documentation](https://docs.expo.dev/versions/latest/sdk/haptics/)
- [iOS Location Best Practices](https://developer.apple.com/documentation/corelocation/choosing_the_location_services_authorization_to_request)
- [Android Location Permissions](https://developer.android.com/training/location/permissions)
