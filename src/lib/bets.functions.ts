import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const getRecentWins = createServerFn({ method: "GET" }).handler(async () => {
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
    .from("bets")
    .select("username, game_type, payout, multiplier")
    .gt("payout", 0)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) throw error;

  return (
    data?.map((row) => ({
      username: row.username ?? "Anonymous",
      gameType: row.game_type ?? "Game",
      payout: Number(row.payout),
      multiplier: row.multiplier ? Number(row.multiplier).toFixed(2) : undefined,
    })) ?? []
  );
});
