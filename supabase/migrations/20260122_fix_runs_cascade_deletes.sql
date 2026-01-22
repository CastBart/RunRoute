-- Migration: Fix run_posts foreign key to cascade deletes from runs table
-- Description: When a run is deleted, automatically delete related run_posts
-- Date: 2026-01-22
--
-- Problem: Deleting a run fails with error:
-- "update or delete on table "runs" violates foreign key constraint "run_posts_run_id_fkey""
--
-- This happens because run_posts.run_id references runs.id without ON DELETE CASCADE.
-- When a run is deleted, the associated posts should also be deleted automatically.
--
-- Note: routes.original_run_id and route_saves.original_run_id already have
-- ON DELETE SET NULL, which is correct for optional references.

-- Fix run_posts.run_id -> runs.id to cascade deletes
ALTER TABLE public.run_posts
  DROP CONSTRAINT IF EXISTS run_posts_run_id_fkey;

ALTER TABLE public.run_posts
  ADD CONSTRAINT run_posts_run_id_fkey
  FOREIGN KEY (run_id)
  REFERENCES public.runs(id)
  ON DELETE CASCADE;

-- Verification query:
-- SELECT
--     conname AS constraint_name,
--     conrelid::regclass AS table_name,
--     pg_get_constraintdef(oid) AS constraint_definition
-- FROM pg_constraint
-- WHERE contype = 'f'
--   AND confrelid = 'runs'::regclass
-- ORDER BY table_name;
--
-- Expected: run_posts_run_id_fkey should show "ON DELETE CASCADE"
