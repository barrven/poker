# Product Spec

> Living document. Updated by `/spec` at the start of every outer-loop
> iteration and amended by `/retro` at the end of one.

## Vision

A browser poker table you log into and play No-Limit Texas Hold'em
against computer opponents with play-money chips. Your running tab and
game history stick around so you can sit down again later — no real
money, no lobby, just a felt, cards, and a hand to play.

## Users

Recreational poker players who want a quick Hold'em session without
finding a live game, waiting for a table, or risking money. They already
know (or want to learn by playing) the flow of a cash-game hand: blinds,
betting rounds, board, showdown. They come back to the same play-money
tab and can look at what they played.

## Core Requirements

Numbered, testable statements. These are what `/features` decomposes into a backlog.

1. A player can register with a username and password, log in, and log
   out. Passwords are stored hashed, not in plaintext. No email, OAuth,
   or social login is required. A logged-out visitor cannot sit at a
   table.
2. A logged-in player can start a new No-Limit Texas Hold'em cash table
   with no configuration beyond "sit down."
3. The table is 6-max: one human seat and five computer opponents. Empty
   seats are not offered in v1.
4. Each hand uses a standard 52-card deck, shuffled, with a rotating
   dealer button, a small blind, and a big blind posted automatically
   before cards are dealt.
5. Each account has a play-money **running tab** (bankroll) stored on
   the server. A new account starts with 1,000 chips. Sitting down buys
   in 200 chips (100 big blinds at 1/2) from the tab onto the table.
   Leaving the table, or ending the session, settles the table stack
   back to the tab.
6. Default table stakes are play-money blinds of 1/2. The human's table
   stack is the buy-in from requirement 5, not a fresh 200 every visit.
7. Each player is dealt two private hole cards. Five community cards are
   dealt in the standard Hold'em sequence: flop (three), turn (one),
   river (one), each followed by a betting round (plus a preflop round).
8. When it is the human's turn they can take any legal action: fold,
   check, call, bet, raise, or all-in. Illegal actions are not offered.
   Bet and raise amounts respect remaining stacks and minimum-raise
   rules.
9. Computer opponents act on their own turns without human input, in a
   timely way, using a playable recreational strategy (hand strength plus
   position/pot — not random and not a GTO solver).
10. Action order follows standard cash-game Hold'em: preflop starts left
    of the big blind; postflop starts left of the button. Folded and
    all-in players are skipped for further action.
11. A hand ends when only one player remains (they win the pot without
    showing) or after the river betting round (showdown). At showdown,
    the best five-card poker hand made from hole cards plus board wins,
    using standard rankings (high card through royal flush). Ties split
    the pot. Side pots are awarded correctly when players are all-in for
    different amounts.
12. The human always sees their own hole cards, the board, every seat's
    stack, the pot, the dealer button, blinds, whose turn it is, their
    running tab, and recent actions. Opponents' hole cards stay hidden
    until showdown (or are mucked on a fold-win).
13. After a hand settles, the next hand starts automatically with the
    button moved one seat clockwise, as long as the human still has
    chips on the table.
14. If the human is felted (table stack reaches 0), they can rebuy 200
    from the tab if the tab covers it, or leave the table. If the tab
    cannot cover a 200 buy-in, they can add a play-money top-up of 1,000
    chips to the tab (still not real money) and then rebuy or sit again.
    Computer opponents that bust are replaced with a new 200-chip stack
    so the table stays 6-handed.
15. Chips are play money only. There is no deposit, withdrawal, cash-out
    to currency, or conversion to anything of value.
16. User data is stored in **SQLite** on a small app server: accounts,
    password hashes, running tab, and game history. The table, cards,
    and opponent logic may still run in the browser; settled results
    are written to the server. A login session survives a page refresh.
    An in-progress hand does not have to resume after a refresh; the tab
    and history reflect the last fully settled hand.
17. After each settled hand, the app records a history row for that
    player: time, blinds, hole cards, board, result (won/lost/split),
    and chip delta. The player can open a history view of their past
    hands while logged in.
18. The running tab is updated when a hand settles (table stack change)
    and when the player sits, rebuys, tops up, or leaves. Reloading the
    app while logged in shows the current tab, not a reset stack.
19. The table and history views are playable on a desktop browser and on
    a phone browser: cards, stacks, action controls, login, and history
    remain usable without a desktop layout.

## Non-goals

Explicitly out of scope, so `/features` doesn't invent work for it.

- Real-money gambling, deposits, wallets, rakes, or anything of value
- Online multiplayer, lobbies, avatars, or chat
- Email verification, password reset, OAuth, or social login
- Tournaments, sit-and-gos, or satellite structures
- Other poker variants (Omaha, Stud, Short Deck, mixed games)
- GTO solver, range trainer, HUD, equity calculator, or study tools
- Hand-history file export or leaderboards
- Named AI personalities, table themes, or sound as a requirement
- Native mobile apps (responsive web is enough)
- Straddles, run-it-twice, bomb pots, or other home-game variants
- Resuming a half-played hand after a refresh

## Constraints

- Web SPA plus a small backend. SQLite is the datastore (accounts, tab,
  game history). No extra database server.
- Play-money only; no gambling-compliance surface.
- Must run in a current desktop or mobile browser without a plugin.
- Poker rules must be correct (pots, side pots, hand ranks, action
  order). Visual polish is secondary to a legal, readable table.
- Tech: TypeScript throughout. Vite SPA in the browser; a small Node
  HTTP API on the same machine; a local SQLite file for accounts, tab,
  and history. Tests should assert engine rules and persistence without
  a browser when possible. No extra database server and no cloud host
  required for v1.
- Passwords hashed with a standard password hash (not reversible, not
  a single SHA).
- Code is linted (ESLint, matching the TypeScript/Vite/Node stack) via an
  `npm run lint` script that passes with no errors, alongside typecheck
  and build.

## Open Questions

- How strong should the default AI feel (tight-passive vs loose-aggressive),
  and is a single difficulty enough?
- Any table chrome beyond a readable felt (felt color, chip look, card
  backs) the user cares about up front?

## Changelog of spec revisions

_Appended by `/retro` — what changed about the spec itself and why._

- 2026-08-31 — initial scaffold, spec not yet written
- 2026-09-12 — first product spec: 6-max NLHE vs computer, play-money
  SPA, no accounts, session-only table
- 2026-09-12 — add basic username/password login, SQLite-backed running
  tab and hand history; drop client-only/session-only persistence
- 2026-09-12 — lock server default: Node HTTP API + local SQLite file
  beside the Vite app
- 2026-09-19 — retro (iteration 1): add a lint requirement to Constraints
  (`npm run lint`, ESLint) — every one of features 001-004's Validation
  Notes flagged the missing lint script/config as a gap; making it an
  explicit constraint so a future slice schedules setting it up
