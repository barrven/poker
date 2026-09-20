---
id: 011
title: Rebuy and play-money top-up
status: backlog
priority: medium
iteration: 3
---

## Description

If the human is felted, they can rebuy 200 from the tab when the tab
covers it, or leave. If the tab cannot cover a 200 buy-in, they can add
a 1,000 play-money top-up to the tab and then rebuy or sit again. Still
not real money.

## Acceptance Criteria

- [ ] When the human's table stack is 0 and the tab is at least 200,
      they can rebuy 200: tab decreases by 200, table stack becomes
      200, and play can continue.
- [ ] When the table stack is 0 they can leave instead of rebuying;
      leave settles as in sit/leave (stack 0, tab unchanged by the
      leave itself).
- [ ] When the tab is below 200, rebuy and sit are not allowed until a
      top-up. The player can add 1,000 play-money chips to the tab.
      SQLite shows the new tab. They can then rebuy or sit.
- [ ] Top-up is play money only: no payment form, no currency, no
      cash-out.
- [ ] Tab updates for rebuy and top-up are visible after reload.

## Implementation Notes

_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
