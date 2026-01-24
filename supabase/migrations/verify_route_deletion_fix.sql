-- Verification Script: Route Deletion Fix
-- Purpose: Test that routes can be deleted without blocking on associated runs
-- Run this AFTER applying migration 20260123160000_fix_route_deletion_cascade.sql

-- ============================================================================
-- STEP 1: Verify the constraint was updated
-- ============================================================================

SELECT
  con.conname AS constraint_name,
  CASE con.confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete,
  CASE con.confupdtype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_update,
  rel.relname AS table_name,
  frel.relname AS referenced_table
FROM pg_constraint con
JOIN pg_class rel ON con.conrelid = rel.oid
LEFT JOIN pg_class frel ON con.confrelid = frel.oid
WHERE con.contype = 'f'
  AND rel.relname = 'runs'
  AND con.conname = 'runs_route_id_fkey';

-- Expected Output:
-- constraint_name        | on_delete | on_update | table_name | referenced_table
-- runs_route_id_fkey     | SET NULL  | NO ACTION | runs       | routes
--
-- ✅ PASS if on_delete = 'SET NULL'
-- ❌ FAIL if on_delete = 'NO ACTION' or 'RESTRICT'

-- ============================================================================
-- STEP 2: Test route deletion with associated runs
-- ============================================================================

-- 2a. Create a test route
DO $$
DECLARE
  test_route_id uuid;
  test_run_id uuid;
  run_route_id_before uuid;
  run_route_id_after uuid;
  run_exists_after boolean;
BEGIN
  -- Insert test route
  INSERT INTO routes (id, user_id, name, path, distance_meters, is_public, created_at)
  VALUES (
    gen_random_uuid(),
    auth.uid(),
    'TEST ROUTE - DELETE ME',
    '{"type":"LineString","coordinates":[[0,0],[1,1]]}'::jsonb,
    1000,
    false,
    now()
  )
  RETURNING id INTO test_route_id;

  RAISE NOTICE 'Created test route: %', test_route_id;

  -- Insert test run referencing the route
  INSERT INTO runs (id, user_id, route_id, distance_meters, started_at, ended_at, created_at)
  VALUES (
    gen_random_uuid(),
    auth.uid(),
    test_route_id,
    1000,
    now(),
    now() + interval '10 minutes',
    now()
  )
  RETURNING id, route_id INTO test_run_id, run_route_id_before;

  RAISE NOTICE 'Created test run: % with route_id: %', test_run_id, run_route_id_before;

  -- Attempt to delete the route
  DELETE FROM routes WHERE id = test_route_id;

  RAISE NOTICE 'Successfully deleted route: %', test_route_id;

  -- Check if run still exists and route_id is NULL
  SELECT
    EXISTS(SELECT 1 FROM runs WHERE id = test_run_id),
    route_id
  INTO run_exists_after, run_route_id_after
  FROM runs
  WHERE id = test_run_id;

  IF run_exists_after AND run_route_id_after IS NULL THEN
    RAISE NOTICE '✅ TEST PASSED: Run still exists with route_id = NULL';
  ELSIF run_exists_after AND run_route_id_after IS NOT NULL THEN
    RAISE EXCEPTION '❌ TEST FAILED: Run exists but route_id is not NULL: %', run_route_id_after;
  ELSE
    RAISE EXCEPTION '❌ TEST FAILED: Run was deleted (should have been preserved)';
  END IF;

  -- Cleanup test data
  DELETE FROM runs WHERE id = test_run_id;
  RAISE NOTICE 'Cleaned up test run: %', test_run_id;

END $$;

-- ============================================================================
-- STEP 3: Verify all foreign key constraints on runs table
-- ============================================================================

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
  frel.relname AS referenced_table,
  array_agg(att.attname) AS columns
FROM pg_constraint con
JOIN pg_class rel ON con.conrelid = rel.oid
LEFT JOIN pg_class frel ON con.confrelid = frel.oid
JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
WHERE con.contype = 'f'
  AND rel.relname = 'runs'
GROUP BY con.conname, con.confdeltype, rel.relname, frel.relname
ORDER BY constraint_name;

-- Expected Output:
-- constraint_name        | on_delete | table_name | referenced_table | columns
-- runs_route_id_fkey     | SET NULL  | runs       | routes           | {route_id}
-- runs_user_id_fkey      | NO ACTION | runs       | profiles         | {user_id}
--
-- Notes:
-- - runs_route_id_fkey should be SET NULL (optional reference)
-- - runs_user_id_fkey should stay NO ACTION (required reference, can't delete user if they have runs)

-- ============================================================================
-- SUMMARY
-- ============================================================================
--
-- This script verifies:
-- 1. ✅ Constraint updated to ON DELETE SET NULL
-- 2. ✅ Routes can be deleted when runs exist
-- 3. ✅ Runs are preserved with route_id set to NULL
-- 4. ✅ No data loss occurs
--
-- If all tests pass, the migration is successful!
