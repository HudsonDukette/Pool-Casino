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

    const { data: settled, error: settleError } = await supabase.rpc("settle_bet", {
      _game_type: "roulette",
      _bet_amount: betAmount,
      _payout: payout,
      _multiplier: won ? rawPayoutMultiplier : 0,
      _result: won ? "win" : "loss",
      _metadata: { color, resultColor, resultNumber: spinResult.number },
    });

    if (settleError) throw new Error(settleError.message);

    const result = settled as unknown as { newBalance: number; payout: number };

    return {
      won,
      resultColor,
      resultNumber: spinResult.number,
      betAmount,
      payout: Number(result.payout),
      newBalance: Number(result.newBalance),
      winChance,
    };
  });
