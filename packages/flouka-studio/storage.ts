/**
 * Persistent key-value storage for Flouka Studio, backed by bun:sqlite.
 *
 * Replaces the browser's localStorage as the source of truth so data
 * survives the user clearing browser storage. Schema/conventions mirror
 * packages/agent/src/bun-sqlite-saver.ts (WAL mode, CREATE TABLE IF NOT EXISTS).
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const DB_PATH = process.env.FLOUKA_DB_PATH ?? resolve(import.meta.dir, "data/flouka.sqlite");
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.run("PRAGMA journal_mode=WAL");
db.run(`CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);

export type StoreKey = "flouka_master" | "flouka_settings" | "flouka_apps";

const KEYS: StoreKey[] = ["flouka_master", "flouka_settings", "flouka_apps"];

export function isStoreKey(key: string): key is StoreKey {
  return (KEYS as string[]).includes(key);
}

export function getAll(): Record<StoreKey, unknown | null> {
  const rows = db.query<{ key: string; value: string }, []>("SELECT key, value FROM kv_store").all();
  const result = {
    flouka_master: null,
    flouka_settings: null,
    flouka_apps: null,
  } as Record<StoreKey, unknown | null>;
  for (const row of rows) result[row.key as StoreKey] = JSON.parse(row.value);
  return result;
}

export function setValue(key: StoreKey, value: unknown): void {
  db.query(
    `INSERT INTO kv_store (key, value) VALUES ($key, $value)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run({ $key: key, $value: JSON.stringify(value) });
}
