# Changelog

> Appended by `/accept` every time a feature is accepted by the user.

<!-- Format:
## 2026-08-31 — Feature title (features/001-slug.md)
What shipped, in user-facing terms.
-->

## 2026-09-23 — Full-width layout (features/019-full-width-layout.md)

The app no longer squeezes every view into a narrow centered column.
Guest forms, the dashboard, and the table now use the full available
viewport width, and the poker table itself scales up to fill most of
that width at common desktop sizes instead of staying capped at a
small fixed size. Layout-only change — nothing about how the game
works or looks otherwise changed.

## 2026-09-20 — Responsive app-shell dashboard (features/018-dashboard-shell.md)

Once logged in, you now land on a proper dashboard instead of an ad hoc
page: a top menu bar (your username, a Settings placeholder, and Log
out) is visible everywhere, and before you sit at a table the default
view shows your hand history right away — no click needed — alongside
a "Sit down" button and a new "Add chips" button that tops up your tab
without first having to bust at a table. This closes out iteration 5:
the full UI-overhaul slice (card images, oval table layout, login/
register split, and this dashboard shell) is now built.

## 2026-09-20 — Standard login/register flow (features/017-login-register-flow.md)

Logged-out visitors now see a login form by default, not login and
register stacked together on one page. A visible link switches to a
separate registration view, and back again. A successful registration
signs you straight in, same as before. No change to how passwords are
hashed, how errors are shown, or how sessions work.

## 2026-09-20 — Poker table layout (oval seating) (features/016-table-layout.md)

The table now looks like an actual poker table: at desktop width, the
human and five computer seats sit arranged around a wide green oval
instead of stacked in a plain list, with a dealer button/small-blind/
big-blind shown as small colored badges and stacks, bets, and the pot
marked with a simple poker-chip icon instead of bare numbers. At phone
width the seats fall back to a compact two-column grid (still no felt
losses — same information, just not curved) since six labeled seats
don't fit around a true ellipse on a small screen. Purely visual — no
change to betting, hand logic, or what information is shown.

## 2026-09-20 — Card images for hole and community cards (features/015-card-images.md)

Hole cards and the board now show real card artwork instead of text
notation ("As", "Kh"). Your own hole cards and the community cards
(flop/turn/river) render as images as they're dealt. Opponents' hole
cards show a card-back image while hidden, and swap to their real cards
at showdown — never before. Sized to stay legible and undistorted on
both desktop and phone.

## 2026-09-20 — Phone-usable layout (features/013-responsive-layout.md)

Register, log in, the table, and hand history all work on a phone
browser now, not just desktop: no horizontal scrolling, and every
button and input is a comfortable size to tap. Desktop looks the same
as before.

## 2026-09-20 — Hand history (features/012-hand-history.md)

Every settled hand is now saved to your account: time, blinds, your
hole cards, the board as dealt, the result (won/lost/split), and the
chip change. Open "View hand history" from the table page to see your
own past hands — nobody else's, and there's no export or leaderboard.

## 2026-09-20 — Readable table view (features/008-table-view.md)

The table now shows whose turn it is, highlights the acting seat, and
lists recent actions (fold/check/call/bet/raise/all-in with amounts,
tagged by street) alongside the existing hole cards, board, stacks,
pot, button, and blinds. Opponents' hole cards stay hidden until
showdown, as before.

## 2026-09-20 — Rebuy and play-money top-up (features/011-rebuy-topup.md)

If you bust at the table, you can now rebuy 200 chips straight from
your tab, or top up your tab by 1,000 play-money chips first if it
can't cover a rebuy. Leaving the table remains available at any time
too. Still play money only — no payment form, no currency, no cash-out.
This closes out iteration 3: the full original product vision (deal,
bet, showdown, real computer opponents, continuous play, and recovering
from a bust) is now built.

## 2026-09-20 — Next hand and 6-handed table (features/010-next-hand.md)

After a hand settles, the next one deals itself automatically a few
seconds later — no more clicking "deal" every time. The dealer button
rotates one seat clockwise each hand. Computer opponents that bust are
replaced with a fresh 200-chip stack so the table always stays six
seats. If you run out of chips, you can't be dealt into another hand
until you top up (coming soon) or leave the table.

## 2026-09-20 — Computer opponents (features/009-ai-opponents.md)

The five computer seats now play with a real strategy based on hand
strength, position, and pot odds, instead of always checking or
calling. They fold weak hands, call reasonable ones, and bet or raise
strong ones — a single recreational difficulty, no external service or
solver involved. This closes out iteration 2's slice: the app now
supports a full played-out hand of No-Limit Hold'em against opponents
that actually react to their cards.

## 2026-09-19 — Showdown, pots, and hand ranking (features/007-showdown-pots.md)

A hand now plays all the way through: dealing, betting on every street,
and settling. If everyone folds, the last player wins the pot without
showing their cards. Otherwise a real showdown compares standard poker
hand rankings (high card through royal flush), ties split evenly, and
side pots are built correctly when players are all-in for different
amounts. Your running tab in SQLite updates immediately when a hand
settles, reflecting what you won or lost — not just when you leave the
table. The app shows the result and lets you deal the next hand.

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
