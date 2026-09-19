---
id: 003
title: Running tab
status: done
priority: high
iteration: 1
---

## Description

Each account has a play-money running tab stored in SQLite. A new
account starts with 1,000 chips. The logged-in player can see their
current tab, and it is still there after a reload. There is no way to
turn it into real money.

## Acceptance Criteria

- [x] A newly registered account has a tab of 1,000 play-money chips,
      stored in SQLite.
- [x] While logged in, the player can see their current tab amount.
- [x] Reloading the app while logged in shows the same tab, not a reset
      or a missing value.
- [x] There is no deposit, withdrawal, cash-out, or real-currency
      conversion control.
- [x] Two different accounts have independent tabs.

## Implementation Notes

`users.tab INTEGER NOT NULL DEFAULT 1000` (schema 3). Register inserts
1,000. Existing DBs get `ALTER TABLE` so old rows start at 1,000.
`GET /api/me` and `POST /api/register|login` return `{ username, tab }`.
Signed-in UI shows `Tab: 1,000 play-money chips`; `loadSession()` on
reload. No deposit/withdraw/cash-out controls (top-up is 011). Sit/leave
still 004.

Files: `server/db.ts`, `server/auth.ts`, `server/app.ts`, `src/main.ts`.
Auth/scaffold tests updated for tab in `/api/me` and schema 3.

## Test Notes

`tests/tab.test.ts` via `npm test` (5 tab + 8 auth + 5 scaffold). All pass.

Covered: register stores `users.tab = 1000`; logged-in `GET /api/me`
returns that tab and the signed-in markup has `data-tab` /
`formatChips(view.tab)`; a later `/api/me` with the same cookie returns
a SQLite-updated tab (875), not a reset to 1000; UI/API have no
deposit/withdraw/cash-out path; two accounts stay independent when one
tab is changed.

Deliberately not: a real browser reload (cookie reuse stands in);
schema-2 `ALTER TABLE` of a hand-built old file; sit/leave/rebuy tab
changes (004/011).

## Validation Notes

2026-09-14 — pass. Ready for `/accept`.

Project checks:
- lint: **gap** — still no lint script or config.
- typecheck: pass
- build: pass (`dist/client` includes `data-tab` / `Tab:` / `play-money chips`)
- tests: pass (`npm test` — 18/18)

Existing :3001/:5173 were another process (this worktree has no
pre-existing `data/`; that API's register returned `{username}` only).
Validated this tree's API on :3010 and Vite on :5188 with users
`val003a_1789416223627` / `val003b_1789416223627`.

1. **Pass.** `POST /api/register` → 201
   `{"username":"...","tab":1000}` + session cookie. SQLite
   `users.tab` is INTEGER NOT NULL DEFAULT 1000; both new rows were
   1000. `meta.schema_version` is 3.
2. **Pass.** `GET /api/me` and `POST /api/login` return `tab: 1000`.
   Vite-served `/src/main.ts` has
   `<p data-tab>Tab: <strong>${escapeHtml(formatChips(view.tab))}</strong> play-money chips.</p>`.
   Guest markup is register/login only (no tab amount).
3. **Pass (no browser tool).** After `UPDATE users SET tab = 400` for
   account A, the same cookie `GET /api/me` → `tab: 400` (not a reset
   to 1000). Frontend `loadSession()` calls `/api/me` on load. A real
   browser reload was not executed.
4. **Pass.** Served `main.ts` and `server/app.ts` have no
   deposit/withdraw/cash-out path. Signed-in UI is username, tab, and
   log out.
5. **Pass.** Account A tab 400 and account B tab 1000 in SQLite and in
   each `/api/me`.

## Acceptance Log

2026-09-19 — Accepted. User selected "Accept and continue" in response to
the acceptance summary (all 5 acceptance criteria pass, project checks
pass except the pre-existing lint gap). Moving on to 004-sit-table.
