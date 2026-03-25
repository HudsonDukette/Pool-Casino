import { Router, type IRouter } from "express";
import { db, usersTable, betsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  GetRichestPlayersResponse,
  GetBiggestWinnersResponse,
  GetBiggestBettorsResponse,
  GetRecentBigWinsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/leaderboard/richest", async (_req, res): Promise<void> => {
  const users = await db
    .select({
      username: usersTable.username,
      balance: usersTable.balance,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.balance))
    .limit(20);

  res.json(
    GetRichestPlayersResponse.parse({
      entries: users.map((u, i) => ({
        rank: i + 1,
        username: u.username,
        value: parseFloat(u.balance),
        label: `$${parseFloat(u.balance).toFixed(2)}`,
      })),
    }),
  );
});

router.get("/leaderboard/biggest-winners", async (_req, res): Promise<void> => {
  const users = await db
    .select({
      username: usersTable.username,
      biggestWin: usersTable.biggestWin,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.biggestWin))
    .limit(20);

  res.json(
    GetBiggestWinnersResponse.parse({
      entries: users.map((u, i) => ({
        rank: i + 1,
        username: u.username,
        value: parseFloat(u.biggestWin),
        label: `$${parseFloat(u.biggestWin).toFixed(2)}`,
      })),
    }),
  );
});

router.get("/leaderboard/biggest-bettors", async (_req, res): Promise<void> => {
  const users = await db
    .select({
      username: usersTable.username,
      biggestBet: usersTable.biggestBet,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.biggestBet))
    .limit(20);

  res.json(
    GetBiggestBettorsResponse.parse({
      entries: users.map((u, i) => ({
        rank: i + 1,
        username: u.username,
        value: parseFloat(u.biggestBet),
        label: `$${parseFloat(u.biggestBet).toFixed(2)}`,
      })),
    }),
  );
});

router.get("/leaderboard/recent-big-wins", async (_req, res): Promise<void> => {
  const wins = await db
    .select({
      username: usersTable.username,
      payout: betsTable.payout,
      betAmount: betsTable.betAmount,
      gameType: betsTable.gameType,
      multiplier: betsTable.multiplier,
      timestamp: betsTable.timestamp,
    })
    .from(betsTable)
    .innerJoin(usersTable, eq(betsTable.userId, usersTable.id))
    .where(eq(betsTable.result, "win"))
    .orderBy(desc(betsTable.payout))
    .limit(15);

  res.json(
    GetRecentBigWinsResponse.parse({
      wins: wins.map((w) => ({
        username: w.username,
        payout: parseFloat(w.payout),
        betAmount: parseFloat(w.betAmount),
        gameType: w.gameType,
        multiplier: w.multiplier ? parseFloat(w.multiplier) : null,
        timestamp: w.timestamp.toISOString(),
      })),
    }),
  );
});

export default router;
