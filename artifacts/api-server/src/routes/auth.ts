import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { RegisterBody, LoginBody, RegisterResponse, LoginResponse, GetMeResponse, LogoutResponse } from "@workspace/api-zod";
import { selectOne, selectMany, insertInto, updateTable, deleteFrom, transaction } from "../lib/neon-db";

const router: IRouter = Router();

function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function makeUniqueReferralCode(): Promise<string> {
  for (let attempts = 0; attempts < 10; attempts++) {
    const code = generateReferralCode();
    const existing = await selectOne("users", ["id"], { referral_code: code });
    if (!existing) return code;
  }
  return generateReferralCode() + Date.now().toString(36).slice(-4).toUpperCase();
}

async function addLedgerEntry(opts: {
  eventType: string;
  direction: "in" | "out";
  amount: number;
  description: string;
  actorUserId?: number | null;
  targetUserId?: number | null;
}): Promise<void> {
  if (opts.amount <= 0) return;
  await insertInto("money_ledger", {
    event_type: opts.eventType,
    direction: opts.direction,
    amount: opts.amount.toFixed(2),
    description: opts.description,
    actor_user_id: opts.actorUserId ?? null,
    target_user_id: opts.targetUserId ?? null,
  });
}

function formatUser(user: any) {
  if (!user) return null;
  const u = user as Record<string, any>;
  const get = (camel: string, snake?: string) => u[camel] ?? u[snake ?? camel.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)];
  const createdAt = get("createdAt", "created_at");
  const suspended = get("suspendedUntil", "suspended_until");
  const banned = get("bannedUntil", "banned_until");
  return {
    id: get("id"),
    username: get("username"),
    email: get("email") ?? null,
    balance: parseFloat(String(get("balance") ?? "0")),
    isAdmin: !!get("isAdmin", "is_admin"),
    isOwner: !!get("isOwner", "is_owner"),
    isGuest: !!get("isGuest", "is_guest"),
    isCrazyGamesLinked: !!get("isCrazyGamesLinked", "is_crazy_games_linked"),
    referralCode: get("referralCode", "referral_code") ?? null,
    avatarUrl: get("avatarUrl", "avatar_url") ?? null,
    createdAt: createdAt ? new Date(createdAt).toISOString() : null,
    suspendedUntil: suspended ? new Date(suspended).toISOString() : null,
    bannedUntil: banned ? new Date(banned).toISOString() : null,
    permanentlyBanned: !!get("permanentlyBanned", "permanently_banned"),
    banReason: get("banReason", "ban_reason") ?? null,
    bio: get("bio"),
    xp: Number(get("xp") ?? 0),
    level: Number(get("level") ?? 1),
  };
}

async function mergeGuestIntoUser(guestId: number, userId: number): Promise<void> {
  const guest = await selectOne("users", undefined, { id: guestId });
  if (!guest || !(guest.is_guest ?? guest.isGuest)) return;

  const guestBalance = parseFloat(String(guest.balance ?? "0"));
  const guestStartingBalance = 10000;
  const earned = Math.max(0, guestBalance - guestStartingBalance);
  const remainingBase = guestBalance - earned;

  if (earned > 0 || parseInt(guest.games_played ?? guest.gamesPlayed ?? "0") > 0) {
    const user = await selectOne("users", undefined, { id: userId });
    if (!user) return;
    const newBalance = parseFloat(String(user.balance ?? "0")) + earned;
    const newGamesPlayed = parseInt(String(user.games_played ?? user.gamesPlayed ?? "0")) + parseInt(String(guest.games_played ?? guest.gamesPlayed ?? "0"));
    const newTotalWins = parseInt(String(user.total_wins ?? user.totalWins ?? "0")) + parseInt(String(guest.total_wins ?? guest.totalWins ?? "0"));
    const newTotalLosses = parseInt(String(user.total_losses ?? user.totalLosses ?? "0")) + parseInt(String(guest.total_losses ?? guest.totalLosses ?? "0"));
    const newTotalProfit = parseFloat(String(user.total_profit ?? user.totalProfit ?? "0")) + parseFloat(String(guest.total_profit ?? guest.totalProfit ?? "0"));
    const newBiggestWin = Math.max(parseFloat(String(user.biggest_win ?? user.biggestWin ?? "0")), parseFloat(String(guest.biggest_win ?? guest.biggestWin ?? "0")));
    const newBiggestBet = Math.max(parseFloat(String(user.biggest_bet ?? user.biggestBet ?? "0")), parseFloat(String(guest.biggest_bet ?? guest.biggestBet ?? "0")));
    await updateTable(
      "users",
      {
        balance: newBalance.toFixed(2),
        games_played: newGamesPlayed.toString(),
        total_wins: newTotalWins.toString(),
        total_losses: newTotalLosses.toString(),
        total_profit: newTotalProfit.toFixed(2),
        biggest_win: newBiggestWin.toFixed(2),
        biggest_bet: newBiggestBet.toFixed(2),
      },
      { id: userId }
    );
  }

  await deleteFrom("users", { id: guestId });

  if (remainingBase > 0) {
    const pool = await selectOne("pool");
    if (pool) {
      await updateTable("pool", { total_amount: (parseFloat(String(pool.total_amount ?? pool.totalAmount ?? "0")) + remainingBase).toFixed(2) }, { id: pool.id });
    }
    await addLedgerEntry({
      eventType: "account_deletion_returned",
      direction: "out",
      amount: remainingBase,
      description: `Guest account merged: ${remainingBase.toFixed(2)} base balance returned to pool`,
      targetUserId: null,
    });
  }
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password, email, referralCode } = parsed.data;

  const existing = await selectOne("users", ["id"], { username });
  if (existing) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  // Check if the current session belongs to a guest — if so, inherit their balance
  const prevGuestId = req.session.userId ?? null;
  let guestData: any | null = null;
  if (prevGuestId) {
    const guestCheck = await selectOne("users", undefined, { id: prevGuestId });
    if (guestCheck && (guestCheck.is_guest ?? guestCheck.isGuest)) {
      guestData = guestCheck;
    }
  }

  // Starting balance: guest's current balance if converting, otherwise fresh $10,000
  const guestBalance = guestData ? parseFloat(String(guestData.balance ?? "0")) : null;
  let startingBalance = guestBalance ?? 10000;

  let referrerId: number | null = null;
  let referralBonusAmount = 0;

  if (referralCode) {
    const referrer = await selectOne("users", undefined, { referral_code: referralCode.toUpperCase() });
    if (referrer) {
      referrerId = referrer.id;
      referralBonusAmount = guestData ? 20000 : 20000;
      startingBalance += referralBonusAmount;
      const referrerNewBalance = parseFloat(String(referrer.balance ?? "0")) + 10000;
      await updateTable("users", { balance: referrerNewBalance.toFixed(2) }, { id: referrerId });
      await addLedgerEntry({
        eventType: "referral_bonus",
        direction: "in",
        amount: 10000,
        description: `Referral bonus: ${referrer.username} received $10,000 for referring ${username}`,
        targetUserId: referrerId,
      });
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const newReferralCode = await makeUniqueReferralCode();

  const created = await insertInto(
    "users",
    {
      username,
      password_hash: passwordHash,
      email: email ?? null,
      balance: startingBalance.toFixed(2),
      referral_code: newReferralCode,
      referred_by: referrerId ?? null,
      // Carry over guest stats if converting
      games_played: guestData?.games_played ?? guestData?.gamesPlayed ?? "0",
      total_wins: guestData?.total_wins ?? guestData?.totalWins ?? "0",
      total_losses: guestData?.total_losses ?? guestData?.totalLosses ?? "0",
      total_profit: guestData?.total_profit ?? guestData?.totalProfit ?? "0.00",
      biggest_win: guestData?.biggest_win ?? guestData?.biggestWin ?? "0.00",
      biggest_bet: guestData?.biggest_bet ?? guestData?.biggestBet ?? "0.00",
    },
    true
  );
  const user = Array.isArray(created) && created[0] ? created[0] : null;

  if (guestData) {
    // Guest is converting — no new base money created (the pool already funded the guest account).
    // Only log if a referral bonus was also applied on top.
    if (referralBonusAmount > 0) {
      await addLedgerEntry({
        eventType: "referral_bonus",
        direction: "in",
        amount: referralBonusAmount,
        description: `Referral signup bonus: ${username} received $${referralBonusAmount.toFixed(2)} on top of guest balance`,
        targetUserId: user.id,
      });
    }
    // Delete the guest — balance has moved to the new account, nothing returned to pool
    await deleteFrom("users", { id: guestData.id });
  } else {
    // Fresh registration — log the new money entering the system
    await addLedgerEntry({
      eventType: "account_creation",
      direction: "in",
      amount: startingBalance,
      description: `New account created: ${username} received $${startingBalance.toFixed(2)} starting balance`,
      targetUserId: user.id,
    });
  }

  req.session.userId = user.id;

  const fresh = (await selectOne("users", undefined, { id: user.id })) || user;

  const response = RegisterResponse.parse({
    user: formatUser(fresh ?? user),
    message: referrerId
      ? `Registration successful! You received a $20,000 referral bonus!`
      : guestData
        ? `Welcome! Your guest balance of $${guestBalance!.toFixed(2)} has been carried over.`
        : "Registration successful",
  });

  res.json(response);
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;

  const user = await selectOne("users", undefined, { username });

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash ?? user.passwordHash ?? "");
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const prevGuestId = req.session.userId;
  req.session.userId = user.id;
  if (prevGuestId && prevGuestId !== user.id) {
    await mergeGuestIntoUser(prevGuestId, user.id).catch(() => {});
  }

  const merged = (await selectOne("users", undefined, { id: user.id })) || user;

  const response = LoginResponse.parse({
    user: formatUser(merged ?? user),
    message: "Login successful",
  });

  res.json(response);
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy((err) => {
    res.clearCookie("connect.sid");
    if (err) {
      res.status(500).json({ error: "Logout failed" });
    } else {
      res.json(LogoutResponse.parse({ message: "Logged out" }));
    }
  });
});

let cachedCGPublicKey: string | null = null;
let cachedCGPublicKeyAt = 0;

async function getCrazyGamesPublicKey(): Promise<string> {
  const now = Date.now();
  if (cachedCGPublicKey && now - cachedCGPublicKeyAt < 3_600_000) {
    return cachedCGPublicKey;
  }
  const res = await fetch("https://sdk.crazygames.com/publicKey.json");
  if (!res.ok) throw new Error("Failed to fetch CrazyGames public key");
  const data = await res.json() as { publicKey: string };
  cachedCGPublicKey = data.publicKey;
  cachedCGPublicKeyAt = now;
  return cachedCGPublicKey;
}

router.post("/auth/crazygames", async (req, res): Promise<void> => {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  let payload: { userId: string; username: string; profilePictureUrl?: string };
  try {
    const publicKey = await getCrazyGamesPublicKey();
    payload = jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as typeof payload;
  } catch (err) {
    res.status(401).json({ error: "Invalid CrazyGames token" });
    return;
  }

  const { userId: cgUserId, username: cgUsername, profilePictureUrl } = payload;

  let user = await selectOne("users", undefined, { crazy_games_user_id: cgUserId });

  if (!user) {
    let baseUsername = cgUsername || `cg_${cgUserId.slice(0, 8)}`;
    let finalUsername = baseUsername;
    let attempt = 0;
    while (true) {
      const existing = await selectOne("users", ["id"], { username: finalUsername });
      if (!existing) break;
      attempt++;
      finalUsername = `${baseUsername}_${attempt}`;
    }

    const dummyHash = await bcrypt.hash(`cg-${cgUserId}-${Date.now()}`, 10);
    const newReferralCode = await makeUniqueReferralCode();

    const created = await insertInto(
      "users",
      {
        username: finalUsername,
        password_hash: dummyHash,
        avatar_url: profilePictureUrl ?? null,
        referral_code: newReferralCode,
        crazy_games_user_id: cgUserId,
        is_crazy_games_linked: true,
      },
      true
    );
    user = Array.isArray(created) && created[0] ? created[0] : user;

    await addLedgerEntry({
      eventType: "account_creation",
      direction: "in",
      amount: 10000,
      description: `New CrazyGames account: ${finalUsername} received $10,000 starting balance`,
      targetUserId: user.id,
    });
  } else {
    const updates: Record<string, unknown> = { is_crazy_games_linked: true };
    if (profilePictureUrl && (user.avatar_url ?? user.avatarUrl) !== profilePictureUrl) updates.avatar_url = profilePictureUrl;
    await updateTable("users", updates, { id: user.id });
    user = { ...user, ...updates };
  }

  const prevGuestId = req.session.userId;
  req.session.userId = user.id;
  if (prevGuestId && prevGuestId !== user.id) {
    await mergeGuestIntoUser(prevGuestId, user.id).catch(() => {});
  }

  const merged = (await selectOne("users", undefined, { id: user.id })) || user;
  res.json({ user: formatUser(merged ?? user), message: "Logged in via CrazyGames" });
});

router.post("/auth/guest/init", async (req, res): Promise<void> => {
  const { deviceId } = req.body as { deviceId?: string };
  if (!deviceId || typeof deviceId !== "string" || deviceId.length < 8) {
    res.status(400).json({ error: "Invalid deviceId" });
    return;
  }

  if (req.session.userId) {
    const existing = await selectOne("users", undefined, { id: req.session.userId });
    if (existing && !(existing.is_guest ?? existing.isGuest)) {
      res.json({ user: formatUser(existing), isGuest: false });
      return;
    }
  }

  let guest = await selectOne("users", undefined, { device_id: deviceId });

  if (!guest) {
    const guestNum = Math.floor(Math.random() * 100000);
    const guestUsername = `Guest_${guestNum}`;
    const dummyHash = await bcrypt.hash(`guest-${deviceId}-${Date.now()}`, 8);

    const created = await insertInto(
      "users",
      {
        username: guestUsername,
        password_hash: dummyHash,
        device_id: deviceId,
        is_guest: true,
        balance: "10000.00",
      },
      true
    );
    guest = Array.isArray(created) && created[0] ? created[0] : guest;

    await addLedgerEntry({
      eventType: "account_creation",
      direction: "in",
      amount: 10000,
      description: `New guest account: ${guestUsername} received $10,000 starting balance`,
      targetUserId: guest.id,
    });
  }

  req.session.userId = guest.id;
  res.json({ user: formatUser(guest), isGuest: true });
});

router.post("/auth/crazygames/link", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const currentUser = await selectOne("users", undefined, { id: userId });
  if (!currentUser || (currentUser.is_guest ?? currentUser.isGuest)) {
    res.status(403).json({ error: "Must be logged in to a real account to link CrazyGames" });
    return;
  }

  if ((currentUser.is_crazy_games_linked ?? currentUser.isCrazyGamesLinked) && (currentUser.crazy_games_user_id ?? currentUser.crazyGamesUserId)) {
    res.status(400).json({ error: "CrazyGames account already linked" });
    return;
  }

  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "CrazyGames token required" });
    return;
  }

  const publicKeyUrl = "https://sdk.crazygames.com/publicKey.json";
  let publicKeyPem: string;
  try {
    const pkRes = await fetch(publicKeyUrl);
    if (!pkRes.ok) throw new Error("Failed to fetch CG public key");
    const pkData = await pkRes.json() as { publicKey: string };
    publicKeyPem = pkData.publicKey;
  } catch {
    res.status(502).json({ error: "Could not verify CrazyGames token" });
    return;
  }

  let payload: { userId: string; username?: string; profilePictureUrl?: string };
  try {
    const { createPublicKey, createVerify } = await import("crypto");
    const publicKey = createPublicKey(publicKeyPem);
    const [headerB64, payloadB64, sigB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !sigB64) throw new Error("Invalid JWT");
    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(sigB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    const verify = createVerify("sha256");
    verify.update(signingInput);
    if (!verify.verify(publicKey, signature)) throw new Error("Invalid JWT signature");
    payload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    res.status(401).json({ error: "Invalid CrazyGames token" });
    return;
  }

  const cgUserId = payload.userId;
  if (!cgUserId) {
    res.status(400).json({ error: "No user ID in CrazyGames token" });
    return;
  }

  const existingLinked = await selectOne("users", ["id"], { crazy_games_user_id: cgUserId });

  if (existingLinked && existingLinked.id !== userId) {
    res.status(409).json({ error: "This CrazyGames account is already linked to another user" });
    return;
  }

  await updateTable("users", {
    crazy_games_user_id: cgUserId,
    is_crazy_games_linked: true,
    avatar_url: payload.profilePictureUrl ?? currentUser.avatar_url ?? currentUser.avatarUrl,
  }, { id: userId });

  const updated = await selectOne("users", undefined, { id: userId });
  res.json({ user: formatUser(updated!), message: "CrazyGames account linked successfully" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = await selectOne("users", undefined, { id: userId });
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json(GetMeResponse.parse(formatUser(user)));
});

export default router;
