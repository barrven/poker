---
id: 014
title: Lint tooling
status: backlog
priority: high
iteration: 2
---

## Description

The project has an `npm run lint` script (ESLint, matching the
TypeScript/Vite/Node stack) that catches real problems, alongside the
existing typecheck and build scripts. Every feature since 001 has
flagged the missing lint script as a gap; this closes it per the
Constraints added to `docs/SPEC.md` in the iteration-1 retro.

## Acceptance Criteria

- [ ] `npm run lint` exists and runs ESLint over `server/`, `src/`, and
      `tests/`.
- [ ] `npm run lint` passes with no errors against the current codebase
      (fix or justify any findings it surfaces on existing code, don't
      just silence the rule).
- [ ] The config matches the existing stack: TypeScript-aware, and
      consistent with the project's `tsconfig*.json` project references
      (no separate/parallel type-checking setup).
- [ ] A deliberately bad file (e.g. an unused variable or `any`-typed
      value where the project's style disallows it) makes `npm run lint`
      fail with a non-zero exit code, so the check is real.

## Implementation Notes

_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes

_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes

_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
