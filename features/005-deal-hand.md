---
id: 005
title: Deal a Hold'em hand
status: backlog
priority: high
iteration: 2
---

## Description

Once seated, a hand can start: a shuffled 52-card deck, a dealer button,
small and big blinds posted, two hole cards each, then flop/turn/river
in the standard sequence. No betting logic required beyond posting
blinds.

## Acceptance Criteria

- [ ] Each hand uses a standard 52-card deck that is shuffled before
      the deal. No duplicate cards appear among hole cards and board
      in the same hand.
- [ ] A dealer button is assigned and visible. Small blind (1) and big
      blind (2) are posted automatically from the correct seats and
      deducted from those stacks before hole cards are dealt.
- [ ] Each of the six seats is dealt two private hole cards.
- [ ] Community cards come in the Hold'em sequence: flop (three), then
      turn (one), then river (one). Streets can be advanced by a test
      harness or by later betting completing a round; the engine must
      not deal the turn before the flop or the river before the turn.
- [ ] The human's hole cards are available to the human client; other
      seats' hole cards are not.

## Implementation Notes

_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
