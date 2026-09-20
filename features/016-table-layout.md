---
id: 016
title: Poker table layout (oval seating)
status: backlog
priority: high
iteration: 5
---

## Description
The table view visually resembles a real poker table: the human and
five computer seats are arranged around an oval/circular table shape
instead of stacked in a single column, with poker-themed iconography
(dealer button, chips, pot marker) dressing up the table. This is spec
requirement 28, paired with 015 (card images) as the top-priority
visual change for this slice — scheduled after 015 so the layout is
built around the new card rendering rather than the old text rendering.
Purely visual: no change to table logic, action rules, or data shown.

## Acceptance Criteria
_Testable, checkable statements. `/validate` and `/accept` check against these directly._

- [ ] The 6 seats (human + 5 computer opponents) are positioned around
      an oval/circular table shape, not stacked vertically in a column.
- [ ] Seat positions are readable and non-overlapping on a desktop
      viewport.
- [ ] Seat positions remain usable and non-overlapping on a phone-width
      viewport (the shape may adapt, but nothing clips or overlaps),
      consistent with requirement 19.
- [ ] The dealer button, pot, and stack/bet indicators use recognizable
      poker iconography or styled markers, not bare unstyled text alone.
- [ ] All existing table-view information (hole cards, board, stacks,
      pot, dealer button, blinds, whose turn it is, acting-seat
      highlight, action log) remains present and correct after the
      layout change.

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
