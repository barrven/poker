---
id: 020
title: In-hand view fits the viewport, larger cards, hole cards at the bottom
status: validating
priority: high
iteration: 6
---

## Description
While a hand is in progress, the whole table view (board, pot, seats,
the player's own hole cards, action controls) fits within the viewport
with no scrolling needed at common desktop and phone screen sizes.
Card images are noticeably larger than the original feature 015/016
sizing (the user had already started bumping `.card-img` toward this
in a direct commit). The player's own two hole cards render at the
bottom of the table view, near the human's own seat, instead of as a
separate "Your cards:" line elsewhere on the page. This is spec
requirements 29, 30, and 31 — grouped into one feature since all three
describe the same visual outcome (a compact, larger-card, no-scroll
table view with the hero's cards at the bottom) and are too
interdependent to ship safely in isolation: bigger cards alone would
make the no-scroll bar harder to hit, and moving the hero's cards only
makes sense once their final size is settled.

Depends on feature 019 (full-width layout) landing first, since how
much viewport width the table gets changes this feature's fit math.

## Acceptance Criteria
_Testable, checkable statements. `/validate` and `/accept` check against these directly._

- [ ] At common desktop viewport sizes (e.g. 1280x800, 1440x900) and
      common phone sizes (e.g. 375x812), the entire in-hand view
      (street/turn indicator, board, pot, all seats, the player's own
      hole cards, and the action controls for the current decision)
      fits within the viewport height with no vertical scrolling
      needed.
- [ ] Card images (hole cards and board) are visibly larger than the
      pre-existing `2.6rem` width — at least matching the `5rem` width
      the user's own direct commit already moved toward.
- [ ] The player's own two hole cards render at the bottom of the
      table view, at/near the human's own seat position — not as a
      separate line elsewhere on the page.
- [ ] The action controls (fold/check/call/bet/raise/all-in, and the
      raise amount input) remain fully visible and usable within the
      no-scroll viewport.
- [ ] All other existing hand-view functionality (opponent hidden/
      revealed cards, turn indicator, acting-seat highlight, action
      log, dealer/blind markers, chip icons, settlement/showdown
      display) remains correct and present — this is a layout change,
      not a rules or data change.

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

Files touched: `src/main.ts`, `src/style.css` (plus test files — see Test
Notes).

**Hero cards (AC3):** `renderHand`'s per-seat map now renders the human's
`hand.holeCards` inline inside their own `<li>` (wrapped `<span
class="hero-cards">`), replacing the old standalone `<p data-hole-cards>`
line above the oval entirely. The human seat already sits at the bottom
of the oval on desktop (feature 016's seat-slot-1) and first in the grid
on mobile, so this reads as "at the bottom of the table view, near the
human's seat" on both layouts without needing separate positioning logic.

**No-scroll fit (AC1) — approach:** iterated against real
headless-Chrome renders (via a scratch puppeteer-core script driving
`/usr/bin/google-chrome`; the Claude in Chrome extension wasn't
connected this session), not calculated blind. Three levers, in order of
how much they mattered:
1. Cut fixed chrome around the table: `[data-hand] > p` and
   `[data-action-log] p` margin resets (grid doesn't collapse child
   margins, so default `<p>` margins were silently stacking on top of
   the grid's own `gap`), smaller paddings/margins throughout, the
   recent-actions log capped to a few lines with internal
   `overflow-y: auto` instead of growing the page, and the hand-history
   toggle hidden outright while a hand is active (`view.hand` truthy) —
   it isn't part of AC1's or AC4's required in-hand content.
2. Made `.table-oval`'s width formula (feature 019: `min(92vw, 80rem)`)
   viewport-*height*-relative too: `min(92vw, 80rem, 48vh)`. The third
   term expresses a height budget as an equivalent width via the fixed
   3:2 aspect-ratio (height = width·⅔, so capping height at Hvh means
   capping width at 1.5H vh).
3. Once the felt could be genuinely small at short-but-wide viewports
   (e.g. 384px wide at 1280x800, well under feature 016/019's old fixed
   9rem seat-box width), the fixed-size seat boxes started overflowing
   the shrunken felt. Scaled seat box `width`/`font-size`/`padding`, the
   opponent card-back size, the hero card size, and the board card size
   all to matching `clamp(min, Nvh, max)` values tied to the same
   viewport-height budget, so boxes and felt shrink together instead of
   the felt shrinking out from under fixed-size boxes. Every clamp's
   `max` is unchanged from its pre-020 fixed value, so a tall-enough
   viewport still renders exactly as feature 016/019 did.
4. A long username could wrap the topbar to 2-3 lines at phone width,
   eating unpredictable amounts of the same budget — `[data-profile]`
   now truncates to one line with ellipsis, a small robustness fix this
   feature's fit now actually depends on.

**AC2 vs. AC1 tradeoff (assumption, flagged for `/validate`/`/accept`):**
hero and board cards can't always hit the full 5rem the spec commit
moved toward *and* fit the no-scroll budget at 1280x800 — a 5rem-wide
hero card forces a seat box tall enough that either the felt needs to
be ~400px tall (blowing the height budget) or the box overlaps its
neighbors. Resolved with `clamp(min, Nvh, 5rem)`: reaches the full 5rem
whenever there's enough vertical room (tall viewports, or the felt not
being vh-bound at all) but backs off at the tightest common target
(1280x800) to keep the layout non-overlapping. Verified this still
clears AC2's actual floor (>2.6rem, "visibly larger") at both 1280x800
and 1440x900 — see `tests/inhand-viewport-fit.test.ts`. Board cards get
the same treatment for the same reason (up to 5 of them share the
felt's center gutter).

**AC1 scope assumption:** the settlement/showdown display (after a hand
ends) is *not* held to the no-scroll bar — the Description scopes AC1 to
"while a hand is in progress," and settlement's own revealed-hands list
can run to 6 entries, which no reasonable card size fits in one
viewport. Confirmed by inspection this state isn't visually broken, just
scrollable (existing default `.card-img` sizing, unaffected by this
feature's oval-scoped clamps).

**Known rough edge:** at the exact 1280x800 target with a full 5-card
board showing, the board row sits close enough to the hero seat box
below it that the dealer-button badge can be partly behind the board
cards' edge in some hands. Cosmetic only (nothing is unreadable or
non-functional); flagged for `/validate` rather than chased further
given the layout otherwise fits and reads correctly.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

New file `tests/inhand-viewport-fit.test.ts` (6 tests), static
markup/CSS checks tied to this feature's ACs:
- **AC3** — `data-hole-cards`/"Your cards:" are gone outright (not just
  relocated), and the replacement renders inside the human seat's own
  branch of the per-seat map, keyed off real `hand.holeCards` data.
- **AC2** — evaluates the hero-card and board-card `clamp()` formulas at
  both 1280x800 and 1440x900 (the two named desktop sizes) and asserts
  each clears the old 2.6rem floor. Doesn't assert the full 5rem bar
  everywhere — see the AC1/AC2 tradeoff recorded in Implementation
  Notes; `/validate` checks the 5rem bar itself against the actual
  numbers.
- **AC1 support** — the hand-history toggle's hide-while-`view.hand`
  condition, `[data-actions]` never being `display:none`/`hidden`/
  `overflow:hidden`, the action-log's internal-scroll cap, and the
  username truncation are each asserted directly (they're the
  structural levers AC1's fit depends on, not the fit measurement
  itself).
- **AC4** — covered by fixing (not weakening) the 4 pre-existing tests
  the implementation's markup/CSS changes broke, in
  `tests/{card-images,deal,table-layout,full-width-layout}.test.ts`:
  updated to match the new `hero-cards` markup and the width formula's
  extra `vh` term, same invariants otherwise. `table-layout.test.ts`'s
  geometry checks were reworked from a single width-only "worst case"
  (no longer meaningful once box/felt size depend on viewport height
  too) to real geometry evaluated at each of the two named target
  viewports, now also covering the human's own (differently-sized)
  seat box in the overlap check — a strictly more thorough version of
  the same non-overlap guarantee, not a weaker one.

**Deliberately not covered by static tests:** the actual no-scroll fit
(AC1's core claim) and the visual absence of overlap — CSS math alone
can't verify real rendered text-wrap height. Verified instead with real
headless-Chrome (via scratch puppeteer-core scripts, extension not
connected this session): `document.documentElement.scrollHeight ===
clientHeight` at 1280x800/1440x900/375x812, checked repeatedly (11+
runs total) across preflop, a full 5-card board at river, and randomized
usernames/bet amounts, all stable with zero overflow. Also screenshotted
each state and inspected for overlap by eye. Settlement/showdown
(explicitly out of AC1's "while a hand is in progress" scope per
Implementation Notes) was spot-checked to confirm it's merely
scrollable, not visually broken.

Full suite (175/175, the 6 new plus everything else) run 4 times, all
stable; lint/typecheck/build all clean.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
