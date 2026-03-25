export function calculateWinChance(betAmount: number, poolTotal: number): number {
  if (poolTotal <= 0) return 0.01;
  // Base win rate ~38% with house edge scaling up as bet grows relative to pool
  const BASE_WIN_RATE = 0.38;
  const poolPressure = betAmount / (poolTotal * 0.002);
  const winChance = Math.max(0.01, BASE_WIN_RATE / (1 + poolPressure));
  return winChance;
}

export function shouldWin(betAmount: number, poolTotal: number): boolean {
  const chance = calculateWinChance(betAmount, poolTotal);
  return Math.random() < chance;
}

export const ROULETTE_NUMBERS: { number: number; color: "red" | "black" | "green" }[] = [
  { number: 0, color: "green" },
  { number: 1, color: "red" },
  { number: 2, color: "black" },
  { number: 3, color: "red" },
  { number: 4, color: "black" },
  { number: 5, color: "red" },
  { number: 6, color: "black" },
  { number: 7, color: "red" },
  { number: 8, color: "black" },
  { number: 9, color: "red" },
  { number: 10, color: "black" },
  { number: 11, color: "black" },
  { number: 12, color: "red" },
  { number: 13, color: "black" },
  { number: 14, color: "red" },
  { number: 15, color: "black" },
  { number: 16, color: "red" },
  { number: 17, color: "black" },
  { number: 18, color: "red" },
  { number: 19, color: "red" },
  { number: 20, color: "black" },
  { number: 21, color: "red" },
  { number: 22, color: "black" },
  { number: 23, color: "red" },
  { number: 24, color: "black" },
  { number: 25, color: "red" },
  { number: 26, color: "black" },
  { number: 27, color: "red" },
  { number: 28, color: "black" },
  { number: 29, color: "black" },
  { number: 30, color: "red" },
  { number: 31, color: "black" },
  { number: 32, color: "red" },
  { number: 33, color: "black" },
  { number: 34, color: "red" },
  { number: 35, color: "black" },
  { number: 36, color: "red" },
];

export const PLINKO_MULTIPLIERS = {
  low: [0.5, 1, 1.5, 2, 2.5, 2, 1.5, 1, 0.5],
  medium: [0.3, 0.5, 1, 2, 5, 2, 1, 0.5, 0.3],
  high: [0.1, 0.2, 0.5, 1, 10, 1, 0.5, 0.2, 0.1],
};

export function simulatePlinko(risk: "low" | "medium" | "high"): { path: string[]; slot: number } {
  const rows = 8;
  const path: string[] = [];
  let position = 0;

  for (let i = 0; i < rows; i++) {
    const goRight = Math.random() > 0.5;
    path.push(goRight ? "R" : "L");
    if (goRight) position++;
  }

  return { path, slot: position };
}
