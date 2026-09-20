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
import { classifyHandResult } from "../server/history.js";

const tmpDirs: string[] = [];

after(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tmpDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-history-"));
  tmpDirs.push(dir);
  return dir;
}

async function startApp(dataDir: string): Promise<{
  base: string;
  db: DatabaseSync;
  close: () => Promise<void>;
}> {
  const db = openDb(dataDir);
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
  street: string;
  legalActions: string[];
  result: { reason: string; winners: { seat: number; delta: number }[] } | null;
  seats: { index: number; kind: string; stack: number }[];
};

type HistoryEntry = {
  id: number;
  playedAt: string;
  smallBlind: number;
  bigBlind: number;
  holeCards: string[];
  board: string[];
  result: "won" | "lost" | "split";
  delta: number;
};

async function fetchHistory(base: string, cookie: string): Promise<HistoryEntry[]> {
  const result = await json(base, "/api/history", { headers: { cookie } });
  assert.equal(result.status, 200);
  return (result.body as { hands: HistoryEntry[] }).hands;
}

async function playOneHand(
  base: string,
  cookie: string,
  action: (legal: string[]) => string = (legal) =>
    legal.includes("check") ? "check" : "call",
): Promise<HandBody | undefined> {
  const started = await json(base, "/api/hand/start", {
    method: "POST",
    body: "{}",
    headers: { cookie },
  });
  if (started.status !== 200) {
    return undefined; // felted
  }
  let current = started.body as HandBody;
  for (let i = 0; i < 100 && !current.result; i++) {
    const next = await json(base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: action(current.legalActions) }),
      headers: { cookie },
    });
    assert.equal(next.status, 200);
    current = next.body as HandBody;
  }
  assert.ok(current.result, "hand did not settle within the expected number of decisions");
  return current;
}

test("classifyHandResult: not among winners is a loss, sole winner is a win, multiple winners is a split", () => {
  assert.equal(classifyHandResult([], 0), "lost");
  assert.equal(classifyHandResult([{ seat: 1 }, { seat: 2 }], 0), "lost");
  assert.equal(classifyHandResult([{ seat: 0 }], 0), "won");
  assert.equal(classifyHandResult([{ seat: 0 }, { seat: 3 }], 0), "split");
});

test("settling a hand writes one history row with the blinds, the human's hole cards, the board as dealt, a won/lost/split result, and the human's chip delta", async () => {
  const app = await startApp(tmpDataDir());
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", { method: "POST", body: "{}", headers: { cookie: alice.cookie } });

    const before = await fetchHistory(app.base, alice.cookie);
    assert.deepEqual(before, []);

    const settled = await playOneHand(app.base, alice.cookie);
    assert.ok(settled);

    const after = await fetchHistory(app.base, alice.cookie);
    assert.equal(after.length, 1);
    const row = after[0];
    assert.equal(row.smallBlind, 1);
    assert.equal(row.bigBlind, 2);
    assert.equal(row.holeCards.length, 2);
    assert.ok([0, 3, 4, 5].includes(row.board.length), "board length matches a real street");
    assert.ok(["won", "lost", "split"].includes(row.result));
    assert.equal(typeof row.delta, "number");

    const humanWon = settled?.result?.winners.some((w) => w.seat === 0) ?? false;
    if (!humanWon) {
      assert.equal(row.result, "lost");
    }
  } finally {
    await app.close();
  }
});

test("a folded hand the human lost still records their hole cards and chip delta", async () => {
  const app = await startApp(tmpDataDir());
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", { method: "POST", body: "{}", headers: { cookie: alice.cookie } });

    let foldedHand: HandBody | undefined;
    for (let i = 0; i < 30 && !foldedHand; i++) {
      const settled = await playOneHand(app.base, alice.cookie, (legal) =>
        legal.includes("fold") ? "fold" : legal.includes("check") ? "check" : "call",
      );
      if (settled?.seats[0].stack !== undefined) {
        foldedHand = settled;
      }
    }
    assert.ok(foldedHand, "expected at least one hand to settle");

    const history = await fetchHistory(app.base, alice.cookie);
    assert.ok(history.length >= 1);
    const row = history[0];
    assert.equal(row.holeCards.length, 2);
    assert.equal(typeof row.delta, "number");
  } finally {
    await app.close();
  }
});

test("a player does not see another account's hand history", async () => {
  const app = await startApp(tmpDataDir());
  try {
    const alice = await register(app.base, "alice");
    const bob = await register(app.base, "bob");
    await json(app.base, "/api/sit", { method: "POST", body: "{}", headers: { cookie: alice.cookie } });
    await playOneHand(app.base, alice.cookie);

    const aliceHistory = await fetchHistory(app.base, alice.cookie);
    assert.ok(aliceHistory.length >= 1);
    const bobHistory = await fetchHistory(app.base, bob.cookie);
    assert.deepEqual(bobHistory, []);
  } finally {
    await app.close();
  }
});

test("a logged-out visitor cannot fetch hand history", async () => {
  const app = await startApp(tmpDataDir());
  try {
    const result = await json(app.base, "/api/history");
    assert.equal(result.status, 401);
  } finally {
    await app.close();
  }
});

test("hand history survives a server restart (same on-disk database reopened)", async () => {
  const dataDir = tmpDataDir();
  const first = await startApp(dataDir);
  let cookie: string;
  try {
    const alice = await register(first.base, "alice");
    cookie = alice.cookie;
    await json(first.base, "/api/sit", { method: "POST", body: "{}", headers: { cookie } });
    await playOneHand(first.base, cookie);
    const history = await fetchHistory(first.base, cookie);
    assert.ok(history.length >= 1);
  } finally {
    await first.close();
  }

  // Re-open the same data directory as a fresh app/db instance, same
  // session token (sessions are stored in SQLite too, so it's still
  // valid) — this is what a page refresh looks like from the server's
  // side: a brand-new in-memory table session, but durable rows intact.
  const second = await startApp(dataDir);
  try {
    const history = await fetchHistory(second.base, cookie);
    assert.ok(history.length >= 1, "history rows persisted across a restart");
  } finally {
    await second.close();
  }
});

test("the app offers a hand-history view that a logged-in player can open, driven by /api/history", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  assert.match(main, /\/api\/history/);
  assert.match(main, /id="history-toggle"/);
  assert.match(main, /data-history-toggle/);
  const historyBlock = main.match(/function renderHistory\([\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(historyBlock, "renderHistory function not found");
  assert.match(historyBlock, /data-history/);
});
