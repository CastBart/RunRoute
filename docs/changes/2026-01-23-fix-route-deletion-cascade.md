# Fix: Route Deletion Foreign Key Constraint

**Type:** `fix`
**Date:** 2026-01-23
**Priority:** P0 - Critical Bug Fix
**Migration:** `20260123160000_fix_route_deletion_cascade.sql`

## Problem

Deleting a saved route that has associated runs fails with a foreign key constraint violation:

```json
{
  "code": "23503",
  "details": "Key is still referenced from table \"runs\".",
  "message": "update or delete on table \"routes\" violates foreign key constraint \"runs_route_id_fkey\""
}
```

### Root Cause

The `runs.route_id` foreign key constraint was created with `ON DELETE NO ACTION` (the PostgreSQL default), which blocks deletion of any route that has runs associated with it.

```sql
-- Current constraint behavior:
ALTER TABLE runs ADD CONSTRAINT runs_route_id_fkey
  FOREIGN KEY (route_id)
  REFERENCES routes(id)
  ON DELETE NO ACTION;  -- ❌ Blocks deletion
```

## Solution

Changed the foreign key constraint to use `ON DELETE SET NULL`, which:
- Allows routes to be deleted successfully
- Preserves all run data (distance, duration, path, etc.)
- Sets the `route_id` to NULL on associated runs
- Maintains data integrity while improving UX

```sql
-- Fixed constraint behavior:
ALTER TABLE runs ADD CONSTRAINT runs_route_id_fkey
  FOREIGN KEY (route_id)
  REFERENCES routes(id)
  ON DELETE SET NULL;  -- ✅ Sets to NULL on delete
```

## Impact

### Before Fix
- ✅ Deleting route with no runs: Works
- ❌ Deleting route with runs: FK constraint violation

### After Fix
- ✅ Deleting route with no runs: Works
- ✅ Deleting route with runs: Works (route_id set to NULL)
- ✅ Run history preserved: All run data intact

## Testing Steps

### 1. Apply the Migration

Run the migration in Supabase:

```bash
# Via Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Run the contents of: supabase/migrations/20260123160000_fix_route_deletion_cascade.sql
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
  AND rel.relname = 'runs'
  AND con.conname = 'runs_route_id_fkey';
```

**Expected:** `on_delete = 'SET NULL'`

### 3. Test Route Deletion

```sql
-- Step 1: Create a test route
INSERT INTO routes (id, user_id, name, path, distance_meters, is_public)
VALUES (
  gen_random_uuid(),
  auth.uid(),
  'Test Route',
  '{"type":"LineString","coordinates":[[0,0],[1,1]]}'::jsonb,
  1000,
  false
)
RETURNING id;

-- Step 2: Create a run referencing that route
INSERT INTO runs (id, user_id, route_id, distance_meters, started_at, ended_at)
VALUES (
  gen_random_uuid(),
  auth.uid(),
  '<route_id_from_step_1>',
  1000,
  now(),
  now() + interval '10 minutes'
)
RETURNING id, route_id;

-- Step 3: Delete the route
DELETE FROM routes WHERE id = '<route_id_from_step_1>';
-- Expected: Success (no FK violation)

-- Step 4: Verify the run still exists with route_id = NULL
SELECT id, route_id, distance_meters, started_at
FROM runs
WHERE id = '<run_id_from_step_2>';
-- Expected: route_id = NULL, all other data intact
```

### 4. Test in App

1. Create a new route from a run
2. Complete another run using that route
3. Navigate to Saved Routes
4. Delete the route
5. Verify:
   - ✅ Route deleted successfully (no error)
   - ✅ Both runs still visible in History
   - ✅ Runs show correct data (distance, duration, map)
   - ✅ Runs no longer show route name (since route_id is NULL)

## Related Changes

This fix aligns with the existing cascade behavior:
- `routes.original_run_id` → `ON DELETE SET NULL` ✅
- `route_saves.original_run_id` → `ON DELETE SET NULL` ✅
- `run_posts.run_id` → `ON DELETE CASCADE` ✅ (different: posts deleted with run)

## Files Changed

- **Added:** `supabase/migrations/20260123160000_fix_route_deletion_cascade.sql`
  - Migration to update the foreign key constraint

## Database Schema Impact

```diff
TABLE: runs
  - route_id uuid REFERENCES routes(id)
-   Constraint: ON DELETE NO ACTION
+   Constraint: ON DELETE SET NULL
```

## Risk Assessment

- **Risk Level:** Low
- **Reversibility:** Yes (can recreate constraint with NO ACTION)
- **Data Loss:** None (only changes constraint behavior)
- **Breaking Changes:** None (improves UX, no API changes)

## Notes

- The `route_id` column is already nullable (`is_nullable: YES`), so no column alteration needed
- This prevents user frustration when trying to delete routes
- Run history is preserved for analytics and user records
- Aligns with user expectations: deleting a route shouldn't delete runs
