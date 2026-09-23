import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readCss(): string {
  return fs.readFileSync(path.join(root, "src/style.css"), "utf8");
}

test("#app has no page-wide max-width cap, commented out or otherwise", () => {
  const css = readCss();
  const appBlock = css.match(/#app\s*\{([^}]*)\}/)?.[1];
  assert.ok(appBlock, "#app rule not found");
  assert.doesNotMatch(appBlock as string, /max-width/);
  // Regression guard: feature 016/018's old 36rem cap, and the commented-out
  // form the user had already started removing by hand, are both gone —
  // not just disabled.
  assert.doesNotMatch(css, /36rem/);
});

test("the poker table's desktop width is viewport-relative, not a small fixed rem cap", () => {
  const css = readCss();
  const mediaBlock = css.match(/@media \(min-width: 640px\) \{([\s\S]*?)\n\}\n\n\[data-actions\]/)?.[1];
  assert.ok(mediaBlock, "oval breakpoint media query not found");
  const ovalBlock = mediaBlock?.match(/\.table-oval\s*\{([^}]*)\}/)?.[1];
  assert.ok(ovalBlock, ".table-oval rule not found in the oval media query");

  // Sized with viewport units (originally just width — feature 019 —
  // now also height, feature 020's no-scroll in-hand fit), not a bare
  // rem/px value, and no longer capped at the old 33rem the table used
  // to be stuck at regardless of how wide the screen was.
  assert.match(ovalBlock as string, /width:\s*min\(\s*\d+(?:\.\d+)?vw/);
  assert.doesNotMatch(ovalBlock as string, /\bwidth:\s*100%/);
  assert.doesNotMatch(ovalBlock as string, /max-width:\s*33rem/);

  const [vwPercent, capRem, vhPercent] = (
    ovalBlock?.match(
      /width:\s*min\(\s*(\d+(?:\.\d+)?)vw\s*,\s*(\d+(?:\.\d+)?)rem\s*,\s*(\d+(?:\.\d+)?)vh\s*\)/,
    ) ?? []
  )
    .slice(1)
    .map(Number);
  assert.ok(
    vwPercent > 0 && capRem > 0 && vhPercent > 0,
    "could not read the table's width formula",
  );
  // Under 100vw so the table can never itself force horizontal overflow,
  // and comfortably bigger than the old 33rem/528px cap so it's still a
  // real step up from that original fixed size.
  assert.ok(vwPercent < 100, `table width uses ${vwPercent}vw, which could overflow the viewport`);
  assert.ok(capRem > 33, `table's width cap of ${capRem}rem is no bigger than the old 33rem cap`);
});

// Feature 020 added the third (vh) term to this same width formula so the
// in-hand view fits the viewport height with no scrolling (its own AC1) —
// see tests/inhand-viewport-fit.test.ts for that requirement. At the two
// target desktop sizes that vh term is actually the *smallest* of the
// three (and so the one that wins the min()) — the felt now renders
// smaller there than feature 019 alone would have sized it (even smaller
// than the pre-019 fixed 33rem/528px cap in this specific case). That's a
// deliberate, verified tradeoff — see 020's Implementation Notes — not a
// bug: the no-scroll fit (checked in tests/inhand-viewport-fit.test.ts)
// is what actually governs the felt's size at these viewports now. What's
// still checked here is just that it hasn't collapsed to something
// unusably tiny.
test("at common desktop widths, the table is still a substantial, clearly-visible size", () => {
  const css = readCss();
  const mediaBlock = css.match(/@media \(min-width: 640px\) \{([\s\S]*?)\n\}\n\n\[data-actions\]/)?.[1];
  const ovalBlock = mediaBlock?.match(/\.table-oval\s*\{([^}]*)\}/)?.[1];
  const [vwPercent, capRem, vhPercent] = (
    ovalBlock?.match(
      /width:\s*min\(\s*(\d+(?:\.\d+)?)vw\s*,\s*(\d+(?:\.\d+)?)rem\s*,\s*(\d+(?:\.\d+)?)vh\s*\)/,
    ) ?? []
  )
    .slice(1)
    .map(Number);
  assert.ok(
    vwPercent > 0 && capRem > 0 && vhPercent > 0,
    "could not read the table's width formula",
  );

  const REM = 16;
  const MIN_USABLE_WIDTH_PX = 20 * REM; // well above the 9rem seat-box width alone
  for (const [viewportW, viewportH] of [
    [1280, 800],
    [1440, 900],
  ]) {
    const renderedWidthPx = Math.min(
      (vwPercent / 100) * viewportW,
      capRem * REM,
      (vhPercent / 100) * viewportH,
    );
    assert.ok(
      renderedWidthPx > MIN_USABLE_WIDTH_PX,
      `at ${viewportW}x${viewportH} the table renders only ${renderedWidthPx}px wide, too small to be a usable table`,
    );
  }
});
