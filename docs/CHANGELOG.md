# Changelog

> Appended by `/accept` every time a feature is accepted by the user.

<!-- Format:
## 2026-08-31 — Feature title (features/001-slug.md)
What shipped, in user-facing terms.
-->

## 2026-09-19 — Sit down and leave the table (features/004-sit-table.md)

A logged-in player can sit at a 6-max cash table with one click. Sitting
buys in 200 chips from the tab onto the table (blinds 1/2 play-money),
joined by five computer seats so the table is never short-handed.
Leaving — or ending the session while seated — settles the table stack
back to the tab. A tab under 200 can't sit down, and a logged-out
visitor can't either. Cards and betting are not part of this feature.

## 2026-09-19 — Running tab (features/003-running-tab.md)

Every account has a play-money running tab stored in SQLite, starting
at 1,000 chips on registration. Logged-in players can see their
current tab, and it survives a page reload. Two accounts' tabs are
independent. There is no deposit, withdrawal, cash-out, or
real-currency conversion control.

## 2026-09-14 — Register, log in, and log out (features/002-auth.md)

Players can register with a username and password, log in, and log out.
The session survives a page refresh (HttpOnly cookie). Passwords are
hashed with scrypt in SQLite. Duplicate usernames and failed logins
show a visible error. Logged-out visitors cannot sit at a table. No
email, OAuth, or social login.

## 2026-09-12 — App scaffold (features/001-app-scaffold.md)

Local app shell: `npm run dev` starts a Vite page and a Node HTTP API.
The API creates `data/poker.sqlite` on first start and answers
`GET /api/health`. TypeScript on both sides; `npm run typecheck` and
`npm run build` work. No login or cards yet.
