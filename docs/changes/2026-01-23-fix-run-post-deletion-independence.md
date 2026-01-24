# Fix: Run/Post Deletion Independence

**Type:** `fix`
**Date:** 2026-01-23
**Priority:** P0 - Critical Bug Fix
**Migration:** `20260123170000_fix_run_post_deletion_cascade.sql`

## Problem

Deleting a run cascades to its associated post, causing unwanted data loss:

### Issue 1: Run Deletion Deletes Post (Unwanted)
- **Current Behavior:** Delete a run → associated post is also deleted
- **Desired Behavior:** Delete a run → post remains (run_id set to NULL)
- **User Impact:** Users lose their social posts when cleaning up old runs

### Issue 2: Post Should Be Independent
- **Desired Behavior:** Delete a post → run remains intact
- **Rationale:** Posts are social content; runs are activity records. They should have independent lifecycles.

### Root Cause

The `run_posts.run_id` foreign key constraint was created with `ON DELETE CASCADE`, which automatically deletes posts when their parent run is deleted.

```sql
-- Current constraint behavior:
ALTER TABLE run_posts ADD CONSTRAINT run_posts_run_id_fkey
  FOREIGN KEY (run_id)
  REFERENCES runs(id)
  ON DELETE CASCADE;  -- ❌ Deletes post when run deleted
```

Additionally, the `run_id` column was defined as `NOT NULL`, preventing the existence of "orphaned" posts.

## Solution

Changed the foreign key constraint to use `ON DELETE SET NULL` and made the `run_id` column nullable:

1. **Allow NULL values** on `run_posts.run_id`
2. **Drop CASCADE constraint**
3. **Recreate with SET NULL** behavior

```sql
-- Step 1: Allow NULL values
ALTER TABLE run_posts ALTER COLUMN run_id DROP NOT NULL;

-- Step 2-3: Replace constraint
ALTER TABLE run_posts ADD CONSTRAINT run_posts_run_id_fkey
  FOREIGN KEY (run_id)
  REFERENCES runs(id)
  ON DELETE SET NULL;  -- ✅ Sets to NULL on delete
```

## Impact

### Before Fix
- ❌ Deleting run deletes its post (data loss)
- ✅ Deleting post leaves run intact

### After Fix
- ✅ Deleting run orphans post (run_id → NULL, post content preserved)
- ✅ Deleting post leaves run intact
- ✅ Users can clean up runs without losing social posts
- ✅ Users can still delete orphaned posts if desired

### Orphaned Posts

Posts with `run_id = NULL` are "orphaned" posts where the original run was deleted:
- Post content, images, and comments remain visible
- UI should display "Run deleted" or similar indicator
- User can still view, edit, or delete the orphaned post

## Testing Steps

### 1. Apply the Migration

Run the migration in Supabase:

```bash
# Via Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Run the contents of: supabase/migrations/20260123170000_fix_run_post_deletion_cascade.sql
```

### 2. Verify Constraint Updated

```sql
SELECT
  con.conname AS constraint_name,
  CASE con.confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete,
  rel.relname AS table_name,
  frel.relname AS referenced_table
FROM pg_constraint con
JOIN pg_class rel ON con.conrelid = rel.oid
LEFT JOIN pg_class frel ON con.confrelid = frel.oid
WHERE con.contype = 'f'
  AND rel.relname = 'run_posts'
  AND con.conname = 'run_posts_run_id_fkey';
```

**Expected:** `on_delete = 'SET NULL'`

### 3. Verify Column Nullability

```sql
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'run_posts' AND column_name = 'run_id';
```

**Expected:** `is_nullable = 'YES'`

### 4. Test Run Deletion (Post Survives)

```sql
-- Step 1: Create a test run
INSERT INTO runs (id, user_id, distance_meters, started_at, ended_at)
VALUES (
  gen_random_uuid(),
  auth.uid(),
  5000,
  now(),
  now() + interval '30 minutes'
)
RETURNING id;

-- Step 2: Create a post referencing that run
INSERT INTO run_posts (id, run_id, user_id, content)
VALUES (
  gen_random_uuid(),
  '<run_id_from_step_1>',
  auth.uid(),
  'Amazing run today! 🏃'
)
RETURNING id, run_id;

-- Step 3: Delete the run
DELETE FROM runs WHERE id = '<run_id_from_step_1>';
-- Expected: Success (no FK violation)

-- Step 4: Verify the post still exists with run_id = NULL
SELECT id, run_id, content, created_at
FROM run_posts
WHERE id = '<post_id_from_step_2>';
-- Expected: run_id = NULL, content intact
```

### 5. Test Post Deletion (Run Survives)

```sql
-- Step 1: Create a test run
INSERT INTO runs (id, user_id, distance_meters, started_at, ended_at)
VALUES (
  gen_random_uuid(),
  auth.uid(),
  5000,
  now(),
  now() + interval '30 minutes'
)
RETURNING id;

-- Step 2: Create a post referencing that run
INSERT INTO run_posts (id, run_id, user_id, content)
VALUES (
  gen_random_uuid(),
  '<run_id_from_step_1>',
  auth.uid(),
  'Another great run!'
)
RETURNING id;

-- Step 3: Delete the post
DELETE FROM run_posts WHERE id = '<post_id_from_step_2>';
-- Expected: Success

-- Step 4: Verify the run still exists
SELECT id, distance_meters, started_at
FROM runs
WHERE id = '<run_id_from_step_1>';
-- Expected: Run intact with all data
```

### 6. Test in App

#### Test A: Run Deletion
1. Complete a run
2. Create a social post for that run
3. Navigate to Run History
4. Delete the run
5. Verify:
   - ✅ Run deleted successfully
   - ✅ Post still visible in Social Feed
   - ✅ Post shows "Run deleted" or similar indicator
   - ✅ Post content and images intact

#### Test B: Post Deletion
1. Complete a run
2. Create a social post for that run
3. Navigate to Social Feed
4. Delete the post
5. Verify:
   - ✅ Post deleted successfully
   - ✅ Run still visible in History
   - ✅ Run data intact (distance, duration, map)

#### Test C: Orphaned Post Management
1. Create a run with a post
2. Delete the run (orphans the post)
3. Navigate to Social Feed
4. Find the orphaned post
5. Verify:
   - ✅ Post displays gracefully (no crash)
   - ✅ "Run deleted" or similar indicator shown
   - ✅ Can still view post content/images
   - ✅ Can delete orphaned post if desired

## UI Considerations

The app should handle orphaned posts gracefully:

```typescript
// Example UI logic for displaying posts
if (post.run_id === null) {
  // Show "Run deleted" badge or indicator
  // Disable "View Run" action
  // Still allow viewing content, comments, likes
  // Allow user to delete orphaned post
}
```

## Related Changes

This aligns with existing cascade behavior patterns:
- `routes.original_run_id` → `ON DELETE SET NULL` ✅
- `route_saves.original_run_id` → `ON DELETE SET NULL` ✅
- `runs.route_id` → `ON DELETE SET NULL` ✅ (from previous fix)

## Files Changed

- **Added:** `supabase/migrations/20260123170000_fix_run_post_deletion_cascade.sql`
  - Migration to update the foreign key constraint and column nullability

## Database Schema Impact

```diff
TABLE: run_posts
  - run_id uuid REFERENCES runs(id)
-   Nullable: NO
+   Nullable: YES
-   Constraint: ON DELETE CASCADE
+   Constraint: ON DELETE SET NULL
```

## Risk Assessment

- **Risk Level:** Low
- **Reversibility:** Yes (can recreate constraint with CASCADE and NOT NULL)
- **Data Loss:** None (only changes constraint behavior)
- **Breaking Changes:** None (improves UX, preserves data)
- **Existing Data:** No impact (existing posts retain their run_id)

## Notes

- Orphaned posts (run_id = NULL) are a valid state
- UI must handle orphaned posts gracefully (show indicator, disable "View Run")
- Users can still view, share, comment on, and delete orphaned posts
- This prevents user frustration when cleaning up old run history
- Aligns with user expectations: social posts should survive activity deletion
- Follows best practice: social content has independent lifecycle from source data
