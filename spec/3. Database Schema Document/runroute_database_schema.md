# RunRoute - Database Schema Design

## 1. Overview

This document defines the complete database schema for RunRoute using PostgreSQL (Supabase). The schema is designed to support user authentication, route planning, GPS tracking, run history, and social features while maintaining performance and data integrity.

## 2. Database Configuration

### Supabase Setup
- **Database**: PostgreSQL 15+
- **Extensions Required**:
  - `uuid-ossp` - UUID generation
  - `postgis` - Geospatial data support (optional for future geo-queries)
  - `pg_stat_statements` - Query performance monitoring

### Connection Settings
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
```

## 3. Core Tables

### 3.1 Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Supabase Auth Integration
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Profile Information
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE,
  full_name VARCHAR(100),
  avatar_url VARCHAR(500),
  bio TEXT,
  
  -- Preferences
  preferred_units VARCHAR(10) DEFAULT 'metric' CHECK (preferred_units IN ('metric', 'imperial')),
  privacy_level VARCHAR(20) DEFAULT 'public' CHECK (privacy_level IN ('public', 'friends', 'private')),
  
  -- Location Privacy
  hide_exact_location BOOLEAN DEFAULT false,
  location_privacy_radius_meters INTEGER DEFAULT 100,
  
  -- Statistics (denormalized for performance)
  total_runs INTEGER DEFAULT 0,
  total_distance_meters FLOAT DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_created_at ON users(created_at);

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public profiles" ON users
  FOR SELECT USING (
    privacy_level = 'public' OR 
    auth.uid() = auth_id OR
    EXISTS (
      SELECT 1 FROM user_follows 
      WHERE follower_id = auth.uid() AND following_id = auth_id
    )
  );

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = auth_id);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = auth_id);
```

### 3.2 Planned Routes Table
```sql
CREATE TABLE planned_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(auth_id) ON DELETE CASCADE,
  
  -- Route Metadata
  name VARCHAR(100),
  description TEXT,
  target_distance_meters FLOAT NOT NULL CHECK (target_distance_meters > 0),
  actual_distance_meters FLOAT,
  
  -- Route Configuration
  is_loop BOOLEAN DEFAULT false,
  difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
  
  -- Geographic Data
  start_latitude DECIMAL(10, 8) NOT NULL,
  start_longitude DECIMAL(11, 8) NOT NULL,
  end_latitude DECIMAL(10, 8),
  end_longitude DECIMAL(11, 8),
  
  -- Route Data
  waypoints JSONB DEFAULT '[]'::jsonb,
  route_polyline TEXT, -- Encoded polyline string
  elevation_gain_meters FLOAT DEFAULT 0,
  
  -- Route Source
  route_source VARCHAR(20) DEFAULT 'google' CHECK (route_source IN ('google', 'mapbox', 'manual')),
  
  -- Usage Statistics
  times_used INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_planned_routes_user_id ON planned_routes(user_id);
CREATE INDEX idx_planned_routes_distance ON planned_routes(target_distance_meters);
CREATE INDEX idx_planned_routes_location ON planned_routes(start_latitude, start_longitude);
CREATE INDEX idx_planned_routes_created_at ON planned_routes(created_at);

-- RLS Policies
ALTER TABLE planned_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own routes" ON planned_routes
  FOR ALL USING (auth.uid() = user_id);
```

### 3.3 Runs Table
```sql
CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(auth_id) ON DELETE CASCADE,
  planned_route_id UUID REFERENCES planned_routes(id) ON DELETE SET NULL,
  
  -- Run Metadata
  title VARCHAR(100),
  notes TEXT,
  
  -- Performance Metrics
  distance_meters FLOAT NOT NULL CHECK (distance_meters > 0),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  average_pace_seconds_per_km FLOAT,
  max_pace_seconds_per_km FLOAT,
  min_pace_seconds_per_km FLOAT,
  
  -- Geographic Data
  start_latitude DECIMAL(10, 8),
  start_longitude DECIMAL(11, 8),
  end_latitude DECIMAL(10, 8),
  end_longitude DECIMAL(11, 8),
  
  -- Route Data
  route_polyline TEXT NOT NULL, -- Actual GPS tracked route
  waypoints JSONB DEFAULT '[]'::jsonb, -- GPS waypoints with timestamps
  elevation_gain_meters FLOAT DEFAULT 0,
  elevation_loss_meters FLOAT DEFAULT 0,
  
  -- Weather & Conditions (optional)
  temperature_celsius FLOAT,
  weather_condition VARCHAR(50),
  humidity_percent INTEGER CHECK (humidity_percent BETWEEN 0 AND 100),
  
  -- Tracking Metadata
  gps_accuracy_meters FLOAT,
  paused_duration_seconds INTEGER DEFAULT 0,
  manual_adjustments JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT check_completion_after_start CHECK (completed_at > started_at),
  CONSTRAINT check_duration_matches_time CHECK (
    duration_seconds <= EXTRACT(EPOCH FROM (completed_at - started_at)) + paused_duration_seconds
  )
);

-- Indexes
CREATE INDEX idx_runs_user_id ON runs(user_id);
CREATE INDEX idx_runs_started_at ON runs(started_at);
CREATE INDEX idx_runs_distance ON runs(distance_meters);
CREATE INDEX idx_runs_duration ON runs(duration_seconds);
CREATE INDEX idx_runs_planned_route ON runs(planned_route_id);
CREATE INDEX idx_runs_location ON runs(start_latitude, start_longitude);
CREATE INDEX idx_runs_performance ON runs(average_pace_seconds_per_km, distance_meters);

-- RLS Policies
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own runs" ON runs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view public runs" ON runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_id = runs.user_id 
      AND (privacy_level = 'public' OR auth.uid() = auth_id)
    )
  );
```

### 3.4 Social Features Tables

#### Run Posts Table
```sql
CREATE TABLE run_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID UNIQUE NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(auth_id) ON DELETE CASCADE,
  
  -- Post Content
  caption TEXT,
  image_urls TEXT[] DEFAULT '{}',
  
  -- Visibility
  is_public BOOLEAN DEFAULT true,
  
  -- Engagement Metrics (denormalized)
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_run_posts_user_id ON run_posts(user_id);
CREATE INDEX idx_run_posts_created_at ON run_posts(created_at DESC);
CREATE INDEX idx_run_posts_public ON run_posts(is_public, created_at DESC);
CREATE INDEX idx_run_posts_engagement ON run_posts(likes_count DESC, created_at DESC);

-- RLS Policies
ALTER TABLE run_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own posts" ON run_posts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view public posts" ON run_posts
  FOR SELECT USING (
    is_public = true OR 
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_follows 
      WHERE follower_id = auth.uid() AND following_id = user_id
    )
  );
```

#### Post Interactions Tables
```sql
CREATE TABLE post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES run_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(auth_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(post_id, user_id)
);

CREATE TABLE post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES run_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(auth_id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  
  comment_text TEXT NOT NULL CHECK (LENGTH(comment_text) > 0),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX idx_post_likes_user_id ON post_likes(user_id);
CREATE INDEX idx_post_comments_post_id ON post_comments(post_id, created_at);
CREATE INDEX idx_post_comments_user_id ON post_comments(user_id);
CREATE INDEX idx_post_comments_parent ON post_comments(parent_comment_id);

-- RLS Policies
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own likes" ON post_likes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view likes on visible posts" ON post_likes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM run_posts 
      WHERE id = post_likes.post_id 
      AND (is_public = true OR auth.uid() = user_id)
    )
  );

CREATE POLICY "Users can manage own comments" ON post_comments
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view comments on visible posts" ON post_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM run_posts 
      WHERE id = post_comments.post_id 
      AND (is_public = true OR auth.uid() = user_id)
    )
  );
```

#### User Relationships Table
```sql
CREATE TABLE user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES users(auth_id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(auth_id) ON DELETE CASCADE,
  
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- Indexes
CREATE INDEX idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON user_follows(following_id);
CREATE INDEX idx_user_follows_active ON user_follows(status, created_at);

-- RLS Policies
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own follows" ON user_follows
  FOR ALL USING (auth.uid() = follower_id);

CREATE POLICY "Users can see who follows them" ON user_follows
  FOR SELECT USING (auth.uid() = following_id OR auth.uid() = follower_id);
```

## 4. Utility Tables

### 4.1 App Configuration Table
```sql
CREATE TABLE app_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO app_config (key, value, description) VALUES
('max_route_distance_km', '100', 'Maximum allowed route distance in kilometers'),
('max_waypoints_per_route', '20', 'Maximum waypoints allowed per route'),
('gps_tracking_interval_ms', '5000', 'GPS tracking interval in milliseconds'),
('social_feed_page_size', '20', 'Number of posts per page in social feed'),
('max_route_generation_attempts', '3', 'Maximum attempts for route generation'),
('supported_map_providers', '["google", "mapbox"]', 'Supported map service providers');
```

### 4.2 User Sessions Table (for analytics)
```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(auth_id) ON DELETE CASCADE,
  session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  
  -- Session Metadata
  app_version VARCHAR(20),
  platform VARCHAR(20),
  device_info JSONB,
  
  -- Activity Metrics
  routes_planned INTEGER DEFAULT 0,
  runs_tracked INTEGER DEFAULT 0,
  social_interactions INTEGER DEFAULT 0
);

-- Index for analytics queries
CREATE INDEX idx_user_sessions_user_date ON user_sessions(user_id, session_start);
CREATE INDEX idx_user_sessions_platform ON user_sessions(platform, session_start);
```

## 5. Database Functions and Triggers

### 5.1 Update User Statistics
```sql
-- Function to update user statistics when runs are added/modified
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users SET
      total_runs = total_runs + 1,
      total_distance_meters = total_distance_meters + NEW.distance_meters,
      total_duration_seconds = total_duration_seconds + NEW.duration_seconds,
      updated_at = NOW()
    WHERE auth_id = NEW.user_id;
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    UPDATE users SET
      total_runs = total_runs - 1,
      total_distance_meters = total_distance_meters - OLD.distance_meters,
      total_duration_seconds = total_duration_seconds - OLD.duration_seconds,
      updated_at = NOW()
    WHERE auth_id = OLD.user_id;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user stats
CREATE TRIGGER trigger_update_user_stats
  AFTER INSERT OR DELETE ON runs
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats();
```

### 5.2 Update Post Engagement Counts
```sql
-- Function to update post engagement counts
CREATE OR REPLACE FUNCTION update_post_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'post_likes' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE run_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE run_posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
    END IF;
  END IF;
  
  IF TG_TABLE_NAME = 'post_comments' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE run_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE run_posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers for engagement counts
CREATE TRIGGER trigger_update_like_counts
  AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_post_counts();

CREATE TRIGGER trigger_update_comment_counts
  AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_counts();
```

### 5.3 Update Timestamps
```sql
-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_planned_routes_updated_at
  BEFORE UPDATE ON planned_routes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_run_posts_updated_at
  BEFORE UPDATE ON run_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## 6. Performance Optimization

### 6.1 Partitioning Strategy
```sql
-- Partition runs table by month for better performance
CREATE TABLE runs_y2024m01 PARTITION OF runs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Create monthly partitions as needed
-- This can be automated with pg_partman extension
```

### 6.2 Materialized Views for Analytics
```sql
-- User statistics materialized view
CREATE MATERIALIZED VIEW user_stats_summary AS
SELECT 
  u.id,
  u.username,
  u.total_runs,
  u.total_distance_meters,
  u.total_duration_seconds,
  CASE 
    WHEN u.total_duration_seconds > 0 
    THEN u.total_distance_meters / u.total_duration_seconds 
    ELSE 0 
  END as average_speed_ms,
  COUNT(DISTINCT DATE(r.started_at)) as active_days,
  MAX(r.started_at) as last_run_date
FROM users u
LEFT JOIN runs r ON u.auth_id = r.user_id
GROUP BY u.id, u.username, u.total_runs, u.total_distance_meters, u.total_duration_seconds;

-- Refresh strategy
CREATE INDEX idx_user_stats_summary_username ON user_stats_summary(username);
```

## 7. Data Migration and Seeding

### 7.1 Sample Data Setup
```sql
-- Insert sample user (for development)
INSERT INTO users (auth_id, email, username, full_name) VALUES
('11111111-1111-1111-1111-111111111111', 'john@example.com', 'john_runner', 'John Smith');

-- Insert sample planned route
INSERT INTO planned_routes (user_id, name, target_distance_meters, is_loop, start_latitude, start_longitude)
VALUES ('11111111-1111-1111-1111-111111111111', 'Morning Loop', 5000, true, 40.7128, -74.0060);

-- Insert sample run
INSERT INTO runs (user_id, title, distance_meters, duration_seconds, route_polyline, started_at, completed_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Morning Run',
  5250,
  1800,
  'u{~vFdnbnjX@B@D@F?F?FAFAFCFCFEFEHeEiFiIgJkK',
  '2024-01-15 07:00:00',
  '2024-01-15 07:30:00'
);
```

### 7.2 Database Backup Strategy
```sql
-- Regular backup command
-- pg_dump -h localhost -U postgres -d runroute > backup_$(date +%Y%m%d).sql

-- Point-in-time recovery setup
-- Enable WAL archiving in postgresql.conf
-- wal_level = replica
-- archive_mode = on
-- archive_command = 'cp %p /path/to/archive/%f'
```

## 8. Monitoring and Maintenance

### 8.1 Performance Monitoring Queries
```sql
-- Monitor slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Monitor table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 8.2 Maintenance Tasks
```sql
-- Regular maintenance tasks (run weekly)
ANALYZE; -- Update table statistics
REINDEX DATABASE runroute; -- Rebuild indexes
VACUUM FULL; -- Reclaim space (during low traffic)

-- Refresh materialized views
REFRESH MATERIALIZED VIEW user_stats_summary;
```

## 9. Security Considerations

### 9.1 Data Encryption
- All sensitive data encrypted at rest (Supabase default)
- API keys stored in environment variables
- GPS coordinates can be obfuscated for privacy

### 9.2 Audit Trail
```sql
-- Create audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(50) NOT NULL,
  operation VARCHAR(10) NOT NULL,
  user_id UUID,
  old_data JSONB,
  new_data JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, operation, user_id, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

This comprehensive database schema provides a solid foundation for RunRoute with proper relationships, security policies, performance optimizations, and maintenance procedures.