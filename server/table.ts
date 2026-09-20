import type { DatabaseSync } from "node:sqlite";
import type { Action, BettingState } from "./poker/betting.js";
import { applyAction, legalActions, startBettingRound } from "./poker/betting.js";
import { dealHand } from "./poker/hand.js";
import type { HandState } from "./poker/hand.js";

export const BUY_IN = 200;
export const SMALL_BLIND = 1;
export const BIG_BLIND = 2;
export const COMPUTER_SEATS = 5;
export const SEAT_COUNT = COMPUTER_SEATS + 1;

// Human is always seat 0. There is no seat-assignment requirement in the
// spec beyond "6-max, one human seat" (requirement 3), so a fixed human
// seat keeps this deterministic and simple.
const HUMAN_SEAT = 0;

export type Seat = { kind: "human" | "computer"; stack: number };

export type TableState = { seated: true; stack: number } | { seated: false };

export type SeatView = {
  index: number;
  kind: Seat["kind"];
  stack: number;
  folded: boolean;
  allIn: boolean;
  streetContribution: number;
};

export type HandView = {
  button: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  street: HandState["street"];
  board: HandState["board"];
  holeCards: HandState["holeCards"][number];
  pot: number;
  currentBet: number;
  toCall: number;
  minRaiseSize: number;
  actingSeat: number | null;
  roundComplete: boolean;
  legalActions: Action[];
  seats: SeatView[];
};

type TableSession = {
  seats: Seat[];
  hand: HandState | null;
  betting: BettingState | null;
};

// In-memory only: no cards or betting yet, and a reload does not have to
// resume the table (feature 004's acceptance criteria), so this does not
// need to survive a server restart the way `users.tab` does. Scoped by db
// instance (not a single module-level map) so two independent `DatabaseSync`
// instances in the same process — e.g. separate test runs — never share
// seating state just because they happen to assign the same user id.
const sessionsByDb = new WeakMap<DatabaseSync, Map<number, TableSession>>();

function sessionsFor(db: DatabaseSync): Map<number, TableSession> {
  let sessions = sessionsByDb.get(db);
  if (!sessions) {
    sessions = new Map();
    sessionsByDb.set(db, sessions);
  }
  return sessions;
}

export function tableStateFor(db: DatabaseSync, userId: number): TableState {
  const session = sessionsFor(db).get(userId);
  return session === undefined
    ? { seated: false }
    : { seated: true, stack: session.seats[HUMAN_SEAT].stack };
}

function tabOf(db: DatabaseSync, userId: number): number {
  const row = db.prepare("SELECT tab FROM users WHERE id = ?").get(userId) as
    | { tab: number }
    | undefined;
  if (!row) {
    throw new Error("unknown user");
  }
  return Number(row.tab);
}

function setTab(db: DatabaseSync, userId: number, tab: number): void {
  db.prepare("UPDATE users SET tab = ? WHERE id = ?").run(tab, userId);
}

function newSeats(): Seat[] {
  return [
    { kind: "human", stack: BUY_IN },
    ...Array.from({ length: COMPUTER_SEATS }, () => ({
      kind: "computer" as const,
      stack: BUY_IN,
    })),
  ];
}

export type SitResult =
  | { ok: true; tab: number; stack: number }
  | { ok: false; reason: "insufficient" | "already-seated" };

export function sitDown(db: DatabaseSync, userId: number): SitResult {
  const sessions = sessionsFor(db);
  if (sessions.has(userId)) {
    return { ok: false, reason: "already-seated" };
  }
  const tab = tabOf(db, userId);
  if (tab < BUY_IN) {
    return { ok: false, reason: "insufficient" };
  }
  const newTab = tab - BUY_IN;
  setTab(db, userId, newTab);
  sessions.set(userId, { seats: newSeats(), hand: null, betting: null });
  return { ok: true, tab: newTab, stack: BUY_IN };
}

export type LeaveResult =
  | { ok: true; tab: number }
  | { ok: false; reason: "not-seated" };

export function leaveTable(db: DatabaseSync, userId: number): LeaveResult {
  const sessions = sessionsFor(db);
  const session = sessions.get(userId);
  if (!session) {
    return { ok: false, reason: "not-seated" };
  }
  const newTab = tabOf(db, userId) + session.seats[HUMAN_SEAT].stack;
  setTab(db, userId, newTab);
  sessions.delete(userId);
  return { ok: true, tab: newTab };
}

function syncStacks(session: TableSession): void {
  if (!session.betting) {
    return;
  }
  for (let i = 0; i < session.seats.length; i++) {
    session.seats[i].stack = session.betting.seats[i].stack;
  }
}

// Placeholder strategy for computer seats: always check if free, otherwise
// call (for less, if the stack is short). Never bets, raises, or folds.
// This is deliberately dumb — real hand-strength/position strategy is
// feature 009 ("Computer opponents"). Without this, a hand dealt today
// would stall forever on a computer's turn, since nothing else drives
// their actions yet.
function advanceComputerActions(session: TableSession): void {
  while (
    session.betting &&
    session.betting.actingSeat !== null &&
    session.seats[session.betting.actingSeat].kind === "computer"
  ) {
    const seat = session.betting.actingSeat;
    const toCall =
      session.betting.currentBet - session.betting.seats[seat].streetContribution;
    const action: Action = toCall > 0 ? "call" : "check";
    const result = applyAction(session.betting, seat, action);
    if (!result.ok) {
      // Unreachable in practice: check/call are always legal whenever this
      // placeholder is invoked, by construction of the betting engine.
      break;
    }
    session.betting = result.state;
    syncStacks(session);
  }
}

function handView(session: TableSession): HandView {
  const hand = session.hand;
  const betting = session.betting;
  if (!hand || !betting) {
    throw new Error("no active hand");
  }
  const humanBet = betting.seats[HUMAN_SEAT];
  const toCall = Math.max(betting.currentBet - humanBet.streetContribution, 0);
  return {
    button: hand.button,
    smallBlindSeat: hand.smallBlindSeat,
    bigBlindSeat: hand.bigBlindSeat,
    street: hand.street,
    board: hand.board,
    holeCards: hand.holeCards[HUMAN_SEAT],
    pot: betting.pot,
    currentBet: betting.currentBet,
    toCall,
    minRaiseSize: betting.minRaiseSize,
    actingSeat: betting.actingSeat,
    roundComplete: betting.actingSeat === null,
    legalActions: legalActions(betting, HUMAN_SEAT),
    seats: session.seats.map((seat, index) => ({
      index,
      kind: seat.kind,
      stack: seat.stack,
      folded: betting.seats[index].folded,
      allIn: betting.seats[index].allIn,
      streetContribution: betting.seats[index].streetContribution,
    })),
  };
}

export type StartHandResult =
  | { ok: true; view: HandView }
  | { ok: false; reason: "not-seated" | "hand-in-progress" };

// The button starts at seat 0 for a player's first hand at a table — there
// is no rotation history yet (button rotation across hands is feature 010,
// which is deferred), so any fixed, documented starting seat is a
// reasonable default. `dealHand` itself is exercised directly with every
// button position in tests, independent of this default.
const FIRST_HAND_BUTTON = 0;

export function startHand(
  db: DatabaseSync,
  userId: number,
  rng: () => number = Math.random,
): StartHandResult {
  const session = sessionsFor(db).get(userId);
  if (!session) {
    return { ok: false, reason: "not-seated" };
  }
  if (session.hand) {
    return { ok: false, reason: "hand-in-progress" };
  }
  const hand = dealHand(FIRST_HAND_BUTTON, rng);
  for (const post of hand.blindsPosted) {
    session.seats[post.seat].stack -= post.amount;
  }
  const startingSeat = (hand.bigBlindSeat + 1) % SEAT_COUNT;
  session.betting = startBettingRound(
    session.seats.map((s) => s.stack),
    hand.blindsPosted,
    startingSeat,
    BIG_BLIND,
    BIG_BLIND,
  );
  session.hand = hand;
  advanceComputerActions(session);
  return { ok: true, view: handView(session) };
}

export type CurrentHandResult =
  | { ok: true; view: HandView }
  | { ok: false; reason: "not-seated" | "no-hand" };

export function currentHand(db: DatabaseSync, userId: number): CurrentHandResult {
  const session = sessionsFor(db).get(userId);
  if (!session) {
    return { ok: false, reason: "not-seated" };
  }
  if (!session.hand) {
    return { ok: false, reason: "no-hand" };
  }
  return { ok: true, view: handView(session) };
}

export type SubmitActionResult =
  | { ok: true; view: HandView }
  | { ok: false; reason: "not-seated" | "no-hand" | "illegal"; message?: string };

export function submitAction(
  db: DatabaseSync,
  userId: number,
  action: Action,
  amount?: number,
): SubmitActionResult {
  const session = sessionsFor(db).get(userId);
  if (!session) {
    return { ok: false, reason: "not-seated" };
  }
  if (!session.hand || !session.betting) {
    return { ok: false, reason: "no-hand" };
  }
  const result = applyAction(session.betting, HUMAN_SEAT, action, amount);
  if (!result.ok) {
    return { ok: false, reason: "illegal", message: result.reason };
  }
  session.betting = result.state;
  syncStacks(session);
  advanceComputerActions(session);
  return { ok: true, view: handView(session) };
}
