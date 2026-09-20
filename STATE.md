# Dev Loop State

This file is the single source of truth for where the project is in the
lifecycle. Every stage command reads it first and updates it last.

- **Outer iteration:** 4
- **Phase:** test
- **Active feature:** 013-responsive-layout
- **Last updated:** 2026-09-20

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
