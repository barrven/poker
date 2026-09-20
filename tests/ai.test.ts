import assert from "node:assert/strict";
import { test } from "node:test";
import { legalActions, startBettingRound } from "../server/poker/betting.js";
import type { Action } from "../server/poker/betting.js";
import { decide } from "../server/poker/ai.js";
import type { Card } from "../server/poker/deck.js";

function cards(...values: string[]): Card[] {
  return values as Card[];
}

test("decide() only ever returns an action that was actually offered as legal", () => {
  // Sample a wide range of hole cards, boards, and betting contexts —
  // every returned action must be one of the ones actually offered.
  const boards = [
    [],
    cards("2c", "5d", "9s"),
    cards("2c", "5d", "9s", "Kh"),
    cards("2c", "5d", "9s", "Kh", "Ad"),
  ];
  const holeCardPairs = [
    cards("As", "Ah"),
    cards("7c", "2d"),
    cards("Kc", "Qc"),
    cards("9h", "9d"),
    cards("2h", "3h"),
  ];
  for (const board of boards) {
    for (const holeCards of holeCardPairs) {
      for (const currentBet of [0, 2, 6, 20]) {
        for (const minRaiseSize of [2, 4]) {
          for (const toCall of [0, 2, 10]) {
            const legalActions: Action[] =
              toCall > 0
                ? currentBet - toCall + minRaiseSize <= 200
                  ? ["fold", "call", "raise", "all-in"]
                  : ["fold", "call", "all-in"]
                : currentBet === 0
                  ? ["fold", "check", "bet", "all-in"]
                  : ["fold", "check", "raise", "all-in"];
            const decision = decide({
              holeCards,
              board,
              legalActions,
              toCall,
              pot: 20,
              currentBet,
              minRaiseSize,
              positionScore: 0.5,
            });
            assert.ok(
              legalActions.includes(decision.action),
              `decide() returned ${decision.action}, not in ${JSON.stringify(legalActions)}`,
            );
          }
        }
      }
    }
  }
});

test("decide() does not always fold: a strong hand facing a small bet with good pot odds calls or raises", () => {
  const decision = decide({
    holeCards: cards("As", "Ah"),
    board: [],
    legalActions: ["fold", "call", "raise", "all-in"],
    toCall: 2,
    pot: 20,
    currentBet: 2,
    minRaiseSize: 2,
    positionScore: 0.5,
  });
  assert.notEqual(decision.action, "fold");
});

test("decide() does not always go all-in: a strong hand with a check available just checks or bets, never shoves reflexively", () => {
  const decision = decide({
    holeCards: cards("As", "Ah"),
    board: [],
    legalActions: ["fold", "check", "bet", "all-in"],
    toCall: 0,
    pot: 20,
    currentBet: 0,
    minRaiseSize: 2,
    positionScore: 0.5,
  });
  assert.notEqual(decision.action, "all-in");
});

test("hand strength drives the decision: pocket aces and 7-2 offsuit act differently under identical pressure", () => {
  const context = {
    board: [] as Card[],
    legalActions: ["fold", "call", "raise", "all-in"] as Action[],
    toCall: 20,
    pot: 22,
    currentBet: 20,
    minRaiseSize: 2,
    positionScore: 0,
  };
  const strong = decide({ ...context, holeCards: cards("As", "Ah") });
  const weak = decide({ ...context, holeCards: cards("7c", "2d") });
  assert.notEqual(strong.action, "fold");
  assert.equal(weak.action, "fold");
});

test("a bet/raise amount decide() returns is always legal against the real betting engine (regression: unaffordable bet, BB option mislabeled)", () => {
  // The big blind's preflop option: everyone just called, so toCall is 0
  // but currentBet (2, their own posted blind) isn't — legalActions
  // correctly offers "raise" here, not "bet" (a bug this feature found
  // and fixed in server/poker/betting.ts).
  const bbOption = startBettingRound(
    [200, 200, 200, 200, 200, 200],
    [
      { seat: 1, amount: 1 },
      { seat: 2, amount: 2 },
    ],
    2,
    2,
    2,
  );
  const optionLegal = legalActions(bbOption, 2);
  assert.ok(optionLegal.includes("raise"));
  assert.ok(!optionLegal.includes("bet"));
  const decision = decide({
    holeCards: cards("As", "Ah"),
    board: [],
    legalActions: optionLegal,
    toCall: 0,
    pot: bbOption.pot,
    currentBet: bbOption.currentBet,
    minRaiseSize: bbOption.minRaiseSize,
    positionScore: 1,
  });
  assert.ok(optionLegal.includes(decision.action));

  // A seat too short to afford even the minimum bet: legalActions must not
  // offer "bet" at all (a second bug this feature found and fixed).
  const shortStack = startBettingRound([1, 200, 200, 200, 200, 200], [], 0, 0, 2);
  const shortLegal = legalActions(shortStack, 0);
  assert.ok(!shortLegal.includes("bet"));
  assert.ok(shortLegal.includes("check"));
  assert.ok(shortLegal.includes("all-in"));
});
