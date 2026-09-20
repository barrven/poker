---
id: 008
title: Readable table view
status: accept
priority: medium
iteration: 4
---

## Description

The human can read the table at a glance: their hole cards, the board,
every seat's stack, the pot, the dealer button, blinds, whose turn it
is, their running tab, and recent actions. Opponents' hole cards stay
hidden until showdown (or stay mucked on a fold-win).

## Acceptance Criteria

- [x] The human's two hole cards are always visible to the human while
      they are in a hand (and until the hand is over).
- [x] The board shows 0, 3, 4, or 5 community cards matching the
      current street.
- [x] Every seat shows a stack amount. The pot amount is visible.
- [x] The dealer button, blinds (1/2), whose turn it is, and the
      human's running tab are visible.
- [x] Recent actions (fold / check / call / bet / raise / all-in and
      amounts) are visible for the current hand.
- [x] Opponents' hole cards are not shown until a showdown; on a
      fold-win they are not shown (mucked).
- [x] Action controls appear when it is the human's turn and are not
      offered when it is not.

## Implementation Notes

Table chrome (felt color, chip art, card backs) is an open question.
This feature is a readable table, not a themed one. Visual polish is
secondary to a legal, readable layout.

Server (`server/table.ts`): added `ActionLogEntry` (`{ seat, action,
amount?, street }`) and an `actionLog: ActionLogEntry[]` field on both
`TableSession` and `HandView`. A `recordAction()` helper appends one
entry per action; amount is omitted for `fold`/`check` (nothing was
committed) and present for `call`/`bet`/`raise`/`all-in`. Wired into
`advanceComputerActions()` (per computer decision) and `submitAction()`
(per human action, tagging the street the action happened on — captured
*before* applying the action, since a street-completing action can
advance `hand.street` before the response is built). Reset to `[]` in
`startHand()` so each hand's log starts empty. The full-hand log lives
server-side; the client trims to the most recent 8 entries for display
(`renderActionLog`), same "server keeps the truth, client shows a
window" split as everything else in this table.

Client (`src/main.ts`): `data-acting` on the seat list item matching
`actingSeat` (suppressed once `hand.result` is set — nobody's "turn"
after a hand settles); a `<p data-turn>` line above the board deriving
its text from `actingSeat`/`result` (`"Turn: <seat>"`, `"Waiting…"`, or
`"Hand settled."`); `renderActionLog()` renders the trimmed, most-recent-
first list with per-entry street tag.

Assumption: "recent actions" (Acceptance Criterion 5) is read as
"recent enough to follow the hand live," not "the complete history for
this hand" — a full multi-street audit trail is feature 012's job
(Hand history), not this one's. Capped the client view at 8 entries on
that basis.

## Test Notes

New file `tests/action-log.test.ts` (3 tests), plus a fix to
`tests/deal.test.ts`'s existing strict `HandView` key-set assertion
(added `"actionLog"`, since that field is new).

Covered:
- Action-log ordering and amount presence: every entry's `street` is
  correct, amount-bearing actions (`call`/`bet`/`raise`/`all-in`) carry
  a numeric `amount`, amount-less ones (`fold`/`check`) don't; earlier
  entries are never rewritten when new ones append; the human's own
  action lands in the log right after their turn.
- Reset on new hand: a fresh `/api/hand/start` always has a non-empty
  log (computers already acted preflop) whose entries are all
  `street: "preflop"` — proof the previous hand's log didn't leak in.
- Frontend wiring: `renderHand` sets `data-acting` off `hand.actingSeat`
  and renders `<p data-turn>`; `renderActionLog` renders `data-action-log`
  / `data-street-tag`. Checked by source inspection (same regex-based
  pattern the rest of this file's UI tests already use for `main.ts`),
  not a browser — this repo has no browser test runner.

Deliberately not covered:
- Exact turn-indicator text ("Turn: Computer 3" vs "Waiting…" vs "Hand
  settled.") — implementation detail of `renderHand`, not an
  acceptance criterion; the acceptance criterion is "whose turn it is
  is visible," which the `data-turn`/`actingSeat` wiring check already
  establishes.
- Visual rendering (colors, layout, `[data-acting]` CSS highlight
  actually being visible) — confirmed manually via a live curl
  walkthrough against an isolated server instance during `/validate`,
  not asserted in the automated suite (no browser runner in this repo).

Full suite: 118/118 passing, run 4 times in a row (real, unseeded
computer decisions mean this is the standard stability check for any
feature touching hand/betting state, same as every prior feature).

## Validation Notes

Checks: `npm run typecheck` clean, `npm run lint` clean (32 files, 0
warnings/errors), `npm run build` succeeded (client bundle rebuilt:
`index-B0P9usUh.js` / `index-Cg2Ucqce.css`, matching implement-stage
verification that real frontend code shipped). `npm test`: 118/118,
run twice more here (6 total runs across implement/test/validate) with
no flakes.

Live walkthrough (isolated server, scratchpad data dir, curl): sat a
human, started a hand, confirmed the `/api/hand/start` response's
`actionLog` matched the real preflop action taken by seats 3 (raise),
4 (fold), 5 (call) in order with correct amounts, and `actingSeat: 0`
correctly pointed back at the human. Submitted a human `call`, and the
following response's `actionLog` had the human's entry appended (not
rewritten) followed by several more real computer actions, still in
order — confirms recordAction() runs both on the human path
(submitAction) and the computer path (advanceComputerActions).

Acceptance criteria:
- Hole cards always visible while in a hand — pass (pre-existing from
  005, re-verified in the live walkthrough: `holeCards` present and
  unchanged in every response).
- Board shows 0/3/4/5 cards matching street — pass (pre-existing from
  005/007, `tests/deal.test.ts` + `tests/showdown.test.ts`).
- Every seat shows a stack, pot visible — pass (pre-existing, `seats[].stack`
  / `pot` fields render in `renderHand`; unchanged this feature).
- Button, blinds, whose turn, running tab visible — button/blinds
  markers pre-existing (005); whose-turn is new this feature
  (`data-turn`, `data-acting`) — pass, confirmed via `tests/action-log.test.ts`
  and the live walkthrough; tab pre-existing (003).
- Recent actions visible with amounts — pass, new this feature
  (`actionLog` + `renderActionLog`), covered by
  `tests/action-log.test.ts` and the live walkthrough.
- Opponents' hole cards hidden until showdown / mucked on fold-win —
  pass (pre-existing from 005/007, unaffected by this feature;
  `tests/showdown.test.ts` still green).
- Action controls only on the human's turn — pass (pre-existing from
  006, `isHumanTurn` gate untouched by this feature).

All criteria pass. `status: accept`, `STATE.md` phase set to `accept`.

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
