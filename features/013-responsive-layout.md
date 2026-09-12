---
id: 013
title: Phone-usable layout
status: deferred
priority: low
iteration: later
---

## Description

Login, tab, table (cards, stacks, action controls), and history remain
usable on a phone browser, not only on a desktop layout. Native apps
are out of scope.

## Acceptance Criteria

- [ ] At a phone-sized viewport (~375px wide), register, log in, log
      out, and the tab amount are usable without horizontal scrolling
      away the primary controls.
- [ ] At that viewport, hole cards, board, stacks, pot, whose turn,
      and action controls remain tappable and readable (no control
      clipped off-screen with no way to reach it).
- [ ] The history view is readable at that viewport (list can scroll
      vertically).
- [ ] Desktop layout still works after the phone layout exists.

## Implementation Notes

_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
