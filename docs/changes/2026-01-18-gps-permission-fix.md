# Task Log - GPS Permission Fix

**Date:** 2026-01-18
**Task:** Fix "Failed to start GPS tracking" error in preview build

## What Was Requested

User reported experiencing a "Failed to start GPS tracking" error when starting a run on the preview build. The error message was generic and didn't provide information about the root cause. User suspected it was related to foreground and background location permissions not being properly requested.

## What Was Done

### Investigation

Performed comprehensive analysis of the GPS tracking permissions setup:

1. **Reviewed app.config.js** - Confirmed permissions are correctly configured for both Android and iOS
   - Android: `ACCESS_BACKGROUND_LOCATION`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`
   - iOS: `UIBackgroundModes: ["location"]` with proper Info.plist strings
   - expo-location plugin properly configured

2. **Analyzed permission request flow** - Identified critical issues:
   - Background permission was requested inside the service (too late)
   - Foreground permission was checked using `getForegroundPermissionsAsync()` (check only, not request)
   - If permissions were revoked after initial grant, the app failed without attempting to re-request
   - Generic error messages made debugging impossible

3. **Identified root causes**:
   - **HIGH severity:** Redundant foreground permission check that could fail silently
   - **HIGH severity:** Generic error messages (same message for all failure types)
   - **MEDIUM severity:** Background permission not treated as critical (only warned, didn't fail)
   - **MEDIUM severity:** Wrong permission request order (background requested too late)

### Changes Implemented

#### 1. RunTrackerScreen.tsx - Improved Permission Request Flow

**Changed handleStartRun function (lines 59-162):**

- Request **both** foreground AND background permissions upfront (before starting tracking)
- Added detailed console logging at each step for debugging
- Implemented specific error messages for each permission type:
  - Foreground denied: "Location Permission Required"
  - Background denied: "Background Location Permission Required"
- Added retry option when permissions are denied
- Enhanced error handling with actionable user feedback
- Better error propagation with detailed messages

**Permission Request Order (now correct):**
1. Request foreground permission → Show specific error if denied
2. Request background permission → Show specific error if denied with retry option
3. Get current GPS position
4. Start background tracking service

#### 2. backgroundLocationService.ts - Simplified Permission Logic

**Changed startBackgroundLocationTracking function (lines 78-117):**

- **Removed** redundant foreground permission check (was using `getAsync` instead of `requestAsync`)
- **Removed** background permission request (now caller's responsibility)
- Added assumption that permissions are already granted by caller
- Improved console logging with `[BackgroundLocationService]` prefix for clarity
- Changed from returning `false` to throwing detailed errors for better debugging
- Added error message details to thrown exceptions

**Before:** Service checked and requested permissions internally (could fail silently)
**After:** Service assumes permissions granted, focuses on starting location updates, throws detailed errors

#### 3. Enhanced Logging

Added comprehensive console logging throughout the permission flow:
- "Requesting foreground location permission..."
- "Foreground permission status: granted/denied"
- "Requesting background location permission..."
- "Background permission status: granted/denied"
- "Starting background location tracking..."
- "[BackgroundLocationService] ✅ Background location tracking started successfully"
- "[BackgroundLocationService] ❌ Error starting background location tracking: [details]"

### Error Messages - Before vs After

**Before:**
- Generic: "Failed to start GPS tracking" (for ALL errors)

**After (specific messages):**
- Foreground permission denied: "Location Permission Required - RunRoute needs access to your location to track your run. Please grant location permission."
- Background permission denied: "Background Location Permission Required - RunRoute needs background location access to track your run even when your phone is locked. Please grant 'Allow all the time' permission." + Retry button
- API failure: "Failed to start background location tracking. Please check your device settings." + Try Again button
- Generic catch-all: "Unable to start GPS tracking. Please try again." + Try Again button

## Testing Instructions

### On Preview Build:

1. **First Run - Grant Permissions:**
   - Start a run
   - Android asks for location: Grant "While using the app"
   - Android asks for background: Grant "Allow all the time"
   - Expected: Run starts successfully, console shows permission grant logs

2. **Revoked Foreground Permission:**
   - Settings → Apps → RunRoute → Permissions → Revoke location
   - Start a run
   - Expected: Alert "Location Permission Required" with specific message
   - Grant when prompted
   - Expected: Run starts successfully

3. **Revoked Background Permission:**
   - Grant foreground, deny background when prompted
   - Expected: Alert "Background Location Permission Required" with retry button
   - Press "Try Again" and grant permission
   - Expected: Run starts successfully

4. **Success Flow with Locked Phone:**
   - All permissions granted
   - Start run
   - Lock phone for 2+ minutes
   - Unlock phone
   - Expected: GPS trail continues, distance/pace updated

5. **Console Verification:**
   - Check console output shows detailed logging for each step
   - Errors should show specific failure reason, not generic message

## Outcome

Fixed the "Failed to start GPS tracking" error by:

- ✅ Requesting both foreground and background permissions upfront
- ✅ Providing specific, actionable error messages for each failure type
- ✅ Adding retry functionality when permissions are denied
- ✅ Removing redundant permission checks that could fail silently
- ✅ Improving debugging with detailed console logging
- ✅ Better error handling and propagation throughout the permission flow

The app now clearly communicates what permission is needed and why, making it easier for users to grant the correct permissions. The detailed logging will help diagnose any remaining issues in production builds.

## Files Modified

1. `src/screens/track/RunTrackerScreen.tsx` - Permission request flow and error handling
2. `src/services/backgroundLocationService.ts` - Simplified permission logic, improved logging
3. `task logs/2026-01-18-gps-permission-fix.md` - This documentation file
