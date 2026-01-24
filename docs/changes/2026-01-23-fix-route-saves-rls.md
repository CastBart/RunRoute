# fix: Enable RLS on route_saves table

**Date**: 2026-01-23
**Type**: fix
**Priority**: CRITICAL (Security)

## Summary

Enabled Row Level Security (RLS) on the `route_saves` table and added four ownership-based policies to fix a critical security vulnerability where any authenticated user could access or manipulate all route saves.

## Problem

The `route_saves` table had RLS **disabled**, creating a security vulnerability:
- Any authenticated user could view all saved routes (regardless of ownership)
- Users could insert/update/delete route saves belonging to other users
- No access control enforcement at the database level

**Discovery**: Identified during Project Reset Audit (January 23, 2026) via Supabase MCP advisor tools.

## Root Cause

The `route_saves` table was created without enabling RLS. When a table has RLS disabled, all authenticated users have full access to all rows, bypassing ownership checks.

## Changes

### Database Migration

Created `supabase/migrations/20260123120000_enable_route_saves_rls.sql`:

```sql
-- Enable RLS on route_saves table
ALTER TABLE public.route_saves ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view their own saved routes
CREATE POLICY "Users can view own saved routes"
ON public.route_saves
FOR SELECT
USING (auth.uid() = saved_by_user_id);

-- INSERT: Users can save routes (must match their own user_id)
CREATE POLICY "Users can save routes"
ON public.route_saves
FOR INSERT
WITH CHECK (auth.uid() = saved_by_user_id);

-- DELETE: Users can unsave their own routes
CREATE POLICY "Users can unsave own routes"
ON public.route_saves
FOR DELETE
USING (auth.uid() = saved_by_user_id);

-- UPDATE: Users can update their own route saves
CREATE POLICY "Users can update own saved routes"
ON public.route_saves
FOR UPDATE
USING (auth.uid() = saved_by_user_id)
WITH CHECK (auth.uid() = saved_by_user_id);
```

### Policy Details

All policies enforce ownership using `auth.uid() = saved_by_user_id`:
- **SELECT**: Users can only view their own saved routes
- **INSERT**: Users can only create saves for themselves
- **DELETE**: Users can only delete their own saves
- **UPDATE**: Users can only modify their own saves (both before and after update)

## Verification

### Apply the Migration

**Option 1: Supabase Dashboard**
1. Go to SQL Editor in your Supabase dashboard
2. Copy the SQL from `supabase/migrations/20260123120000_enable_route_saves_rls.sql`
3. Run the SQL

**Option 2: Supabase CLI**
```bash
cd D:\Projects\RunRoute
supabase db push
```

### Verify RLS is Enabled

Run this query in Supabase SQL Editor:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'route_saves';
-- Expected: rowsecurity = true
```

### Verify Policies Exist

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'route_saves'
ORDER BY cmd;
-- Expected: 4 policies (DELETE, INSERT, SELECT, UPDATE)
```

### Test in App

1. Save a route from the social feed
2. Navigate to Routes → My Routes
3. Verify only your saved routes appear
4. Create a second test user account
5. Verify second user cannot see first user's saved routes

### Security Advisor Check

After applying migration, run:
```bash
mcp__supabase__get_advisors --type security
```
Expected: No "RLS Disabled" warning for route_saves

## Impact

**Security**: Eliminates unauthorized access to user route saves
**User Privacy**: Users' saved routes are now private and isolated
**Data Integrity**: Prevents accidental or malicious modification of other users' data

## Files Changed

- `supabase/migrations/20260123120000_enable_route_saves_rls.sql` - **CREATED** (Migration file)
- `docs/changes/2026-01-23-fix-route-saves-rls.md` - **CREATED** (This change note)

## Related Changes

- Part of Project Reset Audit security remediation
- Follows same RLS pattern as other tables (runs, routes, run_posts, etc.)
- Addresses audit finding: "route_saves table has RLS DISABLED"

## No Application Code Changes Required

The `routeService` and related screens already implement correct logic. This fix operates at the database security layer only.
