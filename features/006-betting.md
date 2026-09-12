---
id: 006
title: Betting rounds and legal actions
status: deferred
priority: high
iteration: later
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

_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
