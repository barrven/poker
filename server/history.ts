import type { DatabaseSync } from "node:sqlite";
import type { Card } from "./poker/deck.js";

export type HandResult = "won" | "lost" | "split";

export type HandHistoryEntry = {
  id: number;
  playedAt: string;
  smallBlind: number;
  bigBlind: number;
  holeCards: Card[];
  board: Card[];
  result: HandResult;
  delta: number;
};

const DEFAULT_LIMIT = 50;

export function recordHandHistory(
  db: DatabaseSync,
  userId: number,
  entry: {
    smallBlind: number;
    bigBlind: number;
    holeCards: Card[];
    board: Card[];
    result: HandResult;
    delta: number;
  },
): void {
  db.prepare(
    `INSERT INTO hand_history (user_id, small_blind, big_blind, hole_cards, board, result, delta)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
    entry.smallBlind,
    entry.bigBlind,
    JSON.stringify(entry.holeCards),
    JSON.stringify(entry.board),
    entry.result,
    entry.delta,
  );
}

type HandHistoryRow = {
  id: number;
  playedAt: string;
  smallBlind: number;
  bigBlind: number;
  holeCards: string;
  board: string;
  result: HandResult;
  delta: number;
};

export function listHandHistory(
  db: DatabaseSync,
  userId: number,
  limit = DEFAULT_LIMIT,
): HandHistoryEntry[] {
  const rows = db
    .prepare(
      `SELECT id, played_at AS playedAt, small_blind AS smallBlind, big_blind AS bigBlind,
              hole_cards AS holeCards, board, result, delta
       FROM hand_history WHERE user_id = ? ORDER BY id DESC LIMIT ?`,
    )
    .all(userId, limit) as HandHistoryRow[];
  return rows.map((row) => ({
    ...row,
    holeCards: JSON.parse(row.holeCards) as Card[],
    board: JSON.parse(row.board) as Card[],
  }));
}

// A seat that won at least one pot layer appears once in `winners` with
// its combined delta across every layer it took (see
// poker/settle.ts#awardPotsAtShowdown) — a seat that won nothing (folded,
// or contested and lost) never appears at all. So: not present -> lost;
// present alone -> won the whole pot; present alongside other winning
// seats -> the pot (or at least one of its layers) was split. This is a
// coarse, hand-level classification, not a layer-by-layer one — a human
// who wins the main pot outright while someone else wins a side pot they
// weren't part of is still reported "split" here, since from the human's
// seat the hand's proceeds were shared with someone else.
export function classifyHandResult(
  winners: { seat: number }[],
  humanSeat: number,
): HandResult {
  const isWinner = winners.some((w) => w.seat === humanSeat);
  if (!isWinner) {
    return "lost";
  }
  return winners.length > 1 ? "split" : "won";
}
