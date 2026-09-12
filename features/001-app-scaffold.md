---
id: 001
title: App scaffold
status: validating
priority: high
iteration: 1
---

## Description

A developer (or the player, locally) can start the poker app on their
machine: a Vite frontend in the browser and a Node HTTP API that opens a
local SQLite file. Nothing to play yet — the shell exists so later
features have a place to live.

## Acceptance Criteria

- [ ] A documented local start command (or pair of commands) brings up
      the Vite app and the Node HTTP API without a cloud host or extra
      database server.
- [ ] Visiting the frontend URL in a browser loads an app shell (not a
      blank error page).
- [ ] The HTTP API responds successfully to a simple health or root
      request.
- [ ] On first start, a local SQLite file is created and the API can
      open it.
- [ ] The project is TypeScript on both the frontend (Vite) and the
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

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
