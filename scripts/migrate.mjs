#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log("[migrate] DATABASE_URL not set — skipping");
  process.exit(0);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
  await client.query(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
  const applied = new Set(
    (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const name of files) {
    if (applied.has(name)) continue;
    const sql = await readFile(join(dir, name), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.log("[migrate] applied", name);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
  console.log("[migrate] done");
} finally {
  client.release();
  await pool.end();
}
