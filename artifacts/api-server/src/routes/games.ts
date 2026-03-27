import { Router, type IRouter } from "express";
import { db, usersTable, poolTable, betsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PlayRouletteBody, PlayRouletteResponse, PlayPlinkoBody, PlayPlinkoResponse } from "@workspace/api-zod";
import {
  calculateWinChance,
  ROULETTE_NUMBERS,
  simulatePlinko,
} from "../lib/gambling";

const router: IRouter = Router();

const MIN_BET = 0.01;
const BET_COOLDOWN_MS = 1000;

function getBanError(user: { permanentlyBanned: boolean; bannedUntil: Date | null }): string | null {
  if (user.permanentlyBanned) return "Your account has been permanently banned from playing games.";
  if (user.bannedUntil && user.bannedUntil > new Date()) {
    const until = user.bannedUntil.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `You are banned from playing games until ${until}.`;
  }
  return null;
}

async function getOrCreatePool() {
  let [pool] = await db.select().from(poolTable).limit(1);
  if (!pool) {
    [pool] = await db.insert(poolTable).values({}).returning();
  }
  return pool;
}

router.post("/games/roulette", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = PlayRouletteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { betAmount, color } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const banErr = getBanError(user);
  if (banErr) { res.status(403).json({ error: "banned", message: banErr }); return; }

  if (user.lastBetAt) {
    const msSinceLastBet = Date.now() - user.lastBetAt.getTime();
    if (msSinceLastBet < BET_COOLDOWN_MS) {
      res.status(400).json({ error: `Please wait ${Math.ceil((BET_COOLDOWN_MS - msSinceLastBet) / 1000)} second(s) between bets` });
      return;
    }
  }

  const pool = await getOrCreatePool();
  const poolAmount = parseFloat(pool.totalAmount);
  const currentBalance = parseFloat(user.balance);

  // Green is a fixed rare bet: ~2.5% win chance regardless of pool, 50x payout
  const isGreen = color === "green";
  const winChance = isGreen
    ? Math.min(calculateWinChance(betAmount, poolAmount), 0.025)
    : calculateWinChance(betAmount, poolAmount);

  // Determine win/loss by probability FIRST, then pick a consistent wheel result
  const won = Math.random() < winChance;

  let spinResult: typeof ROULETTE_NUMBERS[0];
  if (won) {
    // Pick a number matching the chosen color
    const matchingNumbers = ROULETTE_NUMBERS.filter((n) => n.color === color);
    spinResult = matchingNumbers[Math.floor(Math.random() * matchingNumbers.length)];
  } else {
    // Pick a number NOT matching the chosen color
    const nonMatchingNumbers = ROULETTE_NUMBERS.filter((n) => n.color !== color);
    spinResult = nonMatchingNumbers[Math.floor(Math.random() * nonMatchingNumbers.length)];
  }

  const resultColor = spinResult.color;
  const payoutMultiplier = isGreen ? 50 : 2;
  const uncappedPayout = won ? betAmount * payoutMultiplier : 0;
  // Cap payout at current pool balance — pool can never go negative
  const payout = uncappedPayout > betAmount ? Math.min(uncappedPayout, poolAmount) : uncappedPayout;

  const newBalance = currentBalance - betAmount + payout;
  const profit = payout - betAmount;
  const newPoolAmount = poolAmount + betAmount - payout;

  const newBiggestWin = won && payout > parseFloat(pool.biggestWin) ? payout : parseFloat(pool.biggestWin);
  const newBiggestBet = betAmount > parseFloat(pool.biggestBet) ? betAmount : parseFloat(pool.biggestBet);

  const newUserBiggestWin =
    won && payout > parseFloat(user.biggestWin) ? payout : parseFloat(user.biggestWin);
  const newUserBiggestBet =
    betAmount > parseFloat(user.biggestBet) ? betAmount : parseFloat(user.biggestBet);
  const newGamesPlayed = parseInt(user.gamesPlayed) + 1;
  const newTotalWins = won ? parseInt(user.totalWins) + 1 : parseInt(user.totalWins);
  const newTotalLosses = !won ? parseInt(user.totalLosses) + 1 : parseInt(user.totalLosses);
  const newCurrentStreak = won ? parseInt(user.currentStreak) + 1 : 0;
  const newWinStreak = Math.max(parseInt(user.winStreak), newCurrentStreak);
  const newTotalProfit = parseFloat(user.totalProfit) + profit;

  await Promise.all([
    db.update(usersTable).set({
      balance: newBalance.toFixed(2),
      totalProfit: newTotalProfit.toFixed(2),
      biggestWin: newUserBiggestWin.toFixed(2),
      biggestBet: newUserBiggestBet.toFixed(2),
      gamesPlayed: newGamesPlayed.toString(),
      winStreak: newWinStreak.toString(),
      currentStreak: newCurrentStreak.toString(),
      totalWins: newTotalWins.toString(),
      totalLosses: newTotalLosses.toString(),
      lastBetAt: new Date(),
    }).where(eq(usersTable.id, userId)),
    db.update(poolTable).set({
      totalAmount: Math.max(0, newPoolAmount).toFixed(2),
      biggestWin: newBiggestWin.toFixed(2),
      biggestBet: newBiggestBet.toFixed(2),
    }).where(eq(poolTable.id, pool.id)),
    db.insert(betsTable).values({
      userId,
      gameType: "roulette",
      betAmount: betAmount.toFixed(2),
      result: won ? "win" : "loss",
      payout: payout.toFixed(2),
      multiplier: won ? payoutMultiplier.toFixed(4) : "0.0000",
    }),
  ]);

  res.json(
    PlayRouletteResponse.parse({
      won,
      resultColor,
      resultNumber: spinResult.number,
      betAmount,
      payout,
      newBalance,
      winChance,
    }),
  );
});

router.post("/games/plinko", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = PlayPlinkoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { betAmount, risk } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const banErr2 = getBanError(user);
  if (banErr2) { res.status(403).json({ error: "banned", message: banErr2 }); return; }

  const pool = await getOrCreatePool();
  const poolAmount = parseFloat(pool.totalAmount);
  const currentBalance = parseFloat(user.balance);

  const winChance = calculateWinChance(betAmount, poolAmount);
  const { path, slot, multiplier } = simulatePlinko(risk, winChance);

  const uncappedPayout = betAmount * multiplier;
  // Cap payout at pool balance — pool can never go negative
  const payout = uncappedPayout > betAmount ? Math.min(uncappedPayout, poolAmount) : uncappedPayout;
  const won = uncappedPayout > betAmount;     // game-decided win (for stats)
  const breakEven = Math.abs(uncappedPayout - betAmount) < 0.001;
  const profit = payout - betAmount;
  const newBalance = currentBalance - betAmount + payout;
  const newPoolAmount = poolAmount + betAmount - payout;

  const newBiggestWin = won && payout > parseFloat(pool.biggestWin) ? payout : parseFloat(pool.biggestWin);
  const newBiggestBet = betAmount > parseFloat(pool.biggestBet) ? betAmount : parseFloat(pool.biggestBet);

  const newUserBiggestWin =
    won && payout > parseFloat(user.biggestWin) ? payout : parseFloat(user.biggestWin);
  const newUserBiggestBet =
    betAmount > parseFloat(user.biggestBet) ? betAmount : parseFloat(user.biggestBet);
  const newGamesPlayed = parseInt(user.gamesPlayed) + 1;
  const newTotalWins = won ? parseInt(user.totalWins) + 1 : parseInt(user.totalWins);
  const newTotalLosses = !won ? parseInt(user.totalLosses) + 1 : parseInt(user.totalLosses);
  const newCurrentStreak = won ? parseInt(user.currentStreak) + 1 : 0;
  const newWinStreak = Math.max(parseInt(user.winStreak), newCurrentStreak);
  const newTotalProfit = parseFloat(user.totalProfit) + profit;

  await Promise.all([
    db.update(usersTable).set({
      balance: newBalance.toFixed(2),
      totalProfit: newTotalProfit.toFixed(2),
      biggestWin: newUserBiggestWin.toFixed(2),
      biggestBet: newUserBiggestBet.toFixed(2),
      gamesPlayed: newGamesPlayed.toString(),
      winStreak: newWinStreak.toString(),
      currentStreak: newCurrentStreak.toString(),
      totalWins: newTotalWins.toString(),
      totalLosses: newTotalLosses.toString(),
      lastBetAt: new Date(),
    }).where(eq(usersTable.id, userId)),
    db.update(poolTable).set({
      totalAmount: Math.max(0, newPoolAmount).toFixed(2),
      biggestWin: newBiggestWin.toFixed(2),
      biggestBet: newBiggestBet.toFixed(2),
    }).where(eq(poolTable.id, pool.id)),
    db.insert(betsTable).values({
      userId,
      gameType: "plinko",
      betAmount: betAmount.toFixed(2),
      result: won ? "win" : "loss",
      payout: payout.toFixed(2),
      multiplier: multiplier.toFixed(4),
    }),
  ]);

  res.json(
    PlayPlinkoResponse.parse({
      won,
      multiplier,
      path,
      betAmount,
      payout,
      newBalance,
      slot,
      winChance,
    }),
  );
});

export default router;
