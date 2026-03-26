import { Router, type IRouter } from "express";
import { db, usersTable, friendsTable } from "@workspace/db";
import { eq, and, or, inArray, ilike, ne } from "drizzle-orm";
import { sendPushToUser } from "../lib/push";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return null; }
  return userId;
}

router.get("/users/search", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const q = ((req.query.q as string) ?? "").trim();
  if (!q || q.length < 2) { res.json({ users: [] }); return; }

  const results = await db.select({ id: usersTable.id, username: usersTable.username, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(and(ilike(usersTable.username, `%${q}%`), ne(usersTable.id, userId)))
    .limit(10);

  res.json({ users: results });
});

router.get("/friends", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const rows = await db
    .select({
      id: friendsTable.id,
      status: friendsTable.status,
      createdAt: friendsTable.createdAt,
      requesterId: friendsTable.requesterId,
      recipientId: friendsTable.recipientId,
    })
    .from(friendsTable)
    .where(or(eq(friendsTable.requesterId, userId), eq(friendsTable.recipientId, userId)));

  const userIds = new Set<number>();
  rows.forEach(r => { userIds.add(r.requesterId); userIds.add(r.recipientId); });
  const ids = Array.from(userIds).filter(id => id !== userId);
  
  let users: Array<{ id: number; username: string; avatarUrl: string | null }> = [];
  if (ids.length > 0) {
    users = await db.select({ id: usersTable.id, username: usersTable.username, avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(inArray(usersTable.id, ids));
  }
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const friends = rows
    .filter(r => r.status === "accepted")
    .map(r => {
      const otherId = r.requesterId === userId ? r.recipientId : r.requesterId;
      return { id: r.id, user: userMap[otherId] ?? null, since: r.createdAt };
    });

  const incoming = rows
    .filter(r => r.status === "pending" && r.recipientId === userId)
    .map(r => ({ id: r.id, from: userMap[r.requesterId] ?? null, createdAt: r.createdAt }));

  const outgoing = rows
    .filter(r => r.status === "pending" && r.requesterId === userId)
    .map(r => ({ id: r.id, to: userMap[r.recipientId] ?? null, createdAt: r.createdAt }));

  res.json({ friends, incoming, outgoing });
});

router.post("/friends/request", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { username } = req.body;
  if (!username) { res.status(400).json({ error: "Username required" }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.id === userId) { res.status(400).json({ error: "Cannot add yourself" }); return; }

  const existing = await db.select().from(friendsTable).where(
    or(
      and(eq(friendsTable.requesterId, userId), eq(friendsTable.recipientId, target.id)),
      and(eq(friendsTable.requesterId, target.id), eq(friendsTable.recipientId, userId)),
    )
  ).limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    if (row.status === "accepted") { res.status(400).json({ error: "Already friends" }); return; }
    if (row.status === "pending") { res.status(400).json({ error: "Request already pending" }); return; }
    await db.update(friendsTable).set({ status: "pending", requesterId: userId, recipientId: target.id }).where(eq(friendsTable.id, row.id));
    res.json({ message: `Friend request sent to ${target.username}` });
    return;
  }

  await db.insert(friendsTable).values({ requesterId: userId, recipientId: target.id, status: "pending" });

  const [sender] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  sendPushToUser(target.id, {
    title: "New Friend Request",
    body: `${sender?.username ?? "Someone"} sent you a friend request`,
    url: "/notifications",
    tag: "friend-request",
  }).catch(() => {});

  res.json({ message: `Friend request sent to ${target.username}` });
});

router.post("/friends/:id/accept", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const friendId = parseInt(req.params.id);
  const [row] = await db.select().from(friendsTable).where(
    and(eq(friendsTable.id, friendId), eq(friendsTable.recipientId, userId), eq(friendsTable.status, "pending"))
  ).limit(1);

  if (!row) { res.status(404).json({ error: "Request not found" }); return; }

  await db.update(friendsTable).set({ status: "accepted", updatedAt: new Date() }).where(eq(friendsTable.id, friendId));
  res.json({ message: "Friend request accepted" });
});

router.post("/friends/:id/decline", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const friendId = parseInt(req.params.id);
  const [row] = await db.select().from(friendsTable).where(
    and(eq(friendsTable.id, friendId), eq(friendsTable.status, "pending"),
      or(eq(friendsTable.recipientId, userId), eq(friendsTable.requesterId, userId))
    )
  ).limit(1);

  if (!row) { res.status(404).json({ error: "Request not found" }); return; }

  await db.delete(friendsTable).where(eq(friendsTable.id, friendId));
  res.json({ message: "Request removed" });
});

router.delete("/friends/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const friendId = parseInt(req.params.id);
  const [row] = await db.select().from(friendsTable).where(
    and(eq(friendsTable.id, friendId),
      or(eq(friendsTable.requesterId, userId), eq(friendsTable.recipientId, userId))
    )
  ).limit(1);

  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(friendsTable).where(eq(friendsTable.id, friendId));
  res.json({ message: "Friend removed" });
});

export default router;
