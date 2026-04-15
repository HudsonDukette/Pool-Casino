import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

type DbCache = {
  pool: pg.Pool | null;
  db: DbInstance | null;
};

const globalCache = globalThis as typeof globalThis & {
  __poolCasinoDbCache__?: DbCache;
};

const cache: DbCache = globalCache.__poolCasinoDbCache__ ?? {
  pool: null,
  db: null,
};

globalCache.__poolCasinoDbCache__ = cache;

const DATABASE_URL_KEYS = [
  "DATABASE_URL",
  "NETLIFY_DATABASE_URL",
  "NEON_DATABASE_URL",
  "POSTGRES_URL",
] as const;

function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  for (const key of DATABASE_URL_KEYS) {
    const value = env[key];
    if (value) return value;
  }
  return undefined;
}

export function hasDatabaseUrl(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(resolveDatabaseUrl(env));
}

function getConnection(): { pool: pg.Pool; db: DbInstance } {
  if (cache.db && cache.pool) return { pool: cache.pool, db: cache.db };

  const url = resolveDatabaseUrl();

  if (!url) {
    throw new Error(
      `Database URL not set. Expected one of: ${DATABASE_URL_KEYS.join(", ")}`,
    );
  }

  const sslEnabled =
    process.env.DATABASE_SSL === "true" ||
    url.includes("sslmode=require") ||
    // support Neon pooled/unpooled hostnames and Supabase legacy hosts
    url.includes("neon.tech") ||
    url.includes("pooler.c-") ||
    url.includes("supabase.co") ||
    url.includes("pooler.supabase.com");
  const isServerlessRuntime =
    process.env.NETLIFY === "true" ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.VERCEL);
  const defaultPoolMax =
    isServerlessRuntime && (url.includes("neon.tech") || url.includes("pooler"))
      ? 5
      : 20;
  const poolMax = Number(process.env.PG_POOL_MAX ?? defaultPoolMax);

  cache.pool = new Pool({
    connectionString: url,
    max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : defaultPoolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    application_name: process.env.PG_APP_NAME ?? "pool-casino-api",
    ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  cache.db = drizzle(cache.pool, { schema });

  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "unknown-host";
    }
  })();

  console.info("[db] created postgres pool", {
    host,
    max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : defaultPoolMax,
    serverlessRuntime: isServerlessRuntime,
  });

  return { pool: cache.pool, db: cache.db };
}

export const pool = new Proxy({} as pg.Pool, {
  get(_, prop) {
    return (getConnection().pool as any)[prop];
  },
});

export const db = new Proxy({} as DbInstance, {
  get(_, prop) {
    return (getConnection().db as any)[prop];
  },
});

export * from "./schema";
