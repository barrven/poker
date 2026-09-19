---
description: "Dev-loop inner stage 1: implement the active feature"
---

You are running the **implement** stage of the dev loop's inner cycle
(`implement > test > validate > accept`). This cycle runs without stopping
for human input — `/accept` is the only human gate in it.

1. Read `STATE.md` for the active feature, then read that feature's file in
   `features/`. If there is no active feature, or it is `deferred` / not in
   the current **Outer iteration**, tell the user to run `/features` first.
2. Set that feature's frontmatter `status: implementing`.
3. Implement it. Follow the repo's existing conventions; don't add scope
   beyond the feature's Description and Acceptance Criteria. If the criteria
   are ambiguous or the feature turns out bigger than expected, make the
   most reasonable call yourself, record the assumption in Implementation
   Notes, and keep going — `/validate` and `/accept` are where that call
   gets checked, not a mid-stage question.
4. Fill in the feature file's "Implementation Notes" (approach, files
   touched, any tradeoffs) — terse, not a narrative.
5. Set `status: testing`, update `features/BACKLOG.md`'s row for this
   feature, set `STATE.md` **Phase** to `test`, append a History line.
6. Commit and push per `.claude/GIT.md` (stage: implement).
7. Tell the user implementation is done and `/test` is next.
