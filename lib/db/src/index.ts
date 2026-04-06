import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

let _pool: pg.Pool | null = null;
let _db: DbInstance | null = null;

function getConnection(): { pool: pg.Pool; db: DbInstance } {
  if (_db && _pool) return { pool: _pool, db: _db };

  const url =
    process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL (or SUPABASE_DATABASE_URL) must be set.",
    );
  }

  const sslEnabled =
    process.env.DATABASE_SSL === "true" ||
    url.includes("sslmode=require") ||
    url.includes("supabase.co");

  _pool = new Pool({
    connectionString: url,
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
