---
id: 015
title: Card images for hole and community cards
status: validating
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

Approach: `vite.config.ts` sets `publicDir: "card-svgs"` so the existing
`card-svgs/` folder is served as-is at the site root (e.g.
`card-svgs/AS.svg` -> `/AS.svg`, `card-svgs/1B.svg` -> `/1B.svg`) in both
dev and build — no duplicating/symlinking the asset folder. A card code
from the API (`"As"`, `"Th"`, rank as-is + lowercase suit) maps to its
filename by uppercasing the suit (`cardImageSrc` in `src/main.ts`).

`src/main.ts`: added `cardImg`/`cardBackImg`/`renderCards`/
`renderHiddenCards` helpers and used them everywhere card notation used
to render as text — the human's hole cards (`data-hole-cards`), the
board (`data-board`), and the showdown reveal list (`data-revealed`).
Each computer seat in the seat list now shows two card-back images
while its hole cards are hidden, swapped for real card images once that
seat appears in `hand.result.revealed` (showdown only; a fold-out
settlement has no `revealed` array, so opponent cards there stay
face-down, matching the existing muck behavior — never shown).

`src/style.css`: sized `.card-img` in rem with a `5/7` `aspect-ratio`
(matches the SVGs' own `viewBox`, verified exactly, so no distortion)
and a smaller width under the existing 480px phone breakpoint; replaced
the old monospace card-text styling on `[data-hole-cards]`/`[data-board]`/
`[data-revealed]` with flex layout for the new inline images. Updated
the stale "no card graphics" comment left over from feature 008.

Hand history (feature 012's past-hands list) still renders card codes as
text — the feature's scope (Description, AC1-4) is the live hand view
only, and AC6 ("no plain-text notation anywhere a card image now
appears") only bites where an image now appears, which history isn't.
Noting this as the assumption per AGENTS.md; `/validate` can flag it if
that reading's wrong.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

New file `tests/card-images.test.ts` (9 tests, no jsdom in this project —
same source-regex + live-API convention as the rest of `tests/`):

- Every card `createDeck()` can produce, plus both `1B.svg`/`2B.svg`
  card-backs, has a real file in `card-svgs/` (asset-completeness check
  against the actual server alphabet, not a hardcoded list).
- `vite.config.ts` sets `publicDir: "card-svgs"`.
- `cardImageSrc`/`cardImg`/`cardBackImg`/`renderCards`/`renderHiddenCards`
  exist and wire together as expected (uppercased suit, `<img>` markup,
  `1B.svg` for backs).
- `renderHand` uses `renderCards` for both `data-hole-cards` and
  `data-board`, with a regression guard that the old
  `holeCards.join(" ")` / `board.join(" ")` text form is gone.
- Per-seat markup: human seat gets no card slot of its own, a computer
  seat defaults to `renderHiddenCards(2)`, and swaps to
  `renderCards(revealedEntry.cards)` only for a seat found in
  `hand.result.revealed` by seat index.
- `renderSettlement`'s revealed list uses `renderCards`, guarded against
  the old `r.cards.join(" ")` text form.
- `.card-img` has both an `aspect-ratio` and a width, with an override
  under the existing 480px phone breakpoint (AC5 — no distortion at
  either viewport size).
- Live end-to-end: starts a real hand over HTTP, asserts the returned
  `holeCards` match the `rank+suit` shape and each has a matching
  `card-svgs/` file. A second live test drives hands (capped at 20
  attempts, same outcome-agnostic style as `tests/showdown.test.ts`'s
  `playToSettlement`) until a real showdown reveal occurs, then checks
  every revealed card the same way — ties the client's rendering
  assumption to real server-dealt data, not just a mocked shape.

Ran 4 consecutive full-suite passes (139/139 each) to rule out flakiness
from the showdown-reveal test's real randomness.

Deliberately not covered: no actual pixel-level/visual rendering check
(no jsdom/browser test harness in this project — verified manually
instead, see Implementation Notes and this feature's live-server SVG
resolution check during `/implement`). Hand history's plain-text card
codes are untouched per the Implementation Notes assumption, so no test
added there.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
