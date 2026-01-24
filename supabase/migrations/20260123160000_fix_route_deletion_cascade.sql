-- Migration: Fix Route Deletion - Set NULL on Runs
-- Date: 2026-01-23
-- Purpose: Allow routes to be deleted without blocking on associated runs
--          When a route is deleted, runs should keep their data but lose the route reference
-- Priority: P0 - CRITICAL BUG FIX
-- Impact: Fixes FK constraint violation when deleting routes with associated runs

-- ============================================================================
-- PROBLEM
-- ============================================================================
-- Error when deleting a route that has associated runs:
-- {
--   "code": "23503",
--   "details": "Key is still referenced from table \"runs\".",
--   "message": "update or delete on table \"routes\" violates foreign key constraint \"runs_route_id_fkey\""
-- }
--
-- Root Cause: runs.route_id references routes.id with ON DELETE NO ACTION
-- This blocks deletion of routes that have runs.

-- ============================================================================
-- DESIRED BEHAVIOR
-- ============================================================================
-- When a user deletes a saved route:
-- - Route is deleted successfully ✅
-- - Associated runs are NOT deleted ✅
-- - Associated runs have route_id set to NULL ✅
-- - Run data remains intact (distance, duration, path, etc.) ✅

-- ============================================================================
-- SOLUTION
-- ============================================================================
-- Change the foreign key constraint from ON DELETE NO ACTION to ON DELETE SET NULL
-- The route_id column is already nullable (confirmed via inspection)

-- Drop the existing constraint
ALTER TABLE public.runs
  DROP CONSTRAINT IF EXISTS runs_route_id_fkey;

-- Recreate with SET NULL on delete
ALTER TABLE public.runs
  ADD CONSTRAINT runs_route_id_fkey
  FOREIGN KEY (route_id)
  REFERENCES public.routes(id)
  ON DELETE SET NULL;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- 1. Check the constraint is updated:
-- SELECT
--   con.conname AS constraint_name,
--   CASE con.confdeltype
--     WHEN 'a' THEN 'NO ACTION'
--     WHEN 'r' THEN 'RESTRICT'
--     WHEN 'c' THEN 'CASCADE'
--     WHEN 'n' THEN 'SET NULL'
--     WHEN 'd' THEN 'SET DEFAULT'
--   END AS on_delete,
--   rel.relname AS table_name,
--   frel.relname AS referenced_table
-- FROM pg_constraint con
-- JOIN pg_class rel ON con.conrelid = rel.oid
-- LEFT JOIN pg_class frel ON con.confrelid = frel.oid
-- WHERE con.contype = 'f'
--   AND rel.relname = 'runs'
--   AND con.conname = 'runs_route_id_fkey';
--
-- Expected: on_delete = 'SET NULL'

-- 2. Test the behavior (manual testing steps):
--
-- Step 1: Create a test route
-- INSERT INTO routes (id, user_id, name, path, distance_meters, is_public)
-- VALUES (
--   gen_random_uuid(),
--   auth.uid(),
--   'Test Route',
--   '{"type":"LineString","coordinates":[[0,0],[1,1]]}'::jsonb,
--   1000,
--   false
-- )
-- RETURNING id;
--
-- Step 2: Create a run referencing that route
-- INSERT INTO runs (id, user_id, route_id, distance_meters, started_at, ended_at)
-- VALUES (
--   gen_random_uuid(),
--   auth.uid(),
--   '<route_id_from_step_1>',
--   1000,
--   now(),
--   now() + interval '10 minutes'
-- )
-- RETURNING id, route_id;
--
-- Step 3: Delete the route
-- DELETE FROM routes WHERE id = '<route_id_from_step_1>';
-- Expected: Success (no FK violation)
--
-- Step 4: Verify the run still exists with route_id = NULL
-- SELECT id, route_id, distance_meters
-- FROM runs
-- WHERE id = '<run_id_from_step_2>';
-- Expected: route_id should be NULL, run data intact

-- ============================================================================
-- NOTES
-- ============================================================================
-- - This aligns with the existing pattern for routes.original_run_id and
--   route_saves.original_run_id which also use ON DELETE SET NULL
-- - Runs maintain their historical data even when the route is deleted
-- - Users can delete routes without worrying about losing run history
