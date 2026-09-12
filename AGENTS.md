# Agent instructions

This repo is driven by the file-based dev loop in `README.md`. Current phase
and active feature live in `STATE.md`. Stage commands live in
`.claude/commands/`.

Git is mandatory, not optional:

- Follow `.claude/GIT.md` at every stage.
- First `/spec` on a cloned product replaces the scaffold git history with a
  fresh repo (`master` + `dev`). Never push to `scaffold-template`.
- Commit and push `dev` after each stage. Merge `dev` → `master` on accept
  and on retro. Stay on `dev`.
