import { Router, type Request, type Response, type IRouter } from "express";
import { db, usersTable, poolTable, casinosTable, casinoGamesOwnedTable, casinoBetsTable, casinoTransactionsTable, casinoDrinksTable, userDrinksTable, monthlyTaxLogsTable, casinoGameOddsTable } from "@workspace/db";
import { eq, and, desc, sql, gte } from "drizzle-orm";

const router: IRouter = Router();

const CASINO_CREATION_COST = 100_000_000;
const GAME_PURCHASE_COST = 1_000_000;

function authCheck(req: Request, res: Response): number | null {
  const userId = (req as Request & { session?: { userId?: number } }).session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return null; }
  return userId;
}

async function getPool() {
  const [pool] = await db.select().from(poolTable).limit(1);
  if (!pool) {
    const [newPool] = await db.insert(poolTable).values({}).returning();
    return newPool;
  }
  return pool;
}

async function getCasinoOwned(casinoId: number, ownerId: number) {
  const [casino] = await db.select().from(casinosTable)
    .where(and(eq(casinosTable.id, casinoId), eq(casinosTable.ownerId, ownerId)));
  return casino ?? null;
}

async function deleteCasinoData(tx: typeof db, casinoId: number) {
  await tx.delete(userDrinksTable).where(eq(userDrinksTable.casinoId, casinoId));
  await tx.delete(casinoGameOddsTable).where(eq(casinoGameOddsTable.casinoId, casinoId));
  await tx.delete(casinoTransactionsTable).where(eq(casinoTransactionsTable.casinoId, casinoId));
  await tx.delete(casinoBetsTable).where(eq(casinoBetsTable.casinoId, casinoId));
  await tx.delete(casinoGamesOwnedTable).where(eq(casinoGamesOwnedTable.casinoId, casinoId));
  await tx.delete(monthlyTaxLogsTable).where(eq(monthlyTaxLogsTable.casinoId, casinoId));
  await tx.delete(casinoDrinksTable).where(eq(casinoDrinksTable.casinoId, casinoId));
  await tx.delete(casinosTable).where(eq(casinosTable.id, casinoId));
}

// ─── List all casinos ─────────────────────────────────────────────────────────
router.get("/casinos", async (req, res): Promise<void> => {
  const casinos = await db
    .select({
      id: casinosTable.id,
      name: casinosTable.name,
      description: casinosTable.description,
      emoji: casinosTable.emoji,
      bankroll: casinosTable.bankroll,
      minBet: casinosTable.minBet,
      maxBet: casinosTable.maxBet,
      isPaused: casinosTable.isPaused,
      totalBets: casinosTable.totalBets,
      totalWagered: casinosTable.totalWagered,
      totalPaidOut: casinosTable.totalPaidOut,
      createdAt: casinosTable.createdAt,
      ownerUsername: usersTable.username,
      ownerAvatarUrl: usersTable.avatarUrl,
      ownerId: casinosTable.ownerId,
    })
    .from(casinosTable)
    .leftJoin(usersTable, eq(casinosTable.ownerId, usersTable.id))
    .orderBy(desc(casinosTable.bankroll));

  const casinoIds = casinos.map(c => c.id);
  let gameCountsByID: Record<number, number> = {};
  let activePlayersByID: Record<number, number> = {};
  if (casinoIds.length > 0) {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const [gameCounts, activePlayers] = await Promise.all([
      db.select({ casinoId: casinoGamesOwnedTable.casinoId, count: sql<number>`count(*)::int` })
        .from(casinoGamesOwnedTable)
        .where(eq(casinoGamesOwnedTable.isEnabled, true))
        .groupBy(casinoGamesOwnedTable.casinoId),
      db.select({ casinoId: casinoBetsTable.casinoId, count: sql<number>`count(distinct ${casinoBetsTable.userId})::int` })
        .from(casinoBetsTable)
        .where(gte(casinoBetsTable.createdAt, thirtyMinsAgo))
        .groupBy(casinoBetsTable.casinoId),
    ]);
    for (const gc of gameCounts) gameCountsByID[gc.casinoId] = gc.count;
    for (const ap of activePlayers) activePlayersByID[ap.casinoId] = ap.count;
  }

  res.json({ casinos: casinos.map(c => ({ ...c, gameCount: gameCountsByID[c.id] ?? 0, activePlayers: activePlayersByID[c.id] ?? 0 })) });
});

// ─── Get single casino ────────────────────────────────────────────────────────
router.get("/casinos/:id", async (req, res): Promise<void> => {
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const [casino] = await db
    .select({
      id: casinosTable.id,
      name: casinosTable.name,
      description: casinosTable.description,
      emoji: casinosTable.emoji,
      bankroll: casinosTable.bankroll,
      minBet: casinosTable.minBet,
      maxBet: casinosTable.maxBet,
      isPaused: casinosTable.isPaused,
      totalBets: casinosTable.totalBets,
      totalWagered: casinosTable.totalWagered,
      totalPaidOut: casinosTable.totalPaidOut,
      createdAt: casinosTable.createdAt,
      ownerId: casinosTable.ownerId,
      ownerUsername: usersTable.username,
      ownerAvatarUrl: usersTable.avatarUrl,
      purchasePrice: casinosTable.purchasePrice,
      imageUrl: casinosTable.imageUrl,
      insolvencyWinnerId: casinosTable.insolvencyWinnerId,
      insolvencyDebtAmount: casinosTable.insolvencyDebtAmount,
      cheapStorageLevel: casinosTable.cheapStorageLevel,
      standardStorageLevel: casinosTable.standardStorageLevel,
      expensiveStorageLevel: casinosTable.expensiveStorageLevel,
    })
    .from(casinosTable)
    .leftJoin(usersTable, eq(casinosTable.ownerId, usersTable.id))
    .where(eq(casinosTable.id, casinoId))
    .limit(1);

  if (!casino) { res.status(404).json({ error: "Casino not found" }); return; }

  // Authenticate to decide whether to return all drinks or only available ones
  const requestUserId = (req as Request & { session?: { userId?: number } }).session?.userId;
  const isOwner = requestUserId === casino.ownerId;
  const games = await db.select().from(casinoGamesOwnedTable).where(eq(casinoGamesOwnedTable.casinoId, casinoId));
  const drinksQuery = isOwner
    ? db.select().from(casinoDrinksTable).where(eq(casinoDrinksTable.casinoId, casinoId))
    : db.select().from(casinoDrinksTable).where(and(eq(casinoDrinksTable.casinoId, casinoId), eq(casinoDrinksTable.isAvailable, true)));
  const drinks = await drinksQuery;

  res.json({ casino, games, drinks });
});

// ─── Create casino ────────────────────────────────────────────────────────────
router.post("/casinos", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const { name, description, emoji } = req.body;

  if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 40) {
    res.status(400).json({ error: "Casino name must be 2–40 characters" }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }

  const balance = parseFloat(user.balance);
  if (balance < CASINO_CREATION_COST) {
    res.status(400).json({ error: `Creating a casino costs ${CASINO_CREATION_COST.toLocaleString()} chips. You need ${(CASINO_CREATION_COST - balance).toFixed(2)} more.` }); return;
  }

  const [existingOwned] = await db.select({ id: casinosTable.id }).from(casinosTable).where(eq(casinosTable.ownerId, userId)).limit(1);
  if (existingOwned) { res.status(400).json({ error: "You already own a casino. Each player can only own one." }); return; }

  const [existingName] = await db.select({ id: casinosTable.id }).from(casinosTable).where(eq(casinosTable.name, name.trim())).limit(1);
  if (existingName) { res.status(400).json({ error: "A casino with that name already exists." }); return; }

  const pool = await getPool();

  const { casino, newBalance } = await db.transaction(async (tx) => {
    const [freshUser] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!freshUser) throw new Error("User not found");
    const freshBalance = parseFloat(freshUser.balance);
    if (freshBalance < CASINO_CREATION_COST) throw new Error("Insufficient balance");

    const updatedBalance = freshBalance - CASINO_CREATION_COST;
    await tx.update(usersTable).set({ balance: updatedBalance.toFixed(2) }).where(eq(usersTable.id, userId));
    await tx.update(poolTable).set({ totalAmount: sql`${poolTable.totalAmount} + ${CASINO_CREATION_COST}` }).where(eq(poolTable.id, pool.id));
    const [newCasino] = await tx.insert(casinosTable).values({
      ownerId: userId,
      name: name.trim(),
      description: (description ?? "").trim(),
      emoji: emoji ?? "🏦",
      purchasePrice: CASINO_CREATION_COST.toString(),
    }).returning();
    return { casino: newCasino, newBalance: updatedBalance };
  });

  res.json({ casino, newBalance });
});

// ─── Update casino settings (owner only) ─────────────────────────────────────
router.patch("/casinos/:id", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const casino = await getCasinoOwned(casinoId, userId);
  if (!casino) { res.status(403).json({ error: "Not your casino" }); return; }

  const { name, description, emoji, minBet, maxBet, isPaused } = req.body;
  const updates: Partial<typeof casinosTable.$inferInsert> = { updatedAt: new Date() };

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 40)
      { res.status(400).json({ error: "Name must be 2–40 chars" }); return; }
    const [existing] = await db.select({ id: casinosTable.id }).from(casinosTable)
      .where(and(eq(casinosTable.name, name.trim()), sql`${casinosTable.id} != ${casinoId}`)).limit(1);
    if (existing) { res.status(400).json({ error: "Name already taken" }); return; }
    updates.name = name.trim();
  }
  if (description !== undefined) updates.description = String(description).slice(0, 300);
  if (emoji !== undefined) updates.emoji = String(emoji).slice(0, 10);
  if (isPaused !== undefined) updates.isPaused = Boolean(isPaused);
  if (req.body.imageUrl !== undefined) updates.imageUrl = req.body.imageUrl ? String(req.body.imageUrl).slice(0, 500) : null;
  if (minBet !== undefined) {
    const mb = parseFloat(minBet);
    if (isNaN(mb) || mb < 1) { res.status(400).json({ error: "minBet must be >= 1" }); return; }
    updates.minBet = mb.toFixed(2);
  }
  if (maxBet !== undefined) {
    const mb = parseFloat(maxBet);
    if (isNaN(mb) || mb < 1) { res.status(400).json({ error: "maxBet must be >= 1" }); return; }
    updates.maxBet = mb.toFixed(2);
  }

  const [updated] = await db.update(casinosTable).set(updates).where(eq(casinosTable.id, casinoId)).returning();
  res.json({ casino: updated });
});

// ─── Deposit bankroll ─────────────────────────────────────────────────────────
router.post("/casinos/:id/deposit", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const casino = await getCasinoOwned(casinoId, userId);
  if (!casino) { res.status(403).json({ error: "Not your casino" }); return; }

  const amount = parseFloat(req.body?.amount);
  if (isNaN(amount) || amount < 1) { res.status(400).json({ error: "Invalid amount" }); return; }

  const [user] = await db.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }

  const { newBankroll, newUserBalance } = await db.transaction(async (tx) => {
    const [freshUser] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!freshUser) throw new Error("User not found");
    const userBal = parseFloat(freshUser.balance);
    if (userBal < amount) throw new Error("Insufficient balance");

    const [freshCasino] = await tx.select({ bankroll: casinosTable.bankroll }).from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
    if (!freshCasino) throw new Error("Casino not found");

    const updatedUserBalance = userBal - amount;
    const updatedBankroll = parseFloat(freshCasino.bankroll) + amount;

    await tx.update(usersTable).set({ balance: updatedUserBalance.toFixed(2) }).where(eq(usersTable.id, userId));
    await tx.update(casinosTable).set({ bankroll: updatedBankroll.toFixed(2), updatedAt: new Date() }).where(eq(casinosTable.id, casinoId));
    await tx.insert(casinoTransactionsTable).values({ casinoId, type: "deposit", amount: amount.toFixed(2), description: "Owner deposit" });
    return { newBankroll: updatedBankroll, newUserBalance: updatedUserBalance };
  });

  res.json({ newBankroll, newUserBalance });
});

// ─── Withdraw bankroll ────────────────────────────────────────────────────────
router.post("/casinos/:id/withdraw", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const casino = await getCasinoOwned(casinoId, userId);
  if (!casino) { res.status(403).json({ error: "Not your casino" }); return; }

  const amount = parseFloat(req.body?.amount);
  if (isNaN(amount) || amount < 1) { res.status(400).json({ error: "Invalid amount" }); return; }

  const { newBankroll, newUserBalance } = await db.transaction(async (tx) => {
    const [freshCasino] = await tx.select({ bankroll: casinosTable.bankroll }).from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
    if (!freshCasino) throw new Error("Casino not found");
    const bankroll = parseFloat(freshCasino.bankroll);
    if (bankroll < amount) throw new Error("Insufficient bankroll");

    const [freshUser] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!freshUser) throw new Error("User not found");

    const updatedBankroll = bankroll - amount;
    const updatedUserBalance = parseFloat(freshUser.balance) + amount;

    await tx.update(casinosTable).set({ bankroll: updatedBankroll.toFixed(2), updatedAt: new Date() }).where(eq(casinosTable.id, casinoId));
    await tx.update(usersTable).set({ balance: updatedUserBalance.toFixed(2) }).where(eq(usersTable.id, userId));
    await tx.insert(casinoTransactionsTable).values({ casinoId, type: "withdraw", amount: amount.toFixed(2), description: "Owner withdrawal" });
    return { newBankroll: updatedBankroll, newUserBalance: updatedUserBalance };
  });

  res.json({ newBankroll, newUserBalance });
});

// ─── Purchase a game ──────────────────────────────────────────────────────────
router.post("/casinos/:id/games", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const casino = await getCasinoOwned(casinoId, userId);
  if (!casino) { res.status(403).json({ error: "Not your casino" }); return; }

  const { gameType } = req.body;
  if (!gameType || typeof gameType !== "string") { res.status(400).json({ error: "gameType required" }); return; }

  const [existing] = await db.select().from(casinoGamesOwnedTable)
    .where(and(eq(casinoGamesOwnedTable.casinoId, casinoId), eq(casinoGamesOwnedTable.gameType, gameType))).limit(1);
  if (existing) { res.status(400).json({ error: "You already own this game" }); return; }

  const [user] = await db.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }

  const balance = parseFloat(user.balance);
  if (balance < GAME_PURCHASE_COST) { res.status(400).json({ error: `Purchasing a game costs ${GAME_PURCHASE_COST.toLocaleString()} chips.` }); return; }

  const pool = await getPool();

  const { game, newBalance } = await db.transaction(async (tx) => {
    const [freshUser] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!freshUser) throw new Error("User not found");
    const freshBalance = parseFloat(freshUser.balance);
    if (freshBalance < GAME_PURCHASE_COST) throw new Error("Insufficient balance");

    const updatedBalance = freshBalance - GAME_PURCHASE_COST;
    await tx.update(usersTable).set({ balance: updatedBalance.toFixed(2) }).where(eq(usersTable.id, userId));
    await tx.update(poolTable).set({ totalAmount: sql`${poolTable.totalAmount} + ${GAME_PURCHASE_COST}` }).where(eq(poolTable.id, pool.id));
    const [newGame] = await tx.insert(casinoGamesOwnedTable).values({ casinoId, gameType }).returning();
    return { game: newGame, newBalance: updatedBalance };
  });

  res.json({ game, newBalance });
});

// ─── Toggle game enabled ──────────────────────────────────────────────────────
router.patch("/casinos/:id/games/:gameType", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const casino = await getCasinoOwned(casinoId, userId);
  if (!casino) { res.status(403).json({ error: "Not your casino" }); return; }

  const { isEnabled } = req.body;
  const [game] = await db.update(casinoGamesOwnedTable)
    .set({ isEnabled: Boolean(isEnabled) })
    .where(and(eq(casinoGamesOwnedTable.casinoId, casinoId), eq(casinoGamesOwnedTable.gameType, req.params.gameType)))
    .returning();

  if (!game) { res.status(404).json({ error: "Game not found" }); return; }
  res.json({ game });
});


// ─── Casino bet logs (owner) ──────────────────────────────────────────────────
router.get("/casinos/:id/bets", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const casino = await getCasinoOwned(casinoId, userId);
  if (!casino) { res.status(403).json({ error: "Not your casino" }); return; }

  const bets = await db
    .select({
      id: casinoBetsTable.id,
      gameType: casinoBetsTable.gameType,
      betAmount: casinoBetsTable.betAmount,
      result: casinoBetsTable.result,
      payout: casinoBetsTable.payout,
      multiplier: casinoBetsTable.multiplier,
      createdAt: casinoBetsTable.createdAt,
      username: usersTable.username,
    })
    .from(casinoBetsTable)
    .leftJoin(usersTable, eq(casinoBetsTable.userId, usersTable.id))
    .where(eq(casinoBetsTable.casinoId, casinoId))
    .orderBy(desc(casinoBetsTable.createdAt))
    .limit(100);

  res.json({ bets });
});

// ─── Casino transactions (owner) ───────────────────────────────────────────────
router.get("/casinos/:id/transactions", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const casino = await getCasinoOwned(casinoId, userId);
  if (!casino) { res.status(403).json({ error: "Not your casino" }); return; }

  const txns = await db.select().from(casinoTransactionsTable)
    .where(eq(casinoTransactionsTable.casinoId, casinoId))
    .orderBy(desc(casinoTransactionsTable.createdAt))
    .limit(200);

  res.json({ transactions: txns });
});

// ─── My casino (owner lookup) ─────────────────────────────────────────────────
router.get("/casinos/me/owned", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const [casino] = await db.select().from(casinosTable).where(eq(casinosTable.ownerId, userId)).limit(1);
  if (!casino) { res.json({ casino: null }); return; }
  const games = await db.select().from(casinoGamesOwnedTable).where(eq(casinoGamesOwnedTable.casinoId, casino.id));
  const drinks = await db.select().from(casinoDrinksTable).where(eq(casinoDrinksTable.casinoId, casino.id));
  res.json({ casino, games, drinks });
});

// ─── Add drink (owner) ────────────────────────────────────────────────────────
router.post("/casinos/:id/drinks", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const casino = await getCasinoOwned(casinoId, userId);
  if (!casino) { res.status(403).json({ error: "Not your casino" }); return; }

  const { name, emoji, price, tier } = req.body;
  if (!name || typeof name !== "string" || name.trim().length < 1) { res.status(400).json({ error: "Drink name required" }); return; }
  const priceVal = parseFloat(price);
  if (isNaN(priceVal) || priceVal < 1) { res.status(400).json({ error: "Price must be >= 1" }); return; }
  if (!["cheap", "standard", "expensive"].includes(tier)) { res.status(400).json({ error: "tier must be cheap/standard/expensive" }); return; }

  const drink = await db.transaction(async (tx) => {
    const [freshUser] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!freshUser) throw new Error("User not found");
    const ownerBal = parseFloat(freshUser.balance);
    if (ownerBal < priceVal) throw new Error(`Insufficient balance — creating this drink costs ${priceVal} chips`);

    await tx.update(usersTable).set({ balance: (ownerBal - priceVal).toFixed(2) }).where(eq(usersTable.id, userId));

    const [newDrink] = await tx.insert(casinoDrinksTable).values({
      casinoId,
      name: name.trim(),
      emoji: emoji ?? "🍹",
      price: priceVal.toFixed(2),
      tier,
    }).returning();

    await tx.insert(casinoTransactionsTable).values({
      casinoId, type: "expense", amount: priceVal.toFixed(2),
      description: `${emoji ?? "🍹"} ${name.trim()} added to menu (cost: ${priceVal})`,
    });

    return newDrink;
  });

  res.json({ drink });
});

// ─── Update drink (name/emoji/price/visibility only) ─────────────────────────
router.patch("/casinos/:id/drinks/:drinkId", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  const drinkId = parseInt(req.params.drinkId);
  if (isNaN(casinoId) || isNaN(drinkId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const casino = await getCasinoOwned(casinoId, userId);
  if (!casino) { res.status(403).json({ error: "Not your casino" }); return; }

  const [currentDrink] = await db.select().from(casinoDrinksTable)
    .where(and(eq(casinoDrinksTable.id, drinkId), eq(casinoDrinksTable.casinoId, casinoId)))
    .limit(1);
  if (!currentDrink) { res.status(404).json({ error: "Drink not found" }); return; }

  const { name, emoji, price, isAvailable } = req.body;
  const updates: { name?: string; emoji?: string; price?: string; isAvailable?: boolean } = {};
  if (name !== undefined) updates.name = String(name).trim();
  if (emoji !== undefined) updates.emoji = String(emoji).slice(0, 10);
  if (price !== undefined) { const p = parseFloat(price); if (!isNaN(p)) updates.price = p.toFixed(2); }
  // Allow toggling visibility but only enable if stock > 0
  if (isAvailable !== undefined) {
    const enable = Boolean(isAvailable);
    if (enable && parseInt(currentDrink.stock as unknown as string) <= 0) {
      res.status(400).json({ error: "Cannot make drink available — stock is 0. Restock first." }); return;
    }
    updates.isAvailable = enable;
  }

  const [drink] = await db.update(casinoDrinksTable).set(updates)
    .where(and(eq(casinoDrinksTable.id, drinkId), eq(casinoDrinksTable.casinoId, casinoId)))
    .returning();
  res.json({ drink });
});

// ─── Restock drink (buy N units) ─────────────────────────────────────────────
router.post("/casinos/:id/drinks/:drinkId/restock", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  const drinkId = parseInt(req.params.drinkId);
  if (isNaN(casinoId) || isNaN(drinkId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const casino = await getCasinoOwned(casinoId, userId);
  if (!casino) { res.status(403).json({ error: "Not your casino" }); return; }

  const qty = Math.max(1, parseInt(req.body.qty ?? 1));
  if (isNaN(qty) || qty < 1 || qty > 200) { res.status(400).json({ error: "qty must be 1–200" }); return; }

  const [drink] = await db.select().from(casinoDrinksTable)
    .where(and(eq(casinoDrinksTable.id, drinkId), eq(casinoDrinksTable.casinoId, casinoId))).limit(1);
  if (!drink) { res.status(404).json({ error: "Drink not found" }); return; }

  const tier = drink.tier as "cheap" | "standard" | "expensive";
  const storageLevelKey = `${tier}StorageLevel` as "cheapStorageLevel" | "standardStorageLevel" | "expensiveStorageLevel";
  const casinoStorageLevel = parseInt(String(casino[storageLevelKey] ?? 0));
  const maxStorage = 20 + casinoStorageLevel * 5;

  // Shared pool: sum all stock for this tier across all drinks in the casino
  const tierDrinks = await db.select({ stock: casinoDrinksTable.stock })
    .from(casinoDrinksTable)
    .where(and(eq(casinoDrinksTable.casinoId, casinoId), eq(casinoDrinksTable.tier, tier)));
  const totalTierStock = tierDrinks.reduce((sum, d) => sum + parseInt(String(d.stock ?? 0)), 0);
  const currentStock = parseInt(String(drink.stock ?? 0));

  const tierAvailable = maxStorage - totalTierStock;
  if (tierAvailable <= 0) {
    res.status(400).json({ error: `${tier} storage pool full (${totalTierStock}/${maxStorage} used across all ${tier} drinks). Upgrade ${tier} storage or reduce other drink stocks first.` });
    return;
  }

  const actualQty = Math.min(qty, tierAvailable);
  const costPerUnit = Math.ceil(parseFloat(drink.price) * 0.25);
  const totalCost = costPerUnit * actualQty;

  const result = await db.transaction(async (tx) => {
    // Re-check tier total inside transaction to avoid race conditions
    const txTierDrinks = await tx.select({ stock: casinoDrinksTable.stock, id: casinoDrinksTable.id })
      .from(casinoDrinksTable)
      .where(and(eq(casinoDrinksTable.casinoId, casinoId), eq(casinoDrinksTable.tier, tier)));
    const txTierTotal = txTierDrinks.reduce((sum, d) => sum + parseInt(String(d.stock ?? 0)), 0);
    if (txTierTotal + actualQty > maxStorage) throw new Error(`${tier} storage pool would be exceeded. Only ${maxStorage - txTierTotal} slots available.`);

    const [freshUser] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!freshUser) throw new Error("User not found");
    const ownerBal = parseFloat(freshUser.balance);
    if (ownerBal < totalCost) throw new Error(`Insufficient balance — restocking ${actualQty} units costs ${totalCost} chips`);

    await tx.update(usersTable).set({ balance: (ownerBal - totalCost).toFixed(2) }).where(eq(usersTable.id, userId));
    const newStock = currentStock + actualQty;
    const [updated] = await tx.update(casinoDrinksTable)
      .set({ stock: newStock, isAvailable: true })
      .where(eq(casinoDrinksTable.id, drinkId))
      .returning();

    await tx.insert(casinoTransactionsTable).values({
      casinoId, type: "expense", amount: totalCost.toFixed(2),
      description: `${drink.emoji} ${drink.name} ×${actualQty} restocked — ${totalCost} chips`,
    });

    const newTierTotal = txTierTotal + actualQty;
    return { drink: updated, totalCost, actualQty, newStock, maxStorage, tierUsed: newTierTotal };
  });

  res.json(result);
});

// ─── Upgrade storage tier ─────────────────────────────────────────────────────
router.post("/casinos/:id/upgrade-storage", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const casino = await getCasinoOwned(casinoId, userId);
  if (!casino) { res.status(403).json({ error: "Not your casino" }); return; }

  const { tier } = req.body as { tier: "cheap" | "standard" | "expensive" };
  if (!["cheap", "standard", "expensive"].includes(tier)) { res.status(400).json({ error: "tier must be cheap/standard/expensive" }); return; }

  const UPGRADE_COST = 1_000_000;
  const levelKey = `${tier}StorageLevel` as "cheapStorageLevel" | "standardStorageLevel" | "expensiveStorageLevel";
  const currentLevel = parseInt(String(casino[levelKey] ?? 0));
  const newLevel = currentLevel + 1;

  const result = await db.transaction(async (tx) => {
    const [freshUser] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!freshUser) throw new Error("User not found");
    const ownerBal = parseFloat(freshUser.balance);
    if (ownerBal < UPGRADE_COST) throw new Error(`Insufficient balance — upgrade costs ${UPGRADE_COST.toLocaleString()} chips`);

    await tx.update(usersTable).set({ balance: (ownerBal - UPGRADE_COST).toFixed(2) }).where(eq(usersTable.id, userId));
    const [updated] = await tx.update(casinosTable)
      .set({ [levelKey]: newLevel })
      .where(eq(casinosTable.id, casinoId))
      .returning();

    await tx.insert(casinoTransactionsTable).values({
      casinoId, type: "expense", amount: UPGRADE_COST.toFixed(2),
      description: `${tier} storage upgraded to level ${newLevel} (+5 slots)`,
    });

    return { casino: updated, tier, newLevel, newCapacity: 20 + newLevel * 5 };
  });

  res.json(result);
});

// ─── Sell casino ──────────────────────────────────────────────────────────────
router.post("/casinos/:id/sell", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const [casino] = await db.select().from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
  if (!casino) { res.status(404).json({ error: "Casino not found" }); return; }
  if (casino.ownerId !== userId) { res.status(403).json({ error: "You are not the owner of this casino" }); return; }

  const purchasePrice = parseFloat(casino.purchasePrice ?? "0");
  const refund = Math.floor(purchasePrice > 0 ? purchasePrice * 0.10 : 0);

  await db.transaction(async (tx) => {
    if (refund > 0) {
      const [owner] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (owner) {
        await tx.update(usersTable).set({ balance: (parseFloat(owner.balance) + refund).toFixed(2) }).where(eq(usersTable.id, userId));
      }
    }
    await deleteCasinoData(tx, casinoId);
  });

  res.json({ sold: true, refund, message: refund > 0 ? `Casino sold for ${refund.toLocaleString()} chips refunded.` : "Casino sold." });
});

// ─── Purchase drink (player) ──────────────────────────────────────────────────
router.post("/casinos/:id/drinks/:drinkId/buy", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  const drinkId = parseInt(req.params.drinkId);
  if (isNaN(casinoId) || isNaN(drinkId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [drink] = await db.select().from(casinoDrinksTable)
    .where(and(eq(casinoDrinksTable.id, drinkId), eq(casinoDrinksTable.casinoId, casinoId), eq(casinoDrinksTable.isAvailable, true)))
    .limit(1);
  if (!drink) { res.status(404).json({ error: "Drink not found or unavailable" }); return; }

  const [user] = await db.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }

  const price = parseFloat(drink.price);

  const newBalance = await db.transaction(async (tx) => {
    const [freshUser] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!freshUser) throw new Error("User not found");
    const userBal = parseFloat(freshUser.balance);
    if (userBal < price) throw new Error("Insufficient balance");

    // Re-read drink inside tx to get current stock
    const [freshDrink] = await tx.select().from(casinoDrinksTable)
      .where(and(eq(casinoDrinksTable.id, drinkId), eq(casinoDrinksTable.isAvailable, true))).limit(1);
    if (!freshDrink) throw new Error("Drink no longer available");
    const currentStock = parseInt(String(freshDrink.stock ?? 0));
    const newStock = Math.max(0, currentStock - 1);
    const nowAvailable = newStock > 0;

    const updatedUserBalance = userBal - price;
    await tx.update(usersTable).set({ balance: updatedUserBalance.toFixed(2) }).where(eq(usersTable.id, userId));
    await tx.update(casinosTable).set({ bankroll: sql`${casinosTable.bankroll} + ${price}` }).where(eq(casinosTable.id, casinoId));
    await tx.update(casinoDrinksTable).set({ stock: newStock, isAvailable: nowAvailable }).where(eq(casinoDrinksTable.id, drinkId));
    await tx.insert(userDrinksTable).values({
      userId, casinoId, drinkId: drink.id,
      drinkName: drink.name, drinkEmoji: drink.emoji, drinkPrice: drink.price,
    });
    await tx.insert(casinoTransactionsTable).values({
      casinoId, type: "drink_sale", amount: price.toFixed(2),
      description: `${drink.emoji} ${drink.name} sold (${newStock} left)`,
    });
    return updatedUserBalance;
  });

  res.json({ success: true, drinkName: drink.name, drinkEmoji: drink.emoji, newBalance });
});

// ─── User's drinks collection ─────────────────────────────────────────────────
router.get("/users/:username/drinks", async (req, res): Promise<void> => {
  const [user] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(eq(usersTable.username, req.params.username)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const drinks = await db
    .select({
      id: userDrinksTable.id,
      drinkName: userDrinksTable.drinkName,
      drinkEmoji: userDrinksTable.drinkEmoji,
      drinkPrice: userDrinksTable.drinkPrice,
      purchasedAt: userDrinksTable.purchasedAt,
      casinoId: userDrinksTable.casinoId,
      casinoName: casinosTable.name,
    })
    .from(userDrinksTable)
    .leftJoin(casinosTable, eq(userDrinksTable.casinoId, casinosTable.id))
    .where(eq(userDrinksTable.userId, user.id))
    .orderBy(desc(userDrinksTable.purchasedAt))
    .limit(50);

  res.json({ drinks });
});

// ─── Top casinos (leaderboard) ────────────────────────────────────────────────
router.get("/leaderboard/top-casinos", async (req, res): Promise<void> => {
  const casinos = await db
    .select({
      id: casinosTable.id,
      name: casinosTable.name,
      emoji: casinosTable.emoji,
      bankroll: casinosTable.bankroll,
      totalBets: casinosTable.totalBets,
      totalWagered: casinosTable.totalWagered,
      ownerUsername: usersTable.username,
      createdAt: casinosTable.createdAt,
    })
    .from(casinosTable)
    .leftJoin(usersTable, eq(casinosTable.ownerId, usersTable.id))
    .orderBy(desc(casinosTable.bankroll))
    .limit(20);

  res.json({ casinos });
});

// ─── Tax logs ─────────────────────────────────────────────────────────────────
router.get("/casinos/:id/tax-logs", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const casino = await getCasinoOwned(casinoId, userId);
  if (!casino) { res.status(403).json({ error: "Not your casino" }); return; }

  const logs = await db.select().from(monthlyTaxLogsTable)
    .where(eq(monthlyTaxLogsTable.casinoId, casinoId))
    .orderBy(desc(monthlyTaxLogsTable.taxedAt))
    .limit(24);

  res.json({ logs });
});

// ─── Game Odds (owner-only, never exposed to players) ────────────────────────
router.get("/casinos/:id/odds", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }
  const casino = await getCasinoOwned(casinoId, userId);
  if (!casino) { res.status(403).json({ error: "Not your casino" }); return; }
  const odds = await db.select().from(casinoGameOddsTable).where(eq(casinoGameOddsTable.casinoId, casinoId));
  res.json({ odds });
});

router.put("/casinos/:id/odds/:gameType", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }
  const casino = await getCasinoOwned(casinoId, userId);
  if (!casino) { res.status(403).json({ error: "Not your casino" }); return; }
  const gameType = req.params.gameType;
  const payoutMultiplier = parseFloat(req.body?.payoutMultiplier);
  if (isNaN(payoutMultiplier) || payoutMultiplier < 0.5 || payoutMultiplier > 2.0) {
    res.status(400).json({ error: "payoutMultiplier must be between 0.5 and 2.0" }); return;
  }
  const payTableConfigRaw = req.body?.payTableConfig;
  let payTableConfig: string | null = null;
  if (payTableConfigRaw !== undefined && payTableConfigRaw !== null) {
    if (typeof payTableConfigRaw === "string") {
      try { JSON.parse(payTableConfigRaw); payTableConfig = payTableConfigRaw; } catch { res.status(400).json({ error: "payTableConfig must be valid JSON" }); return; }
    } else if (typeof payTableConfigRaw === "object") {
      payTableConfig = JSON.stringify(payTableConfigRaw);
    }
  }
  const [existing] = await db.select().from(casinoGameOddsTable)
    .where(and(eq(casinoGameOddsTable.casinoId, casinoId), eq(casinoGameOddsTable.gameType, gameType))).limit(1);
  if (existing) {
    const updateSet = payTableConfig !== null
      ? { payoutMultiplier: payoutMultiplier.toFixed(4), payTableConfig, updatedAt: new Date() }
      : { payoutMultiplier: payoutMultiplier.toFixed(4), updatedAt: new Date() };
    const [updated] = await db.update(casinoGameOddsTable).set(updateSet)
      .where(and(eq(casinoGameOddsTable.casinoId, casinoId), eq(casinoGameOddsTable.gameType, gameType)))
      .returning();
    res.json({ odds: updated });
  } else {
    const [created] = await db.insert(casinoGameOddsTable)
      .values({ casinoId, gameType, payoutMultiplier: payoutMultiplier.toFixed(4), ...(payTableConfig !== null ? { payTableConfig } : {}) })
      .returning();
    res.json({ odds: created });
  }
});

// ─── Public: get game config for display ──────────────────────────────────────
router.get("/casinos/:id/game-config/:gameType", async (req, res): Promise<void> => {
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }
  const [config] = await db.select().from(casinoGameOddsTable)
    .where(and(eq(casinoGameOddsTable.casinoId, casinoId), eq(casinoGameOddsTable.gameType, req.params.gameType))).limit(1);
  res.json({ config: config || null });
});

// ─── Insolvency Resolution ─────────────────────────────────────────────────────
router.post("/casinos/:id/resolve-insolvency", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const casinoId = parseInt(req.params.id);
  if (isNaN(casinoId)) { res.status(400).json({ error: "Invalid casino ID" }); return; }

  const { action } = req.body as { action: "pay" | "sell" | "transfer" };
  if (!["pay", "sell", "transfer"].includes(action)) {
    res.status(400).json({ error: "Invalid action. Use pay, sell, or transfer." }); return;
  }

  const [casino] = await db.select().from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
  if (!casino) { res.status(404).json({ error: "Casino not found" }); return; }
  if (casino.ownerId !== userId) { res.status(403).json({ error: "You are not the owner of this casino" }); return; }
  if (!casino.insolvencyWinnerId || !casino.insolvencyDebtAmount) {
    res.status(400).json({ error: "This casino is not insolvent" }); return;
  }

  const debtAmount = parseFloat(casino.insolvencyDebtAmount);
  const winnerId = casino.insolvencyWinnerId;

  if (action === "pay") {
    const [owner] = await db.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!owner) { res.status(404).json({ error: "User not found" }); return; }
    const ownerBalance = parseFloat(owner.balance);
    if (ownerBalance < debtAmount) {
      res.status(400).json({ error: `Insufficient balance. Need ${debtAmount.toFixed(2)} chips.` }); return;
    }
    await db.transaction(async (tx) => {
      await tx.update(usersTable).set({ balance: (ownerBalance - debtAmount).toFixed(2) }).where(eq(usersTable.id, userId));
      const [winner] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, winnerId)).limit(1);
      if (winner) {
        await tx.update(usersTable).set({ balance: (parseFloat(winner.balance) + debtAmount).toFixed(2) }).where(eq(usersTable.id, winnerId));
      }
      await tx.update(casinosTable).set({ insolvencyWinnerId: null, insolvencyDebtAmount: null, isPaused: false }).where(eq(casinosTable.id, casinoId));
    });
    res.json({ resolved: true, action: "pay", message: "Debt paid. Casino is back in operation." });

  } else if (action === "sell") {
    const purchasePrice = parseFloat(casino.purchasePrice ?? "100000000");
    const sellback = Math.floor(purchasePrice * 0.05);
    await db.transaction(async (tx) => {
      const [winner] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, winnerId)).limit(1);
      if (winner) {
        await tx.update(usersTable).set({ balance: (parseFloat(winner.balance) + debtAmount).toFixed(2) }).where(eq(usersTable.id, winnerId));
      }
      const [owner] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (owner) {
        await tx.update(usersTable).set({ balance: (parseFloat(owner.balance) + sellback).toFixed(2) }).where(eq(usersTable.id, userId));
      }
      await deleteCasinoData(tx, casinoId);
    });
    res.json({ resolved: true, action: "sell", sellback, message: `Casino sold for ${sellback.toLocaleString()} chips. Debt paid to winner.` });

  } else {
    // transfer
    await db.transaction(async (tx) => {
      const [winner] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, winnerId)).limit(1);
      if (winner) {
        await tx.update(usersTable).set({ balance: (parseFloat(winner.balance) + debtAmount).toFixed(2) }).where(eq(usersTable.id, winnerId));
      }
      await tx.update(casinosTable).set({
        ownerId: winnerId,
        insolvencyWinnerId: null,
        insolvencyDebtAmount: null,
        isPaused: false,
      }).where(eq(casinosTable.id, casinoId));
    });
    res.json({ resolved: true, action: "transfer", message: "Casino ownership transferred to winner. Debt paid from casino funds." });
  }
});

export default router;
