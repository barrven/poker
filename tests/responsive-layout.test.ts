import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the page has a mobile viewport meta tag, so phone browsers render at device width instead of a zoomed-out desktop layout", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /<meta\s+name="viewport"\s+content="width=device-width, initial-scale=1\.0"\s*\/?>/);
});

test("box-sizing is reset to border-box everywhere, so an element's declared width already includes its padding and border", () => {
  const css = fs.readFileSync(path.join(root, "src/style.css"), "utf8");
  assert.match(css, /\*\s*,\s*\*::before\s*,\s*\*::after\s*\{[^}]*box-sizing:\s*border-box/);
});

test("buttons and inputs have a 44px minimum tap target, the accepted minimum for a comfortably tappable control on a phone", () => {
  const css = fs.readFileSync(path.join(root, "src/style.css"), "utf8");
  const buttonRule = css.match(/\bbutton\s*\{[^}]*\}/)?.[0];
  const inputRule = css.match(/(?<!\[data-actions\]\s)\binput\s*\{[^}]*\}/)?.[0];
  assert.ok(buttonRule, "button rule not found");
  assert.ok(inputRule, "input rule not found");
  assert.match(buttonRule, /min-height:\s*44px/);
  assert.match(inputRule, /min-height:\s*44px/);
});

test("a narrow-viewport media query exists to trim the outer gutter on phone-sized screens", () => {
  const css = fs.readFileSync(path.join(root, "src/style.css"), "utf8");
  assert.match(css, /@media \(max-width:\s*480px\)/);
});

test("no layout rule pins a fixed pixel width wider than a phone screen, which would force horizontal scrolling", () => {
  const css = fs.readFileSync(path.join(root, "src/style.css"), "utf8");
  const fixedWidths = [...css.matchAll(/(?<![-a-z])width:\s*(\d+)px/g)].map((m) => Number(m[1]));
  for (const w of fixedWidths) {
    assert.ok(w < 375, `found a fixed width of ${w}px, wider than a 375px phone viewport`);
  }
});
