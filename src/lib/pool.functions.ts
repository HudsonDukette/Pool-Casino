import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const getPool = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabasePublic = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  const { data, error } = await supabasePublic
    .from("pool")
    .select("total_amount, biggest_win, biggest_bet, disabled_games, pool_paused")
    .order("id", { ascending: true })
    .limit(1)
    .single();

  if (error) throw error;

  return {
    totalAmount: Number(data.total_amount),
    biggestWin: Number(data.biggest_win),
    biggestBet: Number(data.biggest_bet),
    disabledGames: data.disabled_games ?? [],
    poolPaused: data.pool_paused ?? false,
  };
});
