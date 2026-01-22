# feat: Enhanced Start Run UX with GPS Pre-Acquisition and Countdown

**Date**: 2026-01-22
**Type**: feat

## Summary

Dramatically improved the start run UX by adding GPS pre-acquisition, visual feedback at every step, a countdown timer with haptic feedback, and clear GPS signal strength indicators. Users now have complete visibility into what's happening during the 3-5 second process of starting a run.

## Problem

The original start run flow had several UX issues:

1. **No visual feedback**: When users tapped "START RUN", nothing happened for 3-5 seconds while the app:
   - Requested location permissions (0.5-2s)
   - Acquired GPS signal (2-10s depending on conditions)
   - Started background tracking service (0.5-1s)

2. **Unknown GPS quality**: App started immediately when GPS was acquired, potentially with poor accuracy leading to bad tracking data

3. **No preparation time**: Tracking started instantly with no time for users to prepare (pocket phone, start moving, etc.)

4. **Silent failures**: Users didn't know if the button press registered or what was happening

## Solution

Implemented a multi-stage start flow inspired by industry best practices (Strava Apple Watch, premium running apps):

### 1. GPS Pre-Acquisition
- GPS starts acquiring when RunTrackerScreen loads (before user taps START)
- Uses `Location.Accuracy.Balanced` during pre-acquisition to minimize battery impact
- Switches to `Location.Accuracy.BestForNavigation` during actual tracking
- Properly cleaned up on unmount to prevent battery drain

### 2. State Machine with Visual Feedback
Created a `StartRunState` type with clear transitions:
```
idle → gps_searching → gps_ready → requesting → countdown → starting → tracking
```

Each state shows appropriate UI feedback:
- **gps_searching**: "SEARCHING GPS..." (button disabled, red indicator)
- **gps_ready**: "START RUN" (button enabled, green indicator)
- **requesting**: "PREPARING..." (with loading spinner)
- **countdown**: "3... 2... 1... GO!" (full-screen overlay)
- **starting**: Brief transition to tracking UI

### 3. GPS Signal Strength Indicator
Visual indicator next to START RUN button:
- 🔴 **Searching** (red) - accuracy > 50m or null
- 🟡 **Fair** (yellow) - accuracy 20-50m
- 🟢 **Ready** (green) - accuracy < 20m

Button only enables when GPS accuracy is good enough (< 20m).

### 4. Countdown Overlay
Full-screen countdown before starting:
- Large, prominent numbers: "3... 2... 1... GO!"
- Haptic feedback on each second
- "Tap anywhere to skip" option
- Semi-transparent dark background

### 5. Smart Permission Handling
- Checks if permissions already granted to skip redundant requests
- Shows clear "PREPARING..." state during permission flow
- Graceful error handling with user-friendly alerts

## Changes

### Dependencies
- **package.json**: Added `expo-haptics` (~15.0.2) for countdown vibration feedback

### Code Changes
- **src/screens/track/RunTrackerScreen.tsx** (major refactor):
  - Added `StartRunState` type and state management
  - Added `gpsAccuracy` state for signal strength tracking
  - Added `showCountdown` and `countdownValue` states
  - New `useEffect` for GPS pre-acquisition on mount with cleanup
  - Modified `handleStartRun` to use state machine with progress feedback
  - New countdown logic with haptic feedback and skip functionality
  - Added GPS signal strength indicator component
  - Enhanced button with state-based text and disabled logic
  - Added CountdownOverlay modal component

## User Experience Flow

### Before (Poor UX)
1. User taps "START RUN"
2. **[3-5 seconds of silence - no feedback]**
3. Tracking suddenly starts (or fails silently)

### After (Enhanced UX)
1. User opens Track tab
2. GPS indicator appears: 🔴 "SEARCHING GPS..." (button disabled)
3. GPS found: 🟢 "START RUN" (button enabled)
4. User taps "START RUN"
5. If permissions needed: "PREPARING..." with spinner (1-2s)
6. Countdown overlay: "3... 2... 1... GO!" with haptic feedback
7. User can tap to skip countdown
8. Tracking starts smoothly

## Technical Details

### GPS Pre-Acquisition Implementation
```typescript
useEffect(() => {
  let locationWatcher: Location.LocationSubscription | null = null;

  const startGPSPreAcquisition = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return;

    locationWatcher = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced },
      (location) => {
        const accuracy = location.coords.accuracy || 999;
        setGpsAccuracy(accuracy);
        if (accuracy < 20) setStartRunState('gps_ready');
      }
    );
  };

  if (!isTracking) startGPSPreAcquisition();

  return () => locationWatcher?.remove(); // Cleanup!
}, [isTracking]);
```

### Haptic Feedback
Uses `expo-haptics` with graceful degradation:
```typescript
try {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
} catch (err) {
  // Haptics not available on device - continue without
}
```

### Battery Optimization
- Pre-acquisition uses `Accuracy.Balanced` (lower power)
- Active tracking uses `Accuracy.BestForNavigation` (high accuracy)
- GPS watcher properly removed on unmount
- No orphaned subscriptions

## Verification

### Manual Testing Steps

1. **GPS Indicator Test**:
   - Open Track tab
   - Observe GPS indicator (🔴 searching → 🟢 ready)
   - Verify button disabled until GPS ready
   - Check accuracy threshold works (< 20m)

2. **Countdown Test**:
   - Tap START RUN with good GPS
   - Observe 3-2-1-GO countdown
   - Feel haptic feedback on device (simulator won't vibrate)
   - Verify smooth transition to tracking

3. **Skip Countdown Test**:
   - Start countdown
   - Tap anywhere on overlay
   - Verify tracking starts immediately

4. **Permission Flow Test**:
   - Deny location permissions
   - Verify "PREPARING..." state shows
   - Verify clear error alerts

5. **Cleanup Test**:
   - Navigate away from Track tab
   - Verify GPS watcher is removed
   - Check battery usage over time

6. **Poor GPS Test**:
   - Test indoors or with poor signal
   - Verify indicator shows searching/fair states
   - Verify button stays disabled until ready

### Device Testing (Required)
**Haptic feedback only works on physical devices**, not simulators:
- iOS: Test on iPhone
- Android: Test on physical Android device

## Platform Considerations

### iOS
- Haptic feedback works with native Taptic Engine
- Smooth permission flow
- Background location "Always Allow" required

### Android
- Two-step permission dialog (foreground → background)
- Haptic feedback varies by device hardware
- May need "Allow all the time" for background tracking

## Files Changed

- `package.json` - Added expo-haptics dependency
- `src/screens/track/RunTrackerScreen.tsx` - Complete UX refactor
- `docs/changes/2026-01-22-feat-enhanced-start-run-ux.md` - This change note

## Breaking Changes

None - this is a pure enhancement with backward-compatible behavior.

## Known Limitations

1. **Haptic feedback requires physical device** - won't work in simulator
2. **GPS pre-acquisition uses battery** - minimal impact with Balanced accuracy, but consider adding settings toggle in future
3. **20m accuracy threshold** - may be too strict in dense urban areas or indoors (can be adjusted if needed)

## Future Enhancements

- Add settings toggle to enable/disable countdown
- Add audio cues ("Starting in 3... 2... 1...")
- Customizable countdown duration
- Visual GPS signal strength bars (like cell signal)
- Settings to adjust accuracy threshold

## Research Sources

This implementation was informed by:
- Strava's Apple Watch 3-second countdown feature
- Industry best practices for GPS acquisition in running apps
- User feedback on silent async operations in mobile apps

## Related

This feature improves upon the basic tracking functionality and sets the foundation for:
- Audio coaching during runs
- Interval training with countdown timers
- Pre-run warm-up sequences
