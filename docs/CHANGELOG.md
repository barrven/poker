# Changelog

> Appended by `/accept` every time a feature is accepted by the user.

<!-- Format:
## 2026-08-31 — Feature title (features/001-slug.md)
What shipped, in user-facing terms.
-->

## 2026-09-19 — Betting rounds and legal actions (features/006-betting.md)

On your turn you can fold, check, call, bet, raise, or go all-in — only
the actions that are actually legal given stacks, the current bet, and
minimum-raise rules. Illegal actions (checking into a bet, raising below
the minimum, acting out of turn) are rejected without changing the pot
or any stack. Computer opponents act with a simple always-check/call
placeholder for now (real strategy is a later feature), so a full
betting round is playable today.

## 2026-09-19 — Deal a Hold'em hand (features/005-deal-hand.md)

A seated player can deal a hand with a "Deal hand" button: a shuffled
52-card deck, a dealer button, small/big blinds (1/2) posted
automatically from the correct seats, and two private hole cards per
seat. The app shows the street, board, the player's own hole cards, and
every seat's stack with dealer/blind markers. Community cards
(flop/turn/river) come in the standard sequence at the engine level;
live betting-driven advancement is a later feature. Only the player's
own hole cards are ever sent to their client.

## 2026-09-19 — Lint tooling (features/014-lint-setup.md)

`npm run lint` now exists and fails the build on real problems, covering
`server/`, `src/`, and `tests/`. Shipped with Biome rather than the
spec's originally-named ESLint, because `typescript-eslint` cannot run
against this project's TypeScript version (a hard upstream
incompatibility, not a config choice) — see the feature file for detail.

## 2026-09-19 — Sit down and leave the table (features/004-sit-table.md)

A logged-in player can sit at a 6-max cash table with one click. Sitting
buys in 200 chips from the tab onto the table (blinds 1/2 play-money),
joined by five computer seats so the table is never short-handed.
Leaving — or ending the session while seated — settles the table stack
back to the tab. A tab under 200 can't sit down, and a logged-out
visitor can't either. Cards and betting are not part of this feature.

## 2026-09-19 — Running tab (features/003-running-tab.md)

Every account has a play-money running tab stored in SQLite, starting
at 1,000 chips on registration. Logged-in players can see their
current tab, and it survives a page reload. Two accounts' tabs are
independent. There is no deposit, withdrawal, cash-out, or
real-currency conversion control.

## 2026-09-14 — Register, log in, and log out (features/002-auth.md)

Players can register with a username and password, log in, and log out.
The session survives a page refresh (HttpOnly cookie). Passwords are
hashed with scrypt in SQLite. Duplicate usernames and failed logins
show a visible error. Logged-out visitors cannot sit at a table. No
email, OAuth, or social login.

## 2026-09-12 — App scaffold (features/001-app-scaffold.md)

Local app shell: `npm run dev` starts a Vite page and a Node HTTP API.
The API creates `data/poker.sqlite` on first start and answers
`GET /api/health`. TypeScript on both sides; `npm run typecheck` and
`npm run build` work. No login or cards yet.
