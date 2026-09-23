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

function readOvalMediaBlock(css: string): string {
  const block = css.match(/@media \(min-width: 640px\) \{([\s\S]*?)\n\}\n\n\[data-actions\]/)?.[1];
  assert.ok(block, "oval breakpoint media query not found (or its bounds changed)");
  return block as string;
}

function readClamp(
  block: string,
  property: string,
): { min: number; vh: number; max: number } | undefined {
  const m = block.match(
    new RegExp(`${property}:\\s*clamp\\(\\s*(\\d+(?:\\.\\d+)?)rem\\s*,\\s*(\\d+(?:\\.\\d+)?)vh\\s*,\\s*(\\d+(?:\\.\\d+)?)rem\\s*\\)`),
  );
  if (!m) return undefined;
  return { min: Number(m[1]), vh: Number(m[2]), max: Number(m[3]) };
}

function evalClampPx(clamp: { min: number; vh: number; max: number }, viewportHeightPx: number, rem: number): number {
  const preferredPx = (clamp.vh / 100) * viewportHeightPx;
  return Math.min(Math.max(preferredPx, clamp.min * rem), clamp.max * rem);
}

// Box/felt sizing is now viewport-*height*-relative too (feature 020's
// no-scroll in-hand fit), not just viewport-width-relative (feature
// 019) — so unlike the original version of this helper, there's no
// single width-only "worst case" any more. This computes real geometry
// at a specific (viewportWidthPx, viewportHeightPx) pair instead, so
// callers check it at the actual named target sizes from features
// 019/020's acceptance criteria (1280x800, 1440x900).
function readSeatGeometry(
  mediaBlock: string,
  viewportWidthPx: number,
  viewportHeightPx: number,
): {
  areaWidthPx: number;
  areaHeightPx: number;
  boxWidthPx: number;
  boxHeightPx: number;
  heroBoxWidthPx: number;
  heroBoxHeightPx: number;
  slots: { slot: number; leftPercent: number; topPercent: number; isHero: boolean }[];
} {
  const REM = 16;

  const [vwPercent, capRem, vhPercent] = (
    mediaBlock.match(
      /\.table-oval\s*\{[^}]*width:\s*min\(\s*(\d+(?:\.\d+)?)vw\s*,\s*(\d+(?:\.\d+)?)rem\s*,\s*(\d+(?:\.\d+)?)vh\s*\)/,
    ) ?? []
  )
    .slice(1)
    .map(Number);
  const [aspectW, aspectH] = (mediaBlock.match(/aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/) ?? [])
    .slice(1)
    .map(Number);
  assert.ok(
    vwPercent > 0 && capRem > 0 && vhPercent > 0 && aspectW > 0 && aspectH > 0,
    "could not read .table-oval sizing",
  );
  const feltWidthPx = Math.min((vwPercent / 100) * viewportWidthPx, capRem * REM, (vhPercent / 100) * viewportHeightPx);
  const feltHeightPx = (feltWidthPx * aspectH) / aspectW;

  // [data-seats] fills .table-oval exactly (inset: 0) — seat-slot-N
  // percentages are relative to the felt's own full size, and it's the
  // percentages themselves (checked below) that keep every box's edges
  // safely inside it, not a separate carved-out margin.
  const seatsBlock = mediaBlock.match(/\[data-seats\] \{([^}]*)\}/)?.[1];
  assert.ok(seatsBlock, "[data-seats] rule not found in the oval media query");
  assert.match(seatsBlock as string, /inset:\s*0\s*;/);
  const areaWidthPx = feltWidthPx;
  const areaHeightPx = feltHeightPx;

  const seatLiBlock = mediaBlock.match(/\[data-seats\] li \{([^}]*)\}/)?.[1];
  assert.ok(seatLiBlock, "[data-seats] li rule not found in the oval media query");
  const boxWidthClamp = readClamp(seatLiBlock as string, "width");
  const fontSizeClamp = readClamp(seatLiBlock as string, "font-size");
  assert.ok(boxWidthClamp && fontSizeClamp, "could not read seat box width/font-size clamp()");
  const boxWidthPx = evalClampPx(boxWidthClamp as NonNullable<typeof boxWidthClamp>, viewportHeightPx, REM);
  const fontSizePx = evalClampPx(fontSizeClamp as NonNullable<typeof fontSizeClamp>, viewportHeightPx, REM);
  // A computer seat's box holds a lot: label, D/SB/BB badges, a
  // chip-prefixed stack, fold/all-in status, a chip-prefixed bet, and —
  // while its cards are unrevealed — two small card-back images. That
  // wraps to roughly 2-3 lines of text plus one compact image row at
  // the box's own font-size; 130px was a generous estimate of that at
  // the original fixed 0.8rem (12.8px) font-size (real headless-Chrome
  // renders this feature confirmed it as non-overlapping — see this
  // feature's Implementation/Validation Notes), scaled here by how much
  // smaller the clamped font actually renders at this viewport height.
  const boxHeightPx = 130 * (fontSizePx / (0.8 * REM));

  // The human's own seat (feature 020) isn't the shared clamp — it's
  // width: auto around two hero-card images sized by their own clamp,
  // capped at max-width. Estimate its box the same way: card width (and
  // aspect-ratio-derived height) drives both dimensions.
  const heroLiBlock = mediaBlock.match(/\[data-seats\] li\[data-seat="you"\]\s*\{([^}]*)\}/)?.[1];
  const heroCardBlock = mediaBlock.match(/\[data-seats\] li\[data-seat="you"\] \.card-img\s*\{([^}]*)\}/)?.[1];
  assert.ok(heroLiBlock && heroCardBlock, "could not find the human seat's own width/card-size rules");
  const heroMaxWidthRem = Number(heroLiBlock?.match(/max-width:\s*(\d+(?:\.\d+)?)rem/)?.[1]);
  const heroCardClamp = readClamp(heroCardBlock as string, "width");
  assert.ok(heroMaxWidthRem > 0 && heroCardClamp, "could not read the human seat's sizing");
  const heroCardWidthPx = evalClampPx(heroCardClamp as NonNullable<typeof heroCardClamp>, viewportHeightPx, REM);
  const CARD_GAP_PX = 0.25 * REM;
  const LI_PADDING_PX = 2 * (0.25 * REM); // [data-seats] li's own padding, both sides
  const heroBoxWidthPx = Math.min(heroCardWidthPx * 2 + CARD_GAP_PX + LI_PADDING_PX, heroMaxWidthRem * REM);
  const heroCardHeightPx = (heroCardWidthPx * 7) / 5; // aspect-ratio: 5 / 7
  // Text line(s) above the cards, plus the card row itself.
  const heroBoxHeightPx = fontSizePx * 2.6 + heroCardHeightPx;

  const slots = [];
  for (let slot = 1; slot <= 6; slot++) {
    const slotBlock = mediaBlock.match(new RegExp(`\\.seat-slot-${slot}\\s*\\{([^}]*)\\}`))?.[1];
    assert.ok(slotBlock, `.seat-slot-${slot} rule not found`);
    const leftPercent = Number(slotBlock?.match(/left:\s*(\d+(?:\.\d+)?)%/)?.[1]);
    const topPercent = Number(slotBlock?.match(/top:\s*(\d+(?:\.\d+)?)%/)?.[1]);
    assert.ok(!Number.isNaN(leftPercent) && !Number.isNaN(topPercent), `.seat-slot-${slot} missing left%/top%`);
    slots.push({ slot, leftPercent, topPercent, isHero: slot === 1 });
  }

  return { areaWidthPx, areaHeightPx, boxWidthPx, boxHeightPx, heroBoxWidthPx, heroBoxHeightPx, slots };
}

// The two named desktop sizes from features 019/020's own acceptance
// criteria — the actual scenarios that matter, now that sizing depends
// on viewport height as well as width.
const TARGET_VIEWPORTS: [number, number][] = [
  [1280, 800],
  [1440, 900],
];

for (const [viewportWidthPx, viewportHeightPx] of TARGET_VIEWPORTS) {
  test(`geometry check: every seat-slot's box stays fully inside the felt's safe interior at ${viewportWidthPx}x${viewportHeightPx}`, () => {
    const { areaWidthPx, areaHeightPx, boxWidthPx, boxHeightPx, heroBoxWidthPx, heroBoxHeightPx, slots } =
      readSeatGeometry(readOvalMediaBlock(readCss()), viewportWidthPx, viewportHeightPx);
    const MIN_CLEARANCE_PX = 8; // a little slack for border/box-shadow bleed

    for (const { slot, leftPercent, topPercent, isHero } of slots) {
      const x = (leftPercent / 100) * areaWidthPx;
      const y = (topPercent / 100) * areaHeightPx;
      const halfW = (isHero ? heroBoxWidthPx : boxWidthPx) / 2;
      const halfH = (isHero ? heroBoxHeightPx : boxHeightPx) / 2;
      assert.ok(
        x - halfW >= -MIN_CLEARANCE_PX && x + halfW <= areaWidthPx + MIN_CLEARANCE_PX,
        `seat-slot-${slot} box would clip the felt's left/right edge (center x=${x}px, area width ${areaWidthPx}px)`,
      );
      assert.ok(
        y - halfH >= -MIN_CLEARANCE_PX && y + halfH <= areaHeightPx + MIN_CLEARANCE_PX,
        `seat-slot-${slot} box would clip the felt's top/bottom edge (center y=${y}px, area height ${areaHeightPx}px)`,
      );
    }
  });

  test(`geometry check: every pair of seat boxes clears each other on at least one axis at ${viewportWidthPx}x${viewportHeightPx}`, () => {
    const { areaWidthPx, areaHeightPx, boxWidthPx, boxHeightPx, heroBoxWidthPx, heroBoxHeightPx, slots } =
      readSeatGeometry(readOvalMediaBlock(readCss()), viewportWidthPx, viewportHeightPx);

    const points = slots.map(({ slot, leftPercent, topPercent, isHero }) => ({
      slot,
      isHero,
      x: (leftPercent / 100) * areaWidthPx,
      y: (topPercent / 100) * areaHeightPx,
    }));

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i];
        const b = points[j];
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        const aW = a.isHero ? heroBoxWidthPx : boxWidthPx;
        const aH = a.isHero ? heroBoxHeightPx : boxHeightPx;
        const bW = b.isHero ? heroBoxWidthPx : boxWidthPx;
        const bH = b.isHero ? heroBoxHeightPx : boxHeightPx;
        // Axis-aligned bounding-box overlap test: two boxes collide only if
        // they overlap on BOTH axes at once. Seats sharing a row (small dy)
        // are fine as long as they're spread far enough apart horizontally
        // (large dx), and vice versa for seats sharing a column.
        const xClear = dx >= (aW + bW) / 2;
        const yClear = dy >= (aH + bH) / 2;
        assert.ok(
          xClear || yClear,
          `seat-slot-${a.slot} and seat-slot-${b.slot} boxes would overlap (dx=${dx}px, dy=${dy}px)`,
        );
      }
    }
  });
}

test("all pre-existing table-view information a hand shows is still present after the layout change (AC5)", () => {
  const main = readMain();
  const handBlock = main.match(/function renderHand[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(handBlock, "renderHand function not found");
  for (const marker of [
    "data-street",
    "data-turn",
    "hero-cards",
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
