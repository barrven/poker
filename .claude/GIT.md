# Git workflow

Read this at every stage. Stage commands do not restate it.

Never push to a remote whose URL contains `scaffold-template`. Never force-push.
Never commit directly on `master`. Stay on `dev` when a stage finishes.

## Branches

- **`dev`** — daily branch. Every stage commit lands here. Push `dev` after each commit.
- **`master`** — last accepted product. Update it only by merging `dev` into `master`.
  Merge on `/accept` when the user accepted the feature, and on `/retro` after that
  stage's commit (so a slice close or a finished project is not stuck on `dev`).

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
5. `git checkout -b dev` — stay here.
6. If they want a GitHub repo and `gh` works:
   `gh repo create <name> --private --source=. --remote=origin --push`
   then `git push -u origin dev` (create was on `master`; `dev` needs its
   own upstream). If they asked for public, use `--public`.
7. If they skipped GitHub, continue local-only. Later stages skip `git push`
   and say so once, not on every stage.

If `git commit` fails on missing `user.name` / `user.email`, stop and ask
rather than inventing an identity.

## Every stage (on `dev`)

After the stage's file updates:

1. `git status` and `git diff`. If clean, skip commit.
2. Stage **this stage's changes**, not blindly `git add -A`. Once an app
   exists, never add `node_modules/`, build output, secrets, or anything a
   `.gitignore` should exclude. If there is no `.gitignore` yet and junk is
   present, add only the paths you changed.
3. Commit with an imperative one-liner. Inner-loop stages include the
   feature id and title.
   - spec: `Write the product spec.` / `Revise the product spec.`
   - features: `Schedule iteration N feature slice.`
   - implement: `Implement NNN: <title>.`
   - test: `Test NNN: <title>.`
   - validate: `Validate NNN: <title>.`
   - accept: `Accept NNN: <title>.` (or `Request changes on NNN: <title>.` /
     `Reject NNN: <title>.`)
   - retro: `Retro iteration N.`
4. If `origin` exists: `git push origin dev`. If push fails, report it and
   continue the loop — do not rewrite history to "fix" the push.
5. `/accept` when the user **accepted** (any accept path), and `/retro`
   after a successful commit: merge to `master` (next section). Request
   changes, reject, and validate-failed bounces stay on `dev` only.

## Merge `dev` → `master`

Only after the `dev` commit and push above.

1. `git checkout master`
2. `git merge --ff-only dev` — if that fails, `git merge --no-ff dev` with
   message `Merge branch 'dev'.`
3. If `origin` exists: `git push origin master`
4. `git checkout dev`

If merge or push fails, report it. Do not force-push, reset, or commit on
`master` to paper it over.
