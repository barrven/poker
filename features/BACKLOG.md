# Feature Backlog

> Regenerated/amended by `/features`. Statuses are updated by every other
> stage command as a feature moves through the inner loop. The single
> "active" feature (the one currently in flight) is always named in
> `STATE.md`, not just here.

## Iteration 6 (current slice)

| ID | Title | Status | Priority | Iteration | File |
|----|-------|--------|----------|-----------|------|
| 019 | Full-width layout (remove the max-width column) | backlog | high | 6 | [019-full-width-layout.md](019-full-width-layout.md) |
| 020 | In-hand view fits the viewport, larger cards, hole cards at the bottom | backlog | high | 6 | [020-inhand-viewport-fit.md](020-inhand-viewport-fit.md) |

<!-- 019 (drop the max-width column) is scheduled before 020 (in-hand
no-scroll layout) because 020's fit math depends on how much width the
table actually gets — building 020 against the old narrow column would
mean redoing it once 019 lands anyway. -->

## Done (prior iterations)

| ID | Title | Status | Priority | Iteration | File |
|----|-------|--------|----------|-----------|------|
| 001 | App scaffold | done | high | 1 | [001-app-scaffold.md](001-app-scaffold.md) |
| 002 | Register, log in, and log out | done | high | 1 | [002-auth.md](002-auth.md) |
| 003 | Running tab | done | high | 1 | [003-running-tab.md](003-running-tab.md) |
| 004 | Sit down and leave the table | done | high | 1 | [004-sit-table.md](004-sit-table.md) |
| 014 | Lint tooling | done | high | 2 | [014-lint-setup.md](014-lint-setup.md) |
| 005 | Deal a Hold'em hand | done | high | 2 | [005-deal-hand.md](005-deal-hand.md) |
| 006 | Betting rounds and legal actions | done | high | 2 | [006-betting.md](006-betting.md) |
| 007 | Showdown, pots, and hand ranking | done | high | 2 | [007-showdown-pots.md](007-showdown-pots.md) |
| 009 | Computer opponents | done | medium | 2 | [009-ai-opponents.md](009-ai-opponents.md) |
| 010 | Next hand and 6-handed table | done | medium | 3 | [010-next-hand.md](010-next-hand.md) |
| 011 | Rebuy and play-money top-up | done | medium | 3 | [011-rebuy-topup.md](011-rebuy-topup.md) |
| 008 | Readable table view | done | medium | 4 | [008-table-view.md](008-table-view.md) |
| 012 | Hand history | done | medium | 4 | [012-hand-history.md](012-hand-history.md) |
| 013 | Phone-usable layout | done | low | 4 | [013-responsive-layout.md](013-responsive-layout.md) |
| 015 | Card images for hole and community cards | done | high | 5 | [015-card-images.md](015-card-images.md) |
| 016 | Poker table layout (oval seating) | done | high | 5 | [016-table-layout.md](016-table-layout.md) |
| 017 | Standard login/register flow | done | medium | 5 | [017-login-register-flow.md](017-login-register-flow.md) |
| 018 | Responsive app-shell dashboard | done | medium | 5 | [018-dashboard-shell.md](018-dashboard-shell.md) |

<!--
Status values: backlog | implementing | testing | validating | accept | done | blocked | deferred
Iteration: outer-iteration number this feature is scheduled for, or `later` if deferred.
The inner loop only ships the current STATE.md Outer iteration; deferred items wait.
-->
