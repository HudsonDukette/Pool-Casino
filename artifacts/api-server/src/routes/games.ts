import { Router, type IRouter } from "express";
import { db, usersTable, poolTable, betsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { PlayRouletteBody, PlayRouletteResponse, PlayPlinkoBody, PlayPlinkoResponse } from "@workspace/api-zod";
import {
  calculateWinChance,
  ROULETTE_NUMBERS,
  PLINKO_MULTIPLIERS,
  simulatePlinko,
} from "../lib/gambling";

const router: IRouter = Router();

const MIN_BET = 0.01;
const BET_COOLDOWN_MS = 1000;

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

  if (user.lastBetAt) {
    const msSinceLastBet = Date.now() - user.lastBetAt.getTime();
    if (msSinceLastBet < BET_COOLDOWN_MS) {
      res.status(400).json({ error: `Please wait ${Math.ceil((BET_COOLDOWN_MS - msSinceLastBet) / 1000)} second(s) between bets` });
      return;
    }
  }

  const pool = await getOrCreatePool();
  const poolAmount = parseFloat(pool.totalAmount);
  const maxBet = poolAmount * 0.1;
  const currentBalance = parseFloat(user.balance);

  if (betAmount < MIN_BET) {
    res.status(400).json({ error: `Minimum bet is $${MIN_BET}` });
    return;
  }
  if (betAmount > maxBet) {
    res.status(400).json({ error: `Maximum bet is $${maxBet.toFixed(2)}` });
    return;
  }
  if (betAmount > currentBalance) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  const winChance = calculateWinChance(betAmount, poolAmount);

  const spinResult = ROULETTE_NUMBERS[Math.floor(Math.random() * ROULETTE_NUMBERS.length)];
  const resultColor = spinResult.color;

  let won = false;
  let payout = 0;

  if (resultColor === "green") {
    won = false;
    payout = 0;
  } else if (resultColor === color) {
    won = Math.random() < winChance;
    if (won) {
      payout = betAmount * 2;
    }
  } else {
    const inverseChance = 1 - winChance;
    won = Math.random() >= inverseChance;
    if (won) {
      payout = betAmount * 2;
    }
  }

  if (resultColor === color) {
    won = Math.random() < winChance;
  } else if (resultColor === "green") {
    won = false;
  } else {
    won = false;
  }
  payout = won ? betAmount * 2 : 0;

  const newBalance = currentBalance - betAmount + payout;
  const profit = payout - betAmount;
  const newPoolAmount = poolAmount + (won ? -profit : betAmount);

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
      totalAmount: Math.max(100, newPoolAmount).toFixed(2),
      biggestWin: newBiggestWin.toFixed(2),
      biggestBet: newBiggestBet.toFixed(2),
    }).where(eq(poolTable.id, pool.id)),
    db.insert(betsTable).values({
      userId,
      gameType: "roulette",
      betAmount: betAmount.toFixed(2),
      result: won ? "win" : "loss",
      payout: payout.toFixed(2),
      multiplier: won ? "2.0000" : "0.0000",
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

  if (user.lastBetAt) {
    const msSinceLastBet = Date.now() - user.lastBetAt.getTime();
    if (msSinceLastBet < BET_COOLDOWN_MS) {
      res.status(400).json({ error: `Please wait ${Math.ceil((BET_COOLDOWN_MS - msSinceLastBet) / 1000)} second(s) between bets` });
      return;
    }
  }

  const pool = await getOrCreatePool();
  const poolAmount = parseFloat(pool.totalAmount);
  const maxBet = poolAmount * 0.1;
  const currentBalance = parseFloat(user.balance);

  if (betAmount < MIN_BET) {
    res.status(400).json({ error: `Minimum bet is $${MIN_BET}` });
    return;
  }
  if (betAmount > maxBet) {
    res.status(400).json({ error: `Maximum bet is $${maxBet.toFixed(2)}` });
    return;
  }
  if (betAmount > currentBalance) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  const winChance = calculateWinChance(betAmount, poolAmount);
  const { path, slot } = simulatePlinko(risk);
  const multipliers = PLINKO_MULTIPLIERS[risk];
  let multiplier = multipliers[slot];

  const doWin = Math.random() < winChance;
  if (!doWin) {
    const losingMultipliers = multipliers.map((m, i) => ({ m, i })).filter(({ m }) => m <= 0.5);
    if (losingMultipliers.length > 0) {
      const chosen = losingMultipliers[Math.floor(Math.random() * losingMultipliers.length)];
      multiplier = chosen.m;
    } else {
      multiplier = multipliers[0];
    }
  }

  const payout = betAmount * multiplier;
  const won = payout > betAmount;
  const profit = payout - betAmount;
  const newBalance = currentBalance - betAmount + payout;
  const newPoolAmount = poolAmount + (won ? -profit : betAmount - payout);

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
      totalAmount: Math.max(100, newPoolAmount).toFixed(2),
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
