-- Add privacy settings columns to profiles table
-- All default to true (public by default)

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS show_on_map boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_comments boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS public_profile boolean NOT NULL DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.show_on_map IS 'Whether to show user runs on public maps';
COMMENT ON COLUMN public.profiles.allow_comments IS 'Whether to allow comments on user shared runs';
COMMENT ON COLUMN public.profiles.public_profile IS 'Whether the user profile is publicly visible';

-- Create index for efficient filtering of public profiles
CREATE INDEX IF NOT EXISTS idx_profiles_public_profile ON public.profiles (public_profile) WHERE public_profile = true;
