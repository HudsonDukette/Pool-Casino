import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

let _pool: pg.Pool | null = null;
let _db: DbInstance | null = null;

function getConnection(): { pool: pg.Pool; db: DbInstance } {
  if (_db && _pool) return { pool: _pool, db: _db };

  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
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
