import { Router, type IRouter } from "express";
import { db, reportsTable, usersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { sendPushToUser } from "../lib/push";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return null; }
  return userId;
}

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return false; }
  const [user] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user?.isAdmin) { res.status(403).json({ error: "Admin required" }); return false; }
  return true;
}

router.post("/reports", async (req, res): Promise<void> => {
  const reporterId = requireAuth(req, res);
  if (!reporterId) return;

  const { reportedUserId, reportedUsername, reason, details } = req.body;
  if ((!reportedUserId && !reportedUsername) || !reason?.trim()) {
    res.status(400).json({ error: "reportedUserId or reportedUsername, and reason are required" }); return;
  }

  const [target] = await db.select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(reportedUserId ? eq(usersTable.id, reportedUserId) : eq(usersTable.username, reportedUsername))
    .limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  await db.insert(reportsTable).values({
    reporterId,
    reportedUserId: target.id,
    reason: reason.trim(),
    details: details?.trim() || null,
  });

  const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.isAdmin, true));
  admins.forEach(admin => {
    sendPushToUser(admin.id, {
      title: "New Player Report",
      body: `A report has been filed against ${target.username}`,
      url: "/admin",
      tag: "report",
    }).catch(() => {});
  });

  res.json({ ok: true, message: `Report submitted against ${target.username}` });
});

router.get("/admin/reports", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const reports = await db
    .select({
      id: reportsTable.id,
      reason: reportsTable.reason,
      details: reportsTable.details,
      status: reportsTable.status,
      createdAt: reportsTable.createdAt,
      reviewedAt: reportsTable.reviewedAt,
      reporterUsername: sql<string>`(SELECT username FROM users WHERE id = ${reportsTable.reporterId})`,
      reportedUsername: sql<string>`(SELECT username FROM users WHERE id = ${reportsTable.reportedUserId})`,
      reportedUserId: reportsTable.reportedUserId,
      reporterId: reportsTable.reporterId,
    })
    .from(reportsTable)
    .orderBy(desc(reportsTable.createdAt));

  res.json({ reports });
});

router.post("/admin/reports/:id/status", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const adminId = req.session?.userId;

  const { status } = req.body;
  if (!["reviewed", "dismissed"].includes(status)) {
    res.status(400).json({ error: "status must be 'reviewed' or 'dismissed'" }); return;
  }

  await db.update(reportsTable)
    .set({ status, reviewedAt: new Date(), reviewedBy: adminId })
    .where(eq(reportsTable.id, parseInt(req.params.id)));

  res.json({ ok: true });
});

router.get("/admin/user/:id/chats", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const userId = parseInt(req.params.id);
  const messages = await db.execute(
    sql`SELECT cm.id, cm.content, cm.created_at, cr.name as room_name, cr.type as room_type
        FROM chat_messages cm
        JOIN chat_rooms cr ON cr.id = cm.room_id
        WHERE cm.user_id = ${userId}
        ORDER BY cm.created_at DESC
        LIMIT 100`
  );

  res.json({ messages: messages.rows });
});

export default router;
