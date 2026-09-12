import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { createApp } from "../server/app.js";
import { openDb } from "../server/db.js";
import type { DatabaseSync } from "node:sqlite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDirs: string[] = [];

after(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tmpDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "poker-auth-"));
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
  const raw =
    setCookie[0] ?? response.headers.get("set-cookie") ?? undefined;
  const token = raw?.match(/poker_session=([^;]*)/)?.[1];
  const cookie =
    token !== undefined && token !== ""
      ? `poker_session=${token}`
      : undefined;
  return { status: response.status, body, cookie };
}

function errorMessage(body: unknown): string {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    assert.fail(`expected error object, got ${JSON.stringify(body)}`);
  }
  const message = (body as { error: unknown }).error;
  assert.equal(typeof message, "string");
  return message as string;
}

test("register creates an account and a session", async () => {
  const app = await startApp();
  try {
    const registered = await json(app.base, "/api/register", {
      method: "POST",
      body: JSON.stringify({ username: "alice", password: "secret" }),
    });
    assert.equal(registered.status, 201);
    assert.deepEqual(registered.body, { username: "alice" });
    assert.ok(registered.cookie);

    const me = await json(app.base, "/api/me", {
      headers: { cookie: registered.cookie },
    });
    assert.equal(me.status, 200);
    assert.deepEqual(me.body, { username: "alice" });
  } finally {
    await app.close();
  }
});

test("duplicate username is rejected and does not create a second account", async () => {
  const app = await startApp();
  try {
    await json(app.base, "/api/register", {
      method: "POST",
      body: JSON.stringify({ username: "alice", password: "secret" }),
    });
    const dup = await json(app.base, "/api/register", {
      method: "POST",
      body: JSON.stringify({ username: "alice", password: "other" }),
    });
    assert.equal(dup.status, 409);
    assert.match(errorMessage(dup.body), /taken/i);
    const count = app.db.prepare("SELECT COUNT(*) AS n FROM users").get() as {
      n: number;
    };
    assert.equal(count.n, 1);
  } finally {
    await app.close();
  }
});

test("password is stored hashed, not plaintext or a single SHA", async () => {
  const app = await startApp();
  try {
    const password = "secret-pass";
    await json(app.base, "/api/register", {
      method: "POST",
      body: JSON.stringify({ username: "alice", password }),
    });
    const row = app.db
      .prepare("SELECT username, password_hash FROM users WHERE username = ?")
      .get("alice") as { username: string; password_hash: string };
    assert.equal(row.username, "alice");
    assert.notEqual(row.password_hash, password);
    assert.equal(row.password_hash.includes(password), false);
    assert.match(row.password_hash, /^scrypt:/);
    assert.doesNotMatch(row.password_hash, /^(sha1|sha256|sha512|md5):/i);
    assert.doesNotMatch(row.password_hash, /^[0-9a-f]{40}$/i);
    assert.doesNotMatch(row.password_hash, /^[0-9a-f]{64}$/i);
  } finally {
    await app.close();
  }
});

test("login starts a session; failures are generic", async () => {
  const app = await startApp();
  try {
    await json(app.base, "/api/register", {
      method: "POST",
      body: JSON.stringify({ username: "alice", password: "secret" }),
    });

    const wrong = await json(app.base, "/api/login", {
      method: "POST",
      body: JSON.stringify({ username: "alice", password: "nope" }),
    });
    const unknown = await json(app.base, "/api/login", {
      method: "POST",
      body: JSON.stringify({ username: "bob", password: "secret" }),
    });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(errorMessage(wrong.body), errorMessage(unknown.body));
    assert.match(errorMessage(wrong.body), /invalid username or password/i);
    assert.doesNotMatch(errorMessage(wrong.body), /unknown|not found|no such/i);

    const ok = await json(app.base, "/api/login", {
      method: "POST",
      body: JSON.stringify({ username: "alice", password: "secret" }),
    });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body, { username: "alice" });
    assert.ok(ok.cookie);
    const me = await json(app.base, "/api/me", {
      headers: { cookie: ok.cookie },
    });
    assert.equal(me.status, 200);
    assert.deepEqual(me.body, { username: "alice" });
  } finally {
    await app.close();
  }
});

test("logout ends the session", async () => {
  const app = await startApp();
  try {
    const registered = await json(app.base, "/api/register", {
      method: "POST",
      body: JSON.stringify({ username: "alice", password: "secret" }),
    });
    assert.ok(registered.cookie);
    const loggedOut = await json(app.base, "/api/logout", {
      method: "POST",
      body: "{}",
      headers: { cookie: registered.cookie },
    });
    assert.equal(loggedOut.status, 200);
    const me = await json(app.base, "/api/me", {
      headers: { cookie: registered.cookie },
    });
    assert.equal(me.status, 401);
  } finally {
    await app.close();
  }
});

test("session cookie still authenticates after a later request (refresh)", async () => {
  const app = await startApp();
  try {
    const registered = await json(app.base, "/api/register", {
      method: "POST",
      body: JSON.stringify({ username: "alice", password: "secret" }),
    });
    assert.ok(registered.cookie);
    const first = await json(app.base, "/api/me", {
      headers: { cookie: registered.cookie },
    });
    const second = await json(app.base, "/api/me", {
      headers: { cookie: registered.cookie },
    });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.deepEqual(second.body, { username: "alice" });
  } finally {
    await app.close();
  }
});

test("logged-out visitor cannot sit", async () => {
  const app = await startApp();
  try {
    const sit = await json(app.base, "/api/sit", {
      method: "POST",
      body: "{}",
    });
    assert.equal(sit.status, 401);
    assert.match(errorMessage(sit.body), /auth/i);
  } finally {
    await app.close();
  }

  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  assert.match(main, /id="register-form"/);
  assert.match(main, /id="login-form"/);
  assert.doesNotMatch(main, /<button[^>]*(id="sit"|data-sit)/i);
  assert.doesNotMatch(main, />Sit(\s+down)?</i);
});

test("no email, OAuth, or social-login path", () => {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  const appSrc = fs.readFileSync(path.join(root, "server/app.ts"), "utf8");
  const combined = `${main}\n${appSrc}`;
  assert.doesNotMatch(combined, /oauth|google|github|facebook|openid/i);
  assert.doesNotMatch(combined, /type="email"|password reset|magic link/i);
  assert.match(main, /name="username"/);
  assert.match(main, /type="password"/);
});
