---
id: 001
title: App scaffold
status: done
priority: high
iteration: 1
---

## Description

A developer (or the player, locally) can start the poker app on their
machine: a Vite frontend in the browser and a Node HTTP API that opens a
local SQLite file. Nothing to play yet — the shell exists so later
features have a place to live.

## Acceptance Criteria

- [x] A documented local start command (or pair of commands) brings up
      the Vite app and the Node HTTP API without a cloud host or extra
      database server.
- [x] Visiting the frontend URL in a browser loads an app shell (not a
      blank error page).
- [x] The HTTP API responds successfully to a simple health or root
      request.
- [x] On first start, a local SQLite file is created and the API can
      open it.
- [x] The project is TypeScript on both the frontend (Vite) and the
      Node API, and a typecheck/build command succeeds.

## Implementation Notes

Vite vanilla-TS app shell on :5173; Node `http` API on :3001; SQLite via
Node 22 `node:sqlite` at `data/poker.sqlite`. `npm run dev` runs both
(`concurrently`); Vite proxies `/api`. `GET /api/health` pings the DB.

Files: `package.json`, `vite.config.ts`, `index.html`, `src/*`,
`server/index.ts`, `server/db.ts`, tsconfigs, `.gitignore`, `README.md`.

Tradeoff: `node:sqlite` is still experimental on Node 22 (startup
warning) but needs no native addon. No UI framework yet.

## Test Notes

`node:test` via `tsx --test` (`npm test`). Five tests, all passing.

Covered: SQLite file created on `openDb` and pingable; `GET /api/health`
returns 200 `{ok:true,db:ok}`; `index.html` + `src/main.ts` are a Poker
app shell (not an empty page); README documents `npm run dev` and local
ports with no hosted DB; `typecheck`/`build` scripts exist.

Deliberately not: a real browser hitting Vite; spawning `npm run dev`;
running `tsc` inside the test process (left to `/validate`).

## Validation Notes

2026-09-12 — pass. Ready for `/accept`.

Project checks:
- lint: **gap** — no lint script or config (not in this feature's criteria).
- typecheck: pass (`npm run typecheck`)
- build: pass (`npm run build` — `dist/client/` + `dist/server/`)
- tests: pass (`npm test` — 5/5)

Acceptance criteria:
1. **Pass.** README documents `npm run dev` (Vite + Node API via
   `concurrently`). No hosted DB. `dev:api` listened on :3001;
   Vite served the shell (this machine already had :5173 taken by
   `outlook-sim`, so Vite was checked on :5180 with the same config
   and `/api` proxy). `npm run dev` as a single process was not
   bound to :5173 here.
2. **Pass (no browser tool).** `GET /` HTML is `<title>Poker</title>`
   + `#app` + `/src/main.ts` (200). Not a blank error page. Live JS
   paint in a real browser was not executed.
3. **Pass.** `GET http://127.0.0.1:3001/api/health` → 200
   `{"ok":true,"db":"ok"}`. Same payload through the Vite `/api` proxy.
4. **Pass.** Moved existing `data/` aside, started the API, it created
   `data/poker.sqlite` with `meta.schema_version=1` and health still
   reported `db: ok`.
5. **Pass.** Frontend and API are `.ts`. `npm run typecheck` and
   `npm run build` succeeded.

Note: Node 22 prints `ExperimentalWarning` for `node:sqlite` on API
start. Does not fail health.

## Acceptance Log

2026-09-12 — user chose **Accept and continue (Recommended)**:
"Mark 001 done and start 002 Register, log in, and log out."
Decision: accepted; continue the slice.
