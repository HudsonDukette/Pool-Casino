import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { db as drizzleDb } from "@workspace/db";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
    : null;

function buildSelectColumns(cols?: string[] | object) {
  if (!cols) return "*";
  if (Array.isArray(cols)) return cols.join(",");
  // when object mapping provided, join keys
  return Object.keys(cols).join(",");
}

export async function selectOne(table: string, cols?: string[] | object, filter?: Record<string, any>) {
  if (!supabase) throw new Error("Supabase client not configured");
  let q = supabase.from(table).select(buildSelectColumns(cols)).limit(1);
  if (filter) {
    Object.entries(filter).forEach(([k, v]) => q = (q as any).eq(k, v));
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data as any[])[0] ?? null;
}

export async function selectMany(table: string, cols?: string[] | object, filter?: Record<string, any>, limit?: number) {
  if (!supabase) throw new Error("Supabase client not configured");
  let q: any = supabase.from(table).select(buildSelectColumns(cols));
  if (filter) Object.entries(filter).forEach(([k, v]) => (q = q.eq(k, v)));
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return data as any[];
}

export async function insertInto(table: string, values: any, returning = false) {
  if (!supabase) throw new Error("Supabase client not configured");
  const q = supabase.from(table).insert(values, { returning: returning ? "representation" : "minimal" });
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function updateTable(table: string, values: any, filter?: Record<string, any>, returning = false) {
  if (!supabase) throw new Error("Supabase client not configured");
  let q: any = supabase.from(table).update(values, { returning: returning ? "representation" : "minimal" });
  if (filter) Object.entries(filter).forEach(([k, v]) => (q = q.eq(k, v)));
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function deleteFrom(table: string, filter?: Record<string, any>) {
  if (!supabase) throw new Error("Supabase client not configured");
  let q: any = supabase.from(table).delete();
  if (filter) Object.entries(filter).forEach(([k, v]) => (q = q.eq(k, v)));
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// Provide a transaction shim that delegates to Drizzle for multi-statement transactions.
export async function transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  // drizzleDb.transaction expects a callback receiving an instance. Re-use it if available.
  if ((drizzleDb as any)?.transaction) {
    return await (drizzleDb as any).transaction(async (tx: any) => fn(tx));
  }
  // Fallback: just run the function without a real transaction (not ideal for multi-step writes)
  return await fn(null as any);
}

export default {
  supabase,
  selectOne,
  selectMany,
  insertInto,
  updateTable,
  deleteFrom,
  transaction,
};
