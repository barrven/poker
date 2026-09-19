# Git workflow

Read this at every stage. Stage commands do not restate it.

Never push to a remote whose URL contains `scaffold-template`. Never force-push.
Never commit directly on `master` **except** from the outer-loop stages below,
which own `master` directly. Everything else stays off `master` until a merge.

## Branches

- **`master`** — outer-loop home branch, and the last accepted product.
  `/spec` and `/features` commit and push directly here.
- **`dev`** — inner-loop working branch. `/implement`, `/test`, and
  `/validate` each commit and push here on their own, with no human input
  required. `/accept` — the inner loop's one human gate — commits/pushes
  `dev` too, then merges it into `master` once the user actually accepts.

## New product repo

The scaffold is a template. A cloned product must not keep the template's git
history or its `origin`.

Run this **once**, at the start of the first `/spec` (placeholder spec, outer
iteration 0), **before** editing the spec.

### Detect

```
git remote get-url origin   # if any
basename of the working directory
```

- **This is the scaffold itself** — origin URL contains `scaffold-template`
  **and** the directory is named `scaffold-template`: do **not** re-init.
  You are working on the template.
- **This is a product clone** — origin URL contains `scaffold-template` and
  the directory is **not** named `scaffold-template`: re-init as below.
- **Ambiguous** — origin contains `scaffold-template` but you are unsure
  (unusual directory name, etc.): ask with AskUserQuestion whether to start
  a new product repo or keep the scaffold remote. Default to a new product
  repo if this is a first `/spec`.
- **Already a product** — origin exists and does **not** contain
  `scaffold-template`: leave git alone (no re-init).
- **No `.git`** — `git init` as below (no history to wipe).

### Re-init

1. Ask the user (AskUserQuestion) whether to create a new GitHub repo now.
   Default name: the directory name. Default visibility: private. They can
   skip and add a remote later.
2. Remove `.git` (only when replacing a scaffold clone).
3. `git init -b master`
4. `git add` the scaffold files (this tree as it stands, before spec edits).
   Commit: `Initial commit from scaffold.`
5. `git checkout -b dev` then `git checkout master` — create the inner-loop
   branch now so it exists, but land back on `master`: this same `/spec` run
   commits its spec edit next, and outer-loop stages commit to `master`
   directly.
6. If they want a GitHub repo and `gh` works:
   `gh repo create <name> --private --source=. --remote=origin --push`
   (this pushes `master`) then `git push -u origin dev` (give `dev` its own
   upstream). If they asked for public, use `--public`.
7. If they skipped GitHub, continue local-only. Later stages skip `git push`
   and say so once, not on every stage.

If `git commit` fails on missing `user.name` / `user.email`, stop and ask
rather than inventing an identity.

## Outer loop (`/spec`, `/features`) — on `master`

1. Make sure you're on `master` (`git checkout master`). If `dev` is ahead
   or behind, that's fine — it gets refreshed from `master` when the inner
   loop next starts.
2. `git status` and `git diff`. If clean, skip commit.
3. Stage **this stage's changes**, not blindly `git add -A`. Once an app
   exists, never add `node_modules/`, build output, secrets, or anything a
   `.gitignore` should exclude.
4. Commit with an imperative one-liner:
   - spec: `Write the product spec.` / `Revise the product spec.`
   - features: `Schedule iteration N feature slice.`
5. If `origin` exists: `git push origin master`. If push fails, report it
   and continue the loop — do not rewrite history to "fix" the push.
6. When `/features` finishes scheduling a slice and hands off to
   `/implement`: refresh `dev` from `master` so the inner loop starts from
   the latest code — `git checkout dev && git merge --ff-only master`
   (or `git checkout -b dev master` if `dev` doesn't exist locally yet).

## Inner loop (`/implement`, `/test`, `/validate`) — on `dev`

This cycle runs without stopping for human input — `/accept` is the only
human gate. Each stage below commits and pushes on its own.

1. Confirm you're on `dev` (create/refresh it from `master` per the outer
   loop's step 6 above if you haven't yet for this slice).
2. `git status` and `git diff`. If clean, skip commit.
3. Stage **this stage's changes**, not blindly `git add -A`. Once an app
   exists, never add `node_modules/`, build output, secrets, or anything a
   `.gitignore` should exclude.
4. Commit with an imperative one-liner, including the feature id and title:
   - implement: `Implement NNN: <title>.`
   - test: `Test NNN: <title>.`
   - validate: `Validate NNN: <title>.`
5. If `origin` exists: `git push origin dev`. If push fails, report it and
   continue the loop — do not rewrite history to "fix" the push.

## `/accept` — the inner loop's one human gate

1. Commit and push `dev` per the inner-loop steps above, with message
   `Accept NNN: <title>.` (or `Request changes on NNN: <title>.` /
   `Reject NNN: <title>.`, depending on the user's decision).
2. If the user actually accepted (continue the slice, or retro now): merge
   `dev` → `master` and push (below). Request-changes and reject stay on
   `dev` only — do not merge.

## `/retro`

Commit and push `dev` per the inner-loop steps above (message:
`Retro iteration N.`), then merge `dev` → `master` and push (below) — a
slice close or a finished project should not be left stuck on `dev`.

## Merge `dev` → `master`

Only after the relevant `dev` commit and push above.

1. `git checkout master`
2. `git merge --ff-only dev` — if that fails, `git merge --no-ff dev` with
   message `Merge branch 'dev'.`
3. If `origin` exists: `git push origin master`
4. `git checkout dev`

If merge or push fails, report it. Do not force-push, reset, or commit on
`master` to paper it over.
