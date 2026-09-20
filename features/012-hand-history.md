---
id: 012
title: Hand history
status: validating
priority: medium
iteration: 4
---

## Description

After each settled hand, a history row is stored for the player: time,
blinds, hole cards, board, result (won / lost / split), and chip delta.
While logged in they can open a list of their past hands. No file
export.

## Acceptance Criteria

- [ ] Settling a hand writes one SQLite history row for that player
      with time, blinds, the player's hole cards, the board (as dealt),
      result (won / lost / split), and chip delta for the human.
- [ ] A logged-in player can open a history view listing their past
      hands with those fields.
- [ ] A player does not see another account's hands.
- [ ] History is still there after a page refresh.
- [ ] There is no hand-history file export and no leaderboard.
- [ ] A folded hand the human lost still records hole cards and delta;
      a fold-win may record an empty or mucked board as actually dealt
      (preflop fold-win has no board).

## Implementation Notes

Schema (`server/db.ts`, `schemaVersion` bumped 3 -> 4): new `hand_history`
table (`user_id`, `played_at`, `small_blind`, `big_blind`, `hole_cards`
JSON, `board` JSON, `result`, `delta`), indexed on `(user_id, id)`.
`CREATE TABLE IF NOT EXISTS` handles migration of existing on-disk
databases automatically — no separate migration step needed.

New module `server/history.ts`: `recordHandHistory()` (insert),
`listHandHistory()` (select, newest first, default cap 50 — no export,
no leaderboard per AC5, just this account's own recent hands), and
`classifyHandResult(winners, humanSeat)`. The classifier is a coarse,
hand-level read of `SettlementResult.winners` (see
`poker/settle.ts#awardPotsAtShowdown`): a seat that won at least one pot
layer appears once with its combined delta; a seat that won nothing
never appears. So: human absent -> "lost"; human alone -> "won"; human
present alongside another winning seat -> "split". This does not
distinguish "won the main pot outright while someone else won a side
pot" from a true split main pot — both read as "split" from the human's
seat, which the acceptance criteria's three-way won/lost/split
vocabulary doesn't ask this feature to disambiguate further.

Wired into `server/table.ts`: a new `recordSettledHandHistory()` helper,
called at the end of both `settleWithoutShowdown()` and
`settleAtShowdown()` (right after `syncHumanTab()`, same place the
running-tab delta is already computed). Delta is
`session.seats[HUMAN_SEAT].stack - session.handStartStack` — identical
value `syncHumanTab` uses, so the history row's delta always matches
what actually happened to the tab. Board/hole cards come from
`session.hand`, which is still populated post-settlement (needed
anyway to keep displaying the settled hand); a preflop fold-win records
`board: []` for free, since `dealFlop` was never called.

New route `GET /api/history` (`server/app.ts`) returns `{ hands: [...] }`
for the logged-in user, 401 if not authenticated. No POST route — rows
are only ever written server-side from a real settlement, never
client-supplied.

Client (`src/main.ts`): a "View hand history" / "Hide hand history"
toggle button, shown regardless of seated state (criterion 2 doesn't
require being seated, and a player might want to check history without
sitting back down). Fetches `/api/history` fresh every time it's
opened — not just once — so a hand settled since the last open shows
up without a full page reload. `renderHistory()` lists rows with time,
blinds, hole cards, board (or "—" if empty), result, and signed delta.

Assumption: "time" (AC1) is the raw SQLite `datetime('now')` string
(UTC, `YYYY-MM-DD HH:MM:SS`) rendered as-is — no timezone conversion or
relative-time formatting. Acceptable for a first cut; not something the
acceptance criteria calls out specifically.

## Test Notes

New file `tests/hand-history.test.ts` (7 tests), plus a fix to
`tests/scaffold.test.ts`'s schema-version assertion (`"3"` -> `"4"`,
since `server/db.ts`'s `schemaVersion` bumped for the new table).

Covered:
- `classifyHandResult()` unit tests: not in winners -> lost, sole
  winner -> won, human + another seat both in winners -> split
  (exhaustive over the classifier's own logic, no HTTP needed).
- Settling any hand writes exactly one history row with the right
  blinds (1/2), 2 hole cards, a board length that's always 0/3/4/5,
  a won/lost/split result, and a numeric delta; cross-checked against
  the settlement response itself (if the human didn't win, the row
  must say "lost").
- A hand the human folds still gets a row with hole cards and a delta
  (AC6's first half) — probabilistic search up to 30 hands for a fold,
  same "generous budget over real randomness" pattern as every other
  feature's tests in this repo, since there's no seeded rng over HTTP.
- Privacy: a second account's `/api/history` is empty after the first
  account has played hands (AC3).
- Auth: a logged-out `GET /api/history` is 401.
- Persistence across a restart: play a hand, close the app/db, reopen
  the *same on-disk data directory* as a fresh `openDb`/`createApp`
  pair, confirm the row is still there (AC4 — a page refresh doesn't
  restart the process, but this is a strictly harder version of the
  same durability claim, and it's what actually distinguishes "written
  to SQLite" from "kept in the in-memory table session").
- Frontend wiring: `/api/history`, the `#history-toggle` button, and
  `renderHistory`'s `data-history` markup, by source inspection (same
  regex pattern used for the rest of this repo's UI, which has no
  browser test runner).

Deliberately not covered:
- A preflop fold-win specifically producing `board: []` in a
  *committed* test — confirmed manually during implementation via a
  live curl walkthrough (a human fold that let the remaining computers
  play to a real river showdown recorded the correct partial board;
  the empty-board path is the same `hand.board` snapshot mechanism,
  exercised whenever `settleWithoutShowdown` fires before any street is
  dealt). Not asserted in the suite because forcing a specific fold
  round without a seeded rng would need either flaky retries or
  reaching into `table.ts` with a controlled rng — this repo
  deliberately never exposes seeded randomness, including from tests,
  to keep every test exercising the same real path production traffic
  does.
- Exact history-view visual styling — `[data-history-row]` CSS is
  structural only, per the same "readable, not themed" scope as 008.
- Pagination/limit beyond the default 50-row cap — not in AC, and no
  UI control for it exists.

Full suite: 125/125, run 4 times in a row.

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
