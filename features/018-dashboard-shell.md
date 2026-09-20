---
id: 018
title: Responsive app-shell dashboard
status: backlog
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

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
