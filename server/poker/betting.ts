export type Action = "fold" | "check" | "call" | "bet" | "raise" | "all-in";

export type SeatBet = {
  stack: number;
  folded: boolean;
  allIn: boolean;
  streetContribution: number;
  totalContribution: number;
  hasActed: boolean;
};

export type BettingState = {
  seats: SeatBet[];
  pot: number;
  currentBet: number;
  minRaiseSize: number;
  actingSeat: number | null;
};

export type RoundStatus =
  | { complete: false }
  | { complete: true; reason: "one-remaining" | "all-called" };

export type ApplyActionResult =
  | { ok: true; state: BettingState; status: RoundStatus }
  | { ok: false; reason: string };

// First seat at or after `from` (wrapping) that can still act. Used both to
// resolve a street's opening actor and, defensively, by any future caller
// that needs to skip folded/all-in seats starting from an arbitrary seat.
export function firstToAct(seats: SeatBet[], from: number): number {
  for (let i = 0; i < seats.length; i++) {
    const candidate = (from + i) % seats.length;
    if (!seats[candidate].folded && !seats[candidate].allIn) {
      return candidate;
    }
  }
  return from;
}

function finalize(state: Omit<BettingState, "actingSeat">, candidateSeat: number): BettingState {
  const withCandidate: BettingState = { ...state, actingSeat: candidateSeat };
  const status = roundStatus(withCandidate);
  return { ...withCandidate, actingSeat: status.complete ? null : candidateSeat };
}

export function startBettingRound(
  stacks: number[],
  contributions: { seat: number; amount: number }[],
  startingSeat: number,
  currentBet: number,
  minRaiseSize: number,
): BettingState {
  const seats: SeatBet[] = stacks.map((stack) => ({
    stack,
    folded: false,
    allIn: stack <= 0,
    streetContribution: 0,
    totalContribution: 0,
    hasActed: false,
  }));
  let pot = 0;
  for (const post of contributions) {
    const seat = seats[post.seat];
    seat.streetContribution += post.amount;
    seat.totalContribution += post.amount;
    pot += post.amount;
    if (seat.stack <= seat.streetContribution) {
      seat.allIn = true;
    }
  }
  return finalize({ seats, pot, currentBet, minRaiseSize }, firstToAct(seats, startingSeat));
}

// Moves to a new street: carries `pot` and each seat's `totalContribution`
// forward (a fresh `startBettingRound` would wrongly reset them to 0), and
// resets only the per-street bookkeeping (`streetContribution`, `hasActed`,
// `currentBet`) for the new round of betting.
export function startNextStreet(
  previous: BettingState,
  startingSeat: number,
  minRaiseSize: number,
): BettingState {
  const seats: SeatBet[] = previous.seats.map((s) => ({
    ...s,
    streetContribution: 0,
    hasActed: false,
  }));
  return finalize(
    { seats, pot: previous.pot, currentBet: 0, minRaiseSize },
    firstToAct(seats, startingSeat),
  );
}

export function legalActions(state: BettingState, seat: number): Action[] {
  if (state.actingSeat !== seat) {
    return [];
  }
  const s = state.seats[seat];
  if (s.folded || s.allIn || s.stack <= 0) {
    return [];
  }
  const toCall = state.currentBet - s.streetContribution;
  const actions: Action[] = ["fold"];
  if (toCall <= 0) {
    actions.push("check", "bet");
  } else {
    actions.push("call");
    if (s.stack > toCall && s.stack - toCall >= state.minRaiseSize) {
      actions.push("raise");
    }
  }
  actions.push("all-in");
  return actions;
}

function resetOthersActed(seats: SeatBet[], exceptSeat: number): void {
  for (let i = 0; i < seats.length; i++) {
    if (i !== exceptSeat && !seats[i].folded && !seats[i].allIn) {
      seats[i].hasActed = false;
    }
  }
}

export function roundStatus(state: BettingState): RoundStatus {
  const active = state.seats.filter((s) => !s.folded);
  if (active.length <= 1) {
    return { complete: true, reason: "one-remaining" };
  }
  const contesting = active.filter((s) => !s.allIn);
  const allMatched = contesting.every(
    (s) => s.hasActed && s.streetContribution === state.currentBet,
  );
  if (contesting.length === 0 || allMatched) {
    return { complete: true, reason: "all-called" };
  }
  return { complete: false };
}

export function applyAction(
  state: BettingState,
  seat: number,
  action: Action,
  amount?: number,
): ApplyActionResult {
  if (state.actingSeat !== seat) {
    return { ok: false, reason: "It is not this seat's turn to act." };
  }
  const current = state.seats[seat];
  if (current.folded || current.allIn) {
    return { ok: false, reason: "This seat cannot act." };
  }
  const toCall = state.currentBet - current.streetContribution;
  const seats = state.seats.map((s) => ({ ...s }));
  let pot = state.pot;
  let currentBet = state.currentBet;
  let minRaiseSize = state.minRaiseSize;

  switch (action) {
    case "fold": {
      seats[seat].folded = true;
      seats[seat].hasActed = true;
      break;
    }
    case "check": {
      if (toCall !== 0) {
        return { ok: false, reason: "Cannot check facing a bet." };
      }
      seats[seat].hasActed = true;
      break;
    }
    case "call": {
      if (toCall <= 0) {
        return { ok: false, reason: "There is nothing to call." };
      }
      const pay = Math.min(toCall, current.stack);
      seats[seat].stack -= pay;
      seats[seat].streetContribution += pay;
      seats[seat].totalContribution += pay;
      pot += pay;
      seats[seat].hasActed = true;
      if (seats[seat].stack === 0) {
        seats[seat].allIn = true;
      }
      break;
    }
    case "bet": {
      if (currentBet !== 0) {
        return { ok: false, reason: "A bet is already live; use raise." };
      }
      if (amount === undefined || amount <= 0) {
        return { ok: false, reason: "Invalid bet amount." };
      }
      if (amount > current.stack) {
        return { ok: false, reason: "Bet exceeds remaining stack." };
      }
      if (amount < minRaiseSize && amount !== current.stack) {
        return { ok: false, reason: "Bet is below the minimum." };
      }
      seats[seat].stack -= amount;
      seats[seat].streetContribution += amount;
      seats[seat].totalContribution += amount;
      pot += amount;
      currentBet = seats[seat].streetContribution;
      minRaiseSize = amount;
      seats[seat].hasActed = true;
      if (seats[seat].stack === 0) {
        seats[seat].allIn = true;
      }
      resetOthersActed(seats, seat);
      break;
    }
    case "raise": {
      if (currentBet === 0) {
        return { ok: false, reason: "No existing bet to raise; use bet." };
      }
      if (amount === undefined) {
        return { ok: false, reason: "Invalid raise amount." };
      }
      const increment = amount - current.streetContribution;
      if (increment <= toCall) {
        return { ok: false, reason: "Raise must exceed the call amount." };
      }
      if (increment > current.stack) {
        return { ok: false, reason: "Raise exceeds remaining stack." };
      }
      const raiseSize = amount - currentBet;
      if (raiseSize < minRaiseSize && increment !== current.stack) {
        return { ok: false, reason: "Raise is below the minimum." };
      }
      seats[seat].stack -= increment;
      seats[seat].streetContribution = amount;
      seats[seat].totalContribution += increment;
      pot += increment;
      currentBet = amount;
      minRaiseSize = Math.max(raiseSize, minRaiseSize);
      seats[seat].hasActed = true;
      if (seats[seat].stack === 0) {
        seats[seat].allIn = true;
      }
      resetOthersActed(seats, seat);
      break;
    }
    case "all-in": {
      const shove = current.stack;
      if (shove <= 0) {
        return { ok: false, reason: "No chips left to go all-in with." };
      }
      const totalAfter = current.streetContribution + shove;
      seats[seat].stack = 0;
      seats[seat].streetContribution = totalAfter;
      seats[seat].totalContribution += shove;
      pot += shove;
      seats[seat].allIn = true;
      seats[seat].hasActed = true;
      if (totalAfter > currentBet) {
        const raiseSize = totalAfter - currentBet;
        currentBet = totalAfter;
        if (raiseSize > minRaiseSize) {
          minRaiseSize = raiseSize;
        }
        resetOthersActed(seats, seat);
      }
      break;
    }
    default:
      return { ok: false, reason: "Unknown action." };
  }

  const provisional: BettingState = {
    seats,
    pot,
    currentBet,
    minRaiseSize,
    actingSeat: state.actingSeat,
  };
  const status = roundStatus(provisional);
  const finalState: BettingState = {
    ...provisional,
    actingSeat: status.complete ? null : firstToAct(seats, seat + 1),
  };
  return { ok: true, state: finalState, status };
}
