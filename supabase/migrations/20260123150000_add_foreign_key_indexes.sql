-- Migration: Add Foreign Key Indexes
-- Date: 2026-01-23
-- Purpose: Add indexes on foreign key columns for query performance
--          Unindexed foreign keys cause slow JOINs and cascade operations at scale
-- Priority: P2 - PERFORMANCE
-- Impact: Improves query performance for multi-table joins and user-scoped queries

-- ============================================================================
-- RUNS TABLE - Foreign Key Indexes
-- ============================================================================

-- Index on user_id (most common filter for "my runs" queries)
CREATE INDEX IF NOT EXISTS idx_runs_user_id ON runs(user_id);

-- Index on route_id (for "runs from this route" queries)
CREATE INDEX IF NOT EXISTS idx_runs_route_id ON runs(route_id);

-- ============================================================================
-- ROUTES TABLE - Foreign Key Indexes
-- ============================================================================

-- Index on user_id (for "my routes" queries)
CREATE INDEX IF NOT EXISTS idx_routes_user_id ON routes(user_id);

-- Index on original_user_id (for community route attribution)
CREATE INDEX IF NOT EXISTS idx_routes_original_user_id ON routes(original_user_id);

-- Index on original_run_id (for route source tracking)
CREATE INDEX IF NOT EXISTS idx_routes_original_run_id ON routes(original_run_id);

-- ============================================================================
-- ROUTE_SAVES TABLE - Foreign Key Indexes
-- ============================================================================

-- Index on saved_by_user_id (for "my saved routes" queries)
CREATE INDEX IF NOT EXISTS idx_route_saves_saved_by_user_id ON route_saves(saved_by_user_id);

-- Index on route_id (for "who saved this route" queries)
CREATE INDEX IF NOT EXISTS idx_route_saves_route_id ON route_saves(route_id);

-- Index on original_run_id (for source tracking)
CREATE INDEX IF NOT EXISTS idx_route_saves_original_run_id ON route_saves(original_run_id);

-- Index on source_post_id (for post-to-route attribution)
CREATE INDEX IF NOT EXISTS idx_route_saves_source_post_id ON route_saves(source_post_id);

-- ============================================================================
-- RUN_POSTS TABLE - Foreign Key Indexes
-- ============================================================================

-- Index on user_id (for "my posts" queries)
CREATE INDEX IF NOT EXISTS idx_run_posts_user_id ON run_posts(user_id);

-- Index on run_id (for "post for this run" lookups)
CREATE INDEX IF NOT EXISTS idx_run_posts_run_id ON run_posts(run_id);

-- ============================================================================
-- LIKES TABLE - Foreign Key Indexes
-- ============================================================================

-- Index on user_id (for "posts I liked" queries)
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);

-- Index on post_id (for "likes on this post" queries)
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);

-- ============================================================================
-- COMMENTS TABLE - Foreign Key Indexes
-- ============================================================================

-- Index on user_id (for "my comments" queries)
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);

-- Index on post_id (for "comments on this post" queries)
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);

-- ============================================================================
-- FOLLOWS TABLE - Foreign Key Indexes
-- ============================================================================

-- Index on follower_id (for "who I follow" queries)
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);

-- Index on following_id (for "my followers" queries)
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the migration)
-- ============================================================================

-- Check all indexes exist:
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%_user_id'
--   OR indexname LIKE 'idx_%_route_id'
--   OR indexname LIKE 'idx_%_post_id'
--   OR indexname LIKE 'idx_%_run_id'
-- ORDER BY tablename, indexname;
-- Expected: 16+ indexes (all foreign key columns indexed)

-- Test query performance improvement (example):
-- EXPLAIN ANALYZE
-- SELECT r.*, p.name as user_name
-- FROM runs r
-- JOIN profiles p ON r.user_id = p.id
-- WHERE r.user_id = '<user-id>'
-- ORDER BY r.started_at DESC
-- LIMIT 20;
-- Expected: Index Scan on idx_runs_user_id (not Seq Scan)

-- Verify index usage for social feed query:
-- EXPLAIN ANALYZE
-- SELECT rp.*, p.name, p.avatar_url, COUNT(l.id) as likes_count
-- FROM run_posts rp
-- JOIN profiles p ON rp.user_id = p.id
-- LEFT JOIN likes l ON rp.id = l.post_id
-- WHERE rp.user_id IN (
--   SELECT following_id FROM follows WHERE follower_id = '<user-id>'
-- )
-- GROUP BY rp.id, p.name, p.avatar_url
-- ORDER BY rp.created_at DESC;
-- Expected: Index scans on idx_follows_follower_id, idx_run_posts_user_id, idx_likes_post_id

-- Check index sizes (monitor disk usage):
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) as index_size
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%'
-- ORDER BY pg_relation_size(indexrelid) DESC;
