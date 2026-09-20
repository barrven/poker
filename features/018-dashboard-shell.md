---
id: 018
title: Responsive app-shell dashboard
status: testing
priority: medium
iteration: 5
---

## Description
Once logged in, the player sees a standard app-shell instead of an ad
hoc page: a top menu bar with logout, profile, and settings entries,
and a default dashboard view that shows the player's hand history with
a visible action to sit at a table and a visible action to add chips
to the tab (wiring the existing top-up flow from feature 011 into the
dashboard directly, not just as a felted-recovery path). This is spec
requirements 22, 23, 25, and 26, plus general iconography (24) applied
to this shell.

Assumption (spec doesn't define further behavior for these): "profile"
and "settings" in the top menu are minimal — profile shows the
logged-in username, settings can be a placeholder with no real options
yet — since no other requirement specifies account-profile or app-
settings functionality. Note the actual choice made in Implementation
Notes.

## Acceptance Criteria
_Testable, checkable statements. `/validate` and `/accept` check against these directly._

- [ ] Once logged in, a top menu bar is visible with logout, profile,
      and settings entries.
- [ ] Logout from the top menu bar ends the session (existing logout
      behavior, just relocated/restyled).
- [ ] The default logged-in view (before sitting at a table) shows the
      player's hand history.
- [ ] A visible "sit down" action is available from the dashboard.
- [ ] A visible "add chips" action is available from the dashboard,
      wired to the existing top-up flow, usable without first busting
      at a table.
- [ ] The app-shell layout is responsive: no horizontal scrolling and
      comfortably tappable controls at phone width, consistent with
      requirement 19.
- [ ] Existing dashboard functionality (current tab balance, hand
      history contents and correctness) is unchanged by the redesign.

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

`src/main.ts` and `src/style.css`. New `renderTopMenu(username)`
renders a `<header data-topbar>` with a brand label, a profile entry
(just the username — see the Description's own assumption), a
`disabled` Settings button (a real, visible, honest placeholder — "no
options yet" communicated by actually being non-interactive, not a
button that silently does nothing when clicked), and Log out (moved
here from its old spot at the bottom of the page, per AC2 — "relocated,
not reimplemented": same `#logout`/`onLogout` wiring as before).
Rendered unconditionally for every signed-in state (dashboard, table,
in a hand).

New `renderDashboard(tab, history)` is the default not-seated view:
existing `renderSitControl` (unchanged), a new "Add N chips" button
reusing the *existing* `/api/tab/topup` endpoint/`onTopUp` handler
(`server/table.ts`'s `topUp()` has no seated/felted precondition —
confirmed by reading it — so wiring the same `id="topup"` control into
the dashboard needed no server change), and hand history shown
outright via the existing `renderHistory`, rather than behind
`renderHistoryToggle`.

Making history "just show up" needed an actual fetch trigger, since it
used to only load lazily on toggle-click: added `loadDashboardHistory`
(mirrors `onToggleHistory`'s fetch-then-check-still-relevant pattern)
and call it from `render()` itself whenever the dashboard needs it
(`!view.seated && view.history === undefined`) — same "trigger a
side effect from inside render()" pattern the file already established
for `scheduleAutoDeal`.

The toggle mechanism itself (`renderHistoryToggle`/`onToggleHistory`/
`historyOpen`) is untouched and still used while *seated* (table/hand
view) — the feature only specifies the dashboard's default, not that
history must be toggle-free everywhere, and the table/hand view already
has enough on screen without also always showing history under it.

Dropped `<h1>Poker</h1>` and the "No-Limit Texas Hold'em..." tagline
from the signed-in view specifically (still present in the loading/
guest views) — the topbar's brand now serves that role once inside the
app-shell; a marketing tagline reads oddly once you're already using
the app. Also dropped the standalone "Logged in as X" line, since the
topbar's profile entry already shows the username.

Verified visually (headless-Chrome-plus-real-markup, this session's
established technique — see feature 016): built three mockups (the
dashboard alone, the same at 375px and 320px phone widths, and the
seated/table view with the topbar composed on top of it) against the
real `src/style.css`. All render cleanly: topbar wraps via `flex-wrap`
rather than forcing horizontal scroll, the disabled Settings button is
visibly distinct, and the topbar sits comfortably above the oval table
from feature 016 without any layout conflict.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
