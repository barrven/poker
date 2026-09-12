---
id: 001
title: App scaffold
status: backlog
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

_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
