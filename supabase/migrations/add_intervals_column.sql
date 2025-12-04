-- Migration: Add intervals column to runs table
-- Description: Adds support for pace intervals (km/mile splits) in run records
-- Date: 2025-12-03

-- Add intervals column to store pace interval data as JSONB
ALTER TABLE runs
ADD COLUMN intervals JSONB DEFAULT NULL;

-- Add index for querying runs with intervals (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_runs_intervals ON runs USING GIN (intervals);

-- Add comment to document the column
COMMENT ON COLUMN runs.intervals IS
  'Array of pace intervals (splits): [{distance: number (km), pace: number (seconds/km), duration: number (seconds), elevationGain?: number (meters)}]';

-- Example query to find runs with intervals:
-- SELECT id, distance, intervals FROM runs WHERE intervals IS NOT NULL LIMIT 10;
