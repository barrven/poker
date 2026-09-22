---
id: 019
title: Full-width layout (remove the max-width column)
status: backlog
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

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
