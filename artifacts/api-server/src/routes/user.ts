import { Router, type IRouter } from "express";
import { db, usersTable, settingsTable, banAppealsTable, poolTable, moneyLedgerTable } from "@workspace/db";
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

async function addLedgerEntry(opts: {
  eventType: string;
  direction: "in" | "out";
  amount: number;
  description: string;
  actorUserId?: number | null;
  targetUserId?: number | null;
}): Promise<void> {
  if (opts.amount <= 0) return;
  await db.insert(moneyLedgerTable).values({
    eventType: opts.eventType,
    direction: opts.direction,
    amount: opts.amount.toFixed(2),
    description: opts.description,
    actorUserId: opts.actorUserId ?? null,
    targetUserId: opts.targetUserId ?? null,
  });
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

  await addLedgerEntry({
    eventType: "daily_reward",
    direction: "in",
    amount: reward,
    description: `Daily reward claimed by ${user.username}`,
    targetUserId: userId,
  });

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

  const [pool] = await db.select().from(poolTable).limit(1);
  if (pool && cost > 0) {
    await db.update(poolTable)
      .set({ totalAmount: (parseFloat(pool.totalAmount) + cost).toFixed(2) })
      .where(eq(poolTable.id, pool.id));
  }

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

  const [pool] = await db.select().from(poolTable).limit(1);
  if (pool && cost > 0) {
    await db.update(poolTable)
      .set({ totalAmount: (parseFloat(pool.totalAmount) + cost).toFixed(2) })
      .where(eq(poolTable.id, pool.id));
  }

  res.json(
    ChangeAvatarResponse.parse({
      message: "Avatar updated",
      newBalance,
      cost,
    }),
  );
});

router.get("/user/public/:username", async (req, res): Promise<void> => {
  const { username } = req.params;
  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      isAdmin: usersTable.isAdmin,
      gamesPlayed: usersTable.gamesPlayed,
      totalWins: usersTable.totalWins,
      totalLosses: usersTable.totalLosses,
      biggestWin: usersTable.biggestWin,
      createdAt: usersTable.createdAt,
      suspendedUntil: usersTable.suspendedUntil,
      bannedUntil: usersTable.bannedUntil,
      permanentlyBanned: usersTable.permanentlyBanned,
    })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const now = new Date();
  const isSuspended = !!(user.suspendedUntil && user.suspendedUntil > now);
  const isBanned = !!(user.permanentlyBanned || (user.bannedUntil && user.bannedUntil > now));

  res.json({
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    gamesPlayed: parseInt(user.gamesPlayed),
    totalWins: parseInt(user.totalWins),
    totalLosses: parseInt(user.totalLosses),
    biggestWin: parseFloat(user.biggestWin),
    createdAt: user.createdAt,
    isSuspended,
    isBanned,
    permanentlyBanned: user.permanentlyBanned,
    suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
    bannedUntil: user.bannedUntil?.toISOString() ?? null,
  });
});

// ── Profile bio ───────────────────────────────────────────────────────────────
router.patch("/user/bio", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const bio = (req.body.bio ?? "").trim();
  if (bio.length > 300) { res.status(400).json({ error: "Bio must be 300 characters or less" }); return; }
  await db.update(usersTable).set({ bio: bio || null }).where(eq(usersTable.id, userId));
  res.json({ ok: true, bio: bio || null });
});

router.post("/user/appeal", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const message = (req.body.message ?? "").trim();
  if (!message || message.length < 10) { res.status(400).json({ error: "Please provide a detailed appeal message (at least 10 characters)." }); return; }
  if (message.length > 2000) { res.status(400).json({ error: "Appeal message too long (max 2000 characters)." }); return; }
  const [user] = await db.select({ permanentlyBanned: usersTable.permanentlyBanned, bannedUntil: usersTable.bannedUntil })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const isBanned = user?.permanentlyBanned || (user?.bannedUntil && user.bannedUntil > new Date());
  if (!isBanned) { res.status(400).json({ error: "Your account is not currently banned." }); return; }
  const [appeal] = await db.insert(banAppealsTable).values({ userId, message }).returning();
  res.json({ ok: true, appeal });
});

export default router;
