---
id: 005
title: Deal a Hold'em hand
status: testing
priority: high
iteration: 2
---

## Description

Once seated, a hand can start: a shuffled 52-card deck, a dealer button,
small and big blinds posted, two hole cards each, then flop/turn/river
in the standard sequence. No betting logic required beyond posting
blinds.

## Acceptance Criteria

- [x] Each hand uses a standard 52-card deck that is shuffled before
      the deal. No duplicate cards appear among hole cards and board
      in the same hand.
- [x] A dealer button is assigned and visible. Small blind (1) and big
      blind (2) are posted automatically from the correct seats and
      deducted from those stacks before hole cards are dealt.
- [x] Each of the six seats is dealt two private hole cards.
- [x] Community cards come in the Hold'em sequence: flop (three), then
      turn (one), then river (one). Streets can be advanced by a test
      harness or by later betting completing a round; the engine must
      not deal the turn before the flop or the river before the turn.
- [x] The human's hole cards are available to the human client; other
      seats' hole cards are not.

## Implementation Notes

New `server/poker/deck.ts`: a standard 52-card deck (`Card = \`${Rank}${Suit}\``,
e.g. `"As"`, `"Td"`) and a Fisher-Yates `shuffle()` taking an injectable
`rng: () => number` (defaults to `Math.random`) so tests can drive it
deterministically. No cryptographic-randomness requirement in the spec for
play-money shuffling, so no new dependency.

New `server/poker/hand.ts`: pure `HandState` + `dealHand(buttonSeat, rng)`
(shuffles a fresh deck, computes `smallBlindSeat`/`bigBlindSeat` as
`button+1`/`button+2` mod 6, deals two hole cards per seat one at a time
starting left of the button, records `blindsPosted`, sets `street:
"preflop"`), plus `dealFlop`/`dealTurn`/`dealRiver`, each asserting the
hand is on the right prior street before advancing (throws otherwise —
this is what AC4's "must not deal the turn before the flop" enforces).
Dealing from one shuffled 52-card array without replacement makes
duplicate cards structurally impossible (AC1).

`server/table.ts` (extended, not just reused): the seating model from 004
tracked only the human's stack (`Map<userId, stack>`); blinds need to come
from *whichever* seat is SB/BB, which can be a computer seat, so seating
became `Map<userId, TableSession>` with `seats: Seat[6]` (index 0 = human,
1-5 = computer, each with its own `stack`) and `hand: HandState | null`.
`tableStateFor()` (used by `/api/me` et al.) still returns just
`{ seated, stack }` reading `seats[0].stack` — 003/004's external API
contract is unchanged; confirmed by the full existing test suite (30/30)
still passing untouched. `startHand()` deals via `dealHand()` then debits
`blindsPosted` from the relevant seats' stacks (AC2's "deducted from those
stacks"); `currentHand()`/`startHand()` both return a `HandView` that
includes only `holeCards[0]` (the human's own two cards) — other seats'
hole cards never leave `server/table.ts` (AC5).

New endpoints in `server/app.ts`: `POST /api/hand/start` (401 logged out,
400 not seated, 409 hand already in progress, 200 + `HandView` on
success) and `GET /api/hand` (401 logged out, 400 not seated / no hand,
200 + `HandView`).

Assumptions (recorded per `/implement`'s instructions — genuine judgment
calls, not blockers):
- **Human is always seat 0**, computers 1-5. The spec only requires
  "one human seat and five computer opponents" (requirement 3), not a
  particular index; fixing it keeps `HandState`/`TableSession` simple and
  deterministic. `dealHand()` itself is exercised directly at every
  `buttonSeat` 0-5 in tests, independent of this.
- **The button starts at seat 0** for a player's first hand. There is no
  rotation history yet — button rotation across hands is feature 010
  (deferred) — so any fixed, documented starting seat is reasonable.
- **No street-advancement API in this feature.** AC4 explicitly allows
  "a test harness" to advance streets for now (real advancement comes
  from betting completing a round, feature 006); `dealFlop`/`dealTurn`/
  `dealRiver` are tested by calling them directly against a `HandState`,
  not through an HTTP endpoint. There is deliberately no
  `POST /api/hand/advance` yet.
- ~~**No frontend card UI.**~~ **Reversed after `/accept` feedback** — see
  below. Originally read AC5 ("available to the human client") as an
  API-level contract only, reasoning that feature 008 ("Readable table
  view") owns the actual table display. The user tried the running app
  and correctly pushed back: with no trigger anywhere in the UI, the
  feature wasn't actually usable, only reachable via curl/tests. Added
  a minimal, real UI path — not 008's full polish, just enough to use
  what this feature built:
  - Seated + no hand in progress: a "Deal hand" button (`#deal`,
    `data-deal`) above the existing seat list from 004.
  - `POST /api/hand/start` on click; on success, switches to a hand view
    showing street, board (`—` preflop), the human's own two hole cards,
    and all six seats with their current stacks and a `D`/`SB`/`BB`
    marker next to the button/blind seats, plus "Leave table".
  - Hand state is fetched (`GET /api/hand`) and restored on login/initial
    load when seated, same "reload doesn't reset state" spirit as 004's
    tab persistence (the server already keeps it in memory per session,
    so this was a small addition, not new server work).
  - Still deliberately *not* attempting 008's job: no felt/board-position
    layout, no card-face graphics (cards render as plain text like
    `"As"`), no action controls (006 hasn't shipped betting yet). This is
    the minimum for "the feature is actually usable," not the finished
    table view.

Files: `server/poker/deck.ts` (new), `server/poker/hand.ts` (new),
`server/table.ts` (rewritten), `server/app.ts` (+2 routes, +3 imports),
`src/main.ts` (deal button + hand view, added after `/accept` feedback).

## Test Notes

`tests/hand.test.ts` (new, 8 tests — pure engine, no server) and
`tests/deal.test.ts` (new, 9 tests — API integration + the deal-button/
hand-view UI added after `/accept` feedback) via `npm test` (47/47
total: 8 hand + 9 deal + 4 lint + 8 table + 7 auth + 5 tab + 6 scaffold).

The 3 UI tests added alongside the deal-button fix (source-text checks,
same convention as `tests/table.test.ts`'s `renderTable` checks — no
jsdom in this project): `renderDealControl()`'s output has `id="deal"`,
`data-deal`, and "Deal hand" text, and something in the file wires a
click handler on `#deal` to `/api/hand/start`; `renderHand()`'s output
has `data-street`/`data-board`/`data-hole-cards`/`data-seats`, uses
`hand.button`/`hand.smallBlindSeat`/`hand.bigBlindSeat` (the marker
logic) and a "Leave table" (`id="leave"`) control; the guest markup
(scoped the same way `tests/table.test.ts` scopes its sit-control check)
never contains a deal control, mirroring the existing logged-out
guarantee for the sit button.

`tests/hand.test.ts` covered directly against `server/poker/deck.ts` and
`server/poker/hand.ts` (a deterministic non-constant injected `rng`, no
`Math.random`, so results are reproducible): `createDeck()` is exactly
the 52 standard cards, no duplicates; `shuffle()` reorders without
changing the multiset and doesn't mutate its input; a full hand dealt
through the river (`dealHand` → `dealFlop` → `dealTurn` → `dealRiver`)
has 17 total dealt cards (12 hole + 5 board), all unique, all from the
standard deck; all six seats get exactly two hole cards; the dealer
button and small/big blind seats are correct for **every** button
position 0-5 (not just the default); an invalid button seat (`-1`, `6`,
`1.5`) throws; streets come in order (flop=3 cards, turn=+1, river=+1,
each street's board is a prefix of the next); `dealTurn`/`dealRiver`
throw when called out of sequence (river before turn, turn before flop,
flop dealt twice).

`tests/deal.test.ts` covered via the real HTTP API (register → sit →
`/api/hand/start`): the response shape has exactly `{button,
smallBlindSeat, bigBlindSeat, street, board, holeCards, seats}` — no key
anywhere carries another seat's hole cards, and `holeCards` is exactly
the human's 2 cards; for a first-hand default (button=seat 0=human), SB
is seat 1 and BB is seat 2 and their stacks reflect the deduction (199,
198) while the human's stack (200, not SB/BB) and the other three
computer seats (200 each) are untouched; `GET /api/hand` returns the
identical view after starting; starting twice → 409 without dealing a
second hand; not seated → 400 for both start and view; logged out → 401
for both; seated but no hand started yet → `GET /api/hand` 400 "no hand
in progress".

Deliberately not: `POST /api/hand/advance`-style street progression via
the API (doesn't exist yet — AC4 explicitly permits a test harness for
that, which `tests/hand.test.ts` already exercises directly against the
engine; live advancement is wired in feature 006 when betting completes
a round); the *full* readable table view — felt/board layout, card-face
graphics, action controls (still feature 008/006's scope; only a minimal
text-based deal button and hand view were added, per Implementation
Notes); button rotation across multiple hands (feature 010, deferred —
only the fixed first-hand default is tested here).

Found during this stage: `tests/deal.test.ts` initially imported
`fileURLToPath` unused (copy-paste from `tests/table.test.ts`'s header,
where it's needed for reading `src/main.ts`; this file never reads a
source file). `npm run lint` (now enforced, feature 014) caught it;
removed the unused import rather than suppressing the rule.

## Validation Notes

2026-09-19 — pass. Ready for `/accept`.

Project checks:
- lint: pass (`npm run lint`)
- typecheck: pass
- build: pass
- tests: pass (`npm test` — 44/44: 8 hand + 6 deal + 4 lint + 8 table +
  7 auth + 5 tab + 6 scaffold)

Validated a running instance of this tree on an isolated port (`:3011`)
against a scratch SQLite file, with users `val005alice` / `val005bob`.

1. **Pass (mechanically, `tests/hand.test.ts`).** A full hand dealt
   through the river uses one shuffled 52-card deck; all 17 dealt cards
   (12 hole + 5 board) are unique members of the standard deck. Not
   re-verified live (would require repeated hands, which a single
   session's "one hand in progress" rule doesn't allow — engine-level
   coverage across many button positions in the test suite is the right
   level for this).
2. **Pass.** Live: `POST /api/hand/start` → `button: 0`, `smallBlindSeat:
   1`, `bigBlindSeat: 2`; seat 1's stack 200→199, seat 2's 200→198,
   confirming blinds were deducted from the correct seats' stacks before
   hole cards were dealt (the response already includes the dealt hole
   cards alongside the post-blind stacks — the deduction happens inside
   the same `startHand()` call, and `tests/hand.test.ts` confirms
   `blindsPosted` is computed correctly for all 6 possible button seats,
   not just the live default of 0).
3. **Pass.** Live response's `seats` array has 6 entries; `holeCards.length
   === 2` for the human. All-six-seats-get-two-cards is asserted directly
   in `tests/hand.test.ts` against `HandState.holeCards`.
4. **Pass (mechanically).** `tests/hand.test.ts` deals flop→turn→river in
   order (3, then +1, then +1 cards, each a prefix of the next) and
   confirms `dealTurn`/`dealRiver` throw when called out of sequence.
   Not reachable live yet by design — no advance-street endpoint exists
   in this feature (AC4 explicitly permits a test harness here; live
   advancement is feature 006).
5. **Pass.** Live `POST /api/hand/start` and `GET /api/hand` responses
   have exactly `{button, smallBlindSeat, bigBlindSeat, street, board,
   holeCards, seats}` — `holeCards` is the human's own 2 cards; no key
   anywhere carries another seat's hole cards. Also checked: double-start
   → 409 without re-dealing; unseated → 400; logged-out → 401;
   `GET /api/hand` before any hand started → 400 "no hand in progress".

No new deviations beyond the ones already recorded in Implementation
Notes (fixed human seat 0, fixed first-hand button 0, no street-advance
API yet, no frontend card UI yet) — all deliberate and documented there.

## Acceptance Log

2026-09-19 — Changes requested. User tried the running app and said:
"i don't see a way to start the deal. there is no button." Correct catch:
Implementation Notes' assumption that all frontend UI could wait for
feature 008 (readable table view) was too aggressive — 005 needs *some*
reachable way to trigger `POST /api/hand/start` from the actual app, not
just via the API/tests, for the feature to be genuinely usable. Sending
back to `/implement` for a minimal UI addition (see Implementation Notes
for the planned scope — a "Deal hand" trigger and a minimal in-progress
display, not the full table view 008 owns).
