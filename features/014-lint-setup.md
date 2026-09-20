---
id: 014
title: Lint tooling
status: accept
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

- [x] `npm run lint` exists and runs ESLint over `server/`, `src/`, and
      `tests/`. (Shipped with **Biome** instead of ESLint — see
      Implementation/Validation Notes for why; scope over the three
      directories is met.)
- [x] `npm run lint` passes with no errors against the current codebase
      (fix or justify any findings it surfaces on existing code, don't
      just silence the rule).
- [x] The config matches the existing stack: TypeScript-aware, and
      consistent with the project's `tsconfig*.json` project references
      (no separate/parallel type-checking setup).
- [x] A deliberately bad file (e.g. an unused variable or `any`-typed
      value where the project's style disallows it) makes `npm run lint`
      fail with a non-zero exit code, so the check is real.

## Implementation Notes

**Deviation from the spec's literal wording — flag for `/validate`, `/accept`,
and the next `/retro`:** `docs/SPEC.md`'s Constraints section (added by the
iteration-1 retro) names ESLint specifically. I used **Biome**
(`@biomejs/biome`) instead. Reason: this project is on
`typescript@7.0.2` (the new native/Go TypeScript compiler), and
`typescript-eslint` (parser, plugin, and the `typescript-eslint` meta
package alike) has a **hard, unconditional runtime guard** that throws
`"typescript-eslint does not support TS 7.0."` the moment the package is
imported — confirmed by installing it and running `npx eslint .`, which
failed before evaluating any rule, even with a config that used no
type-aware rules at all. This is a real upstream gap
(github.com/typescript-eslint/typescript-eslint issue #10940), not a
config mistake on this project's part. The only documented workaround
(installing a second, shadow `typescript@6.x` purely for the linter to
resolve) would itself violate this feature's own acceptance criterion of
"no separate/parallel type-checking setup" — it would make the linter's
view of the code diverge from what `npm run typecheck` actually checks.
Biome ships its own Rust-based TS/JS parser and doesn't touch the
`typescript` package's API at all, so it isn't coupled to this version
skew (now or on a future TS bump). Recommend the spec wording change from
"ESLint" to "a linter" at the next `/retro`; not changing `docs/SPEC.md`
myself mid-`/implement`.

`npm install --save-dev @biomejs/biome`, `npx biome init`, then trimmed
the generated `biome.json`: formatter and the `assist`/organize-imports
step are **disabled** (this feature is lint-only — enabling the
formatter would reformat the whole existing 2-space codebase to Biome's
tab-indent default, which is unrelated scope) and `files.includes` is
scoped to `server/**`, `src/**`, `tests/**` (per the acceptance
criteria), with `"preset": "recommended"` for the lint rule set.
`package.json` gets `"lint": "biome lint --error-on-warnings ."` — plain
`biome lint` exits 0 even when it reports warnings (the recommended
preset's default severity), so `--error-on-warnings` is what actually
makes AC4's "non-zero exit code" true; verified by temporarily dropping
an unused-variable file into `server/` and confirming `npm run lint`
exits non-zero, then removing it (not committed).

Fixed the two real findings Biome surfaced on the existing codebase
rather than suppressing them:
- `server/app.ts`'s login handler used a comma-operator expression
  (`: (consumePasswordCheck(password), false)`) for the timing-safe
  dummy-hash-check-on-unknown-username path (`lint/complexity/noCommaOperator`).
  Rewritten as an explicit `if`/`else` assigning to `let ok: boolean`;
  behavior (the dummy scrypt call still runs on an unknown username, for
  timing safety) is unchanged, `tests/auth.test.ts`'s
  "login starts a session; failures are generic" test still passes.
- `tests/table.test.ts`'s guest-markup regex had two literal spaces
  before a backtick (`\n  ` `;`), flagged by
  `lint/complexity/noAdjacentSpacesInRegex`. Changed to the equivalent
  `\n {2}` `;` quantifier form (same match, clearer intent).

Files: `biome.json` (new), `package.json` (+`lint` script, +`@biomejs/biome`
devDependency), `package-lock.json`, `server/app.ts`, `tests/table.test.ts`.

## Test Notes

`tests/lint.test.ts` (new, 4 tests) via `npm test` (30/30 total: 4 lint +
8 table + 7 auth + 5 tab + 6 scaffold).

Covered: `package.json`'s `lint` script exists and is
`biome lint --error-on-warnings .`; `biome.json` has linting enabled,
scopes `files.includes` to `server/**`/`src/**`/`tests/**`, and has the
formatter disabled (lint-only, no parallel type-checking or reformat
surface); `npm run lint` actually executes and reports no errors against
the current codebase (real subprocess run via `execFileSync`, not just a
config-shape check); a deliberately bad file (unused variable) in an
isolated tmp dir, linted with the project's own `node_modules/.bin/biome`
binary and `--error-on-warnings`, exits non-zero — proving AC4 mechanically
rather than by the manual check recorded in Implementation Notes.

Deliberately not: re-testing that Biome's `recommended` preset rules are
individually correct (that's Biome's own test suite's job, not this
project's); linting non-TS/JS files (markdown, JSON) — out of this
feature's scope; a fix-mode (`biome lint --write`) test, since the AC only
requires a real pass/fail check, not auto-fixing.

Note for `/validate`: the isolated bad-file test invokes the local biome
binary directly (`node_modules/.bin/biome`), not `npx`, specifically to
avoid `npx` resolving/downloading a package from a directory outside this
project (the test's tmp dir is under the OS tmp root, not nested in
`node_modules`).

## Validation Notes

2026-09-19 — pass, with one flagged deviation. Ready for `/accept`.

Project checks — all four now pass, including lint for the first time in
this project's history:
- lint: **pass** (`npm run lint` — `biome lint --error-on-warnings .`)
- typecheck: pass
- build: pass
- tests: pass (`npm test` — 30/30: 4 lint + 8 table + 7 auth + 5 tab +
  6 scaffold)

**Flagged deviation, carried from Implementation Notes:** this feature's
own Acceptance Criteria (which I wrote during `/features`, this same
session) literally say "ESLint." I shipped **Biome** instead, because
`typescript-eslint` (parser, plugin, and meta-package) has a hard,
unconditional guard that throws `"typescript-eslint does not support TS
7.0."` merely on import — verified directly (`npm install eslint
typescript-eslint` then `npx eslint .` failed before any rule ran, even
with a non-type-aware config). `docs/SPEC.md`'s Constraints section
(added in the iteration-1 retro) also names ESLint specifically, so this
is a deviation from the user-approved spec wording, not just the feature
file. Recommend fixing the spec wording ("ESLint" → "a linter") at the
next `/retro` — flagging for `/accept` now rather than editing the spec
mid-validate.

1. **Pass (tool substituted, scope met).** `npm run lint` exists
   (`biome lint --error-on-warnings .`) and covers `server/`, `src/`,
   `tests/`: `biome.json`'s `files.includes` is
   `["server/**", "src/**", "tests/**"]`; a verbose run lists all 12
   `.ts` files under those three directories (plus `src/style.css`,
   harmlessly caught by the same glob).
2. **Pass.** `npm run lint` exits 0 with "No fixes applied" and no
   errors/warnings against the current codebase (two real findings from
   the initial `biome init` run — a comma-operator expression in
   `server/app.ts` and an ambiguous double-space regex in
   `tests/table.test.ts` — were fixed, not suppressed; see Implementation
   Notes).
3. **Pass.** `biome.json` has `formatter.enabled: false` and
   `assist.enabled: false` (lint-only, no reformat of the existing
   2-space codebase) and contains no type-checking configuration —
   Biome's own parser handles TypeScript syntax without invoking `tsc`
   or the `typescript` package at all, so it cannot diverge from or
   duplicate what `npm run typecheck` (the project's real tsconfig
   project references) already owns.
4. **Pass.** Verified twice: manually (a temp file with an unused
   variable dropped into `server/`, `npm run lint` → exit 1, file
   removed) and mechanically in `tests/lint.test.ts` (an isolated tmp
   dir, the project's own `node_modules/.bin/biome` binary,
   `--error-on-warnings` on a bad file → non-zero exit, asserted via
   `assert.throws`).

## Acceptance Log

_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
