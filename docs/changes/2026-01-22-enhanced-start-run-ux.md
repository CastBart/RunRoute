# Enhanced Start Run UX Improvements

**Date:** 2026-01-22
**Type:** feat
**Component:** RunTrackerScreen

## Summary

Implemented enhanced UX improvements for the START RUN flow in RunTrackerScreen.tsx, providing users with clear feedback during the 3-5 second async operations (permissions, GPS acquisition, background service startup).

## Changes

### 1. Added expo-haptics dependency
- Added `expo-haptics@~15.0.2` to package.json for vibration feedback during countdown

### 2. GPS Pre-Acquisition on Component Mount
- GPS acquisition now starts when RunTrackerScreen mounts (before user taps START)
- Uses `Location.Accuracy.Balanced` during pre-acquisition to save battery
- Tracks GPS accuracy and displays signal quality to user
- Cleans up GPS watching on unmount to prevent battery drain

### 3. State Machine for Start Button
Implemented a state machine with the following states:
- `idle` - Initial state, checking GPS
- `gps_searching` - Acquiring GPS on mount
- `gps_ready` - Good GPS signal acquired (accuracy < 20m)
- `requesting` - Requesting permissions
- `countdown` - 3-2-1 countdown active
- `starting` - Starting background service

### 4. GPS Signal Strength Indicator
Added visual indicator showing GPS status:
- Red dot - Searching (accuracy > 50m or null)
- Yellow dot - Fair (accuracy 20-50m)
- Green dot - Ready (accuracy < 20m)

### 5. Countdown Overlay
- Semi-transparent dark background modal
- Large countdown text: "3", "2", "1", "GO!"
- Haptic feedback on each second using expo-haptics
- "Tap anywhere to skip" hint at bottom
- Tapping overlay skips countdown and starts immediately

### 6. Enhanced Button States
Button text changes based on state:
- gps_searching: "SEARCHING GPS..."
- gps_ready: "START RUN"
- requesting: "PREPARING..." (with spinner)
- starting: "STARTING..." (with spinner)

## Files Modified

- `package.json` - Added expo-haptics dependency
- `src/screens/track/RunTrackerScreen.tsx` - Complete UX enhancement implementation

## Technical Details

### GPS Thresholds
- `GPS_READY_THRESHOLD = 20` meters (good accuracy)
- `GPS_FAIR_THRESHOLD = 50` meters (acceptable but not ideal)

### Haptic Feedback
- Heavy impact on countdown start and "GO!"
- Medium impact on each countdown tick
- Gracefully degrades if haptics not available on device

### Cleanup
- GPS pre-acquisition watcher properly cleaned up on unmount
- Countdown timer cleared if component unmounts during countdown
- Background tracking cleanup on unmount

## How to Verify

1. **GPS Indicator Appears:**
   - Navigate to Track tab
   - Observe GPS signal indicator below the START button
   - Should show "Searching for GPS..." with red dot initially
   - After acquiring signal, should show "GPS Ready" with green dot

2. **Button State Changes:**
   - Button disabled with "SEARCHING GPS..." while acquiring
   - Button enabled with "START RUN" when GPS ready

3. **Countdown Works:**
   - Tap START RUN
   - Grant permissions if prompted
   - Observe 3-2-1-GO countdown overlay
   - Feel haptic feedback on each count (test on physical device)

4. **Skip Countdown:**
   - Tap anywhere on countdown overlay
   - Should immediately start tracking

5. **GPS Cleanup:**
   - Navigate away from Track tab
   - Battery usage should not increase from orphaned GPS watchers

6. **Error Handling:**
   - Deny permissions to verify graceful error handling
   - Poor GPS signal shows warning dialog with option to wait or start anyway
