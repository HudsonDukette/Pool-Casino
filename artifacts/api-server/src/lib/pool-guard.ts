import { db, settingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendPushToUser } from "./push";

async function upsertSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
}

export async function isPoolPaused(): Promise<boolean> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "pool_paused"))
    .limit(1);
  return row?.value === "true";
}

export async function lockPool(): Promise<void> {
  await upsertSetting("pool_paused", "true");
  const admins = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.isAdmin, true));
  await Promise.allSettled(
    admins.map((a) =>
      sendPushToUser(a.id, {
        title: "⚠️ Pool Empty — Games Paused",
        body: "The global prize pool has been emptied by a large win. All house games are paused until the pool is refilled by an admin.",
      })
    )
  );
}

export async function unlockPool(): Promise<void> {
  await upsertSetting("pool_paused", "false");
}

export async function checkAndLockIfEmpty(poolAfter: number): Promise<void> {
  if (poolAfter <= 0) {
    await lockPool();
  }
}
