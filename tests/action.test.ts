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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-action-"));
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

async function sitAndDeal(
  base: string,
  cookie: string,
): Promise<Record<string, unknown>> {
  const sit = await json(base, "/api/sit", {
    method: "POST",
    body: "{}",
    headers: { cookie },
  });
  assert.equal(sit.status, 200);
  const started = await json(base, "/api/hand/start", {
    method: "POST",
    body: "{}",
    headers: { cookie },
  });
  assert.equal(started.status, 200);
  return started.body as Record<string, unknown>;
}

type ActionBody = {
  street: string;
  pot: number;
  currentBet: number;
  toCall: number;
  minRaiseSize: number;
  roundComplete: boolean;
  actingSeat: number | null;
  legalActions: string[];
  result: unknown;
  seats: { index: number; stack: number; streetContribution: number; folded: boolean; allIn: boolean }[];
};

// Keeps responding for the human with the simplest always-legal action
// (check when free, otherwise call — never raising, so the human itself
// never reopens action) until either the hand settles or it's genuinely
// not the human's turn to decide anymore. Real computer opponents (this
// feature) can fold, call, or raise depending on their actual cards, so
// a hand's exact path (does the round complete after one call, or does a
// computer re-raise and reopen it?) is no longer scripted/deterministic —
// tests assert invariants that hold regardless of that path.
async function respondSafely(
  base: string,
  cookie: string,
  body: ActionBody,
  maxSteps = 100,
): Promise<ActionBody> {
  let current = body;
  for (let i = 0; i < maxSteps && !current.result; i++) {
    assert.equal(current.actingSeat, 0, "expected the human to be on the clock");
    const action = current.legalActions.includes("check") ? "check" : "call";
    const next = await json(base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action }),
      headers: { cookie },
    });
    assert.equal(next.status, 200);
    current = next.body as ActionBody;
  }
  return current;
}

function errorMessage(body: unknown): string {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    assert.fail(`expected error object, got ${JSON.stringify(body)}`);
  }
  const message = (body as { error: unknown }).error;
  assert.equal(typeof message, "string");
  return message as string;
}

test("after dealing, the human is on the clock facing a real bet (at least the big blind), with fold/call always offered", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    const hand = await sitAndDeal(app.base, alice.cookie);
    assert.equal(hand.actingSeat, 0);
    // toCall is always exactly currentBet here (the human hasn't put any
    // chips in yet this street) and at least the big blind (2) — a
    // computer with a strong hand may have already raised preflop before
    // the human's turn, so it isn't pinned to exactly 2 anymore.
    assert.equal(hand.toCall, hand.currentBet);
    assert.ok((hand.currentBet as number) >= 2);
    const legal = new Set(hand.legalActions as string[]);
    assert.ok(legal.has("fold"));
    assert.ok(legal.has("call"));
    assert.ok(legal.has("all-in"));
    assert.ok(!legal.has("check"));
    assert.ok(!legal.has("bet"));
  } finally {
    await app.close();
  }
});

test("a legal call moves chips into the pot without ever decreasing it, and the hand keeps making forward progress (next street or settlement)", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    const dealt = await sitAndDeal(app.base, alice.cookie);
    const potBeforeCall = dealt.pot as number;
    const acted = await json(app.base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: "call" }),
      headers: { cookie: alice.cookie },
    });
    assert.equal(acted.status, 200);
    const afterCall = acted.body as ActionBody;
    assert.ok(afterCall.pot >= potBeforeCall);
    // Computer opponents (this feature) may re-raise, requiring more
    // human decisions before the round actually completes — respond
    // safely (call/check only) until it does, then check we made real
    // forward progress: either a later street was reached, or the hand
    // settled outright (e.g. everyone else folded to a re-raise).
    const settled = await respondSafely(app.base, alice.cookie, afterCall);
    assert.ok(settled.street !== "preflop" || settled.result !== null);
    assert.ok(settled.pot >= afterCall.pot);
    // Stacks stay non-negative throughout, but a winner's stack can grow
    // past 200 once the pot is awarded at settlement — only bounded by
    // the whole table's 1200 chips (200 x 6).
    for (const seat of settled.seats) {
      assert.ok(seat.stack >= 0 && seat.stack <= 1200);
    }
  } finally {
    await app.close();
  }
});

test("folding removes the human from the hand without changing their contributed chips, and the remaining computers play the hand out to a showdown on their own", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await sitAndDeal(app.base, alice.cookie);
    const acted = await json(app.base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: "fold" }),
      headers: { cookie: alice.cookie },
    });
    assert.equal(acted.status, 200);
    const view = acted.body as {
      street: string;
      seats: { index: number; folded: boolean; stack: number }[];
      result: { reason: string; winners: { seat: number; delta: number }[] } | null;
    };
    assert.equal(view.seats[0].folded, true);
    assert.equal(view.seats[0].stack, 200);
    // With the human out, none of the five placeholder computers ever
    // bets/raises/folds, so the hand runs itself all the way to a river
    // showdown among them without any further human input.
    assert.equal(view.street, "river");
    assert.ok(view.result);
    assert.equal(view.result?.reason, "showdown");
    assert.ok((view.result?.winners.length ?? 0) > 0);
  } finally {
    await app.close();
  }
});

test("a legal raise reopens the action for seats that had already called, and the hand keeps making forward progress", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    const dealt = await sitAndDeal(app.base, alice.cookie);
    assert.ok((dealt.legalActions as string[]).includes("raise"));
    const raiseTo = (dealt.currentBet as number) + (dealt.minRaiseSize as number);
    const acted = await json(app.base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: "raise", amount: raiseTo }),
      headers: { cookie: alice.cookie },
    });
    assert.equal(acted.status, 200);
    const afterRaise = acted.body as ActionBody;
    // If everyone just calls the raise, the whole preflop round can
    // complete and advance to the flop within this same response — a new
    // street's currentBet correctly resets to 0, less than raiseTo, which
    // is fine. Only assert the "at least raiseTo" invariant while still on
    // the same (preflop) street, where a computer may have re-raised
    // again before it's the human's turn (or the round completes).
    if (afterRaise.street === "preflop") {
      assert.ok(afterRaise.currentBet >= raiseTo);
    }
    assert.ok(afterRaise.pot > (dealt.pot as number));
    // Other computer seats (real strategy, this feature) may respond by
    // folding, calling, or re-raising again — respond safely until the
    // hand settles or genuinely moves forward.
    const settled = await respondSafely(app.base, alice.cookie, afterRaise);
    assert.ok(settled.street !== "preflop" || settled.result !== null);
    for (const seat of settled.seats) {
      assert.ok(seat.stack >= 0 && seat.stack <= 1200);
    }
  } finally {
    await app.close();
  }
});

test("an illegal action (check facing a bet) is rejected and changes nothing", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    const dealt = await sitAndDeal(app.base, alice.cookie);
    const rejected = await json(app.base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: "check" }),
      headers: { cookie: alice.cookie },
    });
    assert.equal(rejected.status, 400);
    assert.match(errorMessage(rejected.body), /check/i);

    // Confirm nothing changed: still the human's turn, same pot as before
    // the rejected attempt (whatever it was — a computer may have raised
    // preflop before the human's turn, so it isn't pinned to a fixed
    // number here).
    const stillWaiting = await json(app.base, "/api/hand", {
      headers: { cookie: alice.cookie },
    });
    const view = stillWaiting.body as { actingSeat: number | null; pot: number };
    assert.equal(view.actingSeat, 0);
    assert.equal(view.pot, dealt.pot);
  } finally {
    await app.close();
  }
});

test("a raise below the minimum is rejected with no state change", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    const dealt = await sitAndDeal(app.base, alice.cookie);
    // One more than the current bet is always a genuine raise attempt
    // (exceeds what's owed to call) but, since the minimum raise is
    // always at least the big blind (2), always short of the minimum —
    // regardless of what the current bet actually is (a computer may
    // have already raised preflop before the human's turn).
    const rejected = await json(app.base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: "raise", amount: (dealt.currentBet as number) + 1 }),
      headers: { cookie: alice.cookie },
    });
    assert.equal(rejected.status, 400);
    assert.match(errorMessage(rejected.body), /minimum/i);
  } finally {
    await app.close();
  }
});

test("acting without a hand in progress, or logged out, is rejected", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    const noHand = await json(app.base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: "check" }),
      headers: { cookie: alice.cookie },
    });
    assert.equal(noHand.status, 400);

    const loggedOut = await json(app.base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: "check" }),
    });
    assert.equal(loggedOut.status, 401);
  } finally {
    await app.close();
  }
});

test("an invalid action name is rejected", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await sitAndDeal(app.base, alice.cookie);
    const bad = await json(app.base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: "shuffle" }),
      headers: { cookie: alice.cookie },
    });
    assert.equal(bad.status, 400);
  } finally {
    await app.close();
  }
});

test("going all-in with a full stack is offered and moves the entire stack into the pot", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    const hand = await sitAndDeal(app.base, alice.cookie);
    assert.ok((hand.legalActions as string[]).includes("all-in"));
    const acted = await json(app.base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: "all-in" }),
      headers: { cookie: alice.cookie },
    });
    assert.equal(acted.status, 200);
    const view = acted.body as {
      seats: { index: number; stack: number; allIn: boolean }[];
      result: unknown;
    };
    // The all-in itself always empties the human's stack to 0 and marks
    // them all-in — but if every computer opponent responds by folding to
    // the shove (real strategy, this feature), the hand settles as a
    // fold-out win within this same response, and the human's stack then
    // reflects winning the pot rather than staying at 0.
    if (!view.result) {
      assert.equal(view.seats[0].stack, 0);
    }
    assert.equal(view.seats[0].allIn, true);
  } finally {
    await app.close();
  }
});

test("the app offers real action controls (fold/check/call/bet/raise/all-in) wired to POST /api/hand/action", () => {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  const controlsBlock = main.match(
    /function renderActionControls[\s\S]*?(?=\nfunction |\n$)/,
  )?.[0];
  assert.ok(controlsBlock, "renderActionControls function not found");
  for (const action of ["fold", "check", "call", "bet", "raise", "all-in"]) {
    assert.match(controlsBlock, new RegExp(`data-action="${action}"`));
  }
  assert.match(main, /\/api\/hand\/action/);
  assert.match(main, /data-action/);
  assert.match(main, /addEventListener/);
});
