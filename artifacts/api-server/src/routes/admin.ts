import { Router, type IRouter } from "express";
import { db, usersTable, poolTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  AdminRefillPoolBody,
  AdminRefillPoolResponse,
  AdminRefillPlayerBody,
  AdminRefillPlayerResponse,
  AdminListPlayersResponse,
  AdminGetSettingsResponse,
  AdminUpdateSettingsBody,
  AdminUpdateSettingsResponse,
  AdminResetAllBalancesBody,
  AdminResetAllBalancesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || !user.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

async function getSetting(key: string, defaultValue: number): Promise<number> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  if (!row) return defaultValue;
  return parseFloat(row.value) || defaultValue;
}

async function upsertSetting(key: string, value: number): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value: value.toString() })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: value.toString() } });
}

router.post("/admin/refill-pool", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const parsed = AdminRefillPoolBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amount } = parsed.data;

  const [pool] = await db.select().from(poolTable).limit(1);
  if (!pool) {
    res.status(500).json({ error: "Pool not found" });
    return;
  }

  const currentAmount = parseFloat(pool.totalAmount);
  const newPoolAmount = currentAmount + amount;

  await db.update(poolTable).set({
    totalAmount: newPoolAmount.toFixed(2),
  }).where(eq(poolTable.id, pool.id));

  res.json(
    AdminRefillPoolResponse.parse({
      message: `Pool refilled by $${amount.toLocaleString()}`,
      newPoolAmount,
    }),
  );
});

router.post("/admin/refill-player", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const parsed = AdminRefillPlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId: targetUserId, amount } = parsed.data;

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId)).limit(1);
  if (!targetUser) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const currentBalance = parseFloat(targetUser.balance);
  const newBalance = currentBalance + amount;

  await db.update(usersTable).set({
    balance: newBalance.toFixed(2),
  }).where(eq(usersTable.id, targetUserId));

  res.json(
    AdminRefillPlayerResponse.parse({
      message: `Player ${targetUser.username} balance refilled by $${amount.toLocaleString()}`,
      newBalance,
    }),
  );
});

router.get("/admin/players", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const players = await db.select().from(usersTable).orderBy(usersTable.id);

  res.json(
    AdminListPlayersResponse.parse({
      players: players.map((p) => ({
        id: p.id,
        username: p.username,
        balance: parseFloat(p.balance),
        isAdmin: p.isAdmin,
        gamesPlayed: parseInt(p.gamesPlayed),
        totalWins: parseInt(p.totalWins),
        totalLosses: parseInt(p.totalLosses),
      })),
    }),
  );
});

router.get("/admin/settings", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const usernameChangeCost = await getSetting("username_change_cost", 500);
  const avatarChangeCost = await getSetting("avatar_change_cost", 250);

  res.json(
    AdminGetSettingsResponse.parse({ usernameChangeCost, avatarChangeCost }),
  );
});

router.post("/admin/settings", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const parsed = AdminUpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { usernameChangeCost, avatarChangeCost } = parsed.data;

  if (usernameChangeCost != null) await upsertSetting("username_change_cost", usernameChangeCost);
  if (avatarChangeCost != null) await upsertSetting("avatar_change_cost", avatarChangeCost);

  const finalUsernameCost = await getSetting("username_change_cost", 500);
  const finalAvatarCost = await getSetting("avatar_change_cost", 250);

  res.json(
    AdminUpdateSettingsResponse.parse({
      usernameChangeCost: finalUsernameCost,
      avatarChangeCost: finalAvatarCost,
    }),
  );
});

router.post("/admin/reset-all-balances", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const parsed = AdminResetAllBalancesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const resetBalance = parsed.data.newBalance ?? 10000;

  const allUsers = await db.select({ id: usersTable.id, isAdmin: usersTable.isAdmin })
    .from(usersTable);

  const nonAdminUsers = allUsers.filter((u) => !u.isAdmin);

  await Promise.all(
    nonAdminUsers.map((u) =>
      db.update(usersTable)
        .set({ balance: resetBalance.toFixed(2) })
        .where(eq(usersTable.id, u.id))
    )
  );

  res.json(
    AdminResetAllBalancesResponse.parse({
      message: `Reset ${nonAdminUsers.length} player balance(s) to ${formatCurrency(resetBalance)}`,
      usersReset: nonAdminUsers.length,
    }),
  );
});

router.post("/admin/force-reload", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const ts = Date.now();
  await db
    .insert(settingsTable)
    .values({ key: "force_reload_at", value: ts.toString() })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: ts.toString() } });

  res.json({ message: "Force reload signal sent", timestamp: ts });
});

function formatCurrency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default router;
