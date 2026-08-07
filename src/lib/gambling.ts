export const PLINKO_ROWS = 8;
export const PLINKO_ROW_HEIGHT = 44;
export const PLINKO_PEG_SPACING = 42;

export function calculateWinChance(betAmount: number, poolTotal: number): number {
  if (poolTotal <= 0) return 0.01;
  const scale = Math.min(poolTotal * 0.001, 5000);
  const pressure = betAmount / scale;
  return Math.max(0.01, 0.45 / (1 + pressure));
}

export function shouldWin(betAmount: number, poolTotal: number): boolean {
  return Math.random() < calculateWinChance(betAmount, poolTotal);
}

export const ROULETTE_NUMBERS: Array<{ number: number; color: "red" | "black" | "green" }> = [
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

export type PlinkoRisk = "low" | "medium" | "high";

export const PLINKO_MULTIPLIERS: Record<PlinkoRisk, number[]> = {
  low: [0.5, 1, 1.5, 2, 2.5, 2, 1.5, 1, 0.5],
  medium: [0.3, 0.5, 1, 2, 5, 2, 1, 0.5, 0.3],
  high: [0.1, 0.2, 0.5, 1, 10, 1, 0.5, 0.2, 0.1],
};

interface Vec2 {
  x: number;
  y: number;
}

const GRAVITY = 1400;
const DAMPING = 0.72;
const DT = 1 / 60;
const BALL_RADIUS = 6;
const PEG_RADIUS = 5;

function buildPegGrid(): Vec2[] {
  const pegs: Vec2[] = [];
  for (let row = 1; row <= PLINKO_ROWS; row++) {
    const count = row + 1;
    const startX = -((count - 1) * PLINKO_PEG_SPACING) / 2;
    for (let p = 0; p < count; p++) {
      pegs.push({ x: startX + p * PLINKO_PEG_SPACING, y: row * PLINKO_ROW_HEIGHT });
    }
  }
  return pegs;
}

const PEG_GRID = buildPegGrid();

function resolveCollision(bx: number, by: number, vx: number, vy: number, peg: Vec2): { vx: number; vy: number } | null {
  const dx = bx - peg.x;
  const dy = by - peg.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = BALL_RADIUS + PEG_RADIUS;
  if (dist >= minDist || dist < 0.001) return null;

  const nx = dx / dist;
  const ny = dy / dist;
  const dot = vx * nx + vy * ny;
  if (dot >= 0) return null;

  let rvx = (vx - 2 * dot * nx) * DAMPING;
  let rvy = (vy - 2 * dot * ny) * DAMPING;
  const kick = (Math.random() - 0.5) * 40;
  rvx += kick;

  return { vx: rvx, vy: rvy };
}

export function simulatePlinko(risk: PlinkoRisk, winChance: number): { path: Vec2[]; slot: number; multiplier: number } {
  const multipliers = PLINKO_MULTIPLIERS[risk];
  const doWin = Math.random() < winChance;

  const winSlots = multipliers.map((m, i) => ({ m, i })).filter(({ m }) => m > 1.0);
  const loseSlots = multipliers.map((m, i) => ({ m, i })).filter(({ m }) => m <= 1.0);
  const candidates = doWin && winSlots.length > 0 ? winSlots : loseSlots;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  if (!pick) return { path: [{ x: 0, y: 0 }], slot: 0, multiplier: 0 };
  const { m: multiplier, i: targetSlot } = pick;

  const targetX = (targetSlot - (PLINKO_ROWS / 2)) * PLINKO_PEG_SPACING;


  const MAX_TRIES = 4;
  let bestPath: Vec2[] = [];
  let bestSlot = targetSlot;
  let bestDist = Infinity;

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const vx0 = (targetX / (PLINKO_ROWS * PLINKO_ROW_HEIGHT)) * 160 + (Math.random() - 0.5) * 20;

    let bx = 0;
    let by = 0;
    let vx = vx0;
    let vy = 30;

    const raw: Vec2[] = [{ x: bx, y: by }];
    const BOARD_BOTTOM = PLINKO_ROWS * PLINKO_ROW_HEIGHT + PLINKO_ROW_HEIGHT;
    const MAX_STEPS = 800;

    for (let step = 0; step < MAX_STEPS; step++) {
      vy += GRAVITY * DT;
      bx += vx * DT;
      by += vy * DT;

      for (let pi = 0; pi < PEG_GRID.length; pi++) {
        const peg = PEG_GRID[pi];
        if (!peg || Math.abs(by - peg.y) > PLINKO_ROW_HEIGHT) continue;
        const result = resolveCollision(bx, by, vx, vy, peg);
        if (result) {
          vx = result.vx;
          vy = result.vy;
          break;
        }
      }


      if (step % 4 === 0) raw.push({ x: bx, y: by });

      if (by >= BOARD_BOTTOM) {
        raw.push({ x: bx, y: BOARD_BOTTOM });
        break;
      }
    }

    const rawSlot = Math.round(bx / PLINKO_PEG_SPACING + PLINKO_ROWS / 2);
    const landedSlot = Math.max(0, Math.min(PLINKO_ROWS, rawSlot));

    const dist = Math.abs(landedSlot - targetSlot);
    if (dist < bestDist) {
      bestDist = dist;
      bestPath = raw;
      bestSlot = landedSlot;
    }
    if (bestDist === 0) break;
  }

  const actualMultiplier = multipliers[bestSlot] ?? 0;
  return { path: bestPath, slot: bestSlot, multiplier: actualMultiplier };
}
