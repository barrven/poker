import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { STARTING_TAB } from "./db.js";

export const SESSION_COOKIE = "poker_session";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const HASH_LEN = 32;
const DUMMY_HASH = hashPassword("timing-dummy");

export type UserRow = { id: number; username: string; tab: number };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, HASH_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt" || !parts[1] || !parts[2]) {
    scryptSync(password, "dummy", HASH_LEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });
    return false;
  }
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[1], "base64");
    expected = Buffer.from(parts[2], "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) {
    return false;
  }
  const actual = scryptSync(password, salt, expected.length, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

export function consumePasswordCheck(password: string): void {
  verifyPassword(password, DUMMY_HASH);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function parseCookies(
  header: string | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) {
    return out;
  }
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) {
      continue;
    }
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) {
      out[key] = value;
    }
  }
  return out;
}

export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export function createUser(
  db: DatabaseSync,
  username: string,
  password: string,
): UserRow {
  const passwordHash = hashPassword(password);
  const result = db
    .prepare(
      "INSERT INTO users (username, password_hash, tab) VALUES (?, ?, ?)",
    )
    .run(username, passwordHash, STARTING_TAB);
  return { id: Number(result.lastInsertRowid), username, tab: STARTING_TAB };
}

export function findUserByUsername(
  db: DatabaseSync,
  username: string,
): { id: number; username: string; password_hash: string; tab: number } | undefined {
  const row = db
    .prepare(
      "SELECT id, username, password_hash, tab FROM users WHERE username = ?",
    )
    .get(username) as
    | { id: number; username: string; password_hash: string; tab: number }
    | undefined;
  if (!row) {
    return undefined;
  }
  return { ...row, tab: Number(row.tab) };
}

export function createSession(db: DatabaseSync, userId: number): string {
  const token = newSessionToken();
  db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(
    token,
    userId,
  );
  return token;
}

export function deleteSession(db: DatabaseSync, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function userForToken(
  db: DatabaseSync,
  token: string | undefined,
): UserRow | undefined {
  if (!token) {
    return undefined;
  }
  const row = db
    .prepare(
      `SELECT users.id AS id, users.username AS username, users.tab AS tab
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ?`,
    )
    .get(token) as UserRow | undefined;
  if (!row) {
    return undefined;
  }
  return { ...row, tab: Number(row.tab) };
}

export function sessionTokenFromRequest(
  cookieHeader: string | undefined,
): string | undefined {
  return parseCookies(cookieHeader)[SESSION_COOKIE];
}

export function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /UNIQUE/i.test(error.message);
}
