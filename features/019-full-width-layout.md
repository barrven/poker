---
id: 019
title: Full-width layout (remove the max-width column)
status: done
priority: high
iteration: 6
---

## Description
The app no longer constrains its page to a narrow centered column.
`#app`'s fixed `max-width` is removed entirely (not replaced with a
different cap) so every view — guest forms, the dashboard, and the
table — uses the available viewport width. The poker table specifically
fills most of that width at common desktop sizes, rather than being
capped at a small fixed size inside the old column. This is spec
requirement 32, and formalizes a change the user had already started
making directly (`src/style.css`, commenting out `#app`'s
`max-width: 36rem`).

## Acceptance Criteria
_Testable, checkable statements. `/validate` and `/accept` check against these directly._

- [ ] No element enforces a page-wide `max-width` — `#app`'s `36rem`
      cap (or any equivalent replacement) is gone, not just commented
      out.
- [ ] The poker table (oval, feature 016) is sized relative to the
      viewport so it fills most of the available width at common
      desktop sizes (e.g. 1280px, 1440px) — not capped at the small
      fixed rem value features 016/018 originally used.
- [ ] No new horizontal scrolling is introduced anywhere (guest forms,
      dashboard, table view) at common desktop or phone widths, per
      requirement 19's existing bar.
- [ ] All previously-shipped functionality (auth forms, dashboard,
      table, hand view, hand history) remains usable and correctly
      wired — this is a layout-only change, not a behavior change.

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

Single file touched: `src/style.css`.

- `#app`'s already-commented-out `max-width: 36rem` line removed entirely
  (was `/* max-width: 36rem; */`); `margin: 0 auto` left in place since it's
  a harmless no-op once the element has no max-width, and removing it isn't
  required by the acceptance criteria.
- `.table-oval`'s desktop rule (`@media (min-width: 640px)`) changed from a
  fixed `width: 100%; max-width: 33rem` to `width: min(92vw, 80rem)` — scales
  with the viewport (fills ~92% of it) but caps at 80rem (1280px) so it
  doesn't grow absurdly large on ultra-wide monitors. `aspect-ratio: 3/2`
  unchanged.
- Updated the stale comment above the phone media query that referenced
  "#app's fluid max-width" (already inaccurate before this change, since
  that max-width was already commented out).
- Verified visually with real headless-Chrome screenshots (via a scratch
  puppeteer-core script driving `/usr/bin/google-chrome`, since the Claude
  in Chrome extension wasn't connected this session) at 1440x900, 1280x800,
  and 375x812, logged into a live seated/in-hand game state: no horizontal
  scrolling at any width (`document.documentElement.scrollWidth` ==
  `clientWidth` at all three), guest/dashboard views span the full width,
  and the table oval visibly fills most of the viewport width at both
  desktop sizes.
- Assumption: the oval growing tall enough to need vertical scrolling at
  1440x900/1280x800 in-hand is expected and out of scope here — the
  no-scroll *vertical* fit is explicitly feature 020's job (which depends
  on 019 landing first per its own description). This feature's AC3 only
  bars new *horizontal* scrolling, which holds.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

New file `tests/full-width-layout.test.ts` (3 tests), static CSS checks:
- `#app` has no `max-width` at all (commented-out or live), and the old
  `36rem` value is gone from the stylesheet entirely (regression guard).
- `.table-oval`'s desktop rule sizes with a viewport unit
  (`min(NNvw, NNrem)`), not a bare `100%`/fixed value, its `vw` share is
  under 100 (so it can never itself cause horizontal overflow), and its
  rem cap is bigger than the old `33rem` (so it actually grows).
- At 1280px and 1440px viewports, the formula renders the table at over
  60% of the viewport width — matches AC2's "fills most of the available
  width" at those two named sizes.

Also fixed two now-stale existing tests in `tests/table-layout.test.ts`
(feature 016's geometry checks) that read `.table-oval`'s old fixed
`max-width: 33rem` to compute the felt's pixel size for its seat
overlap/clearance checks — that property no longer exists post-019.
Updated `readSeatGeometry` to instead compute the felt's *worst-case*
(smallest) size at the oval breakpoint's own 640px floor, since seat
boxes are fixed-px and a bigger felt only ever gives them more room; the
checks and their invariants are otherwise unchanged. This is a
test-formula update to track an intentional CSS change, not a
weakened assertion — same pass/fail conditions, on the correct data.

Deliberately not covered: real-browser horizontal-scroll measurement
(the CSS-math check above stands in for it) and AC4 (existing
functionality) — this is a CSS-only change with no markup/behavior
touched, so the full pre-existing suite (164 tests, all still green) is
the regression net for that, not new tests. Full suite run 4 times
(167/167 every time) plus lint/typecheck clean. Visual confirmation
(headless-Chrome screenshots at 1440/1280/375px against a live
seated/in-hand game, `scrollWidth === clientWidth` at all three) was
done during `/implement`; not re-run here since nothing changed since.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

**Tooling:** lint (Biome) clean, typecheck clean, build clean, full test
suite 167/167 across 5 fresh runs this stage (in addition to the 4 stable
runs already done in `/test`).

**AC1 — no page-wide max-width, gone not commented:** pass. `grep -n
"max-width" src/style.css` returns only the two unrelated
`@media (max-width: 480px)` phone breakpoints; `#app`'s rule is just
`padding: 2rem 1.25rem;`, and `36rem` doesn't appear anywhere in the
stylesheet. Confirmed live: the guest login view at 1440px renders edge to
edge (screenshot), not capped to a centered ~576px column.

**AC2 — table sized relative to viewport, fills most width at 1280/1440:**
pass. `.table-oval`'s desktop rule is `width: min(92vw, 80rem)` (was
`max-width: 33rem` fixed). Re-ran a fresh live check this stage (new test
user, registered → sat → hand started, via a scratch puppeteer-core
script driving real `/usr/bin/google-chrome`, since the Claude in Chrome
extension isn't connected this session): screenshots at 1440x900 and
1280x800 show the oval visibly filling most of the viewport width, matching
`tests/full-width-layout.test.ts`'s formula check (>60% of viewport at
both sizes; actual is ~92% at 1280px — `min(92vw, 80rem)` still under the
80rem/1280px cap there — and ~89% at 1440px, where the cap now binds
(`min(1324.8px, 1280px)` = 1280px) — both comfortably over the bar and a
clear step up from the old fixed 528px table).

**AC3 — no new horizontal scrolling anywhere:** pass. Re-verified live
this stage with `document.documentElement.scrollWidth ===
document.documentElement.clientWidth` at every combination checked: guest
login view @1440px, logged-in-but-not-seated dashboard @1440/1280/375px,
and the live in-hand table view @1440/1280/375px — no overflow (`ok`) in
every case, no `OVERFLOW` result anywhere.

**AC4 — all previously-shipped functionality remains usable/correctly
wired:** pass. This was a CSS-only change (one file touched at
`/implement`: `src/style.css`; `/test` additionally touched
`tests/table-layout.test.ts` to fix its geometry-check math, not any
shipped code). The full pre-existing regression suite (164 tests covering
auth, tab, sit/leave, betting, showdown, AI, hand history, dashboard,
login/register, card images, table layout, responsive layout) stayed
green throughout, and this stage's live walkthrough (register → sit →
hand start → real hole cards, opponent seats, pot, board all rendering
correctly) exercised the real functional path end to end, not just CSS.

**Overall: accept.**

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._

2026-09-23 — Presented the validated summary (diff, all 4 ACs, test/visual
results, and the note that the in-hand view now needs vertical scrolling
at desktop sizes — expected, deferred to feature 020) via AskUserQuestion.
User chose **Accept and continue**. Decision: accepted.
