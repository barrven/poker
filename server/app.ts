import http from "node:http";
import type { DatabaseSync } from "node:sqlite";
import {
  clearSessionCookieHeader,
  consumePasswordCheck,
  createSession,
  createUser,
  deleteSession,
  findUserByUsername,
  isUniqueConstraint,
  sessionCookieHeader,
  sessionTokenFromRequest,
  userForToken,
  verifyPassword,
} from "./auth.js";
import { pingDb } from "./db.js";

const JSON_HEADERS = { "Content-Type": "application/json" };
const MAX_BODY = 8192;

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  extraHeaders?: http.OutgoingHttpHeaders,
): void {
  res.writeHead(status, { ...JSON_HEADERS, ...extraHeaders });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseJsonObject(raw: string): Record<string, unknown> | undefined {
  if (!raw) {
    return {};
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    return value as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function normalizeUsername(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const username = value.trim();
  if (username.length < 1 || username.length > 32) {
    return undefined;
  }
  return username;
}

function readPassword(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  if (value.length < 1 || value.length > 200) {
    return undefined;
  }
  return value;
}

function currentUser(
  db: DatabaseSync,
  req: http.IncomingMessage,
): ReturnType<typeof userForToken> {
  const token = sessionTokenFromRequest(req.headers.cookie);
  return userForToken(db, token);
}

function userPayload(user: { username: string; tab: number }): {
  username: string;
  tab: number;
} {
  return { username: user.username, tab: user.tab };
}

export function createApp(db: DatabaseSync): http.Server {
  return http.createServer((req, res) => {
    void handle(db, req, res).catch(() => {
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal error" });
      }
    });
  });
}

async function handle(
  db: DatabaseSync,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const url = req.url ?? "/";
  const pathOnly = url.split("?")[0] ?? "/";
  const method = req.method ?? "GET";

  if (method === "GET" && pathOnly === "/api/health") {
    const dbOk = pingDb(db);
    sendJson(res, dbOk ? 200 : 503, { ok: dbOk, db: dbOk ? "ok" : "error" });
    return;
  }

  if (method === "POST" && pathOnly === "/api/register") {
    const body = parseJsonObject(await readBody(req));
    if (!body) {
      sendJson(res, 400, { error: "Invalid request" });
      return;
    }
    const username = normalizeUsername(body.username);
    const password = readPassword(body.password);
    if (!username || !password) {
      sendJson(res, 400, { error: "Username and password are required" });
      return;
    }
    try {
      const user = createUser(db, username, password);
      const token = createSession(db, user.id);
      sendJson(
        res,
        201,
        userPayload(user),
        { "Set-Cookie": sessionCookieHeader(token) },
      );
    } catch (error) {
      if (isUniqueConstraint(error)) {
        sendJson(res, 409, { error: "That username is taken." });
        return;
      }
      throw error;
    }
    return;
  }

  if (method === "POST" && pathOnly === "/api/login") {
    const body = parseJsonObject(await readBody(req));
    if (!body) {
      sendJson(res, 400, { error: "Invalid request" });
      return;
    }
    const username = normalizeUsername(body.username);
    const password = readPassword(body.password);
    if (!username || !password) {
      sendJson(res, 400, { error: "Invalid username or password" });
      return;
    }
    const user = findUserByUsername(db, username);
    const ok = user
      ? verifyPassword(password, user.password_hash)
      : (consumePasswordCheck(password), false);
    if (!ok || !user) {
      sendJson(res, 401, { error: "Invalid username or password" });
      return;
    }
    const token = createSession(db, user.id);
    sendJson(
      res,
      200,
      userPayload(user),
      { "Set-Cookie": sessionCookieHeader(token) },
    );
    return;
  }

  if (method === "POST" && pathOnly === "/api/logout") {
    const token = sessionTokenFromRequest(req.headers.cookie);
    if (token) {
      deleteSession(db, token);
    }
    sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookieHeader() });
    return;
  }

  if (method === "GET" && pathOnly === "/api/me") {
    const user = currentUser(db, req);
    if (!user) {
      sendJson(res, 401, { error: "Not logged in" });
      return;
    }
    sendJson(res, 200, userPayload(user));
    return;
  }

  if (method === "POST" && pathOnly === "/api/sit") {
    const user = currentUser(db, req);
    if (!user) {
      sendJson(res, 401, { error: "Authentication required" });
      return;
    }
    sendJson(res, 404, { error: "not found" });
    return;
  }

  sendJson(res, 404, { error: "not found" });
}
