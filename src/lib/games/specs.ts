/**
 * Declarative pay tables for every solo game. Shared by the server (outcome
 * resolution) and the client (guest simulation + UI), so the odds a player sees
 * are the odds that get settled.
 */
export type GameOption = {
  value: string;
  label: string;
  /** Total return multiplier on the stake when this option wins. */
  multiplier: number;
  /** Relative odds nudge applied on top of the pool-pressure base chance. */
  oddsFactor?: number;
  /** Hard ceiling on the win chance for this option. */
  maxChance?: number;
};

export type GameSpec = {
  id: string;
  name: string;
  tagline: string;
  prompt: string;
  accent: string;
  options: GameOption[];
  /** Flavour text shown on the result card. */
  outcomes?: { win: string[]; loss: string[] };
};

function opt(
  value: string,
  label: string,
  multiplier: number,
  oddsFactor?: number,
  maxChance?: number,
): GameOption {
  return { value, label, multiplier, ...(oddsFactor !== undefined ? { oddsFactor } : {}), ...(maxChance !== undefined ? { maxChance } : {}) };
}

export const GAME_SPECS: Record<string, GameSpec> = {
  coinflip: {
    id: "coinflip",
    name: "Coin Flip",
    tagline: "Pure 50/50 — the pool decides the edge.",
    prompt: "Call the flip",
    accent: "amber",
    options: [opt("heads", "Heads", 1.95, 1, 0.5), opt("tails", "Tails", 1.95, 1, 0.5)],
    outcomes: { win: ["The coin lands your way."], loss: ["Wrong side up."] },
  },
  dice: {
    id: "dice",
    name: "Dice Roll",
    tagline: "Two dice, three ways to call it.",
    prompt: "Pick your call",
    accent: "emerald",
    options: [
      opt("under", "Under 7", 2.1, 1, 0.48),
      opt("seven", "Exactly 7", 5.5, 0.8),
      opt("over", "Over 7", 2.1, 1, 0.48),
    ],
  },
  wheel: {
    id: "wheel",
    name: "Fortune Wheel",
    tagline: "Neon segments, escalating payouts.",
    prompt: "Choose a segment",
    accent: "fuchsia",
    options: [
      opt("safe", "Safe · 1.5×", 1.5, 1.1, 0.6),
      opt("balanced", "Balanced · 3×", 3, 1),
      opt("wild", "Wild · 10×", 10, 0.9),
    ],
  },
  advwheel: {
    id: "advwheel",
    name: "Advanced Wheel",
    tagline: "Deeper segments, sharper swings.",
    prompt: "Choose a ring",
    accent: "fuchsia",
    options: [
      opt("inner", "Inner · 2×", 2, 1.05),
      opt("middle", "Middle · 6×", 6, 0.95),
      opt("outer", "Outer · 20×", 20, 0.85),
    ],
  },
  crash: {
    id: "crash",
    name: "Crash",
    tagline: "Set your cash-out before the boom.",
    prompt: "Auto cash-out at",
    accent: "red",
    options: [
      opt("1.5", "1.5×", 1.5, 1.1, 0.62),
      opt("2", "2×", 2, 1),
      opt("5", "5×", 5, 0.9),
      opt("20", "20×", 20, 0.8),
    ],
  },
  reversecrash: {
    id: "reversecrash",
    name: "Reverse Crash",
    tagline: "The multiplier falls — buy in low.",
    prompt: "Entry point",
    accent: "red",
    options: [opt("late", "Late · 1.8×", 1.8, 1.05), opt("mid", "Mid · 4×", 4, 0.95), opt("early", "Early · 12×", 12, 0.85)],
  },
  slots: {
    id: "slots",
    name: "Neon Slots",
    tagline: "Three reels, one jackpot line.",
    prompt: "Choose a reel set",
    accent: "yellow",
    options: [
      opt("classic", "Classic · 3×", 3, 1),
      opt("neon", "Neon · 8×", 8, 0.92),
      opt("jackpot", "Jackpot · 50×", 50, 0.7),
    ],
  },
  blackjack: {
    id: "blackjack",
    name: "Blackjack",
    tagline: "Beat the dealer without busting.",
    prompt: "Pick your line",
    accent: "violet",
    options: [
      opt("stand", "Stand safe · 1.9×", 1.9, 1.05, 0.5),
      opt("hit", "Push for 21 · 2.6×", 2.6, 1),
      opt("double", "Double down · 4×", 4, 0.95),
    ],
  },
  war: {
    id: "war",
    name: "Casino War",
    tagline: "High card wins. Ties go to war.",
    prompt: "Place your card",
    accent: "rose",
    options: [opt("play", "Play the card · 1.95×", 1.95, 1, 0.5), opt("war", "Go to war · 4.5×", 4.5, 0.95)],
  },
  plinko: {
    id: "plinko",
    name: "Plinko",
    tagline: "Drop the ball, ride the pegs.",
    prompt: "Risk level",
    accent: "sky",
    options: [
      opt("low", "Low · 2×", 2, 1.1, 0.6),
      opt("medium", "Medium · 5×", 5, 1),
      opt("high", "High · 10×", 10, 0.9),
    ],
  },
  mines: {
    id: "mines",
    name: "Mines",
    tagline: "Clear tiles, dodge the bombs.",
    prompt: "How many mines?",
    accent: "orange",
    options: [
      opt("3", "3 mines · 1.8×", 1.8, 1.1, 0.6),
      opt("6", "6 mines · 3.5×", 3.5, 1),
      opt("12", "12 mines · 9×", 9, 0.9),
    ],
  },
  highlow: {
    id: "highlow",
    name: "High / Low",
    tagline: "Guess the next card up or down.",
    prompt: "Next card is",
    accent: "cyan",
    options: [opt("high", "Higher", 1.95, 1, 0.5), opt("low", "Lower", 1.95, 1, 0.5), opt("same", "Exact match", 12, 0.8)],
  },
  doubledice: {
    id: "doubledice",
    name: "Double Dice",
    tagline: "Two dice, doubled stakes.",
    prompt: "Call the pair",
    accent: "emerald",
    options: [opt("split", "Split · 2×", 2, 1, 0.5), opt("double", "Doubles · 6×", 6, 0.9), opt("snake", "Snake eyes · 30×", 30, 0.75)],
  },
  ladder: {
    id: "ladder",
    name: "Ladder",
    tagline: "Climb rungs, cash out or fall.",
    prompt: "Climb to",
    accent: "lime",
    options: [opt("3", "Rung 3 · 1.7×", 1.7, 1.1, 0.62), opt("6", "Rung 6 · 4×", 4, 1), opt("10", "Rung 10 · 15×", 15, 0.85)],
  },
  target: {
    id: "target",
    name: "Target",
    tagline: "Aim small, win big.",
    prompt: "Pick your ring",
    accent: "red",
    options: [opt("outer", "Outer ring · 1.6×", 1.6, 1.1, 0.65), opt("inner", "Inner ring · 4×", 4, 1), opt("bull", "Bullseye · 25×", 25, 0.8)],
  },
  targethit: {
    id: "targethit",
    name: "Target Hit",
    tagline: "Timed shot at a moving mark.",
    prompt: "Shot difficulty",
    accent: "red",
    options: [opt("easy", "Easy · 1.7×", 1.7, 1.1, 0.62), opt("hard", "Hard · 5×", 5, 0.95), opt("insane", "Insane · 18×", 18, 0.85)],
  },
  icebreak: {
    id: "icebreak",
    name: "Ice Break",
    tagline: "Crack the ice without falling through.",
    prompt: "How many strikes?",
    accent: "sky",
    options: [opt("1", "One strike · 1.6×", 1.6, 1.1, 0.65), opt("3", "Three strikes · 3.5×", 3.5, 1), opt("5", "Five strikes · 11×", 11, 0.88)],
  },
  range: {
    id: "range",
    name: "Range Bet",
    tagline: "Bet a band, not a number.",
    prompt: "Pick a range",
    accent: "teal",
    options: [opt("wide", "Wide band · 1.5×", 1.5, 1.15, 0.68), opt("narrow", "Narrow band · 4×", 4, 1), opt("pin", "Pinpoint · 20×", 20, 0.82)],
  },
  pyramid: {
    id: "pyramid",
    name: "Pyramid",
    tagline: "Each level doubles the danger.",
    prompt: "Climb to level",
    accent: "amber",
    options: [opt("2", "Level 2 · 2×", 2, 1.05), opt("4", "Level 4 · 6×", 6, 0.95), opt("6", "Level 6 · 24×", 24, 0.82)],
  },
  lightning: {
    id: "lightning",
    name: "Lightning Round",
    tagline: "Fast rounds, volatile payouts.",
    prompt: "Charge level",
    accent: "yellow",
    options: [opt("spark", "Spark · 2×", 2, 1.05), opt("bolt", "Bolt · 7×", 7, 0.95), opt("storm", "Storm · 30×", 30, 0.78)],
  },
  guess: {
    id: "guess",
    name: "Number Guess",
    tagline: "Call a number in the range.",
    prompt: "Guess range",
    accent: "indigo",
    options: [opt("half", "Half the board · 1.9×", 1.9, 1, 0.5), opt("quarter", "One quarter · 3.6×", 3.6, 1), opt("exact", "Exact number · 40×", 40, 0.72)],
  },
  blinddraw: {
    id: "blinddraw",
    name: "Blind Draw",
    tagline: "Draw sight unseen.",
    prompt: "Draw from",
    accent: "violet",
    options: [opt("top", "Top half · 1.9×", 1.9, 1, 0.5), opt("suit", "Called suit · 4×", 4, 0.98), opt("card", "Exact card · 45×", 45, 0.7)],
  },
  hiddenpath: {
    id: "hiddenpath",
    name: "Hidden Path",
    tagline: "Find the safe route through the grid.",
    prompt: "Path length",
    accent: "emerald",
    options: [opt("short", "Short · 1.7×", 1.7, 1.1, 0.62), opt("long", "Long · 5×", 5, 0.95), opt("full", "Full crossing · 16×", 16, 0.85)],
  },
  jackpothunt: {
    id: "jackpothunt",
    name: "Jackpot Hunt",
    tagline: "Open crates hunting the big one.",
    prompt: "Crate tier",
    accent: "yellow",
    options: [opt("bronze", "Bronze · 2×", 2, 1.05), opt("silver", "Silver · 6×", 6, 0.95), opt("gold", "Gold · 35×", 35, 0.75)],
  },
  chainreaction: {
    id: "chainreaction",
    name: "Chain Reaction",
    tagline: "One spark, a cascade of multipliers.",
    prompt: "Chain length",
    accent: "orange",
    options: [opt("2", "2 links · 1.8×", 1.8, 1.1, 0.6), opt("4", "4 links · 5×", 5, 0.95), opt("8", "8 links · 22×", 22, 0.8)],
  },
  countdown: {
    id: "countdown",
    name: "Countdown Gamble",
    tagline: "Hold your nerve to zero.",
    prompt: "Hold until",
    accent: "rose",
    options: [opt("5", "5s · 1.6×", 1.6, 1.1, 0.65), opt("3", "3s · 4×", 4, 1), opt("0", "Zero · 14×", 14, 0.86)],
  },
  timedsafe: {
    id: "timedsafe",
    name: "Timed Safe",
    tagline: "Crack the dial before lockout.",
    prompt: "Dial size",
    accent: "cyan",
    options: [opt("3", "3 digits · 2×", 2, 1.05), opt("4", "4 digits · 6×", 6, 0.95), opt("5", "5 digits · 26×", 26, 0.8)],
  },
  powerbar: {
    id: "powerbar",
    name: "Power Bar",
    tagline: "Stop the bar in the sweet spot.",
    prompt: "Target zone",
    accent: "lime",
    options: [opt("wide", "Wide zone · 1.6×", 1.6, 1.1, 0.65), opt("mid", "Mid zone · 3.5×", 3.5, 1), opt("sliver", "Sliver · 15×", 15, 0.85)],
  },
  cardstack: {
    id: "cardstack",
    name: "Card Stack",
    tagline: "Stack cards without toppling.",
    prompt: "Stack height",
    accent: "violet",
    options: [opt("3", "3 cards · 1.8×", 1.8, 1.1, 0.6), opt("6", "6 cards · 5×", 5, 0.95), opt("10", "10 cards · 21×", 21, 0.8)],
  },
  powergrid: {
    id: "powergrid",
    name: "Power Grid",
    tagline: "Route power without a blackout.",
    prompt: "Grid load",
    accent: "sky",
    options: [opt("low", "Low load · 1.7×", 1.7, 1.1, 0.62), opt("high", "High load · 4.5×", 4.5, 0.98), opt("max", "Max load · 17×", 17, 0.84)],
  },
  elimwheel: {
    id: "elimwheel",
    name: "Elimination Wheel",
    tagline: "Segments vanish every spin.",
    prompt: "Survive to round",
    accent: "fuchsia",
    options: [opt("2", "Round 2 · 1.9×", 1.9, 1.05), opt("4", "Round 4 · 6×", 6, 0.95), opt("6", "Round 6 · 23×", 23, 0.8)],
  },
  combobuilder: {
    id: "combobuilder",
    name: "Combo Builder",
    tagline: "Chain picks into one payout.",
    prompt: "Combo size",
    accent: "indigo",
    options: [opt("2", "2 picks · 2×", 2, 1.05), opt("3", "3 picks · 5.5×", 5.5, 0.96), opt("5", "5 picks · 28×", 28, 0.78)],
  },
  safesteps: {
    id: "safesteps",
    name: "Safe Steps",
    tagline: "Step across the collapsing bridge.",
    prompt: "Steps to take",
    accent: "emerald",
    options: [opt("3", "3 steps · 1.7×", 1.7, 1.1, 0.62), opt("6", "6 steps · 4.5×", 4.5, 0.98), opt("9", "9 steps · 19×", 19, 0.83)],
  },
  predchain: {
    id: "predchain",
    name: "Prediction Chain",
    tagline: "Call every link correctly.",
    prompt: "Chain depth",
    accent: "teal",
    options: [opt("2", "2 calls · 2×", 2, 1.05), opt("4", "4 calls · 7×", 7, 0.94), opt("6", "6 calls · 32×", 32, 0.76)],
  },
};

export const SOLO_GAME_IDS = Object.keys(GAME_SPECS);
