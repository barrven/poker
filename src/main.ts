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
const COMPUTER_SEATS = 5;

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
};

type View =
  | { kind: "loading" }
  | { kind: "guest"; error: string }
  | {
      kind: "signed-in";
      username: string;
      tab: number;
      seated: boolean;
      stack: number;
      hand: HandView | undefined;
      error: string;
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
    !Array.isArray(b.seats)
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
  };
}

async function fetchCurrentHand(): Promise<HandView | undefined> {
  const response = await api("/api/hand");
  if (!response.ok) {
    return undefined;
  }
  return parseHandView(await response.json());
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
    const error = view.error
      ? `<p class="status" data-state="error">${escapeHtml(view.error)}</p>`
      : "";
    const table = view.seated
      ? view.hand
        ? renderHand(view.hand)
        : `${renderDealControl()}${renderTable(view.stack)}`
      : renderSitControl(view.tab);
    app.innerHTML = `
      <h1>Poker</h1>
      <p>No-Limit Texas Hold'em vs computer. Play-money chips.</p>
      <p>Logged in as <strong>${escapeHtml(view.username)}</strong>.</p>
      <p data-tab>Tab: <strong>${escapeHtml(formatChips(view.tab))}</strong> play-money chips.</p>
      ${error}
      ${table}
      <p><button type="button" id="logout">Log out</button></p>
    `;
    app.querySelector("#logout")?.addEventListener("click", () => {
      void onLogout();
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
  app.innerHTML = `
    <h1>Poker</h1>
    <p>No-Limit Texas Hold'em vs computer. Play-money chips.</p>
    ${error}
    <form id="register-form">
      <h2>Register</h2>
      <label>Username <input name="username" autocomplete="username" maxlength="32" required /></label>
      <label>Password <input name="password" type="password" autocomplete="new-password" required /></label>
      <button type="submit">Register</button>
    </form>
    <form id="login-form">
      <h2>Log in</h2>
      <label>Username <input name="username" autocomplete="username" maxlength="32" required /></label>
      <label>Password <input name="password" type="password" autocomplete="current-password" required /></label>
      <button type="submit">Log in</button>
    </form>
  `;
  app.querySelector("#register-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void onRegister(event.target as HTMLFormElement);
  });
  app.querySelector("#login-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void onLogin(event.target as HTMLFormElement);
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

function renderTable(stack: number): string {
  const computerSeats = Array.from(
    { length: COMPUTER_SEATS },
    (_, i) =>
      `<li data-seat="cpu-${i + 1}">Computer ${i + 1} — ${formatChips(BUY_IN)} chips</li>`,
  ).join("");
  return `
    <div data-seated-table>
      <p data-blinds>Blinds: 1/2 play-money.</p>
      <ul data-seats>
        <li data-seat="you">You — ${formatChips(stack)} chips</li>
        ${computerSeats}
      </ul>
      <p><button type="button" id="leave">Leave table</button></p>
    </div>
  `;
}

function renderDealControl(): string {
  return `<p><button type="button" id="deal" data-deal>Deal hand</button></p>`;
}

function renderHand(hand: HandView): string {
  const seatsHtml = hand.seats
    .map((seat) => {
      const label = seat.kind === "human" ? "You" : `Computer ${seat.index}`;
      const markers = [
        seat.index === hand.button ? "D" : "",
        seat.index === hand.smallBlindSeat ? "SB" : "",
        seat.index === hand.bigBlindSeat ? "BB" : "",
      ]
        .filter(Boolean)
        .join("/");
      const tag = markers ? ` (${markers})` : "";
      const status = seat.folded ? " — folded" : seat.allIn ? " — all-in" : "";
      const seatKey = seat.kind === "human" ? "you" : `cpu-${seat.index}`;
      return `<li data-seat="${seatKey}">${escapeHtml(label)}${escapeHtml(tag)} — ${formatChips(seat.stack)} chips${escapeHtml(status)} (bet ${formatChips(seat.streetContribution)})</li>`;
    })
    .join("");
  const boardText = hand.board.length ? hand.board.join(" ") : "—";
  const isHumanTurn = hand.actingSeat === 0 && hand.legalActions.length > 0;
  const actionArea = hand.result
    ? renderSettlement(hand.result, hand.seats[0].stack)
    : isHumanTurn
      ? renderActionControls(hand)
      : `<p class="status" data-state="pending">${hand.roundComplete ? "Betting round complete." : "Waiting for other players…"}</p>`;
  return `
    <div data-hand>
      <p data-street>Street: ${escapeHtml(hand.street)}</p>
      <p data-pot>Pot: ${formatChips(hand.pot)} chips.</p>
      <p data-board>Board: ${escapeHtml(boardText)}</p>
      <p data-hole-cards>Your cards: ${escapeHtml(hand.holeCards.join(" "))}</p>
      <ul data-seats>${seatsHtml}</ul>
      ${actionArea}
      <p><button type="button" id="leave">Leave table</button></p>
    </div>
  `;
}

function seatLabel(seat: number): string {
  return seat === 0 ? "You" : `Computer ${seat}`;
}

function renderSettlement(result: SettlementResult, humanStack: number): string {
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
            `<li>${escapeHtml(seatLabel(r.seat))}: ${escapeHtml(r.cards.join(" "))} (${escapeHtml(r.category)})</li>`,
        )
        .join("")}</ul>`
    : "";
  // The next hand deals itself automatically a few seconds after
  // settlement (feature 010) — the button below is an optional way to
  // skip the wait, not a requirement to continue. A player with no table
  // stack left can't be dealt into another hand (rebuying is feature 011,
  // not shipped yet); they can still leave to settle their tab.
  const nextHand =
    humanStack > 0
      ? `<p class="status" data-state="pending" data-next-hand>Next hand starting…</p>
         <p><button type="button" id="deal" data-deal>Deal next hand now</button></p>`
      : `<p class="status" data-state="error" data-felted>You're out of chips at the table. Leave to settle your tab (rebuying is coming soon).</p>`;
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
    view = { kind: "guest", error: await readError(response) };
    render();
    return;
  }
  const body: unknown = await response.json();
  const session = parseSession(body) ?? (await loadSession());
  if (!session) {
    view = { kind: "guest", error: "Something went wrong." };
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
    view = { kind: "guest", error: await readError(response) };
    render();
    return;
  }
  const body: unknown = await response.json();
  const session = parseSession(body) ?? (await loadSession());
  if (!session) {
    view = { kind: "guest", error: "Something went wrong." };
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
  };
  render();
}

async function onLogout(): Promise<void> {
  clearAutoDeal();
  await api("/api/logout", { method: "POST", body: "{}" });
  view = { kind: "guest", error: "" };
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
  view = { kind: "signed-in", ...session, hand: undefined, error: "" };
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
  view = { kind: "signed-in", ...session, hand: undefined, error: "" };
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

render();

try {
  const session = await loadSession();
  view = session
    ? {
        kind: "signed-in",
        ...session,
        hand: session.seated ? await fetchCurrentHand() : undefined,
        error: "",
      }
    : { kind: "guest", error: "" };
} catch {
  view = { kind: "guest", error: "API unreachable. Is npm run dev running?" };
}
render();
