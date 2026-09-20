import type { DatabaseSync } from "node:sqlite";
import type { Action, BettingState } from "./poker/betting.js";
import {
  applyAction,
  legalActions,
  roundStatus,
  startBettingRound,
  startNextStreet,
} from "./poker/betting.js";
import { decide } from "./poker/ai.js";
import type { Card } from "./poker/deck.js";
import { dealFlop, dealHand, dealRiver, dealTurn } from "./poker/hand.js";
import type { HandState } from "./poker/hand.js";
import { categoryName, evaluateBestHand } from "./poker/rank.js";
import { awardPotWithoutShowdown, awardPotsAtShowdown } from "./poker/settle.js";
import { classifyHandResult, recordHandHistory } from "./history.js";

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

export type SettlementResult = {
  reason: "fold" | "showdown";
  pot: number;
  winners: { seat: number; delta: number }[];
  revealed?: { seat: number; cards: Card[]; category: string }[];
};

export type ActionLogEntry = {
  seat: number;
  action: Action;
  // The seat's total street contribution after this action, for any
  // action that moves chips (bet/call/raise/all-in) — omitted for
  // fold/check, which don't.
  amount?: number;
  street: HandState["street"];
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
  result: SettlementResult | null;
  seats: SeatView[];
  actionLog: ActionLogEntry[];
};

type TableSession = {
  seats: Seat[];
  hand: HandState | null;
  betting: BettingState | null;
  // Human's stack the instant the current (or most recently settled) hand
  // started, before blinds — the baseline `syncHumanTab` diffs against so
  // the running tab picks up each hand's net result (spec requirement 18),
  // not just sit/leave.
  handStartStack: number;
  result: SettlementResult | null;
  // The seat that will be the button for the *next* hand dealt. Starts at
  // 0 (a fresh sit), and rotates one seat clockwise after every hand this
  // session deals (feature 010) — a new sit always starts a fresh table,
  // so this is never carried across a leave/re-sit.
  button: number;
  // Every action taken this hand (human and computer alike), oldest
  // first — reset each time a new hand is dealt (feature 008, AC5).
  actionLog: ActionLogEntry[];
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

// A seat can only ever post what it has — a seat in the SB/BB position
// with a very short stack (e.g. it busted last hand and hasn't been
// replenished yet within this same deal) could otherwise be asked to post
// a blind larger than its remaining stack, driving it negative. Cap each
// post at the seat's actual stack (an all-in blind), same as every other
// stack-affecting action in this engine (call, bet, raise, all-in)
// already does.
export function capBlindPosts(
  blindsPosted: { seat: number; amount: number }[],
  seats: Seat[],
): { seat: number; amount: number }[] {
  return blindsPosted.map((post) => ({
    seat: post.seat,
    amount: Math.min(post.amount, seats[post.seat].stack),
  }));
}

// A computer seat that busted in an earlier hand is replaced with a fresh
// 200-chip stack before the next deal, so the table always stays six
// seats with nobody stuck sitting out (feature 010, AC3). Computer
// opponents aren't bound by the human's real bankroll — this is the one
// place new chips enter the table rather than moving between seats.
// Mutates `seats` in place (consistent with the rest of this module's
// seat bookkeeping, e.g. blind/bet deduction).
export function replenishBustedComputers(seats: Seat[]): void {
  for (const seat of seats) {
    if (seat.kind === "computer" && seat.stack <= 0) {
      seat.stack = BUY_IN;
    }
  }
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
  sessions.set(userId, {
    seats: newSeats(),
    hand: null,
    betting: null,
    handStartStack: 0,
    result: null,
    button: 0,
    actionLog: [],
  });
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

export const TOP_UP_AMOUNT = 1000;

export type RebuyResult =
  | { ok: true; tab: number; stack: number }
  | {
      ok: false;
      reason: "not-seated" | "hand-in-progress" | "not-felted" | "insufficient-tab";
    };

export function rebuy(db: DatabaseSync, userId: number): RebuyResult {
  const session = sessionsFor(db).get(userId);
  if (!session) {
    return { ok: false, reason: "not-seated" };
  }
  if (session.hand && !session.result) {
    return { ok: false, reason: "hand-in-progress" };
  }
  if (session.seats[HUMAN_SEAT].stack !== 0) {
    return { ok: false, reason: "not-felted" };
  }
  const tab = tabOf(db, userId);
  if (tab < BUY_IN) {
    return { ok: false, reason: "insufficient-tab" };
  }
  const newTab = tab - BUY_IN;
  setTab(db, userId, newTab);
  session.seats[HUMAN_SEAT].stack = BUY_IN;
  return { ok: true, tab: newTab, stack: BUY_IN };
}

// No seating or stack precondition — a low tab can happen whether or not
// the player is currently at the table (AC3 doesn't gate this on being
// felted, only describes that scenario), and there's no real-money
// ceiling to protect against over-topping-up.
export function topUp(db: DatabaseSync, userId: number): { tab: number } {
  const newTab = tabOf(db, userId) + TOP_UP_AMOUNT;
  setTab(db, userId, newTab);
  return { tab: newTab };
}

function syncStacks(session: TableSession): void {
  if (!session.betting) {
    return;
  }
  for (let i = 0; i < session.seats.length; i++) {
    session.seats[i].stack = session.betting.seats[i].stack;
  }
}

const AMOUNT_LESS_ACTIONS: ReadonlySet<Action> = new Set(["fold", "check"]);

function recordAction(
  session: TableSession,
  seat: number,
  action: Action,
  street: HandState["street"],
): void {
  const streetContribution = session.betting?.seats[seat].streetContribution;
  session.actionLog.push({
    seat,
    action,
    amount: AMOUNT_LESS_ACTIONS.has(action) ? undefined : streetContribution,
    street,
  });
}

// Distance (normalized 0..1) from the seat that acts first post-flop
// (left of the button) to `seat` — a simple, real position signal: 0 is
// the worst position (acts first every street), 1 is the best (the
// button, who acts last).
function positionScore(seat: number, button: number): number {
  const actingFirst = (button + 1) % SEAT_COUNT;
  const distance = (seat - actingFirst + SEAT_COUNT) % SEAT_COUNT;
  return distance / (SEAT_COUNT - 1);
}

// Real computer strategy (feature 009): a single recreational policy using
// hand strength (a preflop heuristic, or — once there's a board — the same
// evaluator showdown uses), position, and pot odds. See server/poker/ai.ts.
function advanceComputerActions(session: TableSession): void {
  while (
    session.hand &&
    session.betting &&
    session.betting.actingSeat !== null &&
    session.seats[session.betting.actingSeat].kind === "computer"
  ) {
    const hand = session.hand;
    const seat = session.betting.actingSeat;
    const seatBet = session.betting.seats[seat];
    const decision = decide({
      holeCards: hand.holeCards[seat],
      board: hand.board,
      legalActions: legalActions(session.betting, seat),
      toCall: session.betting.currentBet - seatBet.streetContribution,
      pot: session.betting.pot,
      currentBet: session.betting.currentBet,
      minRaiseSize: session.betting.minRaiseSize,
      positionScore: positionScore(seat, hand.button),
    });
    const result = applyAction(session.betting, seat, decision.action, decision.amount);
    if (!result.ok) {
      // `decide` only ever returns an action from the seat's own
      // `legalActions`, with an affordable minimum-sized amount when it
      // bets or raises — this would mean a real bug in the strategy or the
      // betting engine, not a reachable runtime condition to swallow.
      throw new Error(`computer seat ${seat} chose an illegal action: ${result.reason}`);
    }
    session.betting = result.state;
    syncStacks(session);
    recordAction(session, seat, decision.action, hand.street);
  }
}

function advanceStreet(hand: HandState): HandState {
  if (hand.street === "preflop") {
    return dealFlop(hand);
  }
  if (hand.street === "flop") {
    return dealTurn(hand);
  }
  if (hand.street === "turn") {
    return dealRiver(hand);
  }
  throw new Error(`cannot advance past street ${hand.street}`);
}

function syncHumanTab(db: DatabaseSync, userId: number, session: TableSession): void {
  const delta = session.seats[HUMAN_SEAT].stack - session.handStartStack;
  if (delta === 0) {
    return;
  }
  setTab(db, userId, tabOf(db, userId) + delta);
}

// Writes one hand-history row for the human (feature 012) once
// `session.result` is final. `handStartStack` was captured before this
// hand's blinds were posted, so the diff against the human's current
// stack is exactly this hand's net effect on the table (same delta
// `syncHumanTab` folds into the running tab).
function recordSettledHandHistory(db: DatabaseSync, userId: number, session: TableSession): void {
  const hand = session.hand;
  const result = session.result;
  if (!hand || !result) {
    return;
  }
  const delta = session.seats[HUMAN_SEAT].stack - session.handStartStack;
  recordHandHistory(db, userId, {
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
    holeCards: hand.holeCards[HUMAN_SEAT],
    board: hand.board,
    result: classifyHandResult(result.winners, HUMAN_SEAT),
    delta,
  });
}

function settleWithoutShowdown(db: DatabaseSync, userId: number, session: TableSession): void {
  const betting = session.betting;
  if (!betting) {
    return;
  }
  const winnerSeat = betting.seats.findIndex((s) => !s.folded);
  const contributions = betting.seats.map((s, seat) => ({
    seat,
    folded: s.folded,
    totalContribution: s.totalContribution,
  }));
  const results = awardPotWithoutShowdown(contributions, winnerSeat);
  for (const r of results) {
    session.seats[r.seat].stack += r.delta;
  }
  session.result = {
    reason: "fold",
    pot: betting.pot,
    winners: results.map((r) => ({ seat: r.seat, delta: r.delta })),
  };
  syncHumanTab(db, userId, session);
  recordSettledHandHistory(db, userId, session);
}

function settleAtShowdown(db: DatabaseSync, userId: number, session: TableSession): void {
  const betting = session.betting;
  const hand = session.hand;
  if (!betting || !hand) {
    return;
  }
  const contributions = betting.seats.map((s, seat) => ({
    seat,
    folded: s.folded,
    totalContribution: s.totalContribution,
  }));
  const contenders = hand.holeCards
    .map((cards, seat) => ({ seat, holeCards: cards }))
    .filter((entry) => !betting.seats[entry.seat].folded);
  const results = awardPotsAtShowdown(contributions, hand.board, contenders);
  for (const r of results) {
    session.seats[r.seat].stack += r.delta;
  }
  session.result = {
    reason: "showdown",
    pot: betting.pot,
    winners: results.map((r) => ({ seat: r.seat, delta: r.delta })),
    revealed: contenders.map((c) => ({
      seat: c.seat,
      cards: c.holeCards,
      category: categoryName(evaluateBestHand([...c.holeCards, ...hand.board]).category),
    })),
  };
  syncHumanTab(db, userId, session);
  recordSettledHandHistory(db, userId, session);
}

// Drives the hand forward after any action changes who's on the clock:
// lets computer seats act, and when a betting round completes, either
// settles the hand (a fold-out, or a river showdown) or deals the next
// street and starts its betting round — looping until either a human
// decision is needed or the hand is fully settled.
function progressHand(db: DatabaseSync, userId: number, session: TableSession): void {
  while (session.hand && session.betting) {
    advanceComputerActions(session);
    if (session.betting.actingSeat !== null) {
      return;
    }
    const status = roundStatus(session.betting);
    if (!status.complete) {
      return;
    }
    if (status.reason === "one-remaining") {
      settleWithoutShowdown(db, userId, session);
      return;
    }
    if (session.hand.street === "river") {
      settleAtShowdown(db, userId, session);
      return;
    }
    session.hand = advanceStreet(session.hand);
    const startingSeat = (session.hand.button + 1) % SEAT_COUNT;
    session.betting = startNextStreet(session.betting, startingSeat, BIG_BLIND);
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
    result: session.result,
    seats: session.seats.map((seat, index) => ({
      index,
      kind: seat.kind,
      stack: seat.stack,
      folded: betting.seats[index].folded,
      allIn: betting.seats[index].allIn,
      streetContribution: betting.seats[index].streetContribution,
    })),
    actionLog: session.actionLog,
  };
}

export type StartHandResult =
  | { ok: true; view: HandView }
  | { ok: false; reason: "not-seated" | "hand-in-progress" | "felted" };

export function startHand(
  db: DatabaseSync,
  userId: number,
  rng: () => number = Math.random,
): StartHandResult {
  const session = sessionsFor(db).get(userId);
  if (!session) {
    return { ok: false, reason: "not-seated" };
  }
  if (session.hand && !session.result) {
    return { ok: false, reason: "hand-in-progress" };
  }
  // A player with no table stack can't be dealt into a hand — they must
  // rebuy (feature 011) or leave first (AC2).
  if (session.seats[HUMAN_SEAT].stack <= 0) {
    return { ok: false, reason: "felted" };
  }
  session.hand = null;
  session.betting = null;
  session.result = null;
  session.handStartStack = session.seats[HUMAN_SEAT].stack;
  session.actionLog = [];

  replenishBustedComputers(session.seats);

  const button = session.button;
  session.button = (button + 1) % SEAT_COUNT;
  const hand = dealHand(button, rng);
  const postedBlinds = capBlindPosts(hand.blindsPosted, session.seats);
  for (const post of postedBlinds) {
    session.seats[post.seat].stack -= post.amount;
  }
  const startingSeat = (hand.bigBlindSeat + 1) % SEAT_COUNT;
  session.betting = startBettingRound(
    session.seats.map((s) => s.stack),
    postedBlinds,
    startingSeat,
    BIG_BLIND,
    BIG_BLIND,
  );
  session.hand = hand;
  progressHand(db, userId, session);
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
  if (!session.hand || !session.betting || session.result) {
    return { ok: false, reason: "no-hand" };
  }
  const street = session.hand.street;
  const result = applyAction(session.betting, HUMAN_SEAT, action, amount);
  if (!result.ok) {
    return { ok: false, reason: "illegal", message: result.reason };
  }
  session.betting = result.state;
  syncStacks(session);
  recordAction(session, HUMAN_SEAT, action, street);
  progressHand(db, userId, session);
  return { ok: true, view: handView(session) };
}
