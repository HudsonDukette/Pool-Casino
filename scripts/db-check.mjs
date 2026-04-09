#!/usr/bin/env node
import pg from 'pg';

const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set. Provide Neon pooled URL in env var DATABASE_URL');
  process.exit(2);
}

const ssl = { rejectUnauthorized: false };

const pool = new Pool({ connectionString: url, ssl });

async function run() {
  try {
    console.log('Connecting to database...');
    const now = await pool.query('SELECT NOW() AS now');
    console.log('OK - time:', now.rows[0].now);

    try {
      const poolRow = await pool.query('SELECT id, total_amount FROM pool LIMIT 1');
      if (poolRow.rowCount > 0) {
        console.log('Found pool row:', poolRow.rows[0]);
      } else {
        console.log('No pool row found');
      }
    } catch (err) {
      console.log('Query `pool` failed (maybe table missing):', err.message);
    }

    try {
      const usersCount = await pool.query('SELECT COUNT(*)::int AS count FROM users');
      console.log('Users count:', usersCount.rows[0].count);
    } catch (err) {
      console.log('Query `users` failed (maybe table missing):', err.message);
    }

    try {
      const res = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
      console.log('Public tables sample (first 20):', res.rows.slice(0, 20).map(r => r.tablename));
    } catch (err) {
      console.log('Listing tables failed:', err.message);
    }

  } catch (err) {
    console.error('Database connectivity failed:', err.message || err);
    process.exitCode = 3;
  } finally {
    await pool.end();
  }
}

run();
