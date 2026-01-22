# fix: Enable cascade deletion of posts when run is deleted

**Date**: 2026-01-22
**Type**: fix

## Summary

Fixed a foreign key constraint error that prevented users from deleting runs that had associated posts. The system now properly cascades the deletion to remove both the run and its associated post, with clear user notification.

## Problem

Users encountered a database error when attempting to delete a run that had been shared to their feed:

```
Error deleting run: {
  "code": "23503",
  "details": "Key is still referenced from table \"run_posts\".",
  "message": "update or delete on table \"runs\" violates foreign key constraint \"run_posts_run_id_fkey\" on table \"run_posts\""
}
```

## Root Cause

The `run_posts.run_id` foreign key constraint referenced `runs.id` without `ON DELETE CASCADE`. This prevented runs from being deleted when associated posts existed in the `run_posts` table.

## Changes

### 1. Database Migration

Created `supabase/migrations/20260122_fix_runs_cascade_deletes.sql`:

- Dropped the existing `run_posts_run_id_fkey` constraint
- Recreated it with `ON DELETE CASCADE` behavior
- Now when a run is deleted, associated posts are automatically deleted

### 2. UI Enhancement

Updated `src/screens/history/RunDetailScreen.tsx` (lines 187-211):

- Enhanced delete confirmation to warn users when deleting a shared run
- Shows: "This will also delete the associated post from your feed"
- Success message confirms both run and post deletion
- No warning shown for runs that haven't been shared

## Verification

### Apply the Migration

**Supabase Dashboard:**
1. Go to SQL Editor in Supabase dashboard
2. Copy SQL from `supabase/migrations/20260122_fix_runs_cascade_deletes.sql`
3. Execute the SQL
4. Verify with:
   ```sql
   SELECT
       conname AS constraint_name,
       pg_get_constraintdef(oid) AS constraint_definition
   FROM pg_constraint
   WHERE contype = 'f'
     AND confrelid = 'runs'::regclass
   ORDER BY conname;
   ```
   Expected: `run_posts_run_id_fkey` shows `ON DELETE CASCADE`

**Supabase CLI (if configured):**
```bash
supabase db push
```

### Test Deletion

1. Create a test run
2. Share it to your feed (creates a post)
3. Navigate to Run Detail screen
4. Tap "More" → "Delete Run"
5. Verify the warning message mentions post deletion
6. Confirm deletion
7. Verify both run and post are removed

### Test Non-Shared Run

1. Create a run without sharing
2. Delete it
3. Verify standard deletion message (no post warning)
4. Deletion succeeds without errors

## Files Changed

- `supabase/migrations/20260122_fix_runs_cascade_deletes.sql` - New migration
- `src/screens/history/RunDetailScreen.tsx` - Enhanced delete confirmation UI
- `docs/changes/2026-01-22-fix-run-deletion-cascade.md` - This change note

## Related

This fix complements the RLS policy fix documented in:
- `docs/changes/2026-01-22-fix-run-deletion.md` - Added DELETE and UPDATE RLS policies

Together, these changes ensure users can successfully delete their runs with proper security and cascade behavior.
