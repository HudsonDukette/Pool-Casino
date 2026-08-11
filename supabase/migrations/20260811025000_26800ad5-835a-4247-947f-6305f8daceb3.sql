INSERT INTO public.settings (key, value) VALUES ('username_change_price', '5000')
ON CONFLICT (key) DO NOTHING;

DROP FUNCTION IF EXISTS public.public_leaderboard(integer);
CREATE OR REPLACE FUNCTION public.public_leaderboard(_limit integer DEFAULT 20)
RETURNS TABLE(username text, avatar_url text, total_profit numeric, biggest_win numeric, games_played integer, total_wins integer, level integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.username, p.avatar_url, p.total_profit, p.biggest_win, p.games_played, p.total_wins, p.level
  FROM public.profiles p
  ORDER BY p.total_profit DESC
  LIMIT least(coalesce(_limit, 20), 100);
$$;

CREATE OR REPLACE FUNCTION public.public_profile(_username text)
RETURNS TABLE(
  username text, avatar_url text, bio text, level integer, xp integer,
  total_profit numeric, biggest_win numeric, biggest_bet numeric,
  games_played integer, total_wins integer, total_losses integer,
  win_streak integer, current_streak integer, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.username, p.avatar_url, p.bio, p.level, p.xp,
         p.total_profit, p.biggest_win, p.biggest_bet,
         p.games_played, p.total_wins, p.total_losses,
         p.win_streak, p.current_streak, p.created_at
  FROM public.profiles p
  WHERE lower(p.username) = lower(_username)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.public_profile_bets(_username text, _limit integer DEFAULT 10)
RETURNS TABLE(game_type text, bet_amount numeric, payout numeric, multiplier numeric, result text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.game_type, b.bet_amount, b.payout, b.multiplier, b.result, b.created_at
  FROM public.bets b
  JOIN public.profiles p ON p.user_id = b.user_id
  WHERE lower(p.username) = lower(_username)
  ORDER BY b.created_at DESC
  LIMIT least(coalesce(_limit, 10), 50);
$$;

CREATE OR REPLACE FUNCTION public.change_username(_new_username text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _p public.profiles%ROWTYPE;
  _price numeric;
  _clean text;
  _pool public.pool%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _clean := trim(coalesce(_new_username, ''));
  IF length(_clean) < 3 OR length(_clean) > 20 THEN
    RAISE EXCEPTION 'Username must be 3-20 characters';
  END IF;
  IF _clean !~ '^[A-Za-z0-9._-]+$' THEN
    RAISE EXCEPTION 'Username may only contain letters, numbers, dots, dashes and underscores';
  END IF;

  SELECT coalesce((SELECT value::numeric FROM public.settings WHERE key = 'username_change_price'), 5000) INTO _price;

  SELECT * INTO _p FROM public.profiles WHERE user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF lower(_p.username) = lower(_clean) THEN RAISE EXCEPTION 'That is already your username'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(_clean)) THEN
    RAISE EXCEPTION 'That username is taken';
  END IF;
  IF _p.balance < _price THEN RAISE EXCEPTION 'Not enough tokens to change your username'; END IF;

  SELECT * INTO _pool FROM public.pool ORDER BY id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pool not found'; END IF;

  UPDATE public.profiles SET balance = balance - _price, username = _clean, updated_at = now()
  WHERE id = _p.id;
  UPDATE public.pool SET total_amount = total_amount + _price, updated_at = now() WHERE id = _pool.id;

  INSERT INTO public.money_ledger (event_type, direction, amount, description, actor_user_id, target_user_id)
  VALUES ('username_change', 'in', _price,
          format('Username change %s -> %s', _p.username, _clean), _uid, _uid);

  RETURN jsonb_build_object('username', _clean, 'price', _price,
    'newBalance', _p.balance - _price, 'newPool', _pool.total_amount + _price);
END;
$$;

REVOKE ALL ON FUNCTION public.change_username(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.change_username(text) TO authenticated;