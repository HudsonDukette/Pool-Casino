import { Router, type IRouter, type Response } from "express";
import { db, usersTable, poolTable, betsTable, casinosTable, casinoGamesOwnedTable, casinoBetsTable, casinoTransactionsTable, casinoGameOddsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { PlayRouletteBody, PlayRouletteResponse, PlayPlinkoBody, PlayPlinkoResponse, PlayPlinkoBatchBody, PlayPlinkoBatchResponse } from "@workspace/api-zod";
import {
  calculateWinChance,
  ROULETTE_NUMBERS,
  simulatePlinko,
} from "../lib/gambling";
import { trackGameProgress } from "../lib/progress";
import { checkAndLockIfEmpty } from "../lib/pool-guard";

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

async function getCasinoOddsMultiplier(casinoId: number, gameType: string): Promise<number> {
  const [row] = await db.select().from(casinoGameOddsTable)
    .where(and(eq(casinoGameOddsTable.casinoId, casinoId), eq(casinoGameOddsTable.gameType, gameType)))
    .limit(1);
  return row ? parseFloat(row.payoutMultiplier) : 1.0;
}

async function validateCasinoPlay(casinoId: number, gameType: string, betAmount: number, res: Response): Promise<boolean> {
  const [casino] = await db.select().from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
  if (!casino) { res.status(404).json({ error: "Casino not found" }); return false; }
  if (casino.isPaused) { res.status(400).json({ error: "This casino is currently paused" }); return false; }
  const [gameOwned] = await db.select().from(casinoGamesOwnedTable)
    .where(and(eq(casinoGamesOwnedTable.casinoId, casinoId), eq(casinoGamesOwnedTable.gameType, gameType), eq(casinoGamesOwnedTable.isEnabled, true)))
    .limit(1);
  if (!gameOwned) { res.status(400).json({ error: `${gameType} is not offered at this casino` }); return false; }
  const minBet = parseFloat(casino.minBet);
  const maxBet = parseFloat(casino.maxBet);
  if (betAmount < minBet) { res.status(400).json({ error: `Minimum bet at this casino is ${minBet}` }); return false; }
  if (betAmount > maxBet) { res.status(400).json({ error: `Maximum bet at this casino is ${maxBet}` }); return false; }
  const bankroll = parseFloat(casino.bankroll);
  if (bankroll <= 0) { res.status(400).json({ error: "Casino bankroll is empty — the owner needs to deposit chips first" }); return false; }
  return true;
}

router.post("/games/roulette", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const parsed = PlayRouletteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { betAmount, color } = parsed.data;
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;

  if (casinoId !== undefined) {
    const ok = await validateCasinoPlay(casinoId, "roulette", betAmount, res as Response);
    if (!ok) return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

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

  const isGreen = color === "green";
  const winChance = casinoId !== undefined
    ? 0.5
    : isGreen ? Math.min(calculateWinChance(betAmount, poolAmount), 0.025) : calculateWinChance(betAmount, poolAmount);

  const won = Math.random() < winChance;

  let spinResult: typeof ROULETTE_NUMBERS[0];
  if (won) {
    const matchingNumbers = ROULETTE_NUMBERS.filter((n) => n.color === color);
    spinResult = matchingNumbers[Math.floor(Math.random() * matchingNumbers.length)];
  } else {
    const nonMatchingNumbers = ROULETTE_NUMBERS.filter((n) => n.color !== color);
    spinResult = nonMatchingNumbers[Math.floor(Math.random() * nonMatchingNumbers.length)];
  }

  const resultColor = spinResult.color;
  let rawPayoutMultiplier = isGreen ? 50 : 2;

  if (casinoId !== undefined && won) {
    const oddsMultiplier = await getCasinoOddsMultiplier(casinoId, "roulette");
    rawPayoutMultiplier = rawPayoutMultiplier * oddsMultiplier;
  }

  const uncappedPayout = won ? betAmount * rawPayoutMultiplier : 0;
  let payout: number;
  let newBalance: number;

  if (casinoId !== undefined) {
    const [casino] = await db.select().from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
    if (!casino) { res.status(404).json({ error: "Casino not found" }); return; }
    const bankroll = parseFloat(casino.bankroll);
    payout = won ? Math.min(uncappedPayout, bankroll) : 0;
    newBalance = currentBalance - betAmount + payout;
    const casinoProfit = betAmount - payout;
    const newBankroll = Math.max(0, bankroll + casinoProfit);
    await Promise.all([
      db.update(casinosTable).set({ bankroll: newBankroll.toFixed(2), totalBets: sql`${casinosTable.totalBets} + 1`, totalWagered: sql`${casinosTable.totalWagered} + ${betAmount}`, totalPaidOut: sql`${casinosTable.totalPaidOut} + ${payout}`, isPaused: newBankroll <= 0, updatedAt: new Date() }).where(eq(casinosTable.id, casinoId)),
      db.insert(casinoBetsTable).values({ casinoId, userId, gameType: "roulette", betAmount: betAmount.toFixed(2), result: won ? "win" : "loss", payout: payout.toFixed(2), multiplier: rawPayoutMultiplier.toFixed(4) }),
      db.insert(casinoTransactionsTable).values({ casinoId, type: won ? "bet_loss" : "bet_win", amount: Math.abs(casinoProfit).toFixed(2), description: `roulette — ${won ? "Player win" : "Player loss"}` }),
    ]);
  } else {
    payout = uncappedPayout > betAmount ? Math.min(uncappedPayout, poolAmount) : uncappedPayout;
    newBalance = currentBalance - betAmount + payout;
    const newPoolAmount = poolAmount + betAmount - payout;
    const newBiggestWin = won && payout > parseFloat(pool.biggestWin) ? payout : parseFloat(pool.biggestWin);
    const newBiggestBet = betAmount > parseFloat(pool.biggestBet) ? betAmount : parseFloat(pool.biggestBet);
    const clampedPoolAmount = Math.max(0, newPoolAmount);
    await db.update(poolTable).set({ totalAmount: clampedPoolAmount.toFixed(2), biggestWin: newBiggestWin.toFixed(2), biggestBet: newBiggestBet.toFixed(2) }).where(eq(poolTable.id, pool.id));
    await checkAndLockIfEmpty(clampedPoolAmount);
  }

  const profit = payout - betAmount;
  const newGamesPlayed = parseInt(user.gamesPlayed) + 1;
  const newCurrentStreak = won ? parseInt(user.currentStreak) + 1 : 0;
  const newWinStreak = Math.max(parseInt(user.winStreak), newCurrentStreak);
  await Promise.all([
    db.update(usersTable).set({
      balance: newBalance.toFixed(2),
      totalProfit: (parseFloat(user.totalProfit) + profit).toFixed(2),
      biggestWin: (won && payout > parseFloat(user.biggestWin) ? payout : parseFloat(user.biggestWin)).toFixed(2),
      biggestBet: (betAmount > parseFloat(user.biggestBet) ? betAmount : parseFloat(user.biggestBet)).toFixed(2),
      gamesPlayed: newGamesPlayed.toString(),
      winStreak: newWinStreak.toString(),
      currentStreak: newCurrentStreak.toString(),
      totalWins: (parseInt(user.totalWins) + (won ? 1 : 0)).toString(),
      totalLosses: (parseInt(user.totalLosses) + (!won ? 1 : 0)).toString(),
      lastBetAt: new Date(),
    }).where(eq(usersTable.id, userId)),
    db.insert(betsTable).values({ userId, gameType: "roulette", betAmount: betAmount.toFixed(2), result: won ? "win" : "loss", payout: payout.toFixed(2), multiplier: won ? rawPayoutMultiplier.toFixed(4) : "0.0000" }),
  ]);

  trackGameProgress({ userId, gameType: "roulette", betAmount, won, lostAmount: won ? 0 : betAmount, currentWinStreak: newWinStreak });

  res.json(PlayRouletteResponse.parse({ won, resultColor, resultNumber: spinResult.number, betAmount, payout, newBalance, winChance }));
});

router.post("/games/plinko", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const parsed = PlayPlinkoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { betAmount, risk } = parsed.data;
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;

  if (casinoId !== undefined) {
    const ok = await validateCasinoPlay(casinoId, "plinko", betAmount, res as Response);
    if (!ok) return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const banErr2 = getBanError(user);
  if (banErr2) { res.status(403).json({ error: "banned", message: banErr2 }); return; }

  const pool = await getOrCreatePool();
  const poolAmount = parseFloat(pool.totalAmount);
  const currentBalance = parseFloat(user.balance);

  const winChance = casinoId !== undefined ? 0.5 : calculateWinChance(betAmount, poolAmount);
  const { path, slot, multiplier: rawMultiplier } = simulatePlinko(risk, winChance);

  let multiplier = rawMultiplier;
  if (casinoId !== undefined && rawMultiplier > 1) {
    const oddsMultiplier = await getCasinoOddsMultiplier(casinoId, "plinko");
    multiplier = rawMultiplier * oddsMultiplier;
  }

  const uncappedPayout = betAmount * multiplier;
  const won = multiplier > 1;
  const profit = (won ? Math.min(uncappedPayout, casinoId !== undefined ? Infinity : poolAmount) : uncappedPayout) - betAmount;
  let payout: number;
  let newBalance: number;

  if (casinoId !== undefined) {
    const [casino] = await db.select().from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
    if (!casino) { res.status(404).json({ error: "Casino not found" }); return; }
    const bankroll = parseFloat(casino.bankroll);
    payout = won ? Math.min(uncappedPayout, bankroll) : uncappedPayout;
    newBalance = currentBalance - betAmount + payout;
    const casinoProfit = betAmount - payout;
    const newBankroll = Math.max(0, bankroll + casinoProfit);
    await Promise.all([
      db.update(casinosTable).set({ bankroll: newBankroll.toFixed(2), totalBets: sql`${casinosTable.totalBets} + 1`, totalWagered: sql`${casinosTable.totalWagered} + ${betAmount}`, totalPaidOut: sql`${casinosTable.totalPaidOut} + ${payout}`, isPaused: newBankroll <= 0, updatedAt: new Date() }).where(eq(casinosTable.id, casinoId)),
      db.insert(casinoBetsTable).values({ casinoId, userId, gameType: "plinko", betAmount: betAmount.toFixed(2), result: won ? "win" : "loss", payout: payout.toFixed(2), multiplier: multiplier.toFixed(4) }),
      db.insert(casinoTransactionsTable).values({ casinoId, type: won ? "bet_loss" : "bet_win", amount: Math.abs(casinoProfit).toFixed(2), description: `plinko — ${won ? "Player win" : "Player loss"}` }),
    ]);
  } else {
    payout = won ? Math.min(uncappedPayout, poolAmount) : uncappedPayout;
    newBalance = currentBalance - betAmount + payout;
    const balanceDelta = payout - betAmount;
    const poolDelta = betAmount - payout;
    const plinkoPoolAfter = Math.max(0, poolAmount + poolDelta);
    await Promise.all([
      db.update(poolTable).set({
        totalAmount: plinkoPoolAfter.toFixed(2),
        biggestWin: won ? sql`GREATEST(${poolTable.biggestWin}::numeric, ${payout})` : undefined,
        biggestBet: sql`GREATEST(${poolTable.biggestBet}::numeric, ${betAmount})`,
      }).where(eq(poolTable.id, pool.id)),
    ]);
    await checkAndLockIfEmpty(plinkoPoolAfter);
    await db.update(usersTable).set({
      balance: sql`${usersTable.balance} + ${balanceDelta}`,
      totalProfit: sql`${usersTable.totalProfit} + ${profit}`,
      biggestWin: won ? sql`GREATEST(${usersTable.biggestWin}::numeric, ${payout})` : undefined,
      biggestBet: sql`GREATEST(${usersTable.biggestBet}::numeric, ${betAmount})`,
      gamesPlayed: sql`(${usersTable.gamesPlayed}::integer + 1)::text`,
      totalWins: won ? sql`(${usersTable.totalWins}::integer + 1)::text` : undefined,
      totalLosses: !won ? sql`(${usersTable.totalLosses}::integer + 1)::text` : undefined,
      winStreak: won ? sql`GREATEST(${usersTable.winStreak}::integer, ${usersTable.currentStreak}::integer + 1)::text` : undefined,
      currentStreak: won ? sql`(${usersTable.currentStreak}::integer + 1)::text` : sql`'0'`,
      lastBetAt: new Date(),
    }).where(eq(usersTable.id, userId));
    await db.insert(betsTable).values({ userId, gameType: "plinko", betAmount: betAmount.toFixed(2), result: won ? "win" : "loss", payout: payout.toFixed(2), multiplier: multiplier.toFixed(4) });
    const plinkoNewStreak = won ? parseInt(user.currentStreak) + 1 : 0;
    const plinkoWinStreak = Math.max(parseInt(user.winStreak), plinkoNewStreak);
    trackGameProgress({ userId, gameType: "plinko", betAmount, won, lostAmount: won ? 0 : betAmount, currentWinStreak: plinkoWinStreak });
    res.json(PlayPlinkoResponse.parse({ won, multiplier, path, betAmount, payout, newBalance, slot, winChance }));
    return;
  }

  const plinkoNewStreak = won ? parseInt(user.currentStreak) + 1 : 0;
  const plinkoWinStreak = Math.max(parseInt(user.winStreak), plinkoNewStreak);
  trackGameProgress({ userId, gameType: "plinko", betAmount, won, lostAmount: won ? 0 : betAmount, currentWinStreak: plinkoWinStreak });
  res.json(PlayPlinkoResponse.parse({ won, multiplier, path, betAmount, payout, newBalance, slot, winChance }));
});

router.post("/games/plinko/batch", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const parsed = PlayPlinkoBatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { betAmount, risk, count } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

  const banErr = getBanError(user);
  if (banErr) { res.status(403).json({ error: "banned", message: banErr }); return; }

  const pool = await getOrCreatePool();
  const totalCost = betAmount * count;
  const userBalance = parseFloat(user.balance);
  if (userBalance < totalCost) {
    res.status(400).json({ error: `Insufficient balance. Need ${totalCost.toFixed(2)}, have ${userBalance.toFixed(2)}` });
    return;
  }

  // Simulate all balls sequentially, tracking pool balance as it changes
  let runningPool = parseFloat(pool.totalAmount);
  const results: Array<{ won: boolean; multiplier: number; path: { x: number; y: number }[]; payout: number; slot: number; winChance: number }> = [];

  for (let i = 0; i < count; i++) {
    const winChance = calculateWinChance(betAmount, runningPool);
    const { path, slot, multiplier } = simulatePlinko(risk, winChance);
    const won = multiplier > 1;
    const uncappedPayout = betAmount * multiplier;
    const payout = won ? Math.min(uncappedPayout, runningPool) : uncappedPayout;
    // Update running pool balance for next iteration
    runningPool = Math.max(0, runningPool + betAmount - payout);
    results.push({ won, multiplier, path, payout, slot, winChance });
    // If pool is now empty, stop simulating wins (remaining balls just lose)
    if (runningPool === 0 && i < count - 1) {
      for (let j = i + 1; j < count; j++) {
        const { path: p2, slot: s2 } = simulatePlinko(risk, 0);
        results.push({ won: false, multiplier: 0, path: p2, payout: 0, slot: s2, winChance: 0 });
      }
      break;
    }
  }

  const totalPayout = results.reduce((sum, r) => sum + r.payout, 0);
  const netDelta = totalPayout - totalCost;
  const newBalance = parseFloat((userBalance + netDelta).toFixed(2));
  const poolAfter = parseFloat(pool.totalAmount) - totalCost + totalPayout;
  const clampedPoolAfter = Math.max(0, poolAfter);

  // Apply all changes atomically
  const biggestWin = Math.max(...results.filter(r => r.won).map(r => r.payout), 0);
  await db.transaction(async (tx) => {
    await tx.update(poolTable).set({
      totalAmount: clampedPoolAfter.toFixed(2),
      biggestWin: biggestWin > 0 ? sql`GREATEST(${poolTable.biggestWin}::numeric, ${biggestWin})` : undefined,
      biggestBet: sql`GREATEST(${poolTable.biggestBet}::numeric, ${betAmount})`,
    }).where(eq(poolTable.id, pool.id));

    await tx.update(usersTable).set({
      balance: newBalance.toFixed(2),
      totalProfit: sql`${usersTable.totalProfit} + ${netDelta.toFixed(2)}`,
      gamesPlayed: sql`(${usersTable.gamesPlayed}::integer + ${count})::text`,
      totalWins: sql`(${usersTable.totalWins}::integer + ${results.filter(r => r.won).length})::text`,
      totalLosses: sql`(${usersTable.totalLosses}::integer + ${results.filter(r => !r.won).length})::text`,
      lastBetAt: new Date(),
    }).where(eq(usersTable.id, userId));

    await tx.insert(betsTable).values(
      results.map(r => ({
        userId,
        gameType: "plinko",
        betAmount: betAmount.toFixed(2),
        result: r.won ? "win" : "loss",
        payout: r.payout.toFixed(2),
        multiplier: r.multiplier.toFixed(4),
      }))
    );
  });

  await checkAndLockIfEmpty(clampedPoolAfter);

  const winsCount = results.filter(r => r.won).length;
  trackGameProgress({ userId, gameType: "plinko", betAmount: totalCost, won: winsCount > 0, lostAmount: results.filter(r => !r.won).reduce((s, r) => s + betAmount - r.payout, 0), currentWinStreak: 0 });

  res.json(PlayPlinkoBatchResponse.parse({ results, newBalance, totalBet: totalCost, totalPayout }));
});

export default router;
