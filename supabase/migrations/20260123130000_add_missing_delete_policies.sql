-- Migration: Add Missing DELETE Policies
-- Date: 2026-01-23
-- Purpose: Add DELETE policies to routes, run_posts, and comments tables
--          Without these policies, users cannot delete their own content via the app
-- Priority: P1 - BLOCKING (User Experience)

-- ============================================================================
-- ROUTES TABLE - DELETE POLICY
-- ============================================================================

-- Policy: Users can delete their own routes
-- Allows DELETE only when the route was created by the authenticated user
CREATE POLICY "Users can delete own routes"
ON routes
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- RUN_POSTS TABLE - DELETE POLICY
-- ============================================================================

-- Policy: Users can delete their own posts
-- Allows DELETE only when the post was created by the authenticated user
CREATE POLICY "Users can delete own posts"
ON run_posts
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS TABLE - DELETE POLICY
-- ============================================================================

-- Policy: Users can delete their own comments
-- Allows DELETE only when the comment was created by the authenticated user
CREATE POLICY "Users can delete own comments"
ON comments
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the migration)
-- ============================================================================

-- Check policies exist:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE tablename IN ('routes', 'run_posts', 'comments')
--   AND cmd = 'DELETE';
-- Expected: 3 DELETE policies

-- Test route deletion (as authenticated user):
-- INSERT INTO routes (user_id, name, distance_km, route_data)
-- VALUES (auth.uid(), 'Test Route', 5.0, '{"coordinates": []}'::jsonb)
-- RETURNING id;
-- DELETE FROM routes WHERE id = '<returned-id>' AND user_id = auth.uid();
-- Expected: DELETE successful

-- Test post deletion (as authenticated user):
-- INSERT INTO run_posts (user_id, run_id, caption)
-- VALUES (auth.uid(), '<run-id>', 'Test post')
-- RETURNING id;
-- DELETE FROM run_posts WHERE id = '<returned-id>' AND user_id = auth.uid();
-- Expected: DELETE successful

-- Test comment deletion (as authenticated user):
-- INSERT INTO comments (user_id, post_id, comment_text)
-- VALUES (auth.uid(), '<post-id>', 'Test comment')
-- RETURNING id;
-- DELETE FROM comments WHERE id = '<returned-id>' AND user_id = auth.uid();
-- Expected: DELETE successful

-- Verify cross-user protection:
-- User A should NOT be able to delete User B's content
