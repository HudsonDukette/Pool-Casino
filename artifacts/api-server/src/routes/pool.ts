import { Router, type IRouter } from "express";
import { db, poolTable, betsTable, usersTable, settingsTable } from "@workspace/db";
import { desc, gte, eq } from "drizzle-orm";
import { GetPoolResponse } from "@workspace/api-zod";
import { isPoolPaused } from "../lib/pool-guard";

const router: IRouter = Router();

router.get("/pool", async (req, res): Promise<void> => {
  let [pool] = await db.select().from(poolTable).limit(1);

  if (!pool) {
    [pool] = await db.insert(poolTable).values({}).returning();
  }

  const recentBigBets = await db
    .select({
      betAmount: betsTable.betAmount,
      gameType: betsTable.gameType,
      result: betsTable.result,
      payout: betsTable.payout,
      timestamp: betsTable.timestamp,
      username: usersTable.username,
    })
    .from(betsTable)
    .innerJoin(usersTable, eq(betsTable.userId, usersTable.id))
    .where(gte(betsTable.betAmount, "10"))
    .orderBy(desc(betsTable.timestamp))
    .limit(10);

  const totalAmount = parseFloat(pool.totalAmount);
  const maxBet = totalAmount;
  const poolPaused = await isPoolPaused();

  const [forceReloadRow] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "force_reload_at"))
    .limit(1);
  const forceReloadAt = forceReloadRow ? parseFloat(forceReloadRow.value) : 0;

  const [disabledGamesRow] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "disabled_games"))
    .limit(1);
  const disabledGames: string[] = disabledGamesRow ? JSON.parse(disabledGamesRow.value) : [];

  res.json(
    GetPoolResponse.parse({
      totalAmount,
      biggestWin: parseFloat(pool.biggestWin),
      biggestBet: parseFloat(pool.biggestBet),
      maxBet,
      poolPaused,
      forceReloadAt,
      disabledGames,
      recentBigBets: recentBigBets.map((b) => ({
        username: b.username,
        betAmount: parseFloat(b.betAmount),
        gameType: b.gameType,
        result: b.result,
        payout: parseFloat(b.payout),
        timestamp: b.timestamp.toISOString(),
      })),
    }),
  );
});

export default router;
