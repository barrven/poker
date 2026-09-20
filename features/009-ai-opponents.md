---
id: 009
title: Computer opponents
status: accept
priority: medium
iteration: 2
---

## Description

The five computer seats act on their own turns without the human
clicking for them. They play a recreational strategy based on hand
strength and position/pot — not random folds every hand, and not a GTO
solver. They act in a timely way so a hand can finish.

## Acceptance Criteria

- [x] When action is on a computer seat, that seat acts without human
      input and within a short, bounded delay (fast enough that a hand
      does not stall).
- [x] Computer actions are always legal for the current betting state.
- [x] Over a sample of hands, computers do not take the same action
      regardless of cards (not a constant fold, and not a constant
      all-in).
- [x] The strategy may use hole-card strength, position, and pot; it
      must not be a GTO solver or require an external service.
- [x] A single default difficulty is enough for this feature.

## Implementation Notes

New `server/poker/ai.ts` (pure): `decide(input): { action, amount? }` — a
single recreational policy (AC5). Estimates hand strength in [0,1]:
preflop, a lightweight starting-hand heuristic (high cards + pair bonus
scaled by rank + suited bonus + connectedness bonus, since there's no
board yet to evaluate); postflop, the *real* evaluator from feature 007
(`evaluateBestHand`) mapped from its category (0-8) plus a small nudge
from the top tiebreaker — reusing 007's engine rather than inventing a
second heuristic. A small position nudge (`positionScore`, 0 worst/first
to act .. 1 best/button) and pot odds (`toCall / (pot + toCall)`) factor
into the facing-a-bet decision. Aggression (bet/raise) is always sized to
the table minimum — deliberately simple and always safe (legalActions
only offers bet/raise when the minimum is affordable), and still produces
varied action choices across hands (AC3), since that varies with the
input (real cards), not with randomized sizing.

`server/table.ts`'s `advanceComputerActions()` (previously feature 006's
always-check/call placeholder) now calls `decide()` with the acting
seat's real hole cards, the board, `legalActions()`'s output, and a
`positionScore` computed from the seat's distance (mod 6) from the seat
that acts first post-flop. If `applyAction` ever rejects what `decide()`
returned, this throws (not a silent skip) — that would mean a real bug,
not a reachable runtime condition (AC2: computer actions are always
legal). No artificial delay (AC1's "short, bounded delay"): the decision
is a synchronous, deterministic-given-its-inputs function; there's no
streaming/websocket channel for the human to perceive an in-progress
"thinking" delay mid-request anyway, so a `setTimeout` would only slow
the API down with no UX benefit — worth revisiting if 008's table view
ever wants to *animate* a pause, not simulate a real delay.

No frontend changes needed — 006/007 already render whatever the server
decides (bet buttons, fold/all-in status, showdown reveals); swapping the
decision-maker is purely a backend change. Confirmed the bundle hash is
unchanged (`index-B9GSAvkE.js`, same as 007's build) as expected, not a
sign anything was missed.

**Four real bugs found and fixed, surfaced by exercising betting paths
the old check/call-only placeholder never touched** (see Test Notes for
the stress-testing methodology that found them):

1. `legalActions()` mislabeled the big blind's preflop "option" as a
   fresh **"bet"** instead of a **"raise"**. `toCall <= 0` (nothing more
   owed) does not mean the street is unopened — the BB's own posted
   blind already makes `currentBet > 0`. A computer with a strong hand
   choosing "bet" there hit `applyAction`'s real, correct rejection ("A
   bet is already live"). Fixed by keying "bet" vs "raise" off
   `currentBet === 0`, not `toCall`.
2. `legalActions()` offered **"bet"** whenever `currentBet === 0`,
   without checking the seat could actually afford the minimum — a
   short-stacked computer choosing "bet" hit "Bet exceeds remaining
   stack". Fixed by requiring `stack >= minRaiseSize`.
3. `startHand()` posted blinds **unconditionally**, without capping at
   the seat's stack. Since the button never rotates yet (010, deferred)
   the SB/BB are fixed at seats 1/2 every hand; a computer that busted to
   a very low stack in an earlier hand would, on the next deal, be asked
   to post a blind bigger than what it had left — **driving its stack
   negative**. Fixed by capping each blind post at the seat's actual
   stack (an all-in blind), extracted as `capBlindPosts()` (now exported,
   independently tested). This is adjacent to feature 010's job
   ("replace a busted computer's stack before the next deal") but isn't
   *owned* by it — a stack must never go negative regardless of when
   010 ships.
4. `awardPotsAtShowdown()` (007) could **lose chips outright**: if every
   contributor to a pot layer had folded (a real, if unusual, sequence —
   a seat commits more than everyone remaining, then folds on a later
   street while the others are short-stacked all-ins), the layer had
   zero eligible winners and was silently skipped — the money vanished
   from the table instead of being returned to whoever funded it. Fixed
   by refunding an all-folded layer to its own contributors.

All four were latent in code from 006/007 (or, for #3, a genuine
consequence of the button-never-rotating simplification those features
made) — the old check/call placeholder simply never exercised the code
paths that expose them (it never bet/raised, and its stack never
dropped low enough to hit a blind-capping edge). This is the concrete
payoff of replacing it with a real strategy in this feature, beyond the
strategy itself.

Files: `server/poker/ai.ts` (new), `server/poker/betting.ts` (bugs 1-2),
`server/poker/settle.ts` (bug 4), `server/table.ts` (bug 3 +
`capBlindPosts()` extracted/exported, AI wiring).

## Test Notes

New: `tests/ai.test.ts` (5), `tests/blinds.test.ts` (3), plus regression
tests added to `tests/betting.test.ts` (2) and `tests/settle.test.ts`
(1) for the bugs found during this feature — 11 new tests. Corrected 5
existing tests in `tests/action.test.ts`/`tests/showdown.test.ts` whose
assertions assumed the old placeholder's deterministic check/call-only
behavior (see "Regressions found and fixed" below). `npm test` —
105/105 total: 19 betting (incl. 2 regression) + 10 action + 8 hand +
9 deal + 4 lint + 8 table + 8 auth + 5 tab + 5 scaffold + 9 rank +
7 settle (incl. 1 regression) + 5 showdown + 5 ai + 3 blinds.

`tests/ai.test.ts`: `decide()` sampled across a wide grid of hole cards
× boards × bet contexts always returns an action that was actually
offered (AC2); a strong hand facing a bet doesn't always fold, and a
strong hand facing no bet doesn't always shove (AC3's "not constant
fold, not constant all-in" from the opposite direction each); identical
pressure produces different decisions for pocket aces vs. 7-2 offsuit
(hand strength is the actual driver, not chance); the BB-option and
short-stack-can't-bet regressions (bugs 1-2) verified end-to-end through
`decide()` itself, not just `legalActions()` in isolation.

`tests/blinds.test.ts`: `capBlindPosts()` (bug 3) caps a blind at the
seat's stack (2-chip BB, 1-chip stack → posts 1), leaves a normal post
unaffected, and correctly posts a zero blind for a seat with exactly 0.

Regression tests added to existing files: `tests/betting.test.ts` gets
the BB-option-offers-raise-not-bet and short-stack-no-bet-offered checks
directly against `legalActions()` (bugs 1-2, engine level);
`tests/settle.test.ts` gets the all-folded-layer-is-refunded check (bug
4) — asserts the total awarded across all seats equals the total
contributed, the actual invariant whose violation (1200 → 1199 chips)
is what surfaced this bug during stress testing.

**How the four real bugs (Implementation Notes) were actually found:**
none of them showed up from ordinary `npm test` runs — they needed
volume and real (non-placeholder) decision variety to hit. Wrote
throwaway local stress scripts (not committed — this is process, not a
permanent test asset) directly against `server/table.ts`'s exported
functions: one drove thousands of hands with the human always
calling/checking, one with the human choosing fully random legal
actions (including malformed bet/raise amounts, to exercise rejection
paths too), asserting after every action and every settlement that (a)
no stack ever went negative and (b) total chips across all six seats
stayed exactly 1200 (200 x 6) — a strict, cheap, and very effective
invariant. Bugs 1-2 surfaced within the first few hundred hands (the BB
option and short-stack-bet paths are common); bug 3 took ~4-9 hands
accumulating losses onto a fixed blind seat; bug 4 needed thousands of
hands to hit the specific fold-after-over-committing sequence. Each bug,
once found, was reduced to the permanent, deterministic unit tests
described above — the stress scripts themselves aren't part of the
suite (they're slow, and their random-actions harness would make CI
flaky by design — that's exactly why they were useful for *discovery*,
not for regression *prevention*).

**Regressions found and fixed in pre-existing tests (expected, not new
bugs):** real (non-deterministic-outcome) computer decisions broke
several tests that had encoded the old placeholder's guaranteed
check/call-every-time behavior:
- Exact `stack <= 200` assertions after a hand progresses/settles are
  now wrong — a winner's stack can exceed 200 once a pot is awarded.
  Relaxed to `<= 1200` (the whole table's chips) or removed where a
  fold-out settlement could plausibly happen within the same response.
- `currentBet` and `pot` assertions that assumed "the round completes
  right after my one action" no longer hold — a computer can re-raise
  (requiring more human decisions before a street's round actually
  closes) or simply call through to a completed round that then
  auto-advances to the next street (resetting `currentBet` to 0) within
  the same API response. Rewrote these to check forward progress and
  street-conditional invariants instead of exact scripted numbers.
- `respondSafely`/`playToSettlement` helpers' iteration caps (30) were
  occasionally too tight once real re-raising could require more human
  decisions per street; raised to 100 (comfortably above what the stress
  testing above ever needed).
- The "going all-in" test assumed the human's stack always stays 0
  immediately after shoving — true unless every computer opponent folds
  to the shove within the same response, settling the hand as a
  fold-out win.
- The "deal a new hand after settlement" test assumed the new hand
  always starts unsettled — not true if the human busted to 0 in the
  first hand: they're dealt into the second hand already all-in for 0
  and can't act, so it can settle immediately too. Rebuying a busted
  stack is feature 011 (deferred); this endpoint doesn't refuse to deal
  to a stackless seat.

All of the above were re-run 20x consecutively (`npm test`, real
`Math.random` dealing, no seeding) with zero failures before calling
this stable.

Deliberately not covered: multiple difficulty levels (AC5 explicitly
scopes a single default); precise GTO-style equity calculations (AC4
explicitly rules out a solver); button rotation interacting with the
AI's position signal (010, deferred — `positionScore` is currently
computed from a fixed button, so it's accurate for this session but
untested against a rotating button).

## Validation Notes

2026-09-19 — pass. Ready for `/accept`.

Project checks:
- lint: pass
- typecheck: pass
- build: pass (bundle hash unchanged from 007 — correctly, this feature
  is backend-only, see Implementation Notes)
- tests: pass, `npm test` re-run 3x plus 20x during `/test` — 105/105
  every time, real (unseeded) dealing throughout

Live walkthrough already done during `/implement`: dealt a hand,
confirmed varied real decisions (one computer folded a weak hand,
others called with a normal-strength hand) rather than a scripted
pattern.

1. **Pass.** Computer actions resolve synchronously within the same
   request as the triggering human action (or hand start) — no polling,
   no stall. No artificial delay added; reasoning in Implementation
   Notes (no streaming channel exists yet for a human to perceive one).
2. **Pass.** `decide()` only ever returns an action drawn from the
   `legalActions` it was given (`tests/ai.test.ts`, sampled across a
   wide grid of hands/boards/bet contexts); `applyAction` throws loudly
   if this were ever violated (`server/table.ts`), rather than silently
   skipping — a stronger guarantee than a passive test alone.
3. **Pass.** Pocket aces and 7-2 offsuit produce different decisions
   under identical pressure (`tests/ai.test.ts`); a strong hand doesn't
   always fold facing a bet, and doesn't always shove when checking is
   available — both directions of "not constant" verified. Live: one
   computer folded, four called on the same deal.
4. **Pass.** `decide()` uses hand strength (preflop heuristic or 007's
   real evaluator postflop), position (`positionScore`), and pot odds
   (`toCall / (pot + toCall)`) — no external service, no solver, just
   arithmetic thresholds.
5. **Pass.** `decide()` always returns a single, fixed policy — no
   difficulty parameter exists to vary.

Beyond the acceptance criteria: this feature's stress testing (see Test
Notes) found and fixed four real, pre-existing correctness bugs in the
betting/settlement engine (006/007) that the check/call-only placeholder
had never exercised (it never bet/raised, and never got short-stacked
enough to hit a blind-capping edge). All four are now covered by
permanent regression tests. No new deviations beyond what's recorded in
Implementation Notes.

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
