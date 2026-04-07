import { Router, type IRouter } from "express";
import { db, usersTable, casinosTable, poolTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { pool as pgPool } from "@workspace/db";

const router: IRouter = Router();

const CHAT_UNLOCK_COST = 500_000_000;

// GET /casino-chat/:casinoId — fetch recent messages
router.get("/casino-chat/:casinoId", async (req, res): Promise<void> => {
  const casinoId = parseInt(req.params.casinoId);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const [casino] = await db.select({ chatUnlocked: casinosTable.chatUnlocked, name: casinosTable.name })
    .from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
  if (!casino) { res.status(404).json({ error: "Casino not found" }); return; }
  if (!casino.chatUnlocked) { res.json({ chatUnlocked: false, messages: [] }); return; }

  const rows = await pgPool.query(
    `SELECT ccm.id, ccm.user_id as "userId", ccm.username, ccm.message, ccm.created_at as "createdAt"
     FROM casino_chat_messages ccm
     WHERE ccm.casino_id = $1
     ORDER BY ccm.created_at ASC
     LIMIT 100`,
    [casinoId]
  );
  res.json({ chatUnlocked: true, messages: rows.rows });
});

// POST /casino-chat/:casinoId — send a message
router.post("/casino-chat/:casinoId", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const casinoId = parseInt(req.params.casinoId);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const message = (req.body.message ?? "").trim();
  if (!message || message.length > 500) { res.status(400).json({ error: "Message must be 1-500 characters" }); return; }

  const [casino] = await db.select({ chatUnlocked: casinosTable.chatUnlocked })
    .from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
  if (!casino) { res.status(404).json({ error: "Casino not found" }); return; }
  if (!casino.chatUnlocked) { res.status(400).json({ error: "Chat is not enabled for this casino" }); return; }

  const [user] = await db.select({ username: usersTable.username, isGuest: usersTable.isGuest })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.isGuest) { res.status(403).json({ error: "Guests cannot send messages" }); return; }

  await pgPool.query(
    `INSERT INTO casino_chat_messages (casino_id, user_id, username, message) VALUES ($1, $2, $3, $4)`,
    [casinoId, userId, user.username, message]
  );
  res.json({ ok: true, username: user.username, message });
});

// POST /casino-chat/:casinoId/unlock — casino owner purchases chat
router.post("/casino-chat/:casinoId/unlock", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const casinoId = parseInt(req.params.casinoId);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const [casino] = await db.select({ ownerId: casinosTable.ownerId, chatUnlocked: casinosTable.chatUnlocked })
    .from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
  if (!casino) { res.status(404).json({ error: "Casino not found" }); return; }
  if (casino.ownerId !== userId) { res.status(403).json({ error: "Only the casino owner can unlock chat" }); return; }
  if (casino.chatUnlocked) { res.json({ ok: true, message: "Chat is already unlocked" }); return; }

  const [user] = await db.select({ balance: usersTable.balance })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || parseFloat(user.balance) < CHAT_UNLOCK_COST) {
    res.status(400).json({ error: `Insufficient balance. Chat costs $${CHAT_UNLOCK_COST.toLocaleString()}` }); return;
  }

  await db.transaction(async (tx) => {
    await tx.update(usersTable)
      .set({ balance: sql`${usersTable.balance} - ${CHAT_UNLOCK_COST}` })
      .where(eq(usersTable.id, userId));
    await tx.update(poolTable)
      .set({ totalAmount: sql`${poolTable.totalAmount} + ${CHAT_UNLOCK_COST}` });
    await tx.update(casinosTable)
      .set({ chatUnlocked: true })
      .where(eq(casinosTable.id, casinoId));
  });

  res.json({ ok: true, message: `Chat unlocked for $${CHAT_UNLOCK_COST.toLocaleString()}!` });
});

export default router;
