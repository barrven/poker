import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import type { DatabaseSync } from "node:sqlite";
import { createApp } from "../server/app.js";
import { openDb } from "../server/db.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDirs: string[] = [];

after(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tmpDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-tab-"));
  tmpDirs.push(dir);
  return dir;
}

async function startApp(): Promise<{
  base: string;
  db: DatabaseSync;
  close: () => Promise<void>;
}> {
  const db = openDb(tmpDataDir());
  const server = createApp(db);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    db,
    close: async () => {
      server.close();
      await once(server, "close");
      db.close();
    },
  };
}

async function json(
  base: string,
  pathName: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown; cookie: string | undefined }> {
  const response = await fetch(`${base}${pathName}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // leave as text
  }
  const setCookie = response.headers.getSetCookie?.() ?? [];
  const raw =
    setCookie[0] ?? response.headers.get("set-cookie") ?? undefined;
  const token = raw?.match(/poker_session=([^;]*)/)?.[1];
  const cookie =
    token !== undefined && token !== ""
      ? `poker_session=${token}`
      : undefined;
  return { status: response.status, body, cookie };
}

async function register(
  base: string,
  username: string,
  password = "secret",
): Promise<{ cookie: string; body: unknown }> {
  const result = await json(base, "/api/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  assert.equal(result.status, 201);
  assert.ok(result.cookie);
  return { cookie: result.cookie, body: result.body };
}

function tabOf(body: unknown): number {
  if (typeof body !== "object" || body === null || !("tab" in body)) {
    assert.fail(`expected tab in body, got ${JSON.stringify(body)}`);
  }
  assert.equal(typeof (body as { tab: unknown }).tab, "number");
  return (body as { tab: number }).tab;
}

function sqliteTab(db: DatabaseSync, username: string): number {
  const row = db
    .prepare("SELECT tab FROM users WHERE username = ?")
    .get(username) as { tab: number } | undefined;
  assert.ok(row, `missing user ${username}`);
  return Number(row.tab);
}

test("a newly registered account has a 1000-chip tab in SQLite", async () => {
  const app = await startApp();
  try {
    const registered = await register(app.base, "alice");
    assert.equal(tabOf(registered.body), 1000);
    assert.equal(sqliteTab(app.db, "alice"), 1000);
  } finally {
    await app.close();
  }
});

test("logged-in player can see the current tab amount", async () => {
  const app = await startApp();
  try {
    const registered = await register(app.base, "alice");
    const me = await json(app.base, "/api/me", {
      headers: { cookie: registered.cookie },
    });
    assert.equal(me.status, 200);
    assert.equal(tabOf(me.body), 1000);
  } finally {
    await app.close();
  }

  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  assert.match(main, /data-tab/);
  assert.match(main, /Tab:/);
  assert.match(main, /formatChips\(view\.tab\)/);
  assert.doesNotMatch(main, /id="register-form"[\s\S]*data-tab/);
});

test("reload while logged in shows the stored tab, not a reset", async () => {
  const app = await startApp();
  try {
    const registered = await register(app.base, "alice");
    app.db
      .prepare("UPDATE users SET tab = ? WHERE username = ?")
      .run(875, "alice");
    assert.equal(sqliteTab(app.db, "alice"), 875);

    const first = await json(app.base, "/api/me", {
      headers: { cookie: registered.cookie },
    });
    const second = await json(app.base, "/api/me", {
      headers: { cookie: registered.cookie },
    });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(tabOf(first.body), 875);
    assert.equal(tabOf(second.body), 875);
    assert.equal(sqliteTab(app.db, "alice"), 875);
  } finally {
    await app.close();
  }
});

test("no deposit, withdrawal, cash-out, or currency conversion control", () => {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  const appSrc = fs.readFileSync(path.join(root, "server/app.ts"), "utf8");
  const combined = `${main}\n${appSrc}`;
  assert.doesNotMatch(
    combined,
    /deposit|withdraw|cash-?out|cashout|stripe|paypal|venmo/i,
  );
  assert.doesNotMatch(combined, /\/api\/(top-?up|convert|cash)/i);
  assert.match(main, /play-money chips/i);
});

test("two accounts have independent tabs", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    const bob = await register(app.base, "bob");
    app.db
      .prepare("UPDATE users SET tab = ? WHERE username = ?")
      .run(400, "alice");

    const aliceMe = await json(app.base, "/api/me", {
      headers: { cookie: alice.cookie },
    });
    const bobMe = await json(app.base, "/api/me", {
      headers: { cookie: bob.cookie },
    });
    assert.equal(aliceMe.status, 200);
    assert.equal(bobMe.status, 200);
    assert.equal(tabOf(aliceMe.body), 400);
    assert.equal(tabOf(bobMe.body), 1000);
    assert.equal(sqliteTab(app.db, "alice"), 400);
    assert.equal(sqliteTab(app.db, "bob"), 1000);
  } finally {
    await app.close();
  }
});
