# Persist Privacy Settings to Backend

**Type:** feat
**Date:** 2026-01-24
**Author:** Claude (React Native Specialist)

## Summary

Implemented backend persistence for user privacy settings (show_on_map, allow_comments, public_profile). Privacy toggles in SettingsScreen now sync to both local AsyncStorage and the Supabase profiles table, enabling multi-user privacy enforcement.

## Changes

### Database Migration (Pending Application)
- `supabase/migrations/20260124100000_add_privacy_settings_to_profiles.sql`
  - Adds `show_on_map`, `allow_comments`, `public_profile` boolean columns to profiles table
  - All default to `true` (public by default)
  - Includes index for efficient filtering of public profiles

### Type Updates
- `src/types/index.ts`
  - Added privacy fields (`show_on_map`, `allow_comments`, `public_profile`) to `User` interface
  - Added new `PrivacySettings` interface for type-safe privacy updates

### Service Layer
- `src/services/profileService.ts`
  - Added `getPrivacySettings(userId)` method to fetch privacy settings from backend
  - Added `updatePrivacySettings(userId, settings)` method to persist privacy changes

### State Management
- `src/store/preferencesStore.ts`
  - Added local cache for privacy settings: `showOnMap`, `allowComments`, `publicProfile`
  - Added `setPrivacySettings()` action for batch updates
  - Added `privacySettingsLoaded` flag to prevent redundant backend fetches
  - Privacy settings persist to AsyncStorage for offline access

### UI Updates
- `src/screens/profile/SettingsScreen.tsx`
  - Privacy toggles now sync to both local store and backend
  - Added loading state while fetching privacy settings on mount
  - Added disabled state while saving to backend
  - Implemented optimistic updates with rollback on failure
  - Added user-friendly error alerts for save failures

## Technical Details

### Data Flow
1. On SettingsScreen mount, privacy settings are fetched from backend (if not already loaded)
2. Settings are cached in preferencesStore (persisted to AsyncStorage)
3. When user toggles a setting:
   - Optimistic update to local store (immediate UI feedback)
   - Async update to Supabase profiles table
   - On failure: rollback local state and show alert

### Backend Schema
```sql
ALTER TABLE public.profiles
ADD COLUMN show_on_map boolean NOT NULL DEFAULT true,
ADD COLUMN allow_comments boolean NOT NULL DEFAULT true,
ADD COLUMN public_profile boolean NOT NULL DEFAULT true;
```

## Migration Required

The Supabase MCP was in read-only mode during development. The migration file needs to be applied manually:

```bash
# Using Supabase CLI
supabase db push

# Or apply directly to the database
psql -f supabase/migrations/20260124100000_add_privacy_settings_to_profiles.sql
```

## How to Verify

### Before Testing
1. Apply the database migration to add privacy columns to profiles table

### Testing Privacy Persistence
1. Open the app and navigate to Settings
2. Observe loading indicator for privacy settings
3. Toggle any privacy setting (e.g., "Public Profile" off)
4. Close the app completely
5. Reopen the app and return to Settings
6. Verify the toggle state persisted

### Testing Multi-User Enforcement
1. Log in as User A and set "Public Profile" to OFF
2. Log out and log in as User B
3. Query User A's profile from the backend:
   ```sql
   SELECT id, name, public_profile, show_on_map, allow_comments
   FROM profiles WHERE email = 'userA@example.com';
   ```
4. Verify `public_profile = false`

### Testing Error Handling
1. Disable network connectivity
2. Toggle a privacy setting
3. Observe error alert "Could not save privacy setting"
4. Verify the toggle reverts to its previous state

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260124100000_add_privacy_settings_to_profiles.sql` | Created | Migration to add privacy columns |
| `src/types/index.ts` | Modified | Added privacy fields to User, added PrivacySettings type |
| `src/services/profileService.ts` | Modified | Added get/update privacy methods |
| `src/store/preferencesStore.ts` | Modified | Added local privacy state cache |
| `src/screens/profile/SettingsScreen.tsx` | Modified | Integrated backend sync for privacy toggles |

## Platform Notes

No platform-specific differences. The implementation uses standard React Native components and Supabase JS client which work identically on iOS and Android.
