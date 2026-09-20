---
id: 011
title: Rebuy and play-money top-up
status: validating
priority: medium
iteration: 3
---

## Description

If the human is felted, they can rebuy 200 from the tab when the tab
covers it, or leave. If the tab cannot cover a 200 buy-in, they can add
a 1,000 play-money top-up to the tab and then rebuy or sit again. Still
not real money.

## Acceptance Criteria

- [ ] When the human's table stack is 0 and the tab is at least 200,
      they can rebuy 200: tab decreases by 200, table stack becomes
      200, and play can continue.
- [ ] When the table stack is 0 they can leave instead of rebuying;
      leave settles as in sit/leave (stack 0, tab unchanged by the
      leave itself).
- [ ] When the tab is below 200, rebuy and sit are not allowed until a
      top-up. The player can add 1,000 play-money chips to the tab.
      SQLite shows the new tab. They can then rebuy or sit.
- [ ] Top-up is play money only: no payment form, no currency, no
      cash-out.
- [ ] Tab updates for rebuy and top-up are visible after reload.

## Implementation Notes

`server/table.ts`: `rebuy(db, userId)` — gated on being seated, no hand
truly in progress (`session.hand && !session.result`, same check
`startHand()` uses), the human's table stack being exactly 0 (AC1's own
wording, not "below 200"), and the tab covering 200. On success, debits
the tab and sets the seat's stack to 200 directly (same effect as a
fresh sit, without touching `session.hand`/`button`/etc. — AC1 says
"play can continue", not "a new table"). `topUp(db, userId)` —
deliberately has **no seating or felted precondition**: AC3 describes
the felted-and-low-tab scenario but doesn't gate top-up on it, and
there's no real-money ceiling to protect against over-topping-up in a
play-money app, so it's just `tab += 1000` for the authenticated user,
usable whether seated or not.

Two new routes in `server/app.ts`: `POST /api/table/rebuy` (401 logged
out, 400 with a specific reason for each rejection —
not-seated/hand-in-progress/not-felted/insufficient-tab — 200 +
`userPayload` on success) and `POST /api/tab/topup` (401 logged out, 200
+ `userPayload`, no failure path since there's no precondition to fail).
Both return the same `{username, tab, seated, stack}` shape `/api/sit`
already returns, since that's exactly the state each action changes.

**Frontend, same pass, not deferred** (005's `/accept` lesson): the
felted branch of `renderSettlement()` (010's "rebuying is coming soon"
placeholder message) is now real — a "Rebuy 200 chips" button when
`tab >= 200`, or a "Top up 1,000 play-money chips" button when it isn't,
wired to the two new endpoints via `onRebuy()`/`onTopUp()`. A successful
rebuy clears `view.hand` (same post-state as a fresh sit, falling back
to the "Deal hand" control) since the human is genuinely back to
"seated, no hand in progress, 200 chips" — matching how `onSit()`/
`onLeave()` already handle that transition. A successful top-up only
updates `view.tab`, leaving the felted/settled view in place (still
need to rebuy explicitly next, matching AC3's "top up... They can then
rebuy or sit" — two distinct steps, not auto-chained).

AC4 ("tab updates for rebuy and top-up are visible after reload") needed
no new code — the same `/api/me` + SQLite persistence path 003
established, exercised end-to-end live and in `tests/rebuy-topup.test.ts`
via a direct `SELECT` after each action, not re-litigated with a new
mechanism.

**Bug found and fixed during this stage, not this feature's own code:**
`tests/action.test.ts`'s "folding removes the human…" test (written
during 009) still assumed 006's pre-009 always-check/call placeholder
("none of the five computers ever bets/raises/folds"), so it asserted
the hand could only ever reach a river `"showdown"`. That assumption
went stale the moment 009 shipped real AI — computers can fold to each
other too, occasionally narrowing down to one survivor (a `"fold"`
result) before the river. This surfaced as a rare, real flake (2 failures
in 15 full-suite runs) only once enough hands had been played across a
session to hit that path with real odds; fixed to accept either
settlement reason, since both are legitimate. See Test Notes for how it
was found.

Files: `server/table.ts` (`rebuy`, `topUp`), `server/app.ts` (+2
routes), `src/main.ts` (rebuy/top-up UI + handlers), `tests/action.test.ts`
(unrelated pre-existing bug fix, see above).

## Test Notes

New `tests/rebuy-topup.test.ts` (6 tests). Fixed one pre-existing latent
bug in `tests/action.test.ts` (see Implementation Notes — found by this
stage's own stress-testing rigor, not this feature's own code). `npm
test` — 115/115 total (109 from before + 6 new).

- **Rebuy success (AC1):** busts the human (all-in play, 50-hand
  budget, same probabilistic approach as 010's felted test), rebuys,
  and checks the tab drops by exactly 200, the stack becomes 200, a new
  hand can be dealt, and SQLite reflects the tab directly.
- **Rebuy rejections:** not felted (still has a stack) → 400 mentioning
  "chips on the table"; tab drained below 200 (direct SQL, simulating a
  long losing session) → 400 mentioning top-up, and the tab is
  confirmed unchanged by the rejected attempt.
- **Top-up (AC3/AC4):** adds exactly 1,000 to the tab, confirmed via
  both the response and a direct SQLite `SELECT`; deliberately exercised
  while **not seated at all**, confirming Implementation Notes' "no
  seating precondition" design choice is real, not just documented.
- **Leave while felted (AC2):** settles with the tab unchanged by the
  leave itself (adding a 0 stack), reachable without ever rebuying
  first.
- **No real-money surface (AC4's "still not real money"):** combined
  source-text scan of `src/main.ts`/`server/app.ts`/`server/table.ts`
  for deposit/withdraw/cash-out/payment-processor language — same
  pattern 003's tab test already established for the base tab feature,
  extended to cover this feature's new surface too.
- **UI wiring:** source-text check that `renderSettlement()` has real
  `#rebuy`/`#topup` controls and the file calls the right endpoints.

Verified live during `/implement` (not just via `npm test`): busted a
real account via all-in play, rebought (tab 600→400, stack 0→200),
drained the tab to 50 via direct SQL, confirmed sit and rebuy both
correctly refuse below 200, topped up (50→1050), then sat successfully.

Deliberately not covered: a UI test that actually *clicks* the rebuy/
top-up buttons in a browser (this project has no jsdom; all frontend
checks are source-text, consistent with every prior feature) —
end-to-end button wiring was instead confirmed by reading the live
production bundle isn't separately re-checked here since 010 already
established that verification step for this same render path and
nothing about *how* the buttons render changed, only their target
endpoints and labels (which are covered by the source-text check
above).

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
