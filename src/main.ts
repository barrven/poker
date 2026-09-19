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

type View =
  | { kind: "loading" }
  | { kind: "guest"; error: string }
  | {
      kind: "signed-in";
      username: string;
      tab: number;
      seated: boolean;
      stack: number;
      error: string;
    };

let view: View = { kind: "loading" };

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
    const error = view.error
      ? `<p class="status" data-state="error">${escapeHtml(view.error)}</p>`
      : "";
    const table = view.seated ? renderTable(view.stack) : renderSitControl(view.tab);
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
    error: "",
  };
  render();
}

async function onLogout(): Promise<void> {
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
  view = { kind: "signed-in", ...session, error: "" };
  render();
}

async function onLeave(): Promise<void> {
  if (view.kind !== "signed-in") {
    return;
  }
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
  view = { kind: "signed-in", ...session, error: "" };
  render();
}

render();

try {
  const session = await loadSession();
  view = session
    ? { kind: "signed-in", ...session, error: "" }
    : { kind: "guest", error: "" };
} catch {
  view = { kind: "guest", error: "API unreachable. Is npm run dev running?" };
}
render();
