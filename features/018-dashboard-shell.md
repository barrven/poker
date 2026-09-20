---
id: 018
title: Responsive app-shell dashboard
status: validating
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

New file `tests/dashboard-shell.test.ts` (11 tests, source-regex + live
API, same convention as the rest of `tests/`):

- `renderTopMenu` exists with `data-topbar`, `data-profile` (showing
  the username), `id="settings"` (`disabled`), and `id="logout"`, and
  is called unconditionally from the whole signed-in render branch —
  not just one sub-state (AC1).
- Logout's handler is exactly the pre-existing `onLogout` (still calls
  `/api/logout`) — just wired to the relocated button (AC2).
- Settings is `disabled` and has no click handler anywhere in the file
  — a real placeholder, not fake interactivity.
- `renderDashboard` calls `renderSitControl` (AC4), has `id="topup"`
  (AC5), and calls `renderHistory` directly — explicitly *not*
  `renderHistoryToggle` (AC3) — while `render()`'s seated branch still
  builds `seatedHistorySection` from the toggle, confirming the
  pre-existing toggle behavior survives unchanged for the table/hand
  view.
- `loadDashboardHistory` exists, calls `fetchHandHistory`, and bails if
  the view is no longer the dashboard by the time it resolves (race
  guard); `render()` triggers it exactly when
  `!view.seated && view.history === undefined`.
- The dashboard's `#topup` reuses the exact same handler/endpoint as
  the pre-existing felted-recovery control, not a new one.
- `.card-img`-style CSS check adapted for this feature:
  `[data-topbar]`/`[data-topnav]` both use `flex-wrap: wrap` (AC6).
- Two live API tests: a fresh account can `/api/tab/topup` before ever
  sitting (AC5's "usable without first busting"), and `/api/history`
  returns `{ hands: [] }` (not an error) for a brand-new account.
- A consolidated AC7 check that `data-tab` and `renderHistory`'s own
  markup (`data-history`, `data-history-list`, `data-history-result`)
  are unchanged — backed up by every pre-existing hand-history/tab test
  (`tests/hand-history.test.ts`, `tests/tab.test.ts`,
  `tests/rebuy-topup.test.ts`) still passing unmodified.

Ran the full suite 4 consecutive times (164/164 each, stable).

Deliberately not covered: real click-driven DOM interaction (no
jsdom/browser harness) — verified instead with the headless-Chrome-
plus-real-markup technique during `/implement` (three mockups: the
dashboard alone, the same at 375px/320px phone widths, and the seated
table view with the topbar composed on top) — see Implementation
Notes. Also not covered: a dedicated test asserting the disabled
Settings button's exact visual treatment (color/opacity) — the CSS
rule exists and was confirmed visually (grayed out, clearly
non-interactive in the screenshot) but isn't asserted numerically,
consistent with how this project doesn't unit-test cosmetic CSS values
elsewhere either.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
