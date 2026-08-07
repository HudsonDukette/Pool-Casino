import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { calculateWinChance, ROULETTE_NUMBERS } from "@/lib/gambling";

const MIN_BET = 0.01;
const BET_COOLDOWN_MS = 1000;

const PlayRouletteBody = z.object({
  betAmount: z.number().min(MIN_BET),
  color: z.enum(["red", "black", "green"]),
});

export const playRoulette = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PlayRouletteBody.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { betAmount, color } = data;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!profile) throw new Error("Profile not found");

    if (profile.last_bet_at) {
      const msSinceLastBet = Date.now() - new Date(profile.last_bet_at).getTime();
      if (msSinceLastBet < BET_COOLDOWN_MS) {
        throw new Error(`Please wait ${Math.ceil((BET_COOLDOWN_MS - msSinceLastBet) / 1000)} second(s) between bets`);
      }
    }


    const currentBalance = Number(profile.balance);
    if (currentBalance < betAmount) {
      throw new Error("Insufficient balance");
    }

    const { data: poolRow } = await supabase
      .from("pool")
      .select("*")
      .order("id", { ascending: true })
      .limit(1)
      .single();

    if (!poolRow) throw new Error("Pool not found");

    const poolAmount = Number(poolRow.total_amount);
    const isGreen = color === "green";
    const winChance = isGreen ? Math.min(calculateWinChance(betAmount, poolAmount), 0.025) : calculateWinChance(betAmount, poolAmount);

    const won = Math.random() < winChance;

    let spinResult: (typeof ROULETTE_NUMBERS)[0];
    if (won) {
      const matchingNumbers = ROULETTE_NUMBERS.filter((n) => n.color === color);
      spinResult = matchingNumbers[Math.floor(Math.random() * matchingNumbers.length)]!;
    } else {
      const nonMatchingNumbers = ROULETTE_NUMBERS.filter((n) => n.color !== color);
      spinResult = nonMatchingNumbers[Math.floor(Math.random() * nonMatchingNumbers.length)]!;
    }

    const resultColor = spinResult.color;
    const rawPayoutMultiplier = isGreen ? 50 : 2;
    const uncappedPayout = won ? betAmount * rawPayoutMultiplier : 0;
    const payout = uncappedPayout > betAmount ? Math.min(uncappedPayout, poolAmount) : uncappedPayout;
    const newBalance = currentBalance - betAmount + payout;
    const newPoolAmount = Math.max(0, poolAmount + betAmount - payout);
    const newBiggestWin = won && payout > Number(poolRow.biggest_win) ? payout : Number(poolRow.biggest_win);
    const newBiggestBet = betAmount > Number(poolRow.biggest_bet) ? betAmount : Number(poolRow.biggest_bet);

    const profit = payout - betAmount;
    const newGamesPlayed = Number(profile.games_played) + 1;
    const newCurrentStreak = won ? Number(profile.current_streak) + 1 : 0;
    const newWinStreak = Math.max(Number(profile.win_streak), newCurrentStreak);

    const now = new Date().toISOString();

    const { error: updatePoolError } = await supabase
      .from("pool")
      .update({
        total_amount: newPoolAmount,
        biggest_win: newBiggestWin,
        biggest_bet: newBiggestBet,
        updated_at: now,
      })
      .eq("id", poolRow.id);

    if (updatePoolError) throw updatePoolError;

    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({
        balance: newBalance,
        total_profit: Number(profile.total_profit) + profit,
        biggest_win: won && payout > Number(profile.biggest_win) ? payout : Number(profile.biggest_win),
        biggest_bet: betAmount > Number(profile.biggest_bet) ? betAmount : Number(profile.biggest_bet),
        games_played: newGamesPlayed,
        win_streak: newWinStreak,
        current_streak: newCurrentStreak,
        total_wins: Number(profile.total_wins) + (won ? 1 : 0),
        total_losses: Number(profile.total_losses) + (!won ? 1 : 0),
        last_bet_at: now,
        updated_at: now,
      })
      .eq("id", profile.id);

    if (updateProfileError) throw updateProfileError;

    const { error: betError } = await supabase.from("bets").insert({
      user_id: userId,
      game_type: "roulette",
      bet_amount: betAmount,
      result: won ? "win" : "loss",
      payout,
      multiplier: won ? rawPayoutMultiplier : 0,
    });

    if (betError) throw betError;

    const { error: ledgerError } = await supabase.from("money_ledger").insert({
      actor_user_id: userId,
      target_user_id: userId,
      amount: Math.abs(profit),
      direction: profit >= 0 ? "in" : "out",
      event_type: "roulette",
      description: `roulette ${won ? "win" : "loss"}: ${resultColor} ${spinResult.number}`,
    });

    if (ledgerError) throw ledgerError;

    return {
      won,
      resultColor,
      resultNumber: spinResult.number,
      betAmount,
      payout,
      newBalance,
      winChance,
    };
  });
