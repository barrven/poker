import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readMain(): string {
  return fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
}

function readCss(): string {
  return fs.readFileSync(path.join(root, "src/style.css"), "utf8");
}

function readOvalMediaBlock(css: string): string {
  const block = css.match(/@media \(min-width: 640px\) \{([\s\S]*?)\n\}\n\n\[data-actions\]/)?.[1];
  assert.ok(block, "oval breakpoint media query not found (or its bounds changed)");
  return block as string;
}

function readClampPx(
  block: string,
  property: string,
  viewportHeightPx: number,
): number {
  const m = block.match(
    new RegExp(`${property}:\\s*clamp\\(\\s*(\\d+(?:\\.\\d+)?)rem\\s*,\\s*(\\d+(?:\\.\\d+)?)vh\\s*,\\s*(\\d+(?:\\.\\d+)?)rem\\s*\\)`),
  );
  assert.ok(m, `could not read a ${property} clamp() in the given block`);
  const [, minRem, vh, maxRem] = m as unknown as [string, string, string, string];
  const REM = 16;
  const preferredPx = (Number(vh) / 100) * viewportHeightPx;
  return Math.min(Math.max(preferredPx, Number(minRem) * REM), Number(maxRem) * REM);
}

test("the human's own hole cards render inside their own seat box (hero-cards), not as a standalone line elsewhere", () => {
  const main = readMain();
  const handBlock = main.match(/function renderHand[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(handBlock, "renderHand function not found");
  // The old standalone line is gone outright, not just relocated.
  assert.doesNotMatch(handBlock, /data-hole-cards/);
  assert.doesNotMatch(handBlock, /Your cards:/);
  // The replacement renders inside the per-seat map, keyed off the human
  // seat specifically, using the real hand.holeCards data.
  assert.match(handBlock, /seat\.kind === "human"[\s\S]*?hero-cards[\s\S]*?renderCards\(hand\.holeCards\)/);

  const css = readCss();
  assert.match(css, /\.hero-cards\s*\{/);
});

test("AC2: the hero's hole cards and the board cards clear the old 2.6rem card size at both target desktop viewports", () => {
  const mediaBlock = readOvalMediaBlock(readCss());
  const heroCardBlock = mediaBlock.match(/\[data-seats\] li\[data-seat="you"\] \.card-img\s*\{([^}]*)\}/)?.[1];
  const boardCardBlock = mediaBlock.match(/\[data-board\] \.card-img\s*\{([^}]*)\}/)?.[1];
  assert.ok(heroCardBlock, "hero card-img rule not found in the oval media query");
  assert.ok(boardCardBlock, "board card-img rule not found in the oval media query");

  const REM = 16;
  const OLD_CARD_WIDTH_PX = 2.6 * REM;
  for (const [, viewportH] of [
    ["1280x800", 800],
    ["1440x900", 900],
  ] as const) {
    const heroPx = readClampPx(heroCardBlock as string, "width", viewportH);
    const boardPx = readClampPx(boardCardBlock as string, "width", viewportH);
    assert.ok(heroPx > OLD_CARD_WIDTH_PX, `hero card only ${heroPx}px wide at viewport height ${viewportH}`);
    assert.ok(boardPx > OLD_CARD_WIDTH_PX, `board card only ${boardPx}px wide at viewport height ${viewportH}`);
  }
});

test("AC1: the hand-history toggle is hidden while a hand is active, so it doesn't compete with the in-hand view for vertical space", () => {
  const main = readMain();
  const renderBlock = main.match(/function render\(\)[\s\S]*?\n {2}if \(view\.kind === "signed-in"\)[\s\S]*?(?=\n {4}return;\n {2}\}\n\n {2}const error)/)?.[0];
  assert.ok(renderBlock, "signed-in render branch not found");
  assert.match(renderBlock, /seatedHistorySection\s*=\s*view\.seated\s*&&\s*!view\.hand/);
});

test("[data-actions] is never hidden or clipped by CSS — the in-hand action controls stay visible and usable", () => {
  const css = readCss();
  const actionsBlock = css.match(/\[data-actions\]\s*\{([^}]*)\}/)?.[1];
  assert.ok(actionsBlock, "[data-actions] rule not found");
  assert.doesNotMatch(actionsBlock as string, /display:\s*none/);
  assert.doesNotMatch(actionsBlock as string, /visibility:\s*hidden/);
  assert.doesNotMatch(actionsBlock as string, /overflow:\s*hidden/);
});

test("the recent-actions log scrolls internally instead of growing the page when it's near its 8-entry cap", () => {
  const css = readCss();
  const ulBlock = css.match(/\[data-action-log\] ul\s*\{([^}]*)\}/)?.[1];
  assert.ok(ulBlock, "[data-action-log] ul rule not found");
  assert.match(ulBlock as string, /max-height:/);
  assert.match(ulBlock as string, /overflow-y:\s*auto/);
});

test("a long username can't wrap the topbar across extra lines and eat into the no-scroll budget", () => {
  const css = readCss();
  const profileBlock = css.match(/\[data-profile\]\s*\{([^}]*)\}/)?.[1];
  assert.ok(profileBlock, "[data-profile] rule not found");
  assert.match(profileBlock as string, /white-space:\s*nowrap/);
  assert.match(profileBlock as string, /overflow:\s*hidden/);
  assert.match(profileBlock as string, /max-width:/);
});
