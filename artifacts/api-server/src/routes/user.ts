import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { GetUserStatsResponse, ClaimDailyRewardResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/user/stats", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json(
    GetUserStatsResponse.parse({
      totalProfit: parseFloat(user.totalProfit),
      biggestWin: parseFloat(user.biggestWin),
      biggestBet: parseFloat(user.biggestBet),
      gamesPlayed: parseInt(user.gamesPlayed),
      winStreak: parseInt(user.winStreak),
      currentStreak: parseInt(user.currentStreak),
      totalWins: parseInt(user.totalWins),
      totalLosses: parseInt(user.totalLosses),
      lastDailyClaim: user.lastDailyClaim ? user.lastDailyClaim.toISOString() : null,
      balance: parseFloat(user.balance),
    }),
  );
});

router.post("/user/claim-daily", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const now = new Date();
  const lastClaim = user.lastDailyClaim;

  if (lastClaim) {
    const diffMs = now.getTime() - lastClaim.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 24) {
      res.status(400).json({ error: "Already claimed today. Come back in " + Math.ceil(24 - diffHours) + " hours." });
      return;
    }
  }

  const reward = 500;
  const newBalance = parseFloat(user.balance) + reward;

  await db
    .update(usersTable)
    .set({
      balance: newBalance.toFixed(2),
      lastDailyClaim: now,
    })
    .where(eq(usersTable.id, userId));

  res.json(
    ClaimDailyRewardResponse.parse({
      reward,
      newBalance,
      message: `You received $${reward} daily reward!`,
    }),
  );
});

export default router;
