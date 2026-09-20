import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyAction,
  legalActions,
  startBettingRound,
} from "../server/poker/betting.js";
import type { BettingState } from "../server/poker/betting.js";

const SEAT_COUNT = 6;
const BIG_BLIND = 2;
const SMALL_BLIND = 1;

function freshStacks(amount = 200): number[] {
  return Array.from({ length: SEAT_COUNT }, () => amount);
}

// Mirrors how server/table.ts wires the preflop round: button=0, SB=1
// (posts 1), BB=2 (posts 2), action starts left of BB (seat 3).
function preflopRound(stacks = freshStacks()): BettingState {
  return startBettingRound(
    stacks,
    [
      { seat: 1, amount: SMALL_BLIND },
      { seat: 2, amount: BIG_BLIND },
    ],
    3,
    BIG_BLIND,
    BIG_BLIND,
  );
}

test("preflop action starts left of the big blind", () => {
  const round = preflopRound();
  assert.equal(round.actingSeat, 3);
});

test("postflop action starts left of the button (engine-level — no live street-advance API yet, same as feature 005's dealFlop/Turn/River)", () => {
  // Postflop: no blinds, currentBet resets to 0, a fresh minRaiseSize (big
  // blind), action starts left of the button (seat 0 here).
  const round = startBettingRound(freshStacks(), [], 1, 0, BIG_BLIND);
  assert.equal(round.actingSeat, 1);
  assert.equal(round.currentBet, 0);
});

test("folded and all-in players are skipped for further action", () => {
  let round = preflopRound();
  // Seats 3, 4 fold; seat 5 shoves all-in.
  round = mustApply(round, 3, "fold");
  round = mustApply(round, 4, "fold");
  round = mustApply(round, 5, "all-in");
  // Next to act after the all-in seat 5 should skip the folded 3/4 and the
  // now-all-in 5, landing on the button (seat 0).
  assert.equal(round.actingSeat, 0);
  round = mustApply(round, 0, "call");
  // From seat 0, skip folded 3/4 and all-in 5 again, landing on SB (seat 1).
  assert.equal(round.actingSeat, 1);
});

test("legal actions: facing no bet offers check and bet, not call", () => {
  const round = startBettingRound(freshStacks(), [], 0, 0, BIG_BLIND);
  const actions = legalActions(round, 0);
  assert.deepEqual(new Set(actions), new Set(["fold", "check", "bet", "all-in"]));
});

test("legal actions: facing a bet with room to raise offers call and raise, not check/bet", () => {
  const round = preflopRound();
  const actions = legalActions(round, 3);
  assert.deepEqual(new Set(actions), new Set(["fold", "call", "raise", "all-in"]));
});

test("legal actions: a stack too short to make a full raise still offers call, not raise", () => {
  const stacks = freshStacks();
  stacks[3] = BIG_BLIND + 1; // can call the extra 2 (BB) and has 1 left over — not enough for a full raise
  const round = preflopRound(stacks);
  const actions = legalActions(round, 3);
  assert.ok(actions.includes("call"));
  assert.ok(!actions.includes("raise"));
  assert.ok(actions.includes("all-in"));
});

test("legal actions: it is not this seat's turn", () => {
  const round = preflopRound();
  assert.deepEqual(legalActions(round, 0), []);
});

test("bet/raise amounts respect the minimum-raise rule", () => {
  const round = startBettingRound(freshStacks(), [], 0, 0, BIG_BLIND);
  const tooSmall = applyAction(round, 0, "bet", 1);
  assert.equal(tooSmall.ok, false);
  const exact = applyAction(round, 0, "bet", BIG_BLIND);
  assert.equal(exact.ok, true);
});

test("a raise must be at least the size of the last full raise", () => {
  let round = preflopRound();
  // seat 3 raises to 6 (a raise of 4, more than the BB's 2 minimum)
  round = mustApply(round, 3, "raise", 6);
  assert.equal(round.minRaiseSize, 4);
  // seat 4 tries to raise to only 7 (a raise of just 1) — illegal
  const tooSmall = applyAction(round, 4, "raise", 7);
  assert.equal(tooSmall.ok, false);
  // seat 4 raising to 10 (a raise of 4, matching the minimum) is legal
  const ok = applyAction(round, 4, "raise", 10);
  assert.equal(ok.ok, true);
});

test("a raise or bet cannot exceed the seat's remaining stack", () => {
  const stacks = freshStacks(50);
  const round = startBettingRound(stacks, [], 0, 0, BIG_BLIND);
  const tooBig = applyAction(round, 0, "bet", 51);
  assert.equal(tooBig.ok, false);
});

test("an all-in for less than the minimum raise is still legal", () => {
  const stacks = freshStacks();
  stacks[3] = BIG_BLIND + 1; // 3 chips: can only call+1, short of a full raise
  const round = preflopRound(stacks);
  const result = applyAction(round, 3, "all-in");
  assert.equal(result.ok, true);
});

test("an illegal action is rejected and changes nothing", () => {
  const round = preflopRound();
  const before = JSON.parse(JSON.stringify(round));
  const rejected = applyAction(round, 3, "check"); // facing a bet, cannot check
  assert.equal(rejected.ok, false);
  assert.deepEqual(round, before);
});

test("acting out of turn is rejected", () => {
  const round = preflopRound();
  const rejected = applyAction(round, 0, "fold"); // seat 3 is on the clock, not seat 0
  assert.equal(rejected.ok, false);
});

test("a raise below the minimum (not all-in) is rejected and changes nothing", () => {
  const round = preflopRound();
  const before = JSON.parse(JSON.stringify(round));
  const rejected = applyAction(round, 3, "raise", 3); // raise of only 1, below the BB minimum
  assert.equal(rejected.ok, false);
  assert.deepEqual(round, before);
});

test("chips moved as bets go into the pot and each seat's contribution", () => {
  let round = preflopRound();
  assert.equal(round.pot, SMALL_BLIND + BIG_BLIND);
  round = mustApply(round, 3, "call");
  assert.equal(round.pot, SMALL_BLIND + BIG_BLIND + BIG_BLIND);
  assert.equal(round.seats[3].streetContribution, BIG_BLIND);
  assert.equal(round.seats[3].totalContribution, BIG_BLIND);
  assert.equal(round.seats[3].stack, 200 - BIG_BLIND);
});

test("a round completes when everyone has called or checked", () => {
  let round = startBettingRound(freshStacks(), [], 0, 0, BIG_BLIND);
  for (let seat = 0; seat < SEAT_COUNT - 1; seat++) {
    const result = applyAction(round, seat, "check");
    assert.equal(result.ok, true);
    if (result.ok) {
      round = result.state;
      assert.equal(result.status.complete, false);
    }
  }
  const last = applyAction(round, SEAT_COUNT - 1, "check");
  assert.equal(last.ok, true);
  if (last.ok) {
    assert.deepEqual(last.status, { complete: true, reason: "all-called" });
    assert.equal(last.state.actingSeat, null);
  }
});

test("a round completes immediately when only one player remains after folds", () => {
  let round = preflopRound();
  round = mustApply(round, 3, "fold");
  round = mustApply(round, 4, "fold");
  round = mustApply(round, 5, "fold");
  round = mustApply(round, 0, "fold");
  const result = applyAction(round, 1, "fold");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.status, { complete: true, reason: "one-remaining" });
  }
});

function mustApply(
  state: BettingState,
  seat: number,
  action: Parameters<typeof applyAction>[2],
  amount?: number,
): BettingState {
  const result = applyAction(state, seat, action, amount);
  assert.equal(result.ok, true, `expected ${action} by seat ${seat} to be legal`);
  if (!result.ok) {
    throw new Error("unreachable");
  }
  return result.state;
}
