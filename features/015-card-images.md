---
id: 015
title: Card images for hole and community cards
status: backlog
priority: high
iteration: 5
---

## Description
The player's own hole cards and the community cards (flop, turn, river)
render as real card images instead of text/placeholder rendering, using
the SVG artwork in `card-svgs/` (rank+suit filenames, e.g. `AS.svg`,
`TH.svg`). Opponent hole cards that are still hidden show a card-back
image (`card-svgs/1B.svg` or `2B.svg`) instead of text or nothing, until
they're revealed at showdown. This is spec requirement 27 and the
user's stated top priority for this slice.

## Acceptance Criteria
_Testable, checkable statements. `/validate` and `/accept` check against these directly._

- [ ] The player's own two hole cards render using the matching
      `card-svgs/<rank><suit>.svg` image for each dealt card.
- [ ] Community cards render using the matching `card-svgs/` image as
      each street is revealed (flop shows 3, turn adds 1, river adds 1).
- [ ] Opponent hole cards that are hidden show a card-back image, not
      the real card and not plain text, until showdown.
- [ ] At showdown, opponent hole cards that are shown (per existing
      showdown/muck rules) render as real card images.
- [ ] Card images are legible and correctly sized with no distortion or
      overlap on both a desktop viewport and a phone-width viewport.
- [ ] No plain-text card notation (e.g. "AS", "Kh") remains visible
      anywhere a card image now appears.

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
