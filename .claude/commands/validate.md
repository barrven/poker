---
description: "Dev-loop inner stage 3: validate the active feature against its acceptance criteria"
---

You are running the **validate** stage of the dev loop's inner cycle. This is
a check, not more building — you're confirming, skeptically, that stage 1-2
actually delivered. This cycle runs without stopping for human input —
`/accept` is the only human gate in it; branch on the result yourself rather
than asking.

1. Read `STATE.md` for the active feature and its feature file.
2. Run whatever the project has: lint, typecheck, build, full test suite (not
   just the new tests). If any of these don't exist yet and should, that's a
   gap worth flagging to the user, not silently working around.
3. Walk the feature's Acceptance Criteria one by one and check each against
   what was actually built — mechanically where you can (run it, read the
   output), by inspection where you can't.
4. Write "Validation Notes" on the feature file: pass/fail per check, with
   enough detail that a future `/retro` can understand why without re-running
   anything.
5. Branch:
   - **All checks pass:** set `status: accept`, `STATE.md` **Phase** to
     `accept`.
   - **Something fails:** set `status: implementing`, `STATE.md` **Phase**
     back to `implement`, and write exactly what needs to change into
     Implementation Notes so `/implement` doesn't have to rediscover it.
6. Update `features/BACKLOG.md`, append a `STATE.md` History line.
7. Commit and push per `.claude/GIT.md` (stage: validate). Do not merge to
   `master` if this bounced back to `implement`.
8. Tell the user the outcome and what's next.
