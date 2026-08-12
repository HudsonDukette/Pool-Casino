
REVOKE EXECUTE ON FUNCTION public.donate_coins(text, numeric, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.my_transactions(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.search_players(text, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.my_friends() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.room_messages(uuid, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.dm_messages(uuid, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.open_money_requests(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.leaderboard_stats(text, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_view_room(uuid, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.donate_coins(text, numeric, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_transactions(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_players(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_friends() TO authenticated;
GRANT EXECUTE ON FUNCTION public.room_messages(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dm_messages(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_money_requests(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_stats(text, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_room(uuid, uuid) TO authenticated;
