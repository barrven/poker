import "./style.css";

const appEl = document.querySelector<HTMLDivElement>("#app");
if (!appEl) {
  throw new Error("missing #app");
}
const app: HTMLDivElement = appEl;

type Session = {
  username: string;
  tab: number;
  seated: boolean;
  stack: number;
};

const BUY_IN = 200;
const TOP_UP_AMOUNT = 1000;
const COMPUTER_SEATS = 5;

// A small poker-chip icon (feature 016), styled purely in CSS (.chip-icon)
// so stack/bet/pot amounts read as chip counts, not bare numbers.
const CHIP_ICON = '<span class="chip-icon" aria-hidden="true"></span>';

type Action = "fold" | "check" | "call" | "bet" | "raise" | "all-in";

type HandSeatView = {
  index: number;
  kind: "human" | "computer";
  stack: number;
  folded: boolean;
  allIn: boolean;
  streetContribution: number;
};
type SettlementResult = {
  reason: string;
  pot: number;
  winners: { seat: number; delta: number }[];
  revealed?: { seat: number; cards: string[]; category: string }[];
};

type ActionLogEntry = {
  seat: number;
  action: string;
  amount?: number;
  street: string;
};

type HandView = {
  button: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  street: string;
  board: string[];
  holeCards: string[];
  pot: number;
  currentBet: number;
  toCall: number;
  minRaiseSize: number;
  actingSeat: number | null;
  roundComplete: boolean;
  legalActions: Action[];
  result: SettlementResult | null;
  seats: HandSeatView[];
  actionLog: ActionLogEntry[];
};

type HandHistoryEntry = {
  id: number;
  playedAt: string;
  smallBlind: number;
  bigBlind: number;
  holeCards: string[];
  board: string[];
  result: "won" | "lost" | "split";
  delta: number;
};

type View =
  | { kind: "loading" }
  | { kind: "guest"; authView: "login" | "register"; error: string }
  | {
      kind: "signed-in";
      username: string;
      tab: number;
      seated: boolean;
      stack: number;
      hand: HandView | undefined;
      error: string;
      historyOpen: boolean;
      history: HandHistoryEntry[] | undefined;
    };

let view: View = { kind: "loading" };

// The next hand starts automatically once a hand settles (feature 010,
// AC1) — no click required. A few seconds' pause lets the human actually
// see the result (who won, the showdown reveal) before it advances.
const AUTO_DEAL_DELAY_MS = 3000;
let autoDealTimer: ReturnType<typeof setTimeout> | undefined;

function clearAutoDeal(): void {
  if (autoDealTimer !== undefined) {
    clearTimeout(autoDealTimer);
    autoDealTimer = undefined;
  }
}

function scheduleAutoDeal(hand: HandView | undefined): void {
  const canAutoDeal = hand?.result && hand.seats[0].stack > 0;
  if (!canAutoDeal) {
    clearAutoDeal();
    return;
  }
  if (autoDealTimer !== undefined) {
    return; // already scheduled for this settled hand
  }
  autoDealTimer = setTimeout(() => {
    autoDealTimer = undefined;
    void onDeal();
  }, AUTO_DEAL_DELAY_MS);
}

function hasSitControl(root: HTMLElement): boolean {
  return Boolean(
    root.querySelector("[data-sit], #sit, button.sit, input[name='sit']"),
  );
}

async function api(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
  } catch {
    // ignore
  }
  return "Something went wrong.";
}

async function loadSession(): Promise<Session | undefined> {
  const response = await api("/api/me");
  if (response.status === 401) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error("session");
  }
  const body: unknown = await response.json();
  return parseSession(body);
}

function parseSession(body: unknown): Session | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  if (
    !("username" in body) ||
    typeof body.username !== "string" ||
    !("tab" in body) ||
    typeof body.tab !== "number" ||
    !Number.isInteger(body.tab) ||
    !("seated" in body) ||
    typeof body.seated !== "boolean" ||
    !("stack" in body) ||
    typeof body.stack !== "number" ||
    !Number.isInteger(body.stack)
  ) {
    return undefined;
  }
  return {
    username: body.username,
    tab: body.tab,
    seated: body.seated,
    stack: body.stack,
  };
}

function parseHandView(body: unknown): HandView | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const b = body as Record<string, unknown>;
  if (
    typeof b.button !== "number" ||
    typeof b.smallBlindSeat !== "number" ||
    typeof b.bigBlindSeat !== "number" ||
    typeof b.street !== "string" ||
    !Array.isArray(b.board) ||
    !Array.isArray(b.holeCards) ||
    typeof b.pot !== "number" ||
    typeof b.currentBet !== "number" ||
    typeof b.toCall !== "number" ||
    typeof b.minRaiseSize !== "number" ||
    (b.actingSeat !== null && typeof b.actingSeat !== "number") ||
    typeof b.roundComplete !== "boolean" ||
    !Array.isArray(b.legalActions) ||
    (b.result !== null && typeof b.result !== "object") ||
    !Array.isArray(b.seats) ||
    !Array.isArray(b.actionLog)
  ) {
    return undefined;
  }
  return {
    button: b.button,
    smallBlindSeat: b.smallBlindSeat,
    bigBlindSeat: b.bigBlindSeat,
    street: b.street,
    board: b.board as string[],
    holeCards: b.holeCards as string[],
    pot: b.pot,
    currentBet: b.currentBet,
    toCall: b.toCall,
    minRaiseSize: b.minRaiseSize,
    actingSeat: b.actingSeat as number | null,
    roundComplete: b.roundComplete,
    legalActions: b.legalActions as Action[],
    result: b.result as SettlementResult | null,
    seats: b.seats as HandSeatView[],
    actionLog: b.actionLog as ActionLogEntry[],
  };
}

async function fetchCurrentHand(): Promise<HandView | undefined> {
  const response = await api("/api/hand");
  if (!response.ok) {
    return undefined;
  }
  return parseHandView(await response.json());
}

const HAND_RESULTS = new Set(["won", "lost", "split"]);

function parseHandHistory(body: unknown): HandHistoryEntry[] | undefined {
  if (typeof body !== "object" || body === null || !("hands" in body) || !Array.isArray(body.hands)) {
    return undefined;
  }
  const hands: HandHistoryEntry[] = [];
  for (const raw of body.hands) {
    if (
      typeof raw !== "object" ||
      raw === null ||
      typeof raw.id !== "number" ||
      typeof raw.playedAt !== "string" ||
      typeof raw.smallBlind !== "number" ||
      typeof raw.bigBlind !== "number" ||
      !Array.isArray(raw.holeCards) ||
      !Array.isArray(raw.board) ||
      typeof raw.result !== "string" ||
      !HAND_RESULTS.has(raw.result) ||
      typeof raw.delta !== "number"
    ) {
      return undefined;
    }
    hands.push({
      id: raw.id,
      playedAt: raw.playedAt,
      smallBlind: raw.smallBlind,
      bigBlind: raw.bigBlind,
      holeCards: raw.holeCards as string[],
      board: raw.board as string[],
      result: raw.result as HandHistoryEntry["result"],
      delta: raw.delta,
    });
  }
  return hands;
}

async function fetchHandHistory(): Promise<HandHistoryEntry[] | undefined> {
  const response = await api("/api/history");
  if (!response.ok) {
    return undefined;
  }
  return parseHandHistory(await response.json());
}

function formatChips(amount: number): string {
  return amount.toLocaleString("en-US");
}

function render(): void {
  if (view.kind === "loading") {
    app.innerHTML = `
      <h1>Poker</h1>
      <p>No-Limit Texas Hold'em vs computer. Play-money chips.</p>
      <p class="status" data-state="pending">Loading…</p>
    `;
    return;
  }

  if (view.kind === "signed-in") {
    scheduleAutoDeal(view.hand);
    if (!view.seated && view.history === undefined) {
      void loadDashboardHistory();
    }
    const error = view.error
      ? `<p class="status" data-state="error">${escapeHtml(view.error)}</p>`
      : "";
    const table = view.seated
      ? view.hand
        ? renderHand(view.hand, view.tab)
        : `${renderDealControl()}${renderTable(view.stack)}`
      : renderDashboard(view.tab, view.history);
    // Hand history is shown outright on the dashboard above (not
    // seated); while seated it's still available, but behind the same
    // toggle as before this feature — the table/hand view already has
    // plenty on screen without it.
    const seatedHistorySection = view.seated
      ? `${renderHistoryToggle(view.historyOpen)}${view.historyOpen ? renderHistory(view.history) : ""}`
      : "";
    app.innerHTML = `
      ${renderTopMenu(view.username)}
      <p data-tab>Tab: <strong>${escapeHtml(formatChips(view.tab))}</strong> play-money chips.</p>
      ${error}
      ${table}
      ${seatedHistorySection}
    `;
    app.querySelector("#logout")?.addEventListener("click", () => {
      void onLogout();
    });
    app.querySelector("#history-toggle")?.addEventListener("click", () => {
      void onToggleHistory();
    });
    app.querySelector("#sit")?.addEventListener("click", () => {
      void onSit();
    });
    app.querySelector("#leave")?.addEventListener("click", () => {
      void onLeave();
    });
    app.querySelector("#deal")?.addEventListener("click", () => {
      void onDeal();
    });
    app.querySelector("#rebuy")?.addEventListener("click", () => {
      void onRebuy();
    });
    app.querySelector("#topup")?.addEventListener("click", () => {
      void onTopUp();
    });
    app
      .querySelectorAll<HTMLButtonElement>("[data-action]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const action = button.dataset.action as Action;
          const amountInput = app.querySelector<HTMLInputElement>("#raise-amount");
          const amount =
            action === "bet" || action === "raise"
              ? Number(amountInput?.value ?? "0")
              : undefined;
          void onAction(action, amount);
        });
      });
    return;
  }

  const error = view.error
    ? `<p class="status" data-state="error">${escapeHtml(view.error)}</p>`
    : "";
  // Login-first (feature 017): a logged-out visitor sees one form at a
  // time, not both stacked together — register-form and login-form both
  // still exist in the DOM's possible states, just never simultaneously.
  const registerForm = `
    <form id="register-form">
      <h2>Register</h2>
      <label>Username <input name="username" autocomplete="username" maxlength="32" required /></label>
      <label>Password <input name="password" type="password" autocomplete="new-password" required /></label>
      <button type="submit">Register</button>
      <p><button type="button" id="show-login" data-show-login>Already have an account? Log in</button></p>
    </form>
  `;
  const loginForm = `
    <form id="login-form">
      <h2>Log in</h2>
      <label>Username <input name="username" autocomplete="username" maxlength="32" required /></label>
      <label>Password <input name="password" type="password" autocomplete="current-password" required /></label>
      <button type="submit">Log in</button>
      <p><button type="button" id="show-register" data-show-register>Need an account? Register</button></p>
    </form>
  `;
  app.innerHTML = `
    <h1>Poker</h1>
    <p>No-Limit Texas Hold'em vs computer. Play-money chips.</p>
    ${error}
    ${view.authView === "register" ? registerForm : loginForm}
  `;
  app.querySelector("#register-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void onRegister(event.target as HTMLFormElement);
  });
  app.querySelector("#login-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void onLogin(event.target as HTMLFormElement);
  });
  app.querySelector("#show-login")?.addEventListener("click", () => {
    view = { kind: "guest", authView: "login", error: "" };
    render();
  });
  app.querySelector("#show-register")?.addEventListener("click", () => {
    view = { kind: "guest", authView: "register", error: "" };
    render();
  });
  if (hasSitControl(app)) {
    throw new Error("sit control must not be shown while logged out");
  }
}

function renderSitControl(tab: number): string {
  if (tab < BUY_IN) {
    return `<p class="status" data-state="error">You need at least ${BUY_IN} chips on your tab to sit down.</p>`;
  }
  return `<p><button type="button" id="sit" data-sit>Sit down (${BUY_IN} chips)</button></p>`;
}

// App-shell top menu bar (feature 018): visible in every signed-in
// state. "Profile" is just the username (no other requirement defines
// account-profile behavior); "Settings" is a real, visible entry but a
// disabled placeholder — there's nothing to configure yet, and a
// disabled control communicates that honestly instead of faking an
// action with no effect.
function renderTopMenu(username: string): string {
  return `
    <header data-topbar>
      <span data-brand>Poker</span>
      <nav data-topnav>
        <span data-profile title="Profile">${escapeHtml(username)}</span>
        <button type="button" id="settings" data-settings disabled title="No settings yet">Settings</button>
        <button type="button" id="logout" data-logout>Log out</button>
      </nav>
    </header>
  `;
}

// The default logged-in view before sitting at a table (feature 018):
// sit-down and add-chips actions, plus hand history shown outright
// (not behind the toggle used while seated below).
function renderDashboard(tab: number, history: HandHistoryEntry[] | undefined): string {
  return `
    <div data-dashboard>
      ${renderSitControl(tab)}
      <p><button type="button" id="topup" data-topup>Add ${formatChips(TOP_UP_AMOUNT)} chips</button></p>
      <h2>Hand history</h2>
      ${renderHistory(history)}
    </div>
  `;
}

function renderTable(stack: number): string {
  const computerSeats = Array.from(
    { length: COMPUTER_SEATS },
    (_, i) =>
      `<li class="seat-slot-${i + 2}" data-seat="cpu-${i + 1}">Computer ${i + 1} — ${CHIP_ICON}${formatChips(BUY_IN)} chips</li>`,
  ).join("");
  const seatsHtml = `<li class="seat-slot-1" data-seat="you">You — ${CHIP_ICON}${formatChips(stack)} chips</li>${computerSeats}`;
  return `
    <div data-seated-table>
      ${renderTableOval(`<ul data-seats>${seatsHtml}</ul>`, `<p data-blinds>Blinds: 1/2 play-money.</p>`)}
      <p><button type="button" id="leave">Leave table</button></p>
    </div>
  `;
}

function renderDealControl(): string {
  return `<p><button type="button" id="deal" data-deal>Deal hand</button></p>`;
}

function renderHistoryToggle(open: boolean): string {
  return `<p><button type="button" id="history-toggle" data-history-toggle>${
    open ? "Hide hand history" : "View hand history"
  }</button></p>`;
}

const HISTORY_RESULT_LABELS: Record<HandHistoryEntry["result"], string> = {
  won: "Won",
  lost: "Lost",
  split: "Split",
};

function renderHistory(history: HandHistoryEntry[] | undefined): string {
  if (history === undefined) {
    return `<p class="status" data-state="pending" data-history>Loading history…</p>`;
  }
  if (history.length === 0) {
    return `<p data-history>No hands played yet.</p>`;
  }
  const rows = history
    .map((entry) => {
      const board = entry.board.length ? entry.board.join(" ") : "—";
      const sign = entry.delta > 0 ? "+" : "";
      return `<li data-history-row>
        <span data-history-time>${escapeHtml(entry.playedAt)}</span>
        — blinds ${escapeHtml(String(entry.smallBlind))}/${escapeHtml(String(entry.bigBlind))},
        hole cards ${escapeHtml(entry.holeCards.join(" "))}, board ${escapeHtml(board)}:
        <strong data-history-result>${HISTORY_RESULT_LABELS[entry.result]}</strong>
        (${sign}${escapeHtml(formatChips(entry.delta))})
      </li>`;
    })
    .join("");
  return `
    <div data-history>
      <ul data-history-list>${rows}</ul>
    </div>
  `;
}

function renderHand(hand: HandView, tab: number): string {
  const seatsHtml = hand.seats
    .map((seat) => {
      const label = seat.kind === "human" ? "You" : `Computer ${seat.index}`;
      // Poker-table markers (feature 016): small styled badges, not bare
      // "(D/SB/BB)" text.
      const markers = [
        seat.index === hand.button
          ? '<span class="marker-badge marker-button" title="Dealer">D</span>'
          : "",
        seat.index === hand.smallBlindSeat
          ? '<span class="marker-badge marker-sb" title="Small blind">SB</span>'
          : "",
        seat.index === hand.bigBlindSeat
          ? '<span class="marker-badge marker-bb" title="Big blind">BB</span>'
          : "",
      ].join("");
      const status = seat.folded ? " — folded" : seat.allIn ? " — all-in" : "";
      const seatKey = seat.kind === "human" ? "you" : `cpu-${seat.index}`;
      const acting = seat.index === hand.actingSeat && !hand.result ? " data-acting" : "";
      // The human's own hole cards render separately (data-hole-cards,
      // below); a computer seat shows its hole cards face-down until it's
      // revealed at showdown (result.revealed), never before.
      const revealedEntry = hand.result?.revealed?.find((r) => r.seat === seat.index);
      const seatCards =
        seat.kind === "human"
          ? ""
          : ` ${revealedEntry ? renderCards(revealedEntry.cards) : renderHiddenCards(2)}`;
      // Seat 0 (human) always sits at the bottom of the oval, seats 1-5
      // fill the remaining slots going around — array position already
      // equals seat index (server always emits seats 0..5 in order).
      const slot = seat.index + 1;
      return `<li class="seat-slot-${slot}" data-seat="${seatKey}"${acting}>${markers}${escapeHtml(label)} — ${CHIP_ICON}${formatChips(seat.stack)} chips${escapeHtml(status)} (bet ${CHIP_ICON}${formatChips(seat.streetContribution)})${seatCards}</li>`;
    })
    .join("");
  const boardCards = hand.board.length ? renderCards(hand.board) : "—";
  const isHumanTurn = hand.actingSeat === 0 && hand.legalActions.length > 0;
  const actionArea = hand.result
    ? renderSettlement(hand.result, hand.seats[0].stack, tab)
    : isHumanTurn
      ? renderActionControls(hand)
      : `<p class="status" data-state="pending">${hand.roundComplete ? "Betting round complete." : "Waiting for other players…"}</p>`;
  const turnText = hand.result
    ? "Hand settled."
    : hand.actingSeat === null
      ? "Waiting…"
      : `Turn: ${escapeHtml(seatLabel(hand.actingSeat))}`;
  const centerHtml = `
    <p data-pot>Pot: ${CHIP_ICON}${formatChips(hand.pot)} chips.</p>
    <p data-board>Board: ${boardCards}</p>
  `;
  return `
    <div data-hand>
      <p data-street>Street: ${escapeHtml(hand.street)}</p>
      <p data-turn>${turnText}</p>
      <p data-hole-cards>Your cards: ${renderCards(hand.holeCards)}</p>
      ${renderTableOval(`<ul data-seats>${seatsHtml}</ul>`, centerHtml)}
      ${actionArea}
      ${renderActionLog(hand.actionLog)}
      <p><button type="button" id="leave">Leave table</button></p>
    </div>
  `;
}

function seatLabel(seat: number): string {
  return seat === 0 ? "You" : `Computer ${seat}`;
}

const ACTION_LABELS: Record<string, string> = {
  fold: "folded",
  check: "checked",
  call: "called",
  bet: "bet",
  raise: "raised to",
  "all-in": "went all-in",
};

function renderActionLog(log: ActionLogEntry[]): string {
  if (log.length === 0) {
    return "";
  }
  // Most recent first, capped for readability — the full hand's log is
  // kept server-side, but a scannable "recent actions" list doesn't need
  // every action from every street on screen at once.
  const recent = log.slice(-8).reverse();
  const items = recent
    .map((entry) => {
      const verb = ACTION_LABELS[entry.action] ?? entry.action;
      const amount = entry.amount !== undefined ? ` ${formatChips(entry.amount)}` : "";
      return `<li>${escapeHtml(seatLabel(entry.seat))} ${escapeHtml(verb)}${escapeHtml(amount)} <span data-street-tag>(${escapeHtml(entry.street)})</span></li>`;
    })
    .join("");
  return `
    <div data-action-log>
      <p>Recent actions:</p>
      <ul>${items}</ul>
    </div>
  `;
}

function renderSettlement(result: SettlementResult, humanStack: number, tab: number): string {
  const winnersText = result.winners
    .map((w) => `${escapeHtml(seatLabel(w.seat))} +${formatChips(w.delta)}`)
    .join(", ");
  const headline =
    result.reason === "fold"
      ? `${winnersText} (everyone else folded).`
      : `Showdown — ${winnersText}.`;
  const revealed = result.revealed?.length
    ? `<ul data-revealed>${result.revealed
        .map(
          (r) =>
            `<li>${escapeHtml(seatLabel(r.seat))}: ${renderCards(r.cards)} (${escapeHtml(r.category)})</li>`,
        )
        .join("")}</ul>`
    : "";
  // The next hand deals itself automatically a few seconds after
  // settlement (feature 010) — the button below is an optional way to
  // skip the wait, not a requirement to continue. A player with no table
  // stack left can't be dealt into another hand until they rebuy (needs
  // 200+ on the tab) or, if the tab can't cover that, top up first
  // (feature 011); leaving remains available throughout.
  const nextHand =
    humanStack > 0
      ? `<p class="status" data-state="pending" data-next-hand>Next hand starting…</p>
         <p><button type="button" id="deal" data-deal>Deal next hand now</button></p>`
      : tab >= BUY_IN
        ? `<p class="status" data-state="error" data-felted>You're out of chips at the table.</p>
           <p><button type="button" id="rebuy" data-rebuy>Rebuy ${formatChips(BUY_IN)} chips</button></p>`
        : `<p class="status" data-state="error" data-felted>You're out of chips at the table, and your tab can't cover a rebuy.</p>
           <p><button type="button" id="topup" data-topup>Top up ${formatChips(TOP_UP_AMOUNT)} play-money chips</button></p>`;
  return `
    <div data-settlement>
      <p data-result>${escapeHtml(headline)}</p>
      ${revealed}
      ${nextHand}
    </div>
  `;
}

function renderActionControls(hand: HandView): string {
  const buttons: string[] = [];
  if (hand.legalActions.includes("fold")) {
    buttons.push(
      `<button type="button" data-action="fold">Fold</button>`,
    );
  }
  if (hand.legalActions.includes("check")) {
    buttons.push(
      `<button type="button" data-action="check">Check</button>`,
    );
  }
  if (hand.legalActions.includes("call")) {
    buttons.push(
      `<button type="button" data-action="call">Call ${formatChips(hand.toCall)}</button>`,
    );
  }
  if (hand.legalActions.includes("all-in")) {
    buttons.push(
      `<button type="button" data-action="all-in">All-in</button>`,
    );
  }
  let raiseControl = "";
  if (hand.legalActions.includes("bet")) {
    raiseControl = `
      <label>Bet <input type="number" id="raise-amount" min="${hand.minRaiseSize}" value="${hand.minRaiseSize}" /></label>
      <button type="button" data-action="bet">Bet</button>
    `;
  } else if (hand.legalActions.includes("raise")) {
    const minTo = hand.currentBet + hand.minRaiseSize;
    raiseControl = `
      <label>Raise to <input type="number" id="raise-amount" min="${minTo}" value="${minTo}" /></label>
      <button type="button" data-action="raise">Raise</button>
    `;
  }
  return `<div data-actions>${buttons.join(" ")}${raiseControl}</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Card artwork (feature 015): filenames in card-svgs/ are RANK + uppercase
// SUIT (e.g. "AS.svg", "TH.svg"), matching a card code's rank as-is with
// its suit uppercased. Vite serves that directory at the site root (see
// vite.config.ts), so "As" -> "/AS.svg".
function cardImageSrc(card: string): string {
  const rank = card[0] ?? "";
  const suit = (card[1] ?? "").toUpperCase();
  return `/${rank}${suit}.svg`;
}

function cardImg(card: string): string {
  return `<img class="card-img" src="${cardImageSrc(card)}" alt="${escapeHtml(card)}" loading="lazy">`;
}

function cardBackImg(): string {
  return `<img class="card-img card-back" src="/1B.svg" alt="Hidden card" loading="lazy">`;
}

function renderCards(cards: string[]): string {
  return `<span class="cards">${cards.map(cardImg).join("")}</span>`;
}

function renderHiddenCards(count: number): string {
  return `<span class="cards">${Array.from({ length: count }, cardBackImg).join("")}</span>`;
}

// Oval poker table (feature 016): seats are positioned around the oval by
// CSS alone (.seat-slot-1..6, set on each <li> by both renderTable and
// renderHand), keyed off the seat's own index — this helper just supplies
// the shared felt/center wrapper both call sites need. Each call site
// still writes its own <ul data-seats> (rather than this helper doing it)
// so that literal marker stays part of each caller's own source text.
function renderTableOval(seatsListHtml: string, centerHtml: string): string {
  return `
    <div class="table-oval">
      <div class="table-center">${centerHtml}</div>
      ${seatsListHtml}
    </div>
  `;
}

function formFields(form: HTMLFormElement): {
  username: string;
  password: string;
} {
  const data = new FormData(form);
  return {
    username: String(data.get("username") ?? ""),
    password: String(data.get("password") ?? ""),
  };
}

async function onRegister(form: HTMLFormElement): Promise<void> {
  const { username, password } = formFields(form);
  const response = await api("/api/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    view = { kind: "guest", authView: "register", error: await readError(response) };
    render();
    return;
  }
  const body: unknown = await response.json();
  const session = parseSession(body) ?? (await loadSession());
  if (!session) {
    view = { kind: "guest", authView: "register", error: "Something went wrong." };
    render();
    return;
  }
  // A valid registration signs the user straight in (no separate
  // "registered, now log in" step) — the simpler of the two options AC4
  // allows, and consistent with feature 002's original auth flow.
  view = {
    kind: "signed-in",
    username: session.username,
    tab: session.tab,
    seated: session.seated,
    stack: session.stack,
    hand: session.seated ? await fetchCurrentHand() : undefined,
    error: "",
    historyOpen: false,
    history: undefined,
  };
  render();
}

async function onLogin(form: HTMLFormElement): Promise<void> {
  const { username, password } = formFields(form);
  const response = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    view = { kind: "guest", authView: "login", error: await readError(response) };
    render();
    return;
  }
  const body: unknown = await response.json();
  const session = parseSession(body) ?? (await loadSession());
  if (!session) {
    view = { kind: "guest", authView: "login", error: "Something went wrong." };
    render();
    return;
  }
  view = {
    kind: "signed-in",
    username: session.username,
    tab: session.tab,
    seated: session.seated,
    stack: session.stack,
    hand: session.seated ? await fetchCurrentHand() : undefined,
    error: "",
    historyOpen: false,
    history: undefined,
  };
  render();
}

async function onLogout(): Promise<void> {
  clearAutoDeal();
  await api("/api/logout", { method: "POST", body: "{}" });
  view = { kind: "guest", authView: "login", error: "" };
  render();
}

async function onSit(): Promise<void> {
  if (view.kind !== "signed-in") {
    return;
  }
  const response = await api("/api/sit", { method: "POST", body: "{}" });
  if (!response.ok) {
    view = { ...view, error: await readError(response) };
    render();
    return;
  }
  const session = parseSession(await response.json());
  if (!session) {
    view = { ...view, error: "Something went wrong." };
    render();
    return;
  }
  view = {
    kind: "signed-in",
    ...session,
    hand: undefined,
    error: "",
    historyOpen: view.historyOpen,
    history: view.history,
  };
  render();
}

async function onLeave(): Promise<void> {
  if (view.kind !== "signed-in") {
    return;
  }
  clearAutoDeal();
  const response = await api("/api/leave", { method: "POST", body: "{}" });
  if (!response.ok) {
    view = { ...view, error: await readError(response) };
    render();
    return;
  }
  const session = parseSession(await response.json());
  if (!session) {
    view = { ...view, error: "Something went wrong." };
    render();
    return;
  }
  view = {
    kind: "signed-in",
    ...session,
    hand: undefined,
    error: "",
    historyOpen: view.historyOpen,
    history: view.history,
  };
  render();
}

async function onDeal(): Promise<void> {
  if (view.kind !== "signed-in") {
    return;
  }
  const response = await api("/api/hand/start", { method: "POST", body: "{}" });
  if (!response.ok) {
    view = { ...view, error: await readError(response) };
    render();
    return;
  }
  const hand = parseHandView(await response.json());
  if (!hand) {
    view = { ...view, error: "Something went wrong." };
    render();
    return;
  }
  view = { ...view, hand, error: "" };
  render();
}

async function onRebuy(): Promise<void> {
  if (view.kind !== "signed-in") {
    return;
  }
  const response = await api("/api/table/rebuy", { method: "POST", body: "{}" });
  if (!response.ok) {
    view = { ...view, error: await readError(response) };
    render();
    return;
  }
  const session = parseSession(await response.json());
  if (!session) {
    view = { ...view, error: "Something went wrong." };
    render();
    return;
  }
  // Back to a fresh 200-chip stack with no hand in progress — same
  // post-state as a brand new sit.
  view = {
    kind: "signed-in",
    ...session,
    hand: undefined,
    error: "",
    historyOpen: view.historyOpen,
    history: view.history,
  };
  render();
}

async function onTopUp(): Promise<void> {
  if (view.kind !== "signed-in") {
    return;
  }
  const response = await api("/api/tab/topup", { method: "POST", body: "{}" });
  if (!response.ok) {
    view = { ...view, error: await readError(response) };
    render();
    return;
  }
  const session = parseSession(await response.json());
  if (!session) {
    view = { ...view, error: "Something went wrong." };
    render();
    return;
  }
  // Top-up only raises the tab — still felted at the table until an
  // explicit rebuy, so the settled-hand/felted view stays as-is.
  view = { ...view, tab: session.tab, error: "" };
  render();
}

async function onAction(action: Action, amount: number | undefined): Promise<void> {
  if (view.kind !== "signed-in") {
    return;
  }
  const response = await api("/api/hand/action", {
    method: "POST",
    body: JSON.stringify(amount === undefined ? { action } : { action, amount }),
  });
  if (!response.ok) {
    view = { ...view, error: await readError(response) };
    render();
    return;
  }
  const hand = parseHandView(await response.json());
  if (!hand) {
    view = { ...view, error: "Something went wrong." };
    render();
    return;
  }
  view = { ...view, hand, error: "" };
  render();
}

async function onToggleHistory(): Promise<void> {
  if (view.kind !== "signed-in") {
    return;
  }
  if (view.historyOpen) {
    view = { ...view, historyOpen: false };
    render();
    return;
  }
  // Fetch fresh every time it's opened, not just the first time — new
  // hands settled since the last open should show up (feature 012, AC2).
  view = { ...view, historyOpen: true, history: undefined };
  render();
  const history = await fetchHandHistory();
  if (view.kind !== "signed-in" || !view.historyOpen) {
    return; // the user navigated away (logged out, closed it) before this resolved
  }
  view = { ...view, history: history ?? [] };
  render();
}

// The dashboard (feature 018) shows hand history automatically — no
// toggle click needed — so it needs its own fetch-on-first-render,
// distinct from onToggleHistory's fetch-on-open (still used while
// seated). Same "did the user navigate away before this resolved" guard.
async function loadDashboardHistory(): Promise<void> {
  if (view.kind !== "signed-in" || view.seated) {
    return;
  }
  const history = await fetchHandHistory();
  if (view.kind !== "signed-in" || view.seated) {
    return;
  }
  view = { ...view, history: history ?? [] };
  render();
}

render();

try {
  const session = await loadSession();
  view = session
    ? {
        kind: "signed-in",
        ...session,
        hand: session.seated ? await fetchCurrentHand() : undefined,
        error: "",
        historyOpen: false,
        history: undefined,
      }
    : { kind: "guest", authView: "login", error: "" };
} catch {
  view = { kind: "guest", authView: "login", error: "API unreachable. Is npm run dev running?" };
}
render();
