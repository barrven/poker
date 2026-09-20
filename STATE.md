# Dev Loop State

This file is the single source of truth for where the project is in the
lifecycle. Every stage command reads it first and updates it last.

- **Outer iteration:** 2
- **Phase:** accept
- **Active feature:** 009-ai-opponents
- **Last updated:** 2026-09-19

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
