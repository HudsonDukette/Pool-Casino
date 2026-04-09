import { pool, db as drizzleDb } from "@workspace/db";

function buildSelectColumns(cols?: string[] | object) {
  if (!cols) return "*";
  if (Array.isArray(cols)) return cols.join(",");
  return Object.keys(cols).join(",");
}

function buildWhere(filter?: Record<string, any>, startIndex = 1) {
  if (!filter || Object.keys(filter).length === 0) return { clause: "", params: [] as any[] };
  const keys = Object.keys(filter);
  const parts = keys.map((k, i) => `${k} = $${i + startIndex}`);
  const params = keys.map((k) => (filter as any)[k]);
  return { clause: `WHERE ${parts.join(" AND ")}`, params };
}

async function queryRows(sql: string, params: any[] = []) {
  const res = await (pool as any).query(sql, params);
  return res.rows as any[];
}

export async function selectOne(table: string, cols?: string[] | object, filter?: Record<string, any>) {
  const select = buildSelectColumns(cols);
  const where = buildWhere(filter);
  const sql = `SELECT ${select} FROM ${table} ${where.clause} LIMIT 1`;
  const rows = await queryRows(sql, where.params);
  return rows[0] ?? null;
}

export async function selectMany(table: string, cols?: string[] | object, filter?: Record<string, any>, limit?: number) {
  const select = buildSelectColumns(cols);
  const where = buildWhere(filter);
  const lim = limit ? `LIMIT ${limit}` : "";
  const sql = `SELECT ${select} FROM ${table} ${where.clause} ${lim}`;
  const rows = await queryRows(sql, where.params);
  return rows;
}

export async function insertInto(table: string, values: any, returning = false) {
  const keys = Object.keys(values);
  const params = keys.map((k) => values[k]);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(",");
  const sql = `INSERT INTO ${table} (${keys.join(",")}) VALUES (${placeholders}) ${returning ? "RETURNING *" : ""}`;
  const rows = await queryRows(sql, params);
  return returning ? rows : rows;
}

export async function updateTable(table: string, values: any, filter?: Record<string, any>, returning = false) {
  const keys = Object.keys(values);
  const setParts = keys.map((k, i) => `${k} = $${i + 1}`);
  const setParams = keys.map((k) => values[k]);
  const where = buildWhere(filter, keys.length + 1);
  const sql = `UPDATE ${table} SET ${setParts.join(",")} ${where.clause} ${returning ? "RETURNING *" : ""}`;
  const rows = await queryRows(sql, [...setParams, ...where.params]);
  return returning ? rows : rows;
}

export async function deleteFrom(table: string, filter?: Record<string, any>) {
  const where = buildWhere(filter);
  const sql = `DELETE FROM ${table} ${where.clause} RETURNING *`;
  const rows = await queryRows(sql, where.params);
  return rows;
}

export async function transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  // Prefer Drizzle transaction if available
  if ((drizzleDb as any)?.transaction) {
    return await (drizzleDb as any).transaction(async (tx: any) => fn(tx));
  }

  // Fallback to explicit client transaction using pg pool
  const client = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const txClient = { query: (sql: string, params?: any[]) => client.query(sql, params) };
    const result = await fn(txClient);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export default {
  selectOne,
  selectMany,
  insertInto,
  updateTable,
  deleteFrom,
  transaction,
};
