import { Router, type IRouter } from "express";
import { db, usersTable, poolTable, betsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { calculateWinChance } from "../lib/gambling";

const router: IRouter = Router();

// ── Shared helpers ──────────────────────────────────────────────────────────

function authCheck(req: any, res: any): number | null {
  const id = req.session?.userId;
  if (!id) { res.status(401).json({ error: "Not authenticated" }); return null; }
  return id;
}

function parseBet(req: any, res: any): number | null {
  const b = parseFloat(req.body?.betAmount);
  if (isNaN(b) || b < 0.01) { res.status(400).json({ error: "Minimum bet is $0.01" }); return null; }
  return b;
}

async function loadCtx(userId: number) {
  const [[user], poolRows] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(poolTable).limit(1),
  ]);
  let pool = poolRows[0];
  if (!pool) [pool] = await db.insert(poolTable).values({}).returning();
  return { user: user!, pool };
}

function checkBan(user: { permanentlyBanned: boolean; bannedUntil: Date | null }): string | null {
  if (user.permanentlyBanned) return "Your account has been permanently banned from playing games.";
  if (user.bannedUntil && user.bannedUntil > new Date()) {
    const until = user.bannedUntil.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `You are banned from playing until ${until}.`;
  }
  return null;
}

async function settle(
  userId: number,
  gameType: string,
  betAmount: number,
  multiplier: number,
  user: Awaited<ReturnType<typeof loadCtx>>["user"],
  pool: Awaited<ReturnType<typeof loadCtx>>["pool"],
) {
  const cur = parseFloat(user.balance);
  const poolAmt = parseFloat(pool.totalAmount);
  const uncapped = betAmount * multiplier;
  const payout = uncapped > betAmount ? Math.min(uncapped, poolAmt) : uncapped;
  const won = uncapped > betAmount;
  const breakEven = Math.abs(uncapped - betAmount) < 0.001;
  const profit = payout - betAmount;
  const newBalance = cur - betAmount + payout;
  const newPool = poolAmt + betAmount - payout;
  const gamesPlayed = parseInt(user.gamesPlayed) + 1;
  const totalWins = parseInt(user.totalWins) + (won ? 1 : 0);
  const totalLosses = parseInt(user.totalLosses) + (!won && !breakEven ? 1 : 0);
  const currentStreak = won ? parseInt(user.currentStreak) + 1 : 0;
  const winStreak = Math.max(parseInt(user.winStreak), currentStreak);
  const totalProfit = parseFloat(user.totalProfit) + profit;
  const newBiggestWin = won && payout > parseFloat(pool.biggestWin) ? payout : parseFloat(pool.biggestWin);
  const newBiggestBet = betAmount > parseFloat(pool.biggestBet) ? betAmount : parseFloat(pool.biggestBet);
  await Promise.all([
    db.update(usersTable).set({
      balance: newBalance.toFixed(2), totalProfit: totalProfit.toFixed(2),
      biggestWin: (won && payout > parseFloat(user.biggestWin) ? payout : parseFloat(user.biggestWin)).toFixed(2),
      biggestBet: (betAmount > parseFloat(user.biggestBet) ? betAmount : parseFloat(user.biggestBet)).toFixed(2),
      gamesPlayed: gamesPlayed.toString(), winStreak: winStreak.toString(),
      currentStreak: currentStreak.toString(), totalWins: totalWins.toString(),
      totalLosses: totalLosses.toString(), lastBetAt: new Date(),
    }).where(eq(usersTable.id, userId)),
    db.update(poolTable).set({
      totalAmount: Math.max(0, newPool).toFixed(2),
      biggestWin: newBiggestWin.toFixed(2), biggestBet: newBiggestBet.toFixed(2),
    }).where(eq(poolTable.id, pool.id)),
    db.insert(betsTable).values({
      userId, gameType, betAmount: betAmount.toFixed(2),
      result: won ? "win" : (breakEven ? "win" : "loss"),
      payout: payout.toFixed(2), multiplier: multiplier.toFixed(4),
    }),
  ]);
  return { won, breakEven, payout, multiplier, newBalance, profit };
}

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) { r -= item.weight; if (r <= 0) return item; }
  return items[items.length - 1];
}

// ── 1. High-Low Card ─────────────────────────────────────────────────────────
router.post("/games/highlow", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const guess = req.body?.guess; // "higher" | "lower"
  if (guess !== "higher" && guess !== "lower") {
    res.status(400).json({ error: "guess must be 'higher' or 'lower'" }); return;
  }
  const card1 = parseInt(req.body?.card1 ?? "0");
  if (!card1 || card1 < 1 || card1 > 13) {
    res.status(400).json({ error: "card1 must be 1–13" }); return;
  }

  const { user, pool } = await loadCtx(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const banErr = checkBan(user); if (banErr) { res.status(403).json({ error: banErr }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const card2 = Math.floor(Math.random() * 13) + 1;
  let won: boolean;
  let tie = false;
  if (card2 === card1) { tie = true; won = false; }
  else if (guess === "higher") won = card2 > card1;
  else won = card2 < card1;

  const multiplier = tie ? 1 : (won ? 1.85 : 0);
  const result = await settle(userId, "highlow", betAmount, multiplier, user, pool);
  const LABELS: Record<number, string> = { 1:"A",11:"J",12:"Q",13:"K" };
  const lbl = (c: number) => LABELS[c] ?? String(c);
  res.json({ ...result, card1: lbl(card1), card2: lbl(card2), card1Val: card1, card2Val: card2, tie, guess });
});

// Fetch a fresh card (no bet) — used to start the round on the frontend
router.get("/games/highlow/card", (req, res): void => {
  const card = Math.floor(Math.random() * 13) + 1;
  const LABELS: Record<number, string> = { 1:"A",11:"J",12:"Q",13:"K" };
  res.json({ card, label: LABELS[card] ?? String(card) });
});

// ── 2. Double Dice ────────────────────────────────────────────────────────────
const DICE_SUM_PAYOUTS: Record<number, number> = {
  2: 18, 12: 18,
  3: 10, 11: 10,
  4: 7,  10: 7,
  5: 5.5, 9: 5.5,
  6: 4.5, 8: 4.5,
  7: 4,
};

router.post("/games/doubledice", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const betType = req.body?.betType; // "even" | "odd" | number (exact sum)
  const exactSum = parseInt(req.body?.betType);

  const isEvenOdd = betType === "even" || betType === "odd";
  const isExact = !isNaN(exactSum) && exactSum >= 2 && exactSum <= 12;
  if (!isEvenOdd && !isExact) {
    res.status(400).json({ error: "betType must be 'even', 'odd', or a sum 2–12" }); return;
  }

  const { user, pool } = await loadCtx(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const banErr = checkBan(user); if (banErr) { res.status(403).json({ error: banErr }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const sum = die1 + die2;

  let multiplier = 0;
  if (isEvenOdd) {
    const isEven = sum % 2 === 0;
    if ((betType === "even" && isEven) || (betType === "odd" && !isEven)) multiplier = 1.9;
  } else {
    if (sum === exactSum) multiplier = DICE_SUM_PAYOUTS[exactSum] ?? 4;
  }

  const result = await settle(userId, "doubledice", betAmount, multiplier, user, pool);
  res.json({ ...result, die1, die2, sum, betType });
});

// ── 3. Risk Ladder ────────────────────────────────────────────────────────────
interface LadderState {
  betAmount: number;
  currentRung: number;
  poolId: number;
}

const LADDER_MULTS  = [1, 1.4, 2.0, 2.8, 4.0, 5.5, 7.5, 10, 14, 20, 30];
const LADDER_FAIL   = [0, 0.10, 0.13, 0.16, 0.20, 0.25, 0.30, 0.36, 0.42, 0.49, 0.55];
const ladderGames   = new Map<number, LadderState>();

router.post("/games/ladder/start", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  if (ladderGames.has(userId)) {
    res.status(400).json({ error: "You already have an active ladder game. Cash out first." }); return;
  }
  const { user, pool } = await loadCtx(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const banErr = checkBan(user); if (banErr) { res.status(403).json({ error: banErr }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  await Promise.all([
    db.update(usersTable).set({ balance: (parseFloat(user.balance) - betAmount).toFixed(2) }).where(eq(usersTable.id, userId)),
    db.update(poolTable).set({ totalAmount: (parseFloat(pool.totalAmount) + betAmount).toFixed(2) }).where(eq(poolTable.id, pool.id)),
  ]);

  ladderGames.set(userId, { betAmount, currentRung: 0, poolId: pool.id });
  res.json({ started: true, currentRung: 0, multiplier: LADDER_MULTS[0], newBalance: parseFloat(user.balance) - betAmount });
});

router.get("/games/ladder/status", (req, res): void => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = ladderGames.get(userId);
  if (!game) { res.json({ active: false }); return; }
  res.json({ active: true, currentRung: game.currentRung, multiplier: LADDER_MULTS[game.currentRung], betAmount: game.betAmount, maxRung: 10 });
});

router.post("/games/ladder/step", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = ladderGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active ladder game." }); return; }
  if (game.currentRung >= 10) { res.status(400).json({ error: "Already at the top! Cash out." }); return; }

  const nextRung = game.currentRung + 1;
  const failChance = LADDER_FAIL[nextRung];
  const failed = Math.random() < failChance;

  if (failed) {
    ladderGames.delete(userId);
    const { user, pool } = await loadCtx(userId);
    const gamesPlayed = parseInt(user.gamesPlayed) + 1;
    await Promise.all([
      db.update(usersTable).set({ gamesPlayed: gamesPlayed.toString(), totalLosses: (parseInt(user.totalLosses) + 1).toString(), currentStreak: "0", lastBetAt: new Date() }).where(eq(usersTable.id, userId)),
      db.insert(betsTable).values({ userId, gameType: "ladder", betAmount: game.betAmount.toFixed(2), result: "loss", payout: "0.00", multiplier: "0.0000" }),
    ]);
    res.json({ failed: true, failedAtRung: nextRung, multiplier: 0, newBalance: parseFloat(user.balance) });
  } else {
    game.currentRung = nextRung;
    res.json({ failed: false, currentRung: nextRung, multiplier: LADDER_MULTS[nextRung], atTop: nextRung === 10 });
  }
});

router.post("/games/ladder/abandon", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = ladderGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active ladder game." }); return; }
  ladderGames.delete(userId);
  const { user } = await loadCtx(userId);
  await Promise.all([
    db.update(usersTable).set({ gamesPlayed: (parseInt(user.gamesPlayed) + 1).toString(), totalLosses: (parseInt(user.totalLosses) + 1).toString(), currentStreak: "0", lastBetAt: new Date() }).where(eq(usersTable.id, userId)),
    db.insert(betsTable).values({ userId, gameType: "ladder", betAmount: game.betAmount.toFixed(2), result: "loss", payout: "0.00", multiplier: "0.0000" }),
  ]);
  res.json({ abandoned: true, lostAmount: game.betAmount });
});

router.post("/games/ladder/cashout", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = ladderGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active ladder game." }); return; }
  if (game.currentRung === 0) { res.status(400).json({ error: "Advance at least one rung before cashing out." }); return; }
  ladderGames.delete(userId);

  const { user, pool } = await loadCtx(userId);
  const multiplier = LADDER_MULTS[game.currentRung];
  const poolAmt = parseFloat(pool.totalAmount);
  const payout = Math.min(game.betAmount * multiplier, poolAmt);
  const won = payout > game.betAmount;
  const newBalance = parseFloat(user.balance) + payout;
  const newPool = Math.max(0, poolAmt - payout);

  await Promise.all([
    db.update(usersTable).set({
      balance: newBalance.toFixed(2),
      gamesPlayed: (parseInt(user.gamesPlayed) + 1).toString(),
      totalWins: (parseInt(user.totalWins) + (won ? 1 : 0)).toString(),
      currentStreak: won ? (parseInt(user.currentStreak) + 1).toString() : "0",
      winStreak: Math.max(parseInt(user.winStreak), won ? parseInt(user.currentStreak) + 1 : 0).toString(),
      lastBetAt: new Date(),
    }).where(eq(usersTable.id, userId)),
    db.update(poolTable).set({ totalAmount: newPool.toFixed(2) }).where(eq(poolTable.id, pool.id)),
    db.insert(betsTable).values({ userId, gameType: "ladder", betAmount: game.betAmount.toFixed(2), result: won ? "win" : "loss", payout: payout.toFixed(2), multiplier: multiplier.toFixed(4) }),
  ]);
  res.json({ won, payout, multiplier, newBalance, rung: game.currentRung });
});

// ── 4. War ────────────────────────────────────────────────────────────────────
router.post("/games/war", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const { user, pool } = await loadCtx(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const banErr = checkBan(user); if (banErr) { res.status(403).json({ error: banErr }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const playerCard = Math.floor(Math.random() * 13) + 1;
  const dealerCard = Math.floor(Math.random() * 13) + 1;
  const LABELS: Record<number, string> = { 1:"A",11:"J",12:"Q",13:"K" };
  const lbl = (c: number) => LABELS[c] ?? String(c);

  let multiplier: number;
  let outcome: "win" | "loss" | "tie";
  if (playerCard > dealerCard) { multiplier = 2; outcome = "win"; }
  else if (playerCard < dealerCard) { multiplier = 0; outcome = "loss"; }
  else { multiplier = 1; outcome = "tie"; }

  const result = await settle(userId, "war", betAmount, multiplier, user, pool);
  res.json({ ...result, playerCard: lbl(playerCard), dealerCard: lbl(dealerCard), playerVal: playerCard, dealerVal: dealerCard, outcome });
});

// ── 5. Target Multiplier ─────────────────────────────────────────────────────
const VALID_TARGETS = [1.5, 2, 3, 5, 10, 25, 50];

router.post("/games/target", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const target = parseFloat(req.body?.target);
  if (!VALID_TARGETS.includes(target)) {
    res.status(400).json({ error: `target must be one of: ${VALID_TARGETS.join(", ")}` }); return;
  }

  const { user, pool } = await loadCtx(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const banErr = checkBan(user); if (banErr) { res.status(403).json({ error: banErr }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const winProb = (1 / target) * 0.96;
  const won = Math.random() < winProb;
  const multiplier = won ? target : 0;
  const result = await settle(userId, "target", betAmount, multiplier, user, pool);
  res.json({ ...result, target, winProb: parseFloat((winProb * 100).toFixed(1)) });
});

// ── 6. Ice Break ──────────────────────────────────────────────────────────────
// 4x4 grid (16 tiles), 4 danger tiles. Player picks how many tiles to flip.
// Win if none of the picked tiles are danger tiles.
const ICE_TOTAL = 16, ICE_DANGER = 4, ICE_SAFE = 12;

function iceBreakPayout(picks: number): number {
  // P(all safe) = C(ICE_SAFE, picks) / C(ICE_TOTAL, picks)
  // We scale payout so expected value ≈ 0.95 * bet
  const prob = safeCombProbability(ICE_TOTAL, ICE_DANGER, picks);
  if (prob <= 0) return 0;
  return parseFloat(((0.95 / prob)).toFixed(4));
}

function safeCombProbability(total: number, danger: number, picks: number): number {
  const safe = total - danger;
  if (picks > safe) return 0;
  // P = C(safe, picks) / C(total, picks)
  let p = 1;
  for (let i = 0; i < picks; i++) {
    p *= (safe - i) / (total - i);
  }
  return p;
}

router.post("/games/icebreak", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const picks = parseInt(req.body?.picks);
  if (isNaN(picks) || picks < 1 || picks > ICE_SAFE) {
    res.status(400).json({ error: `picks must be 1–${ICE_SAFE}` }); return;
  }

  const { user, pool } = await loadCtx(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const banErr = checkBan(user); if (banErr) { res.status(403).json({ error: banErr }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  // Place 4 danger tiles randomly
  const allTiles = Array.from({ length: ICE_TOTAL }, (_, i) => i);
  const shuffled = [...allTiles].sort(() => Math.random() - 0.5);
  const dangerSet = new Set(shuffled.slice(0, ICE_DANGER));

  // Pick `picks` tiles
  const picked = shuffled.slice(ICE_DANGER, ICE_DANGER + picks); // unbiased random picks from remaining
  // Re-pick randomly (the above gives safe tiles — reshuffle for honest picks)
  const honestPicks = [...allTiles].sort(() => Math.random() - 0.5).slice(0, picks);
  const hitDanger = honestPicks.some(t => dangerSet.has(t));

  const payout = iceBreakPayout(picks);
  const multiplier = hitDanger ? 0 : payout;
  const result = await settle(userId, "icebreak", betAmount, multiplier, user, pool);
  res.json({ ...result, picks, dangerTiles: [...dangerSet], pickedTiles: honestPicks, hitDanger, payout });
});

// ── 7. Advanced Wheel ─────────────────────────────────────────────────────────
const ADV_WHEEL_SEGMENTS = [
  { label: "0x",   multiplier: 0,   weight: 25 },
  { label: "0.3x", multiplier: 0.3, weight: 15 },
  { label: "1.5x", multiplier: 1.5, weight: 20 },
  { label: "2x",   multiplier: 2,   weight: 15 },
  { label: "3x",   multiplier: 3,   weight: 10 },
  { label: "5x",   multiplier: 5,   weight: 8  },
  { label: "10x",  multiplier: 10,  weight: 4  },
  { label: "25x",  multiplier: 25,  weight: 2  },
  { label: "50x",  multiplier: 50,  weight: 1  },
];
const ADV_WIN_SEGS  = ADV_WHEEL_SEGMENTS.filter(s => s.multiplier > 1);
const ADV_LOSE_SEGS = ADV_WHEEL_SEGMENTS.filter(s => s.multiplier <= 1);

router.post("/games/advwheel", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const { user, pool } = await loadCtx(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const banErr = checkBan(user); if (banErr) { res.status(403).json({ error: banErr }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const winChance = calculateWinChance(betAmount, parseFloat(pool.totalAmount));
  const doWin = Math.random() < winChance;
  const segment = weightedPick(doWin ? ADV_WIN_SEGS : ADV_LOSE_SEGS);
  const segmentIndex = ADV_WHEEL_SEGMENTS.indexOf(segment);
  const result = await settle(userId, "advwheel", betAmount, segment.multiplier, user, pool);
  res.json({ ...result, segment: segment.label, segmentIndex, segments: ADV_WHEEL_SEGMENTS.map(s => ({ label: s.label, multiplier: s.multiplier })) });
});

// ── 8. Number Range Bet ───────────────────────────────────────────────────────
type RangeType = "narrow" | "medium" | "wide";
const RANGE_CONFIG: Record<RangeType, { min: number; max: number; payout: number; label: string }> = {
  narrow: { min: 1,  max: 20,  payout: 4.75, label: "Narrow (1–20)" },
  medium: { min: 1,  max: 50,  payout: 1.90, label: "Medium (1–50)" },
  wide:   { min: 51, max: 100, payout: 1.90, label: "Upper Half (51–100)" },
};

router.post("/games/range", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const range = req.body?.range as RangeType;
  if (!RANGE_CONFIG[range]) {
    res.status(400).json({ error: "range must be 'narrow', 'medium', or 'wide'" }); return;
  }

  const { user, pool } = await loadCtx(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const banErr = checkBan(user); if (banErr) { res.status(403).json({ error: banErr }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const number = Math.floor(Math.random() * 100) + 1;
  const cfg = RANGE_CONFIG[range];
  const inRange = number >= cfg.min && number <= cfg.max;
  const multiplier = inRange ? cfg.payout : 0;
  const result = await settle(userId, "range", betAmount, multiplier, user, pool);
  res.json({ ...result, number, range, inRange, rangeLabel: cfg.label, min: cfg.min, max: cfg.max });
});

// ── 9. Pyramid Pick ───────────────────────────────────────────────────────────
// Player picks depth (1–5). Each level 50% fail. Higher depth = bigger payout but harder.
const PYRAMID_PAYOUTS = [0, 1.9, 3.5, 6.5, 12, 23];

router.post("/games/pyramid", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const depth = parseInt(req.body?.depth);
  if (isNaN(depth) || depth < 1 || depth > 5) {
    res.status(400).json({ error: "depth must be 1–5" }); return;
  }

  const { user, pool } = await loadCtx(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const banErr = checkBan(user); if (banErr) { res.status(403).json({ error: banErr }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  // Simulate each level (50% each)
  const levelResults: boolean[] = [];
  let failedAt: number | null = null;
  for (let lvl = 1; lvl <= depth; lvl++) {
    const passed = Math.random() >= 0.5;
    levelResults.push(passed);
    if (!passed) { failedAt = lvl; break; }
  }

  const won = failedAt === null;
  const multiplier = won ? PYRAMID_PAYOUTS[depth] : 0;
  const result = await settle(userId, "pyramid", betAmount, multiplier, user, pool);
  res.json({ ...result, depth, levelResults, failedAt, payout: PYRAMID_PAYOUTS[depth] });
});

// ── 10. Lightning Round ───────────────────────────────────────────────────────
// N rapid flip rounds (each 50% at 1.9x). Total bet = betAmount * rounds.
// Returns sequence for animated display.
const VALID_ROUNDS = [3, 5, 10];

router.post("/games/lightning", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betPerRound = parseBet(req, res); if (!betPerRound) return;
  const rounds = parseInt(req.body?.rounds);
  if (!VALID_ROUNDS.includes(rounds)) {
    res.status(400).json({ error: "rounds must be 3, 5, or 10" }); return;
  }

  const { user, pool } = await loadCtx(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const banErr = checkBan(user); if (banErr) { res.status(403).json({ error: banErr }); return; }
  const totalBet = betPerRound * rounds;
  if (parseFloat(user.balance) < totalBet) { res.status(400).json({ error: "Insufficient balance for all rounds" }); return; }

  const sequence: Array<{ won: boolean; payout: number }> = [];
  let totalPayout = 0;

  for (let i = 0; i < rounds; i++) {
    const roundWon = Math.random() < 0.5;
    const roundPayout = roundWon ? betPerRound * 1.9 : 0;
    sequence.push({ won: roundWon, payout: parseFloat(roundPayout.toFixed(2)) });
    totalPayout += roundPayout;
  }

  // Settle as single bet with effective multiplier
  const effectiveMult = totalPayout / totalBet;
  const result = await settle(userId, "lightning", totalBet, effectiveMult, user, pool);
  const winsCount = sequence.filter(s => s.won).length;
  res.json({ ...result, sequence, rounds, betPerRound, totalBet, winsCount });
});

export default router;
