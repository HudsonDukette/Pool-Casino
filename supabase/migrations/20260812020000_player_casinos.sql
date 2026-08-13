-- Ensure update_updated_at_column function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PLAYER CASINOS
CREATE TABLE IF NOT EXISTS public.player_casinos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  theme text NOT NULL DEFAULT 'default',
  house_edge numeric NOT NULL DEFAULT 5 CHECK (house_edge >= 0 AND house_edge <= 50),
  min_bet numeric NOT NULL DEFAULT 10 CHECK (min_bet > 0),
  max_bet numeric NOT NULL DEFAULT 1000 CHECK (max_bet > min_bet),
  bankroll numeric NOT NULL DEFAULT 10000 CHECK (bankroll >= 0),
  initial_bankroll numeric NOT NULL DEFAULT 10000,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  enabled_games text[] NOT NULL DEFAULT ARRAY['coinflip', 'dice', 'wheel', 'crash', 'plinko']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_casinos_owner_idx ON public.player_casinos(owner_id);
CREATE INDEX IF NOT EXISTS player_casinos_status_idx ON public.player_casinos(status, created_at DESC);
CREATE INDEX IF NOT EXISTS player_casinos_theme_idx ON public.player_casinos(theme);

GRANT SELECT, INSERT, UPDATE ON public.player_casinos TO authenticated;
GRANT ALL ON public.player_casinos TO service_role;
ALTER TABLE public.player_casinos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read all casinos" ON public.player_casinos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Create casinos" ON public.player_casinos FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Update own casinos" ON public.player_casinos FOR UPDATE TO authenticated USING (owner_id = auth.uid());

CREATE TRIGGER player_casinos_updated_at BEFORE UPDATE ON public.player_casinos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CASINO MEMBERS
CREATE TABLE IF NOT EXISTS public.casino_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.player_casinos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'player' CHECK (role IN ('owner', 'admin', 'player', 'moderator')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (casino_id, user_id)
);

CREATE INDEX IF NOT EXISTS casino_members_casino_idx ON public.casino_members(casino_id);
CREATE INDEX IF NOT EXISTS casino_members_user_idx ON public.casino_members(user_id);

GRANT SELECT, INSERT, DELETE ON public.casino_members TO authenticated;
GRANT ALL ON public.casino_members TO service_role;
ALTER TABLE public.casino_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read casino members" ON public.casino_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Join casinos" ON public.casino_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leave casinos" ON public.casino_members FOR DELETE TO authenticated USING (user_id = auth.uid());

-- CASINO BETS
CREATE TABLE IF NOT EXISTS public.casino_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.player_casinos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type text NOT NULL,
  option text NOT NULL,
  bet_amount numeric NOT NULL CHECK (bet_amount > 0),
  payout numeric NOT NULL DEFAULT 0,
  result text NOT NULL CHECK (result IN ('win', 'loss')),
  multiplier numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS casino_bets_casino_idx ON public.casino_bets(casino_id, created_at DESC);
CREATE INDEX IF NOT EXISTS casino_bets_user_idx ON public.casino_bets(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.casino_bets TO authenticated;
GRANT ALL ON public.casino_bets TO service_role;
ALTER TABLE public.casino_bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read casino bets" ON public.casino_bets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Place casino bets" ON public.casino_bets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Enable realtime for casino updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_casinos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.casino_bets;