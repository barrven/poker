import assert from "node:assert/strict";
import { test } from "node:test";
import { awardPotWithoutShowdown, awardPotsAtShowdown } from "../server/poker/settle.js";
import type { ContributionEntry, ShowdownEntry } from "../server/poker/settle.js";
import type { Card } from "../server/poker/deck.js";

function cards(...values: string[]): Card[] {
  return values as Card[];
}

test("fold-out awards the entire pot to the sole remaining seat", () => {
  const contributions: ContributionEntry[] = [
    { seat: 0, folded: false, totalContribution: 20 },
    { seat: 1, folded: true, totalContribution: 10 },
    { seat: 2, folded: true, totalContribution: 10 },
  ];
  const results = awardPotWithoutShowdown(contributions, 0);
  assert.deepEqual(results, [{ seat: 0, delta: 40 }]);
});

test("a heads-up showdown with equal contributions awards the whole pot to the better hand", () => {
  const contributions: ContributionEntry[] = [
    { seat: 0, folded: false, totalContribution: 20 },
    { seat: 1, folded: false, totalContribution: 20 },
  ];
  const board = cards("2c", "5d", "9s", "Jh", "Kd");
  const holeCards: ShowdownEntry[] = [
    { seat: 0, holeCards: cards("Kc", "Kh") }, // trip kings
    { seat: 1, holeCards: cards("2h", "3d") }, // two pair, kings and twos
  ];
  const results = awardPotsAtShowdown(contributions, board, holeCards);
  assert.deepEqual(results, [{ seat: 0, delta: 40 }]);
});

test("a tie splits the pot evenly, with any odd chip going to the lower seat index", () => {
  const contributions: ContributionEntry[] = [
    { seat: 2, folded: false, totalContribution: 15 },
    { seat: 4, folded: false, totalContribution: 15 },
  ];
  // Board is already a made 9-high straight; both players' hole cards rank
  // below every board card, so neither improves on it — the board plays
  // identically for both, an exact tie.
  const board = cards("9c", "8d", "7s", "6h", "5c");
  const holeCards: ShowdownEntry[] = [
    { seat: 2, holeCards: cards("2h", "3d") },
    { seat: 4, holeCards: cards("2c", "3h") },
  ];
  const results = awardPotsAtShowdown(contributions, board, holeCards);
  const bySeats = new Map(results.map((r) => [r.seat, r.delta]));
  assert.equal(bySeats.get(2), 15);
  assert.equal(bySeats.get(4), 15);
});

test("a folded seat's chips still count toward the pot even though they cannot win", () => {
  const contributions: ContributionEntry[] = [
    { seat: 0, folded: false, totalContribution: 10 },
    { seat: 1, folded: true, totalContribution: 10 },
  ];
  const board = cards("2c", "5d", "9s", "Jh", "Kd");
  const holeCards: ShowdownEntry[] = [{ seat: 0, holeCards: cards("Ac", "Ad") }];
  const results = awardPotsAtShowdown(contributions, board, holeCards);
  assert.deepEqual(results, [{ seat: 0, delta: 20 }]);
});

test("side pots: a short all-in only contests a main pot sized to its own contribution", () => {
  // Seat 0 all-in for 10, seats 1 and 2 both put in 30 (contested a side
  // pot of 40 between just seats 1 and 2). Main pot: 10*3=30, contested by
  // all three. Side pot: (30-10)*2=40, contested only by 1 and 2.
  const contributions: ContributionEntry[] = [
    { seat: 0, folded: false, totalContribution: 10 },
    { seat: 1, folded: false, totalContribution: 30 },
    { seat: 2, folded: false, totalContribution: 30 },
  ];
  const board = cards("2c", "5d", "9s", "Jh", "Kd");
  const holeCards: ShowdownEntry[] = [
    { seat: 0, holeCards: cards("Ac", "Ad") }, // pair of aces — best hand overall
    { seat: 1, holeCards: cards("Qc", "Qh") }, // pair of queens — beats seat 2, loses to seat 0
    { seat: 2, holeCards: cards("2h", "3d") }, // no pair — worst of the three
  ];
  const results = awardPotsAtShowdown(contributions, board, holeCards);
  const bySeats = new Map(results.map((r) => [r.seat, r.delta]));
  assert.equal(bySeats.get(0), 30); // wins the 30-chip main pot outright
  assert.equal(bySeats.get(1), 40); // wins the 40-chip side pot (not eligible for by seat 0)
  assert.equal(bySeats.get(2) ?? 0, 0);
});

test("side pots: a folded seat's contribution still funds pots it cannot win", () => {
  const contributions: ContributionEntry[] = [
    { seat: 0, folded: false, totalContribution: 10 },
    { seat: 1, folded: true, totalContribution: 30 },
    { seat: 2, folded: false, totalContribution: 30 },
  ];
  const board = cards("2c", "5d", "9s", "Jh", "Kd");
  const holeCards: ShowdownEntry[] = [
    { seat: 0, holeCards: cards("2h", "3d") }, // worst hand, but only contests the main pot
    { seat: 2, holeCards: cards("Kc", "Kh") },
  ];
  const results = awardPotsAtShowdown(contributions, board, holeCards);
  const bySeats = new Map(results.map((r) => [r.seat, r.delta]));
  // Main pot (10*3=30) goes to seat 2 (best of the eligible, non-folded
  // seats — seat 0 has a worse hand). Side pot ((30-10)*2=40) also goes to
  // seat 2, the only non-folded contributor to it.
  assert.equal(bySeats.get(2), 70);
  assert.equal(bySeats.get(0) ?? 0, 0);
});

test("regression: a pot layer with no eligible (non-folded) contributor is refunded, not lost", () => {
  // Seat 1 commits more than anyone else still in the hand (say, a big
  // raise everyone else can't fully match), then folds on a later street.
  // The top layer — funded only by seat 1's excess above what the other
  // two (both now all-in for less) put in — has zero non-folded
  // contributors: nobody can win it, since the only seat that reached
  // that level has folded. It must be refunded to seat 1, not vanish
  // from the table (found via this feature's chip-conservation stress
  // testing with real, unscripted computer play across many hands).
  const contributions: ContributionEntry[] = [
    { seat: 0, folded: false, totalContribution: 10 },
    { seat: 1, folded: true, totalContribution: 30 },
    { seat: 2, folded: false, totalContribution: 10 },
  ];
  const board = cards("2c", "5d", "9s", "Jh", "Kd");
  const holeCards: ShowdownEntry[] = [
    { seat: 0, holeCards: cards("Ac", "Ad") }, // pair of aces — best hand
    { seat: 2, holeCards: cards("Qc", "Qh") }, // pair of queens — loses to seat 0
  ];
  const results = awardPotsAtShowdown(contributions, board, holeCards);
  const bySeats = new Map(results.map((r) => [r.seat, r.delta]));
  const totalAwarded = results.reduce((sum, r) => sum + r.delta, 0);
  // Main pot (10*3=30) goes to seat 0 (pair of aces beats seat 2's queens).
  assert.equal(bySeats.get(0), 30);
  // The uncontested top layer (30-10=20, seat 1's own excess) is refunded
  // to seat 1, not awarded to anyone else and not dropped.
  assert.equal(bySeats.get(1), 20);
  assert.equal(totalAwarded, 50); // 10+30+10 total contributed — nothing lost
});
