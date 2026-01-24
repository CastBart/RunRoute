-- Migration: Enable RLS on route_saves Table
-- Date: 2026-01-23
-- Purpose: Fix security vulnerability - route_saves table had RLS disabled
--          Adds owner-only policies to prevent unauthorized access to saved routes
-- Priority: P1 - BLOCKING (Security)

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE route_saves ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES
-- ============================================================================

-- Policy: Users can view their own saved routes
-- Allows SELECT only for routes saved by the authenticated user
CREATE POLICY "Users can view own saved routes"
ON route_saves
FOR SELECT
USING (auth.uid() = saved_by_user_id);

-- Policy: Users can save routes (INSERT)
-- Allows INSERT only when the saved_by_user_id matches the authenticated user
CREATE POLICY "Users can save routes"
ON route_saves
FOR INSERT
WITH CHECK (auth.uid() = saved_by_user_id);

-- Policy: Users can unsave their own routes (DELETE)
-- Allows DELETE only for routes saved by the authenticated user
CREATE POLICY "Users can unsave own routes"
ON route_saves
FOR DELETE
USING (auth.uid() = saved_by_user_id);

-- Policy: Users can update their own saved routes (UPDATE)
-- Allows UPDATE only when saved_by_user_id matches the authenticated user
-- Note: Currently route_saves table has limited UPDATE use cases
CREATE POLICY "Users can update own saved routes"
ON route_saves
FOR UPDATE
USING (auth.uid() = saved_by_user_id)
WITH CHECK (auth.uid() = saved_by_user_id);

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the migration)
-- ============================================================================

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'route_saves';
-- Expected: rowsecurity = true

-- Check policies exist:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies WHERE tablename = 'route_saves';
-- Expected: 4 policies (SELECT, INSERT, DELETE, UPDATE)

-- Test isolation (as authenticated user):
-- INSERT INTO route_saves (route_id, saved_by_user_id, source_type)
-- VALUES ('test-route-id', auth.uid(), 'own_run');
-- SELECT * FROM route_saves WHERE saved_by_user_id = auth.uid();
-- DELETE FROM route_saves WHERE route_id = 'test-route-id' AND saved_by_user_id = auth.uid();

-- Verify cross-user isolation:
-- User A should NOT be able to see User B's saved routes
