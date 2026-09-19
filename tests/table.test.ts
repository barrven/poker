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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-table-"));
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

function errorMessage(body: unknown): string {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    assert.fail(`expected error object, got ${JSON.stringify(body)}`);
  }
  const message = (body as { error: unknown }).error;
  assert.equal(typeof message, "string");
  return message as string;
}

function fieldOf<T>(body: unknown, key: string): T {
  if (typeof body !== "object" || body === null || !(key in body)) {
    assert.fail(`expected ${key} in body, got ${JSON.stringify(body)}`);
  }
  return (body as Record<string, T>)[key];
}

function sqliteTab(db: DatabaseSync, username: string): number {
  const row = db
    .prepare("SELECT tab FROM users WHERE username = ?")
    .get(username) as { tab: number } | undefined;
  assert.ok(row, `missing user ${username}`);
  return Number(row.tab);
}

test("a player with at least 200 on the tab can sit down with one action", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    const sit = await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(sit.status, 200);
    assert.equal(fieldOf(sit.body, "seated"), true);
    assert.equal(fieldOf(sit.body, "stack"), 200);
  } finally {
    await app.close();
  }
});

test("sitting deducts 200 from the tab and SQLite reflects it", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    const sit = await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(fieldOf(sit.body, "tab"), 800);
    assert.equal(sqliteTab(app.db, "alice"), 800);
  } finally {
    await app.close();
  }
});

test("the table shows six seats: the human and five computer seats at 200 chips, blinds 1/2", () => {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  // Exactly one static human seat plus a loop over COMPUTER_SEATS computer
  // seats — checked as source (no jsdom in this project), so the seat
  // count is verified via the constant and the loop shape, not by counting
  // literal markup occurrences (the computer seats are generated at
  // runtime, not repeated 5x in source).
  assert.match(main, /const\s+COMPUTER_SEATS\s*=\s*5\s*;/);
  const tableBlock = main.match(
    /function renderTable[\s\S]*?(?=\nfunction escapeHtml)/,
  )?.[0];
  assert.ok(tableBlock, "renderTable function not found");
  assert.match(tableBlock, /Blinds:\s*1\/2/);
  assert.match(tableBlock, /data-seat="you"/);
  assert.match(tableBlock, /length:\s*COMPUTER_SEATS/);
  assert.match(tableBlock, /data-seat="cpu-\$\{/);
  assert.match(tableBlock, /Computer \$\{/);
  assert.match(tableBlock, /formatChips\(stack\)/);
  assert.match(tableBlock, /formatChips\(BUY_IN\)/);
  assert.doesNotMatch(tableBlock, /empty|vacant/i);
});

test("leaving the table adds the stack back to the tab and clears it; SQLite reflects the settled tab", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(sqliteTab(app.db, "alice"), 800);

    const leave = await json(app.base, "/api/leave", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(leave.status, 200);
    assert.equal(fieldOf(leave.body, "tab"), 1000);
    assert.equal(fieldOf(leave.body, "seated"), false);
    assert.equal(sqliteTab(app.db, "alice"), 1000);

    const again = await json(app.base, "/api/leave", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(again.status, 400);
  } finally {
    await app.close();
  }
});

test("ending the session from the table also settles the stack back to the tab", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(sqliteTab(app.db, "alice"), 800);

    const logout = await json(app.base, "/api/logout", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(logout.status, 200);
    assert.equal(sqliteTab(app.db, "alice"), 1000);
  } finally {
    await app.close();
  }
});

test("a player whose tab is below 200 cannot sit; the tab stays unchanged", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    app.db
      .prepare("UPDATE users SET tab = ? WHERE username = ?")
      .run(150, "alice");

    const sit = await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(sit.status, 400);
    assert.match(errorMessage(sit.body), /chips|tab/i);
    assert.equal(sqliteTab(app.db, "alice"), 150);
  } finally {
    await app.close();
  }
});

test("a logged-out visitor cannot sit, and the guest markup has no sit control", async () => {
  const app = await startApp();
  try {
    const sit = await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
    });
    assert.equal(sit.status, 401);
  } finally {
    await app.close();
  }

  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  const guestMarkup = main.match(
    /<form id="register-form">[\s\S]*?\n {2}`;/,
  )?.[0];
  assert.ok(guestMarkup, "guest markup not found");
  assert.doesNotMatch(guestMarkup, /data-sit|id="sit"/);
});

test("reloading while seated does not reset the tab; it still matches the last settlement", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });

    const first = await json(app.base, "/api/me", {
      headers: { cookie: alice.cookie },
    });
    const second = await json(app.base, "/api/me", {
      headers: { cookie: alice.cookie },
    });
    assert.equal(fieldOf(first.body, "tab"), 800);
    assert.equal(fieldOf(second.body, "tab"), 800);

    const leave = await json(app.base, "/api/leave", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(fieldOf(leave.body, "tab"), 1000);
    assert.equal(sqliteTab(app.db, "alice"), 1000);
  } finally {
    await app.close();
  }
});
