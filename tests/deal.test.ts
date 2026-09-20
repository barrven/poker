import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { DatabaseSync } from "node:sqlite";
import { createApp } from "../server/app.js";
import { openDb } from "../server/db.js";

const tmpDirs: string[] = [];

after(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tmpDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-deal-"));
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
): Promise<{ cookie: string }> {
  const result = await json(base, "/api/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  assert.equal(result.status, 201);
  assert.ok(result.cookie);
  return { cookie: result.cookie };
}

async function sit(base: string, cookie: string): Promise<void> {
  const result = await json(base, "/api/sit", {
    method: "POST",
    body: "{}",
    headers: { cookie },
  });
  assert.equal(result.status, 200);
}

function errorMessage(body: unknown): string {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    assert.fail(`expected error object, got ${JSON.stringify(body)}`);
  }
  const message = (body as { error: unknown }).error;
  assert.equal(typeof message, "string");
  return message as string;
}

test("a seated player can start a hand: dealer button visible, blinds posted from the correct seats' stacks, only the human's hole cards are exposed", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await sit(app.base, alice.cookie);

    const started = await json(app.base, "/api/hand/start", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(started.status, 200);
    const view = started.body as {
      button: number;
      smallBlindSeat: number;
      bigBlindSeat: number;
      street: string;
      board: string[];
      holeCards: string[];
      seats: { index: number; kind: string; stack: number }[];
    };

    assert.equal(typeof view.button, "number");
    assert.equal(view.street, "preflop");
    assert.deepEqual(view.board, []);

    // Only the human's own two hole cards are present — nothing else in
    // the response shape carries other seats' cards.
    assert.equal(view.holeCards.length, 2);
    assert.deepEqual(Object.keys(view).sort(), [
      "bigBlindSeat",
      "board",
      "button",
      "holeCards",
      "seats",
      "smallBlindSeat",
      "street",
    ]);

    // Human is always seat 0 and is the button for a first hand, so blinds
    // come from the two computer seats left of the button.
    assert.equal(view.button, 0);
    assert.equal(view.smallBlindSeat, 1);
    assert.equal(view.bigBlindSeat, 2);
    assert.equal(view.seats.length, 6);
    assert.equal(view.seats[0].kind, "human");
    assert.equal(view.seats[0].stack, 200);
    assert.equal(view.seats[1].stack, 199);
    assert.equal(view.seats[2].stack, 198);
    for (const seat of view.seats.slice(3)) {
      assert.equal(seat.stack, 200);
    }
  } finally {
    await app.close();
  }
});

test("GET /api/hand returns the same in-progress hand view after starting", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await sit(app.base, alice.cookie);
    const started = await json(app.base, "/api/hand/start", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    const fetched = await json(app.base, "/api/hand", {
      headers: { cookie: alice.cookie },
    });
    assert.equal(fetched.status, 200);
    assert.deepEqual(fetched.body, started.body);
  } finally {
    await app.close();
  }
});

test("starting a hand twice in a row is rejected without dealing a second hand", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await sit(app.base, alice.cookie);
    await json(app.base, "/api/hand/start", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    const again = await json(app.base, "/api/hand/start", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(again.status, 409);
  } finally {
    await app.close();
  }
});

test("a player who has not sat down cannot start or view a hand", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    const started = await json(app.base, "/api/hand/start", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(started.status, 400);
    assert.match(errorMessage(started.body), /sit/i);

    const fetched = await json(app.base, "/api/hand", {
      headers: { cookie: alice.cookie },
    });
    assert.equal(fetched.status, 400);
  } finally {
    await app.close();
  }
});

test("a logged-out visitor cannot start or view a hand", async () => {
  const app = await startApp();
  try {
    const started = await json(app.base, "/api/hand/start", {
      method: "POST",
      body: "{}",
    });
    assert.equal(started.status, 401);
    const fetched = await json(app.base, "/api/hand");
    assert.equal(fetched.status, 401);
  } finally {
    await app.close();
  }
});

test("before a hand starts, GET /api/hand reports no hand in progress", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await sit(app.base, alice.cookie);
    const fetched = await json(app.base, "/api/hand", {
      headers: { cookie: alice.cookie },
    });
    assert.equal(fetched.status, 400);
    assert.match(errorMessage(fetched.body), /no hand/i);
  } finally {
    await app.close();
  }
});
