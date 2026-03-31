import { Server, Socket } from "socket.io";
import { db, pool, usersTable, matchesTable, matchPlayersTable, matchRoundsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { playWarRound } from "./games/war";
import { playHighLowRound, type HighLowGuess } from "./games/highlow";
import { trackGameProgress } from "../lib/progress";
import { logger } from "../lib/logger";

interface QueueEntry {
  userId: number;
  username: string;
  socketId: string;
  gameType: string;
  queuedAt: number;
}

interface PendingMatch {
  matchId: number;
  gameType: string;
  player1: { userId: number; username: string; socketId: string };
  player2: { userId: number; username: string; socketId: string };
  bets: Record<number, number>;
  accepted: Set<number>;
  acceptTimeout: NodeJS.Timeout;
}

interface ActiveMatch {
  matchId: number;
  gameType: string;
  players: [{ userId: number; username: string; socketId: string }, { userId: number; username: string; socketId: string }];
  finalBet: number;
  currentRound: number;
  totalRounds: number;
  scores: Record<number, number>;
  roundInProgress: boolean;
  hlGuesses: Record<number, HighLowGuess>;
  hlFirstRoll: number | null;
}

const queue: Map<string, QueueEntry> = new Map();
const pendingMatches: Map<number, PendingMatch> = new Map();
const activeMatches: Map<number, ActiveMatch> = new Map();
const userToMatch: Map<number, number> = new Map();

export function setupMatchmaking(io: Server) {
  io.on("connection", (socket: Socket) => {
    const userId = (socket.handshake.auth as any).userId as number | undefined;
    if (!userId) { socket.disconnect(); return; }

    socket.data.userId = userId;

    socket.on("queue:join", async ({ gameType }: { gameType: string }) => {
      if (!["war", "highlow"].includes(gameType)) return;
      if (userToMatch.has(userId)) {
        socket.emit("error", { message: "You are already in a match" });
        return;
      }

      const [user] = await db.select({ username: usersTable.username, balance: usersTable.balance })
        .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (!user) return;

      const existing = queue.get(`${userId}`);
      if (existing) {
        socket.emit("queue:status", { queued: true, gameType: existing.gameType });
        return;
      }

      queue.set(`${userId}`, { userId, username: user.username, socketId: socket.id, gameType, queuedAt: Date.now() });
      socket.emit("queue:status", { queued: true, gameType });

      tryMatchmake(io, gameType);
    });

    socket.on("queue:leave", () => {
      queue.delete(`${userId}`);
      socket.emit("queue:status", { queued: false });
    });

    socket.on("match:bet", async ({ matchId, betAmount }: { matchId: number; betAmount: number }) => {
      const pending = pendingMatches.get(matchId);
      if (!pending) return;
      if (pending.player1.userId !== userId && pending.player2.userId !== userId) return;
      const bet = Math.max(0.01, parseFloat(betAmount.toString()) || 0);
      pending.bets[userId] = bet;
      socket.emit("match:bet_confirmed", { betAmount: bet });

      if (Object.keys(pending.bets).length === 2) {
        io.to(pending.player1.socketId).emit("match:both_bet");
        io.to(pending.player2.socketId).emit("match:both_bet");
      }
    });

    socket.on("match:accept", async ({ matchId }: { matchId: number }) => {
      const pending = pendingMatches.get(matchId);
      if (!pending) return;
      if (pending.player1.userId !== userId && pending.player2.userId !== userId) return;
      pending.accepted.add(userId);
      if (pending.accepted.size === 2) {
        clearTimeout(pending.acceptTimeout);
        await startMatch(io, pending);
      }
    });

    socket.on("match:action", async (data: { matchId: number; action: string; payload?: any }) => {
      const { matchId, action, payload } = data;
      const match = activeMatches.get(matchId);
      if (!match) return;
      if (!match.players.find(p => p.userId === userId)) return;

      if (match.gameType === "war" && action === "draw") {
        await playWarRoundInMatch(io, match);
      } else if (match.gameType === "highlow" && action === "reveal") {
        await revealHighLowRoll(io, match);
      } else if (match.gameType === "highlow" && action === "guess") {
        const guess = payload?.guess as HighLowGuess;
        if (!["higher", "lower"].includes(guess)) return;
        match.hlGuesses[userId] = guess;
        if (Object.keys(match.hlGuesses).length === 2) {
          await playHighLowRoundInMatch(io, match);
        } else {
          socket.emit("highlow:waiting_guess");
        }
      }
    });

    socket.on("match:forfeit", async ({ matchId }: { matchId: number }) => {
      const match = activeMatches.get(matchId);
      if (!match) return;
      const opponent = match.players.find(p => p.userId !== userId);
      if (!opponent) return;
      await finalizeMatch(io, match, opponent.userId, "forfeit");
    });

    socket.on("disconnect", () => {
      queue.delete(`${userId}`);
      const matchId = userToMatch.get(userId);
      if (matchId) {
        const match = activeMatches.get(matchId);
        if (match) {
          const opponent = match.players.find(p => p.userId !== userId);
          if (opponent) {
            setTimeout(() => {
              const stillActive = activeMatches.get(matchId);
              if (stillActive) finalizeMatch(io, stillActive, opponent.userId, "disconnect");
            }, 30000);
          }
        }
      }
    });
  });
}

function tryMatchmake(io: Server, gameType: string) {
  const waiting = [...queue.values()].filter(e => e.gameType === gameType);
  if (waiting.length < 2) return;

  const [p1, p2] = waiting;
  queue.delete(`${p1.userId}`);
  queue.delete(`${p2.userId}`);

  createPendingMatch(io, gameType, p1, p2);
}

async function createPendingMatch(
  io: Server,
  gameType: string,
  p1: QueueEntry,
  p2: QueueEntry
) {
  const [match] = await db.insert(matchesTable).values({ gameType, status: "pending" }).returning();

  const pending: PendingMatch = {
    matchId: match.id,
    gameType,
    player1: { userId: p1.userId, username: p1.username, socketId: p1.socketId },
    player2: { userId: p2.userId, username: p2.username, socketId: p2.socketId },
    bets: {},
    accepted: new Set(),
    acceptTimeout: setTimeout(async () => {
      const p = pendingMatches.get(match.id);
      if (p) await startMatch(io, p);
    }, 10000),
  };

  pendingMatches.set(match.id, pending);

  const payload = {
    matchId: match.id,
    gameType,
    opponent: { userId: p2.userId, username: p2.username },
    timeoutSeconds: 10,
  };

  io.to(p1.socketId).emit("match:found", { ...payload, opponent: { userId: p2.userId, username: p2.username } });
  io.to(p2.socketId).emit("match:found", { ...payload, opponent: { userId: p1.userId, username: p1.username } });
}

async function startMatch(io: Server, pending: PendingMatch) {
  pendingMatches.delete(pending.matchId);

  const p1Bet = pending.bets[pending.player1.userId] ?? 100;
  const p2Bet = pending.bets[pending.player2.userId] ?? 100;

  const [p1User] = await db.select({ balance: usersTable.balance }).from(usersTable)
    .where(eq(usersTable.id, pending.player1.userId)).limit(1);
  const [p2User] = await db.select({ balance: usersTable.balance }).from(usersTable)
    .where(eq(usersTable.id, pending.player2.userId)).limit(1);

  const p1Balance = parseFloat(p1User?.balance ?? "0");
  const p2Balance = parseFloat(p2User?.balance ?? "0");

  const avgBet = (p1Bet + p2Bet) / 2;
  const finalBet = Math.min(avgBet, p1Balance, p2Balance, Math.max(p1Balance, p2Balance));
  const clampedBet = Math.max(0.01, Math.min(finalBet, Math.min(p1Balance, p2Balance)));

  await Promise.all([
    db.insert(matchPlayersTable).values({ matchId: pending.matchId, userId: pending.player1.userId, betAmount: clampedBet.toFixed(2), accepted: true }),
    db.insert(matchPlayersTable).values({ matchId: pending.matchId, userId: pending.player2.userId, betAmount: clampedBet.toFixed(2), accepted: true }),
    db.update(matchesTable).set({ status: "active", startedAt: new Date(), finalBet: clampedBet.toFixed(2) })
      .where(eq(matchesTable.id, pending.matchId)),
  ]);

  const active: ActiveMatch = {
    matchId: pending.matchId,
    gameType: pending.gameType,
    players: [pending.player1, pending.player2],
    finalBet: clampedBet,
    currentRound: 0,
    totalRounds: 3,
    scores: { [pending.player1.userId]: 0, [pending.player2.userId]: 0 },
    roundInProgress: false,
    hlGuesses: {},
    hlFirstRoll: null,
  };

  activeMatches.set(pending.matchId, active);
  userToMatch.set(pending.player1.userId, pending.matchId);
  userToMatch.set(pending.player2.userId, pending.matchId);

  const startPayload = {
    matchId: pending.matchId,
    gameType: pending.gameType,
    finalBet: clampedBet,
    totalRounds: 3,
    scores: active.scores,
  };

  io.to(pending.player1.socketId).emit("match:start", {
    ...startPayload,
    opponent: { userId: pending.player2.userId, username: pending.player2.username },
  });
  io.to(pending.player2.socketId).emit("match:start", {
    ...startPayload,
    opponent: { userId: pending.player1.userId, username: pending.player1.username },
  });
}

async function playWarRoundInMatch(io: Server, match: ActiveMatch) {
  if (match.roundInProgress) return;
  match.roundInProgress = true;
  match.currentRound++;

  const [p1, p2] = match.players;
  const result = playWarRound(p1.userId, p2.userId);

  if (result.winnerId) match.scores[result.winnerId]++;

  await db.insert(matchRoundsTable).values({
    matchId: match.matchId,
    roundNumber: match.currentRound,
    gameData: result as any,
    winnerId: result.winnerId,
  });

  const roundPayload = {
    round: match.currentRound,
    total: match.totalRounds,
    result,
    scores: match.scores,
  };

  for (const p of match.players) io.to(p.socketId).emit("match:round", roundPayload);

  match.roundInProgress = false;

  if (match.currentRound >= match.totalRounds) {
    const [winner] = Object.entries(match.scores).sort((a, b) => b[1] - a[1]);
    const winnerId = match.scores[p1.userId] !== match.scores[p2.userId]
      ? parseInt(winner[0]) : null;
    await finalizeMatch(io, match, winnerId, "normal");
  }
}

async function revealHighLowRoll(io: Server, match: ActiveMatch) {
  if (match.roundInProgress) return;
  match.roundInProgress = true;
  match.hlFirstRoll = Math.floor(Math.random() * 6) + 1;
  match.hlGuesses = {};
  for (const p of match.players) {
    io.to(p.socketId).emit("highlow:first_roll", { roll: match.hlFirstRoll, round: match.currentRound + 1 });
  }
}

async function playHighLowRoundInMatch(io: Server, match: ActiveMatch) {
  if (!match.hlFirstRoll) return;
  match.currentRound++;
  const [p1, p2] = match.players;

  const p1Guess = match.hlGuesses[p1.userId];
  const p2Guess = match.hlGuesses[p2.userId];

  const secondRoll = Math.floor(Math.random() * 6) + 1;
  let actual: "higher" | "lower" | "same";
  if (secondRoll > match.hlFirstRoll) actual = "higher";
  else if (secondRoll < match.hlFirstRoll) actual = "lower";
  else actual = "same";

  const p1Correct = actual !== "same" && p1Guess === actual;
  const p2Correct = actual !== "same" && p2Guess === actual;

  let winnerId: number | null = null;
  if (p1Correct && !p2Correct) { winnerId = p1.userId; match.scores[p1.userId]++; }
  else if (p2Correct && !p1Correct) { winnerId = p2.userId; match.scores[p2.userId]++; }

  const result = { firstRoll: match.hlFirstRoll, secondRoll, p1Guess, p2Guess, actual, winnerId };

  await db.insert(matchRoundsTable).values({
    matchId: match.matchId,
    roundNumber: match.currentRound,
    gameData: result as any,
    winnerId,
  });

  const roundPayload = { round: match.currentRound, total: match.totalRounds, result, scores: match.scores };
  for (const p of match.players) io.to(p.socketId).emit("match:round", roundPayload);

  match.hlFirstRoll = null;
  match.hlGuesses = {};
  match.roundInProgress = false;

  if (match.currentRound >= match.totalRounds) {
    const overallWinnerId = match.scores[p1.userId] !== match.scores[p2.userId]
      ? (match.scores[p1.userId] > match.scores[p2.userId] ? p1.userId : p2.userId) : null;
    await finalizeMatch(io, match, overallWinnerId, "normal");
  }
}

async function finalizeMatch(io: Server, match: ActiveMatch, winnerId: number | null, reason: string) {
  activeMatches.delete(match.matchId);
  for (const p of match.players) userToMatch.delete(p.userId);

  await db.update(matchesTable).set({
    status: "completed",
    winnerId: winnerId ?? undefined,
    completedAt: new Date(),
  }).where(eq(matchesTable.id, match.matchId));

  if (winnerId && match.finalBet > 0) {
    const loserId = match.players.find(p => p.userId !== winnerId)!.userId;
    await pool.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [match.finalBet, winnerId]);
    await pool.query(`UPDATE users SET balance = GREATEST(0, balance - $1) WHERE id = $2`, [match.finalBet, loserId]);
  }

  const payload = { matchId: match.matchId, winnerId, reason, scores: match.scores, finalBet: match.finalBet };
  for (const p of match.players) {
    const youWon = p.userId === winnerId;
    io.to(p.socketId).emit("match:end", { ...payload, youWon });
    trackGameProgress({ userId: p.userId, gameType: match.gameType, betAmount: match.finalBet, won: youWon, lostAmount: youWon ? 0 : match.finalBet });
  }

  logger.info({ matchId: match.matchId, winnerId, reason }, "Match finalized");
}
