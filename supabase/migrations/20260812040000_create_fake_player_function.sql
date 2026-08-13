-- Create a database function to generate fake players
-- This runs within the database with service role privileges

-- First, create a helper function to generate random usernames
CREATE OR REPLACE FUNCTION public.generate_random_username()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  parts text[] := ARRAY['Shadow', 'Neon', 'Cyber', 'Digital', 'Quantum', 'Cosmic', 'Stellar', 'Solar', 'Lunar', 'Mystic', 'Dragon', 'Phoenix', 'Titan', 'Apex', 'Prime', 'Elite', 'Master', 'Legend', 'Hero', 'Champion', 'Storm', 'Thunder', 'Lightning', 'Blaze', 'Frost', 'Ice', 'Fire', 'Earth', 'Wind', 'Water', 'Crystal', 'Plasma', 'Atomic', 'Nuclear', 'Void', 'Abyss', 'Nexus', 'Core', 'Flux', 'Spark', 'Rider', 'Walker', 'Runner', 'Hunter', 'Seeker', 'Finder', 'Keeper', 'Guardian', 'Protector', 'Defender'];
  suffixes text[] := ARRAY['X', 'Pro', 'Master', 'King', 'Queen', 'Lord', 'God', 'Elite', 'Prime', 'Alpha', 'Omega', 'Zero', 'One', 'Two', 'Three', 'Max', 'Ultra', 'Mega', 'Giga', 'Tera', '99', '88', '77', '66', '55', '44', '33', '22', '11', '00'];
  result text := '';
  num_parts int;
  i int;
BEGIN
  num_parts := floor(random() * 3) + 2;
  FOR i IN 1..num_parts LOOP
    result := result || parts[floor(random() * array_length(parts, 1)) + 1];
  END LOOP;
  
  IF random() > 0.6 THEN
    result := result || suffixes[floor(random() * array_length(suffixes, 1)) + 1];
  END IF;
  
  RETURN result;
END;
$$;

-- Create a function to create a fake player
-- Note: This creates a profile without an auth user due to foreign key constraint
-- Users will need to be manually created via Supabase dashboard or this will need auth integration
CREATE OR REPLACE FUNCTION public.create_fake_player(username_override text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  username text;
  email text;
  fake_user_id uuid;
  initial_balance numeric;
  result jsonb;
BEGIN
  -- Generate username
  IF username_override IS NOT NULL THEN
    username := username_override;
  ELSE
    username := public.generate_random_username();
  END IF;
  
  -- Generate fake email (for identification only, not a real email)
  email := lower(username) || floor(random() * 1000) || '@fake-casino.com';
  
  -- Generate a fake UUID that doesn't reference a real auth user
  -- This will violate the foreign key constraint, so we need to handle this
  fake_user_id := gen_random_uuid();
  
  -- Set initial balance
  initial_balance := floor(random() * 5000) + 1000;
  
  -- Try to insert the profile
  -- This will fail due to foreign key constraint unless we disable it temporarily
  BEGIN
    INSERT INTO public.profiles (
      user_id,
      username,
      email,
      balance,
      is_admin,
      is_owner,
      is_banned,
      is_perma_banned,
      is_suspended,
      games_played,
      total_wins,
      total_losses
    ) VALUES (
      fake_user_id,
      username,
      email,
      initial_balance,
      false,
      false,
      false,
      false,
      false,
      0,
      0,
      0
    );
    
    result := jsonb_build_object(
      'success', true,
      'user_id', fake_user_id,
      'username', username,
      'email', email,
      'balance', initial_balance,
      'note', 'Profile created without auth user - this violates foreign key constraint'
    );
    
  EXCEPTION WHEN foreign_key_violation THEN
    result := jsonb_build_object(
      'success', false,
      'error', 'Foreign key violation: user_id must reference auth.users(id)',
      'note', 'You need to create actual auth users first via Supabase dashboard'
    );
  END;
  
  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_fake_player TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_random_username TO authenticated;
