-- MULTIPLAYER GAME ROOMS
CREATE TABLE IF NOT EXISTS public.multiplayer_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bet_amount numeric NOT NULL CHECK (bet_amount > 0),
  max_players integer NOT NULL CHECK (max_players >= 2 AND max_players <= 10),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS multiplayer_rooms_status_idx ON public.multiplayer_rooms(status, created_at DESC);
CREATE INDEX IF NOT EXISTS multiplayer_rooms_game_idx ON public.multiplayer_rooms(game_id, status);

GRANT SELECT, INSERT, UPDATE ON public.multiplayer_rooms TO authenticated;
GRANT ALL ON public.multiplayer_rooms TO service_role;
ALTER TABLE public.multiplayer_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read all multiplayer rooms" ON public.multiplayer_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Create multiplayer rooms" ON public.multiplayer_rooms FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Update own rooms" ON public.multiplayer_rooms FOR UPDATE TO authenticated USING (created_by = auth.uid());

CREATE TRIGGER multiplayer_rooms_updated_at BEFORE UPDATE ON public.multiplayer_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MULTIPLAYER ROOM PLAYERS
CREATE TABLE IF NOT EXISTS public.multiplayer_room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'playing', 'finished', 'left')),
  score numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS multiplayer_room_players_room_idx ON public.multiplayer_room_players(room_id, status);
CREATE INDEX IF NOT EXISTS multiplayer_room_players_user_idx ON public.multiplayer_room_players(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.multiplayer_room_players TO authenticated;
GRANT ALL ON public.multiplayer_room_players TO service_role;
ALTER TABLE public.multiplayer_room_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read room players" ON public.multiplayer_room_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "Join rooms" ON public.multiplayer_room_players FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own player status" ON public.multiplayer_room_players FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Leave rooms" ON public.multiplayer_room_players FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER multiplayer_room_players_updated_at BEFORE UPDATE ON public.multiplayer_room_players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MULTIPLAYER GAME RESULTS
CREATE TABLE IF NOT EXISTS public.multiplayer_game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position integer NOT NULL,
  payout numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS multiplayer_game_results_room_idx ON public.multiplayer_game_results(room_id);
CREATE INDEX IF NOT EXISTS multiplayer_game_results_user_idx ON public.multiplayer_game_results(user_id);

GRANT SELECT, INSERT ON public.multiplayer_game_results TO authenticated;
GRANT ALL ON public.multiplayer_game_results TO service_role;
ALTER TABLE public.multiplayer_game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read game results" ON public.multiplayer_game_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert game results" ON public.multiplayer_game_results FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Enable realtime for multiplayer rooms
ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_room_players;