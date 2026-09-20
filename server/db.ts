import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const defaultDataDir = path.resolve(process.cwd(), "data");
export const sqliteFileName = "poker.sqlite";
export const schemaVersion = "4";
export const STARTING_TAB = 1000;

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
      tab INTEGER NOT NULL DEFAULT ${STARTING_TAB},
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS hand_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      played_at TEXT NOT NULL DEFAULT (datetime('now')),
      small_blind INTEGER NOT NULL,
      big_blind INTEGER NOT NULL,
      hole_cards TEXT NOT NULL,
      board TEXT NOT NULL,
      result TEXT NOT NULL,
      delta INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS hand_history_user_id_idx ON hand_history(user_id, id);
  `);
  ensureUsersTabColumn(db);
  db.prepare(
    "INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(schemaVersion);
  return db;
}

function ensureUsersTabColumn(db: DatabaseSync): void {
  const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (cols.some((col) => col.name === "tab")) {
    return;
  }
  db.exec(
    `ALTER TABLE users ADD COLUMN tab INTEGER NOT NULL DEFAULT ${STARTING_TAB}`,
  );
}

export function pingDb(db: DatabaseSync): boolean {
  const row = db.prepare("SELECT 1 AS x").get() as { x: number } | undefined;
  return row?.x === 1;
}
