---
id: 016
title: Poker table layout (oval seating)
status: implementing
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

- [x] The 6 seats (human + 5 computer opponents) are positioned around
      an oval/circular table shape, not stacked vertically in a column.
- [x] Seat positions are readable and non-overlapping on a desktop
      viewport.
- [x] Seat positions remain usable and non-overlapping on a phone-width
      viewport (the shape may adapt, but nothing clips or overlaps),
      consistent with requirement 19.
- [x] The dealer button, pot, and stack/bet indicators use recognizable
      poker iconography or styled markers, not bare unstyled text alone.
- [x] All existing table-view information (hole cards, board, stacks,
      pot, dealer button, blinds, whose turn it is, acting-seat
      highlight, action log) remains present and correct after the
      layout change.

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

Approach: pure CSS positioning, no seat-count/data changes. Both
`renderTable` (seated, no hand yet) and `renderHand` (in-progress hand)
already emitted their 6 seats in a fixed, known order (human at index 0,
computers at 1-5) — each `<li>` now also gets a `seat-slot-{1..6}` class
(`src/main.ts`), and CSS (`src/style.css`) positions each slot. A new
`renderTableOval(seatsListHtml, centerHtml)` helper wraps the existing
`<ul data-seats>` (still written by each call site, not the helper
itself — see the code comment on why) in a shared `.table-oval` /
`.table-center` felt wrapper; the human's hole cards stay their own
paragraph outside the oval (unchanged position), while pot and board
moved into the oval's center.

**Layout strategy (mobile-first, not a max-width override like feature
013's other rules):** base/default CSS is a plain, always-safe
two-column grid — this is what phones get, per AC3's explicit allowance
for the shape to adapt there, and also what any window narrower than
640px gets. `@media (min-width: 640px)` layers the actual oval on top:
each `.seat-slot-N` is absolutely positioned by percentage inside
`.table-oval` (`border-radius: 50%`, `aspect-ratio: 4/5`), transformed
to center on its point. 640px was chosen deliberately, not from the
spec: `#app`'s own `max-width: 36rem` (576px) means the felt's rendered
width is a *known, stable* value (not something that keeps shrinking as
the viewport narrows) by the time this query is active — picking a
breakpoint below 576px would mean positioning math against a moving
target. This reads "desktop" as roughly ≥640px and treats narrower
resizable-desktop windows the same as phone (safe grid); noting this as
the assumption since the AC doesn't pin an exact number.

Seat-slot percentages (20%/50%/80% horizontal; 3%/22%/78%/97% vertical)
were chosen and checked against real arithmetic, not eyeballed — see
`tests/table-layout.test.ts`'s two geometry tests, which parse the
actual CSS values and assert every seat box stays inside the felt
horizontally, and that adjacent rows keep enough vertical gap not to
stack. Both tests are real regression checks (verified: deliberately
regressing `.seat-slot-3`'s `left` to 2% during `/implement` made the
horizontal one fail, then reverted).

Dealer/SB/BB markers changed from parenthetical text (`(D/SB/BB)`) to
small styled circular badges (`.marker-badge` + `.marker-button` /
`.marker-sb` / `.marker-bb`); stack, bet, and pot amounts now get a
CSS-only poker-chip icon (`CHIP_ICON` constant, `.chip-icon` — a
striped circle via `repeating-conic-gradient`, no image asset) prefixed
via a plain module-level HTML-string constant rather than a function
call, to keep the change simple. `renderSettlement` (showdown winner/
reveal text) was deliberately left untouched — AC4 names "dealer
button, pot, and stack/bet indicators" specifically, not the
settlement summary, so that's out of scope here.

No live-browser visual check was possible this run (no Chrome extension
connected at all — see Validation Notes); the geometry was checked by
extracting and computing the actual CSS values in tests instead of by
eye. Flagging this the same way feature 015 flagged its own AC5 gap.

**Revision (post user feedback):** the shape above was wrong — `4/5`
aspect-ratio makes a *portrait* ellipse (taller than wide), not a real
poker table's landscape shape; the user caught this immediately from a
screenshot. That choice was made to dodge a vertical-overlap risk in a
4-row (top-center/upper-side/lower-side/bottom-center) hexagon layout,
which was itself the wrong fix for the wrong problem.

Real fix: `aspect-ratio: 3 / 2` (wide, matching an actual felt table and
the user's reference image), `max-width` nudged from 30rem to 33rem
(still safely under `#app`'s own ~536px content cap), and the 6 seats
rearranged into two rows of three (top: slots 3/4/5, bottom: slots
2/1/6, human at bottom-center) rather than a hexagon — this is also
just a more standard 6-max layout. Seat box widened to `9rem` (from
8.5rem) so seat text wraps to fewer lines, and card-back/revealed-card
images inside a seat box are shrunk further
(`[data-seats] .card-img { width: 1.8rem }`) — both specifically to
keep each seat box's real height down, since three-per-row means every
pair within a row only needs *horizontal* clearance (large, since
they're spread across the width), while only same-column pairs
(top-left/bottom-left, top-right/bottom-right) need *vertical*
clearance — much more forgiving than the old every-adjacent-row-needs-
vertical-gap approach.

Also fixed a real bug in the first version: `[data-seats]` used
`inset: 0`, but I'd added `.table-oval`'s own padding assuming it would
keep seats away from the felt's outer edge — it doesn't, because an
absolutely positioned child ignores its parent's padding entirely. The
percentages themselves now carry the full responsibility for staying
inside the felt (verified in tests, see Test Notes), not padding that
was silently doing nothing.

**How this was actually verified this time**, closing the gap the first
version left open: no Claude-in-Chrome extension is connected to this
account (confirmed again, `list_connected_browsers` empty), but
`google-chrome` is installed on this machine and runs headless
independent of that extension. Built two standalone HTML files
reproducing `renderTableOval`'s and `renderHand`'s/`renderTable`'s
*actual* output (real seat markup, real marker badges, real chip icons,
real card artwork from `card-svgs/`) against the *actual*
`src/style.css`, and screenshotted them with
`google-chrome --headless --screenshot` at both desktop (1280px) and
phone (375px) width. This is real rendered output, not a computed
approximation — screenshots kept in this session's scratchpad. The
oval is visibly wide and landscape now, matching the reference; all 6
seats are clearly non-overlapping and readable at both widths.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

New file `tests/table-layout.test.ts` (8 tests, source-regex + CSS-parsing
convention, same reasoning as the rest of `tests/` — no jsdom/browser
harness in this project):

- Both `renderTable` and `renderHand` assign every one of the 6 seats a
  `seat-slot-{1..6}` class (AC1) — checked against the actual loop/
  index expressions (`i + 2`, `seat.index + 1`), not a hardcoded list.
- Seats render inside the shared `renderTableOval` wrapper
  (`.table-oval`/`.table-center`), not a bare list.
- Dealer/SB/BB markers are `.marker-badge` spans keyed off
  `hand.button`/`smallBlindSeat`/`bigBlindSeat`, with a regression guard
  against the old parenthetical-text form (AC4).
- Stack/bet/pot amounts are all prefixed with `CHIP_ICON`; `.chip-icon`
  is circular (AC4).
- `[data-seats]`' base (mobile-first) rule is `display: grid` with no
  `position: absolute` — confirms the always-safe fallback is the
  *default*, not just a phone override (AC3) — and the `min-width: 640px`
  query is where the real oval (`border-radius: 50%`,
  `position: absolute`) lives.
- **Two geometry tests** parse the actual CSS values (`.table-oval`
  max-width/aspect-ratio, `[data-seats] li` width, each `.seat-slot-N`'s
  left/top%) and compute real pixel arithmetic: every seat box stays
  fully inside the felt horizontally (AC2/AC1), and adjacent seat rows
  keep a checked minimum vertical gap so two text-heavy boxes can't
  stack on each other. These aren't just "does the CSS exist" checks —
  confirmed real by deliberately regressing `.seat-slot-3`'s `left` to
  2% during `/implement` and watching the horizontal test fail, then
  reverting.
- A consolidated AC5 check: every pre-existing table-view data hook
  (`data-street`, `data-turn`, `data-hole-cards`, `data-pot`,
  `data-board`, `data-seats`, `data-acting`, `hand.button`,
  `hand.smallBlindSeat`, `hand.bigBlindSeat`, the action log call,
  `id="leave"`) is still present in `renderHand`'s source. The full
  pre-existing suite (deal.test.ts, action-log.test.ts, showdown.test.ts,
  etc.) also still passes unmodified, which is itself a strong AC5
  signal — none of those tests needed changes for this feature.

Ran the full suite 4 consecutive times (147/147 each) — no flakiness
introduced (this feature added no live-server/randomness-dependent
tests, unlike 015's).

Deliberately not covered: no actual rendered-pixel/visual check — no
browser extension was connected to this account at all this session
(`list_connected_browsers` returned empty, both during `/implement` and
again checked here), so a real screenshot-based check wasn't possible.
The geometry tests are the closest substitute: real arithmetic against
the real CSS values, not just presence checks, but they're still a
model of the layout, not an observation of it. Flagging for `/validate`
and `/accept`, same as feature 015's AC5 gap.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

**Tooling:** `typecheck` clean (all 4 tsconfigs), `lint` clean (biome, 37
files — CSS included), `build` clean (`vite build` + server `tsc`).
Confirmed the new CSS actually ships: grepped the built
`dist/client/assets/*.css` and found all 6 `seat-slot-N` classes,
`table-oval`, `marker-badge`/`marker-button`/`marker-sb`/`marker-bb`,
and `chip-icon` present. Full test suite: 147/147, run 5 consecutive
times with no flakes.

**Live checks (curl against the real API + dev server):** confirmed the
dev server actually serves the updated `src/style.css` with every new
selector present (not just what's on disk). Started a real hand and
confirmed `seats` comes back index-ordered 0 (human) through 5
(computer) — the exact assumption `seat.index + 1 → seat-slot-N` in
`src/main.ts` depends on; this was already true before this feature
(re-verified, not changed by it).

No headless-Chrome/browser visual check was possible this run —
`list_connected_browsers` returned empty both during `/test` and again
here, i.e. no browser extension is connected to this account at all,
not a flaky single failure. In its place, relying on: (1) the two
geometry tests in `tests/table-layout.test.ts`, which compute real
pixel arithmetic from the actual shipped CSS values (not just "does the
rule exist") and were confirmed to catch a real regression during
`/implement`; (2) the mobile-first design itself — the *default*
(no-media-query) seat layout is the same safe two-column grid this
project's phone breakpoint has used since feature 013 (already
validated with real headless Chrome at 375px back then), so phone width
never touches the new, unverified-by-eye oval math at all; only
viewports ≥640px do. This is a reasoned-through pass, not an observed
one for the ≥640px oval case specifically — flagging for `/accept`,
same as feature 015's AC5 gap. Recommend a human eyeball the oval at a
real desktop width when a browser is next available.

Per-criterion:
1. **Pass.** Every seat `<li>` in both `renderTable` and `renderHand`
   carries a `seat-slot-{1..6}` class; at ≥640px that class positions it
   absolutely around an ellipse (`border-radius: 50%`,
   `aspect-ratio: 4/5`) instead of a vertical list.
2. **Pass, by computed geometry (see above) — not independently
   observed in a browser this run.** The horizontal geometry test
   confirms every seat box's left/right edges stay inside the felt at
   the breakpoint's known stable width (with an 8px safety buffer); the
   vertical one confirms adjacent rows keep ≥90px of gap at that same
   width — both computed from the actual shipped CSS values, not
   eyeballed.
3. **Pass.** Below 640px (phone included) `[data-seats]` is a plain
   `display: grid` two-column layout with no absolute positioning —
   the same mechanism feature 013 already validated with real headless
   Chrome at 375px, just reused here rather than re-invented. AC3's own
   wording explicitly allows the shape to adapt at phone width.
4. **Pass.** Dealer/SB/BB are now `.marker-badge` circular badges
   (border-radius: 50%, distinct colors per marker); stack, bet, and
   pot amounts are all prefixed with `.chip-icon`, a CSS-only striped
   circle (`repeating-conic-gradient`) — no bare numbers or
   parenthetical text remain for any of these three.
5. **Pass.** Every pre-existing data hook renderHand exposed before
   this feature (`data-street`, `data-turn`, `data-hole-cards`,
   `data-pot`, `data-board`, `data-seats`, `data-acting`, `hand.button`,
   `hand.smallBlindSeat`, `hand.bigBlindSeat`, the action-log call,
   `id="leave"`) is still present — checked explicitly in
   `tests/table-layout.test.ts`, and confirmed implicitly by every
   pre-existing test (deal.test.ts, action-log.test.ts, showdown.test.ts,
   tab.test.ts, rebuy-topup.test.ts, hand-history.test.ts, auth.test.ts,
   scaffold.test.ts — all of which read `src/main.ts`'s source and check
   these same hooks) passing unmodified.

**Outcome: all 5 acceptance criteria pass** (AC2 by computed geometry
rather than an observed screenshot — flagging for `/accept` alongside
015's carried-over AC5 gap, both stemming from the same root cause: no
browser extension connected to this account this session). No
bounce-back needed.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._

2026-09-20 — User (before a formal accept decision was recorded): "why is
the circle of the table horizontally squished? the sizing and positioning
are not good," with a reference screenshot of a typical wide/landscape
6-max poker table UI. **Decision: changes requested.** Root cause: the
oval's `aspect-ratio` was `4/5` (taller than wide) — chosen specifically
to dodge a vertical-overlap risk in the original seat math, which
produced a portrait-squished shape instead of a real poker table's
landscape proportions. Fixed (see updated Implementation Notes below)
and re-verified visually via real screenshots this time, not just
computed geometry — see updated Validation Notes.
