# fix: Add missing foreground service permissions for GPS tracking

**Date**: 2026-01-22
**Type**: fix

## Summary

Fixed Android foreground service permission error that prevented GPS tracking from starting on preview builds.

## Problem

When attempting to start a run, users received the error:
> "GPS Tracking Error. Failed to start location updates: call to function 'ExpoLocation.startLocationUpdatesAsync' has been rejected. -> Caused by: Couldn't start the foreground service. Foreground service permissions were not found in the manifest"

## Root Cause

The `backgroundLocationService.ts` uses `Location.startLocationUpdatesAsync()` with a `foregroundService` configuration to show a persistent notification during tracking. This requires specific Android manifest permissions that were missing:

- `FOREGROUND_SERVICE` - Required for Android 9+ (API 28+)
- `FOREGROUND_SERVICE_LOCATION` - Required for Android 14+ (API 34+) for location-based foreground services

## Changes

### `app.config.js`

Added Android permissions:
```javascript
permissions: [
  "ACCESS_BACKGROUND_LOCATION",
  "ACCESS_COARSE_LOCATION",
  "ACCESS_FINE_LOCATION",
  "FOREGROUND_SERVICE",        // NEW
  "FOREGROUND_SERVICE_LOCATION", // NEW
  "INTERNET"
]
```

Added expo-location plugin flags:
```javascript
{
  // ... existing permission strings
  isAndroidForegroundServiceEnabled: true,  // NEW
  isAndroidBackgroundLocationEnabled: true  // NEW
}
```

## Verification

1. Create a new preview build: `eas build --profile preview --platform android`
2. Install on Android device
3. Start a run and verify GPS tracking starts without error
4. Lock the phone and verify tracking continues (foreground service notification visible)
