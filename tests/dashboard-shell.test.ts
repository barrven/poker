import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import type { DatabaseSync } from "node:sqlite";
import { createApp } from "../server/app.js";
import { openDb } from "../server/db.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDirs: string[] = [];

after(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function readMain(): string {
  return fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
}

function readCss(): string {
  return fs.readFileSync(path.join(root, "src/style.css"), "utf8");
}

function tmpDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-dashboard-"));
  tmpDirs.push(dir);
  return dir;
}

async function startApp(): Promise<{
  base: string;
  db: DatabaseSync;
  close: () => Promise<void>;
}> {
  const db = openDb(tmpDataDir());
  const server = createApp(db);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    db,
    close: async () => {
      server.close();
      await once(server, "close");
      db.close();
    },
  };
}

async function json(
  base: string,
  pathName: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown; cookie: string | undefined }> {
  const response = await fetch(`${base}${pathName}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // leave as text
  }
  const setCookie = response.headers.getSetCookie?.() ?? [];
  const raw = setCookie[0] ?? response.headers.get("set-cookie") ?? undefined;
  const token = raw?.match(/poker_session=([^;]*)/)?.[1];
  const cookie = token !== undefined && token !== "" ? `poker_session=${token}` : undefined;
  return { status: response.status, body, cookie };
}

async function register(base: string, username: string): Promise<{ cookie: string }> {
  const result = await json(base, "/api/register", {
    method: "POST",
    body: JSON.stringify({ username, password: "secret" }),
  });
  assert.equal(result.status, 201);
  assert.ok(result.cookie);
  return { cookie: result.cookie };
}

test("a top menu bar with profile, settings, and logout renders for every signed-in state", () => {
  const main = readMain();
  const topMenuBlock = main.match(/function renderTopMenu[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(topMenuBlock, "renderTopMenu function not found");
  assert.match(topMenuBlock, /data-topbar/);
  assert.match(topMenuBlock, /data-profile/);
  assert.match(topMenuBlock, /username/); // profile shows the logged-in username
  assert.match(topMenuBlock, /id="settings"/);
  assert.match(topMenuBlock, /data-settings/);
  assert.match(topMenuBlock, /id="logout"/);

  // Rendered unconditionally for the whole signed-in branch, not just
  // one sub-state (dashboard vs. table vs. hand-in-progress).
  const signedInBlock = main.match(
    /if \(view\.kind === "signed-in"\) \{[\s\S]*?\n {2}\}\n\n {2}const error = view\.error/,
  )?.[0];
  assert.ok(signedInBlock, "signed-in render branch not found");
  assert.match(signedInBlock, /renderTopMenu\(view\.username\)/);
});

test("logout from the top menu bar is the same session-ending handler as before, just relocated", () => {
  const main = readMain();
  assert.match(main, /#logout"\)\?\.addEventListener\("click", \(\) => \{\s*void onLogout\(\);/);
  const onLogoutBlock = main.match(/async function onLogout[\s\S]*?(?=\nasync function )/)?.[0];
  assert.ok(onLogoutBlock, "onLogout function not found");
  assert.match(onLogoutBlock, /\/api\/logout/);
});

test("settings is a real, visible, but disabled placeholder entry (no fake interactivity)", () => {
  const main = readMain();
  const topMenuBlock = main.match(/function renderTopMenu[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(topMenuBlock, "renderTopMenu function not found");
  assert.match(topMenuBlock, /id="settings"[^>]*disabled/);
  // No click handler pretending settings does something.
  assert.doesNotMatch(main, /#settings"\)\?\.addEventListener/);
});

test("the dashboard (default not-seated view) shows hand history outright, plus sit-down and add-chips actions", () => {
  const main = readMain();
  const dashboardBlock = main.match(/function renderDashboard[\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(dashboardBlock, "renderDashboard function not found");
  assert.match(dashboardBlock, /data-dashboard/);
  assert.match(dashboardBlock, /renderSitControl\(tab\)/);
  assert.match(dashboardBlock, /id="topup"/);
  assert.match(dashboardBlock, /data-topup/);
  assert.match(dashboardBlock, /renderHistory\(history\)/);
  // Not gated behind the toggle used while seated.
  assert.doesNotMatch(dashboardBlock, /renderHistoryToggle/);

  // render() picks renderDashboard specifically for the not-seated case.
  assert.match(main, /: renderDashboard\(view\.tab, view\.history\)/);
});

test("the dashboard's hand history loads itself automatically, not only on a toggle click", () => {
  const main = readMain();
  assert.match(main, /if \(!view\.seated && view\.history === undefined\) \{\s*void loadDashboardHistory\(\);/);
  const loaderBlock = main.match(/async function loadDashboardHistory[\s\S]*?(?=\nasync function |\nrender\(\);)/)?.[0];
  assert.ok(loaderBlock, "loadDashboardHistory function not found");
  assert.match(loaderBlock, /fetchHandHistory/);
  assert.match(loaderBlock, /view\.seated/); // bails if the user sat down before this resolved
});

test("while seated, the table/hand view still offers the pre-existing history toggle (unchanged behavior)", () => {
  const main = readMain();
  assert.match(main, /const seatedHistorySection = view\.seated/);
  assert.match(main, /renderHistoryToggle\(view\.historyOpen\)/);
});

test("the add-chips dashboard control reuses the existing top-up endpoint/handler, not a new one", () => {
  const main = readMain();
  // Same #topup id/handler as the pre-existing felted-recovery control
  // (feature 011) — only one is ever in the DOM at a time (seated vs.
  // not), so sharing the id and handler is intentional, not a clash.
  assert.match(main, /#topup"\)\?\.addEventListener\("click", \(\) => \{\s*void onTopUp\(\);/);
  const onTopUpBlock = main.match(/async function onTopUp[\s\S]*?(?=\nasync function )/)?.[0];
  assert.ok(onTopUpBlock, "onTopUp function not found");
  assert.match(onTopUpBlock, /\/api\/tab\/topup/);
});

test("the top menu bar and dashboard use flex-wrap so nothing is forced into horizontal scroll at phone width", () => {
  const css = readCss();
  const topbarBlock = css.match(/\[data-topbar\]\s*\{([^}]*)\}/)?.[1];
  const topnavBlock = css.match(/\[data-topnav\]\s*\{([^}]*)\}/)?.[1];
  assert.ok(topbarBlock && topnavBlock, "[data-topbar]/[data-topnav] rules not found");
  assert.match(topbarBlock as string, /flex-wrap:\s*wrap/);
  assert.match(topnavBlock as string, /flex-wrap:\s*wrap/);
});

test("a fresh account can add chips before ever sitting down (usable without busting first)", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    const before = await json(app.base, "/api/me", { headers: { cookie: alice.cookie } });
    assert.equal((before.body as { seated: boolean }).seated, false);
    assert.equal((before.body as { tab: number }).tab, 1000);

    const toppedUp = await json(app.base, "/api/tab/topup", {
      method: "POST",
      body: "{}",
      headers: { cookie: alice.cookie },
    });
    assert.equal(toppedUp.status, 200);
    assert.equal((toppedUp.body as { tab: number }).tab, 2000);
    assert.equal((toppedUp.body as { seated: boolean }).seated, false);
  } finally {
    await app.close();
  }
});

test("hand history is fetchable (empty, not an error) for a brand new account with no hands yet", async () => {
  const app = await startApp();
  try {
    const alice = await register(app.base, "alice");
    const history = await json(app.base, "/api/history", { headers: { cookie: alice.cookie } });
    assert.equal(history.status, 200);
    assert.deepEqual(history.body, { hands: [] });
  } finally {
    await app.close();
  }
});

test("the tab balance display and hand-history rendering are unchanged by the redesign (AC7)", () => {
  const main = readMain();
  assert.match(main, /data-tab>Tab: <strong>\$\{escapeHtml\(formatChips\(view\.tab\)\)\}/);
  const historyBlock = main.match(/function renderHistory\([\s\S]*?(?=\nfunction )/)?.[0];
  assert.ok(historyBlock, "renderHistory function not found");
  assert.match(historyBlock, /data-history/);
  assert.match(historyBlock, /data-history-list/);
  assert.match(historyBlock, /data-history-result/);
});
