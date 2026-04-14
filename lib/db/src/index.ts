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

function createLazyProxy<T extends object>(resolveTarget: () => T): T {
  return new Proxy({} as T, {
    get(_, prop) {
      const target = resolveTarget() as any;
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(_, prop, value) {
      const target = resolveTarget() as any;
      return Reflect.set(target, prop, value, target);
    },
    has(_, prop) {
      const target = resolveTarget() as any;
      return Reflect.has(target, prop);
    },
    ownKeys() {
      const target = resolveTarget() as any;
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(_, prop) {
      const target = resolveTarget() as any;
      const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
      if (!descriptor) return undefined;
      return { ...descriptor, configurable: true };
    },
  });
}

export const pool = createLazyProxy<pg.Pool>(() => getConnection().pool);

export const db = createLazyProxy<DbInstance>(() => getConnection().db);

export * from "./schema";
