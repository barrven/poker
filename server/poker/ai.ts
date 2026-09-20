import type { Action } from "./betting.js";
import type { Card } from "./deck.js";
import { evaluateBestHand } from "./rank.js";

export type AiDecision = { action: Action; amount?: number };

const RANK_ORDER = "23456789TJQKA";

function rankValue(card: Card): number {
  return RANK_ORDER.indexOf(card[0] as string) + 2;
}

// No board yet: a lightweight starting-hand heuristic (high cards, pairs,
// suitedness, connectedness) — not a solver, just the same kind of
// "how good does this look" a recreational player uses preflop.
function preflopStrength(hole: Card[]): number {
  const ranks = [rankValue(hole[0]), rankValue(hole[1])].sort((a, b) => b - a);
  const [hi, lo] = ranks;
  const pair = hi === lo;
  const suited = hole[0][1] === hole[1][1];
  let score = (hi + lo) / 28; // 2..14 each, so 4..28 total
  if (pair) {
    score += 0.25 + (hi / 14) * 0.15;
  }
  if (suited) {
    score += 0.05;
  }
  const gap = hi - lo;
  if (!pair && gap <= 4) {
    score += 0.05 - gap * 0.01;
  }
  return Math.max(0, Math.min(1, score));
}

// Board exists: use the real hand evaluator (the same one showdown uses,
// feature 007) rather than a separate heuristic — the category (0 High
// Card .. 8 Straight Flush) is the dominant signal, with the top
// tiebreaker giving a small nudge within that category.
function postflopStrength(hole: Card[], board: Card[]): number {
  const rank = evaluateBestHand([...hole, ...board]);
  const base = rank.category / 8;
  const topTiebreak = rank.tiebreakers[0] ?? 2;
  const fine = ((topTiebreak - 2) / 12) * (1 / 8);
  return Math.max(0, Math.min(1, base + fine));
}

export type DecisionInput = {
  holeCards: Card[];
  board: Card[];
  legalActions: Action[];
  toCall: number;
  pot: number;
  currentBet: number;
  minRaiseSize: number;
  // 0 (acts earliest post-flop, worst position) .. 1 (acts latest, best
  // position) — a small, deliberately modest input (see `decide`).
  positionScore: number;
};

// A single recreational policy (feature 009 explicitly scopes one
// difficulty): estimate hand strength (preflop heuristic, or the real
// evaluator once there's a board), nudge it slightly for position, and
// compare against pot odds when facing a bet. Aggression (bet/raise) is
// always sized to the table minimum — this keeps sizing trivially safe
// (legalActions only offers bet/raise when the minimum is affordable) and
// still produces varied action choices (fold/check/call/bet/raise) across
// hands, which is what AC3 actually requires — not varied bet sizing.
export function decide(input: DecisionInput): AiDecision {
  const strength =
    input.board.length === 0
      ? preflopStrength(input.holeCards)
      : postflopStrength(input.holeCards, input.board);
  // Small, deliberate nudge — position matters in real play, but this is a
  // recreational bot, not a solver weighting it precisely.
  const adjusted = Math.min(1, strength + input.positionScore * 0.05);

  if (input.toCall <= 0) {
    // Usually a fresh street ("bet"); occasionally the big blind's own
    // preflop option — toCall is 0 (nothing more owed) but currentBet
    // isn't (their posted blind), so the aggressive move there is
    // "raise", not "bet" (see legalActions in betting.ts).
    if (adjusted >= 0.7) {
      if (input.legalActions.includes("bet")) {
        return { action: "bet", amount: input.minRaiseSize };
      }
      if (input.legalActions.includes("raise")) {
        return { action: "raise", amount: input.currentBet + input.minRaiseSize };
      }
    }
    return { action: "check" };
  }

  const potOdds = input.toCall / (input.pot + input.toCall);
  if (adjusted >= 0.8 && input.legalActions.includes("raise")) {
    return { action: "raise", amount: input.currentBet + input.minRaiseSize };
  }
  if (adjusted >= potOdds + 0.1 && input.legalActions.includes("call")) {
    return { action: "call" };
  }
  if (input.legalActions.includes("fold")) {
    return { action: "fold" };
  }
  return { action: "call" };
}
