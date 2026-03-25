import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterBody, LoginBody, RegisterResponse, LoginResponse, GetMeResponse, LogoutResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password, email } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(usersTable)
    .values({
      username,
      passwordHash,
      email: email ?? null,
    })
    .returning();

  req.session.userId = user.id;

  const response = RegisterResponse.parse({
    user: {
      id: user.id,
      username: user.username,
      email: user.email ?? null,
      balance: parseFloat(user.balance),
      createdAt: user.createdAt.toISOString(),
    },
    message: "Registration successful",
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
    user: {
      id: user.id,
      username: user.username,
      email: user.email ?? null,
      balance: parseFloat(user.balance),
      createdAt: user.createdAt.toISOString(),
    },
    message: "Login successful",
  });

  res.json(response);
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {});
  res.json(LogoutResponse.parse({ message: "Logged out" }));
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

  res.json(
    GetMeResponse.parse({
      id: user.id,
      username: user.username,
      email: user.email ?? null,
      balance: parseFloat(user.balance),
      createdAt: user.createdAt.toISOString(),
    }),
  );
});

export default router;
