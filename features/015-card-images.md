---
id: 015
title: Card images for hole and community cards
status: accept
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

- [x] The player's own two hole cards render using the matching
      `card-svgs/<rank><suit>.svg` image for each dealt card.
- [x] Community cards render using the matching `card-svgs/` image as
      each street is revealed (flop shows 3, turn adds 1, river adds 1).
- [x] Opponent hole cards that are hidden show a card-back image, not
      the real card and not plain text, until showdown.
- [x] At showdown, opponent hole cards that are shown (per existing
      showdown/muck rules) render as real card images.
- [x] Card images are legible and correctly sized with no distortion or
      overlap on both a desktop viewport and a phone-width viewport.
- [x] No plain-text card notation (e.g. "AS", "Kh") remains visible
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

**Tooling:** `typecheck` clean (all 4 project tsconfigs), `lint` clean
(biome, 36 files), `build` clean (`vite build` + server `tsc`; confirmed
all 56 `card-svgs/*.svg` files land in `dist/client/`). Full test suite:
139/139, run 5 consecutive times with no flakes (the showdown-reveal
test in `tests/card-images.test.ts` and the pre-existing
`playToSettlement`-based tests both depend on real randomness).

**Live walkthrough (curl against the real API + dev server, not just
the test suite):** registered a user, sat down, dealt a hand, and drove
it action-by-action to a real showdown. Observed street/board
progression directly from `/api/hand/action` responses:
`preflop: []` -> `flop: [3 cards]` -> `turn: [4 cards]` ->
`river: [5 cards]`, then a `showdown` settlement with a `revealed` array
carrying 2 real cards per contending seat (e.g. `Kh`, `7h`). Separately
confirmed `/KS.svg`, `/KH.svg`, `/1B.svg` etc. all resolve 200 over the
Vite dev server. This ties the exact data shape `renderCards` /
`renderHiddenCards` consume (`src/main.ts`) to what the server actually
sends, end to end. (Cleaned up: left the table, no stray dev processes
left running, `git status` clean afterward.)

No headless-Chrome/browser check was possible this run — no browser
extension is connected to this account at all (`list_connected_browsers`
returned empty), not just a flaky connection, so this isn't a retryable
gap. In its place: (1) verified by direct byte-level inspection that
every `card-svgs/*.svg`'s `viewBox`/`width`/`height` is exactly a 5:7
ratio, matching `.card-img`'s CSS `aspect-ratio: 5 / 7` precisely — a
width-driven, ratio-locked `<img>` cannot distort against an intrinsic
ratio identical to its own; (2) `[data-hole-cards]`, `[data-board]`,
`.cards`, and `[data-seats] li` all use `flex-wrap: wrap`, the same
wrapping approach feature 013 already validated with real headless
Chrome at 375px for this same seat list; (3) the 480px `.card-img` width
override follows the existing phone breakpoint pattern from 013 exactly.
This is a reasoned-through pass, not an observed one — flagging
explicitly rather than claiming a visual check that didn't happen.
Recommend a human eyeball this on `/accept` (or next time a browser is
connected) given it's the one AC not mechanically checked.

Per-criterion:
1. **Pass.** `renderHand`'s `data-hole-cards` calls
   `renderCards(hand.holeCards)`; live walkthrough's `holeCards` field
   (`["4h","Jh"]` etc.) matches the `rank+suit` shape `cardImageSrc`
   expects, and `tests/card-images.test.ts` confirms every deck card has
   a matching SVG file.
2. **Pass.** Confirmed live: board array is `[]` at preflop, length 3 at
   flop, 4 at turn, 5 at river; `renderCards(hand.board)` maps every
   entry to an `<img>` (same helper as AC1, same guarantee).
3. **Pass.** Computer seats default to `renderHiddenCards(2)`
   (`src/main.ts`, `renderHand`'s seat map) whenever `hand.result` is
   absent or the seat isn't in `hand.result.revealed` — includes the
   fold-out case, where no seat is ever revealed.
4. **Pass.** Live showdown's `revealed` array (2 real cards per
   contending seat) is looked up by `seat.index` and rendered via
   `renderCards(revealedEntry.cards)`; the non-contending (folded) seats
   correctly stayed on `renderHiddenCards(2)` since they're absent from
   `revealed`.
5. **Pass, by inspection/geometry (see above) — not independently
   observed in a browser this run.**
6. **Pass, for the live hand view** (hole cards, board, seat cards,
   showdown reveal — every spot that used to be `X.join(" ")` text is
   now `renderCards`/`renderHiddenCards`, confirmed by the regression
   guards in `tests/card-images.test.ts`). Hand history's past-hand list
   still shows text card codes — carried over from Implementation
   Notes' reading that AC6 only applies where an image now appears, and
   history isn't in this feature's scope. Flagging for `/accept` to
   confirm that reading is what the user wants, rather than deciding it
   silently.

**Outcome: all 6 acceptance criteria pass** (AC5 by inspection, AC6's
in-scope surfaces confirmed, hand-history text flagged as a scope call
for `/accept` to bless). No bounce-back needed.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
