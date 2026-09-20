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
import { replenishBustedComputers } from "../server/table.js";
import type { Seat } from "../server/table.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDirs: string[] = [];

after(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tmpDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-next-hand-"));
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
  button: number;
  street: string;
  actingSeat: number | null;
  legalActions: string[];
  result: unknown;
  seats: { index: number; kind: string; stack: number }[];
};

async function playToSettlement(
  base: string,
  cookie: string,
  body: HandBody,
  action: (legal: string[]) => string = (legal) =>
    legal.includes("check") ? "check" : "call",
  maxSteps = 100,
): Promise<HandBody> {
  let current = body;
  for (let i = 0; i < maxSteps && !current.result; i++) {
    const chosen = action(current.legalActions);
    const next = await json(base, "/api/hand/action", {
      method: "POST",
      body: JSON.stringify({ action: chosen }),
      headers: { cookie },
    });
    assert.equal(next.status, 200);
    current = next.body as HandBody;
  }
  assert.ok(current.result, "hand did not settle within the expected number of decisions");
  return current;
}

test("the button rotates one seat clockwise from hand to hand", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });

    // Safe call/check play can still bust the human (a computer's
    // aggressive raise can build a pot the human then loses in full), so
    // button progression is only checked across however many hands
    // actually start before that happens — felting is covered by its own
    // dedicated test below.
    const buttonsSeen: number[] = [];
    for (let hand = 0; hand < 3; hand++) {
      const started = await json(app.base, "/api/hand/start", {
        method: "POST",
        body: "{}",
        headers: { cookie: alice.cookie },
      });
      if (started.status !== 200) {
        assert.equal(started.status, 400); // felted — stop here
        break;
      }
      const body = started.body as HandBody;
      buttonsSeen.push(body.button);
      await playToSettlement(app.base, alice.cookie, body);
    }
    assert.ok(buttonsSeen.length >= 1, "expected at least one hand to start");
    for (let i = 0; i < buttonsSeen.length; i++) {
      assert.equal(buttonsSeen[i], i % 6);
    }
  } finally {
    await app.close();
  }
});

test("a human who busts to 0 cannot start a new hand until they rebuy (not shipped yet) or leave", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    // Shove every hand — high variance, reliably busts within a handful
    // of hands against five opponents. No seeded rng is exposed over
    // HTTP (deliberately — never let a client control server-side
    // randomness), so this is probabilistic by nature, with a generous
    // budget to make a false failure vanishingly unlikely.
    let bustedHand: HandBody | undefined;
    for (let hand = 0; hand < 50 && !bustedHand; hand++) {
      const started = await json(app.base, "/api/hand/start", {
        method: "POST",
        body: "{}",
        headers: { cookie: alice.cookie },
      });
      if (started.status !== 200) {
        break; // already felted from a prior hand in this loop
      }
      const settled = await playToSettlement(
        app.base,
        alice.cookie,
        started.body as HandBody,
        (legal) => (legal.includes("all-in") ? "all-in" : legal.includes("call") ? "call" : "fold"),
      );
      if (settled.seats[0].stack === 0) {
        bustedHand = settled;
      }
    }
    assert.ok(bustedHand, "human never busted after 50 all-in hands");

    const rejected = await json(app.base, "/api/hand/start", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(rejected.status, 400);
    assert.match(
      (rejected.body as { error: string }).error,
      /chips|stack/i,
    );

    // Leaving still works (settles their 0 stack, tab unchanged by the
    // leave itself) even while felted.
    const left = await json(app.base, "/api/leave", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(left.status, 200);
  } finally {
    await app.close();
  }
});

test("replenishBustedComputers resets only busted computer seats, leaving the human and solvent seats untouched", () => {
  const seats: Seat[] = [
    { kind: "human", stack: 0 }, // busted human is NOT replenished
    { kind: "computer", stack: 0 }, // busted computer IS replenished
    { kind: "computer", stack: 150 }, // solvent computer is untouched
    { kind: "computer", stack: -0 },
  ];
  replenishBustedComputers(seats);
  assert.equal(seats[0].stack, 0);
  assert.equal(seats[1].stack, 200);
  assert.equal(seats[2].stack, 150);
  assert.equal(seats[3].stack, 200);
});

test("the app shows an automatic next-hand message when the human still has chips, and a felted message with no deal control when they don't", () => {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  const settlementBlock = main.match(
    /function renderSettlement[\s\S]*?(?=\nfunction )/,
  )?.[0];
  assert.ok(settlementBlock, "renderSettlement function not found");
  assert.match(settlementBlock, /humanStack/);
  assert.match(settlementBlock, /out of chips/i);
  assert.match(main, /setTimeout/);
  assert.match(main, /scheduleAutoDeal/);
});
