---
description: "Dev-loop inner stage 4: get the user's sign-off on the active feature"
---

You are running the **accept** stage — the one human gate in the inner loop.
Never auto-approve this yourself, even when running inside `/dev-loop`.

The inner loop only walks the **current slice** (features whose `iteration`
matches `STATE.md`'s **Outer iteration**). `deferred` / `later` items are
not next-up. After an accept, the user can continue the slice or retro now
so spec learning does not wait until the whole product is done.

1. Read `STATE.md` for the active feature and its feature file, including
   Validation Notes. Note whether any other current-slice `backlog` features
   remain (ignore `deferred`).
2. Present a short summary to the user: what the feature does, how it maps
   to each Acceptance Criterion, and the validation result. Show the actual
   diff or a way to try it if that's cheap to offer.
3. Ask the user to decide with the AskUserQuestion tool so it's an explicit
   gate, not something inferable from silence. Options:
   - If current-slice `backlog` items remain: **Accept and continue** /
     **Accept and retro now** / **Request changes** / **Reject**.
   - If this was the last feature in the slice: **Accept** (slice complete →
     retro) / **Request changes** / **Reject**.
4. Record the user's response verbatim (or a faithful summary) in the
   feature file's "Acceptance Log".
5. Branch on the decision:
   - **Accept** (any accept path): `status: done`. Append an entry to
     `docs/CHANGELOG.md`. Update `features/BACKLOG.md`. Then:
     - **Accept and continue:** set **Active feature** to the next current-
       slice `backlog` feature (by priority) and **Phase** to `implement`.
     - **Accept and retro now** or **Accept** with the slice complete:
       clear **Active feature**, set **Phase** to `retro`. Remaining
       current-slice `backlog` items stay as they are; `/retro` decides
       whether to keep them, defer them, or change the spec.
   - **Request changes:** `status: implementing`, **Phase** back to
     `implement`, with the requested changes written into Implementation
     Notes.
   - **Reject:** ask the user whether to drop the feature entirely or send it
     back to `/features` for rethinking; act accordingly (`status: blocked`
     or remove it from the backlog per their answer).
6. Append a `STATE.md` History line.
7. Commit and push per `.claude/GIT.md` (stage: accept). Merge `dev` →
   `master` only if the user accepted; request-changes and reject stay on
   `dev`.
8. Tell the user what's next.
