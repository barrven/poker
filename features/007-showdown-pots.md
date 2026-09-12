---
id: 007
title: Showdown, pots, and hand ranking
status: deferred
priority: high
iteration: later
---

## Description

A hand ends when only one player remains (they win the pot without
showing) or after river betting (showdown). The best five-card poker
hand from hole cards plus board wins. Ties split the pot. Side pots
pay correctly when players are all-in for different amounts. Settled
stack changes update the running tab for the human.

## Acceptance Criteria

- [ ] If every opponent folds, the last remaining player is awarded the
      pot without a showdown; folded hole cards stay hidden.
- [ ] After the river betting round with two or more players still in,
      a showdown compares standard high-hand rankings (high card
      through royal flush) using the best five cards from each
      player's two hole cards plus the five board cards.
- [ ] The winning hand (or winning hands) is awarded the pot. Ties
      split the pot as evenly as whole chips allow (odd chip to the
      first winning seat left of the button, or an equivalent documented
      rule applied consistently).
- [ ] When players are all-in for different amounts, side pots are
      built and awarded only among the players who contributed to each
      pot.
- [ ] After settlement, the human's table stack reflects the result,
      and the running tab in SQLite is updated for that stack change
      (tab + table stack remains conserved aside from computer stacks).
- [ ] Hand-rank evaluation is unit-testable without a browser
      (straight vs flush, full house vs trips, wheel straight, board
      playing, ties).

## Implementation Notes

_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
