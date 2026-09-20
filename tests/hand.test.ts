import assert from "node:assert/strict";
import { test } from "node:test";
import { createDeck, shuffle } from "../server/poker/deck.js";
import {
  SEAT_COUNT,
  dealFlop,
  dealHand,
  dealRiver,
  dealTurn,
} from "../server/poker/hand.js";
import type { HandState } from "../server/poker/hand.js";

function sequentialRng(): () => number {
  // Deterministic, non-constant sequence in [0, 1) so shuffle() actually
  // permutes instead of leaving everything in place.
  let i = 0;
  const values = [0.9, 0.1, 0.5, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6, 0.05];
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

test("createDeck returns exactly the 52 standard cards, no duplicates", () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck).size, 52);
  for (const rank of ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"]) {
    for (const suit of ["s", "h", "d", "c"]) {
      assert.ok(deck.includes(`${rank}${suit}` as (typeof deck)[number]));
    }
  }
});

test("shuffle reorders without changing the multiset of cards", () => {
  const deck = createDeck();
  const shuffled = shuffle(deck, sequentialRng());
  assert.equal(shuffled.length, 52);
  assert.deepEqual([...shuffled].sort(), [...deck].sort());
  assert.notDeepEqual(shuffled, deck);
  // Original is not mutated.
  assert.deepEqual(deck, createDeck());
});

function allDealtCards(hand: HandState): string[] {
  return [...hand.holeCards.flat(), ...hand.board];
}

test("a dealt hand (through the river) uses a shuffled 52-card deck with no duplicates among hole cards and board", () => {
  const hand = dealRiver(dealTurn(dealFlop(dealHand(0, sequentialRng()))));
  const dealt = allDealtCards(hand);
  assert.equal(dealt.length, 6 * 2 + 5);
  assert.equal(new Set(dealt).size, dealt.length);
  for (const card of dealt) {
    assert.ok(createDeck().includes(card as ReturnType<typeof createDeck>[number]));
  }
});

test("each of the six seats is dealt exactly two private hole cards", () => {
  const hand = dealHand(0, sequentialRng());
  assert.equal(hand.holeCards.length, SEAT_COUNT);
  for (const cards of hand.holeCards) {
    assert.equal(cards.length, 2);
  }
});

test("the dealer button is assigned and visible; blinds are posted from the correct seats for every button position", () => {
  for (let button = 0; button < SEAT_COUNT; button++) {
    const hand = dealHand(button, sequentialRng());
    assert.equal(hand.button, button);
    const expectedSb = (button + 1) % SEAT_COUNT;
    const expectedBb = (button + 2) % SEAT_COUNT;
    assert.equal(hand.smallBlindSeat, expectedSb);
    assert.equal(hand.bigBlindSeat, expectedBb);
    assert.deepEqual(hand.blindsPosted, [
      { seat: expectedSb, amount: 1 },
      { seat: expectedBb, amount: 2 },
    ]);
  }
});

test("an invalid button seat is rejected", () => {
  assert.throws(() => dealHand(-1, sequentialRng()));
  assert.throws(() => dealHand(SEAT_COUNT, sequentialRng()));
  assert.throws(() => dealHand(1.5, sequentialRng()));
});

test("community cards come in the standard sequence: flop (3), then turn (1), then river (1)", () => {
  const dealt = dealHand(0, sequentialRng());
  assert.equal(dealt.street, "preflop");
  assert.deepEqual(dealt.board, []);

  const flopped = dealFlop(dealt);
  assert.equal(flopped.street, "flop");
  assert.equal(flopped.board.length, 3);

  const turned = dealTurn(flopped);
  assert.equal(turned.street, "turn");
  assert.equal(turned.board.length, 4);
  assert.deepEqual(turned.board.slice(0, 3), flopped.board);

  const rivered = dealRiver(turned);
  assert.equal(rivered.street, "river");
  assert.equal(rivered.board.length, 5);
  assert.deepEqual(rivered.board.slice(0, 4), turned.board);
});

test("the engine refuses to deal the turn before the flop or the river before the turn", () => {
  const dealt = dealHand(0, sequentialRng());
  assert.throws(() => dealTurn(dealt));
  assert.throws(() => dealRiver(dealt));

  const flopped = dealFlop(dealt);
  assert.throws(() => dealRiver(flopped));
  assert.throws(() => dealFlop(flopped));
});
