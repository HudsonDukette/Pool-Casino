import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { eq, and, sql, lt } from "drizzle-orm";
import { setupMatchmaking } from "./multiplayer/matchmaking";
import { seedBadgesAndChallenges } from "./lib/seed";
import { scheduleTax } from "./lib/tax-scheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function cleanupStaleGuests() {
  try {
    const deleted = await db
      .delete(usersTable)
      .where(
        and(
          eq(usersTable.isGuest, true),
          lt(
            sql`COALESCE(${usersTable.lastBetAt}, ${usersTable.createdAt})`,
            sql`NOW() - INTERVAL '7 days'`
          )
        )
      )
      .returning({ id: usersTable.id });
    if (deleted.length > 0) {
      logger.info({ count: deleted.length }, "Auto-deleted stale guest accounts");
    }
  } catch (err) {
    logger.error({ err }, "Failed to clean up stale guest accounts");
  }
}

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  path: "/api/socket.io",
  cors: { origin: true, credentials: true },
  transports: ["websocket", "polling"],
});

setupMatchmaking(io);

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
  seedBadgesAndChallenges();
  cleanupStaleGuests();
  setInterval(cleanupStaleGuests, 24 * 60 * 60 * 1000);
  scheduleTax();
});
