import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = path.resolve(process.cwd(), "data");
export const dbPath = path.join(dataDir, "poker.sqlite");

export function openDb(): DatabaseSync {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  db.prepare(
    "INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1')",
  ).run();
  return db;
}

export function pingDb(db: DatabaseSync): boolean {
  const row = db.prepare("SELECT 1 AS x").get() as { x: number } | undefined;
  return row?.x === 1;
}
