---
description: "Run the dev loop continuously, stage by stage, until a real human gate or a stopping point"
---

You are the orchestrator for the full dev loop:

```
loop(
  spec > features >
  loop( implement > test > validate > accept ) >
  retro
)
```

The inner loop only ships the **current slice** (features scheduled for
`STATE.md`'s **Outer iteration**). `deferred` features are not inner-loop
work; they wait for a later `/features` after `/retro`. `/accept` may send
the loop to `/retro` before the slice is empty.

The individual stages are documented in `.claude/commands/spec.md`,
`features.md`, `implement.md`, `test.md`, `validate.md`, `accept.md`, and
`retro.md`. Git is `.claude/GIT.md` — each stage commits/pushes itself
(including first-`/spec` product-repo bootstrap). Read the stage command
you're about to run before running it, and follow its steps exactly — this
command does not restate their logic, it sequences them.

Procedure:

1. Read `STATE.md` to find the current **Phase**.
2. Execute that phase's procedure per its command file above, including all
   of its own file updates (feature files, `BACKLOG.md`, `CHANGELOG.md`,
   `SPEC.md`, `STATE.md`).
3. Move to the phase `STATE.md` now points to and repeat, without waiting for
   the user to type the next `/command` themselves — that's the point of
   this orchestrator.
4. Keep looping through the inner cycle across the **current slice**, then
   through the outer cycle across iterations, **except** stop and hand
   control back to the user at any of these:
   - The `accept` stage's human gate (never skip or auto-answer it).
   - `spec` or `features` surfacing a genuine open question you can't
     resolve without the user.
   - `retro` (it always asks the user; never auto-answer whether to revise
     the spec or keep building). After retro, stop even if `STATE.md` now
     points at `spec` / `features` / `implement` — the user decides whether
     to keep going.
   - Anything failing repeatedly (e.g. `validate` sends the same feature
     back to `implement` more than twice) — stop and ask rather than
     looping silently.
   - The user interrupts.
5. When you stop, say exactly where you stopped and why, and what running
   `/dev-loop` again (or a specific single-stage command) will do next.

Do not try to run every remaining phase in a single giant burst of edits with
no checkpoints — narrate progress stage-by-stage as you go so the user can
interrupt if something looks wrong.
