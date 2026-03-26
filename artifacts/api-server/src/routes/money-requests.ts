import { Router, type IRouter } from "express";
import { db, usersTable, moneyRequestsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return null; }
  return userId;
}

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return false; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || !user.isAdmin) { res.status(403).json({ error: "Admin access required" }); return false; }
  return true;
}

router.post("/money-request", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { message, amount } = req.body;
  const parsedAmount = parseFloat(amount ?? "10000");
  if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 10_000_000) {
    res.status(400).json({ error: "Invalid amount" }); return;
  }

  await db.insert(moneyRequestsTable).values({
    userId,
    message: message?.trim() || null,
    amount: parsedAmount.toFixed(2),
    status: "pending",
  });

  res.json({ message: "Request sent! An admin will review it shortly." });
});

router.get("/admin/money-requests", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const requests = await db
    .select({
      id: moneyRequestsTable.id,
      userId: moneyRequestsTable.userId,
      message: moneyRequestsTable.message,
      amount: moneyRequestsTable.amount,
      status: moneyRequestsTable.status,
      createdAt: moneyRequestsTable.createdAt,
      resolvedAt: moneyRequestsTable.resolvedAt,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      balance: usersTable.balance,
    })
    .from(moneyRequestsTable)
    .leftJoin(usersTable, eq(moneyRequestsTable.userId, usersTable.id))
    .orderBy(desc(moneyRequestsTable.createdAt))
    .limit(100);

  res.json({ requests });
});

router.post("/admin/money-requests/:id/fulfill", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const reqId = parseInt(req.params.id);
  const [mr] = await db.select().from(moneyRequestsTable).where(eq(moneyRequestsTable.id, reqId)).limit(1);
  if (!mr) { res.status(404).json({ error: "Request not found" }); return; }

  const giveAmount = parseFloat(req.body.amount ?? mr.amount);
  if (isNaN(giveAmount) || giveAmount <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }

  await db.update(usersTable)
    .set({ balance: sql`balance + ${giveAmount.toFixed(2)}::numeric` })
    .where(eq(usersTable.id, mr.userId));

  await db.update(moneyRequestsTable)
    .set({ status: "fulfilled", resolvedAt: new Date() })
    .where(eq(moneyRequestsTable.id, reqId));

  const [updated] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, mr.userId)).limit(1);
  res.json({ message: `Fulfilled $${giveAmount.toLocaleString()} to ${updated?.username ?? "user"}` });
});

router.post("/admin/money-requests/:id/dismiss", async (req, res): Promise<void> => {
  const isAdmin = await requireAdmin(req, res);
  if (!isAdmin) return;

  const reqId = parseInt(req.params.id);
  await db.update(moneyRequestsTable).set({ status: "dismissed", resolvedAt: new Date() }).where(eq(moneyRequestsTable.id, reqId));
  res.json({ message: "Dismissed" });
});

export default router;
