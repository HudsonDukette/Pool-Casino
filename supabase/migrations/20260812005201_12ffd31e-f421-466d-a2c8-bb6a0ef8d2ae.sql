
-- profiles donation stats
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS donated_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_total numeric NOT NULL DEFAULT 0;

-- MONEY REQUESTS (orders)
CREATE TABLE IF NOT EXISTS public.money_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  filled_amount numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  audience text NOT NULL DEFAULT 'anyone' CHECK (audience IN ('anyone','admins','players')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','filled','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.money_requests TO authenticated;
GRANT ALL ON public.money_requests TO service_role;
ALTER TABLE public.money_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read requests" ON public.money_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own requests" ON public.money_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner or staff update requests" ON public.money_requests FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER money_requests_updated_at BEFORE UPDATE ON public.money_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- DONATIONS
CREATE TABLE IF NOT EXISTS public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.money_requests(id) ON DELETE SET NULL,
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Involved or staff read donations" ON public.donations FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid() OR public.is_staff(auth.uid()));

-- FRIENDS
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own friendships" ON public.friendships FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());
CREATE POLICY "Send friend request" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Addressee accepts" ON public.friendships FOR UPDATE TO authenticated
  USING (addressee_id = auth.uid()) WITH CHECK (addressee_id = auth.uid());
CREATE POLICY "Either side removes" ON public.friendships FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());
CREATE TRIGGER friendships_updated_at BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CHAT ROOMS
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_private boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.chat_rooms TO authenticated;
GRANT ALL ON public.chat_rooms TO service_role;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chat_room_members (
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.chat_room_members TO authenticated;
GRANT ALL ON public.chat_room_members TO service_role;
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_room_members m WHERE m.room_id = _room_id AND m.user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_view_room(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_rooms r
    WHERE r.id = _room_id
      AND (r.is_private = false OR public.is_room_member(_room_id, _user_id))
  );
$$;

CREATE POLICY "Read public or joined rooms" ON public.chat_rooms FOR SELECT TO authenticated
  USING (is_private = false OR public.is_room_member(id, auth.uid()));
CREATE POLICY "Create rooms" ON public.chat_rooms FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Read memberships of visible rooms" ON public.chat_room_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_view_room(room_id, auth.uid()));
CREATE POLICY "Join visible rooms" ON public.chat_room_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_room(room_id, auth.uid()));
CREATE POLICY "Leave rooms" ON public.chat_room_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- MESSAGES (room messages when room_id set, DMs when recipient_id set)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((room_id IS NULL) <> (recipient_id IS NULL))
);
CREATE INDEX IF NOT EXISTS chat_messages_room_idx ON public.chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_dm_idx ON public.chat_messages(sender_id, recipient_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read room or own DMs" ON public.chat_messages FOR SELECT TO authenticated
  USING (
    (room_id IS NOT NULL AND public.can_view_room(room_id, auth.uid()))
    OR sender_id = auth.uid() OR recipient_id = auth.uid()
  );
CREATE POLICY "Send messages" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (room_id IS NOT NULL AND public.can_view_room(room_id, auth.uid()))
      OR recipient_id IS NOT NULL
    )
  );
CREATE POLICY "Delete own or staff" ON public.chat_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.is_staff(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

INSERT INTO public.chat_rooms (name, slug, is_private)
VALUES ('Main Lobby','lobby',false), ('High Rollers','high-rollers',false), ('Help Desk','help-desk',false)
ON CONFLICT (slug) DO NOTHING;

-- DONATE
CREATE OR REPLACE FUNCTION public.donate_coins(_to_username text, _amount numeric, _request_id uuid DEFAULT NULL, _message text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _from uuid := auth.uid();
  _to uuid;
  _bal numeric;
BEGIN
  IF _from IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not signed in'); END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid amount'); END IF;

  SELECT user_id INTO _to FROM public.profiles WHERE lower(username) = lower(_to_username);
  IF _to IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Player not found'); END IF;
  IF _to = _from THEN RETURN jsonb_build_object('ok', false, 'error', 'You cannot donate to yourself'); END IF;

  SELECT balance INTO _bal FROM public.profiles WHERE user_id = _from FOR UPDATE;
  IF _bal IS NULL OR _bal < _amount THEN RETURN jsonb_build_object('ok', false, 'error', 'Insufficient balance'); END IF;

  UPDATE public.profiles SET balance = balance - _amount, donated_total = donated_total + _amount, updated_at = now() WHERE user_id = _from;
  UPDATE public.profiles SET balance = balance + _amount, received_total = received_total + _amount, updated_at = now() WHERE user_id = _to;

  INSERT INTO public.donations (request_id, from_user_id, to_user_id, amount, message)
  VALUES (_request_id, _from, _to, _amount, coalesce(_message,''));

  IF _request_id IS NOT NULL THEN
    UPDATE public.money_requests
      SET filled_amount = filled_amount + _amount,
          status = CASE WHEN filled_amount + _amount >= amount THEN 'filled' ELSE status END,
          updated_at = now()
      WHERE id = _request_id AND status = 'open';
  END IF;

  INSERT INTO public.money_ledger (event_type, direction, amount, description, actor_user_id, target_user_id)
  VALUES ('donation', 'transfer', _amount, 'Player donation', _from, _to);

  RETURN jsonb_build_object('ok', true, 'balance', (SELECT balance FROM public.profiles WHERE user_id = _from));
END;
$$;

-- TRANSACTIONS
CREATE OR REPLACE FUNCTION public.my_transactions(_limit integer DEFAULT 100)
RETURNS TABLE (kind text, description text, amount numeric, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM (
    SELECT 'bet'::text AS kind,
           b.game_type || ' · ' || b.result AS description,
           (b.payout - b.bet_amount) AS amount,
           b.created_at
    FROM public.bets b WHERE b.user_id = auth.uid()
    UNION ALL
    SELECT 'donation'::text,
           CASE WHEN d.from_user_id = auth.uid()
                THEN 'Donated to ' || coalesce(pt.username,'player')
                ELSE 'Received from ' || coalesce(pf.username,'player') END,
           CASE WHEN d.from_user_id = auth.uid() THEN -d.amount ELSE d.amount END,
           d.created_at
    FROM public.donations d
    LEFT JOIN public.profiles pt ON pt.user_id = d.to_user_id
    LEFT JOIN public.profiles pf ON pf.user_id = d.from_user_id
    WHERE d.from_user_id = auth.uid() OR d.to_user_id = auth.uid()
    UNION ALL
    SELECT 'ledger'::text, l.description,
           CASE WHEN l.direction = 'out' THEN -l.amount ELSE l.amount END,
           l.created_at
    FROM public.money_ledger l
    WHERE l.target_user_id = auth.uid() AND l.event_type <> 'donation'
  ) t
  ORDER BY t.created_at DESC
  LIMIT coalesce(_limit, 100);
$$;

-- LEADERBOARD STATS
CREATE OR REPLACE FUNCTION public.leaderboard_stats(_period text DEFAULT 'lifetime', _limit integer DEFAULT 50)
RETURNS TABLE (
  username text, avatar_url text, level integer, balance numeric, donated numeric,
  max_bet numeric, most_won numeric, most_lost numeric, net_made numeric, net_lost numeric,
  games integer, wins integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH win AS (
    SELECT CASE
      WHEN _period = 'daily' THEN now() - interval '1 day'
      WHEN _period = 'weekly' THEN now() - interval '7 days'
      ELSE '-infinity'::timestamptz END AS since
  ),
  b AS (
    SELECT b.user_id,
      max(b.bet_amount) AS max_bet,
      max(b.payout - b.bet_amount) AS most_won,
      max(b.bet_amount - b.payout) AS most_lost,
      sum(b.payout - b.bet_amount) AS net,
      count(*)::int AS games,
      count(*) FILTER (WHERE b.payout > b.bet_amount)::int AS wins
    FROM public.bets b, win WHERE b.created_at >= win.since
    GROUP BY b.user_id
  ),
  d AS (
    SELECT dn.from_user_id AS user_id, sum(dn.amount) AS donated
    FROM public.donations dn, win WHERE dn.created_at >= win.since
    GROUP BY dn.from_user_id
  )
  SELECT p.username, p.avatar_url, p.level, p.balance,
    coalesce(d.donated, 0),
    coalesce(b.max_bet, 0), coalesce(b.most_won, 0), coalesce(b.most_lost, 0),
    greatest(coalesce(b.net, 0), 0), greatest(-coalesce(b.net, 0), 0),
    coalesce(b.games, 0), coalesce(b.wins, 0)
  FROM public.profiles p
  LEFT JOIN b ON b.user_id = p.user_id
  LEFT JOIN d ON d.user_id = p.user_id
  WHERE p.is_banned = false AND p.is_perma_banned = false
  ORDER BY coalesce(b.net, 0) DESC, p.balance DESC
  LIMIT coalesce(_limit, 50);
$$;

-- OPEN REQUESTS FEED
CREATE OR REPLACE FUNCTION public.open_money_requests(_limit integer DEFAULT 50)
RETURNS TABLE (id uuid, username text, avatar_url text, amount numeric, filled_amount numeric, note text, audience text, status text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, p.username, p.avatar_url, r.amount, r.filled_amount, r.note, r.audience, r.status, r.created_at
  FROM public.money_requests r
  JOIN public.profiles p ON p.user_id = r.user_id
  WHERE r.status = 'open'
  ORDER BY r.created_at DESC
  LIMIT coalesce(_limit, 50);
$$;

-- USER SEARCH (for friends / DMs)
CREATE OR REPLACE FUNCTION public.search_players(_q text, _limit integer DEFAULT 10)
RETURNS TABLE (user_id uuid, username text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.username, p.avatar_url
  FROM public.profiles p
  WHERE _q <> '' AND p.username ILIKE '%' || _q || '%' AND p.user_id <> auth.uid()
  ORDER BY p.username
  LIMIT coalesce(_limit, 10);
$$;

-- FRIENDS LIST
CREATE OR REPLACE FUNCTION public.my_friends()
RETURNS TABLE (user_id uuid, username text, avatar_url text, status text, direction text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS user_id,
         p.username, p.avatar_url, f.status,
         CASE WHEN f.requester_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END AS direction
  FROM public.friendships f
  JOIN public.profiles p ON p.user_id = CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END
  WHERE f.requester_id = auth.uid() OR f.addressee_id = auth.uid()
  ORDER BY f.status, p.username;
$$;

-- MESSAGE FEEDS WITH USERNAMES
CREATE OR REPLACE FUNCTION public.room_messages(_room_id uuid, _limit integer DEFAULT 100)
RETURNS TABLE (id uuid, sender_id uuid, username text, avatar_url text, body text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.sender_id, p.username, p.avatar_url, m.body, m.created_at
  FROM public.chat_messages m
  LEFT JOIN public.profiles p ON p.user_id = m.sender_id
  WHERE m.room_id = _room_id AND public.can_view_room(_room_id, auth.uid())
  ORDER BY m.created_at ASC
  LIMIT coalesce(_limit, 100);
$$;

CREATE OR REPLACE FUNCTION public.dm_messages(_other_user_id uuid, _limit integer DEFAULT 100)
RETURNS TABLE (id uuid, sender_id uuid, username text, avatar_url text, body text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.sender_id, p.username, p.avatar_url, m.body, m.created_at
  FROM public.chat_messages m
  LEFT JOIN public.profiles p ON p.user_id = m.sender_id
  WHERE m.room_id IS NULL
    AND ((m.sender_id = auth.uid() AND m.recipient_id = _other_user_id)
      OR (m.sender_id = _other_user_id AND m.recipient_id = auth.uid()))
  ORDER BY m.created_at ASC
  LIMIT coalesce(_limit, 100);
$$;
