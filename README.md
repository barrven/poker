# single-page-app

## Dev loop

This project is driven by a file-based dev loop instead of ad-hoc requests:

```
loop(
  spec > features >
  loop( implement > test > validate > accept ) >
  retro
)
```

- **`STATE.md`** — single source of truth: current phase, active feature, iteration count.
- **`docs/SPEC.md`** — living product spec, revised each outer-loop pass.
- **`docs/CHANGELOG.md`** — appended on every accepted feature.
- **`features/`** — one file per feature (`BACKLOG.md` is the index; `template.md` is the per-feature shape). Status moves `backlog → implementing → testing → validating → accept → done`. Work not in this outer iteration is `deferred` (`iteration: later`). `/features` schedules a small slice, not the whole spec; `/accept` can retro mid-slice; `/retro` runs when the slice is done, not when every later feature has shipped.

### Commands

| Command | Stage |
|---|---|
| `/spec` | write or revise the product spec |
| `/features` | decompose the spec; schedule this iteration's slice |
| `/implement` | build the active feature |
| `/test` | write/run tests for it |
| `/validate` | lint/typecheck/build/test + check against acceptance criteria |
| `/accept` | human sign-off gate (continue the slice, or retro now) |
| `/retro` | close a slice (or mid-slice), feed learnings back into the spec |
| `/dev-loop` | run the stages above automatically, stopping at `/accept`, `/retro`, an open question, or repeated failure |

Start with `/spec`. From there, either drive stages one at a time or run
`/dev-loop` and let it chain through until it needs you.

How a slice, retro, and ad-hoc bugs work: [`docs/DEV-LOOP.md`](docs/DEV-LOOP.md).

## Starting a new project

Clone into a **new folder name** (not `scaffold-template`):

```
git clone https://github.com/barrven/scaffold-template.git my-app
cd my-app
```

Then run `/spec`. That replaces this clone's git history with a fresh repo
so you never push back to the scaffold: **`dev`** is daily work (commit +
push after every stage), **`master`** is the last accepted product (updated
on `/accept` and `/retro`). It will offer to create a new GitHub repo.
The policy the model follows is `.claude/GIT.md`.
