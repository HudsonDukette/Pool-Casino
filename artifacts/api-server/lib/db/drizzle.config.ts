import { defineConfig } from "drizzle-kit";
import path from "path";

const url =
  process.env.SUPABASE_DATABASE_URL ??
  process.env.DATABASE_URL ??
  process.env.NETLIFY_DATABASE_URL ??
  process.env.NEON_DATABASE_URL ??
  process.env.POSTGRES_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./drizzle"),
  dialect: "postgresql",
  dbCredentials: {
    url,
    ssl: url.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  },
});
