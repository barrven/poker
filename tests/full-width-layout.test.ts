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

  // Sized with a viewport unit (fills most of the available width), not a
  // bare rem/px value — and no longer capped at the old 33rem the table
  // used to be stuck at regardless of how wide the screen was.
  assert.match(ovalBlock as string, /width:\s*min\(\s*\d+(?:\.\d+)?vw/);
  assert.doesNotMatch(ovalBlock as string, /\bwidth:\s*100%/);
  assert.doesNotMatch(ovalBlock as string, /max-width:\s*33rem/);

  const [vwPercent, capRem] = (ovalBlock?.match(/width:\s*min\(\s*(\d+(?:\.\d+)?)vw\s*,\s*(\d+(?:\.\d+)?)rem\s*\)/) ?? [])
    .slice(1)
    .map(Number);
  assert.ok(vwPercent > 0 && capRem > 0, "could not read the table's width formula");
  // Under 100vw so the table can never itself force horizontal overflow,
  // and comfortably bigger than the old 33rem/528px cap so it actually
  // fills more of the viewport at common desktop sizes.
  assert.ok(vwPercent < 100, `table width uses ${vwPercent}vw, which could overflow the viewport`);
  assert.ok(capRem > 33, `table's width cap of ${capRem}rem is no bigger than the old 33rem cap`);
});

test("at common desktop widths, the table fills most of the viewport (not a small fixed-size box in a sea of empty space)", () => {
  const css = readCss();
  const mediaBlock = css.match(/@media \(min-width: 640px\) \{([\s\S]*?)\n\}\n\n\[data-actions\]/)?.[1];
  const ovalBlock = mediaBlock?.match(/\.table-oval\s*\{([^}]*)\}/)?.[1];
  const [vwPercent, capRem] = (ovalBlock?.match(/width:\s*min\(\s*(\d+(?:\.\d+)?)vw\s*,\s*(\d+(?:\.\d+)?)rem\s*\)/) ?? [])
    .slice(1)
    .map(Number);
  assert.ok(vwPercent > 0 && capRem > 0, "could not read the table's width formula");

  const REM = 16;
  for (const viewportPx of [1280, 1440]) {
    const renderedWidthPx = Math.min((vwPercent / 100) * viewportPx, capRem * REM);
    assert.ok(
      renderedWidthPx / viewportPx > 0.6,
      `at ${viewportPx}px the table only renders ${renderedWidthPx}px wide (${Math.round(
        (renderedWidthPx / viewportPx) * 100,
      )}% of the viewport) — doesn't read as "filling most of the available width"`,
    );
  }
});
