import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterBody, LoginBody, RegisterResponse, LoginResponse, GetMeResponse, LogoutResponse } from "@workspace/api-zod";

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
    const existing = await db.select().from(usersTable).where(eq(usersTable.referralCode, code)).limit(1);
    if (existing.length === 0) return code;
  }
  return generateReferralCode() + Date.now().toString(36).slice(-4).toUpperCase();
}

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    email: user.email ?? null,
    balance: parseFloat(user.balance),
    isAdmin: user.isAdmin,
    referralCode: user.referralCode ?? null,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password, email, referralCode } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  let referrerId: number | null = null;
  let bonusBalance = 10000;

  if (referralCode) {
    const referrer = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode.toUpperCase())).limit(1);
    if (referrer.length > 0) {
      referrerId = referrer[0].id;
      bonusBalance += 20000;
      const referrerNewBalance = parseFloat(referrer[0].balance) + 10000;
      await db.update(usersTable).set({ balance: referrerNewBalance.toFixed(2) }).where(eq(usersTable.id, referrerId));
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const newReferralCode = await makeUniqueReferralCode();

  const [user] = await db
    .insert(usersTable)
    .values({
      username,
      passwordHash,
      email: email ?? null,
      balance: bonusBalance.toFixed(2),
      referralCode: newReferralCode,
      referredBy: referrerId ?? undefined,
    })
    .returning();

  req.session.userId = user.id;

  const response = RegisterResponse.parse({
    user: formatUser(user),
    message: referrerId
      ? `Registration successful! You received a $20,000 referral bonus!`
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

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  req.session.userId = user.id;

  const response = LoginResponse.parse({
    user: formatUser(user),
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

  let [user] = await db.select().from(usersTable).where(eq(usersTable.crazyGamesUserId, cgUserId)).limit(1);

  if (!user) {
    let baseUsername = cgUsername || `cg_${cgUserId.slice(0, 8)}`;
    let finalUsername = baseUsername;
    let attempt = 0;
    while (true) {
      const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, finalUsername)).limit(1);
      if (existing.length === 0) break;
      attempt++;
      finalUsername = `${baseUsername}_${attempt}`;
    }

    const dummyHash = await bcrypt.hash(`cg-${cgUserId}-${Date.now()}`, 10);
    const newReferralCode = await makeUniqueReferralCode();

    [user] = await db
      .insert(usersTable)
      .values({
        username: finalUsername,
        passwordHash: dummyHash,
        avatarUrl: profilePictureUrl ?? null,
        referralCode: newReferralCode,
        crazyGamesUserId: cgUserId,
      })
      .returning();
  } else if (profilePictureUrl && user.avatarUrl !== profilePictureUrl) {
    await db.update(usersTable).set({ avatarUrl: profilePictureUrl }).where(eq(usersTable.id, user.id));
    user.avatarUrl = profilePictureUrl;
  }

  req.session.userId = user.id;
  res.json({ user: formatUser(user), message: "Logged in via CrazyGames" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json(GetMeResponse.parse(formatUser(user)));
});

export default router;
