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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-action-log-"));
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

type ActionLogEntry = {
  seat: number;
  action: string;
  amount?: number;
  street: string;
};

type HandBody = {
  street: string;
  actingSeat: number | null;
  legalActions: string[];
  result: unknown;
  actionLog: ActionLogEntry[];
  seats: { index: number; kind: string; stack: number }[];
};

const AMOUNT_LESS_ACTIONS = new Set(["fold", "check"]);

test("the action log records every seat's action in the order it happened, with amounts only on chip-committing actions", async () => {
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
    assert.equal(started.status, 200);
    const body = started.body as HandBody;

    // Computer seats acting before the human comes back around (seats 3,
    // 4, 5) have already been logged by the time this response returns.
    assert.ok(body.actionLog.length >= 1, "expected at least one logged computer action");
    for (const entry of body.actionLog) {
      assert.equal(entry.street, "preflop");
      assert.ok(entry.seat >= 1 && entry.seat <= 5, "blinds/preflop opener are computer seats");
      if (AMOUNT_LESS_ACTIONS.has(entry.action)) {
        assert.equal(entry.amount, undefined, `${entry.action} should not carry an amount`);
      } else {
        assert.equal(typeof entry.amount, "number", `${entry.action} should carry an amount`);
      }
    }

    // The human's own action gets appended, not prepended or reordered.
    const beforeLength = body.actionLog.length;
    const acted = await json(app.base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: body.legalActions.includes("call") ? "call" : "fold" }),
      headers: { cookie: alice.cookie },
    });
    assert.equal(acted.status, 200);
    const afterBody = acted.body as HandBody;
    assert.ok(afterBody.actionLog.length > beforeLength);
    assert.deepEqual(
      afterBody.actionLog.slice(0, beforeLength),
      body.actionLog,
      "earlier entries are preserved, not rewritten",
    );
    assert.equal(afterBody.actionLog[beforeLength]?.seat, 0, "the human's entry comes right after their turn");
  } finally {
    await app.close();
  }
});

test("the action log resets to empty at the start of each new hand", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });

    let settled: HandBody | undefined;
    for (let step = 0; step < 100 && !settled; step++) {
      const started = await json(app.base, "/api/hand/start", {
        method: "POST",
        body: "{}",
        headers: { cookie: alice.cookie },
      });
      if (started.status !== 200) {
        break; // felted before a second hand could start
      }
      let current = started.body as HandBody;
      assert.ok(current.actionLog.length > 0, "a freshly dealt hand already has computer preflop action logged");
      for (let i = 0; i < 100 && !current.result; i++) {
        const chosen = current.legalActions.includes("check") ? "check" : "call";
        const next = await json(app.base, "/api/hand/action", {
          method: "POST",
          body: JSON.stringify({ action: chosen }),
          headers: { cookie: alice.cookie },
        });
        assert.equal(next.status, 200);
        current = next.body as HandBody;
      }
      settled = current;
    }
    assert.ok(settled, "expected at least one hand to reach settlement");

    if (settled.seats[0].stack === 0) {
      return; // felted at showdown — no next hand to start
    }
    const nextStarted = await json(app.base, "/api/hand/start", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    if (nextStarted.status !== 200) {
      return; // felted between hands
    }
    const nextBody = nextStarted.body as HandBody;
    for (const entry of nextBody.actionLog) {
      assert.equal(entry.street, "preflop", "a new hand's log contains only its own (preflop) actions so far");
    }
  } finally {
    await app.close();
  }
});

test("the frontend highlights the acting seat and shows a turn indicator and action log", () => {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  const handBlock = main.match(
    /function renderHand[\s\S]*?(?=\nfunction seatLabel)/,
  )?.[0];
  assert.ok(handBlock, "renderHand function not found");
  assert.match(handBlock, /data-acting/);
  assert.match(handBlock, /hand\.actingSeat/);
  assert.match(handBlock, /data-turn/);
  assert.match(handBlock, /renderActionLog\(hand\.actionLog\)/);

  const logBlock = main.match(
    /function renderActionLog[\s\S]*?(?=\nfunction )/,
  )?.[0];
  assert.ok(logBlock, "renderActionLog function not found");
  assert.match(logBlock, /data-action-log/);
  assert.match(logBlock, /data-street-tag/);
});
