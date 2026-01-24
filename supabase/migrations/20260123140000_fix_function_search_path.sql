-- Migration: Fix Function search_path Vulnerabilities
-- Date: 2026-01-23
-- Purpose: Add search_path security definer protection to database functions
--          Prevents SQL injection attacks via schema poisoning
-- Priority: P1 - SECURITY
-- Reference: https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY

-- ============================================================================
-- FUNCTION 1: increment_route_save_count
-- ============================================================================

-- Original function had missing search_path protection
-- Recreating with SET search_path = public, pg_temp
CREATE OR REPLACE FUNCTION increment_route_save_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE routes SET save_count = save_count + 1 WHERE id = NEW.route_id;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- FUNCTION 2: decrement_route_save_count
-- ============================================================================

-- Original function had missing search_path protection
-- Recreating with SET search_path = public, pg_temp
CREATE OR REPLACE FUNCTION decrement_route_save_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE routes SET save_count = GREATEST(save_count - 1, 0) WHERE id = OLD.route_id;
  RETURN OLD;
END;
$$;

-- ============================================================================
-- FUNCTION 3: update_follow_counts (increment_follower_count)
-- ============================================================================

-- Note: This function handles both increment and decrement based on operation
-- Original function had missing search_path protection
-- Recreating with SET search_path = public, pg_temp
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment follower count for followed user
    UPDATE profiles
    SET followers_count = followers_count + 1
    WHERE id = NEW.followed_user_id;

    -- Increment following count for follower user
    UPDATE profiles
    SET following_count = following_count + 1
    WHERE id = NEW.follower_user_id;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement follower count for followed user
    UPDATE profiles
    SET followers_count = GREATEST(followers_count - 1, 0)
    WHERE id = OLD.followed_user_id;

    -- Decrement following count for follower user
    UPDATE profiles
    SET following_count = GREATEST(following_count - 1, 0)
    WHERE id = OLD.follower_user_id;

    RETURN OLD;
  END IF;
END;
$$;

-- ============================================================================
-- FUNCTION 4: handle_new_user (auth trigger)
-- ============================================================================

-- Original function had missing search_path protection
-- This function creates a profile entry when a new user signs up
-- Recreating with SET search_path = public, pg_temp
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (NEW.id, NEW.email, NEW.created_at);
  RETURN NEW;
END;
$$;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the migration)
-- ============================================================================

-- Check function definitions have search_path set:
-- SELECT
--   p.proname AS function_name,
--   pg_get_functiondef(p.oid) AS function_definition
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.proname IN (
--     'increment_route_save_count',
--     'decrement_route_save_count',
--     'update_follow_counts',
--     'handle_new_user'
--   );
-- Expected: Each function definition should contain "SET search_path = public, pg_temp"

-- Test increment function:
-- INSERT INTO route_saves (route_id, saved_by_user_id, source_type)
-- VALUES ('<route-id>', auth.uid(), 'own_run');
-- SELECT save_count FROM routes WHERE id = '<route-id>';
-- Expected: save_count incremented by 1

-- Test decrement function:
-- DELETE FROM route_saves WHERE route_id = '<route-id>' AND saved_by_user_id = auth.uid();
-- SELECT save_count FROM routes WHERE id = '<route-id>';
-- Expected: save_count decremented by 1

-- Test follow counts function:
-- INSERT INTO follows (follower_user_id, followed_user_id)
-- VALUES (auth.uid(), '<other-user-id>');
-- SELECT followers_count, following_count FROM profiles WHERE id = '<other-user-id>';
-- Expected: followers_count incremented

-- Test user creation function:
-- (Automatically triggered on auth.users INSERT via trigger)
-- SELECT * FROM profiles WHERE id = '<new-user-id>';
-- Expected: Profile created with matching id and email
