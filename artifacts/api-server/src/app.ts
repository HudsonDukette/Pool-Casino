import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool, hasDatabaseUrl } from "@workspace/db";

const PgSession = connectPgSimple(session);

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(
  cors({
    origin: allowedOrigin
      ? [allowedOrigin, /\.replit\.dev$/, /\.repl\.co$/, /\.vercel\.app$/]
      : true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

const isProd = process.env.NODE_ENV === "production";

const sessionStore = hasDatabaseUrl()
  ? new PgSession({
      pool: pool as any,
      tableName: "session",
      createTableIfMissing: true,
      disableTouch: true,
      ttl: 30 * 24 * 60 * 60,
    })
  : undefined;

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET ?? "poolcasino-dev-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", router);

app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? 500;
  if (status >= 500) logger.error({ err }, "Unhandled route error");
  res.status(status).json({ error: err.message || "Internal server error" });
});

export default app;
