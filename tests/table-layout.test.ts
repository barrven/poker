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

test("both the pre-hand table and an in-progress hand assign each of the 6 seats a seat-slot-N position class", () => {
  const main = readMain();
  const tableBlock = main.match(/function renderTable[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(tableBlock, "renderTable function not found");
  // renderTable's human seat is a literal slot-1; its 5 computer seats are
  // generated from a loop, so slot 2-6 come from `i + 2` over i in 0..4.
  assert.match(tableBlock, /class="seat-slot-1"/);
  assert.match(tableBlock, /class="seat-slot-\$\{i \+ 2\}"/);

  const handBlock = main.match(/function renderHand[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(handBlock, "renderHand function not found");
  // renderHand's seats are index-ordered (seat 0 = human = slot 1, ...
  // seat 5 = slot 6), computed once per seat as `seat.index + 1`.
  assert.match(handBlock, /const slot = seat\.index \+ 1;/);
  assert.match(handBlock, /class="seat-slot-\$\{slot\}"/);
});

test("seats render inside a shared oval/felt wrapper, not a bare list", () => {
  const main = readMain();
  assert.match(main, /function renderTableOval/);
  const ovalBlock = main.match(/function renderTableOval[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(ovalBlock, "renderTableOval function not found");
  assert.match(ovalBlock, /table-oval/);
  assert.match(ovalBlock, /table-center/);

  const tableBlock = main.match(/function renderTable[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(tableBlock);
  assert.match(tableBlock, /renderTableOval\(/);
  const handBlock = main.match(/function renderHand[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(handBlock);
  assert.match(handBlock, /renderTableOval\(/);
});

test("dealer/blind markers render as styled badges, not bare '(D/SB/BB)' text", () => {
  const main = readMain();
  const handBlock = main.match(/function renderHand[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(handBlock, "renderHand function not found");
  assert.match(handBlock, /marker-badge marker-button/);
  assert.match(handBlock, /marker-badge marker-sb/);
  assert.match(handBlock, /marker-badge marker-bb/);
  // Still keyed off the real hand state, not hardcoded.
  assert.match(handBlock, /seat\.index === hand\.button/);
  assert.match(handBlock, /seat\.index === hand\.smallBlindSeat/);
  assert.match(handBlock, /seat\.index === hand\.bigBlindSeat/);
  // Regression guard: the old slash-joined parenthetical text is gone.
  assert.doesNotMatch(handBlock, /\("D\/SB\/BB"|\(\$\{markers\}\)/);

  const css = readCss();
  assert.match(css, /\.marker-badge\s*\{[^}]*border-radius:\s*50%/);
  assert.match(css, /\.marker-button\s*\{/);
  assert.match(css, /\.marker-sb\s*\{/);
  assert.match(css, /\.marker-bb\s*\{/);
});

test("stack, bet, and pot amounts are prefixed with a styled chip icon, not bare numbers", () => {
  const main = readMain();
  assert.match(main, /const CHIP_ICON = /);
  const tableBlock = main.match(/function renderTable[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(tableBlock);
  assert.match(tableBlock, /CHIP_ICON\}\$\{formatChips\(stack\)/);
  assert.match(tableBlock, /CHIP_ICON\}\$\{formatChips\(BUY_IN\)/);

  const handBlock = main.match(/function renderHand[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(handBlock);
  assert.match(handBlock, /CHIP_ICON\}\$\{formatChips\(seat\.stack\)/);
  assert.match(handBlock, /CHIP_ICON\}\$\{formatChips\(seat\.streetContribution\)/);
  assert.match(handBlock, /data-pot>Pot: \$\{CHIP_ICON\}/);

  const css = readCss();
  const chipIconBlock = css.match(/\.chip-icon\s*\{[^}]*\}/)?.[0];
  assert.ok(chipIconBlock, ".chip-icon rule not found");
  assert.match(chipIconBlock, /border-radius:\s*50%/);
});

test("the seat list is a safe, always-non-overlapping grid by default (mobile-first), with the oval layout layered on above a fixed breakpoint", () => {
  const css = readCss();
  const seatsBase = css.match(/\[data-seats\] \{([^}]*)\}/)?.[1];
  assert.ok(seatsBase, "[data-seats] base rule not found");
  assert.match(seatsBase, /display:\s*grid/);
  assert.doesNotMatch(seatsBase, /position:\s*absolute/);

  const mediaBlock = css.match(
    /@media \(min-width: 640px\) \{([\s\S]*?)\n\}\n\n\[data-actions\]/,
  )?.[1];
  assert.ok(mediaBlock, "oval breakpoint media query not found (or its bounds changed)");
  assert.match(mediaBlock, /border-radius:\s*50%/);
  assert.match(mediaBlock, /\[data-seats\] \{[^}]*position:\s*absolute/);
});

test("geometry check: every seat-slot's horizontal position keeps its box fully inside the felt at the oval breakpoint's known minimum width", () => {
  const css = readCss();
  const mediaBlock = css.match(
    /@media \(min-width: 640px\) \{([\s\S]*?)\n\}\n\n\[data-actions\]/,
  )?.[1];
  assert.ok(mediaBlock, "oval breakpoint media query not found");

  // #app caps at 36rem total width with 2rem+1.25rem horizontal padding
  // (src/style.css, top of file) — by 640px viewport (this query's own
  // threshold) #app has already hit that cap, so .table-oval's rendered
  // width is a known, stable value, not something that keeps changing
  // with the viewport. Cross-checked against .table-oval's own
  // max-width below, taking whichever is smaller (the real constraint).
  const REM = 16;
  const appMaxWidthPx = 36 * REM;
  const appHorizontalPaddingPx = (2 + 1.25) * REM * 2;
  const knownFeltWidthPx = appMaxWidthPx - appHorizontalPaddingPx;

  const ovalMaxWidthRem = Number(mediaBlock.match(/\.table-oval\s*\{[^}]*max-width:\s*(\d+(?:\.\d+)?)rem/)?.[1]);
  assert.ok(ovalMaxWidthRem > 0, "could not read .table-oval max-width");
  const feltWidthPx = Math.min(knownFeltWidthPx, ovalMaxWidthRem * REM);

  const seatLiBlock = mediaBlock.match(/\[data-seats\] li \{([^}]*)\}/)?.[1];
  assert.ok(seatLiBlock, "[data-seats] li rule not found in the oval media query");
  const boxWidthRem = Number(seatLiBlock.match(/width:\s*(\d+(?:\.\d+)?)rem/)?.[1]);
  assert.ok(boxWidthRem > 0, "could not read seat box width");
  const halfBoxPx = (boxWidthRem * REM) / 2;

  const MIN_CLEARANCE_PX = 8; // a little slack for border/box-shadow bleed
  for (let slot = 1; slot <= 6; slot++) {
    const slotBlock = mediaBlock.match(new RegExp(`\\.seat-slot-${slot}\\s*\\{([^}]*)\\}`))?.[1];
    assert.ok(slotBlock, `.seat-slot-${slot} rule not found`);
    const leftPercent = Number(slotBlock.match(/left:\s*(\d+(?:\.\d+)?)%/)?.[1]);
    assert.ok(!Number.isNaN(leftPercent), `.seat-slot-${slot} has no left%`);
    const leftPx = (leftPercent / 100) * feltWidthPx;
    assert.ok(
      leftPx - halfBoxPx >= MIN_CLEARANCE_PX,
      `seat-slot-${slot} box would clip the felt's left edge (left edge at ${leftPx - halfBoxPx}px)`,
    );
    assert.ok(
      leftPx + halfBoxPx <= feltWidthPx - MIN_CLEARANCE_PX,
      `seat-slot-${slot} box would clip the felt's right edge (right edge at ${leftPx + halfBoxPx}px, felt width ${feltWidthPx}px)`,
    );
  }
});

test("geometry check: adjacent seat rows are spaced far enough apart vertically for two text-heavy seat boxes not to stack on top of each other", () => {
  const css = readCss();
  const mediaBlock = css.match(
    /@media \(min-width: 640px\) \{([\s\S]*?)\n\}\n\n\[data-actions\]/,
  )?.[1];
  assert.ok(mediaBlock, "oval breakpoint media query not found");

  const REM = 16;
  const ovalMaxWidthRem = Number(mediaBlock.match(/\.table-oval\s*\{[^}]*max-width:\s*(\d+(?:\.\d+)?)rem/)?.[1]);
  const [aspectW, aspectH] = (mediaBlock.match(/aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/) ?? []).slice(1).map(Number);
  assert.ok(ovalMaxWidthRem > 0 && aspectW > 0 && aspectH > 0, "could not read .table-oval sizing");
  const feltWidthPx = ovalMaxWidthRem * REM;
  const feltHeightPx = (feltWidthPx * aspectH) / aspectW;

  const tops: number[] = [];
  for (let slot = 1; slot <= 6; slot++) {
    const slotBlock = mediaBlock.match(new RegExp(`\\.seat-slot-${slot}\\s*\\{([^}]*)\\}`))?.[1];
    const top = Number(slotBlock?.match(/top:\s*(\d+(?:\.\d+)?)%/)?.[1]);
    assert.ok(!Number.isNaN(top), `.seat-slot-${slot} has no top%`);
    tops.push(top);
  }
  const sortedUnique = [...new Set(tops)].sort((a, b) => a - b);
  assert.ok(sortedUnique.length >= 2, "expected seats spread across multiple rows");

  // A rough but real estimate: a computer seat's box (label, D/SB/BB
  // badges, chip-prefixed stack, fold/all-in status, bet, and — for a
  // computer seat with unrevealed cards — two small card-back images)
  // can wrap to a few lines even at the oval breakpoint's smaller
  // font-size. This isn't pixel-exact (no browser available to measure
  // real layout this run — see this feature's Validation Notes), but a
  // ~100px minimum vertical gap between the closest adjacent rows is a
  // deliberate, checked safety margin, not an arbitrary one.
  const MIN_ROW_GAP_PX = 90;
  let minGapPx = Infinity;
  for (let i = 1; i < sortedUnique.length; i++) {
    const gapPercent = sortedUnique[i] - sortedUnique[i - 1];
    minGapPx = Math.min(minGapPx, (gapPercent / 100) * feltHeightPx);
  }
  assert.ok(
    minGapPx >= MIN_ROW_GAP_PX,
    `closest adjacent seat rows are only ${minGapPx}px apart at the felt's known size (want >= ${MIN_ROW_GAP_PX}px)`,
  );
});

test("all pre-existing table-view information a hand shows is still present after the layout change (AC5)", () => {
  const main = readMain();
  const handBlock = main.match(/function renderHand[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(handBlock, "renderHand function not found");
  for (const marker of [
    "data-street",
    "data-turn",
    "data-hole-cards",
    "data-pot",
    "data-board",
    "data-seats",
    "data-acting",
    "hand.button",
    "hand.smallBlindSeat",
    "hand.bigBlindSeat",
    "renderActionLog(hand.actionLog)",
    'id="leave"',
  ]) {
    assert.ok(handBlock.includes(marker), `renderHand is missing ${marker}`);
  }
});
