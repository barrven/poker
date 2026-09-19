---
description: "Dev-loop inner stage 2: write and run tests for the active feature"
---

You are running the **test** stage of the dev loop's inner cycle. This cycle
runs without stopping for human input — `/accept` is the only human gate in
it, so iterate on your own until tests pass rather than asking.

1. Read `STATE.md` for the active feature and its feature file.
2. Write or extend tests that exercise the feature's Acceptance Criteria —
   prefer covering behavior over implementation detail. If the project has
   no test setup yet, set one up minimally (matching whatever stack the spec
   named) rather than skipping tests.
3. Run the tests. Iterate on the implementation (not just the tests) until
   they pass — if a test fails because the feature is genuinely wrong, fix
   the feature; don't weaken the test to match a bug.
4. Fill in "Test Notes" on the feature file: what's covered, what's
   deliberately not, and why.
5. Set `status: validating`, update `features/BACKLOG.md`, set `STATE.md`
   **Phase** to `validate`, append a History line.
6. Commit and push per `.claude/GIT.md` (stage: test).
7. Tell the user tests pass and `/validate` is next.
