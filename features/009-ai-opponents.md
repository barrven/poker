---
id: 009
title: Computer opponents
status: deferred
priority: medium
iteration: later
---

## Description

The five computer seats act on their own turns without the human
clicking for them. They play a recreational strategy based on hand
strength and position/pot — not random folds every hand, and not a GTO
solver. They act in a timely way so a hand can finish.

## Acceptance Criteria

- [ ] When action is on a computer seat, that seat acts without human
      input and within a short, bounded delay (fast enough that a hand
      does not stall).
- [ ] Computer actions are always legal for the current betting state.
- [ ] Over a sample of hands, computers do not take the same action
      regardless of cards (not a constant fold, and not a constant
      all-in).
- [ ] The strategy may use hole-card strength, position, and pot; it
      must not be a GTO solver or require an external service.
- [ ] A single default difficulty is enough for this feature.

## Implementation Notes

Open question, not defaulted here: how tight/aggressive the default
should feel, and whether more than one difficulty is wanted later.
Implement a single recreational policy when this feature is scheduled.

## Test Notes

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
