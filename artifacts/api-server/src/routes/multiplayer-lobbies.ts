import { Router, type IRouter } from "express";
import { db, usersTable, poolTable, betsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { isPoolPaused } from "../lib/pool-guard";
import { trackGameProgress } from "../lib/progress";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function auth(req: any, res: any): number | null {
  const id = req.session?.userId;
  if (!id) { res.status(401).json({ error: "Not authenticated" }); return null; }
  return id;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function loadCtx(userId: number) {
  const [[user], poolRows] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(poolTable).limit(1),
  ]);
  let pool = poolRows[0];
  if (!pool) [pool] = await db.insert(poolTable).values({}).returning();
  return { user: user!, pool };
}

async function settleMpPlayer(
  userId: number,
  gameType: string,
  betAmount: number,
  multiplier: number
): Promise<{ newBalance: number }> {
  const { user, pool } = await loadCtx(userId);
  const poolAmount = parseFloat(pool.totalAmount);
  const uncappedPayout = parseFloat((betAmount * multiplier).toFixed(2));
  const payout = multiplier > 1 ? Math.min(uncappedPayout, poolAmount) : uncappedPayout;
  const net = payout - betAmount;
  const won = multiplier > 1;
  const xpGain = Math.max(1, Math.floor(betAmount / 100)) + (won ? Math.floor(betAmount / 200) : 0);
  const result = await db.transaction(async (tx) => {
    const [updatedUser] = await tx.update(usersTable)
      .set({
        balance: sql`GREATEST(${usersTable.balance} + ${net.toFixed(2)}, 0)`,
        xp: sql`COALESCE(${usersTable.xp}, 0) + ${xpGain}`,
        level: sql`FLOOR(SQRT((COALESCE(${usersTable.xp}, 0) + ${xpGain})::float / 25))::int + 1`,
      })
      .where(eq(usersTable.id, userId))
      .returning({ balance: usersTable.balance });
    const newPool = Math.max(0, poolAmount - net);
    await tx.update(poolTable).set({ totalAmount: newPool.toFixed(2) }).where(eq(poolTable.id, pool.id));
    await tx.insert(betsTable).values({
      userId, gameType,
      betAmount: betAmount.toFixed(2),
      result: won ? "win" : "loss",
      payout: payout.toFixed(2),
      multiplier: multiplier.toFixed(4),
    });
    return { newBalance: parseFloat(updatedUser?.balance ?? "0") };
  });
  await trackGameProgress(userId, { betAmount, won, profit: net, gameType });
  return result;
}

const LOBBY_TTL_MS = 30 * 60 * 1000;
function purgeLobby(map: Map<string, any>) {
  const now = Date.now();
  for (const [k, v] of map) {
    if (now - v.createdAt > LOBBY_TTL_MS) map.delete(k);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ELIMINATION WHEEL MULTIPLAYER
// ─────────────────────────────────────────────────────────────────────────────

interface ElimPlayer {
  userId: number;
  username: string;
  alive: boolean;
  settled: boolean;
}
interface ElimLobby {
  id: string;
  hostId: number;
  betAmount: number;
  isPublic: boolean;
  status: "waiting" | "playing" | "done";
  players: ElimPlayer[];
  createdAt: number;
  startedAt?: number;
  eliminatedNames: string[];
  winner?: { userId: number; username: string; payout: number; newBalance: number };
  spinReady: boolean;
}
const elimLobbies = new Map<string, ElimLobby>();

// GET /mp/elim/public — list public waiting lobbies
router.get("/mp/elim/public", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  purgeLobby(elimLobbies);
  const list = Array.from(elimLobbies.values())
    .filter(l => l.isPublic && l.status === "waiting" && !l.players.some(p => p.userId === userId))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, 20)
    .map(l => ({ id: l.id, betAmount: l.betAmount, players: l.players.length, maxPlayers: 8, hostName: l.players[0]?.username ?? "?" }));
  return res.json(list);
});

// POST /mp/elim/matchmake — auto join or create a public lobby
router.post("/mp/elim/matchmake", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseFloat(req.body?.betAmount);
  if (isNaN(betAmount) || betAmount < 0.01) return res.status(400).json({ error: "Invalid bet" });
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  purgeLobby(elimLobbies);

  // Find best matching public lobby (same bet, not full, not joined)
  const match = Array.from(elimLobbies.values()).find(l =>
    l.isPublic && l.status === "waiting" &&
    l.betAmount === betAmount &&
    l.players.length < 8 &&
    !l.players.some(p => p.userId === userId)
  );

  if (match) {
    match.players.push({ userId, username: user.username, alive: true, settled: false });
    return res.json({ lobbyId: match.id, joined: true });
  }

  // Create new public lobby
  const id = uid();
  elimLobbies.set(id, {
    id, hostId: userId, betAmount, isPublic: true,
    status: "waiting",
    players: [{ userId, username: user.username, alive: true, settled: false }],
    createdAt: Date.now(), eliminatedNames: [], spinReady: false,
  });
  return res.json({ lobbyId: id, created: true });
});

// POST /mp/elim/create
router.post("/mp/elim/create", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseFloat(req.body?.betAmount);
  if (isNaN(betAmount) || betAmount < 0.01) return res.status(400).json({ error: "Invalid bet" });
  const isPublic = req.body?.isPublic !== false;
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  purgeLobby(elimLobbies);
  const id = uid();
  elimLobbies.set(id, {
    id, hostId: userId, betAmount, isPublic,
    status: "waiting",
    players: [{ userId, username: user.username, alive: true, settled: false }],
    createdAt: Date.now(), eliminatedNames: [], spinReady: false,
  });
  return res.json({ lobbyId: id });
});

// POST /mp/elim/:id/join
router.post("/mp/elim/:id/join", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const lobby = elimLobbies.get(req.params.id);
  if (!lobby) return res.status(404).json({ error: "Lobby not found" });
  if (lobby.status !== "waiting") return res.status(400).json({ error: "Game already started" });
  if (lobby.players.length >= 8) return res.status(400).json({ error: "Lobby full (max 8)" });
  if (lobby.players.some(p => p.userId === userId)) return res.status(400).json({ error: "Already joined" });
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < lobby.betAmount) return res.status(400).json({ error: "Insufficient balance" });
  lobby.players.push({ userId, username: user.username, alive: true, settled: false });
  return res.json({ ok: true, players: lobby.players.length });
});

// POST /mp/elim/:id/start  (host only, min 2 players)
router.post("/mp/elim/:id/start", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const lobby = elimLobbies.get(req.params.id);
  if (!lobby) return res.status(404).json({ error: "Lobby not found" });
  if (lobby.hostId !== userId) return res.status(403).json({ error: "Only the host can start the game" });
  if (lobby.status !== "waiting") return res.status(400).json({ error: "Already started" });
  if (lobby.players.length < 2) return res.status(400).json({ error: "Need at least 2 players" });
  if (await isPoolPaused()) return res.status(503).json({ error: "Pool is paused" });

  for (const p of lobby.players) {
    const { user } = await loadCtx(p.userId);
    if (parseFloat(user.balance) < lobby.betAmount) {
      p.alive = false; p.settled = true;
      lobby.eliminatedNames.push(p.username + " (broke)");
      continue;
    }
    await db.update(usersTable)
      .set({ balance: sql`${usersTable.balance} - ${lobby.betAmount.toFixed(2)}` })
      .where(and(eq(usersTable.id, p.userId), sql`${usersTable.balance} >= ${lobby.betAmount.toFixed(2)}`));
  }
  const eligible = lobby.players.filter(p => p.alive);
  if (eligible.length < 2) {
    elimLobbies.delete(lobby.id);
    return res.status(400).json({ error: "Not enough players can afford the bet" });
  }
  lobby.status = "playing";
  lobby.startedAt = Date.now();
  lobby.spinReady = true;
  return res.json({ ok: true, players: eligible.length });
});

// POST /mp/elim/:id/spin  (host triggers next elimination round)
router.post("/mp/elim/:id/spin", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const lobby = elimLobbies.get(req.params.id);
  if (!lobby) return res.status(404).json({ error: "Lobby not found" });
  if (lobby.hostId !== userId) return res.status(403).json({ error: "Only host can spin" });
  if (lobby.status !== "playing") return res.status(400).json({ error: "Not in playing state" });
  if (!lobby.spinReady) return res.status(400).json({ error: "Already spinning" });

  const alive = lobby.players.filter(p => p.alive);
  if (alive.length <= 1) return res.status(400).json({ error: "Game already over" });

  lobby.spinReady = false;
  const idx = Math.floor(Math.random() * alive.length);
  const eliminated = alive[idx];
  eliminated.alive = false;
  eliminated.settled = true;
  lobby.eliminatedNames.push(eliminated.username);

  const loserCtx = await loadCtx(eliminated.userId);
  const pool = loserCtx.pool;
  await db.update(poolTable).set({ totalAmount: sql`${poolTable.totalAmount} + ${lobby.betAmount.toFixed(2)}` }).where(eq(poolTable.id, pool.id));
  await db.insert(betsTable).values({ userId: eliminated.userId, gameType: "elim-mp", betAmount: lobby.betAmount.toFixed(2), result: "loss", payout: "0.00", multiplier: "0.0000" });
  await trackGameProgress(eliminated.userId, { betAmount: lobby.betAmount, won: false, profit: -lobby.betAmount, gameType: "elim-mp" });

  const stillAlive = lobby.players.filter(p => p.alive);

  if (stillAlive.length === 1) {
    lobby.status = "done";
    const winner = stillAlive[0];
    winner.settled = true;
    const numPlayers = lobby.players.length;
    const winPayout = lobby.betAmount * numPlayers;
    const { user, pool: p2 } = await loadCtx(winner.userId);
    const poolAmt = parseFloat(p2.totalAmount);
    const capped = Math.min(winPayout, poolAmt);
    const net = capped;
    await db.transaction(async (tx) => {
      await tx.update(usersTable).set({ balance: sql`${usersTable.balance} + ${net.toFixed(2)}` }).where(eq(usersTable.id, winner.userId));
      await tx.update(poolTable).set({ totalAmount: sql`${poolTable.totalAmount} - ${net.toFixed(2)}` }).where(eq(poolTable.id, p2.id));
      await tx.insert(betsTable).values({ userId: winner.userId, gameType: "elim-mp", betAmount: lobby.betAmount.toFixed(2), result: "win", payout: capped.toFixed(2), multiplier: numPlayers.toFixed(4) });
    });
    await trackGameProgress(winner.userId, { betAmount: lobby.betAmount, won: true, profit: net - lobby.betAmount, gameType: "elim-mp" });
    const newBalance = parseFloat(user.balance) + net;
    lobby.winner = { userId: winner.userId, username: winner.username, payout: capped, newBalance };
    return res.json({ eliminated: eliminated.username, winner: lobby.winner, done: true });
  }

  lobby.spinReady = true;
  return res.json({ eliminated: eliminated.username, alive: stillAlive.map(p => p.username), done: false });
});

// GET /mp/elim/:id  (lobby state — poll this)
router.get("/mp/elim/:id", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const lobby = elimLobbies.get(req.params.id);
  if (!lobby) return res.status(404).json({ error: "Lobby not found" });
  return res.json({
    id: lobby.id,
    hostId: lobby.hostId,
    betAmount: lobby.betAmount,
    isPublic: lobby.isPublic,
    status: lobby.status,
    spinReady: lobby.spinReady,
    players: lobby.players.map(p => ({ username: p.username, alive: p.alive, isYou: p.userId === userId })),
    eliminatedNames: lobby.eliminatedNames,
    winner: lobby.winner,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VAULT RACE (Timed Safe Multiplayer)
// ─────────────────────────────────────────────────────────────────────────────

interface VaultPlayer {
  userId: number;
  username: string;
  openedAtMs: number | null;
  eliminated: boolean;
  settled: boolean;
}
interface VaultLobby {
  id: string;
  hostId: number;
  betAmount: number;
  isPublic: boolean;
  status: "waiting" | "playing" | "done";
  players: VaultPlayer[];
  createdAt: number;
  startedAt?: number;
  crackAtMs?: number;
  revealedAt?: number;
  winner?: { userId: number; username: string; openedAtSec: number; payout: number; newBalance: number };
  crackAtSec?: number;
}
const vaultLobbies = new Map<string, VaultLobby>();

// GET /mp/vault/public
router.get("/mp/vault/public", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  purgeLobby(vaultLobbies);
  const list = Array.from(vaultLobbies.values())
    .filter(l => l.isPublic && l.status === "waiting" && !l.players.some(p => p.userId === userId))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, 20)
    .map(l => ({ id: l.id, betAmount: l.betAmount, players: l.players.length, maxPlayers: 6, hostName: l.players[0]?.username ?? "?" }));
  return res.json(list);
});

// POST /mp/vault/matchmake
router.post("/mp/vault/matchmake", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseFloat(req.body?.betAmount);
  if (isNaN(betAmount) || betAmount < 0.01) return res.status(400).json({ error: "Invalid bet" });
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  purgeLobby(vaultLobbies);

  const match = Array.from(vaultLobbies.values()).find(l =>
    l.isPublic && l.status === "waiting" &&
    l.betAmount === betAmount &&
    l.players.length < 6 &&
    !l.players.some(p => p.userId === userId)
  );

  if (match) {
    match.players.push({ userId, username: user.username, openedAtMs: null, eliminated: false, settled: false });
    return res.json({ lobbyId: match.id, joined: true });
  }

  const id = uid();
  vaultLobbies.set(id, {
    id, hostId: userId, betAmount, isPublic: true,
    status: "waiting",
    players: [{ userId, username: user.username, openedAtMs: null, eliminated: false, settled: false }],
    createdAt: Date.now(),
  });
  return res.json({ lobbyId: id, created: true });
});

// POST /mp/vault/create
router.post("/mp/vault/create", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseFloat(req.body?.betAmount);
  if (isNaN(betAmount) || betAmount < 0.01) return res.status(400).json({ error: "Invalid bet" });
  const isPublic = req.body?.isPublic !== false;
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  purgeLobby(vaultLobbies);
  const id = uid();
  vaultLobbies.set(id, {
    id, hostId: userId, betAmount, isPublic,
    status: "waiting",
    players: [{ userId, username: user.username, openedAtMs: null, eliminated: false, settled: false }],
    createdAt: Date.now(),
  });
  return res.json({ lobbyId: id });
});

// POST /mp/vault/:id/join
router.post("/mp/vault/:id/join", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const lobby = vaultLobbies.get(req.params.id);
  if (!lobby) return res.status(404).json({ error: "Lobby not found" });
  if (lobby.status !== "waiting") return res.status(400).json({ error: "Game already started" });
  if (lobby.players.length >= 6) return res.status(400).json({ error: "Lobby full (max 6)" });
  if (lobby.players.some(p => p.userId === userId)) return res.status(400).json({ error: "Already joined" });
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < lobby.betAmount) return res.status(400).json({ error: "Insufficient balance" });
  lobby.players.push({ userId, username: user.username, openedAtMs: null, eliminated: false, settled: false });
  return res.json({ ok: true, players: lobby.players.length });
});

// POST /mp/vault/:id/start  (host only)
router.post("/mp/vault/:id/start", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const lobby = vaultLobbies.get(req.params.id);
  if (!lobby) return res.status(404).json({ error: "Lobby not found" });
  if (lobby.hostId !== userId) return res.status(403).json({ error: "Only the host can start the game" });
  if (lobby.status !== "waiting") return res.status(400).json({ error: "Already started" });
  if (lobby.players.length < 2) return res.status(400).json({ error: "Need at least 2 players" });
  if (await isPoolPaused()) return res.status(503).json({ error: "Pool is paused" });

  for (const p of lobby.players) {
    const r = await db.update(usersTable)
      .set({ balance: sql`${usersTable.balance} - ${lobby.betAmount.toFixed(2)}` })
      .where(and(eq(usersTable.id, p.userId), sql`${usersTable.balance} >= ${lobby.betAmount.toFixed(2)}`))
      .returning({ balance: usersTable.balance });
    if (!r.length) { p.eliminated = true; p.settled = true; }
  }

  const active = lobby.players.filter(p => !p.eliminated);
  if (active.length < 2) {
    for (const p of lobby.players.filter(p => !p.eliminated)) {
      await db.update(usersTable).set({ balance: sql`${usersTable.balance} + ${lobby.betAmount.toFixed(2)}` }).where(eq(usersTable.id, p.userId));
    }
    vaultLobbies.delete(lobby.id);
    return res.status(400).json({ error: "Not enough players can afford the bet" });
  }

  lobby.status = "playing";
  lobby.startedAt = Date.now();
  lobby.crackAtMs = (10 + Math.random() * 40) * 1000;

  setTimeout(async () => {
    if (lobby.status !== "playing") return;
    await resolveVaultLobby(lobby.id);
  }, 65000);

  return res.json({ ok: true });
});

// POST /mp/vault/:id/open
router.post("/mp/vault/:id/open", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const lobby = vaultLobbies.get(req.params.id);
  if (!lobby) return res.status(404).json({ error: "Lobby not found" });
  if (lobby.status !== "playing") return res.status(400).json({ error: "Game not in progress" });
  const player = lobby.players.find(p => p.userId === userId);
  if (!player) return res.status(403).json({ error: "Not in this lobby" });
  if (player.openedAtMs !== null) return res.status(400).json({ error: "Already opened" });
  if (player.eliminated) return res.status(400).json({ error: "Already eliminated" });

  const elapsedMs = Date.now() - lobby.startedAt!;
  player.openedAtMs = elapsedMs;
  if (elapsedMs >= lobby.crackAtMs!) {
    player.eliminated = true;
  }

  const activePlayers = lobby.players.filter(p => !p.settled);
  const allOpened = activePlayers.every(p => p.openedAtMs !== null);
  if (allOpened) {
    await resolveVaultLobby(lobby.id);
  }

  return res.json({ ok: true, openedAtSec: elapsedMs / 1000, cracked: elapsedMs >= lobby.crackAtMs! });
});

async function resolveVaultLobby(lobbyId: string) {
  const lobby = vaultLobbies.get(lobbyId);
  if (!lobby || lobby.status !== "playing") return;
  lobby.status = "done";
  lobby.revealedAt = Date.now();
  lobby.crackAtSec = lobby.crackAtMs! / 1000;

  const survived = lobby.players.filter(p => !p.eliminated && p.openedAtMs !== null && p.openedAtMs < lobby.crackAtMs!);
  const losers = lobby.players.filter(p => !survived.includes(p));
  let winnerPlayer: VaultPlayer | null = null;
  if (survived.length > 0) {
    winnerPlayer = survived.reduce((a, b) => (b.openedAtMs! > a.openedAtMs! ? b : a));
  }

  const numPlayers = lobby.players.length;
  const pool = (await db.select().from(poolTable).limit(1))[0];

  for (const p of losers) {
    if (p.settled) continue;
    p.settled = true;
    await db.insert(betsTable).values({ userId: p.userId, gameType: "vault-race", betAmount: lobby.betAmount.toFixed(2), result: "loss", payout: "0.00", multiplier: "0.0000" });
    await db.update(poolTable).set({ totalAmount: sql`${poolTable.totalAmount} + ${lobby.betAmount.toFixed(2)}` }).where(eq(poolTable.id, pool.id));
    await trackGameProgress(p.userId, { betAmount: lobby.betAmount, won: false, profit: -lobby.betAmount, gameType: "vault-race" });
  }

  if (winnerPlayer) {
    winnerPlayer.settled = true;
    const winPayout = lobby.betAmount * numPlayers;
    const poolNow = parseFloat((await db.select().from(poolTable).limit(1))[0]?.totalAmount ?? "0");
    const capped = Math.min(winPayout, poolNow);
    const [upd] = await db.transaction(async (tx) => {
      const r = await tx.update(usersTable).set({ balance: sql`${usersTable.balance} + ${capped.toFixed(2)}` }).where(eq(usersTable.id, winnerPlayer!.userId)).returning({ balance: usersTable.balance });
      await tx.update(poolTable).set({ totalAmount: sql`${poolTable.totalAmount} - ${capped.toFixed(2)}` }).where(eq(poolTable.id, pool.id));
      await tx.insert(betsTable).values({ userId: winnerPlayer!.userId, gameType: "vault-race", betAmount: lobby.betAmount.toFixed(2), result: "win", payout: capped.toFixed(2), multiplier: numPlayers.toFixed(4) });
      return r;
    });
    await trackGameProgress(winnerPlayer.userId, { betAmount: lobby.betAmount, won: true, profit: capped - lobby.betAmount, gameType: "vault-race" });
    lobby.winner = {
      userId: winnerPlayer.userId,
      username: winnerPlayer.username,
      openedAtSec: winnerPlayer.openedAtMs! / 1000,
      payout: capped,
      newBalance: parseFloat(upd?.balance ?? "0"),
    };
  }

  for (const p of survived.filter(s => s !== winnerPlayer)) {
    if (p.settled) continue;
    p.settled = true;
    await db.insert(betsTable).values({ userId: p.userId, gameType: "vault-race", betAmount: lobby.betAmount.toFixed(2), result: "loss", payout: "0.00", multiplier: "0.0000" });
    const poolNow2 = (await db.select().from(poolTable).limit(1))[0];
    await db.update(poolTable).set({ totalAmount: sql`${poolTable.totalAmount} + ${lobby.betAmount.toFixed(2)}` }).where(eq(poolTable.id, poolNow2.id));
    await trackGameProgress(p.userId, { betAmount: lobby.betAmount, won: false, profit: -lobby.betAmount, gameType: "vault-race" });
  }
}

// GET /mp/vault/:id
router.get("/mp/vault/:id", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const lobby = vaultLobbies.get(req.params.id);
  if (!lobby) return res.status(404).json({ error: "Lobby not found" });
  const myPlayer = lobby.players.find(p => p.userId === userId);
  return res.json({
    id: lobby.id,
    hostId: lobby.hostId,
    betAmount: lobby.betAmount,
    isPublic: lobby.isPublic,
    status: lobby.status,
    startedAt: lobby.startedAt,
    crackAtSec: lobby.status === "done" ? lobby.crackAtSec : undefined,
    players: lobby.players.map(p => ({
      username: p.username,
      opened: p.openedAtMs !== null,
      openedAtSec: lobby.status === "done" ? (p.openedAtMs ?? null) / 1000 : (p.openedAtMs !== null ? true : false),
      eliminated: p.eliminated,
      isYou: p.userId === userId,
    })),
    myOpenedAtSec: myPlayer?.openedAtMs != null ? myPlayer.openedAtMs / 1000 : null,
    myEliminated: myPlayer?.eliminated ?? false,
    winner: lobby.winner,
    isHost: lobby.hostId === userId,
    isInLobby: !!myPlayer,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SPEED TEST (Reverse Crash Multiplayer)
// ─────────────────────────────────────────────────────────────────────────────

const SPEED_START_MULT = 3.0;
const SPEED_FALL_RATE = 0.12;

interface SpeedPlayer {
  userId: number;
  username: string;
  lockedMult: number | null;
  settled: boolean;
}
interface SpeedLobby {
  id: string;
  hostId: number;
  betAmount: number;
  isPublic: boolean;
  status: "waiting" | "playing" | "done";
  players: SpeedPlayer[];
  createdAt: number;
  startedAt?: number;
  crashAtMs?: number;
  winner?: { userId: number; username: string; lockedMult: number; payout: number; newBalance: number };
  crashMult?: number;
}
const speedLobbies = new Map<string, SpeedLobby>();

function currentSpeedMult(lobby: SpeedLobby): number {
  if (!lobby.startedAt) return SPEED_START_MULT;
  const elapsed = (Date.now() - lobby.startedAt) / 1000;
  return Math.max(0, SPEED_START_MULT - elapsed * SPEED_FALL_RATE);
}

// GET /mp/speed/public
router.get("/mp/speed/public", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  purgeLobby(speedLobbies);
  const list = Array.from(speedLobbies.values())
    .filter(l => l.isPublic && l.status === "waiting" && !l.players.some(p => p.userId === userId))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, 20)
    .map(l => ({ id: l.id, betAmount: l.betAmount, players: l.players.length, maxPlayers: 6, hostName: l.players[0]?.username ?? "?" }));
  return res.json(list);
});

// POST /mp/speed/matchmake
router.post("/mp/speed/matchmake", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseFloat(req.body?.betAmount);
  if (isNaN(betAmount) || betAmount < 0.01) return res.status(400).json({ error: "Invalid bet" });
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  purgeLobby(speedLobbies);

  const match = Array.from(speedLobbies.values()).find(l =>
    l.isPublic && l.status === "waiting" &&
    l.betAmount === betAmount &&
    l.players.length < 6 &&
    !l.players.some(p => p.userId === userId)
  );

  if (match) {
    match.players.push({ userId, username: user.username, lockedMult: null, settled: false });
    return res.json({ lobbyId: match.id, joined: true });
  }

  const id = uid();
  speedLobbies.set(id, {
    id, hostId: userId, betAmount, isPublic: true,
    status: "waiting",
    players: [{ userId, username: user.username, lockedMult: null, settled: false }],
    createdAt: Date.now(),
  });
  return res.json({ lobbyId: id, created: true });
});

// POST /mp/speed/create
router.post("/mp/speed/create", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseFloat(req.body?.betAmount);
  if (isNaN(betAmount) || betAmount < 0.01) return res.status(400).json({ error: "Invalid bet" });
  const isPublic = req.body?.isPublic !== false;
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  purgeLobby(speedLobbies);
  const id = uid();
  speedLobbies.set(id, {
    id, hostId: userId, betAmount, isPublic,
    status: "waiting",
    players: [{ userId, username: user.username, lockedMult: null, settled: false }],
    createdAt: Date.now(),
  });
  return res.json({ lobbyId: id });
});

// POST /mp/speed/:id/join
router.post("/mp/speed/:id/join", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const lobby = speedLobbies.get(req.params.id);
  if (!lobby) return res.status(404).json({ error: "Lobby not found" });
  if (lobby.status !== "waiting") return res.status(400).json({ error: "Game already started" });
  if (lobby.players.length >= 6) return res.status(400).json({ error: "Lobby full (max 6)" });
  if (lobby.players.some(p => p.userId === userId)) return res.status(400).json({ error: "Already joined" });
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < lobby.betAmount) return res.status(400).json({ error: "Insufficient balance" });
  lobby.players.push({ userId, username: user.username, lockedMult: null, settled: false });
  return res.json({ ok: true, players: lobby.players.length });
});

// POST /mp/speed/:id/start  (host only)
router.post("/mp/speed/:id/start", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const lobby = speedLobbies.get(req.params.id);
  if (!lobby) return res.status(404).json({ error: "Lobby not found" });
  if (lobby.hostId !== userId) return res.status(403).json({ error: "Only the host can start the game" });
  if (lobby.status !== "waiting") return res.status(400).json({ error: "Already started" });
  if (lobby.players.length < 2) return res.status(400).json({ error: "Need at least 2 players" });
  if (await isPoolPaused()) return res.status(503).json({ error: "Pool is paused" });

  for (const p of lobby.players) {
    const r = await db.update(usersTable)
      .set({ balance: sql`${usersTable.balance} - ${lobby.betAmount.toFixed(2)}` })
      .where(and(eq(usersTable.id, p.userId), sql`${usersTable.balance} >= ${lobby.betAmount.toFixed(2)}`))
      .returning({ balance: usersTable.balance });
    if (!r.length) { p.settled = true; p.lockedMult = 0; }
  }

  const active = lobby.players.filter(p => !p.settled);
  if (active.length < 2) {
    for (const p of lobby.players.filter(p => !p.settled)) {
      await db.update(usersTable).set({ balance: sql`${usersTable.balance} + ${lobby.betAmount.toFixed(2)}` }).where(eq(usersTable.id, p.userId));
    }
    speedLobbies.delete(lobby.id);
    return res.status(400).json({ error: "Not enough players can afford the bet" });
  }

  lobby.status = "playing";
  lobby.startedAt = Date.now();
  const crashSec = 5 + Math.random() * 15;
  lobby.crashAtMs = crashSec * 1000;

  setTimeout(async () => {
    if (lobby.status !== "playing") return;
    await resolveSpeedLobby(lobby.id);
  }, crashSec * 1000 + 1000);

  return res.json({ ok: true, startMult: SPEED_START_MULT, fallRate: SPEED_FALL_RATE });
});

// POST /mp/speed/:id/lock
router.post("/mp/speed/:id/lock", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const lobby = speedLobbies.get(req.params.id);
  if (!lobby) return res.status(404).json({ error: "Lobby not found" });
  if (lobby.status !== "playing") return res.status(400).json({ error: "Game not in progress" });
  const player = lobby.players.find(p => p.userId === userId);
  if (!player) return res.status(403).json({ error: "Not in this lobby" });
  if (player.lockedMult !== null) return res.status(400).json({ error: "Already locked" });

  const mult = currentSpeedMult(lobby);
  if (mult <= 0) return res.status(400).json({ error: "Crashed! Too late" });
  player.lockedMult = parseFloat(mult.toFixed(3));

  const all = lobby.players.filter(p => !p.settled);
  if (all.every(p => p.lockedMult !== null)) {
    await resolveSpeedLobby(lobby.id);
  }

  return res.json({ ok: true, lockedMult: player.lockedMult });
});

async function resolveSpeedLobby(lobbyId: string) {
  const lobby = speedLobbies.get(lobbyId);
  if (!lobby || lobby.status !== "playing") return;
  lobby.status = "done";
  const crashMult = currentSpeedMult(lobby);
  lobby.crashMult = parseFloat(crashMult.toFixed(3));

  const activePlayers = lobby.players.filter(p => !p.settled);
  const numPlayers = lobby.players.length;

  for (const p of activePlayers) {
    if (p.lockedMult === null) p.lockedMult = 0;
  }

  const locked = activePlayers.filter(p => p.lockedMult! > 0).sort((a, b) => b.lockedMult! - a.lockedMult!);
  const winner = locked[0] ?? null;
  const losers = activePlayers.filter(p => p !== winner);

  const pool = (await db.select().from(poolTable).limit(1))[0];

  for (const p of losers) {
    if (p.settled) continue;
    p.settled = true;
    await db.insert(betsTable).values({ userId: p.userId, gameType: "speed-test", betAmount: lobby.betAmount.toFixed(2), result: "loss", payout: "0.00", multiplier: "0.0000" });
    await db.update(poolTable).set({ totalAmount: sql`${poolTable.totalAmount} + ${lobby.betAmount.toFixed(2)}` }).where(eq(poolTable.id, pool.id));
    await trackGameProgress(p.userId, { betAmount: lobby.betAmount, won: false, profit: -lobby.betAmount, gameType: "speed-test" });
  }

  if (winner) {
    winner.settled = true;
    const winPayout = lobby.betAmount * numPlayers;
    const poolNow = parseFloat((await db.select().from(poolTable).limit(1))[0]?.totalAmount ?? "0");
    const capped = Math.min(winPayout, poolNow);
    const [upd] = await db.transaction(async (tx) => {
      const r = await tx.update(usersTable).set({ balance: sql`${usersTable.balance} + ${capped.toFixed(2)}` }).where(eq(usersTable.id, winner.userId)).returning({ balance: usersTable.balance });
      await tx.update(poolTable).set({ totalAmount: sql`${poolTable.totalAmount} - ${capped.toFixed(2)}` }).where(eq(poolTable.id, pool.id));
      await tx.insert(betsTable).values({ userId: winner.userId, gameType: "speed-test", betAmount: lobby.betAmount.toFixed(2), result: "win", payout: capped.toFixed(2), multiplier: numPlayers.toFixed(4) });
      return r;
    });
    await trackGameProgress(winner.userId, { betAmount: lobby.betAmount, won: true, profit: capped - lobby.betAmount, gameType: "speed-test" });
    lobby.winner = { userId: winner.userId, username: winner.username, lockedMult: winner.lockedMult!, payout: capped, newBalance: parseFloat(upd?.balance ?? "0") };
  }
}

// GET /mp/speed/:id
router.get("/mp/speed/:id", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const lobby = speedLobbies.get(req.params.id);
  if (!lobby) return res.status(404).json({ error: "Lobby not found" });
  const myPlayer = lobby.players.find(p => p.userId === userId);
  const currentMult = lobby.status === "playing" ? currentSpeedMult(lobby) : null;
  return res.json({
    id: lobby.id,
    hostId: lobby.hostId,
    betAmount: lobby.betAmount,
    isPublic: lobby.isPublic,
    status: lobby.status,
    startedAt: lobby.startedAt,
    currentMult: currentMult !== null ? parseFloat(currentMult.toFixed(3)) : null,
    startMult: SPEED_START_MULT,
    fallRate: SPEED_FALL_RATE,
    players: lobby.players.map(p => ({
      username: p.username,
      locked: p.lockedMult !== null,
      lockedMult: lobby.status === "done" ? p.lockedMult : (p.lockedMult !== null ? "locked" : null),
      isYou: p.userId === userId,
    })),
    myLockedMult: myPlayer?.lockedMult ?? null,
    winner: lobby.winner,
    crashMult: lobby.status === "done" ? lobby.crashMult : undefined,
    isHost: lobby.hostId === userId,
    isInLobby: !!myPlayer,
  });
});

export default router;
