-- Allow admin users to create fake players without service role key
-- This creates a workaround for RLS policies that normally require service_role

-- Create a function to check if user is admin or owner
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND (p.is_admin = true OR p.is_owner = true)
  );
$$;

-- Add policy to allow admins to create profiles for fake players
CREATE POLICY "Admins can create fake player profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_owner());

-- Add policy to allow admins to read all profiles (needed for fake player management)
CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_owner());

-- Add policy to allow admins to update all profiles (needed for fake player betting)
CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_owner())
  WITH CHECK (public.is_admin_or_owner());

-- Note: This doesn't bypass the foreign key constraint to auth.users
-- We'll need to create actual auth users, which still requires service_role
-- But now at least admins can manage the profiles
