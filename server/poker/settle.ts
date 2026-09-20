import type { Card } from "./deck.js";
import { compareHandRank, evaluateBestHand } from "./rank.js";

export type ContributionEntry = {
  seat: number;
  folded: boolean;
  totalContribution: number;
};

export type ShowdownEntry = { seat: number; holeCards: Card[] };

export type SeatResult = { seat: number; delta: number };

export function awardPotWithoutShowdown(
  contributions: ContributionEntry[],
  winnerSeat: number,
): SeatResult[] {
  const potTotal = contributions.reduce((sum, c) => sum + c.totalContribution, 0);
  return potTotal > 0 ? [{ seat: winnerSeat, delta: potTotal }] : [];
}

// Standard side-pot algorithm: build one pot "layer" per distinct
// contribution level. Each layer is split only among the non-folded seats
// that contributed at least that level — so a seat all-in for less only
// ever contests the pot up to its own contribution.
export function awardPotsAtShowdown(
  contributions: ContributionEntry[],
  board: Card[],
  holeCards: ShowdownEntry[],
): SeatResult[] {
  const deltas = new Map<number, number>();
  const levels = Array.from(
    new Set(
      contributions.filter((c) => c.totalContribution > 0).map((c) => c.totalContribution),
    ),
  ).sort((a, b) => a - b);

  let previousLevel = 0;
  for (const level of levels) {
    const layerContributors = contributions.filter((c) => c.totalContribution >= level);
    const layerAmount = (level - previousLevel) * layerContributors.length;
    previousLevel = level;
    if (layerAmount <= 0) {
      continue;
    }
    const eligibleSeats = layerContributors.filter((c) => !c.folded).map((c) => c.seat);
    if (eligibleSeats.length === 0) {
      // Every contributor to this layer has folded (a rare sequencing: a
      // player commits more than everyone else still in, then folds on a
      // later street while the remaining players are short-stacked
      // all-ins below that level). Nobody is left to contest it, so it
      // can't be "won" — refund each contributor exactly what they put
      // into this specific layer rather than letting it vanish from the
      // table.
      const perSeatShare = layerAmount / layerContributors.length;
      for (const c of layerContributors) {
        deltas.set(c.seat, (deltas.get(c.seat) ?? 0) + perSeatShare);
      }
      continue;
    }
    const ranked = eligibleSeats.map((seat) => {
      const entry = holeCards.find((h) => h.seat === seat);
      if (!entry) {
        throw new Error(`missing hole cards for seat ${seat}`);
      }
      return { seat, rank: evaluateBestHand([...entry.holeCards, ...board]) };
    });
    let best = ranked[0].rank;
    for (const r of ranked) {
      if (compareHandRank(r.rank, best) > 0) {
        best = r.rank;
      }
    }
    const winners = ranked
      .filter((r) => compareHandRank(r.rank, best) === 0)
      .map((r) => r.seat)
      .sort((a, b) => a - b);
    const share = Math.floor(layerAmount / winners.length);
    let remainder = layerAmount - share * winners.length;
    for (const seat of winners) {
      // Odd chips (when a layer doesn't split evenly) go to the lowest
      // seat index among the winners, applied one at a time. The
      // acceptance criteria permits any consistently-applied rule here;
      // "left of the button" would need button-relative ordering, which
      // adds no fairness this app currently surfaces to the player.
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      deltas.set(seat, (deltas.get(seat) ?? 0) + share + extra);
    }
  }

  return Array.from(deltas.entries()).map(([seat, delta]) => ({ seat, delta }));
}
