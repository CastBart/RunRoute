# fix: Add missing DELETE policies for routes, run_posts, and comments

**Date**: 2026-01-23
**Type**: fix
**Priority**: HIGH (User Experience + Security)

## Summary

Added missing DELETE policies to three tables (`routes`, `run_posts`, `comments`) to enable users to delete their own content via the app. Previously, users could not delete routes, posts, or comments they created.

## Problem

Three tables had RLS enabled with SELECT, INSERT, and UPDATE policies, but **no DELETE policy**:
- `routes` - Users could not delete their own saved routes
- `run_posts` - Users could not delete their own social posts
- `comments` - Users could not delete their own comments

**Discovery**: Identified during Project Reset Audit (January 23, 2026) via Supabase security advisors.

**Note**: The `runs` table already has a DELETE policy (added in migration on 2026-01-22).

## Root Cause

When RLS is enabled on a table, all operations (SELECT, INSERT, UPDATE, DELETE) are denied by default unless explicit policies are created. These three tables were missing DELETE policies, causing all deletion attempts to silently fail with zero rows affected.

## Changes

### Database Migration

Created `supabase/migrations/20260123130000_add_missing_delete_policies.sql`:

```sql
-- routes: Allow users to delete their own routes
CREATE POLICY "Users can delete own routes"
ON public.routes
FOR DELETE
USING (auth.uid() = user_id);

-- run_posts: Allow users to delete their own posts
CREATE POLICY "Users can delete own posts"
ON public.run_posts
FOR DELETE
USING (auth.uid() = user_id);

-- comments: Allow users to delete their own comments
CREATE POLICY "Users can delete own comments"
ON public.comments
FOR DELETE
USING (auth.uid() = user_id);
```

### Policy Details

All policies use the same pattern:
- Check that `auth.uid()` (authenticated user ID) matches the row's `user_id`
- Only allow deletion if the user owns the content

## Verification

### Apply the Migration

**Option 1: Supabase Dashboard**
1. Go to SQL Editor in your Supabase dashboard
2. Copy the SQL from `supabase/migrations/20260123130000_add_missing_delete_policies.sql`
3. Run the SQL

**Option 2: Supabase CLI**
```bash
cd D:\Projects\RunRoute
supabase db push
```

### Verify Policies Exist

Run this query in Supabase SQL Editor:
```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('routes', 'run_posts', 'comments')
  AND cmd = 'DELETE'
ORDER BY tablename;
-- Expected: 3 rows (one DELETE policy per table)
```

### Test in App

**Test 1: Delete Route**
1. Open RunRoute app
2. Navigate to Routes → Saved Routes
3. Tap any saved route → Delete Route
4. Confirm deletion
5. Verify route is removed from the list

**Test 2: Delete Post**
1. Navigate to Social → Your Profile
2. Tap one of your posts
3. Tap "More" → "Delete Post"
4. Confirm deletion
5. Verify post is removed from feed

**Test 3: Delete Comment**
1. Navigate to Social → Any post with your comments
2. Long-press your comment
3. Select "Delete"
4. Verify comment is removed

### Security Advisor Check

After applying migration:
```bash
mcp__supabase__get_advisors --type security
```
Expected: No warnings about missing DELETE policies

## Impact

**User Control**: Users can now delete their own content as expected
**UX**: Delete buttons in app now function correctly
**Data Hygiene**: Users can remove unwanted content from the platform

## Files Changed

- `supabase/migrations/20260123130000_add_missing_delete_policies.sql` - **CREATED** (Migration file)
- `docs/changes/2026-01-23-fix-missing-delete-policies.md` - **CREATED** (This change note)

## Related Changes

- Part of Project Reset Audit security remediation
- Complements existing DELETE policy on `runs` table (added 2026-01-22)
- See also: `docs/changes/2026-01-22-fix-run-deletion.md`

## No Application Code Changes Required

The following code was already correctly implemented:
- `routeService.deleteRoute()`
- `socialService.deletePost()`
- `socialService.deleteComment()`

The issue was purely at the database RLS policy layer.
