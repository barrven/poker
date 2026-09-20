---
id: 006
title: Betting rounds and legal actions
status: validating
priority: high
iteration: 2
---

## Description

On the human's turn they can fold, check, call, bet, raise, or go
all-in — only the actions that are legal given stacks, the current bet,
and minimum-raise rules. Action order is standard cash-game Hold'em.
Folded and all-in players are skipped.

## Acceptance Criteria

- [ ] Preflop action starts with the seat left of the big blind.
      Postflop action starts with the seat left of the button.
- [ ] Folded players and players who are all-in are skipped for further
      action in that hand.
- [ ] When it is the human's turn, only legal actions are offered:
      fold; check if no bet to them; call if there is a bet they can
      match (or all-in for less); bet if no bet to them and they have
      chips; raise if there is a bet and they have room for a legal
      raise; all-in always when they have a remaining stack and action
      is on them (except they may also fold).
- [ ] Bet and raise amounts respect remaining stacks and minimum-raise
      rules (raise must be at least the size of the last full raise,
      unless the player is going all-in for less).
- [ ] An illegal action (check into a bet, raise below minimum without
      being all-in, acting out of turn) is rejected and does not change
      stacks or the pot.
- [ ] Chips moved as bets are added to the pot (or to the current
      street's contribution so later pot math can run).

## Implementation Notes

New `server/poker/betting.ts` (pure, no I/O, mirrors `deck.ts`/`hand.ts`'s
style): `BettingState` tracks, per seat, `stack`, `folded`, `allIn`,
`streetContribution`, `totalContribution`, `hasActed`, plus the round's
`pot`, `currentBet`, `minRaiseSize`, and `actingSeat` (`null` once the
round is complete). `startBettingRound(stacks, contributions,
startingSeat, currentBet, minRaiseSize)` seeds a round (used for both
preflop, with blind contributions, and — engine-level only for now,
postflop). `legalActions(state, seat)` computes exactly the AC3 rule
table. `applyAction(state, seat, action, amount?)` is the sole state
transition: validates the action is legal (rejects with a reason and an
**unchanged** state otherwise — AC5), moves chips into `pot` and the
seat's contributions (AC6), and returns whether the round is now complete
(`{ complete: true, reason: "one-remaining" | "all-called" }`) so the
caller (not this module) decides what happens next — street advance or
showdown is feature 007's job, matching how 005 left street-advance to
its caller.

`server/table.ts`: `TableSession` gains `betting: BettingState | null`.
`startHand()` now also seeds the preflop round right after posting blinds
(`startingSeat = (bigBlindSeat + 1) % SEAT_COUNT`, i.e. AC1's "left of
the big blind"), then calls a new `advanceComputerActions()` loop.
`submitAction()` (new) validates it's the human's turn via
`applyAction`, syncs the resulting stacks back onto `session.seats`
(single source of truth, read by `/api/me` etc.), then also runs
`advanceComputerActions()`. `handView()` (extended) now exposes `pot`,
`currentBet`, `toCall`, `minRaiseSize`, `actingSeat`, `roundComplete`,
`legalActions` (computed for the human specifically), and each seat's
`folded`/`allIn`/`streetContribution`.

**Computer seats need to act for a hand to be playable at all, and
feature 009 (the real hand-strength/position AI) hasn't shipped yet** —
learned from 005's `/accept` feedback not to ship something reachable
only via curl/tests. `advanceComputerActions()` is a small, explicitly-
labeled placeholder: a computer seat always checks if free, otherwise
calls (for less, if short) — never bets, raises, or folds. It runs
after `startHand()` seeds the round and after every human `submitAction`,
looping until either the human is back on the clock or the round
completes. This makes the **entire first betting round genuinely
playable through the UI today**: with only one human seat and five
"calling station" computers, the human gets exactly one decision (fold /
call / raise / all-in), the computers respond, and the round resolves —
verified live end-to-end (see Validation Notes). Feature 009 replaces
this placeholder's decision function; nothing else about the wiring
should need to change.

New endpoint `POST /api/hand/action` (`server/app.ts`): body
`{ action, amount? }`, 401 logged out, 400 invalid action / not seated /
no hand / illegal (with the engine's specific rejection reason as the
error message), 200 + the same `HandView` shape as `/api/hand`.

Frontend (`src/main.ts`): when it's the human's turn, `renderHand()`
shows real action buttons (`renderActionControls()`,
`data-action="fold|check|call|bet|raise|all-in"`) built from
`legalActions`, with a number input for bet/raise amounts defaulting to
the minimum legal value. Otherwise it shows "Betting round complete." or
"Waiting for other players…" depending on `roundComplete` — an honest,
labeled stopping point (not a silent dead end) for the boundary where
006 hands off to 007 (showdown/next street) and 009 (real AI), neither
of which exist yet. Seats show folded/all-in status and each seat's
current-street bet.

Scope boundary carried over from 005, unchanged: no live street-advance
API (AC1's "postflop starts left of the button" is verified directly
against `startBettingRound` with postflop-style parameters, same
test-harness precedent as `dealFlop`/`dealTurn`/`dealRiver`); no
showdown/hand-ending (that's 007, which will consume `applyAction`'s
`status: RoundStatus` return value).

Simplification, documented rather than silently made: a short all-in
raise (below the standard minimum-raise increment) is treated the same
as a full raise for reopening purposes — it resets `hasActed` for every
other active seat, not just those it can prove it improved on. Real
casino rules are stricter here (a sub-minimum all-in raise does not
reopen the action for players who already faced a larger bet). This is
a deliberate simplification for a recreational play-money app: it is
always at least as permissive/fair to the players who get to act again,
never produces an illegal state, and the edge case (a short all-in
specifically re-opening otherwise-closed action) is rare enough at
200-chip buy-ins with 1/2 blinds not to be worth the added complexity
for v1.

Files: `server/poker/betting.ts` (new), `server/table.ts`, `server/app.ts`,
`src/main.ts`.

## Test Notes

`tests/betting.test.ts` (new, 17 tests — pure engine) and
`tests/action.test.ts` (new, 10 tests — API + UI source checks) via
`npm test` (74/74 total: 17 betting + 10 action + 8 hand + 9 deal + 4
lint + 8 table + 7 auth + 5 tab + 6 scaffold).

`tests/betting.test.ts` covered directly against `server/poker/betting.ts`:
preflop action starts left of the BB, postflop (engine-level, mirroring
005's dealFlop/Turn/River precedent) starts left of the button; folded
and all-in seats are skipped by `nextActingSeat` (verified by folding
two seats and shoving a third, then checking who's next); `legalActions`
for all four AC3 cases (no bet: check+bet, no call; facing a bet with
room: call+raise; facing a bet with too little to raise: call only, no
raise; not this seat's turn: nothing); minimum-raise enforcement (a bet
below the big blind rejected, a raise below the last full raise size
rejected, a raise back above minimum accepted, a raise or bet exceeding
the stack rejected, a short all-in still legal even though it's below
the minimum raise); an illegal action leaves the state byte-for-byte
unchanged (`JSON.stringify` snapshot compared with `deepEqual`) — both
for an action rejected for legality (check facing a bet) and for a
raise below minimum; acting out of turn rejected; chips actually landing
in `pot`/`streetContribution`/`totalContribution`/`stack`; round
completion both ways (`"all-called"` once everyone's checked, and
`"one-remaining"` once folds leave one player).

`tests/action.test.ts` covered via the real HTTP API (register → sit →
`/api/hand/start` → `/api/hand/action`): after dealing, the human faces
the big blind with exactly `{fold, call, raise, all-in}` offered (no
check/bet); a call moves the right chips into the pot and the
placeholder computer opponents auto-complete the entire round (pot
lands at 12 — everyone at the 2-chip big blind); folding flips
`seats[0].folded` without touching the human's stack; a raise to 6
reopens the action for computers that had already called, and they all
call up to the new number (pot 36, everyone at 6, matching the
"placeholder never folds/re-raises" strategy); an illegal check facing
a bet is rejected (400, message mentions "check") and a follow-up
`GET /api/hand` confirms nothing changed (`actingSeat` still 0, `pot`
still 9); a sub-minimum raise is rejected (400, message mentions
"minimum"); acting with no hand in progress or logged out is rejected
(400/401); an unrecognized action name is rejected; going all-in moves
the seat's entire stack into the pot and sets `allIn: true`. The 2 UI
tests check `renderActionControls()`'s source has all six
`data-action="…"` markers and that something in the file wires them to
`/api/hand/action`.

Verified live (not just via `npm test`) on an isolated instance: dealt a
hand, raised preflop to 8 via the same `/api/hand/action` endpoint the
UI buttons call, watched the round auto-complete with all six seats at
8 chips contributed and `roundComplete: true` — and confirmed
`grep -o "data-action"` / `grep -o "/api/hand/action"` both match the
built `dist/client/assets/*.js`, not just dev source (the specific gap
005's `/accept` feedback caught).

Deliberately not: side pots (multiple-all-in-amounts pot splitting is
explicitly 007's "Showdown, pots, and hand ranking" scope; this feature
only tracks each seat's `totalContribution`, which 007 will need);
anything past the first betting round — no street advance, no showdown,
no hand-ending (007 again); real computer strategy (009) — the
placeholder's "always check/call" behavior is itself asserted
(`action.test.ts`'s raise-reopening test relies on it), not something to
special-case away; strict casino-rules reopening semantics for a
sub-minimum all-in raise (documented simplification, Implementation
Notes).

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
