import { Router, type IRouter } from "express";
import { db, usersTable, chatRoomsTable, chatMessagesTable, chatRoomMembersTable, friendsTable } from "@workspace/db";
import { eq, and, or, desc, gt, inArray, sql } from "drizzle-orm";

const router: IRouter = Router();

const GENERAL_ROOM_ID = 1;
const MAX_MESSAGE_LENGTH = 500;

function requireAuth(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return null; }
  return userId;
}

async function ensureGeneralRoom() {
  const [existing] = await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, GENERAL_ROOM_ID)).limit(1);
  if (!existing) {
    await db.insert(chatRoomsTable).values({ id: GENERAL_ROOM_ID, name: "General", type: "general", createdBy: null } as any);
  }
}

async function ensureMember(userId: number, roomId: number) {
  const [existing] = await db.select().from(chatRoomMembersTable)
    .where(and(eq(chatRoomMembersTable.userId, userId), eq(chatRoomMembersTable.roomId, roomId))).limit(1);
  if (!existing) {
    await db.insert(chatRoomMembersTable).values({ userId, roomId, lastReadAt: new Date() });
  }
}

router.get("/chat/rooms", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  await ensureGeneralRoom();
  await ensureMember(userId, GENERAL_ROOM_ID);

  const memberships = await db.select({ roomId: chatRoomMembersTable.roomId, lastReadAt: chatRoomMembersTable.lastReadAt })
    .from(chatRoomMembersTable)
    .where(eq(chatRoomMembersTable.userId, userId));

  const roomIds = memberships.map(m => m.roomId);
  if (roomIds.length === 0) { res.json({ rooms: [] }); return; }

  const rooms = await db.select().from(chatRoomsTable).where(inArray(chatRoomsTable.id, roomIds));

  const lastReadMap = Object.fromEntries(memberships.map(m => [m.roomId, m.lastReadAt]));

  const roomsWithMeta = await Promise.all(rooms.map(async (room) => {
    const [lastMsg] = await db
      .select({ id: chatMessagesTable.id, content: chatMessagesTable.content, createdAt: chatMessagesTable.createdAt, userId: chatMessagesTable.userId })
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.roomId, room.id))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(1);

    const unreadCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatMessagesTable)
      .where(and(
        eq(chatMessagesTable.roomId, room.id),
        gt(chatMessagesTable.createdAt, lastReadMap[room.id] ?? new Date(0))
      ));

    let otherUser = null;
    if (room.type === "dm") {
      const members = await db.select({ userId: chatRoomMembersTable.userId })
        .from(chatRoomMembersTable)
        .where(and(eq(chatRoomMembersTable.roomId, room.id)));
      const otherId = members.find(m => m.userId !== userId)?.userId;
      if (otherId) {
        const [u] = await db.select({ id: usersTable.id, username: usersTable.username, avatarUrl: usersTable.avatarUrl })
          .from(usersTable).where(eq(usersTable.id, otherId)).limit(1);
        otherUser = u ?? null;
      }
    }

    return {
      ...room,
      lastMessage: lastMsg ?? null,
      unreadCount: unreadCount[0]?.count ?? 0,
      otherUser,
    };
  }));

  res.json({ rooms: roomsWithMeta });
});

router.get("/chat/rooms/public", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const rooms = await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.type, "public"));
  res.json({ rooms });
});

router.post("/chat/rooms/:id/invite/:targetUserId", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const roomId = parseInt(req.params.id);
  const targetId = parseInt(req.params.targetUserId);

  const [membership] = await db.select().from(chatRoomMembersTable)
    .where(and(eq(chatRoomMembersTable.roomId, roomId), eq(chatRoomMembersTable.userId, userId))).limit(1);
  if (!membership) { res.status(403).json({ error: "You are not a member of this room" }); return; }

  const [targetUser] = await db.select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!targetUser) { res.status(404).json({ error: "User not found" }); return; }

  await ensureMember(targetId, roomId);
  res.json({ message: `${targetUser.username} invited to the room` });
});

router.post("/chat/rooms", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { name, isPrivate } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Room name required" }); return; }
  if (name.trim().length > 50) { res.status(400).json({ error: "Room name too long" }); return; }

  const roomType = isPrivate ? "private" : "public";
  const [room] = await db.insert(chatRoomsTable).values({ name: name.trim(), type: roomType, createdBy: userId }).returning();
  await db.insert(chatRoomMembersTable).values({ roomId: room.id, userId, lastReadAt: new Date() });

  res.json({ room });
});

router.post("/chat/rooms/:id/join", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const roomId = parseInt(req.params.id);
  const [room] = await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId)).limit(1);
  if (!room || room.type === "dm" || room.type === "private") { res.status(403).json({ error: "This room is invite only" }); return; }

  await ensureMember(userId, roomId);
  res.json({ message: "Joined" });
});

router.post("/chat/rooms/:id/leave", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const roomId = parseInt(req.params.id);
  if (roomId === GENERAL_ROOM_ID) { res.status(400).json({ error: "Cannot leave General" }); return; }

  await db.delete(chatRoomMembersTable).where(
    and(eq(chatRoomMembersTable.roomId, roomId), eq(chatRoomMembersTable.userId, userId))
  );
  res.json({ message: "Left room" });
});

router.get("/chat/rooms/:id/messages", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const roomId = parseInt(req.params.id);
  const limit = Math.min(parseInt((req.query.limit as string) ?? "50"), 100);
  const before = req.query.before as string | undefined;

  const [membership] = await db.select().from(chatRoomMembersTable)
    .where(and(eq(chatRoomMembersTable.roomId, roomId), eq(chatRoomMembersTable.userId, userId))).limit(1);
  if (!membership) { res.status(403).json({ error: "Not a member" }); return; }

  const msgs = await db
    .select({
      id: chatMessagesTable.id,
      content: chatMessagesTable.content,
      createdAt: chatMessagesTable.createdAt,
      isAdminBroadcast: chatMessagesTable.isAdminBroadcast,
      userId: chatMessagesTable.userId,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(chatMessagesTable)
    .leftJoin(usersTable, eq(chatMessagesTable.userId, usersTable.id))
    .where(
      before
        ? and(eq(chatMessagesTable.roomId, roomId), sql`${chatMessagesTable.id} < ${parseInt(before)}`)
        : eq(chatMessagesTable.roomId, roomId)
    )
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(limit);

  res.json({ messages: msgs.reverse() });
});

router.post("/chat/rooms/:id/messages", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const roomId = parseInt(req.params.id);
  const content = (req.body.content ?? "").trim();
  if (!content) { res.status(400).json({ error: "Message cannot be empty" }); return; }
  if (content.length > MAX_MESSAGE_LENGTH) { res.status(400).json({ error: "Message too long" }); return; }

  const [membership] = await db.select().from(chatRoomMembersTable)
    .where(and(eq(chatRoomMembersTable.roomId, roomId), eq(chatRoomMembersTable.userId, userId))).limit(1);
  if (!membership) { res.status(403).json({ error: "Not a member" }); return; }

  const [msg] = await db.insert(chatMessagesTable).values({ roomId, userId, content }).returning();

  await db.update(chatRoomMembersTable)
    .set({ lastReadAt: new Date() })
    .where(and(eq(chatRoomMembersTable.roomId, roomId), eq(chatRoomMembersTable.userId, userId)));

  const [user] = await db.select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  res.json({ message: { ...msg, username: user?.username, avatarUrl: user?.avatarUrl } });
});

router.post("/chat/rooms/:id/read", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const roomId = parseInt(req.params.id);
  await db.update(chatRoomMembersTable)
    .set({ lastReadAt: new Date() })
    .where(and(eq(chatRoomMembersTable.roomId, roomId), eq(chatRoomMembersTable.userId, userId)));

  res.json({ ok: true });
});

router.post("/chat/dm/:friendId", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const friendId = parseInt(req.params.friendId);

  const [friendship] = await db.select().from(friendsTable).where(
    and(eq(friendsTable.status, "accepted"),
      or(
        and(eq(friendsTable.requesterId, userId), eq(friendsTable.recipientId, friendId)),
        and(eq(friendsTable.requesterId, friendId), eq(friendsTable.recipientId, userId)),
      )
    )
  ).limit(1);

  if (!friendship) { res.status(403).json({ error: "Not friends" }); return; }

  const allDms = await db
    .select({ roomId: chatRoomMembersTable.roomId })
    .from(chatRoomMembersTable)
    .where(and(eq(chatRoomMembersTable.userId, userId)));

  for (const { roomId } of allDms) {
    const [room] = await db.select().from(chatRoomsTable).where(and(eq(chatRoomsTable.id, roomId), eq(chatRoomsTable.type, "dm"))).limit(1);
    if (!room) continue;
    const members = await db.select({ userId: chatRoomMembersTable.userId }).from(chatRoomMembersTable).where(eq(chatRoomMembersTable.roomId, roomId));
    if (members.length === 2 && members.some(m => m.userId === friendId)) {
      res.json({ roomId });
      return;
    }
  }

  const [friend] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, friendId)).limit(1);
  const [me] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const [room] = await db.insert(chatRoomsTable).values({ name: `${me.username} & ${friend.username}`, type: "dm", createdBy: userId }).returning();
  await db.insert(chatRoomMembersTable).values([
    { roomId: room.id, userId, lastReadAt: new Date() },
    { roomId: room.id, userId: friendId, lastReadAt: new Date() },
  ]);

  res.json({ roomId: room.id });
});

router.post("/chat/group", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { name, memberIds } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Group name required" }); return; }
  if (!Array.isArray(memberIds) || memberIds.length === 0) { res.status(400).json({ error: "Select at least one member" }); return; }

  const allIds: number[] = [userId, ...memberIds.map(Number)];

  const [room] = await db.insert(chatRoomsTable).values({ name: name.trim(), type: "group", createdBy: userId }).returning();
  await db.insert(chatRoomMembersTable).values(allIds.map(id => ({ roomId: room.id, userId: id, lastReadAt: new Date() })));

  res.json({ roomId: room.id });
});

router.get("/chat/unread", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const memberships = await db.select({ roomId: chatRoomMembersTable.roomId, lastReadAt: chatRoomMembersTable.lastReadAt })
    .from(chatRoomMembersTable).where(eq(chatRoomMembersTable.userId, userId));

  let total = 0;
  for (const m of memberships) {
    const [r] = await db.select({ count: sql<number>`count(*)::int` })
      .from(chatMessagesTable)
      .where(and(eq(chatMessagesTable.roomId, m.roomId), gt(chatMessagesTable.createdAt, m.lastReadAt)));
    total += r?.count ?? 0;
  }

  res.json({ unreadCount: total });
});

export default router;
