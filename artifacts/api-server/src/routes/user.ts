import { Router, type IRouter } from "express";
import { db, usersTable, settingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  GetUserStatsResponse,
  ClaimDailyRewardResponse,
  ChangeUsernameBody,
  ChangeAvatarBody,
  ChangeUsernameResponse,
  ChangeAvatarResponse,
  GetProfileChangeCostsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getSetting(key: string, defaultValue: number): Promise<number> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  if (!row) return defaultValue;
  return parseFloat(row.value) || defaultValue;
}

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
    const todayUTC = now.toISOString().slice(0, 10);
    const lastClaimUTC = lastClaim.toISOString().slice(0, 10);
    if (todayUTC === lastClaimUTC) {
      const midnight = new Date(now);
      midnight.setUTCHours(24, 0, 0, 0);
      const msUntilMidnight = midnight.getTime() - now.getTime();
      const hoursLeft = Math.floor(msUntilMidnight / (1000 * 60 * 60));
      const minutesLeft = Math.floor((msUntilMidnight % (1000 * 60 * 60)) / (1000 * 60));
      const timeStr = hoursLeft > 0 ? `${hoursLeft}h ${minutesLeft}m` : `${minutesLeft}m`;
      res.status(400).json({ error: `Already claimed today. Resets at midnight UTC — come back in ${timeStr}.` });
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

router.get("/user/profile-change-costs", async (req, res): Promise<void> => {
  const usernameChangeCost = await getSetting("username_change_cost", 500);
  const avatarChangeCost = await getSetting("avatar_change_cost", 250);
  res.json(
    GetProfileChangeCostsResponse.parse({ usernameChangeCost, avatarChangeCost }),
  );
});

router.post("/user/change-username", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = ChangeUsernameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { newUsername } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const cost = await getSetting("username_change_cost", 500);
  const currentBalance = parseFloat(user.balance);

  if (currentBalance < cost) {
    res.status(400).json({ error: `Insufficient funds. Username change costs $${cost.toLocaleString()}` });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, newUsername)).limit(1);
  if (existing.length > 0 && existing[0].id !== userId) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  const newBalance = currentBalance - cost;

  await db
    .update(usersTable)
    .set({ username: newUsername, balance: newBalance.toFixed(2) })
    .where(eq(usersTable.id, userId));

  res.json(
    ChangeUsernameResponse.parse({
      message: `Username changed to "${newUsername}"`,
      newBalance,
      cost,
    }),
  );
});

router.post("/user/change-avatar", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = ChangeAvatarBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { avatarUrl } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const cost = await getSetting("avatar_change_cost", 250);
  const currentBalance = parseFloat(user.balance);

  if (currentBalance < cost) {
    res.status(400).json({ error: `Insufficient funds. Avatar change costs $${cost.toLocaleString()}` });
    return;
  }

  const newBalance = currentBalance - cost;

  await db
    .update(usersTable)
    .set({ avatarUrl, balance: newBalance.toFixed(2) })
    .where(eq(usersTable.id, userId));

  res.json(
    ChangeAvatarResponse.parse({
      message: "Avatar updated",
      newBalance,
      cost,
    }),
  );
});

export default router;
