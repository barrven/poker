---
id: 002
title: Register, log in, and log out
status: testing
priority: high
iteration: 1
---

## Description

A player can create an account with a username and password, log in, and
log out. The session survives a page refresh. A logged-out visitor
cannot sit at a table.

## Acceptance Criteria

- [ ] A visitor can register with a username and password and is then
      logged in.
- [ ] Registering with a username that already exists is rejected with
      an error the user can see; no second account is created.
- [ ] The password is stored hashed in SQLite (not plaintext, not a
      single SHA). A SQLite inspect of the users table does not reveal
      the original password.
- [ ] Logging in with the correct username and password starts a
      session; wrong password or unknown username is rejected without
      leaking which field was wrong beyond a generic failure.
- [ ] Logging out ends the session; a subsequent request is treated as
      logged out.
- [ ] Reloading the frontend while logged in still shows the player as
      logged in (session cookie or equivalent survives refresh).
- [ ] A logged-out visitor has no control that sits them at a table
      (sit is hidden or rejected with an auth error).
- [ ] No email, OAuth, or social-login path is presented.

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

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
