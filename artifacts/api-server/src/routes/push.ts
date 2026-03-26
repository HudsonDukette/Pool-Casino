import { Router, type IRouter } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return null; }
  return userId;
}

router.get("/push/vapid-key", (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? "" });
});

router.post("/push/subscribe", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "Invalid subscription" }); return;
  }

  await db.insert(pushSubscriptionsTable)
    .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { userId, p256dh: keys.p256dh, auth: keys.auth },
    });

  res.json({ ok: true });
});

router.delete("/push/unsubscribe", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { endpoint } = req.body;
  if (endpoint) {
    await db.delete(pushSubscriptionsTable)
      .where(and(eq(pushSubscriptionsTable.endpoint, endpoint), eq(pushSubscriptionsTable.userId, userId)));
  } else {
    await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
  }

  res.json({ ok: true });
});

export default router;
