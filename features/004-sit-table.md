---
id: 004
title: Sit down and leave the table
status: backlog
priority: high
iteration: 1
---

## Description

A logged-in player can sit at a 6-max cash table with one click. Sitting
buys in 200 chips from their tab onto the table (blinds 1/2). Leaving
settles the table stack back to the tab. Five computer seats are filled
so the table is never short-handed. Cards and betting can wait; this
feature is sit, stacks, and leave.

## Acceptance Criteria

- [ ] A logged-in player with at least 200 on the tab can sit down
      without any configuration beyond that action.
- [ ] Sitting deducts 200 from the tab and puts 200 on the human's
      table stack. SQLite reflects the new tab.
- [ ] The table shows six seats: the human and five computer opponents,
      each computer seat with a 200-chip stack. Empty seats are not
      offered.
- [ ] Blinds are shown as 1/2 play-money.
- [ ] Leaving the table (or ending the session from the table) adds the
      human's current table stack back to the tab and clears the table
      stack. SQLite reflects the settled tab.
- [ ] A player whose tab is below 200 cannot sit; they stay off the
      table and the tab is unchanged.
- [ ] A logged-out visitor cannot sit.
- [ ] Reloading while seated does not have to resume the table; the tab
      must still match the last sit/leave settlement (an abandoned
      in-progress table may treat leave as a settlement of the last
      known stack).

## Implementation Notes

_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
