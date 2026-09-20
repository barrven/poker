---
id: 017
title: Standard login/register flow
status: backlog
priority: medium
iteration: 5
---

## Description
A logged-out visitor sees a login form by default — not login and
register forms together on one page. A visible link takes them to a
separate registration view, and back again, matching the common
login-first pattern used across apps. This is spec requirements 20-21.
No change to the underlying auth behavior (hashing, sessions, error
handling) from feature 002.

## Acceptance Criteria
_Testable, checkable statements. `/validate` and `/accept` check against these directly._

- [ ] A logged-out visitor's default view is a login form only
      (username, password, submit) — the register form is not shown on
      the same page.
- [ ] The login view has a visible link/button to a separate
      registration view.
- [ ] The registration view has a visible link/button back to the
      login view.
- [ ] Submitting a valid registration results in a clear next step
      (either signed in directly, or returned to login with a visible
      success indicator — implementer's call, note which was chosen).
- [ ] Existing auth behavior is unchanged: duplicate username shows a
      visible error, failed login shows a visible error, passwords are
      still hashed (not plaintext), and a session still survives a page
      refresh.

## Implementation Notes
_Filled in during `/implement` — approach taken, files touched, tradeoffs._

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
