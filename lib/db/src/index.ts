import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const sslEnabled =
  process.env.DATABASE_SSL === "true" ||
  (process.env.DATABASE_URL?.includes("sslmode=require") ?? false);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
