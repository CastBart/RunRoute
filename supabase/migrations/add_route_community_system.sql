-- Migration: Add Community Routes System
-- Description: Enables users to save runs as reusable routes with attribution tracking
-- Date: 2025-12-03

-- Add columns to routes table for community features
ALTER TABLE routes
ADD COLUMN IF NOT EXISTS is_community_route BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS save_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS original_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) CHECK (source_type IN ('own_run', 'social_post', 'manual'));

-- Create route_saves tracking table
CREATE TABLE IF NOT EXISTS route_saves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  saved_by_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  original_run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
  source_post_id UUID REFERENCES run_posts(id) ON DELETE SET NULL,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('own_run', 'social_post')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(route_id, saved_by_user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_routes_community ON routes(is_community_route) WHERE is_community_route = TRUE;
CREATE INDEX IF NOT EXISTS idx_routes_save_count ON routes(save_count DESC);
CREATE INDEX IF NOT EXISTS idx_route_saves_user ON route_saves(saved_by_user_id);
CREATE INDEX IF NOT EXISTS idx_route_saves_route ON route_saves(route_id);

-- Add comments to document the schema
COMMENT ON COLUMN routes.is_community_route IS 'True if route was saved from another user''s post';
COMMENT ON COLUMN routes.save_count IS 'Number of times this route has been saved by users';
COMMENT ON COLUMN routes.original_run_id IS 'Reference to the run this route was created from';
COMMENT ON COLUMN routes.original_user_id IS 'Reference to the user who originally created/ran this route';
COMMENT ON COLUMN routes.source_type IS 'How this route was created: own_run, social_post, or manual';

COMMENT ON TABLE route_saves IS 'Tracks which users saved which routes, enables duplicate prevention';
COMMENT ON COLUMN route_saves.source_type IS 'Whether saved from own run or social post';

-- Function to auto-increment save_count when a route is saved
CREATE OR REPLACE FUNCTION increment_route_save_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE routes SET save_count = save_count + 1 WHERE id = NEW.route_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call increment function after insert
CREATE TRIGGER trigger_increment_save_count
AFTER INSERT ON route_saves FOR EACH ROW
EXECUTE FUNCTION increment_route_save_count();

-- Function to auto-decrement save_count when a route save is removed
CREATE OR REPLACE FUNCTION decrement_route_save_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE routes SET save_count = GREATEST(save_count - 1, 0) WHERE id = OLD.route_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call decrement function after delete
CREATE TRIGGER trigger_decrement_save_count
AFTER DELETE ON route_saves FOR EACH ROW
EXECUTE FUNCTION decrement_route_save_count();

-- Example queries for testing:
-- Find all community routes ordered by popularity:
-- SELECT * FROM routes WHERE is_community_route = TRUE ORDER BY save_count DESC LIMIT 20;

-- Check if user already saved a specific route:
-- SELECT * FROM route_saves WHERE route_id = 'xxx' AND saved_by_user_id = 'yyy';

-- Get route with attribution info:
-- SELECT r.*, p.name as original_user_name, p.avatar_url
-- FROM routes r
-- LEFT JOIN profiles p ON r.original_user_id = p.id
-- WHERE r.id = 'xxx';
