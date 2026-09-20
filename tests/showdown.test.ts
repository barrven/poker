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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-showdown-"));
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

async function register(base: string, username: string): Promise<{ cookie: string }> {
  const result = await json(base, "/api/register", {
    method: "POST",
    body: JSON.stringify({ username, password: "secret" }),
  });
  assert.equal(result.status, 201);
  assert.ok(result.cookie);
  return { cookie: result.cookie };
}

type HandBody = {
  actingSeat: number | null;
  legalActions: string[];
  seats: { index: number; stack: number }[];
  result: {
    reason: string;
    pot: number;
    winners: { seat: number; delta: number }[];
    revealed?: { seat: number; cards: string[]; category: string }[];
  } | null;
};

// Plays the human's seat with the simplest always-legal action (check when
// free, otherwise call) until the hand settles or a decision cap is hit —
// outcome-agnostic on purpose, since the live API deals real random cards
// (no seeded rng is exposed over HTTP, deliberately: never let a client
// control server-side randomness).
async function playToSettlement(
  base: string,
  cookie: string,
  startBody: HandBody,
): Promise<HandBody> {
  let body = startBody;
  for (let i = 0; i < 8 && !body.result; i++) {
    assert.equal(body.actingSeat, 0, "expected the human to be on the clock");
    const action = body.legalActions.includes("check") ? "check" : "call";
    const next = await json(base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action }),
      headers: { cookie },
    });
    assert.equal(next.status, 200);
    body = next.body as HandBody;
  }
  assert.ok(body.result, "hand did not settle within the expected number of decisions");
  return body;
}

test("after a hand settles, the human's SQLite tab reflects the stack change — win or lose (spec requirement 18)", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    const tabBeforeHand = 800; // 1000 starting tab - 200 buy-in
    const started = await json(app.base, "/api/hand/start", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(started.status, 200);
    const settled = await playToSettlement(app.base, alice.cookie, started.body as HandBody);

    const finalStack = settled.seats[0].stack;
    const expectedTab = tabBeforeHand + (finalStack - 200);
    const me = await json(app.base, "/api/me", { headers: { cookie: alice.cookie } });
    assert.equal((me.body as { tab: number }).tab, expectedTab);

    const row = app.db
      .prepare("SELECT tab FROM users WHERE username = ?")
      .get("alice") as { tab: number };
    assert.equal(row.tab, expectedTab);
  } finally {
    await app.close();
  }
});

test("a settled hand reveals showdown hole cards with a hand-category name, and offers no further actions", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    const started = await json(app.base, "/api/hand/start", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    const settled = await playToSettlement(app.base, alice.cookie, started.body as HandBody);

    assert.equal(settled.result?.reason, "showdown");
    assert.ok(settled.result?.revealed && settled.result.revealed.length > 0);
    for (const entry of settled.result?.revealed ?? []) {
      assert.equal(entry.cards.length, 2);
      assert.equal(typeof entry.category, "string");
      assert.ok(entry.category.length > 0);
    }
    assert.equal(settled.actingSeat, null);
    assert.deepEqual(settled.legalActions, []);

    // Trying to act on a settled hand is rejected.
    const rejected = await json(app.base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: "check" }),
      headers: { cookie: alice.cookie },
    });
    assert.equal(rejected.status, 400);
  } finally {
    await app.close();
  }
});

test("a new hand can be dealt after the previous one settles", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    const started = await json(app.base, "/api/hand/start", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    await playToSettlement(app.base, alice.cookie, started.body as HandBody);

    const dealAgain = await json(app.base, "/api/hand/start", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(dealAgain.status, 200);
    const view = dealAgain.body as HandBody & { result: unknown; street: string };
    assert.equal(view.result, null);
  } finally {
    await app.close();
  }
});

test("the pot is fully paid out at settlement: total chips across all six seats is conserved (200 x 6 = 1200)", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    const started = await json(app.base, "/api/hand/start", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    const settled = await playToSettlement(app.base, alice.cookie, started.body as HandBody);
    // Chips only ever move between seats and the pot; once the pot is
    // fully awarded, the six 200-chip buy-ins must still sum to 1200 —
    // nothing created or destroyed.
    const settledTotal = settled.seats.reduce((a, b) => a + b.stack, 0);
    assert.equal(settledTotal, 1200);
  } finally {
    await app.close();
  }
});

test("the app shows the settlement result and a real 'Deal next hand' control wired to POST /api/hand/start", () => {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  const settlementBlock = main.match(
    /function renderSettlement[\s\S]*?(?=\nfunction )/,
  )?.[0];
  assert.ok(settlementBlock, "renderSettlement function not found");
  assert.match(settlementBlock, /data-result/);
  assert.match(settlementBlock, /data-revealed/);
  assert.match(settlementBlock, /id="deal"/);
  assert.match(settlementBlock, />Deal next hand</);
  assert.match(main, /hand\.result/);
  assert.match(main, /\/api\/hand\/start/);
});
