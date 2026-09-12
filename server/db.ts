import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const defaultDataDir = path.resolve(process.cwd(), "data");
export const sqliteFileName = "poker.sqlite";
export const schemaVersion = "2";

export function sqlitePath(dataDir = defaultDataDir): string {
  return path.join(dataDir, sqliteFileName);
}

export function openDb(dataDir = defaultDataDir): DatabaseSync {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(sqlitePath(dataDir));
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.prepare(
    "INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(schemaVersion);
  return db;
}

export function pingDb(db: DatabaseSync): boolean {
  const row = db.prepare("SELECT 1 AS x").get() as { x: number } | undefined;
  return row?.x === 1;
}
