import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("missing #app");
}

app.innerHTML = `
  <h1>Poker</h1>
  <p>No-Limit Texas Hold'em vs computer. Play-money chips.</p>
  <p class="status" data-state="pending">Checking API…</p>
`;

const status = app.querySelector<HTMLParagraphElement>(".status");
if (!status) {
  throw new Error("missing .status");
}

try {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error(`health ${response.status}`);
  }
  const body: unknown = await response.json();
  const ok =
    typeof body === "object" &&
    body !== null &&
    "ok" in body &&
    body.ok === true &&
    "db" in body &&
    body.db === "ok";
  if (!ok) {
    throw new Error("health payload");
  }
  status.dataset.state = "ok";
  status.textContent = "API and SQLite are up.";
} catch {
  status.dataset.state = "error";
  status.textContent = "API unreachable. Is npm run dev running?";
}
