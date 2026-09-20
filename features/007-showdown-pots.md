---
id: 007
title: Showdown, pots, and hand ranking
status: accept
priority: high
iteration: 2
---

## Description

A hand ends when only one player remains (they win the pot without
showing) or after river betting (showdown). The best five-card poker
hand from hole cards plus board wins. Ties split the pot. Side pots
pay correctly when players are all-in for different amounts. Settled
stack changes update the running tab for the human.

## Acceptance Criteria

- [x] If every opponent folds, the last remaining player is awarded the
      pot without a showdown; folded hole cards stay hidden.
- [x] After the river betting round with two or more players still in,
      a showdown compares standard high-hand rankings (high card
      through royal flush) using the best five cards from each
      player's two hole cards plus the five board cards.
- [x] The winning hand (or winning hands) is awarded the pot. Ties
      split the pot as evenly as whole chips allow (odd chip to the
      first winning seat left of the button, or an equivalent documented
      rule applied consistently).
- [x] When players are all-in for different amounts, side pots are
      built and awarded only among the players who contributed to each
      pot.
- [x] After settlement, the human's table stack reflects the result,
      and the running tab in SQLite is updated for that stack change
      (tab + table stack remains conserved aside from computer stacks).
- [x] Hand-rank evaluation is unit-testable without a browser
      (straight vs flush, full house vs trips, wheel straight, board
      playing, ties).

## Implementation Notes

This feature ended up needing to wire the **whole hand lifecycle**
together, not just add hand-ranking — see "Scope note" below for why.

New `server/poker/rank.ts` (pure): standard high-hand evaluator.
`evaluateBestHand(cards: Card[])` tries all C(7,5)=21 five-card
combinations of a seat's 2 hole + 5 board cards and returns the best
`{ category, tiebreakers }` (categories 0 High Card .. 8 Straight Flush,
`compareHandRank` for ordering/ties). Handles the wheel (A-2-3-4-5 plays
5-high, including as a steel-wheel straight flush) as a special case
since it's the one place ace-low breaks the "ranks are always 2-14"
assumption. `categoryName()` gives the human-readable label used in the
settlement view.

New `server/poker/settle.ts` (pure): `awardPotWithoutShowdown` (fold-out,
AC1 — whole pot to the sole non-folded seat) and `awardPotsAtShowdown`
(AC2-4). Side pots (AC4) use the standard layered algorithm: for each
distinct total-contribution level among seats with chips in, build a pot
layer of `(level - previousLevel) * contributorsAtOrAboveThisLevel`,
eligible to be won only by non-folded seats that contributed at least
that level — so a short all-in only ever contests pots sized to its own
stack. Ties split the layer floor-evenly with the remainder chip(s)
going to the lowest seat index among the tied winners (AC3's "or an
equivalent documented rule applied consistently" — true left-of-button
ordering would need button-relative sorting for no fairness benefit this
app currently surfaces).

**Scope note — why this touched betting/hand orchestration, not just
pots:** AC2 requires "after the river betting round... a showdown" to
be real, reachable behavior, and AC1 requires an actual fold-out to
settle. Neither was reachable before this feature: 006 explicitly left
"no live street-advance" and "no showdown" as its boundary. So 007 also
had to become the feature that drives a hand from the end of one betting
round to the next street (or to settlement) — the caller-decides logic
006's `applyAction`/`roundStatus` was designed to hand off to.

`server/poker/betting.ts` gained two things this feature needed and 006
didn't: `startNextStreet(previous, startingSeat, minRaiseSize)` — a
street transition preserves `pot` and each seat's `totalContribution`
(a fresh `startBettingRound` would wrongly zero them, losing side-pot
math across streets) while resetting only the per-street bookkeeping —
and an exported `roundStatus`/`firstToAct` (previously
private/duplicated) so `table.ts` can inspect completion and resolve a
street's opening actor while correctly skipping folded/all-in seats
(needed now that, unlike 006's single always-fresh preflop round, later
streets can start with seats already folded or all-in from earlier ones).

`server/table.ts`: `TableSession` gains `betting` unchanged, plus
`handStartStack` (the human's stack the instant the hand began, before
blinds — `syncHumanTab`'s baseline) and `result: SettlementResult |
null`. New `progressHand(db, userId, session)` is the orchestrator: after
any action, it runs the placeholder computer strategy, and once a round
completes, either settles (`"one-remaining"` → `settleWithoutShowdown`;
`"all-called"` on the river → `settleAtShowdown`) or deals the next
street (`advanceStreet`, wrapping `dealFlop`/`dealTurn`/`dealRiver`) and
starts its round — looping until either a human decision is needed or
the hand is settled. This also correctly handles an "all-in runout" for
free: if nobody can act (all remaining are all-in), each fresh street's
round is immediately complete on its own, so the loop just keeps
advancing straight to the river without any special-casing.

Tab sync (AC5, spec requirement 18): `syncHumanTab` diffs the human's
stack against `handStartStack` and, if non-zero, adds that delta to
`users.tab` in SQLite — a genuinely new trigger point, distinct from
004's sit/leave-only tab updates. Verified live end-to-end (see
Validation Notes): tab went 1000 → 800 on sit (buy-in, unchanged
behavior) → 798 after losing 2 chips in a hand (new behavior).

`startHand()`'s "hand in progress" guard changed from "a hand exists" to
"a hand exists and hasn't been settled" (`session.hand && !session.result`),
so a new hand can be dealt once the previous one settles — needed since
`session.hand` stays populated after settlement (so `GET /api/hand`/the
UI can keep showing the outcome) rather than being cleared immediately.

`HandView` gained `result: SettlementResult | null` —
`{ reason: "fold" | "showdown", pot, winners: {seat, delta}[],
revealed?: {seat, cards, category}[] }`. `revealed` (non-folded seats'
hole cards + hand name) is populated only at showdown, never on a
fold-out — AC1's "folded hole cards stay hidden" plus spec requirement
12's "opponents' hole cards stay hidden... until showdown": at showdown
they're no longer hidden, by definition.

**Frontend, added in this same pass (not deferred) — see 005's `/accept`
feedback:** `renderHand()` now shows `renderSettlement()` in place of the
action controls once `hand.result` is set: who won and by how much, the
showdown reveal (cards + hand name) when applicable, and a "Deal next
hand" button (`#deal`, reusing the existing sit-down click handler)
wired to the same `POST /api/hand/start`. Confirmed in the production
bundle, not just dev source (`grep -o "Deal next hand"` /
`"data-settlement"` both matched `dist/client/assets/*.js`).

Files: `server/poker/rank.ts` (new), `server/poker/settle.ts` (new),
`server/poker/betting.ts` (`startNextStreet`, exported `roundStatus`/
`firstToAct`, removed the now-redundant private `nextActingSeat`),
`server/table.ts` (rewritten), `src/main.ts`.

## Test Notes

New test files: `tests/rank.test.ts` (9), `tests/settle.test.ts` (6),
`tests/showdown.test.ts` (5, API integration + 1 UI source check) — 21
new tests. Plus corrected 3 existing tests (`tests/action.test.ts` x2,
`tests/deal.test.ts` x1) whose expectations predated live street
advancement (see "Regressions found and fixed" below). `npm test` —
94/94 total: 9 rank + 6 settle + 5 showdown + 17 betting + 10 action +
8 hand + 9 deal + 4 lint + 8 table + 7 auth + 5 tab + 6 scaffold.

`tests/rank.test.ts`: flush beats a plain straight; full house beats
trips; the wheel (A2345) is a valid 5-high straight, the *lowest*
straight; a suited wheel is a straight flush, not "just" a flush; the
board can play on its own (no hole card improves a made board hand);
two-pair ties compare the kicker; identical 7-card inputs tie exactly;
category names read correctly; evaluating fewer than 5 cards throws.

`tests/settle.test.ts`: fold-out (AC1) awards the whole pot to the sole
seat; a heads-up showdown (AC2) awards the pot to the better hand; an
exact tie splits evenly with the odd-seat-index rule (AC3); a folded
seat's chips still fund the pot even though it can't win; two dedicated
side-pot tests (AC4) — a short all-in only contests a pot sized to its
own contribution (wins the main pot outright here, loses the side pot
it isn't eligible for), and a folded seat's larger contribution still
funds a side pot it can't win.

`tests/showdown.test.ts` (live API, register → sit → deal → play to
settlement — outcome-agnostic on purpose: the live endpoint deals real
random cards, no seeded rng is exposed over HTTP, deliberately, so
these assert invariants that hold regardless of who wins, run 5x
locally to rule out flakiness from the real randomness): the human's
SQLite tab after settlement equals `tabBeforeHand + (finalStack - 200)`,
verified both via `/api/me` and a direct `SELECT` (AC5, spec requirement
18); a settled showdown reveals hole cards with a category name and
offers no further actions, and acting on a settled hand is rejected; a
new hand can be dealt once the previous one settles; total chips across
all six seats is exactly 1200 after settlement (nothing created or
destroyed — the pot is fully paid out). Plus one source-text check
(same convention as `renderTable`/`renderHand`/`renderActionControls`)
that `renderSettlement()` shows the result and wires "Deal next hand" to
`/api/hand/start`.

**Regressions found and fixed (expected, not bugs):** wiring live street
advancement changed real, correct behavior that three existing tests
had encoded assumptions about:
- `tests/deal.test.ts`'s exact-key-set check on `HandView` needed the
  new `result` key added (same pattern as 006 needing it for
  006's own new keys).
- `tests/action.test.ts`'s "a legal call…" test assumed the round would
  stay "complete" after the human's one preflop call. It doesn't
  anymore — nobody ever bets on the flop, so the free round of checks
  runs all the way around and lands back on the human (the button, who
  acts last post-flop) for another decision, correctly. Rewrote the
  assertions for that (now-correct) landing state instead of the old
  premature "done" one.
- Similarly, the raise test assumed the whole hand would auto-resolve to
  a river showdown after one human raise. It doesn't either — the human
  isn't folded or all-in, so they're never skipped, and get a decision
  on every street. Only `tests/action.test.ts`'s **fold** test genuinely
  reaches an unattended river showdown, because folding removes the
  human from the action order entirely, leaving only computers (who
  never stop the free-check loop on their own).

**Deliberately not covered live:** AC1's "every opponent folds" fold-out
path is not reachable through the public API today — the placeholder
computer strategy (006) never folds, and only the human seat is
directly controllable, so there is currently no way to get down to "one
non-folded seat" except via the human being that seat with everyone
else still in (which is what actually happens, via `"showdown"`, not
`"fold"`). The pot-math and round-completion detection for that path
are both fully tested (`settle.test.ts`'s fold-out test;
`betting.test.ts`'s existing "one-remaining" round-completion test), and
`settleWithoutShowdown`'s wiring in `progressHand` is structurally
identical to `settleAtShowdown`'s (which *is* exercised live) — but the
live end-to-end path itself waits on feature 009's real AI, which can
actually fold. Also not covered: multi-way side pots with three or more
distinct all-in levels (two-level side pots are tested; the algorithm
generalizes, but a 3+-level scenario isn't separately exercised).

## Validation Notes

2026-09-19 — pass. Ready for `/accept`.

Project checks:
- lint: pass
- typecheck: pass
- build: pass
- tests: pass (`npm test` — 94/94: 9 rank + 6 settle + 5 showdown +
  17 betting + 10 action + 8 hand + 9 deal + 4 lint + 8 table + 7 auth +
  5 tab + 6 scaffold)

Live walkthrough already done during `/implement` (see Test Notes) on an
isolated instance: registered, sat, dealt, called preflop, checked
through flop/turn/river, and reached a real showdown — seat 5's "2d,4c"
on a "4s,Qh,2c,8c,9h" board correctly evaluated as Two Pair, correctly
beat four Pair hands and the human's High Card, and was awarded the
12-chip pot (stack 198→210). Confirmed the human's tab moved 1000→800
(sit) →798 (lost 2 chips this hand) in SQLite directly. Confirmed
"Deal next hand" / `data-settlement` are present in the built
`dist/client/assets/*.js`, not just dev source.

1. **Pass (mechanically — not reachable live today, see Test Notes).**
   `awardPotWithoutShowdown` gives the whole pot to the sole non-folded
   seat (`settle.test.ts`); `roundStatus` detects "one-remaining"
   correctly at every fold count (`betting.test.ts`, carried from 006).
   Not live-reachable because the placeholder computer strategy (006)
   never folds — waits on feature 009's real AI.
2. **Pass.** Live showdown reached after a full preflop→river sequence
   with no further folds; `evaluateBestHand` compares all 21 five-card
   combinations of hole+board per seat (`rank.test.ts` covers every
   category ordering plus the wheel/steel-wheel special cases).
3. **Pass.** Winners awarded via `compareHandRank`; ties split evenly
   with the documented odd-chip rule (`settle.test.ts`'s dedicated tie
   test — AC3 explicitly permits "an equivalent documented rule").
4. **Pass.** Side pots built per contribution level, eligible only to
   non-folded contributors at or above that level — a short all-in
   winning only its own-sized pot, and a folded seat still funding (but
   never winning) a pot, are both dedicated tests in `settle.test.ts`.
5. **Pass.** Live: tab in SQLite updated immediately on hand settlement
   (798), not deferred to leave — matches spec requirement 18 exactly.
   `showdown.test.ts`'s outcome-agnostic invariant test
   (`tab == tabBeforeHand + (finalStack - 200)`) additionally covers the
   win case (not just the loss the live walkthrough happened to hit),
   run 5x locally against real random cards with no failures.
6. **Pass.** `rank.test.ts` and `settle.test.ts` both import and test
   `server/poker/*` modules directly with no server, no HTTP, no
   browser — pure functions in, plain objects out.

No new deviations beyond what's already recorded in Implementation
Notes (fixed human seat 0 and first-hand button 0, carried from 005;
the placeholder computer strategy and the short-all-in reopening
simplification, carried from 006) — all deliberate and documented
there, plus this feature's own new simplification (odd-chip tie-break
by ascending seat index rather than button-relative order).

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
