# Changelog

> Appended by `/accept` every time a feature is accepted by the user.

<!-- Format:
## 2026-08-31 — Feature title (features/001-slug.md)
What shipped, in user-facing terms.
-->

## 2026-09-12 — App scaffold (features/001-app-scaffold.md)

Local app shell: `npm run dev` starts a Vite page and a Node HTTP API.
The API creates `data/poker.sqlite` on first start and answers
`GET /api/health`. TypeScript on both sides; `npm run typecheck` and
`npm run build` work. No login or cards yet.
