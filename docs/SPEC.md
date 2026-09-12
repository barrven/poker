# Product Spec

> Living document. Updated by `/spec` at the start of every outer-loop
> iteration and amended by `/retro` at the end of one.

## Vision

A browser poker table you can sit down at immediately and play No-Limit
Texas Hold'em against computer opponents with play-money chips. No
account, no lobby, no real money — just a felt, cards, and a hand to play.

## Users

Recreational poker players who want a quick Hold'em session without
finding a live game, waiting for a table, or risking money. They already
know (or want to learn by playing) the flow of a cash-game hand: blinds,
betting rounds, board, showdown.

## Core Requirements

Numbered, testable statements. These are what `/features` decomposes into a backlog.

1. A player can open the app in a browser and start a new No-Limit Texas
   Hold'em cash table with no account, login, or configuration beyond
   "sit down."
2. The table is 6-max: one human seat and five computer opponents. Empty
   seats are not offered in v1.
3. Each hand uses a standard 52-card deck, shuffled, with a rotating
   dealer button, a small blind, and a big blind posted automatically
   before cards are dealt.
4. Default stakes are play-money blinds of 1/2 with a 200-chip starting
   stack (100 big blinds) for every seat, including the human.
5. Each player is dealt two private hole cards. Five community cards are
   dealt in the standard Hold'em sequence: flop (three), turn (one),
   river (one), each followed by a betting round (plus a preflop round).
6. When it is the human's turn they can take any legal action: fold,
   check, call, bet, raise, or all-in. Illegal actions are not offered.
   Bet and raise amounts respect remaining stacks and minimum-raise
   rules.
7. Computer opponents act on their own turns without human input, in a
   timely way, using a playable recreational strategy (hand strength plus
   position/pot — not random and not a GTO solver).
8. Action order follows standard cash-game Hold'em: preflop starts left
   of the big blind; postflop starts left of the button. Folded and
   all-in players are skipped for further action.
9. A hand ends when only one player remains (they win the pot without
   showing) or after the river betting round (showdown). At showdown,
   the best five-card poker hand made from hole cards plus board wins,
   using standard rankings (high card through royal flush). Ties split
   the pot. Side pots are awarded correctly when players are all-in for
   different amounts.
10. The human always sees their own hole cards, the board, every seat's
    stack, the pot, the dealer button, blinds, whose turn it is, and
    recent actions. Opponents' hole cards stay hidden until showdown (or
    are mucked on a fold-win).
11. After a hand settles, the next hand starts automatically with the
    button moved one seat clockwise, as long as the human still has
    chips.
12. If the human is felted (stack reaches 0), they can rebuy a fresh
    200-chip play-money stack at the same table or start a new table.
    Computer opponents that bust are replaced with a new 200-chip stack
    so the table stays 6-handed.
13. Chips are play money only. There is no deposit, withdrawal, cash-out
    to currency, or conversion to anything of value.
14. A session does not require a server: the table, cards, and opponent
    logic run in the browser. Refreshing the page starts a new table
    (no saved chips or hand history in v1).
15. The table is playable on a desktop browser and on a phone browser:
    cards, stacks, and action controls remain usable without a desktop
    layout.

## Non-goals

Explicitly out of scope, so `/features` doesn't invent work for it.

- Real-money gambling, deposits, wallets, rakes, or anything of value
- Online multiplayer, accounts, lobbies, avatars, or chat
- Tournaments, sit-and-gos, or satellite structures
- Other poker variants (Omaha, Stud, Short Deck, mixed games)
- GTO solver, range trainer, HUD, equity calculator, or study tools
- Hand-history export, stats across sessions, or leaderboards
- Named AI personalities, table themes, or sound as a requirement
- Native mobile apps (responsive web is enough)
- Straddles, run-it-twice, bomb pots, or other home-game variants

## Constraints

- Client-side web app (SPA). No backend is required for v1.
- Play-money only; no gambling-compliance surface.
- Must run in a current desktop or mobile browser without a plugin.
- Poker rules must be correct (pots, side pots, hand ranks, action
  order). Visual polish is secondary to a legal, readable table.
- Tech: TypeScript, a modern SPA (Vite), and tests that can assert
  engine rules without a browser when possible.

## Open Questions

- Should later iterations persist a chip stack or a simple win/loss
  record across page loads (local only), or stay session-only?
- How strong should the default AI feel (tight-passive vs loose-aggressive),
  and is a single difficulty enough?
- Any table chrome beyond a readable felt (felt color, chip look, card
  backs) the user cares about up front?

## Changelog of spec revisions

_Appended by `/retro` — what changed about the spec itself and why._

- 2026-08-31 — initial scaffold, spec not yet written
- 2026-09-12 — first product spec: 6-max NLHE vs computer, play-money
  SPA, no accounts, session-only table
