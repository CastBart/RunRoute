-- Fix run/post deletion independence
-- Migration: 20260123170000_fix_run_post_deletion_cascade.sql
-- Date: 2026-01-23
--
-- Problem: Deleting a run cascades to its associated post (unwanted behavior)
-- Solution: Change FK constraint from CASCADE to SET NULL
-- Impact: Posts survive run deletion (become orphaned with run_id = NULL)

-- Step 1: Allow NULL on run_id column (currently NOT NULL)
ALTER TABLE run_posts
  ALTER COLUMN run_id DROP NOT NULL;

-- Step 2: Drop existing CASCADE constraint
ALTER TABLE run_posts
  DROP CONSTRAINT IF EXISTS run_posts_run_id_fkey;

-- Step 3: Recreate with SET NULL on delete
-- When a run is deleted: post remains with run_id = NULL (orphaned post)
-- When a post is deleted: run remains intact
ALTER TABLE run_posts
  ADD CONSTRAINT run_posts_run_id_fkey
    FOREIGN KEY (run_id)
    REFERENCES runs(id)
    ON DELETE SET NULL;

-- Verification query (run after migration):
-- SELECT
--   con.conname AS constraint_name,
--   CASE con.confdeltype
--     WHEN 'c' THEN 'CASCADE'
--     WHEN 'n' THEN 'SET NULL'
--   END AS on_delete
-- FROM pg_constraint con
-- JOIN pg_class rel ON con.conrelid = rel.oid
-- WHERE con.contype = 'f'
--   AND rel.relname = 'run_posts'
--   AND con.conname = 'run_posts_run_id_fkey';
-- Expected: on_delete = 'SET NULL'
