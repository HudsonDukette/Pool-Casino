import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

let _pool: pg.Pool | null = null;
let _db: DbInstance | null = null;

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
  if (_db && _pool) return { pool: _pool, db: _db };

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

  _pool = new Pool({
    connectionString: url,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  _db = drizzle(_pool, { schema });
  return { pool: _pool, db: _db };
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
