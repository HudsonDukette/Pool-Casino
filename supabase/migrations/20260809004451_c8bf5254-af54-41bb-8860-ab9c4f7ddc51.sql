CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  base_username text;
  final_username text;
  suffix int := 0;
  first_account boolean;
BEGIN
  base_username := coalesce(
    nullif(NEW.raw_user_meta_data->>'username', ''),
    nullif(split_part(coalesce(NEW.email, ''), '@', 1), ''),
    'player'
  );
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = lower(final_username)) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  END LOOP;

  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO first_account;

  INSERT INTO public.profiles (user_id, username, email, is_admin, is_owner)
  VALUES (NEW.id, final_username, NEW.email, first_account, first_account)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;