import assert from "node:assert/strict";
import { test } from "node:test";
import { capBlindPosts } from "../server/table.js";
import type { Seat } from "../server/table.js";

function seats(...stacks: number[]): Seat[] {
  return stacks.map((stack) => ({ kind: "computer" as const, stack }));
}

test("regression: a blind post is capped at the seat's stack, never driving it negative", () => {
  // A seat busted to 1 chip (from an earlier hand — this scenario becomes
  // rare once feature 010, deferred, replaces busted computer seats
  // before the next deal, but the engine must never produce a negative
  // stack regardless). Posting the nominal 2-chip big blind unconditionally
  // would take it to -1; found via chip-conservation stress testing with
  // real, unscripted computer play across many hands.
  const posted = capBlindPosts(
    [
      { seat: 1, amount: 1 },
      { seat: 2, amount: 2 },
    ],
    seats(200, 200, 1),
  );
  assert.deepEqual(posted, [
    { seat: 1, amount: 1 },
    { seat: 2, amount: 1 }, // capped from 2 down to the seat's actual 1 chip
  ]);
});

test("a normal blind post (plenty of stack) is unaffected by the cap", () => {
  const posted = capBlindPosts(
    [
      { seat: 1, amount: 1 },
      { seat: 2, amount: 2 },
    ],
    seats(200, 200, 200),
  );
  assert.deepEqual(posted, [
    { seat: 1, amount: 1 },
    { seat: 2, amount: 2 },
  ]);
});

test("a seat with exactly zero chips posts a zero blind rather than going negative", () => {
  const posted = capBlindPosts([{ seat: 2, amount: 2 }], seats(200, 200, 0));
  assert.deepEqual(posted, [{ seat: 2, amount: 0 }]);
});
