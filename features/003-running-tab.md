---
id: 003
title: Running tab
status: testing
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

`users.tab INTEGER NOT NULL DEFAULT 1000` (schema 3). Register inserts
1,000. Existing DBs get `ALTER TABLE` so old rows start at 1,000.
`GET /api/me` and `POST /api/register|login` return `{ username, tab }`.
Signed-in UI shows `Tab: 1,000 play-money chips`; `loadSession()` on
reload. No deposit/withdraw/cash-out controls (top-up is 011). Sit/leave
still 004.

Files: `server/db.ts`, `server/auth.ts`, `server/app.ts`, `src/main.ts`.
Auth/scaffold tests updated for tab in `/api/me` and schema 3.

## Test Notes

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
