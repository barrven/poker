---
description: "Dev-loop stage 2: decompose the spec into a feature backlog"
---

You are running the **features** stage of the dev loop.

The backlog holds the full decomposition, but the inner loop only ships the
**current slice**: features scheduled for `STATE.md`'s **Outer iteration**.
Everything else is written down so it isn't forgotten, then marked `deferred`.

1. Read `STATE.md` and `docs/SPEC.md`. Refuse to proceed with a placeholder
   spec — tell the user to run `/spec` first. If **Outer iteration** is 0,
   tell the user to run `/spec` first (it sets the iteration to 1).
2. If `docs/SPEC.md` has load-bearing Open Questions that would change what
   this slice contains, stop and surface them. Do not default them and
   schedule anyway.
3. Decompose the Core Requirements into small, independently shippable
   features. Each one should be implementable, testable, and acceptable on
   its own — if a requirement is too big for one inner-loop pass, split it.
   Write a feature file for work you can already see, including later work;
   do not only invent the current slice and lose the rest.
4. For every new feature: copy `features/template.md` to
   `features/NNN-slug.md` (zero-padded, next free ID), fill in Description
   and Acceptance Criteria (derived from the spec's requirements, concrete
   enough for `/validate` to check mechanically where possible).
5. Schedule a slice for the current **Outer iteration** — the smallest set
   that is still a coherent product increment. Typically a thin vertical
   slice of about 1–5 features, unless the spec is already that small. Do
   not schedule every Core Requirement into this iteration.
   - Scheduled: `iteration: <current outer iteration>`, `status: backlog`
     (leave in-flight statuses alone: `implementing` / `testing` /
     `validating` / `accept`).
   - Not in this pass: `iteration: later`, `status: deferred`.
6. Do not duplicate or silently drop existing entries that are still
   `backlog`/`implementing`/`testing`/`validating`/`accept`/`deferred`.
   You may promote `deferred` → this slice or demote still-`backlog` items
   to `deferred` when re-slicing after a spec change. Only touch a `done`
   entry if the spec revision actually invalidates it (flag that to the user
   explicitly, don't just edit it quietly).
7. Rewrite `features/BACKLOG.md`'s table to reflect the current full set.
   List the current iteration's features first (by priority), then
   `deferred` / `later`.
8. Update `STATE.md`: set **Active feature** to the first `backlog` feature
   whose `iteration` equals the current **Outer iteration**, by priority;
   set **Phase** to `implement`; append a History line. If nothing was
   scheduled (open questions, or nothing left to build), do not advance to
   `implement` — say so and leave the phase as `features`.
9. Commit and push per `.claude/GIT.md` (stage: features).
10. Report the backlog to the user (table form), clearly marking this
    iteration's slice vs `deferred`, and name the active feature. Don't start
    implementing — that's `/implement`'s job.
