import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { eq, and, sql, lt } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  cleanupStaleGuests();
  setInterval(cleanupStaleGuests, 24 * 60 * 60 * 1000);
});
