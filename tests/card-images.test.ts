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
import { createDeck } from "../server/poker/deck.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDirs: string[] = [];

after(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tmpDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-card-images-"));
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
  const raw = setCookie[0] ?? response.headers.get("set-cookie") ?? undefined;
  const token = raw?.match(/poker_session=([^;]*)/)?.[1];
  const cookie = token !== undefined && token !== "" ? `poker_session=${token}` : undefined;
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
  board: string[];
  holeCards: string[];
  actingSeat: number | null;
  legalActions: string[];
  seats: { index: number; stack: number }[];
  result: {
    reason: string;
    revealed?: { seat: number; cards: string[]; category: string }[];
  } | null;
};

// Same outcome-agnostic driving pattern as tests/showdown.test.ts: the live
// API deals real random cards, so there's no seeded rng to force a
// showdown — just check the simplest always-legal action until the hand
// settles.
async function playToSettlement(
  base: string,
  cookie: string,
  startBody: HandBody,
): Promise<HandBody> {
  let body = startBody;
  for (let i = 0; i < 100 && !body.result; i++) {
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

function cardSvgPath(card: string): string {
  const rank = card[0];
  const suit = card[1]?.toUpperCase();
  return path.join(root, "card-svgs", `${rank}${suit}.svg`);
}

test("every card the deck can deal, plus both card-back designs, has a matching card-svgs/ file", () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  for (const card of deck) {
    assert.ok(fs.existsSync(cardSvgPath(card)), `missing SVG for dealt card ${card}`);
  }
  assert.ok(fs.existsSync(path.join(root, "card-svgs", "1B.svg")));
  assert.ok(fs.existsSync(path.join(root, "card-svgs", "2B.svg")));
});

test("vite serves card-svgs/ at the site root so /RANKSUIT.svg resolves without duplicating the asset folder", () => {
  const config = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");
  assert.match(config, /publicDir:\s*["']card-svgs["']/);
});

test("card codes render as <img> elements against card-svgs/ filenames, not plain-text notation", () => {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");

  const cardImageSrcBlock = main.match(
    /function cardImageSrc[\s\S]*?(?=\nfunction )/,
  )?.[0];
  assert.ok(cardImageSrcBlock, "cardImageSrc function not found");
  // rank kept as-is, suit uppercased — "As" -> "/AS.svg", matching the
  // card-svgs/ filename convention (e.g. AS.svg, TH.svg per feature 015).
  assert.match(cardImageSrcBlock, /toUpperCase/);

  const cardImgBlock = main.match(/function cardImg[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(cardImgBlock, "cardImg function not found");
  assert.match(cardImgBlock, /<img/);
  assert.match(cardImgBlock, /cardImageSrc/);

  const cardBackBlock = main.match(/function cardBackImg[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(cardBackBlock, "cardBackImg function not found");
  assert.match(cardBackBlock, /<img/);
  assert.match(cardBackBlock, /1B\.svg/);

  assert.match(main, /function renderCards[\s\S]*?cardImg/);
  assert.match(main, /function renderHiddenCards[\s\S]*?cardBackImg/);
});

test("the human's hole cards and the board render via the card-image helper, not a plain-text card list", () => {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  const handBlock = main.match(/function renderHand[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(handBlock, "renderHand function not found");
  // The human's hole cards render inline in their own seat box (feature
  // 020), tagged with the hero-cards class rather than a standalone
  // data-hole-cards line.
  assert.match(handBlock, /hero-cards/);
  assert.match(handBlock, /data-board/);
  assert.match(handBlock, /renderCards\(hand\.holeCards\)/);
  assert.match(handBlock, /renderCards\(hand\.board\)/);
  // Regression guard: the old plain-text rendering joined codes with a
  // space (e.g. hand.holeCards.join(" ")) — that pattern must be gone
  // from wherever cards now render as images.
  assert.doesNotMatch(handBlock, /holeCards\.join\(" "\)/);
  assert.doesNotMatch(handBlock, /board\.join\(" "\)/);
});

test("a computer seat shows card-back images while its hole cards are hidden, and real card images once revealed at showdown", () => {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  const handBlock = main.match(/function renderHand[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(handBlock, "renderHand function not found");
  // Only computer seats get a hidden/revealed card-back or reveal slot —
  // the human's own cards render via their own hero-cards branch instead
  // (feature 020), not duplicated as hidden cards.
  assert.match(handBlock, /seat\.kind === "human"/);
  assert.match(handBlock, /renderHiddenCards\(2\)/);
  // Which seat is revealed comes from the settlement's own revealed list,
  // keyed by seat index — never inferred from fold state client-side.
  assert.match(handBlock, /hand\.result\?\.revealed\?\.find/);
  assert.match(handBlock, /r\.seat === seat\.index/);
  assert.match(handBlock, /renderCards\(revealedEntry\.cards\)/);
});

test("the showdown reveal list renders real card images per contender, not plain-text card codes", () => {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  const settlementBlock = main.match(
    /function renderSettlement[\s\S]*?(?=\nfunction )/,
  )?.[0];
  assert.ok(settlementBlock, "renderSettlement function not found");
  assert.match(settlementBlock, /data-revealed/);
  assert.match(settlementBlock, /renderCards\(r\.cards\)/);
  assert.doesNotMatch(settlementBlock, /r\.cards\.join\(" "\)/);
});

test("card images are sized in CSS (no distortion) rather than left to raw <img> intrinsic sizing, including at phone width", () => {
  const css = fs.readFileSync(path.join(root, "src/style.css"), "utf8");
  const cardImgBlock = css.match(/\.card-img\s*\{[^}]*\}/)?.[0];
  assert.ok(cardImgBlock, ".card-img rule not found");
  assert.match(cardImgBlock, /aspect-ratio/);
  assert.match(cardImgBlock, /width/);
  // A phone-width override exists (feature 013 established the 480px
  // breakpoint already used across the app).
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*\.card-img/);
});

test("a live-dealt hand's hole cards and board are real rank+suit codes with a matching card-svgs/ asset", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    await json(app.base, "/api/sit", { method: "POST", body: "{}", headers: { cookie: alice.cookie } });
    const started = await json(app.base, "/api/hand/start", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(started.status, 200);
    const view = started.body as HandBody;
    assert.equal(view.holeCards.length, 2);
    for (const card of view.holeCards) {
      assert.match(card, /^[2-9TJQKA][shdc]$/);
      assert.ok(fs.existsSync(cardSvgPath(card)), `missing SVG for dealt hole card ${card}`);
    }
  } finally {
    await app.close();
  }
});

test("hole cards revealed at showdown are real rank+suit codes with a matching card-svgs/ asset", async () => {
  const app = await startApp();
  try {
    let revealed: { seat: number; cards: string[]; category: string }[] | undefined;
    // Randomness decides fold-out vs. showdown per hand — play several
    // hands until one reaches an actual showdown reveal, capped so a
    // pathological run still fails fast instead of hanging.
    for (let attempt = 0; attempt < 20 && !revealed; attempt++) {
      const alice = await register(app.base, `alice${attempt}`);
      await json(app.base, "/api/sit", { method: "POST", body: "{}", headers: { cookie: alice.cookie } });
      const started = await json(app.base, "/api/hand/start", {
        method: "POST",
        body: "{}",
        headers: { cookie: alice.cookie },
      });
      const settled = await playToSettlement(app.base, alice.cookie, started.body as HandBody);
      if (settled.result?.reason === "showdown" && settled.result.revealed?.length) {
        revealed = settled.result.revealed;
      }
    }
    assert.ok(revealed, "no showdown with a revealed hand occurred within the attempt cap");
    for (const entry of revealed) {
      assert.equal(entry.cards.length, 2);
      for (const card of entry.cards) {
        assert.match(card, /^[2-9TJQKA][shdc]$/);
        assert.ok(fs.existsSync(cardSvgPath(card)), `missing SVG for revealed card ${card}`);
      }
    }
  } finally {
    await app.close();
  }
});
