import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type StaffContext = {
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >;
  userId: string;
};

async function requireStaff(context: StaffContext, ownerOnly = false) {
  const { data: me, error } = await context.supabase
    .from("profiles")
    .select("user_id, username, is_admin, is_owner")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw error;
  if (!me || (!me.is_admin && !me.is_owner)) throw new Error("Forbidden");
  if (ownerOnly && !me.is_owner) throw new Error("Owner access required");
  return me;
}

async function logLedger(
  context: StaffContext,
  entry: {
    event_type: string;
    direction: string;
    amount: number;
    description: string;
    target_user_id?: string | null;
  },
) {
  await context.supabase.from("money_ledger").insert({
    ...entry,
    actor_user_id: context.userId,
    target_user_id: entry.target_user_id ?? null,
  });
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await requireStaff(context as StaffContext);
    const supabase = (context as StaffContext).supabase;

    const [poolRes, playersRes, ledgerRes, betsRes, settingsRes] = await Promise.all([
      supabase.from("pool").select("*").order("id").limit(1).maybeSingle(),
      supabase
        .from("profiles")
        .select(
          "user_id, username, email, balance, total_profit, biggest_win, games_played, total_wins, total_losses, is_admin, is_owner, is_suspended, is_banned, is_perma_banned, ban_reason, created_at",
        )
        .order("balance", { ascending: false })
        .limit(200),
      supabase.from("money_ledger").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("bets").select("bet_amount, payout").order("created_at", { ascending: false }).limit(500),
      supabase.from("settings").select("*"),
    ]);

    const players = playersRes.data ?? [];
    const bets = betsRes.data ?? [];
    const playerMoney = players.reduce((sum, p) => sum + Number(p.balance), 0);
    const poolAmount = Number(poolRes.data?.total_amount ?? 0);

    return {
      me: { username: me.username, isAdmin: me.is_admin, isOwner: me.is_owner },
      pool: poolRes.data,
      players,
      ledger: ledgerRes.data ?? [],
      settings: settingsRes.data ?? [],
      stats: {
        playerCount: players.length,
        playerMoney,
        poolAmount,
        moneySupply: playerMoney + poolAmount,
        wagered: bets.reduce((s, b) => s + Number(b.bet_amount), 0),
        paidOut: bets.reduce((s, b) => s + Number(b.payout), 0),
      },
    };
  });

export const refillPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; mode: "add" | "set" }) => input)
  .handler(async ({ data, context }) => {
    await requireStaff(context as StaffContext);
    const supabase = (context as StaffContext).supabase;
    const { data: pool } = await supabase.from("pool").select("*").order("id").limit(1).maybeSingle();
    if (!pool) throw new Error("Pool not found");
    const next = data.mode === "set" ? data.amount : Number(pool.total_amount) + data.amount;
    const { error } = await supabase.from("pool").update({ total_amount: next }).eq("id", pool.id);
    if (error) throw error;
    await logLedger(context as StaffContext, {
      event_type: "admin_pool_refill",
      direction: data.mode === "set" ? "set" : "in",
      amount: data.amount,
      description: `Pool ${data.mode === "set" ? "set to" : "increased by"} ${data.amount}`,
    });
    return { totalAmount: next };
  });

export const adjustPlayerBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; amount: number; mode: "add" | "set" }) => input)
  .handler(async ({ data, context }) => {
    await requireStaff(context as StaffContext);
    const supabase = (context as StaffContext).supabase;
    const { data: player, error: readErr } = await supabase
      .from("profiles")
      .select("user_id, balance")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!player) throw new Error("Player not found");
    const next = data.mode === "set" ? data.amount : Number(player.balance) + data.amount;
    const { error } = await supabase
      .from("profiles")
      .update({ balance: Math.max(0, next) })
      .eq("user_id", data.userId);
    if (error) throw error;
    await logLedger(context as StaffContext, {
      event_type: "admin_player_balance",
      direction: data.mode === "set" ? "set" : data.amount >= 0 ? "in" : "out",
      amount: Math.abs(data.amount),
      description: `Player balance ${data.mode === "set" ? "set to" : "adjusted by"} ${data.amount}`,
      target_user_id: data.userId,
    });
    return { balance: Math.max(0, next) };
  });

export const setModeration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      userId: string;
      action: "suspend" | "ban" | "perma_ban" | "unban";
      reason?: string;
      days?: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context as StaffContext);
    const supabase = (context as StaffContext).supabase;
    const patch: Record<string, unknown> = { ban_reason: data.reason ?? null };
    if (data.action === "suspend") {
      patch["is_suspended"] = true;
      patch["banned_until"] = new Date(Date.now() + (data.days ?? 1) * 86400000).toISOString();
    } else if (data.action === "ban") {
      patch["is_banned"] = true;
      patch["banned_until"] = new Date(Date.now() + (data.days ?? 7) * 86400000).toISOString();
    } else if (data.action === "perma_ban") {
      patch["is_banned"] = true;
      patch["is_perma_banned"] = true;
      patch["banned_until"] = null;
    } else {
      patch["is_suspended"] = false;
      patch["is_banned"] = false;
      patch["is_perma_banned"] = false;
      patch["banned_until"] = null;
      patch["ban_reason"] = null;
    }
    const { error } = await supabase.from("profiles").update(patch).eq("user_id", data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const setUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; username: string }) => input)
  .handler(async ({ data, context }) => {
    await requireStaff(context as StaffContext);
    const username = data.username.trim();
    if (username.length < 3) throw new Error("Username must be at least 3 characters");
    const { error } = await supabase_update(context as StaffContext, data.userId, { username });
    if (error) throw error;
    return { ok: true };
  });

async function supabase_update(context: StaffContext, userId: string, patch: Record<string, unknown>) {
  return context.supabase.from("profiles").update(patch).eq("user_id", userId);
}

export const setRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: "player" | "admin" | "owner" }) => input)
  .handler(async ({ data, context }) => {
    await requireStaff(context as StaffContext, true);
    const patch = {
      is_admin: data.role === "admin" || data.role === "owner",
      is_owner: data.role === "owner",
    };
    const { error } = await supabase_update(context as StaffContext, data.userId, patch);
    if (error) throw error;
    return { ok: true };
  });

export const updateCasinoSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { poolPaused?: boolean; disabledGames?: string[] }) => input)
  .handler(async ({ data, context }) => {
    await requireStaff(context as StaffContext);
    const supabase = (context as StaffContext).supabase;
    const { data: pool } = await supabase.from("pool").select("id").order("id").limit(1).maybeSingle();
    if (!pool) throw new Error("Pool not found");
    const patch: Record<string, unknown> = {};
    if (data.poolPaused !== undefined) patch["pool_paused"] = data.poolPaused;
    if (data.disabledGames !== undefined) patch["disabled_games"] = data.disabledGames;
    const { error } = await supabase.from("pool").update(patch).eq("id", pool.id);
    if (error) throw error;
    return { ok: true };
  });

export const resetEconomy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { playerBalance: number; poolAmount: number }) => input)
  .handler(async ({ data, context }) => {
    await requireStaff(context as StaffContext, true);
    const supabase = (context as StaffContext).supabase;
    const { error: pErr } = await supabase
      .from("profiles")
      .update({ balance: data.playerBalance, total_profit: 0 })
      .gte("balance", 0);
    if (pErr) throw pErr;
    const { data: pool } = await supabase.from("pool").select("id").order("id").limit(1).maybeSingle();
    if (pool) {
      await supabase
        .from("pool")
        .update({ total_amount: data.poolAmount, biggest_win: 0, biggest_bet: 0 })
        .eq("id", pool.id);
    }
    await logLedger(context as StaffContext, {
      event_type: "owner_economy_reset",
      direction: "set",
      amount: data.poolAmount,
      description: `Economy reset: players to ${data.playerBalance}, pool to ${data.poolAmount}`,
    });
    return { ok: true };
  });
