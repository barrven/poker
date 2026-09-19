# Agent instructions

This repo is driven by the file-based dev loop in `README.md`. Current phase
and active feature live in `STATE.md`. Stage commands live in
`.claude/commands/`.

The inner loop (`implement -> test -> validate -> accept`) runs without
stopping for human input, except at `/accept` — the loop's one human gate.
`/implement`, `/test`, and `/validate` make the most reasonable call on any
ambiguity themselves (noting the assumption in the feature file) and keep
going rather than pausing to ask.

Git is mandatory, not optional:

- Follow `.claude/GIT.md` at every stage.
- First `/spec` on a cloned product replaces the scaffold git history with a
  fresh repo (`master` + `dev`). Never push to `scaffold-template`.
- Outer loop (`/spec`, `/features`): commit and push directly to `master`.
- Inner loop (`/implement`, `/test`, `/validate`): commit and push to `dev`
  after each step, on its own, no human input required.
- `/accept`: commit and push `dev` again, then — once the user actually
  accepts — merge `dev` → `master` and push `master`.
