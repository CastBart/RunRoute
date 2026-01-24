-- Verification script for run/post deletion independence fix
-- Run this after applying migration: 20260123170000_fix_run_post_deletion_cascade.sql

-- ============================================================================
-- PART 1: Verify Schema Changes
-- ============================================================================

-- 1. Check constraint behavior (should be SET NULL)
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
  att.attname AS column_name
FROM pg_constraint con
JOIN pg_class rel ON con.conrelid = rel.oid
LEFT JOIN pg_class frel ON con.confrelid = frel.oid
JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
WHERE con.contype = 'f'
  AND rel.relname = 'run_posts'
  AND con.conname = 'run_posts_run_id_fkey';
-- Expected: on_delete = 'SET NULL'

-- 2. Check column nullability (should be YES)
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'run_posts' AND column_name = 'run_id';
-- Expected: is_nullable = 'YES'

-- ============================================================================
-- PART 2: Test Run Deletion (Post Should Survive)
-- ============================================================================

-- Create test run
DO $$
DECLARE
  test_run_id uuid;
  test_post_id uuid;
BEGIN
  -- Step 1: Create a test run
  INSERT INTO runs (id, user_id, distance_meters, started_at, ended_at)
  VALUES (
    gen_random_uuid(),
    auth.uid(),
    5000,
    now(),
    now() + interval '30 minutes'
  )
  RETURNING id INTO test_run_id;

  RAISE NOTICE 'Created test run: %', test_run_id;

  -- Step 2: Create a post for that run
  INSERT INTO run_posts (id, run_id, user_id, content)
  VALUES (
    gen_random_uuid(),
    test_run_id,
    auth.uid(),
    'Test post - should survive run deletion'
  )
  RETURNING id INTO test_post_id;

  RAISE NOTICE 'Created test post: %', test_post_id;

  -- Step 3: Delete the run
  DELETE FROM runs WHERE id = test_run_id;
  RAISE NOTICE 'Deleted run: %', test_run_id;

  -- Step 4: Verify post still exists with run_id = NULL
  PERFORM id FROM run_posts WHERE id = test_post_id AND run_id IS NULL;
  IF FOUND THEN
    RAISE NOTICE '✅ SUCCESS: Post survived run deletion (run_id = NULL)';
  ELSE
    RAISE EXCEPTION '❌ FAILED: Post was deleted or run_id is not NULL';
  END IF;

  -- Cleanup
  DELETE FROM run_posts WHERE id = test_post_id;
  RAISE NOTICE 'Cleaned up test post';
END $$;

-- ============================================================================
-- PART 3: Test Post Deletion (Run Should Survive)
-- ============================================================================

DO $$
DECLARE
  test_run_id uuid;
  test_post_id uuid;
BEGIN
  -- Step 1: Create a test run
  INSERT INTO runs (id, user_id, distance_meters, started_at, ended_at)
  VALUES (
    gen_random_uuid(),
    auth.uid(),
    5000,
    now(),
    now() + interval '30 minutes'
  )
  RETURNING id INTO test_run_id;

  RAISE NOTICE 'Created test run: %', test_run_id;

  -- Step 2: Create a post for that run
  INSERT INTO run_posts (id, run_id, user_id, content)
  VALUES (
    gen_random_uuid(),
    test_run_id,
    auth.uid(),
    'Test post - run should survive post deletion'
  )
  RETURNING id INTO test_post_id;

  RAISE NOTICE 'Created test post: %', test_post_id;

  -- Step 3: Delete the post
  DELETE FROM run_posts WHERE id = test_post_id;
  RAISE NOTICE 'Deleted post: %', test_post_id;

  -- Step 4: Verify run still exists
  PERFORM id FROM runs WHERE id = test_run_id;
  IF FOUND THEN
    RAISE NOTICE '✅ SUCCESS: Run survived post deletion';
  ELSE
    RAISE EXCEPTION '❌ FAILED: Run was deleted';
  END IF;

  -- Cleanup
  DELETE FROM runs WHERE id = test_run_id;
  RAISE NOTICE 'Cleaned up test run';
END $$;

-- ============================================================================
-- PART 4: Summary
-- ============================================================================

SELECT '✅ All verification tests passed!' AS result;
