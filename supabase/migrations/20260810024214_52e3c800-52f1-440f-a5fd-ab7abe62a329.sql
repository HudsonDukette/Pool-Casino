-- 1. Lock down anonymous access to player accounts
DROP POLICY IF EXISTS "Public can read player usernames for wins" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;

CREATE OR REPLACE FUNCTION public.public_leaderboard(_limit integer DEFAULT 20)
RETURNS TABLE(username text, total_profit numeric, biggest_win numeric, games_played integer, level integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.username, p.total_profit, p.biggest_win, p.games_played, p.level
  FROM public.profiles p
  ORDER BY p.total_profit DESC
  LIMIT least(coalesce(_limit, 20), 100);
$$;
GRANT EXECUTE ON FUNCTION public.public_leaderboard(integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_recent_wins(_limit integer DEFAULT 10)
RETURNS TABLE(username text, game_type text, payout numeric, multiplier numeric, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.username, b.game_type, b.payout, b.multiplier, b.created_at
  FROM public.bets b
  JOIN public.profiles p ON p.user_id = b.user_id
  WHERE b.result = 'win'
  ORDER BY b.created_at DESC
  LIMIT least(coalesce(_limit, 10), 50);
$$;
GRANT EXECUTE ON FUNCTION public.public_recent_wins(integer) TO anon, authenticated;

-- 2. Players may no longer forge ledger rows
DROP POLICY IF EXISTS "Users can insert ledger entries they act in" ON public.money_ledger;

-- 3. Atomic, guarded bet settlement
CREATE OR REPLACE FUNCTION public.settle_bet(
  _game_type text,
  _bet_amount numeric,
  _payout numeric,
  _multiplier numeric DEFAULT NULL,
  _result text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _p public.profiles%ROWTYPE;
  _pool public.pool%ROWTYPE;
  _payout_final numeric;
  _profit numeric;
  _won boolean;
  _new_balance numeric;
  _new_pool numeric;
  _new_streak integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _bet_amount IS NULL OR _bet_amount <= 0 THEN RAISE EXCEPTION 'Invalid bet amount'; END IF;
  IF _payout IS NULL OR _payout < 0 THEN RAISE EXCEPTION 'Invalid payout'; END IF;
  IF _game_type IS NULL OR length(_game_type) = 0 THEN RAISE EXCEPTION 'Invalid game'; END IF;

  SELECT * INTO _p FROM public.profiles WHERE user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF _p.is_perma_banned OR _p.is_banned OR _p.is_suspended THEN
    RAISE EXCEPTION 'This account is restricted from playing';
  END IF;
  IF _p.balance < _bet_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  IF _p.last_bet_at IS NOT NULL AND now() - _p.last_bet_at < interval '500 milliseconds' THEN
    RAISE EXCEPTION 'Please slow down between bets';
  END IF;

  SELECT * INTO _pool FROM public.pool ORDER BY id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pool not found'; END IF;
  IF _pool.pool_paused THEN RAISE EXCEPTION 'The pool is currently paused'; END IF;
  IF _game_type = ANY(_pool.disabled_games) THEN RAISE EXCEPTION 'This game is currently disabled'; END IF;
  IF _bet_amount > _pool.total_amount THEN RAISE EXCEPTION 'Bet exceeds the pool bankroll'; END IF;

  -- watchdog: the house can never pay out more than it holds
  _payout_final := least(_payout, _pool.total_amount + _bet_amount);
  _profit := _payout_final - _bet_amount;
  _won := coalesce(_result = 'win', _profit > 0);

  _new_balance := _p.balance - _bet_amount + _payout_final;
  _new_pool := greatest(0, _pool.total_amount + _bet_amount - _payout_final);
  IF _new_balance < 0 THEN RAISE EXCEPTION 'Balance integrity check failed'; END IF;
  _new_streak := CASE WHEN _won THEN _p.current_streak + 1 ELSE 0 END;

  UPDATE public.pool SET
    total_amount = _new_pool,
    biggest_win = greatest(biggest_win, CASE WHEN _won THEN _payout_final ELSE 0 END),
    biggest_bet = greatest(biggest_bet, _bet_amount),
    updated_at = now()
  WHERE id = _pool.id;

  UPDATE public.profiles SET
    balance = _new_balance,
    total_profit = total_profit + _profit,
    biggest_win = greatest(biggest_win, CASE WHEN _won THEN _payout_final ELSE 0 END),
    biggest_bet = greatest(biggest_bet, _bet_amount),
    games_played = games_played + 1,
    current_streak = _new_streak,
    win_streak = greatest(win_streak, _new_streak),
    total_wins = total_wins + CASE WHEN _won THEN 1 ELSE 0 END,
    total_losses = total_losses + CASE WHEN _won THEN 0 ELSE 1 END,
    xp = xp + greatest(1, floor(_bet_amount)::integer),
    last_bet_at = now(),
    updated_at = now()
  WHERE id = _p.id;

  INSERT INTO public.bets (user_id, game_type, bet_amount, result, payout, multiplier, metadata)
  VALUES (_uid, _game_type, _bet_amount, CASE WHEN _won THEN 'win' ELSE 'loss' END,
          _payout_final, _multiplier, coalesce(_metadata, '{}'::jsonb));

  INSERT INTO public.money_ledger (event_type, direction, amount, description, actor_user_id, target_user_id)
  VALUES (_game_type, CASE WHEN _profit >= 0 THEN 'in' ELSE 'out' END, abs(_profit),
          format('%s %s', _game_type, CASE WHEN _won THEN 'win' ELSE 'loss' END), _uid, _uid);

  RETURN jsonb_build_object(
    'won', _won,
    'betAmount', _bet_amount,
    'payout', _payout_final,
    'profit', _profit,
    'newBalance', _new_balance,
    'newPool', _new_pool
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_bet(text, numeric, numeric, numeric, text, jsonb) TO authenticated;