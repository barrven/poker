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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-rebuy-"));
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

function errorMessage(body: unknown): string {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    assert.fail(`expected error object, got ${JSON.stringify(body)}`);
  }
  const message = (body as { error: unknown }).error;
  assert.equal(typeof message, "string");
  return message as string;
}

type Session = { username: string; tab: number; seated: boolean; stack: number };

type HandBody = {
  legalActions: string[];
  result: unknown;
  seats: { index: number; stack: number }[];
};

// Shoves every hand (high variance, reliably busts within a handful of
// hands against five opponents) until the human's table stack hits 0.
// Probabilistic by nature (no seeded rng exposed over HTTP, deliberately)
// — the 50-hand budget makes a false failure vanishingly unlikely, same
// approach as feature 010's equivalent test.
async function bustTheHuman(base: string, cookie: string): Promise<void> {
  for (let hand = 0; hand < 50; hand++) {
    const started = await json(base, "/api/hand/start", {
      method: "POST",
      body: "{}",
      headers: { cookie },
    });
    if (started.status !== 200) {
      return; // already felted
    }
    let body = started.body as HandBody;
    for (let step = 0; step < 200 && !body.result; step++) {
      const legal = body.legalActions;
      const action = legal.includes("all-in") ? "all-in" : legal.includes("call") ? "call" : "fold";
      const next = await json(base, "/api/hand/action", {
        method: "POST",
        body: JSON.stringify({ action }),
        headers: { cookie },
      });
      assert.equal(next.status, 200);
      body = next.body as HandBody;
    }
    if (body.seats[0].stack === 0) {
      return;
    }
  }
  assert.fail("human never busted after 50 all-in hands");
}

test("rebuying while felted deducts 200 from the tab and restores a 200-chip table stack", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    await bustTheHuman(app.base, alice.cookie);

    const before = await json(app.base, "/api/me", { headers: { cookie: alice.cookie } });
    const tabBefore = (before.body as Session).tab;
    assert.equal((before.body as Session).stack, 0);
    assert.ok(tabBefore >= 200, "test assumes the human still has a tab to rebuy from");

    const rebought = await json(app.base, "/api/table/rebuy", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(rebought.status, 200);
    const session = rebought.body as Session;
    assert.equal(session.stack, 200);
    assert.equal(session.tab, tabBefore - 200);

    // A new hand can be dealt again now.
    const dealt = await json(app.base, "/api/hand/start", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(dealt.status, 200);

    // SQLite reflects the rebuy directly.
    const row = app.db
      .prepare("SELECT tab FROM users WHERE username = ?")
      .get("alice") as { tab: number };
    assert.equal(row.tab, tabBefore - 200);
  } finally {
    await app.close();
  }
});

test("rebuying is rejected when not felted, and when the tab can't cover it", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });

    // Not felted: still has a 200-chip stack from sitting.
    const tooSoon = await json(app.base, "/api/table/rebuy", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(tooSoon.status, 400);
    assert.match(errorMessage(tooSoon.body), /chips on the table/i);

    await bustTheHuman(app.base, alice.cookie);
    // Drain the tab below 200 directly (simulating a long losing
    // session) so the rebuy path specifically hits "insufficient-tab".
    app.db.prepare("UPDATE users SET tab = 50 WHERE username = 'alice'").run();

    const insufficient = await json(app.base, "/api/table/rebuy", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(insufficient.status, 400);
    assert.match(errorMessage(insufficient.body), /top up|tab/i);

    // The tab is untouched by the rejected rebuy attempt.
    const row = app.db
      .prepare("SELECT tab FROM users WHERE username = ?")
      .get("alice") as { tab: number };
    assert.equal(row.tab, 50);
  } finally {
    await app.close();
  }
});

test("topping up adds 1,000 chips to the tab, with no payment form or currency involved, and works while not seated", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    // Not seated at all yet — top-up doesn't require a table session.
    const toppedUp = await json(app.base, "/api/tab/topup", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(toppedUp.status, 200);
    const session = toppedUp.body as Session;
    assert.equal(session.tab, 2000); // 1000 starting + 1000 top-up

    const row = app.db
      .prepare("SELECT tab FROM users WHERE username = ?")
      .get("alice") as { tab: number };
    assert.equal(row.tab, 2000);
  } finally {
    await app.close();
  }
});

test("leaving while felted still settles (adds nothing, since the stack is 0) without requiring a rebuy first", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    await bustTheHuman(app.base, alice.cookie);

    const before = await json(app.base, "/api/me", { headers: { cookie: alice.cookie } });
    const tabBefore = (before.body as Session).tab;

    const left = await json(app.base, "/api/leave", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(left.status, 200);
    assert.equal((left.body as Session).tab, tabBefore);
  } finally {
    await app.close();
  }
});

test("neither rebuy nor top-up ever appears alongside real-money language", () => {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  const appSrc = fs.readFileSync(path.join(root, "server/app.ts"), "utf8");
  const tableSrc = fs.readFileSync(path.join(root, "server/table.ts"), "utf8");
  const combined = `${main}\n${appSrc}\n${tableSrc}`;
  assert.doesNotMatch(
    combined,
    /deposit|withdraw|cash-?out|cashout|stripe|paypal|venmo|credit card/i,
  );
  assert.match(main, /play-money/i);
});

test("the app offers real rebuy and top-up controls wired to the right endpoints", () => {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  const settlementBlock = main.match(
    /function renderSettlement[\s\S]*?(?=\nfunction )/,
  )?.[0];
  assert.ok(settlementBlock, "renderSettlement function not found");
  assert.match(settlementBlock, /id="rebuy"/);
  assert.match(settlementBlock, /id="topup"/);
  assert.match(main, /\/api\/table\/rebuy/);
  assert.match(main, /\/api\/tab\/topup/);
});
