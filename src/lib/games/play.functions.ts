import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GAME_SPECS } from "./specs";
import { resolveGame } from "./engine";

const PlayBody = z.object({
  gameId: z.string().min(1),
  option: z.string().min(1),
  betAmount: z.number().positive().finite().max(1_000_000),
});

export const playGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PlayBody.parse(input))
  .handler(async ({ data, context }) => {
    const spec = GAME_SPECS[data.gameId];
    if (!spec) throw new Error("Unknown game");
    if (!spec.options.some((o) => o.value === data.option)) {
      throw new Error("Invalid selection");
    }

    const { supabase } = context;

    const { data: poolRow, error: poolError } = await supabase
      .from("pool")
      .select("total_amount")
      .order("id", { ascending: true })
      .limit(1)
      .single();
    if (poolError) throw poolError;

    const outcome = resolveGame(spec.id, data.option, data.betAmount, Number(poolRow.total_amount));

    const { data: settled, error } = await supabase.rpc("settle_bet", {
      _game_type: spec.id,
      _bet_amount: data.betAmount,
      _payout: outcome.payout,
      _multiplier: outcome.multiplier,
      _result: outcome.won ? "win" : "loss",
      _metadata: { option: outcome.optionValue },
    });
    if (error) throw new Error(error.message);

    const result = settled as unknown as {
      won: boolean;
      payout: number;
      profit: number;
      newBalance: number;
      newPool: number;
    };

    return {
      won: result.won,
      chance: outcome.chance,
      multiplier: outcome.multiplier,
      optionLabel: outcome.optionLabel,
      betAmount: data.betAmount,
      payout: Number(result.payout),
      profit: Number(result.profit),
      newBalance: Number(result.newBalance),
      newPool: Number(result.newPool),
    };
  });
