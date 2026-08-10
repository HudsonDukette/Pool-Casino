import { calculateWinChance } from "@/lib/gambling";
import { GAME_SPECS, type GameOption, type GameSpec } from "./specs";

export type GameOutcome = {
  won: boolean;
  chance: number;
  multiplier: number;
  payout: number;
  optionValue: string;
  optionLabel: string;
};

const MIN_CHANCE = 0.005;
const MAX_CHANCE = 0.9;

export function resolveOption(spec: GameSpec, optionValue: string): GameOption {
  return spec.options.find((o) => o.value === optionValue) ?? spec.options[0]!;
}

/** Win chance for an option: pool pressure scaled down by how rich the payout is. */
export function optionWinChance(option: GameOption, betAmount: number, poolTotal: number): number {
  const base = calculateWinChance(betAmount, poolTotal);
  const raw = base * (2 / option.multiplier) * (option.oddsFactor ?? 1);
  return Math.max(MIN_CHANCE, Math.min(option.maxChance ?? MAX_CHANCE, raw));
}

export function resolveGame(
  gameId: string,
  optionValue: string,
  betAmount: number,
  poolTotal: number,
): GameOutcome {
  const spec = GAME_SPECS[gameId];
  if (!spec) throw new Error(`Unknown game: ${gameId}`);
  const option = resolveOption(spec, optionValue);
  const chance = optionWinChance(option, betAmount, poolTotal);
  const won = Math.random() < chance;
  return {
    won,
    chance,
    multiplier: option.multiplier,
    payout: won ? betAmount * option.multiplier : 0,
    optionValue: option.value,
    optionLabel: option.label,
  };
}
