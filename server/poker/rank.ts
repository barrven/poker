import type { Card } from "./deck.js";

export const HAND_CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
} as const;

export type HandRank = { category: number; tiebreakers: number[] };

const RANK_ORDER = "23456789TJQKA";

function rankValue(card: Card): number {
  return RANK_ORDER.indexOf(card[0] as string) + 2;
}

function suitOf(card: Card): string {
  return card[1] as string;
}

function combinations<T>(items: T[], k: number): T[][] {
  const results: T[][] = [];
  const chosen: T[] = [];
  function go(start: number): void {
    if (chosen.length === k) {
      results.push([...chosen]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      chosen.push(items[i]);
      go(i + 1);
      chosen.pop();
    }
  }
  go(0);
  return results;
}

function evaluate5(cards: Card[]): HandRank {
  const ranks = cards.map(rankValue).sort((a, b) => b - a);
  const suits = cards.map(suitOf);
  const isFlush = suits.every((s) => s === suits[0]);

  const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => b - a);
  let straightHigh: number | undefined;
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) {
      straightHigh = uniqueRanks[0];
    } else if (
      uniqueRanks[0] === 14 &&
      uniqueRanks[1] === 5 &&
      uniqueRanks[2] === 4 &&
      uniqueRanks[3] === 3 &&
      uniqueRanks[4] === 2
    ) {
      straightHigh = 5; // the wheel: A-2-3-4-5 plays as a 5-high straight
    }
  }

  const counts = new Map<number, number>();
  for (const r of ranks) {
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return b[0] - a[0];
  });

  if (straightHigh !== undefined && isFlush) {
    return { category: HAND_CATEGORY.STRAIGHT_FLUSH, tiebreakers: [straightHigh] };
  }
  if (groups[0][1] === 4) {
    return { category: HAND_CATEGORY.QUADS, tiebreakers: [groups[0][0], groups[1][0]] };
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return {
      category: HAND_CATEGORY.FULL_HOUSE,
      tiebreakers: [groups[0][0], groups[1][0]],
    };
  }
  if (isFlush) {
    return { category: HAND_CATEGORY.FLUSH, tiebreakers: ranks };
  }
  if (straightHigh !== undefined) {
    return { category: HAND_CATEGORY.STRAIGHT, tiebreakers: [straightHigh] };
  }
  if (groups[0][1] === 3) {
    const kickers = groups
      .slice(1)
      .map((g) => g[0])
      .sort((a, b) => b - a);
    return { category: HAND_CATEGORY.TRIPS, tiebreakers: [groups[0][0], ...kickers] };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairRanks = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    return {
      category: HAND_CATEGORY.TWO_PAIR,
      tiebreakers: [...pairRanks, groups[2][0]],
    };
  }
  if (groups[0][1] === 2) {
    const kickers = groups
      .slice(1)
      .map((g) => g[0])
      .sort((a, b) => b - a);
    return { category: HAND_CATEGORY.PAIR, tiebreakers: [groups[0][0], ...kickers] };
  }
  return { category: HAND_CATEGORY.HIGH_CARD, tiebreakers: ranks };
}

export function compareHandRank(a: HandRank, b: HandRank): number {
  if (a.category !== b.category) {
    return a.category - b.category;
  }
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const diff = (a.tiebreakers[i] ?? 0) - (b.tiebreakers[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

const CATEGORY_NAMES = [
  "High Card",
  "Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
];

export function categoryName(category: number): string {
  return CATEGORY_NAMES[category] ?? "Unknown";
}

export function evaluateBestHand(cards: Card[]): HandRank {
  if (cards.length < 5) {
    throw new Error("need at least 5 cards to evaluate a hand");
  }
  const combos = combinations(cards, 5);
  let best = evaluate5(combos[0]);
  for (const combo of combos.slice(1)) {
    const rank = evaluate5(combo);
    if (compareHandRank(rank, best) > 0) {
      best = rank;
    }
  }
  return best;
}
