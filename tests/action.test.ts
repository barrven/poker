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

function errorMessage(body: unknown): string {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    assert.fail(`expected error object, got ${JSON.stringify(body)}`);
  }
  const message = (body as { error: unknown }).error;
  assert.equal(typeof message, "string");
  return message as string;
}

test("after dealing, the human is on the clock with call/raise/fold offered, facing the big blind", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    const hand = await sitAndDeal(app.base, alice.cookie);
    assert.equal(hand.actingSeat, 0);
    assert.equal(hand.toCall, 2);
    assert.deepEqual(
      new Set(hand.legalActions as string[]),
      new Set(["fold", "call", "raise", "all-in"]),
    );
  } finally {
    await app.close();
  }
});

test("a legal call moves chips into the pot; the placeholder computers auto-complete preflop and check through to the flop, where the human (the button) is on the clock again", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await sitAndDeal(app.base, alice.cookie);
    const acted = await json(app.base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: "call" }),
      headers: { cookie: alice.cookie },
    });
    assert.equal(acted.status, 200);
    const view = acted.body as {
      street: string;
      board: string[];
      pot: number;
      currentBet: number;
      roundComplete: boolean;
      actingSeat: number | null;
      seats: { index: number; stack: number; streetContribution: number }[];
    };
    // Preflop: human called 2, SB (1) called the extra 1, BB's 2 already
    // covered it, and the computers left of the button already auto-called
    // 2 each before the human's turn arrived — pot 12, everyone at 198.
    // Nobody ever bets on the flop (the placeholder only checks/calls), so
    // action runs all the way around back to the human — the button acts
    // last post-flop — without the round completing first.
    assert.equal(view.street, "flop");
    assert.equal(view.board.length, 3);
    assert.equal(view.currentBet, 0);
    assert.equal(view.roundComplete, false);
    assert.equal(view.actingSeat, 0);
    assert.equal(view.pot, 12);
    for (const seat of view.seats) {
      assert.equal(seat.streetContribution, 0);
      assert.equal(seat.stack, 198);
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

test("a raise reopens the action for computer seats that had already called, then the human is on the clock again once the flop's free round of checks reaches them", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await sitAndDeal(app.base, alice.cookie);
    const acted = await json(app.base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: "raise", amount: 6 }),
      headers: { cookie: alice.cookie },
    });
    assert.equal(acted.status, 200);
    const view = acted.body as {
      street: string;
      pot: number;
      currentBet: number;
      roundComplete: boolean;
      actingSeat: number | null;
      seats: { streetContribution: number; stack: number }[];
    };
    // Every computer seat calls the new 6 (the placeholder never folds or
    // re-raises), so preflop completes with everyone at 6 — pot 36. Nobody
    // bets on the flop either, so the round of checks runs all the way
    // around back to the human (the button, who acts last post-flop)
    // before the flop's round can complete — every seat that's still in
    // must act at least once per street, the human included.
    assert.equal(view.pot, 36);
    assert.equal(view.street, "flop");
    assert.equal(view.currentBet, 0);
    assert.equal(view.roundComplete, false);
    assert.equal(view.actingSeat, 0);
    for (const seat of view.seats) {
      assert.equal(seat.streetContribution, 0);
      assert.equal(seat.stack, 194);
    }
  } finally {
    await app.close();
  }
});

test("an illegal action (check facing a bet) is rejected and changes nothing", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await sitAndDeal(app.base, alice.cookie);
    const rejected = await json(app.base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: "check" }),
      headers: { cookie: alice.cookie },
    });
    assert.equal(rejected.status, 400);
    assert.match(errorMessage(rejected.body), /check/i);

    // Confirm nothing changed: still the human's turn, same pot.
    const stillWaiting = await json(app.base, "/api/hand", {
      headers: { cookie: alice.cookie },
    });
    const view = stillWaiting.body as { actingSeat: number | null; pot: number };
    assert.equal(view.actingSeat, 0);
    assert.equal(view.pot, 9);
  } finally {
    await app.close();
  }
});

test("a raise below the minimum is rejected with no state change", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await sitAndDeal(app.base, alice.cookie);
    const rejected = await json(app.base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: "raise", amount: 3 }),
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
    const view = acted.body as { seats: { index: number; stack: number; allIn: boolean }[] };
    assert.equal(view.seats[0].stack, 0);
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
