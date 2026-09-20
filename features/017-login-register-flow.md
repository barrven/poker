---
id: 017
title: Standard login/register flow
status: testing
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

`src/main.ts` only. The guest branch of the `View` union gained an
`authView: "login" | "register"` field (defaults to `"login"` on every
fresh/unauthenticated load and after logout — AC1); `render()`'s guest
branch now builds `registerForm`/`loginForm` as separate template
strings and picks one via `view.authView === "register" ? ... : ...`
instead of always concatenating both. Each form gained a small
`<button type="button">` toggle (`#show-login`/`#show-register`) that
just flips `view.authView` and re-renders client-side — no API call,
no page navigation.

`onRegister`/`onLogin` failures now set `authView` back to whichever
form the user was actually on (`"register"`/`"login"` respectively)
instead of an unconditional guest reset, so a failed submission keeps
the user on the same form with the error shown, rather than silently
bouncing them to login (AC5 — existing error-surfacing behavior,
preserved, not just "still shows an error somewhere").

AC4 (what happens after a valid registration): kept the existing
behavior unchanged — a successful `/api/register` already signs the
user straight into a session (feature 002), so there's no separate
"registered, go log in" step. This is the simpler of AC4's two allowed
options and required no new code; noting the choice per AC4's own
"implementer's call, note which was chosen."

No change to `server/auth.ts`, `server/app.ts`, or any password/session
logic — this is purely a client-side view-state change, matching the
feature's stated scope ("No change to the underlying auth behavior").

Verified visually with the headless-Chrome-plus-real-markup technique
from feature 016 (see that feature's Validation Notes / this session's
saved memory on the practice): built two standalone HTML files
reproducing the real login-view and register-view markup against the
real `src/style.css`, screenshotted both. Confirmed: only one form
shows at a time, the toggle link is visible and reads clearly in both
directions, and an error (mocked "That username is taken.") renders
correctly above the register form.

## Test Notes
_Filled in during `/test` — what's covered, what's deliberately not._

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._
