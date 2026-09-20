import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { createApp } from "../server/app.js";
import { openDb, pingDb, sqlitePath } from "../server/db.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDirs: string[] = [];

after(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tmpDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-scaffold-"));
  tmpDirs.push(dir);
  return dir;
}

test("openDb creates a local SQLite file and can query it", () => {
  const dataDir = tmpDataDir();
  const file = sqlitePath(dataDir);
  assert.equal(fs.existsSync(file), false);

  const db = openDb(dataDir);
  try {
    assert.equal(fs.existsSync(file), true);
    assert.equal(pingDb(db), true);
    const row = db
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string } | undefined;
    assert.equal(row?.value, "4");
  } finally {
    db.close();
  }
});

test("GET /api/health succeeds when SQLite is open", async () => {
  const db = openDb(tmpDataDir());
  const server = createApp(db);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, db: "ok" });
  } finally {
    server.close();
    await once(server, "close");
    db.close();
  }
});

test("index.html is an app shell, not an empty error page", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /<title>Poker<\/title>/);
  assert.match(html, /id="app"/);
  assert.match(html, /src="\/src\/main\.ts"/);

  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  assert.match(main, /<h1>Poker<\/h1>/);
});

test("README documents a local start command for the app and API", () => {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  assert.match(readme, /npm run dev/);
  assert.match(readme, /localhost:5173/);
  assert.match(readme, /localhost:3001\/api\/health/);
  assert.match(readme, /npm run typecheck/);
  assert.match(readme, /npm run build/);
  assert.doesNotMatch(readme, /postgres|mongodb|planetscale|supabase/i);
});

test("package.json has TypeScript typecheck and build scripts", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };
  assert.ok(pkg.scripts?.typecheck?.includes("tsc"));
  assert.ok(pkg.scripts?.build?.includes("vite build"));
  assert.ok(pkg.scripts?.build?.includes("tsc"));
  assert.ok(pkg.scripts?.dev);
});
