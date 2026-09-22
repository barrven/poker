# Dev Loop State

This file is the single source of truth for where the project is in the
lifecycle. Every stage command reads it first and updates it last.

- **Outer iteration:** 6
- **Phase:** validate
- **Active feature:** 019-full-width-layout
- **Last updated:** 2026-09-22

## Phases

`spec -> features -> [implement -> test -> validate -> accept]* -> retro -> (back to spec)`

The inner loop (`implement`…`accept`) only ships the **current slice**:
features whose `iteration` equals **Outer iteration**. Other features stay
`deferred` until a later `/features`. `/retro` runs when that slice is done,
or mid-slice when `/accept` chooses "retro now"; it does not wait for the
whole backlog.

Valid values for **Phase**: `spec`, `features`, `implement`, `test`, `validate`,
`accept`, `retro`.

## History

<!-- Append a one-line entry here every time the phase changes, oldest last is fine, newest-first preferred. -->
- 2026-09-22 — tested 019-full-width-layout (3 new tests in tests/full-width-layout.test.ts checking #app has no max-width and .table-oval's viewport-relative sizing/cap; fixed 2 now-stale table-layout.test.ts geometry-check tests that read the old fixed max-width; 167/167 total, 4 stable runs, lint/typecheck clean); phase set to `validate`
- 2026-09-22 — implemented 019-full-width-layout (removed #app's max-width entirely, .table-oval now scales with viewport via `width: min(92vw, 80rem)` instead of a fixed 33rem cap; verified visually via headless-Chrome screenshots at 1440/1280/375px against a live seated/in-hand game, no horizontal scroll introduced); phase set to `test`
- 2026-09-22 — scheduled iteration 6 slice (019-full-width-layout, 020-inhand-viewport-fit — decomposing spec requirements 29-32); active 019-full-width-layout; phase set to `implement`
- 2026-09-22 — spec revised: second UI refinement pass requested after seeing iteration 5's shipped UI — no-scroll in-hand viewport, larger cards, player's own hole cards at the bottom near their seat, and removing the app's max-width column entirely. Added requirements 29-32; phase remains `features`
- 2026-09-20 — retro (iteration 5): full UI-overhaul slice (015-018) shipped, closing spec requirements 20-28; no spec changes needed (the table-chrome Open Question now reads as answered but user chose not to edit the spec text); more to build; outer iteration bumped to 6; phase set to `features`
- 2026-09-20 — accepted 018-dashboard-shell (slice complete → retro); active feature cleared; phase set to `retro`
- 2026-09-20 — validated 018-dashboard-shell (pass: typecheck/lint/build clean, 164/164 tests x5 runs, live curl walkthrough of the full register/topup/sit/leave/logout cycle, real headless-Chrome screenshots at desktop+phone+narrow widths; all 7 acceptance criteria checked); phase set to `accept`. Last item in current slice — nothing else at `backlog` for iteration 5.
- 2026-09-20 — tested 018-dashboard-shell (11 new tests in tests/dashboard-shell.test.ts, 164/164 total, 4 stable runs); phase set to `validate`
- 2026-09-20 — implemented 018-dashboard-shell (top menu bar with profile/settings-placeholder/logout, dashboard default view with sit/add-chips/hand-history, verified visually with headless-Chrome mockups + live curl checks); phase set to `test`
- 2026-09-20 — accepted 017-login-register-flow (accept and continue); active 018-dashboard-shell (last item in current slice); phase set to `implement`
- 2026-09-20 — validated 017-login-register-flow (pass: typecheck/lint/build clean, 153/153 tests x5 runs, live curl walkthrough of register/logout/login cycle, real headless-Chrome screenshots of both views; all 5 acceptance criteria checked); phase set to `accept`
- 2026-09-20 — tested 017-login-register-flow (6 new tests in tests/login-register-flow.test.ts, 153/153 total, 4 stable runs); phase set to `validate`
- 2026-09-20 — implemented 017-login-register-flow (guest view gained authView login/register sub-state, toggle links, failures keep the user on the same form; verified visually via headless-Chrome mockups and live curl against the real API); phase set to `test`
- 2026-09-20 — accepted 016-table-layout (accept and continue, after one changes-requested round fixing the oval's proportions); active 017-login-register-flow; phase set to `implement`
- 2026-09-20 — re-validated 016-table-layout (pass: typecheck/lint/build clean, 147/147 tests x3 runs, real headless-Chrome screenshots at desktop+phone width against the actual markup/CSS confirmed the wide oval, non-overlapping seats, badges, and chip icons; all 5 acceptance criteria checked and visually confirmed); phase set to `accept`
- 2026-09-20 — retested 016-table-layout (geometry tests rewritten to a real pairwise AABB overlap check across all 15 seat pairs, 147/147 total, 3 stable runs); phase set to `validate`
- 2026-09-20 — changes requested on 016-table-layout (oval was portrait-squished, not landscape like a real table — user caught it from a screenshot with a reference image); fixed aspect-ratio to 3/2, rearranged to 2 rows of 3 seats, verified this time with real headless-Chrome screenshots against the actual CSS/markup; phase set to `implement`
- 2026-09-20 — validated 016-table-layout (pass: typecheck/lint/build clean, 147/147 tests x5 runs, built CSS confirmed to ship all new selectors, live seat-index-order check; all 5 acceptance criteria checked; AC2 by computed geometry — no browser extension connected this run); phase set to `accept`
- 2026-09-20 — tested 016-table-layout (8 new tests in tests/table-layout.test.ts, incl. 2 real geometry checks parsing CSS values, 147/147 total, 4 stable runs); phase set to `validate`
- 2026-09-20 — implemented 016-table-layout (oval seat layout via CSS seat-slot classes, mobile-first grid fallback below 640px, dealer/blind marker badges, chip icons for stack/bet/pot); phase set to `test`
- 2026-09-20 — accepted 015-card-images (accept and continue; hand-history plain-text cards and the AC5 inspection-only check acknowledged); active 016-table-layout; phase set to `implement`
- 2026-09-20 — validated 015-card-images (pass: typecheck/lint/build clean, 139/139 tests x5 runs, live curl walkthrough of preflop->river board growth + showdown reveal, all 6 acceptance criteria checked; AC5 by inspection — no browser extension connected this run; hand history's plain-text cards flagged as a scope call for `/accept`); phase set to `accept`
- 2026-09-20 — tested 015-card-images (9 new tests in tests/card-images.test.ts, 139/139 total, 4 stable runs); phase set to `validate`
- 2026-09-20 — implemented 015-card-images (vite publicDir serves card-svgs/ at root; hole/board/revealed cards render as `<img>`, hidden opponent hole cards show card-backs until showdown); phase set to `test`
- 2026-09-20 — scheduled iteration 5 slice (015-card-images, 016-table-layout, 017-login-register-flow, 018-dashboard-shell — the full UI-overhaul requirement set from the spec revision); active 015-card-images; phase set to `implement`
- 2026-09-20 — spec revised post play-test: functionality confirmed fine, UI needs a full overhaul; added requirements 20-28 (standard login/register flow, responsive app-shell with top menu bar, poker iconography, hand history as default logged-in view, visible chip top-up, real card images from `card-svgs/`, table view with seats around an oval table); phase set to `features`
- 2026-09-20 — retro (iteration 4): all 19 core requirements shipped, backlog empty, no spec changes needed; user chose to play-test and pause rather than start new scope; outer iteration bumped to 5; phase stays `retro` (v1 complete for now)
- 2026-09-20 — accepted 013-responsive-layout; iteration 4 slice complete (008, 012, 013 all done); phase set to `retro`
- 2026-09-20 — validated 013-responsive-layout (pass: typecheck/lint/build clean, 130/130 tests x7 runs, headless-Chrome walkthrough at 375px + 1440px desktop, all 4 acceptance criteria checked); phase set to `accept`
- 2026-09-20 — tested 013-responsive-layout (5 new tests in tests/responsive-layout.test.ts, 130/130 total, 4 stable runs); phase set to `validate`
- 2026-09-20 — implemented 013-responsive-layout (box-sizing reset, 44px touch targets, phone padding media query, verified via headless Chrome at 375px); phase set to `test`
- 2026-09-20 — accepted 012-hand-history (accept and continue); active 013-responsive-layout; phase set to `implement`
- 2026-09-20 — validated 012-hand-history (pass: typecheck/lint/build clean, 20 consecutive clean test runs after one isolated real-randomness flake, live curl walkthrough of won/lost/split + privacy + restart persistence, all 6 acceptance criteria checked); phase set to `accept`
- 2026-09-20 — tested 012-hand-history (7 new tests in tests/hand-history.test.ts, 125/125 total, 4 stable runs); phase set to `validate`
- 2026-09-20 — implemented 012-hand-history (hand_history SQLite table, /api/history, history toggle view); phase set to `test`
- 2026-09-20 — accepted 008-table-view (accept and continue); active 012-hand-history; phase set to `implement`
- 2026-09-20 — validated 008-table-view (pass: typecheck/lint/build/118 tests clean, live curl walkthrough of action log + turn indicator, all 7 acceptance criteria checked); phase set to `accept`
- 2026-09-20 — tested 008-table-view (3 new tests in tests/action-log.test.ts, 118/118 total, 4 stable runs); phase set to `validate`
- 2026-09-20 — implemented 008-table-view (action log, turn indicator, acting-seat highlight, structural CSS); phase set to `test`
- 2026-09-20 — scheduled iteration 4 slice (008, 012, 013 — the entire remaining backlog); active 008-table-view; phase set to `implement`
- 2026-09-20 — retro (iteration 3): no spec changes needed; more to build; outer iteration bumped to 4; phase set to `features` (spec unchanged, so skipping straight past `/spec`)
- 2026-09-20 — accepted 011-rebuy-topup; slice (010, 011) complete; phase set to `retro`
- 2026-09-20 — validated 011-rebuy-topup (pass); phase set to `accept`
- 2026-09-20 — implemented + tested 011-rebuy-topup (rebuy/top-up, fixed a latent 009-era test bug, 115/115 tests); phase set to `validate`
- 2026-09-20 — accepted 010-next-hand; active 011-rebuy-topup; phase set to `implement`
- 2026-09-20 — validated 010-next-hand (pass); phase set to `accept`
- 2026-09-20 — implemented + tested 010-next-hand (button rotation, felted guard, busted-computer replacement, auto-deal UI, 109/109 tests); phase set to `validate`
- 2026-09-20 — scheduled iteration 3 slice (010, 011); deferred 008/012/013; active 010-next-hand; phase set to `implement`
- 2026-09-20 — spec confirmed for iteration 3 (revisions already applied by retro, no further change); phase set to `features`
- 2026-09-20 — retro (iteration 2): spec revised (ESLint wording fixed, AI-strength open question updated); more to build; outer iteration bumped to 3; phase set to `spec`
- 2026-09-20 — accepted 009-ai-opponents; slice (014, 005-007, 009) complete; phase set to `retro`
- 2026-09-19 — validated 009-ai-opponents (pass); phase set to `accept`
- 2026-09-19 — implemented + tested 009-ai-opponents (real hand-strength/position AI, found+fixed 4 real engine bugs via stress testing, 105/105 tests); phase set to `validate`
- 2026-09-19 — accepted 007-showdown-pots; active 009-ai-opponents; phase set to `implement`
- 2026-09-19 — validated 007-showdown-pots (pass); phase set to `accept`
- 2026-09-19 — implemented + tested 007-showdown-pots (hand ranking, side pots, full street/showdown orchestration, tab sync, settlement UI, 94/94 tests); phase set to `validate`
- 2026-09-19 — accepted 006-betting; active 007-showdown-pots; phase set to `implement`
- 2026-09-19 — validated 006-betting (pass); phase set to `accept`
- 2026-09-19 — implemented + tested 006-betting (betting engine, placeholder computer strategy, action UI, 27 new tests, 74/74 total); phase set to `validate`
- 2026-09-19 — accepted 005-deal-hand; active 006-betting; phase set to `implement`
- 2026-09-19 — re-validated 005-deal-hand after UI fix (pass); phase set to `accept`
- 2026-09-19 — tested 005-deal-hand's UI fix (3 new tests, 47/47 total); phase set to `validate`
- 2026-09-19 — re-implemented 005-deal-hand per accept feedback (added a real Deal-hand UI trigger + hand view); phase set to `test`
- 2026-09-19 — validated 005-deal-hand (pass); phase set to `accept`
- 2026-09-19 — tested 005-deal-hand (14 new tests, 44/44 total); phase set to `validate`
- 2026-09-19 — implemented 005-deal-hand (deck/hand engine, table.ts 6-seat model, /api/hand/start + /api/hand); phase set to `test`
- 2026-09-19 — accepted 014-lint-setup (ESLint->Biome deviation acknowledged, spec wording fix deferred to next retro); active 005-deal-hand; phase set to `implement`
- 2026-09-19 — validated 014-lint-setup (pass, flagged ESLint->Biome deviation for /accept); phase set to `accept`
- 2026-09-19 — tested 014-lint-setup; phase set to `validate`
- 2026-09-19 — implemented 014-lint-setup (Biome, not ESLint — TS7 incompatibility, see feature notes); phase set to `test`
- 2026-09-19 — scheduled iteration 2 slice (014, 005-007, 009); active 014-lint-setup; phase set to `implement`
- 2026-09-19 — spec confirmed for iteration 2 (lint requirement already applied by retro, no further revision); phase set to `features`
- 2026-09-19 — retro (iteration 1): spec revised (add lint requirement); more to build; outer iteration bumped to 2; phase set to `spec`
- 2026-09-19 — accepted 004-sit-table; slice (001-004) complete; phase set to `retro`
- 2026-09-19 — validated 004-sit-table; phase set to `accept`
- 2026-09-19 — tested 004-sit-table; phase set to `validate`
- 2026-09-19 — implemented 004-sit-table; phase set to `test`
- 2026-09-19 — accepted 003-running-tab; active 004-sit-table; phase set to `implement`
- 2026-09-14 — validated 003-running-tab; phase set to `accept`
- 2026-09-14 — tested 003-running-tab; phase set to `validate`
- 2026-09-14 — implemented 003-running-tab; phase set to `test`
- 2026-09-14 — accepted 002-auth; active 003-running-tab; phase set to `implement`
- 2026-09-12 — validated 002-auth; phase set to `accept`
- 2026-09-12 — tested 002-auth; phase set to `validate`
- 2026-09-12 — implemented 002-auth; phase set to `test`
- 2026-09-12 — accepted 001-app-scaffold; active 002-auth; phase set to `implement`
- 2026-09-12 — validated 001-app-scaffold; phase set to `accept`
- 2026-09-12 — tested 001-app-scaffold; phase set to `validate`
- 2026-09-12 — implemented 001-app-scaffold; phase set to `test`
- 2026-09-12 — scheduled iteration 1 slice (001–004); active 001-app-scaffold; phase set to `implement`
- 2026-09-12 — spec revised: Node HTTP API + local SQLite; phase remains `features`
- 2026-09-12 — spec revised: login, SQLite tab + history; phase remains `features`
- 2026-09-12 — first product spec written (6-max NLHE vs computer); phase set to `features`
- 2026-08-31 — scaffold created, phase set to `spec`
