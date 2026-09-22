---
id: 020
title: In-hand view fits the viewport, larger cards, hole cards at the bottom
status: backlog
priority: high
iteration: 6
---

## Description
While a hand is in progress, the whole table view (board, pot, seats,
the player's own hole cards, action controls) fits within the viewport
with no scrolling needed at common desktop and phone screen sizes.
Card images are noticeably larger than the original feature 015/016
sizing (the user had already started bumping `.card-img` toward this
in a direct commit). The player's own two hole cards render at the
bottom of the table view, near the human's own seat, instead of as a
separate "Your cards:" line elsewhere on the page. This is spec
requirements 29, 30, and 31 — grouped into one feature since all three
describe the same visual outcome (a compact, larger-card, no-scroll
table view with the hero's cards at the bottom) and are too
interdependent to ship safely in isolation: bigger cards alone would
make the no-scroll bar harder to hit, and moving the hero's cards only
makes sense once their final size is settled.

Depends on feature 019 (full-width layout) landing first, since how
much viewport width the table gets changes this feature's fit math.

## Acceptance Criteria
_Testable, checkable statements. `/validate` and `/accept` check against these directly._

- [ ] At common desktop viewport sizes (e.g. 1280x800, 1440x900) and
      common phone sizes (e.g. 375x812), the entire in-hand view
      (street/turn indicator, board, pot, all seats, the player's own
      hole cards, and the action controls for the current decision)
      fits within the viewport height with no vertical scrolling
      needed.
- [ ] Card images (hole cards and board) are visibly larger than the
      pre-existing `2.6rem` width — at least matching the `5rem` width
      the user's own direct commit already moved toward.
- [ ] The player's own two hole cards render at the bottom of the
      table view, at/near the human's own seat position — not as a
      separate line elsewhere on the page.
- [ ] The action controls (fold/check/call/bet/raise/all-in, and the
      raise amount input) remain fully visible and usable within the
      no-scroll viewport.
- [ ] All other existing hand-view functionality (opponent hidden/
      revealed cards, turn indicator, acting-seat highlight, action
      log, dealer/blind markers, chip icons, settlement/showdown
      display) remains correct and present — this is a layout change,
      not a rules or data change.

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
