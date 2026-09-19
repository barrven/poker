import type { DatabaseSync } from "node:sqlite";

export const BUY_IN = 200;
export const SMALL_BLIND = 1;
export const BIG_BLIND = 2;
export const COMPUTER_SEATS = 5;

export type TableState = { seated: true; stack: number } | { seated: false };

// In-memory only: no cards or betting yet, and a reload does not have to
// resume the table (feature 004's acceptance criteria), so this does not
// need to survive a server restart the way `users.tab` does.
const seated = new Map<number, number>();

export function tableStateFor(userId: number): TableState {
  const stack = seated.get(userId);
  return stack === undefined ? { seated: false } : { seated: true, stack };
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

export type SitResult =
  | { ok: true; tab: number; stack: number }
  | { ok: false; reason: "insufficient" | "already-seated" };

export function sitDown(db: DatabaseSync, userId: number): SitResult {
  if (seated.has(userId)) {
    return { ok: false, reason: "already-seated" };
  }
  const tab = tabOf(db, userId);
  if (tab < BUY_IN) {
    return { ok: false, reason: "insufficient" };
  }
  const newTab = tab - BUY_IN;
  setTab(db, userId, newTab);
  seated.set(userId, BUY_IN);
  return { ok: true, tab: newTab, stack: BUY_IN };
}

export type LeaveResult =
  | { ok: true; tab: number }
  | { ok: false; reason: "not-seated" };

export function leaveTable(db: DatabaseSync, userId: number): LeaveResult {
  const stack = seated.get(userId);
  if (stack === undefined) {
    return { ok: false, reason: "not-seated" };
  }
  const newTab = tabOf(db, userId) + stack;
  setTab(db, userId, newTab);
  seated.delete(userId);
  return { ok: true, tab: newTab };
}

export function clearSeatFor(userId: number): void {
  seated.delete(userId);
}
