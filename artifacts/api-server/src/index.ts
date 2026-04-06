import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { eq, and, sql, lt } from "drizzle-orm";
import { setupMatchmaking } from "./multiplayer/matchmaking";
import { seedBadgesAndChallenges } from "./lib/seed";
import { scheduleTax } from "./lib/tax-scheduler";
import { startWatchdog } from "./lib/watchdog";

const port = Number(process.env["PORT"] ?? 3000);

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

const allowedOrigin = process.env.ALLOWED_ORIGIN;
const io = new SocketIOServer(httpServer, {
  path: "/api/socket.io",
  cors: {
    origin: allowedOrigin
      ? [allowedOrigin, /\.replit\.dev$/, /\.repl\.co$/, /\.vercel\.app$/]
      : true,
    credentials: true,
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
});

setupMatchmaking(io);

httpServer.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "Server listening");
  const hasDb = !!(process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL);
  if (hasDb) {
    seedBadgesAndChallenges();
    cleanupStaleGuests();
    setInterval(cleanupStaleGuests, 24 * 60 * 60 * 1000);
    scheduleTax();
  } else {
    logger.warn("No DATABASE_URL set — skipping seeding and scheduled tasks");
  }
  startWatchdog();
});
