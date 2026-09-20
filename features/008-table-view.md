---
id: 008
title: Readable table view
status: testing
priority: medium
iteration: 4
---

## Description

The human can read the table at a glance: their hole cards, the board,
every seat's stack, the pot, the dealer button, blinds, whose turn it
is, their running tab, and recent actions. Opponents' hole cards stay
hidden until showdown (or stay mucked on a fold-win).

## Acceptance Criteria

- [ ] The human's two hole cards are always visible to the human while
      they are in a hand (and until the hand is over).
- [ ] The board shows 0, 3, 4, or 5 community cards matching the
      current street.
- [ ] Every seat shows a stack amount. The pot amount is visible.
- [ ] The dealer button, blinds (1/2), whose turn it is, and the
      human's running tab are visible.
- [ ] Recent actions (fold / check / call / bet / raise / all-in and
      amounts) are visible for the current hand.
- [ ] Opponents' hole cards are not shown until a showdown; on a
      fold-win they are not shown (mucked).
- [ ] Action controls appear when it is the human's turn and are not
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

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
