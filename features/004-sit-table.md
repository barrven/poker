---
id: 004
title: Sit down and leave the table
status: validating
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

New `server/table.ts`: in-memory `Map<userId, stack>` for seating (no cards
or betting yet, and a reload does not have to resume the table per the
acceptance criteria, so this does not need SQLite persistence the way
`users.tab` does). `BUY_IN = 200`, blinds 1/2, `COMPUTER_SEATS = 5`.
`sitDown()`/`leaveTable()` read/write `users.tab` directly and guard
already-seated / insufficient-tab / not-seated.

`POST /api/sit` (200 on success, 400 insufficient tab, 409 already seated,
401 logged out) and `POST /api/leave` (200, 400 not seated, 401 logged
out) added to `server/app.ts`, replacing the `/api/sit` 404 stub.
`/api/logout` now settles (`leaveTable`) before deleting the session, so
"ending the session from the table" also returns the stack to the tab.
`userPayload()` (used by register/login/me/sit/leave) now returns
`{ username, tab, seated, stack }`.

`src/main.ts`: signed-in view renders either a "Sit down (200 chips)"
button (`#sit`/`data-sit`, disabled-by-omission with an error message
instead of a control when `tab < 200`) or the seated table — 1 human +
5 computer seats each at 200 chips, "Blinds: 1/2 play-money.", and a
`#leave` button. Wrapper div is `data-seated-table` (not `data-table`,
which would collide with tab.test.ts's `/data-tab/` substring check).

Assumption: since bots hold no real money in this feature, their 200-chip
seats are static display, not per-user state — only the human's seat/stack
is tracked. Table state is in-memory, scoped to the `DatabaseSync` instance
via a `WeakMap<DatabaseSync, Map<userId, stack>>` (not a bare module-level
map — two independent db instances in one process, e.g. concurrent test
runs, must not share seating just because a user id repeats). It happens to
survive an in-process reload (stronger than the acceptance criteria
requires, which only demands the tab reflect the settlement).

Files: `server/table.ts` (new), `server/app.ts`, `src/main.ts`.

Known follow-up for `/test`: `tests/auth.test.ts`'s `deepEqual` checks on
register/login/me bodies and its "logged-out visitor cannot sit" guard
(`doesNotMatch` on any sit button/text) predate this feature and need
updating, same pattern as 003's tab-field update to those tests.

## Test Notes

`tests/table.test.ts` (new, 8 tests) via `npm test` (26/26 total: 8 table +
7 auth + 5 tab + 6 scaffold).

Covered: sitting with >=200 tab returns `seated:true, stack:200`; tab
deducted to 800 and SQLite reflects it; `renderTable`'s source shows one
static human seat, a loop over `COMPUTER_SEATS` (=5) computer seats each
at `BUY_IN` chips, and "Blinds: 1/2"; leaving returns the stack to the tab
(1000) and clears it in SQLite, and a second leave 400s (not seated);
logging out while seated also settles the tab in SQLite; a tab below 200
gets a 400 and leaves SQLite unchanged; a logged-out `/api/sit` 401s and
the guest markup source has no `data-sit`/`id="sit"`; two `/api/me` calls
after sitting return the same tab (800) as a reload would, and leave still
settles correctly afterward.

Updated `tests/auth.test.ts`'s `deepEqual` body checks (register/login/me)
to include `seated: false, stack: 0`, and trimmed its "logged-out visitor
cannot sit" test to the 401/auth check — the UI-detail assertions it used
to make (no sit button/text anywhere in `main.ts`) predated this feature
and are superseded by `table.test.ts`'s scoped guest-markup check.

Bug found and fixed during this stage: `server/table.ts`'s seat map was
originally a single module-level `Map<userId, stack>`, which leaked state
across independent `DatabaseSync` instances that happen to assign the same
autoincrement user id (surfaced as spurious "already seated" / wrong-tab
failures once `table.test.ts`'s several fresh-db tests ran in the same
process). Fixed by scoping the map per `DatabaseSync` via `WeakMap`.

Deliberately not: a real browser reload or DOM assertions (this project
has no jsdom; frontend checks are source-text regexes, consistent with
002/003); multiple concurrent computer-seat interactions (no betting yet,
bot stacks are static 200 display only); server-restart persistence of
seating (acceptance criteria explicitly allows a reload to not resume the
table).

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
