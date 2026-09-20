---
id: 013
title: Phone-usable layout
status: done
priority: low
iteration: 4
---

## Description

Login, tab, table (cards, stacks, action controls), and history remain
usable on a phone browser, not only on a desktop layout. Native apps
are out of scope.

## Acceptance Criteria

- [x] At a phone-sized viewport (~375px wide), register, log in, log
      out, and the tab amount are usable without horizontal scrolling
      away the primary controls.
- [x] At that viewport, hole cards, board, stacks, pot, whose turn,
      and action controls remain tappable and readable (no control
      clipped off-screen with no way to reach it).
- [x] The history view is readable at that viewport (list can scroll
      vertically).
- [x] Desktop layout still works after the phone layout exists.

## Implementation Notes

`index.html` already had a correct `width=device-width` viewport meta
tag from the scaffold (001), so phone browsers were never rendering a
zoomed-out desktop layout — the remaining gap was CSS.

Baseline check before changing anything: drove headless Chrome directly
over the DevTools Protocol (no extra npm dependency — `google-chrome
--headless=new --remote-debugging-port`, driven with a small script
using Node 22's built-in `fetch`/`WebSocket`) at a 375x812 viewport
through every state — guest forms, signed-in/not-seated, seated, a
dealt hand (scrolled to the action controls), and the history view
(scrolled to a row). `document.documentElement.scrollWidth` never
exceeded `clientWidth` in any state: `#app`'s `max-width` + relative
padding, `form`'s `display: grid`, and `[data-actions]`'s
`flex-wrap: wrap` already meant nothing forced horizontal scrolling.
So AC1/AC2/AC3 ("no horizontal scrolling", "readable", "can scroll
vertically") were already true by construction — this repo's CSS
never used fixed pixel widths wider than a phone screen.

What the baseline check *did* surface, by measuring real
`getBoundingClientRect()` sizes: every `button` and `input` rendered at
38px tall — below the ~44px minimum tap-target size (WCAG 2.5.5 /
platform HIG guidance) needed for "tappable" to be more than
accidentally true. And `[data-actions] input[type="number"]`'s
`width: 6rem` combined with its padding under default `content-box`
sizing rendered at 116px instead of 96px — harmless at 375px today,
but a real latent sizing bug (any future width+padding combination
could silently push past a narrow viewport without warning).

Changes, all in `src/style.css`:
- `*, *::before, *::after { box-sizing: border-box; }` — makes every
  declared width/height include its own padding and border, so sizing
  is predictable everywhere, not just where it happens not to overflow
  today.
- `button`/`input` both get `min-height: 44px` — real, measured
  44x44px minimum tap targets on every interactive control (fold/
  call/raise/leave/history-toggle/logout, and every text input),
  verified by re-measuring `getBoundingClientRect()` after the change.
- A `@media (max-width: 480px)` rule trims `#app`'s padding from
  `2rem 1.25rem` to `1.25rem 1rem` — desktop's generous top padding is
  pure waste on a phone screen; this claws a little of it back without
  touching desktop.
- A defensive test (`tests/responsive-layout.test.ts`) asserts no CSS
  rule anywhere pins a fixed pixel width >= 375px, so a future PR can't
  silently reintroduce a phone-breaking width.

Re-verified with the same headless-Chrome walkthrough after the
changes: still zero horizontal overflow at every state, every button
now exactly 44px tall, the number input now exactly 96px wide, and a
1440x900 desktop pass confirmed the existing centered/capped-width
desktop layout is unaffected (AC4).

The headless-Chrome driver script itself lives only in this session's
scratch directory, not the repo — this project has no committed
browser-automation dependency (no Puppeteer/Playwright in
`package.json`), and adding one just for this feature's manual
verification would be a bigger dependency footprint than the feature
warrants. See Test Notes for how this gap is covered going forward.

## Test Notes

New file `tests/responsive-layout.test.ts` (5 tests):

- The viewport meta tag exists with the correct `width=device-width,
  initial-scale=1.0` content.
- The universal `box-sizing: border-box` reset is present.
- Both the `button` and `input` rules declare `min-height: 44px`.
- The `@media (max-width: 480px)` phone-padding rule exists.
- No CSS rule anywhere declares a plain `width` (not `max-width` /
  `min-width`) of 375px or more — a regression guard against
  reintroducing a fixed width that would force horizontal scroll on a
  375px-wide phone. (Regex deliberately excludes `max-width`/
  `min-width` via a negative lookbehind, since those are exactly the
  responsive tools this feature *should* use.)

These are source-inspection tests, the same style already used
throughout this repo for frontend behavior (`tests/deal.test.ts`,
`tests/next-hand.test.ts`, `tests/action-log.test.ts`, etc.) — this
project has no committed browser-automation dependency, so no
automated test can render the page and measure real layout/overflow.

Deliberately not covered by the committed suite (covered instead by a
manual headless-Chrome walkthrough during `/implement` and `/validate`,
documented in Implementation Notes / Validation Notes):
- Actual absence of horizontal scroll at a real 375px viewport across
  every app state (guest, signed-in, seated, mid-hand, history open).
- Actual rendered tap-target sizes (`getBoundingClientRect()`) for
  every button/input.
- Actual desktop-layout screenshot confirming AC4.

This is a real, acknowledged coverage gap for *future* CSS changes
(nothing stops someone from later shrinking `min-height` back down
without a test failing) — narrower than what a Puppeteer/Playwright
suite would give, but proportionate to a project with no such
dependency today per `docs/SPEC.md`'s stated stack. The regression
guard above (no CSS rule with a fixed width >= 375px) is the practical
middle ground: it can't catch every way phone-usability could
regress, but it catches the single most common way ("someone adds a
fixed-width rule").

Full suite: 130/130, run 4 times in a row.

## Validation Notes

Checks: `npm run typecheck` clean (all 4 tsconfigs), `npm run lint`
clean (35 files, 0 warnings/errors), `npm run build` succeeded (CSS
bundle hash changed vs. pre-013: `index-DPT1LMJj.css`, confirming real
style changes shipped). `npm test`: 130/130, run 7 times total across
implement/test/validate with no flakes.

Headless-Chrome walkthrough at a real 375x812 viewport (device-metrics
override, touch emulation on), driven over the DevTools Protocol
during both `/implement` and again after the CSS changes: guest
register/login forms, signed-in-not-seated, seated-no-hand, a dealt
hand scrolled down to the action controls, and the history view
scrolled to a row — `document.documentElement.scrollWidth` never
exceeded `clientWidth` at any of those five states, before or after
the change (no width regression was ever present, so this change is
purely a tap-target/padding improvement, not an overflow fix).
Screenshots reviewed visually: no clipped or unreachable controls at
any state, text wraps naturally, the history row wraps to two lines
and stays readable. Measured real button/input sizes via
`getBoundingClientRect()`: every button and input now renders at
exactly 44px tall (was 38px before); the raise number input renders
at exactly 96px wide (was 116px before, due to a content-box sizing
mismatch the `box-sizing: border-box` reset fixed). A 1440x900 desktop
pass after the change showed the existing centered, capped-width
desktop layout unaffected — no overflow, same visual structure as
before this feature.

Acceptance criteria:
- Login/tab usable at ~375px without losing controls to horizontal
  scroll — pass. Confirmed at the guest and signed-in-not-seated
  states; the layout never needed a fix here (`#app`'s relative
  padding + `form`'s grid layout already worked), and inputs/buttons
  are now comfortably sized rather than just technically visible.
- Hole cards/board/stacks/pot/turn/actions tappable and readable, no
  control clipped off-screen — pass. Confirmed on the dealt-hand
  state; `[data-actions]`'s existing `flex-wrap: wrap` already let the
  fold/call/all-in/raise controls flow onto their own line at 375px,
  and they're now real 44px tap targets.
- History view readable, list scrolls vertically — pass. Confirmed on
  the history-open state; it's a normal in-document `<ul>`, so it
  scrolls with the page like everything else — no special scroll
  container was needed or added.
- Desktop layout still works — pass. 1440x900 screenshot after the
  change matches the pre-existing desktop layout (`#app`'s 36rem
  `max-width` still centers and caps the content; the new
  `@media (max-width: 480px)` rule doesn't touch anything above
  480px).

All criteria pass. `status: accept`, `STATE.md` phase set to `accept`.

## Acceptance Log

2026-09-20 — User selected "Accept" via AskUserQuestion after reviewing
the summary (box-sizing reset, 44px touch targets, phone-padding media
query, headless-Chrome walkthrough results at 375px and desktop, all 4
acceptance criteria passing). Decision: accepted. This was the last
feature in iteration 4's slice (008, 012, 013 all done) — `/retro` is
next.
