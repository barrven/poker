---
id: 012
title: Hand history
status: deferred
priority: medium
iteration: later
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

_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
