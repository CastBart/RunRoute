# fix: Add missing RLS policies for run deletion and updates

**Date**: 2026-01-22
**Type**: fix

## Summary

Fixed an issue where users could not delete or update their runs from the Run Detail screen due to missing Row Level Security (RLS) policies in the database.

## Problem

Users attempting to delete runs from the Run Detail screen received no error message, but the deletion would silently fail. The delete operation reached the database successfully (HTTP 204 response) but RLS policies blocked the operation with zero rows affected.

## Root Cause

The `runs` table had RLS enabled with only SELECT and INSERT policies configured:
- ✅ `Users can view own runs` (SELECT)
- ✅ `Users can create own runs` (INSERT)
- ❌ Missing: DELETE policy
- ❌ Missing: UPDATE policy

Without explicit DELETE and UPDATE policies, Supabase's RLS security model prevented users from modifying or deleting their own runs.

## Changes

### Database Migration

Created `supabase/migrations/add_runs_delete_update_policies.sql`:

```sql
-- Add DELETE policy to allow users to delete their own runs
CREATE POLICY "Users can delete own runs"
ON public.runs
FOR DELETE
USING (auth.uid() = user_id);

-- Add UPDATE policy to allow users to update their own runs
CREATE POLICY "Users can update own runs"
ON public.runs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### Policy Details

- **DELETE policy**: Checks that the authenticated user (`auth.uid()`) matches the run's `user_id` before allowing deletion
- **UPDATE policy**: Checks ownership both before and after the update using `USING` and `WITH CHECK` clauses

## Verification

### Apply the Migration

**Option 1: Supabase Dashboard**
1. Go to SQL Editor in your Supabase dashboard
2. Copy the SQL from `supabase/migrations/add_runs_delete_update_policies.sql`
3. Run the SQL

**Option 2: Supabase CLI**
```bash
supabase db push
```

### Test Deletion

1. Open the RunRoute app
2. Navigate to History → Select any run
3. Tap "More" → "Delete Run"
4. Confirm deletion
5. Verify the run is removed from the list

### Verify Policies

Run this query in the Supabase SQL Editor:
```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'runs'
ORDER BY cmd;
```

Expected output: 4 policies (SELECT, INSERT, UPDATE, DELETE)

## Files Changed

- `supabase/migrations/add_runs_delete_update_policies.sql` - New migration file
- `docs/changes/2026-01-22-fix-run-deletion.md` - This change note

## No Application Code Changes Required

The `runService.deleteRun()` and `RunDetailScreen.tsx` code was already correct. The issue was purely at the database security layer.
