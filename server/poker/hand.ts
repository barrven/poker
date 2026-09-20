import type { Card } from "./deck.js";
import { createDeck, shuffle } from "./deck.js";

export const SEAT_COUNT = 6;
export const SMALL_BLIND = 1;
export const BIG_BLIND = 2;

export type Street = "preflop" | "flop" | "turn" | "river";

export type BlindPost = { seat: number; amount: number };

export type HandState = {
  button: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  holeCards: Card[][];
  board: Card[];
  street: Street;
  deck: Card[];
  blindsPosted: BlindPost[];
};

export function dealHand(
  buttonSeat: number,
  rng: () => number = Math.random,
): HandState {
  if (!Number.isInteger(buttonSeat) || buttonSeat < 0 || buttonSeat >= SEAT_COUNT) {
    throw new Error(`invalid button seat: ${buttonSeat}`);
  }
  const deck = shuffle(createDeck(), rng);
  const smallBlindSeat = (buttonSeat + 1) % SEAT_COUNT;
  const bigBlindSeat = (buttonSeat + 2) % SEAT_COUNT;

  const holeCards: Card[][] = Array.from({ length: SEAT_COUNT }, () => []);
  let cursor = 0;
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < SEAT_COUNT; i++) {
      const seat = (buttonSeat + 1 + i) % SEAT_COUNT;
      const card = deck[cursor];
      cursor += 1;
      holeCards[seat].push(card);
    }
  }

  return {
    button: buttonSeat,
    smallBlindSeat,
    bigBlindSeat,
    holeCards,
    board: [],
    street: "preflop",
    deck: deck.slice(cursor),
    blindsPosted: [
      { seat: smallBlindSeat, amount: SMALL_BLIND },
      { seat: bigBlindSeat, amount: BIG_BLIND },
    ],
  };
}

function dealNext(hand: HandState, expected: Street, count: number, next: Street): HandState {
  if (hand.street !== expected) {
    throw new Error(`cannot deal ${next} from street ${hand.street}, expected ${expected}`);
  }
  const dealt = hand.deck.slice(0, count);
  return {
    ...hand,
    board: [...hand.board, ...dealt],
    deck: hand.deck.slice(count),
    street: next,
  };
}

export function dealFlop(hand: HandState): HandState {
  return dealNext(hand, "preflop", 3, "flop");
}

export function dealTurn(hand: HandState): HandState {
  return dealNext(hand, "flop", 1, "turn");
}

export function dealRiver(hand: HandState): HandState {
  return dealNext(hand, "turn", 1, "river");
}
