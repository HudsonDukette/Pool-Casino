import { Router, type IRouter } from "express";
import { db, usersTable, poolTable, betsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { calculateWinChance } from "../lib/gambling";

const router: IRouter = Router();

// ─── Blackjack in-memory state ───────────────────────────────────────────────
interface BJState {
  betAmount: number;
  playerCards: number[];
  dealerCards: number[];
  poolId: number;
  poolAmount: number;
  currentBalance: number;
}
const bjGames = new Map<number, BJState>();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function cardValue(card: number): number {
  if (card >= 11) return 10; // J Q K
  return card;
}

function handTotal(cards: number[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const v = cardValue(c);
    if (v === 1) { aces++; total += 11; }
    else total += v;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function drawCard(): number {
  return Math.floor(Math.random() * 13) + 1; // 1(Ace)–13(King)
}

function cardLabel(card: number): string {
  if (card === 1) return "A";
  if (card === 11) return "J";
  if (card === 12) return "Q";
  if (card === 13) return "K";
  return String(card);
}

async function loadContext(userId: number) {
  const [[user], poolRows] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(poolTable).limit(1),
  ]);
  let pool = poolRows[0];
  if (!pool) [pool] = await db.insert(poolTable).values({}).returning();
  return { user: user!, pool };
}

function getBanError(user: { permanentlyBanned: boolean; bannedUntil: Date | null }): string | null {
  if (user.permanentlyBanned) return "Your account has been permanently banned from playing games.";
  if (user.bannedUntil && user.bannedUntil > new Date()) {
    const until = user.bannedUntil.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `You are banned from playing games until ${until}.`;
  }
  return null;
}

async function settleGame(
  userId: number,
  gameType: string,
  betAmount: number,
  multiplier: number,
  user: Awaited<ReturnType<typeof loadContext>>["user"],
  pool: Awaited<ReturnType<typeof loadContext>>["pool"],
) {
  const currentBalance = parseFloat(user.balance);
  const poolAmount = parseFloat(pool.totalAmount);
  const uncappedPayout = betAmount * multiplier;
  // Cap payout at pool balance — pool can never go negative
  const payout = uncappedPayout > betAmount ? Math.min(uncappedPayout, poolAmount) : uncappedPayout;
  const won = uncappedPayout > betAmount; // game-decided win (for stats/streaks)
  const breakEven = Math.abs(uncappedPayout - betAmount) < 0.001;
  const profit = payout - betAmount;

  const newBalance = currentBalance - betAmount + payout;
  const newPool = poolAmount + betAmount - payout;

  const newBiggestWin = won && payout > parseFloat(pool.biggestWin) ? payout : parseFloat(pool.biggestWin);
  const newBiggestBet = betAmount > parseFloat(pool.biggestBet) ? betAmount : parseFloat(pool.biggestBet);
  const newUserBiggestWin = won && payout > parseFloat(user.biggestWin) ? payout : parseFloat(user.biggestWin);
  const newUserBiggestBet = betAmount > parseFloat(user.biggestBet) ? betAmount : parseFloat(user.biggestBet);
  const gamesPlayed = parseInt(user.gamesPlayed) + 1;
  const totalWins = parseInt(user.totalWins) + (won ? 1 : 0);
  const totalLosses = parseInt(user.totalLosses) + (!won && !breakEven ? 1 : 0);
  const currentStreak = won ? parseInt(user.currentStreak) + 1 : 0;
  const winStreak = Math.max(parseInt(user.winStreak), currentStreak);
  const totalProfit = parseFloat(user.totalProfit) + profit;

  await Promise.all([
    db.update(usersTable).set({
      balance: newBalance.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      biggestWin: newUserBiggestWin.toFixed(2),
      biggestBet: newUserBiggestBet.toFixed(2),
      gamesPlayed: gamesPlayed.toString(),
      winStreak: winStreak.toString(),
      currentStreak: currentStreak.toString(),
      totalWins: totalWins.toString(),
      totalLosses: totalLosses.toString(),
      lastBetAt: new Date(),
    }).where(eq(usersTable.id, userId)),
    db.update(poolTable).set({
      totalAmount: Math.max(0, newPool).toFixed(2),
      biggestWin: newBiggestWin.toFixed(2),
      biggestBet: newBiggestBet.toFixed(2),
    }).where(eq(poolTable.id, pool.id)),
    db.insert(betsTable).values({
      userId,
      gameType,
      betAmount: betAmount.toFixed(2),
      result: won ? "win" : "loss",
      payout: payout.toFixed(2),
      multiplier: multiplier.toFixed(4),
    }),
  ]);

  return { won, breakEven, payout, multiplier, newBalance, profit };
}

function authCheck(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return null; }
  return userId as number;
}

function parseBet(req: any, res: any): number | null {
  const bet = parseFloat(req.body?.betAmount);
  if (isNaN(bet) || bet < 0.01) { res.status(400).json({ error: "Invalid bet amount (min $0.01)" }); return null; }
  return bet;
}

// ─── Ban enforcement middleware ───────────────────────────────────────────────
router.use("/games", async (req: any, res: any, next: any) => {
  if (req.method !== "POST") return next();
  const userId = req.session?.userId;
  if (!userId) return next();
  const [u] = await db.select({ bannedUntil: usersTable.bannedUntil, permanentlyBanned: usersTable.permanentlyBanned })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (u) {
    const err = getBanError(u);
    if (err) { res.status(403).json({ error: "banned", message: err }); return; }
  }
  next();
});

// ─── 1. Dice Roll ────────────────────────────────────────────────────────────
router.post("/games/dice", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const { betType, prediction } = req.body;
  if (!["exact", "high", "low"].includes(betType)) {
    res.status(400).json({ error: "betType must be 'exact', 'high', or 'low'" }); return;
  }
  if (betType === "exact" && (prediction < 1 || prediction > 6)) {
    res.status(400).json({ error: "prediction must be 1–6 for exact bets" }); return;
  }

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const winChance = calculateWinChance(betAmount, parseFloat(pool.totalAmount));
  const doWin = Math.random() < winChance;

  let rolled: number;
  if (betType === "exact") {
    if (doWin) {
      rolled = prediction;
    } else {
      const others = [1,2,3,4,5,6].filter(n => n !== prediction);
      rolled = others[Math.floor(Math.random() * others.length)];
    }
  } else {
    const highNums = [4,5,6], lowNums = [1,2,3];
    const target = betType === "high" ? highNums : lowNums;
    const opposite = betType === "high" ? lowNums : highNums;
    if (doWin) {
      rolled = target[Math.floor(Math.random() * target.length)];
    } else {
      rolled = opposite[Math.floor(Math.random() * opposite.length)];
    }
  }

  const won = betType === "exact"
    ? rolled === prediction
    : betType === "high" ? rolled >= 4 : rolled <= 3;

  const multiplier = won ? (betType === "exact" ? 5 : 1.9) : 0;
  const result = await settleGame(userId, "dice", betAmount, multiplier, user, pool);
  res.json({ ...result, rolled, betType, prediction });
});

// ─── 2. Coin Flip ────────────────────────────────────────────────────────────
router.post("/games/coinflip", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const { choice } = req.body;
  if (!["heads", "tails"].includes(choice)) {
    res.status(400).json({ error: "choice must be 'heads' or 'tails'" }); return;
  }

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const winChance = calculateWinChance(betAmount, parseFloat(pool.totalAmount));
  const doWin = Math.random() < winChance;
  const result_side = doWin ? choice : (choice === "heads" ? "tails" : "heads");
  const won = result_side === choice;
  const multiplier = won ? 1.95 : 0;
  const result = await settleGame(userId, "coinflip", betAmount, multiplier, user, pool);
  res.json({ ...result, choice, result: result_side });
});

// ─── 3. Crash ────────────────────────────────────────────────────────────────
router.post("/games/crash", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const cashOutAt = parseFloat(req.body?.cashOutAt);
  if (isNaN(cashOutAt) || cashOutAt < 1.1 || cashOutAt > 100) {
    res.status(400).json({ error: "cashOutAt must be between 1.1 and 100" }); return;
  }

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const winChance = calculateWinChance(betAmount, parseFloat(pool.totalAmount));
  const doWin = Math.random() < winChance;

  let crashAt: number;
  if (doWin) {
    // Crash happens AFTER cashOutAt — safe
    const extra = 0.5 + Math.random() * 3;
    crashAt = parseFloat((cashOutAt + extra).toFixed(2));
  } else {
    // Crash happens BEFORE cashOutAt
    const safeRange = cashOutAt - 1.0;
    crashAt = parseFloat((1.0 + Math.random() * safeRange * 0.95).toFixed(2));
  }

  const won = crashAt >= cashOutAt;
  const multiplier = won ? cashOutAt : 0;
  const result = await settleGame(userId, "crash", betAmount, multiplier, user, pool);
  res.json({ ...result, crashAt, cashOutAt });
});

// ─── 4. Slots ────────────────────────────────────────────────────────────────
const SLOT_SYMBOLS = ["cherry", "lemon", "orange", "bell", "diamond", "seven"] as const;
type SlotSymbol = typeof SLOT_SYMBOLS[number];

const SLOT_PAYOUTS: Record<SlotSymbol, number> = {
  seven: 20, diamond: 10, bell: 5, orange: 3, cherry: 2, lemon: 2,
};

function pickSlots(doWin: boolean): [SlotSymbol, SlotSymbol, SlotSymbol] {
  if (doWin) {
    // Pick a matching symbol (3-of-a-kind)
    const sym = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
    return [sym, sym, sym];
  }
  // Pick non-matching
  const pick = () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
  let reels: [SlotSymbol, SlotSymbol, SlotSymbol];
  do {
    reels = [pick(), pick(), pick()];
  } while (reels[0] === reels[1] && reels[1] === reels[2]);
  return reels;
}

router.post("/games/slots", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const winChance = calculateWinChance(betAmount, parseFloat(pool.totalAmount));
  const doWin = Math.random() < winChance;
  const reels = pickSlots(doWin);
  const allMatch = reels[0] === reels[1] && reels[1] === reels[2];
  const multiplier = allMatch ? SLOT_PAYOUTS[reels[0]] : 0;
  const result = await settleGame(userId, "slots", betAmount, multiplier, user, pool);
  res.json({ ...result, reels });
});

// ─── 5. Wheel Spin ────────────────────────────────────────────────────────────
const WHEEL_SEGMENTS = [
  { label: "0.2x", multiplier: 0.2, weight: 25 },
  { label: "0.5x", multiplier: 0.5, weight: 20 },
  { label: "1x",   multiplier: 1,   weight: 20 },
  { label: "1.5x", multiplier: 1.5, weight: 15 },
  { label: "2x",   multiplier: 2,   weight: 10 },
  { label: "3x",   multiplier: 3,   weight: 6  },
  { label: "5x",   multiplier: 5,   weight: 3  },
  { label: "10x",  multiplier: 10,  weight: 1  },
];
const WIN_SEGMENTS   = WHEEL_SEGMENTS.filter(s => s.multiplier > 1);
const LOSE_SEGMENTS  = WHEEL_SEGMENTS.filter(s => s.multiplier <= 1);

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) { r -= item.weight; if (r <= 0) return item; }
  return items[items.length - 1];
}

router.post("/games/wheel", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const winChance = calculateWinChance(betAmount, parseFloat(pool.totalAmount));
  const doWin = Math.random() < winChance;
  const segment = weightedPick(doWin ? WIN_SEGMENTS : LOSE_SEGMENTS);
  // Return the index in the full WHEEL_SEGMENTS array for frontend animation
  const segmentIndex = WHEEL_SEGMENTS.indexOf(segment);
  const result = await settleGame(userId, "wheel", betAmount, segment.multiplier, user, pool);
  res.json({ ...result, segment: segment.label, segmentIndex });
});

// ─── 6. Number Guess ────────────────────────────────────────────────────────
router.post("/games/guess", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const guessed = parseInt(req.body?.guess);
  if (isNaN(guessed) || guessed < 1 || guessed > 100) {
    res.status(400).json({ error: "Guess must be 1–100" }); return;
  }

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const winChance = calculateWinChance(betAmount, parseFloat(pool.totalAmount));
  const doWin = Math.random() < winChance;

  let actual: number;
  if (doWin) {
    // Pick close to guessed number
    const maxOff = Math.floor(Math.random() * 10) + 1;
    const offsets = [-maxOff, -5, -2, -1, 0, 1, 2, 5, maxOff].filter(o => {
      const n = guessed + o;
      return n >= 1 && n <= 100;
    });
    const dist = [0, 1, 2, 5, 10];
    const off = dist[Math.floor(Math.random() * dist.length)];
    const sign = Math.random() > 0.5 ? 1 : -1;
    actual = Math.max(1, Math.min(100, guessed + sign * off));
  } else {
    // Pick far from guessed
    let candidate: number;
    do { candidate = Math.floor(Math.random() * 100) + 1; }
    while (Math.abs(candidate - guessed) <= 20);
    actual = candidate;
  }

  const distance = Math.abs(actual - guessed);
  let multiplier = 0;
  if (distance === 0)        multiplier = 50;
  else if (distance <= 1)    multiplier = 10;
  else if (distance <= 5)    multiplier = 3;
  else if (distance <= 10)   multiplier = 2;
  else if (distance <= 20)   multiplier = 1.5;

  const result = await settleGame(userId, "guess", betAmount, multiplier, user, pool);
  res.json({ ...result, guessed, actual, distance });
});

// ─── 7. Mines — Stateful (start / reveal / cashout) ──────────────────────────
interface MinesGameState {
  betAmount: number;
  minesCount: number;
  minePositions: Set<number>;
  revealedSafe: number[];
  poolId: number;
  poolAmountAtStart: number; // pool after bet was added
}
const minesGames = new Map<number, MinesGameState>();

function minesMultiplier(minesCount: number, safeReveals: number): number {
  let m = 1;
  for (let i = 0; i < safeReveals; i++) {
    m *= ((25 - i) / (25 - minesCount - i)) * 0.97;
  }
  return parseFloat(m.toFixed(4));
}

// Start a new mines game — deducts bet immediately
router.post("/games/mines/start", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const minesCount = parseInt(req.body?.minesCount);
  if (isNaN(minesCount) || minesCount < 1 || minesCount > 24) {
    res.status(400).json({ error: "minesCount must be 1–24" }); return;
  }

  if (minesGames.has(userId)) {
    res.status(400).json({ error: "You already have an active mines game. Cash out or let it resolve first." }); return;
  }

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const currentBalance = parseFloat(user.balance);
  if (currentBalance < betAmount) { res.status(400).json({ error: "Insufficient balance" }); return; }

  // Place mines randomly across the 25-tile grid
  const allTiles = Array.from({ length: 25 }, (_, i) => i);
  const shuffled = [...allTiles].sort(() => Math.random() - 0.5);
  const minePositions = new Set(shuffled.slice(0, minesCount));

  const poolAmount = parseFloat(pool.totalAmount);
  const newBalance = currentBalance - betAmount;
  const newPool = poolAmount + betAmount;

  // Deduct bet immediately; pool receives it
  await Promise.all([
    db.update(usersTable).set({ balance: newBalance.toFixed(2) }).where(eq(usersTable.id, userId)),
    db.update(poolTable).set({ totalAmount: newPool.toFixed(2) }).where(eq(poolTable.id, pool.id)),
  ]);

  minesGames.set(userId, {
    betAmount,
    minesCount,
    minePositions,
    revealedSafe: [],
    poolId: pool.id,
    poolAmountAtStart: newPool,
  });

  res.json({ started: true, minesCount, totalTiles: 25, newBalance });
});

// Check current game state (used on page load to recover mid-game)
router.get("/games/mines/status", (req, res): void => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = minesGames.get(userId);
  if (!game) { res.json({ active: false }); return; }
  const multiplier = minesMultiplier(game.minesCount, game.revealedSafe.length);
  const potentialPayout = parseFloat((game.betAmount * multiplier).toFixed(2));
  res.json({
    active: true,
    betAmount: game.betAmount,
    minesCount: game.minesCount,
    revealedSafe: game.revealedSafe,
    currentMultiplier: multiplier,
    potentialPayout,
  });
});

// Abandon a stuck game — forfeits the bet (no refund, already deducted on start)
router.post("/games/mines/abandon", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = minesGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active mines game to abandon." }); return; }

  minesGames.delete(userId);

  // Record as a loss in stats
  const [[user], [pool]] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(poolTable).limit(1),
  ]);
  await Promise.all([
    db.update(usersTable).set({
      gamesPlayed: sql`(${usersTable.gamesPlayed}::integer + 1)::text`,
      totalLosses: sql`(${usersTable.totalLosses}::integer + 1)::text`,
      currentStreak: sql`'0'`,
      lastBetAt: new Date(),
    }).where(eq(usersTable.id, userId)),
    db.insert(betsTable).values({
      userId,
      gameType: "mines",
      betAmount: game.betAmount.toFixed(2),
      result: "loss",
      payout: "0.00",
      multiplier: "0.0000",
    }),
  ]);

  res.json({ abandoned: true, lostAmount: game.betAmount, minePositions: [...game.minePositions] });
});

// Reveal a tile
router.post("/games/mines/reveal", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const tileIndex = parseInt(req.body?.tileIndex);
  if (isNaN(tileIndex) || tileIndex < 0 || tileIndex > 24) {
    res.status(400).json({ error: "tileIndex must be 0–24" }); return;
  }

  const game = minesGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active mines game. Start a new game first." }); return; }
  if (game.revealedSafe.includes(tileIndex)) {
    res.status(400).json({ error: "Tile already revealed" }); return;
  }

  const hitMine = game.minePositions.has(tileIndex);

  if (hitMine) {
    minesGames.delete(userId);
    // Bet already in pool; no payout. Just record the bet.
    const [[user], [pool]] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
      db.select().from(poolTable).limit(1),
    ]);
    const newBiggestBet = game.betAmount > parseFloat(pool.biggestBet) ? game.betAmount : parseFloat(pool.biggestBet);
    await Promise.all([
      db.update(usersTable).set({
        gamesPlayed: (parseInt(user.gamesPlayed) + 1).toString(),
        totalLosses: (parseInt(user.totalLosses) + 1).toString(),
        currentStreak: "0",
        biggestBet: game.betAmount > parseFloat(user.biggestBet) ? game.betAmount.toFixed(2) : user.biggestBet,
        lastBetAt: new Date(),
      }).where(eq(usersTable.id, userId)),
      db.update(poolTable).set({ biggestBet: newBiggestBet.toFixed(2) }).where(eq(poolTable.id, pool.id)),
      db.insert(betsTable).values({
        userId,
        gameType: "mines",
        betAmount: game.betAmount.toFixed(2),
        result: "loss",
        payout: "0.00",
        multiplier: "0.0000",
      }),
    ]);
    res.json({
      hitMine: true,
      minePositions: [...game.minePositions],
      newBalance: parseFloat(user.balance),
    });
    return;
  }

  game.revealedSafe.push(tileIndex);
  const currentMultiplier = minesMultiplier(game.minesCount, game.revealedSafe.length);
  const [[user], [pool]] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(poolTable).limit(1),
  ]);
  const potentialPayout = Math.min(game.betAmount * currentMultiplier, parseFloat(pool.totalAmount));
  res.json({
    hitMine: false,
    tileIndex,
    revealedSafe: game.revealedSafe,
    currentMultiplier,
    potentialPayout,
    currentBalance: parseFloat(user.balance),
    safeLeft: 25 - game.minesCount - game.revealedSafe.length,
  });
});

// Cash out current winnings
router.post("/games/mines/cashout", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;

  const game = minesGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active mines game." }); return; }
  if (game.revealedSafe.length === 0) {
    res.status(400).json({ error: "Reveal at least one tile before cashing out." }); return;
  }

  minesGames.delete(userId);

  const [[user], [pool]] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(poolTable).limit(1),
  ]);
  const currentBalance = parseFloat(user.balance);
  const poolAmount = parseFloat(pool.totalAmount);
  const multiplier = minesMultiplier(game.minesCount, game.revealedSafe.length);
  const uncappedPayout = game.betAmount * multiplier;
  const payout = Math.min(uncappedPayout, poolAmount);
  const newBalance = currentBalance + payout;
  const newPool = Math.max(0, poolAmount - payout);
  const won = payout > game.betAmount;

  const newBiggestWin = won && payout > parseFloat(pool.biggestWin) ? payout : parseFloat(pool.biggestWin);
  const newBiggestBet = game.betAmount > parseFloat(pool.biggestBet) ? game.betAmount : parseFloat(pool.biggestBet);
  const gamesPlayed = parseInt(user.gamesPlayed) + 1;
  const totalWins = parseInt(user.totalWins) + (won ? 1 : 0);
  const totalLosses = parseInt(user.totalLosses) + (!won ? 1 : 0);
  const currentStreak = won ? parseInt(user.currentStreak) + 1 : 0;
  const winStreak = Math.max(parseInt(user.winStreak), currentStreak);
  const profit = payout - game.betAmount;
  const totalProfit = parseFloat(user.totalProfit) + profit;

  await Promise.all([
    db.update(usersTable).set({
      balance: newBalance.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      biggestWin: (won && payout > parseFloat(user.biggestWin) ? payout : parseFloat(user.biggestWin)).toFixed(2),
      biggestBet: (game.betAmount > parseFloat(user.biggestBet) ? game.betAmount : parseFloat(user.biggestBet)).toFixed(2),
      gamesPlayed: gamesPlayed.toString(),
      winStreak: winStreak.toString(),
      currentStreak: currentStreak.toString(),
      totalWins: totalWins.toString(),
      totalLosses: totalLosses.toString(),
      lastBetAt: new Date(),
    }).where(eq(usersTable.id, userId)),
    db.update(poolTable).set({
      totalAmount: newPool.toFixed(2),
      biggestWin: newBiggestWin.toFixed(2),
      biggestBet: newBiggestBet.toFixed(2),
    }).where(eq(poolTable.id, pool.id)),
    db.insert(betsTable).values({
      userId,
      gameType: "mines",
      betAmount: game.betAmount.toFixed(2),
      result: won ? "win" : "loss",
      payout: payout.toFixed(2),
      multiplier: multiplier.toFixed(4),
    }),
  ]);

  res.json({
    payout,
    multiplier,
    newBalance,
    minePositions: [...game.minePositions],
    revealedSafe: game.revealedSafe,
    won,
  });
});

// ─── 8. Blackjack — Deal ─────────────────────────────────────────────────────
router.post("/games/blackjack/deal", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  // Clear any previous game
  bjGames.delete(userId);

  const playerCards = [drawCard(), drawCard()];
  const dealerCards = [drawCard(), drawCard()];
  const playerTotal = handTotal(playerCards);
  const dealerTotal = handTotal(dealerCards);

  bjGames.set(userId, {
    betAmount,
    playerCards,
    dealerCards,
    poolId: pool.id,
    poolAmount: parseFloat(pool.totalAmount),
    currentBalance: parseFloat(user.balance),
  });

  // Auto-resolve blackjack
  const playerBJ = playerCards.length === 2 && playerTotal === 21;
  const dealerBJ = dealerCards.length === 2 && dealerTotal === 21;

  if (playerBJ || dealerBJ) {
    bjGames.delete(userId);
    let multiplier = 1; // push by default
    if (playerBJ && !dealerBJ) multiplier = 2.5;
    else if (dealerBJ && !playerBJ) multiplier = 0;
    const result = await settleGame(userId, "blackjack", betAmount, multiplier, user, pool);
    return res.json({
      ...result,
      playerCards: playerCards.map(cardLabel),
      dealerCards: dealerCards.map(cardLabel),
      playerTotal,
      dealerTotal,
      done: true,
      outcome: playerBJ && !dealerBJ ? "blackjack" : dealerBJ && !playerBJ ? "dealer_blackjack" : "push",
    }) as any;
  }

  res.json({
    playerCards: playerCards.map(cardLabel),
    dealerUpcard: cardLabel(dealerCards[0]),
    playerTotal,
    done: false,
  });
});

// ─── 8. Blackjack — Action ────────────────────────────────────────────────────
router.post("/games/blackjack/action", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const { action } = req.body;
  if (!["hit", "stand"].includes(action)) {
    res.status(400).json({ error: "action must be 'hit' or 'stand'" }); return;
  }

  const game = bjGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active Blackjack game. Deal first." }); return; }

  if (action === "hit") {
    game.playerCards.push(drawCard());
    const playerTotal = handTotal(game.playerCards);

    if (playerTotal > 21) {
      // Bust — player loses
      bjGames.delete(userId);
      const { user, pool } = await loadContext(userId);
      const result = await settleGame(userId, "blackjack", game.betAmount, 0, user!, pool);
      return res.json({
        ...result,
        playerCards: game.playerCards.map(cardLabel),
        dealerCards: [cardLabel(game.dealerCards[0]), "?"],
        playerTotal,
        dealerTotal: null,
        done: true,
        outcome: "bust",
      }) as any;
    }

    return res.json({
      playerCards: game.playerCards.map(cardLabel),
      playerTotal,
      done: false,
    }) as any;
  }

  // Stand — dealer plays
  const dealerCards = [...game.dealerCards];
  while (handTotal(dealerCards) < 17) dealerCards.push(drawCard());

  const playerTotal = handTotal(game.playerCards);
  const dealerTotal = handTotal(dealerCards);

  let outcome: string;
  let multiplier: number;
  if (dealerTotal > 21) { outcome = "dealer_bust"; multiplier = 2; }
  else if (playerTotal > dealerTotal) { outcome = "win"; multiplier = 2; }
  else if (playerTotal < dealerTotal) { outcome = "lose"; multiplier = 0; }
  else { outcome = "push"; multiplier = 1; }

  bjGames.delete(userId);
  const { user, pool } = await loadContext(userId);
  const result = await settleGame(userId, "blackjack", game.betAmount, multiplier, user!, pool);
  res.json({
    ...result,
    playerCards: game.playerCards.map(cardLabel),
    dealerCards: dealerCards.map(cardLabel),
    playerTotal,
    dealerTotal,
    done: true,
    outcome,
  });
});

// ─── Pyramid Climb (Session-Based) ───────────────────────────────────────────
const PYRAMID_PAYOUTS = [0, 1.9, 3.8, 7.5, 15, 30, 60, 120, 240, 480, 960];

interface PyramidGameState {
  betAmount: number;
  outcomes: boolean[];
  currentLevel: number;
  poolId: number;
}
const pyramidGames = new Map<number, PyramidGameState>();

router.post("/games/pyramid/start", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  if (pyramidGames.has(userId)) { res.status(400).json({ error: "You already have an active pyramid game. Cash out or finish first." }); return; }
  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (user.permanentlyBanned || (user.bannedUntil && user.bannedUntil > new Date())) { res.status(403).json({ error: "You are banned from playing games." }); return; }
  const currentBalance = parseFloat(user.balance);
  if (currentBalance < betAmount) { res.status(400).json({ error: "Insufficient balance" }); return; }
  const outcomes = Array.from({ length: 10 }, () => Math.random() >= 0.5);
  const newBalance = currentBalance - betAmount;
  const newPool = parseFloat(pool.totalAmount) + betAmount;
  await Promise.all([
    db.update(usersTable).set({ balance: newBalance.toFixed(2) }).where(eq(usersTable.id, userId)),
    db.update(poolTable).set({ totalAmount: newPool.toFixed(2) }).where(eq(poolTable.id, pool.id)),
  ]);
  pyramidGames.set(userId, { betAmount, outcomes, currentLevel: 0, poolId: pool.id });
  res.json({ started: true, newBalance, totalLevels: 10 });
});

router.get("/games/pyramid/status", (req, res): void => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = pyramidGames.get(userId);
  if (!game) { res.json({ active: false }); return; }
  const cashOutMultiplier = game.currentLevel > 0 ? PYRAMID_PAYOUTS[game.currentLevel] : 0;
  res.json({
    active: true,
    betAmount: game.betAmount,
    currentLevel: game.currentLevel,
    canCashOut: game.currentLevel > 0,
    cashOutMultiplier,
    potentialPayout: parseFloat((game.betAmount * cashOutMultiplier).toFixed(2)),
  });
});

router.post("/games/pyramid/advance", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = pyramidGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active pyramid game. Start a new game first." }); return; }
  if (game.currentLevel >= 10) { res.status(400).json({ error: "Already at maximum level." }); return; }
  const nextLevel = game.currentLevel + 1;
  const passed = game.outcomes[nextLevel - 1];
  game.currentLevel = nextLevel;

  if (!passed) {
    pyramidGames.delete(userId);
    const [[user], [pool]] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
      db.select().from(poolTable).limit(1),
    ]);
    await Promise.all([
      db.update(usersTable).set({
        gamesPlayed: (parseInt(user.gamesPlayed) + 1).toString(),
        totalLosses: (parseInt(user.totalLosses) + 1).toString(),
        currentStreak: "0",
        biggestBet: (game.betAmount > parseFloat(user.biggestBet) ? game.betAmount : parseFloat(user.biggestBet)).toFixed(2),
        lastBetAt: new Date(),
      }).where(eq(usersTable.id, userId)),
      db.insert(betsTable).values({ userId, gameType: "pyramid", betAmount: game.betAmount.toFixed(2), result: "loss", payout: "0.00", multiplier: "0.0000" }),
    ]);
    res.json({ passed: false, failedAtLevel: nextLevel, newBalance: parseFloat(user.balance) }); return;
  }

  if (nextLevel === 10) {
    pyramidGames.delete(userId);
    const [[user], [pool]] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
      db.select().from(poolTable).limit(1),
    ]);
    const multiplier = PYRAMID_PAYOUTS[10];
    const payout = Math.min(game.betAmount * multiplier, parseFloat(pool.totalAmount));
    const newBalance = parseFloat(user.balance) + payout;
    const newPool = Math.max(0, parseFloat(pool.totalAmount) - payout);
    const won = payout > game.betAmount;
    await Promise.all([
      db.update(usersTable).set({
        balance: newBalance.toFixed(2),
        gamesPlayed: (parseInt(user.gamesPlayed) + 1).toString(),
        totalWins: (parseInt(user.totalWins) + (won ? 1 : 0)).toString(),
        currentStreak: won ? (parseInt(user.currentStreak) + 1).toString() : "0",
        winStreak: Math.max(parseInt(user.winStreak), won ? parseInt(user.currentStreak) + 1 : 0).toString(),
        biggestWin: (won && payout > parseFloat(user.biggestWin) ? payout : parseFloat(user.biggestWin)).toFixed(2),
        biggestBet: (game.betAmount > parseFloat(user.biggestBet) ? game.betAmount : parseFloat(user.biggestBet)).toFixed(2),
        lastBetAt: new Date(),
      }).where(eq(usersTable.id, userId)),
      db.update(poolTable).set({ totalAmount: newPool.toFixed(2) }).where(eq(poolTable.id, pool.id)),
      db.insert(betsTable).values({ userId, gameType: "pyramid", betAmount: game.betAmount.toFixed(2), result: won ? "win" : "loss", payout: payout.toFixed(2), multiplier: multiplier.toFixed(4) }),
    ]);
    res.json({ passed: true, level: nextLevel, reachedTop: true, payout, newBalance, multiplier }); return;
  }

  const cashOutMultiplier = PYRAMID_PAYOUTS[nextLevel];
  res.json({ passed: true, level: nextLevel, reachedTop: false, cashOutMultiplier, potentialPayout: parseFloat((game.betAmount * cashOutMultiplier).toFixed(2)) });
});

router.post("/games/pyramid/cashout", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = pyramidGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active pyramid game." }); return; }
  if (game.currentLevel === 0) { res.status(400).json({ error: "Advance at least one level before cashing out." }); return; }
  pyramidGames.delete(userId);
  const [[user], [pool]] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(poolTable).limit(1),
  ]);
  const multiplier = PYRAMID_PAYOUTS[game.currentLevel];
  const payout = Math.min(game.betAmount * multiplier, parseFloat(pool.totalAmount));
  const newBalance = parseFloat(user.balance) + payout;
  const newPool = Math.max(0, parseFloat(pool.totalAmount) - payout);
  const won = payout > game.betAmount;
  const currentStreak = won ? parseInt(user.currentStreak) + 1 : 0;
  await Promise.all([
    db.update(usersTable).set({
      balance: newBalance.toFixed(2),
      gamesPlayed: (parseInt(user.gamesPlayed) + 1).toString(),
      totalWins: (parseInt(user.totalWins) + (won ? 1 : 0)).toString(),
      totalLosses: (parseInt(user.totalLosses) + (!won ? 1 : 0)).toString(),
      currentStreak: currentStreak.toString(),
      winStreak: Math.max(parseInt(user.winStreak), currentStreak).toString(),
      biggestWin: (won && payout > parseFloat(user.biggestWin) ? payout : parseFloat(user.biggestWin)).toFixed(2),
      biggestBet: (game.betAmount > parseFloat(user.biggestBet) ? game.betAmount : parseFloat(user.biggestBet)).toFixed(2),
      lastBetAt: new Date(),
    }).where(eq(usersTable.id, userId)),
    db.update(poolTable).set({ totalAmount: newPool.toFixed(2), biggestWin: (won && payout > parseFloat(pool.biggestWin) ? payout : parseFloat(pool.biggestWin)).toFixed(2) }).where(eq(poolTable.id, pool.id)),
    db.insert(betsTable).values({ userId, gameType: "pyramid", betAmount: game.betAmount.toFixed(2), result: won ? "win" : "loss", payout: payout.toFixed(2), multiplier: multiplier.toFixed(4) }),
  ]);
  res.json({ payout, multiplier, won, newBalance, level: game.currentLevel });
});

// ─── IceBreak (Session-Based, like Mines) ────────────────────────────────────
const ICE_TOTAL = 16;
const ICE_DANGER = 4;
const ICE_SAFE = ICE_TOTAL - ICE_DANGER;

function iceMultiplier(safeReveals: number): number {
  let m = 1;
  for (let i = 0; i < safeReveals; i++) {
    m *= ((ICE_TOTAL - i) / (ICE_SAFE - i)) * 0.97;
  }
  return parseFloat(m.toFixed(4));
}

interface IceGameState {
  betAmount: number;
  dangerPositions: Set<number>;
  revealedSafe: number[];
  poolId: number;
}
const iceGames = new Map<number, IceGameState>();

router.post("/games/icebreak/start", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  if (iceGames.has(userId)) { res.status(400).json({ error: "You already have an active ice break game." }); return; }
  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (user.permanentlyBanned || (user.bannedUntil && user.bannedUntil > new Date())) { res.status(403).json({ error: "You are banned from playing games." }); return; }
  const currentBalance = parseFloat(user.balance);
  if (currentBalance < betAmount) { res.status(400).json({ error: "Insufficient balance" }); return; }
  const shuffled = Array.from({ length: ICE_TOTAL }, (_, i) => i).sort(() => Math.random() - 0.5);
  const dangerPositions = new Set(shuffled.slice(0, ICE_DANGER));
  const newBalance = currentBalance - betAmount;
  const newPool = parseFloat(pool.totalAmount) + betAmount;
  await Promise.all([
    db.update(usersTable).set({ balance: newBalance.toFixed(2) }).where(eq(usersTable.id, userId)),
    db.update(poolTable).set({ totalAmount: newPool.toFixed(2) }).where(eq(poolTable.id, pool.id)),
  ]);
  iceGames.set(userId, { betAmount, dangerPositions, revealedSafe: [], poolId: pool.id });
  res.json({ started: true, totalTiles: ICE_TOTAL, dangerCount: ICE_DANGER, newBalance });
});

router.get("/games/icebreak/status", (req, res): void => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = iceGames.get(userId);
  if (!game) { res.json({ active: false }); return; }
  const multiplier = iceMultiplier(game.revealedSafe.length);
  res.json({ active: true, betAmount: game.betAmount, revealedSafe: game.revealedSafe, currentMultiplier: multiplier, potentialPayout: parseFloat((game.betAmount * multiplier).toFixed(2)) });
});

router.post("/games/icebreak/reveal", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const tileIndex = parseInt(req.body?.tileIndex);
  if (isNaN(tileIndex) || tileIndex < 0 || tileIndex >= ICE_TOTAL) { res.status(400).json({ error: `tileIndex must be 0–${ICE_TOTAL - 1}` }); return; }
  const game = iceGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active ice break game. Start a new game first." }); return; }
  if (game.revealedSafe.includes(tileIndex)) { res.status(400).json({ error: "Tile already revealed" }); return; }
  const hitDanger = game.dangerPositions.has(tileIndex);
  if (hitDanger) {
    iceGames.delete(userId);
    const [[user], [pool]] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
      db.select().from(poolTable).limit(1),
    ]);
    await Promise.all([
      db.update(usersTable).set({
        gamesPlayed: (parseInt(user.gamesPlayed) + 1).toString(),
        totalLosses: (parseInt(user.totalLosses) + 1).toString(),
        currentStreak: "0",
        biggestBet: (game.betAmount > parseFloat(user.biggestBet) ? game.betAmount : parseFloat(user.biggestBet)).toFixed(2),
        lastBetAt: new Date(),
      }).where(eq(usersTable.id, userId)),
      db.update(poolTable).set({ biggestBet: (game.betAmount > parseFloat(pool.biggestBet) ? game.betAmount : parseFloat(pool.biggestBet)).toFixed(2) }).where(eq(poolTable.id, pool.id)),
      db.insert(betsTable).values({ userId, gameType: "icebreak", betAmount: game.betAmount.toFixed(2), result: "loss", payout: "0.00", multiplier: "0.0000" }),
    ]);
    res.json({ hitDanger: true, dangerPositions: [...game.dangerPositions], newBalance: parseFloat(user.balance) }); return;
  }
  game.revealedSafe.push(tileIndex);
  const currentMultiplier = iceMultiplier(game.revealedSafe.length);
  const [pool] = await db.select().from(poolTable).limit(1);
  const potentialPayout = Math.min(game.betAmount * currentMultiplier, parseFloat(pool.totalAmount));
  res.json({ hitDanger: false, tileIndex, revealedSafe: game.revealedSafe, currentMultiplier, potentialPayout, safeLeft: ICE_SAFE - game.revealedSafe.length });
});

router.post("/games/icebreak/cashout", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = iceGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active ice break game." }); return; }
  if (game.revealedSafe.length === 0) { res.status(400).json({ error: "Reveal at least one safe tile before cashing out." }); return; }
  iceGames.delete(userId);
  const [[user], [pool]] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(poolTable).limit(1),
  ]);
  const multiplier = iceMultiplier(game.revealedSafe.length);
  const payout = Math.min(game.betAmount * multiplier, parseFloat(pool.totalAmount));
  const newBalance = parseFloat(user.balance) + payout;
  const newPool = Math.max(0, parseFloat(pool.totalAmount) - payout);
  const won = payout > game.betAmount;
  const currentStreak = won ? parseInt(user.currentStreak) + 1 : 0;
  await Promise.all([
    db.update(usersTable).set({
      balance: newBalance.toFixed(2),
      gamesPlayed: (parseInt(user.gamesPlayed) + 1).toString(),
      totalWins: (parseInt(user.totalWins) + (won ? 1 : 0)).toString(),
      totalLosses: (parseInt(user.totalLosses) + (!won ? 1 : 0)).toString(),
      currentStreak: currentStreak.toString(),
      winStreak: Math.max(parseInt(user.winStreak), currentStreak).toString(),
      biggestWin: (won && payout > parseFloat(user.biggestWin) ? payout : parseFloat(user.biggestWin)).toFixed(2),
      biggestBet: (game.betAmount > parseFloat(user.biggestBet) ? game.betAmount : parseFloat(user.biggestBet)).toFixed(2),
      lastBetAt: new Date(),
    }).where(eq(usersTable.id, userId)),
    db.update(poolTable).set({ totalAmount: newPool.toFixed(2), biggestWin: (won && payout > parseFloat(pool.biggestWin) ? payout : parseFloat(pool.biggestWin)).toFixed(2) }).where(eq(poolTable.id, pool.id)),
    db.insert(betsTable).values({ userId, gameType: "icebreak", betAmount: game.betAmount.toFixed(2), result: won ? "win" : "loss", payout: payout.toFixed(2), multiplier: multiplier.toFixed(4) }),
  ]);
  res.json({ payout, multiplier, won, newBalance, revealedCount: game.revealedSafe.length, dangerPositions: [...game.dangerPositions] });
});

router.post("/games/icebreak/abandon", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = iceGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active ice break game to abandon." }); return; }
  iceGames.delete(userId);
  const [[user]] = await Promise.all([db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1)]);
  await Promise.all([
    db.update(usersTable).set({ gamesPlayed: (parseInt(user.gamesPlayed) + 1).toString(), totalLosses: (parseInt(user.totalLosses) + 1).toString(), currentStreak: "0", lastBetAt: new Date() }).where(eq(usersTable.id, userId)),
    db.insert(betsTable).values({ userId, gameType: "icebreak", betAmount: game.betAmount.toFixed(2), result: "loss", payout: "0.00", multiplier: "0.0000" }),
  ]);
  res.json({ abandoned: true, lostAmount: game.betAmount, dangerPositions: [...game.dangerPositions] });
});

export default router;
