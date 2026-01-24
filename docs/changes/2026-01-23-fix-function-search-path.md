# fix: Add search_path protection to security definer functions

**Date**: 2026-01-23
**Type**: fix
**Priority**: HIGH (Security)

## Summary

Added `SET search_path = public, pg_temp` to four database functions to prevent SQL injection and privilege escalation attacks via schema poisoning.

## Problem

Four `SECURITY DEFINER` functions were missing explicit search_path configuration:
- `increment_route_save_count()`
- `decrement_route_save_count()`
- `update_follow_counts()`
- `handle_new_user()`

**Discovery**: Identified during Project Reset Audit (January 23, 2026) via Supabase security advisors (lint rule: `0011_function_search_path_mutable`).

**Vulnerability**: SECURITY DEFINER functions run with the privileges of the function owner (typically superuser). Without an explicit search_path, an attacker could:
1. Create a malicious schema (e.g., `attacker_schema`)
2. Create malicious functions/tables with same names as legitimate objects
3. Call the SECURITY DEFINER function
4. Function resolves names in attacker's schema instead of `public`
5. Attacker gains elevated privileges

## Root Cause

When a function is created with `SECURITY DEFINER` but without an explicit `SET search_path`, PostgreSQL uses the caller's current search_path to resolve object names. This allows schema poisoning attacks.

**Reference**: [Supabase Database Linter - Function search_path mutable](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)

## Changes

### Database Migration

Created `supabase/migrations/20260123140000_fix_function_search_path.sql`:

Recreated all 4 functions with `SET search_path = public, pg_temp`:

```sql
-- Fix increment_route_save_count
CREATE OR REPLACE FUNCTION public.increment_route_save_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE routes SET save_count = save_count + 1 WHERE id = NEW.route_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

-- Fix decrement_route_save_count
CREATE OR REPLACE FUNCTION public.decrement_route_save_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE routes SET save_count = GREATEST(save_count - 1, 0) WHERE id = OLD.route_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

-- Fix update_follow_counts
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET following_count = following_count - 1 WHERE id = OLD.follower_id;
    UPDATE profiles SET followers_count = followers_count - 1 WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Fix handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', 'Runner'));
  RETURN NEW;
END;
$$;
```

### What Changed

**Before**: Functions used implicit search_path (vulnerable)
```sql
CREATE FUNCTION foo() RETURNS ... AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;
```

**After**: Functions use explicit search_path (secure)
```sql
CREATE FUNCTION foo() RETURNS ... AS $$ ... $$
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;
```

**Why `public, pg_temp`?**
- `public`: Resolves table/function names in the public schema (where our app tables live)
- `pg_temp`: Allows temporary objects (standard PostgreSQL practice)
- No other schemas are searched, preventing schema poisoning

## Verification

### Apply the Migration

**Option 1: Supabase Dashboard**
1. Go to SQL Editor in your Supabase dashboard
2. Copy the SQL from `supabase/migrations/20260123140000_fix_function_search_path.sql`
3. Run the SQL

**Option 2: Supabase CLI**
```bash
cd D:\Projects\RunRoute
supabase db push
```

### Verify search_path is Set

Run this query in Supabase SQL Editor:
```sql
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
WHERE p.proname IN ('increment_route_save_count', 'decrement_route_save_count',
                    'update_follow_counts', 'handle_new_user')
  AND p.pronamespace = 'public'::regnamespace;
```

Expected: Each function definition should contain `SET search_path = public, pg_temp`

### Security Advisor Check

After applying migration:
```bash
mcp__supabase__get_advisors --type security
```
Expected: No `function_search_path_mutable` warnings

### Test Function Behavior

**Test 1: Route Save Count**
1. Save a route from social feed
2. Check `routes` table: `save_count` should increment by 1
3. Unsave the route
4. Check `routes` table: `save_count` should decrement by 1

**Test 2: Follow Counts**
1. Follow a user
2. Check `profiles` table: follower's `following_count` +1, followed user's `followers_count` +1
3. Unfollow the user
4. Check `profiles` table: counts should decrement

**Test 3: New User Creation**
1. Create a new account
2. Verify a profile row is automatically created in `profiles` table

## Impact

**Security**: Prevents SQL injection and privilege escalation attacks
**Behavior**: No functional changes - functions work exactly as before
**Compliance**: Follows PostgreSQL and Supabase security best practices

## Files Changed

- `supabase/migrations/20260123140000_fix_function_search_path.sql` - **CREATED** (Migration file)
- `docs/changes/2026-01-23-fix-function-search-path.md` - **CREATED** (This change note)

## Related Changes

- Part of Project Reset Audit security remediation
- Addresses Supabase linter rule 0011 (function_search_path_mutable)
- Security hardening - no user-facing changes

## No Application Code Changes Required

This is a database-level security fix. All application code remains unchanged.
