---
id: 010
title: Next hand and 6-handed table
status: validating
priority: medium
iteration: 3
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

`server/table.ts`: `TableSession` gains `button: number` (the seat that
will be the button for the *next* hand dealt), replacing the fixed
`FIRST_HAND_BUTTON = 0` constant 005 introduced (its own notes always
flagged rotation as 010's job). `sitDown()` initializes it to 0 — a
fresh sit is always a fresh table, so this never carries across a
leave/re-sit (AC4's "the next sit is a new table", already true of
every other piece of per-hand state and now true of the button too).
`startHand()` deals with the session's current `button`, then rotates it
(`(button + 1) % SEAT_COUNT`) for whichever hand gets dealt next (AC1).

Two new guards in `startHand()`, both checked before dealing:
- **Felted human (AC2):** if `seats[HUMAN_SEAT].stack <= 0`, return a new
  `"felted"` reason instead of dealing — `server/app.ts` turns this into
  a 400 ("Add chips to your table stack before starting a new hand.").
  Rebuying is feature 011 (next in this slice); until it ships, the only
  way out of this state is to leave.
- **Busted computer replacement (AC3):** `replenishBustedComputers()`
  (new, exported, pure — mirrors 009's `capBlindPosts()` extraction) sets
  any computer seat at `stack <= 0` back to `BUY_IN` before the deal.
  Computer opponents aren't bound by the human's real bankroll — this is
  the one place new chips enter the table rather than moving between
  seats, so the "total chips = 1200" invariant 009's stress testing
  relied on **no longer holds** once a computer has busted and been
  replenished (documented here so it isn't mistaken for a regression if
  someone reaches for that same check later).

AC4 ("refreshing doesn't have to restore the hand, the next sit is a new
table") needed no new code: in-memory session state already persists
across requests within a server process (stronger than required, same
as 004/005 already established) and a leave clears the session outright
(`sitDown()` always builds a fresh one). Confirmed, not re-derived from
scratch.

**Frontend (`src/main.ts`), same pass, not deferred** (005's `/accept`
lesson): `renderSettlement()` branches on the human's post-settlement
stack — non-zero shows "Next hand starting…" plus an optional "Deal next
hand now" button (skips the wait, doesn't replace it), zero shows a
felted message ("You're out of chips… Leave to settle your tab
(rebuying is coming soon)") with no deal control at all, since the
server would just reject it. `scheduleAutoDeal()` (new) sets a 3-second
`setTimeout` calling the existing `onDeal()` handler once per newly-
settled hand (guarded so re-renders of the same settled state don't
stack up duplicate timers), cleared on leave/logout so a stale timer
never fires against a different account or view. No server-side delay —
this is purely "give the human a moment to read the result before
advancing," not a simulated "thinking" pause (AI opponents already
decide instantly, unchanged from 009).

Files: `server/table.ts` (button rotation, both new guards,
`replenishBustedComputers()` extracted), `server/app.ts` (+"felted"
handling), `src/main.ts` (auto-deal scheduling, felted/next-hand
messaging).

## Test Notes

New `tests/next-hand.test.ts` (5 tests). Corrected one existing test
(`tests/showdown.test.ts`'s "a new hand can be dealt after the previous
one settles", which predated the felted guard and unconditionally
expected 200) and one stale button-text assertion. `npm test` — 110/110
total (105 from before + 5 new), re-run 20x consecutively with zero
failures (real `Math.random` dealing throughout, as with every other
gameplay test file).

- **Button rotation (AC1):** plays up to 3 hands via the live API with
  safe call/check decisions, asserting each hand's button is
  `previousButton + 1 (mod 6)` — deterministic regardless of cards, so
  no flakiness here. Bounded to however many hands actually start,
  since even safe play can legitimately bust the human (a computer's
  raise can build a pot the human then loses outright) — covered by the
  next test, not a failure of this one.
- **Felted rejection (AC2):** shoves all-in every hand (high variance,
  reliably busts within a handful of hands against five opponents) up
  to 50 attempts, then asserts `POST /api/hand/start` returns 400 with a
  chips/stack-mentioning message, and that `POST /api/leave` still
  succeeds while felted. Probabilistic by nature (no seeded rng exposed
  over HTTP, deliberately); the 50-hand budget makes a false failure
  astronomically unlikely — one single-run flake was observed during
  development at a 30-hand budget and did not reproduce in ~90
  subsequent isolated runs, raised to 50 as cheap extra margin.
- **`replenishBustedComputers()` (AC3):** direct unit test against a
  hand-built `Seat[]` array — a busted computer seat resets to 200, a
  busted *human* seat is untouched (AC2 owns that path, not this
  function), and a solvent computer seat is untouched. Fully
  deterministic, no live play needed (same extraction pattern as 009's
  `capBlindPosts()`).
- **Frontend (AC1/AC2 together):** source-text check that
  `renderSettlement()` branches on `humanStack` and shows an "out of
  chips" message, and that the file wires a `setTimeout`-based
  `scheduleAutoDeal()`.

Verified live during `/implement` (not just via `npm test`) on an
isolated instance: played through hands confirming button 0→1→2 across
three real hands; found a real busted-computer scenario within the
first attempt of a small script and confirmed the *next* hand's deal
showed that seat back at exactly 200; drove a human to 0 via all-in
play and confirmed `/api/hand/start` correctly refused with "Add chips
to your table stack before starting a new hand."

Deliberately not covered: AC4 (refresh/new-table behavior) — no new
code was needed for it (Implementation Notes explains why), and it's
already covered by 004/005's own tests for the underlying session
persistence and fresh-sit behavior; re-testing it here would just be
re-deriving those. Rebuying a felted human (that's 011, next in this
slice — deliberately left unresolved by 010, matching AC2's own
wording "rebuy is a later feature").

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
