import "./style.css";

const appEl = document.querySelector<HTMLDivElement>("#app");
if (!appEl) {
  throw new Error("missing #app");
}
const app: HTMLDivElement = appEl;

type Session = { username: string };

type View =
  | { kind: "loading" }
  | { kind: "guest"; error: string }
  | { kind: "signed-in"; username: string; error: string };

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
  if (
    typeof body === "object" &&
    body !== null &&
    "username" in body &&
    typeof body.username === "string"
  ) {
    return { username: body.username };
  }
  return undefined;
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
    app.innerHTML = `
      <h1>Poker</h1>
      <p>No-Limit Texas Hold'em vs computer. Play-money chips.</p>
      <p>Logged in as <strong>${escapeHtml(view.username)}</strong>.</p>
      ${error}
      <p><button type="button" id="logout">Log out</button></p>
    `;
    app.querySelector("#logout")?.addEventListener("click", () => {
      void onLogout();
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
  const name =
    typeof body === "object" &&
    body !== null &&
    "username" in body &&
    typeof body.username === "string"
      ? body.username
      : username;
  view = { kind: "signed-in", username: name, error: "" };
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
  const name =
    typeof body === "object" &&
    body !== null &&
    "username" in body &&
    typeof body.username === "string"
      ? body.username
      : username;
  view = { kind: "signed-in", username: name, error: "" };
  render();
}

async function onLogout(): Promise<void> {
  await api("/api/logout", { method: "POST", body: "{}" });
  view = { kind: "guest", error: "" };
  render();
}

render();

try {
  const session = await loadSession();
  view = session
    ? { kind: "signed-in", username: session.username, error: "" }
    : { kind: "guest", error: "" };
} catch {
  view = { kind: "guest", error: "API unreachable. Is npm run dev running?" };
}
render();
