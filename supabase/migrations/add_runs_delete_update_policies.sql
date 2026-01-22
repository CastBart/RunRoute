-- Migration: Add DELETE and UPDATE RLS policies to runs table
-- Description: Allows users to delete and update their own runs
-- Date: 2026-01-22

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

-- Verification query:
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'runs'
-- ORDER BY cmd;
-- Expected: 4 policies (SELECT, INSERT, UPDATE, DELETE)
