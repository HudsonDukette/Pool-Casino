import { Router, type IRouter } from "express";
import { db, usersTable, poolTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AdminRefillPoolBody, AdminRefillPoolResponse, AdminRefillPlayerBody, AdminRefillPlayerResponse, AdminListPlayersResponse } from "@workspace/api-zod";

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

export default router;
