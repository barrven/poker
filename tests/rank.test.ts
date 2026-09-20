import assert from "node:assert/strict";
import { test } from "node:test";
import { HAND_CATEGORY, categoryName, compareHandRank, evaluateBestHand } from "../server/poker/rank.js";
import type { Card } from "../server/poker/deck.js";

function cards(...values: string[]): Card[] {
  return values as Card[];
}

test("straight beats flush is false — flush outranks a plain straight", () => {
  const flush = evaluateBestHand(cards("2h", "5h", "9h", "Jh", "Kh", "3c", "4d"));
  const straight = evaluateBestHand(cards("5c", "6d", "7h", "8s", "9c", "2h", "3d"));
  assert.ok(compareHandRank(flush, straight) > 0);
  assert.equal(flush.category, HAND_CATEGORY.FLUSH);
  assert.equal(straight.category, HAND_CATEGORY.STRAIGHT);
});

test("full house beats trips", () => {
  const fullHouse = evaluateBestHand(cards("As", "Ah", "Ac", "Kd", "Kh", "2c", "3d"));
  const trips = evaluateBestHand(cards("As", "Ah", "Ac", "Kd", "Qh", "2c", "3d"));
  assert.equal(fullHouse.category, HAND_CATEGORY.FULL_HOUSE);
  assert.equal(trips.category, HAND_CATEGORY.TRIPS);
  assert.ok(compareHandRank(fullHouse, trips) > 0);
});

test("the wheel (A-2-3-4-5) is a valid straight, ranked as 5-high — the lowest straight", () => {
  const wheel = evaluateBestHand(cards("As", "2h", "3c", "4d", "5s", "9c", "Kd"));
  const sixHighStraight = evaluateBestHand(cards("2s", "3h", "4c", "5d", "6s", "9c", "Kd"));
  assert.equal(wheel.category, HAND_CATEGORY.STRAIGHT);
  assert.deepEqual(wheel.tiebreakers, [5]);
  assert.ok(compareHandRank(sixHighStraight, wheel) > 0);
});

test("a steel-wheel (A-2-3-4-5 suited) is a straight flush, not merely a flush", () => {
  const steelWheel = evaluateBestHand(cards("Ah", "2h", "3h", "4h", "5h", "9c", "Kd"));
  assert.equal(steelWheel.category, HAND_CATEGORY.STRAIGHT_FLUSH);
  assert.deepEqual(steelWheel.tiebreakers, [5]);
});

test("the board can play: a player's best five cards may be entirely community cards", () => {
  // Board itself is a straight (5-6-7-8-9); neither hole card improves it.
  const rank = evaluateBestHand(cards("2c", "3d", "5s", "6h", "7c", "8d", "9h"));
  assert.equal(rank.category, HAND_CATEGORY.STRAIGHT);
  assert.deepEqual(rank.tiebreakers, [9]);
});

test("two pair ties compare the kicker", () => {
  const withBetterKicker = evaluateBestHand(
    cards("Ks", "Kh", "5c", "5d", "Ad", "2c", "3h"),
  );
  const withWorseKicker = evaluateBestHand(
    cards("Ks", "Kh", "5c", "5d", "Qd", "2c", "3h"),
  );
  assert.equal(withBetterKicker.category, HAND_CATEGORY.TWO_PAIR);
  assert.ok(compareHandRank(withBetterKicker, withWorseKicker) > 0);
});

test("identical hands (e.g. the board plays for both players) tie exactly", () => {
  const board = cards("2c", "3d", "5s", "6h", "7c", "8d", "9h");
  const a = evaluateBestHand([...cards("Kc", "Qd"), ...board]);
  const b = evaluateBestHand([...cards("Jh", "4s"), ...board]);
  assert.equal(compareHandRank(a, b), 0);
});

test("category names are readable", () => {
  assert.equal(categoryName(HAND_CATEGORY.STRAIGHT_FLUSH), "Straight Flush");
  assert.equal(categoryName(HAND_CATEGORY.HIGH_CARD), "High Card");
});

test("evaluateBestHand requires at least five cards", () => {
  assert.throws(() => evaluateBestHand(cards("As", "Kd", "Qh", "Jc")));
});
