---
id: 017
title: Standard login/register flow
status: done
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

- [x] A logged-out visitor's default view is a login form only
      (username, password, submit) — the register form is not shown on
      the same page.
- [x] The login view has a visible link/button to a separate
      registration view.
- [x] The registration view has a visible link/button back to the
      login view.
- [x] Submitting a valid registration results in a clear next step
      (either signed in directly, or returned to login with a visible
      success indicator — implementer's call, note which was chosen).
- [x] Existing auth behavior is unchanged: duplicate username shows a
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

New file `tests/login-register-flow.test.ts` (6 tests, source-regex
convention — no jsdom in this project):

- Every guest-view construction site that should default to `"login"`
  (initial load with no session, API-unreachable catch block, logout,
  and a failed login) actually does — checked individually, not just
  "authView appears somewhere" (AC1).
- A failed registration's `authView` stays `"register"` — scanned
  `onRegister`'s whole body for `authView: "login"` and asserted it's
  never there (AC5's "existing error-surfacing" carried into the new
  per-form state, not just "an error shows somewhere").
- `render()` picks exactly one of `registerForm`/`loginForm` via a
  ternary, with a regression guard against the old always-both-forms
  concatenation (AC1).
- Both forms carry the other's toggle button (`#show-login` inside
  `registerForm`, `#show-register` inside `loginForm` — AC2/AC3), and
  both click handlers only flip `authView` + `render()`, with an
  explicit check that neither calls `api()`/`fetch` — confirms the
  toggle is a pure client-side view change, not a hidden network
  round-trip disguised as one.
- Registration still lands on `kind: "signed-in"` on success (the AC4
  choice made — signed in directly, not a "go log in" step).
- A consolidated check that both forms' ids/fields and submit wiring
  are untouched.

Ran the full suite 4 consecutive times (153/153 each, stable).

Deliberately not covered by new tests: the server-side auth guarantees
AC5 also names (duplicate-username error, generic failed-login error,
password hashing, session-survives-refresh) — all pre-existing,
unmodified, and already covered by `tests/auth.test.ts`, which still
passes unmodified (strong signal nothing there regressed). Also
deliberately not covered: real click-driven DOM interaction (no
jsdom/browser harness) — verified instead by building two standalone
HTML files with the real login-view/register-view markup against the
real `src/style.css` and screenshotting them with headless Chrome
during `/implement` (see Implementation Notes) — both forms rendered
correctly, exactly one at a time, with a working-looking toggle link
and error placement.

## Validation Notes
_Filled in during `/validate` — lint/typecheck/build/test results, and a check against each acceptance criterion above._

**Tooling:** `typecheck` clean (all 4 tsconfigs), `lint` clean (biome,
38 files), `build` clean (`vite build` + server `tsc`). Full test
suite: 153/153, run 5 consecutive times with no flakes.

**Live end-to-end walkthrough (curl against the real API):** register
→ `/api/me` immediately succeeds with the new session (AC4: signed in
directly, no separate login step needed) → logout → `/api/me` now 401
→ login with the same credentials → `/api/me` succeeds again. Confirms
the full real auth cycle this feature's client-side view sits on top of
is intact.

**Real rendered screenshots** (done during `/implement`, referenced
here): two standalone HTML files reproducing the actual login-view and
register-view markup against the actual `src/style.css`, screenshotted
with headless Chrome. Confirmed: exactly one form visible in each,
never both; each form's toggle link is visibly present and reads
correctly ("Need an account? Register" / "Already have an account? Log
in"); an error message (mocked "That username is taken.") renders
correctly above the register form in its usual place.

Per-criterion:
1. **Pass.** `render()`'s guest branch picks `loginForm` unless
   `view.authView === "register"`; every guest-view construction site
   that isn't "the register submission just failed" defaults to
   `"login"` (initial load, API-unreachable, logout, failed login) —
   checked individually in `tests/login-register-flow.test.ts`, not
   just "authView is present somewhere." Confirmed visually: the
   login-only screenshot shows no register fields at all.
2. **Pass.** `loginForm` contains `#show-register`
   ("Need an account? Register"), wired to flip `authView` client-side
   with no network call — confirmed in source and visually.
3. **Pass.** `registerForm` contains `#show-login`
   ("Already have an account? Log in"), same wiring — confirmed in
   source and visually.
4. **Pass.** Chose "signed in directly" (the simpler of AC4's two
   options): a successful `/api/register` already creates a session
   (unchanged from feature 002), and `onRegister` moves straight to
   `kind: "signed-in"` — confirmed live via curl (`/api/me` succeeds
   immediately after register, no separate login round-trip needed).
5. **Pass.** All server-side guarantees this criterion names (hashing,
   duplicate-username error, generic failed-login error,
   session-survives-refresh) are untouched code (`server/auth.ts` /
   `server/app.ts` not modified by this feature) and still pass their
   original tests in `tests/auth.test.ts`, unmodified, run alongside
   the rest of the suite above. Live walkthrough above also confirms
   the session round-trip end to end.

**Outcome: all 5 acceptance criteria pass**, verified with live API
calls and real rendered screenshots, not just source inspection. No
bounce-back needed.

## Acceptance Log
_Filled in during `/accept` — what the user said, and the decision (accepted / changes requested / rejected)._

2026-09-20 — Asked via AskUserQuestion after validation passed: **"Accept
and continue."** Slice continues with 018-dashboard-shell, the last
current-slice backlog item.
