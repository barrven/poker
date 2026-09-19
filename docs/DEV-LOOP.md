# Using the file-based dev loop

This scaffold is driven by files and stage commands, not by ad-hoc chat
requests. You do not file tickets, reopen shipped features, or ask the
agent to "just fix this" outside the loop. Work enters as a spec change
and ships as a scheduled feature.

```
loop(
  spec > features >
  loop( implement > test > validate > accept ) >
  retro
)
```

- **Outer loop** — one **slice** of the product: spec → schedule features →
  ship that slice → retro. Not the whole backlog.
- **Inner loop** — one feature in that slice: implement → test → validate →
  accept.

Start with `/spec`. Drive stages one at a time, or run `/dev-loop` until it
stops at a human gate.

## Files that run the loop

| File | Role |
|---|---|
| `STATE.md` | Single source of truth: current **Phase**, **Active feature**, **Outer iteration**. |
| `docs/SPEC.md` | Living product spec. Written on first `/spec`, revised when retro (or a later `/spec`) actually changes it. |
| `docs/CHANGELOG.md` | Appended when a feature is **accepted**. Not a bug log. |
| `features/BACKLOG.md` | Index of every feature. |
| `features/NNN-slug.md` | One file per feature (copy `features/template.md`). |
| `.claude/commands/` | The stage procedures the agent follows. |
| `.claude/GIT.md` | Git policy. `/spec`/`/features` commit to `master`; the inner loop commits to `dev`; `/accept` merges `dev` into `master`. |

`STATE.md` **Phase** is one of: `spec`, `features`, `implement`, `test`,
`validate`, `accept`, `retro`.

## Commands

| Command | What it does |
|---|---|
| `/spec` | Write or revise `docs/SPEC.md`. First run also bootstraps a new product repo. |
| `/features` | Decompose the whole spec into feature files; schedule **this iteration's slice** only. |
| `/implement` | Build the active feature. No extra scope. |
| `/test` | Write/run tests against that feature's acceptance criteria. |
| `/validate` | Lint/typecheck/build/full test suite + check each acceptance criterion. |
| `/accept` | Human sign-off. Continue the slice, or retro now. |
| `/retro` | Close the slice (or a mid-slice stop). Fold learnings back; decide what is next. |
| `/dev-loop` | Chain the stages above until a real stop (see below). |

`/dev-loop` stops and hands control back to you at:

- `/accept` (never auto-approved)
- `/spec` or `/features` hitting an open question it cannot resolve
- `/retro` (always asks you)
- the same feature bouncing validate → implement more than twice
- you interrupting

## Outer loop — one iteration is one slice

### 1. `/spec`

First pass (placeholder spec, outer iteration 0): interview enough to fill
Vision, Users, Core Requirements, Non-goals, and Constraints. Unresolved
items go under Open Questions — they are not guessed. Sets **Outer
iteration** to 1 and **Phase** to `features`.

Later passes are a **revision**, not a first draft. `/spec` does **not**
bump the outer iteration; `/retro` owns that bump when a slice completes.

### 2. `/features` — write everything, schedule a little

The backlog holds the **full** decomposition of the spec. The inner loop
only ships the **current slice**.

- One feature file per shippable piece (`features/NNN-slug.md`), including
  work you can already see for later. Do not invent only this slice and
  lose the rest.
- Schedule the smallest coherent increment for this **Outer iteration** —
  typically a thin vertical slice of about 1–5 features.
  - In this pass: `iteration: <current>`, `status: backlog`
  - Not in this pass: `iteration: later`, `status: deferred`
- Open questions that would change the slice are surfaced, not defaulted.

Deferred work is already on disk. It is not inner-loop work until a later
`/features` promotes it.

### 3. Inner loop ships only that slice

`implement → test → validate → accept` walks features whose `iteration`
matches `STATE.md`'s **Outer iteration**. `deferred` / `later` items are
not next-up.

After each accept, you choose:

- **Accept and continue** — next current-slice `backlog` feature, back to
  `/implement`
- **Accept and retro now** — jump to `/retro` before the slice is empty
  (so spec learning does not wait)
- If this was the last feature in the slice, accept goes to `/retro`

**Request changes** sends the same feature back to `/implement` with notes.
**Reject** either drops it (`blocked`) or sends it back to `/features`.

### 4. `/retro` closes the slice

`/retro` runs when the slice is done, or mid-slice when you chose "retro
now". It does **not** wait for deferred work.

It will refuse if a current-slice feature is still `implementing`,
`testing`, `validating`, or `accept`. Finish or reject that in-flight
work first. Leftover `backlog` items in the slice are fine (mid-slice
retro).

Retro asks two things:

1. Did we learn something that should change the spec?
2. Is there more to build, or are we done for now?

Then it branches:

| After retro | Spec changing? | More to build? | Next |
|---|---|---|---|
| Slice finished | yes | — | **Phase `spec`**, then `/features` re-slices. Outer iteration **bumps**. |
| Slice finished | no | yes (`deferred` items, or you want another slice) | **Phase `features`** (skip a spec rewrite). Outer iteration **bumps**. |
| Slice finished | no | no | Stay **`retro`**. Project parked. |
| Mid-slice | yes | — | **Phase `spec`**, then `/features` re-slices remaining work. Outer iteration **does not** bump. |
| Mid-slice | no | yes | Same outer iteration; next current-slice feature → **`implement`**. |
| Mid-slice | no | no | Stay **`retro`**. Remaining items stay as they are (or `deferred` if you park them). |

Spec → features after retro is **optional**, not automatic.

- **Spec changed** (new requirement, a bug that is really a spec gap, a
  dropped non-goal, a constraint you learned the hard way): retro edits
  `docs/SPEC.md` and appends the spec changelog. Next `/features` may add
  new feature files, promote `deferred` items into the next slice, or
  demote leftover `backlog` items back to `deferred`.
- **No spec change, more to build:** skip `/spec`. `/features` picks the
  next slice from work already in the backlog (usually those `deferred`
  items).
- **Done:** nothing is added. Phase stays `retro`.

Later outer passes are "learn, maybe revise the spec, schedule the next
1–5 features" — not "dump the rest of the product into the inner loop."

## Inner loop — one feature

`/implement` builds only the active feature's Description and Acceptance
Criteria. If those are ambiguous, or the feature is bigger than expected,
it stops rather than guessing.

`/test` covers the acceptance criteria. If a test fails because the
feature is wrong, the feature is fixed — the test is not weakened to
match a bug.

`/validate` is a check, not more building. All checks pass → **Phase
`accept`**. Something fails → back to `implementing`, with the gap written
into Implementation Notes.

`/accept` is the only human gate in the inner loop. Never auto-approved.

## Bugs and other ad-hoc reports

There is no bug tracker, `/bug` command, or intake file. A report is
supposed to become a spec change, then a backlog item — not a side
channel that jumps the queue.

### Defect in the feature currently in flight

Stay in the inner loop.

| Where you are | What happens |
|---|---|
| `/implement` | Ambiguous criteria or unexpected size → stop; do not guess. |
| `/test` | Do not weaken a test to match a bug; fix the feature. |
| `/validate` | Failure sets `status: implementing` and writes what to change into Implementation Notes. |
| `/accept` | **Request changes** → back to implement with notes. **Reject** → `blocked`, or send it back to `/features`. |

### Defect in something already `done`

There is no reopen path. Do not ask the agent to patch a shipped feature
out of band.

1. Interrupt `/dev-loop` if it is running, or finish/reject in-flight work.
2. Get to `/retro` (choose **Accept and retro now** if you do not want to
   finish the rest of the slice first).
3. Fold the bug into `docs/SPEC.md` as a requirement or constraint.
4. Next `/features` turns it into a new `features/NNN-slug.md` (or
   promotes a `deferred` one) for a later inner-loop pass.

`docs/CHANGELOG.md` only records accepted features. It is not a defect
log. `blocked` exists on the backlog, but `/accept` reject is the only
place that uses it. There is no "file a bug against a done feature"
status.

### How to get an out-of-band report into the loop

| Situation | What to do |
|---|---|
| It is the feature sitting in `/accept` | **Request changes** (or **Reject**). |
| It is a different / already-shipped problem | **Accept and retro now**, or wait for `/retro`, then `/spec` + `/features`. |
| `/dev-loop` is running | Interrupt it. |
| You just want it "fixed now" | Don't. Park it until retro/spec; it competes as a feature in the next slice. |

## Feature status

`backlog → implementing → testing → validating → accept → done`

Also: `blocked` (rejected, pending a drop-or-rethink decision), `deferred`
(not in this outer iteration).

A feature is in the current slice when its `iteration` equals `STATE.md`'s
**Outer iteration**.

## First-run path

1. Clone into a **new folder name** (not `scaffold-template`). See the
   README.
2. `/spec` — replaces scaffold git history with a fresh repo (`master` +
   `dev`), writes the spec, sets outer iteration to 1.
3. `/features` — full backlog on disk; a small slice scheduled; one
   feature marked active.
4. Inner loop that feature (`/implement` → `/test` → `/validate` →
   `/accept`), then the rest of the slice or retro now.
5. `/retro` — decide whether the spec changes and whether there is
   another slice.
6. Repeat from `/spec` or `/features` as retro directed, or stop.

Git: `/spec` and `/features` commit and push straight to `master`. The inner
loop (`/implement` → `/test` → `/validate`) commits and pushes `dev` on its
own, no human input needed — `/accept` is the loop's one human gate, and
merges `dev` into `master` once the user actually accepts. Policy is
`.claude/GIT.md`.
