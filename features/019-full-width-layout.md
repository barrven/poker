---
id: 019
title: Full-width layout (remove the max-width column)
status: testing
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

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
