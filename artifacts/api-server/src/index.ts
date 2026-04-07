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

const port = Number(process.env.PORT ?? 3000);

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
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  connectTimeout: 45000,
});

setupMatchmaking(io);

httpServer.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "Server listening");
  seedBadgesAndChallenges();
  cleanupStaleGuests();
  setInterval(cleanupStaleGuests, 24 * 60 * 60 * 1000);
  scheduleTax();
  startWatchdog();
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, closing server");
  io.close(() => {
    logger.info("Socket.IO closed");
  });
  httpServer.close(() => {
    logger.info("HTTP server closed, process exiting");
    process.exit(0);
  });
  // Force exit after 10 seconds if graceful shutdown stalls
  setTimeout(() => {
    logger.warn("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  gracefulShutdown("uncaughtException");
});
