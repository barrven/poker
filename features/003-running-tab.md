---
id: 003
title: Running tab
status: backlog
priority: high
iteration: 1
---

## Description

Each account has a play-money running tab stored in SQLite. A new
account starts with 1,000 chips. The logged-in player can see their
current tab, and it is still there after a reload. There is no way to
turn it into real money.

## Acceptance Criteria

- [ ] A newly registered account has a tab of 1,000 play-money chips,
      stored in SQLite.
- [ ] While logged in, the player can see their current tab amount.
- [ ] Reloading the app while logged in shows the same tab, not a reset
      or a missing value.
- [ ] There is no deposit, withdrawal, cash-out, or real-currency
      conversion control.
- [ ] Two different accounts have independent tabs.

## Implementation Notes

_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
