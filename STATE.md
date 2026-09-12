# Dev Loop State

This file is the single source of truth for where the project is in the
lifecycle. Every stage command reads it first and updates it last.

- **Outer iteration:** 0
- **Phase:** spec
- **Active feature:** (none)
- **Last updated:** 2026-08-31

## Phases

`spec -> features -> [implement -> test -> validate -> accept]* -> retro -> (back to spec)`

The inner loop (`implement`…`accept`) only ships the **current slice**:
features whose `iteration` equals **Outer iteration**. Other features stay
`deferred` until a later `/features`. `/retro` runs when that slice is done,
or mid-slice when `/accept` chooses "retro now"; it does not wait for the
whole backlog.

Valid values for **Phase**: `spec`, `features`, `implement`, `test`, `validate`,
`accept`, `retro`.

## History

<!-- Append a one-line entry here every time the phase changes, oldest last is fine, newest-first preferred. -->
- 2026-08-31 — scaffold created, phase set to `spec`
