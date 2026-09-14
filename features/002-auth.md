---
id: 002
title: Register, log in, and log out
status: done
priority: high
iteration: 1
---

## Description

A player can create an account with a username and password, log in, and
log out. The session survives a page refresh. A logged-out visitor
cannot sit at a table.

## Acceptance Criteria

- [x] A visitor can register with a username and password and is then
      logged in.
- [x] Registering with a username that already exists is rejected with
      an error the user can see; no second account is created.
- [x] The password is stored hashed in SQLite (not plaintext, not a
      single SHA). A SQLite inspect of the users table does not reveal
      the original password.
- [x] Logging in with the correct username and password starts a
      session; wrong password or unknown username is rejected without
      leaking which field was wrong beyond a generic failure.
- [x] Logging out ends the session; a subsequent request is treated as
      logged out.
- [x] Reloading the frontend while logged in still shows the player as
      logged in (session cookie or equivalent survives refresh).
- [x] A logged-out visitor has no control that sits them at a table
      (sit is hidden or rejected with an auth error).
- [x] No email, OAuth, or social-login path is presented.

## Implementation Notes

HTTP cookie session (`poker_session`, HttpOnly, SameSite=Lax). Passwords
hashed with Node `scrypt` (`scrypt:salt:hash` in SQLite), not SHA.
`POST /api/register|login|logout`, `GET /api/me`. Duplicate username
returns 409 with a visible error. Failed login always "Invalid username
or password". Logged-out UI has no sit control; `POST /api/sit` is 401
without a session.

Files: `server/auth.ts`, `server/app.ts`, `server/db.ts` (users +
sessions, schema 2), `src/main.ts`, `src/style.css`. Scaffold test
updated for schema 2.

Tradeoff: no password-reset/email. Sit itself is still 004.

## Test Notes

`tests/auth.test.ts` via `npm test` (8 auth tests + 5 scaffold). All pass.

Covered: register returns a session (`GET /api/me`); duplicate username
409 and still one user row; stored hash is `scrypt:` and not the
plaintext or a hex SHA; login success vs generic 401 for wrong password
and unknown user (same message); logout then 401; cookie still works on
a later `/api/me`; `POST /api/sit` 401 when logged out and no sit button
in the guest markup; no email/OAuth/social path in UI or API.

Deliberately not: a real browser refresh (cookie reuse stands in);
timing-attack proofs; password-reset.

## Validation Notes

2026-09-12 — pass. Ready for `/accept`.

Project checks:
- lint: **gap** — still no lint script or config.
- typecheck: pass
- build: pass
- tests: pass (`npm test` — 13/13)

Live API on :3001 (existing `npm run dev`) with user `val002_1789227870`:
1. **Pass.** `POST /api/register` → 201 `{"username":"..."}` +
   `Set-Cookie: poker_session=...; HttpOnly; Path=/; SameSite=Lax`.
   `GET /api/me` with that cookie → 200 same username.
2. **Pass.** Second register → 409 `{"error":"That username is taken."}`
   (shown in guest UI via `.status[data-state=error]`). User count for
   that name remains 1.
3. **Pass.** SQLite `password_hash` is `scrypt:<salt>:<hash>`, does not
   contain the plaintext password.
4. **Pass.** Wrong password and unknown user both return
   `{"error":"Invalid username or password"}`.
5. **Pass.** `POST /api/logout` clears the cookie (`Max-Age=0`);
   subsequent `GET /api/me` → 401 `Not logged in`.
6. **Pass (no browser tool).** Cookie is HttpOnly with Max-Age 2592000;
   frontend `loadSession()` calls `GET /api/me` on load. Cookie reuse
   against `/api/me` succeeds. A real browser reload was not executed.
7. **Pass.** Guest markup is register/login only (no sit button).
   `POST /api/sit` without a session → 401 `Authentication required`.
8. **Pass.** Username+password forms only; no email/OAuth/social in
   `src/main.ts` or `server/app.ts`.

Vite :5173 served the Poker app shell (`#app`, `/src/main.ts`).

## Acceptance Log

2026-09-14 — user chose **Accept and continue**:
"Mark 002 done, then implement 003 Running tab next."
Decision: accepted; continue the slice.
