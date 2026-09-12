---
id: 008
title: Readable table view
status: deferred
priority: medium
iteration: later
---

## Description

The human can read the table at a glance: their hole cards, the board,
every seat's stack, the pot, the dealer button, blinds, whose turn it
is, their running tab, and recent actions. Opponents' hole cards stay
hidden until showdown (or stay mucked on a fold-win).

## Acceptance Criteria

- [ ] The human's two hole cards are always visible to the human while
      they are in a hand (and until the hand is over).
- [ ] The board shows 0, 3, 4, or 5 community cards matching the
      current street.
- [ ] Every seat shows a stack amount. The pot amount is visible.
- [ ] The dealer button, blinds (1/2), whose turn it is, and the
      human's running tab are visible.
- [ ] Recent actions (fold / check / call / bet / raise / all-in and
      amounts) are visible for the current hand.
- [ ] Opponents' hole cards are not shown until a showdown; on a
      fold-win they are not shown (mucked).
- [ ] Action controls appear when it is the human's turn and are not
      offered when it is not.

## Implementation Notes

Table chrome (felt color, chip art, card backs) is an open question.
This feature is a readable table, not a themed one. Visual polish is
secondary to a legal, readable layout.

## Test Notes

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
