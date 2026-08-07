CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  email text,
  avatar_url text,
  balance numeric(25,2) NOT NULL DEFAULT 10000.00,
  total_profit numeric(25,2) NOT NULL DEFAULT 0.00,
  biggest_win numeric(25,2) NOT NULL DEFAULT 0.00,
  biggest_bet numeric(25,2) NOT NULL DEFAULT 0.00,
  games_played integer NOT NULL DEFAULT 0,
  win_streak integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  total_wins integer NOT NULL DEFAULT 0,
  total_losses integer NOT NULL DEFAULT 0,
  last_daily_claim timestamptz,
  last_bet_at timestamptz,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  is_admin boolean NOT NULL DEFAULT false,
  is_owner boolean NOT NULL DEFAULT false,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage all profiles"
  ON public.profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE public.pool (
  id serial PRIMARY KEY,
  total_amount numeric(15,2) NOT NULL DEFAULT 1000000.00,
  biggest_win numeric(15,2) NOT NULL DEFAULT 0.00,
  biggest_bet numeric(15,2) NOT NULL DEFAULT 0.00,
  disabled_games text[] NOT NULL DEFAULT '{}',
  pool_paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pool TO authenticated;
GRANT ALL ON public.pool TO service_role;

ALTER TABLE public.pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pool"
  ON public.pool FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage pool"
  ON public.pool FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE public.bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  bet_amount numeric(15,2) NOT NULL,
  result text NOT NULL,
  payout numeric(15,2) NOT NULL,
  multiplier numeric(10,4),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.bets TO authenticated;
GRANT ALL ON public.bets TO service_role;

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own bets"
  ON public.bets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own bets"
  ON public.bets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.money_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  direction text NOT NULL,
  amount numeric(25,2) NOT NULL,
  description text NOT NULL DEFAULT '',
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.money_ledger TO authenticated;
GRANT ALL ON public.money_ledger TO service_role;

ALTER TABLE public.money_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read ledger entries they are involved in"
  ON public.money_ledger FOR SELECT
  TO authenticated
  USING (actor_user_id = auth.uid() OR target_user_id = auth.uid());

CREATE POLICY "Users can insert ledger entries they act in"
  ON public.money_ledger FOR INSERT
  TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

CREATE TABLE public.settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
  ON public.settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage settings"
  ON public.settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pool_updated_at
  BEFORE UPDATE ON public.pool
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pool (total_amount, biggest_win, biggest_bet) VALUES (1000000.00, 0.00, 0.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.settings (key, value) VALUES
  ('site_name', 'PoolCasino'),
  ('free_daily_coins', '5000'),
  ('default_avatar', 'https://api.dicebear.com/7.x/avataaars/svg?seed=')
ON CONFLICT (key) DO NOTHING;
