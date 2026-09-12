---
id: 010
title: Next hand and 6-handed table
status: deferred
priority: medium
iteration: later
---

## Description

After a hand settles, the next hand starts automatically if the human
still has chips on the table. The button moves one seat clockwise.
Computer opponents that bust are replaced with a fresh 200-chip stack
so the table stays 6-handed. An in-progress hand does not have to
resume after a refresh.

## Acceptance Criteria

- [ ] After settlement, if the human's table stack is greater than 0,
      a new hand starts without the human clicking "deal" (button
      moved one seat clockwise from the previous hand).
- [ ] If the human's table stack is 0, a new hand does not start until
      they rebuy or leave (rebuy is a later feature).
- [ ] A computer seat whose stack reaches 0 is replaced with a new
      200-chip computer stack before the next hand. The table remains
      six seats, no empties.
- [ ] Refreshing during a hand does not have to restore that hand; the
      next sit is a new table. Tab and history (once history exists)
      reflect the last fully settled hand.

## Implementation Notes

_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
