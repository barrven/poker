---
id: 016
title: Poker table layout (oval seating)
status: testing
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

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
