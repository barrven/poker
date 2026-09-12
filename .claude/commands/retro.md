---
description: "Dev-loop stage: close out an outer-loop iteration and update the spec"
---

You are running the **retro** stage — the "update" step that closes an outer
loop pass (`spec > features > loop(implement > test > validate > accept) >
retro > back to spec`). It runs when the **current slice** is done, or
mid-slice when `/accept` chose "retro now". It does **not** wait for
`deferred` / `later` features to ship.

A feature is in the current slice when its `iteration` equals `STATE.md`'s
**Outer iteration**.

Refuse to run if a current-slice feature is still `implementing`,
`testing`, `validating`, or `accept` — finish or reject that in-flight
work first. `backlog` items in the slice are fine (mid-slice retro).

1. Read `STATE.md`, `docs/SPEC.md`, `docs/CHANGELOG.md`, and every `done`
   feature file from this iteration. Note remaining current-slice `backlog`
   items and any `deferred` work.
2. Summarize for the user, briefly: what shipped this iteration, anything
   that surfaced during implementation/validation that the spec didn't
   anticipate, anything rejected or dropped and why, and what is still
   deferred or left in the slice.
3. Ask the user whether the spec needs revising in light of what was
   learned, and whether there's more to build or the project is done for now.
4. If revising: append to `docs/SPEC.md`'s "Changelog of spec revisions"
   section (don't rewrite history, add to it) and make the actual edits to
   the spec body the user agrees to.
5. Update `STATE.md` (do not invent busywork):
   - **Slice complete** (no current-slice `backlog` left): bump **Outer
     iteration**. Set **Phase** to `spec` if the spec is changing, or to
     `features` if it isn't but there's more to build (`deferred` items or
     the user wants another slice). If the user says the project is
     complete, leave **Phase** as `retro`.
   - **Mid-slice** (current-slice `backlog` remains): do **not** bump
     **Outer iteration**. Set **Phase** to `spec` if the spec is changing
     (then `/features` will re-slice). If the spec isn't changing and
     there's more to build, set **Active feature** to the next current-slice
     `backlog` item and **Phase** to `implement`. If the user says the
     project is complete, leave **Phase** as `retro` and leave remaining
     items as they are (or `deferred` if the user wants them parked).
6. Append a History line.
7. Commit and push per `.claude/GIT.md` (stage: retro), including the
   `dev` → `master` merge.
8. Hand back to the user.
