## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding

## 1. pqb

- [x] 1.1 Tighten the table RLS `permit` type
  - 1.1.1 Update the RLS declaration type so `permit` is required and must be a non-empty policy list.
  - 1.1.2 Keep the type-only change scoped to `packages/pqb/src/query/extra-features/rls/rls.db.ts` and avoid adding runtime validation.
  - 1.1.3 verify if the implementation conforms to guidelines
  - 1.1.4 make sure you didn't forget to cover the implementation with tests
  - 1.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. orm

- [x] 2.1 Change code-side RLS `force` default to true
  - 2.1.1 Update migration generation so declared tables that omit `force` normalize to `true` after project `tableRlsDefaults` are applied.
  - 2.1.2 Preserve PostgreSQL/database normalization as unforced by default, so the generator still detects when Orchid's desired forced state differs from the database's default state.
  - 2.1.3 Preserve explicit `force: false` and project `tableRlsDefaults.force: false` as opt-outs from Orchid's safer omitted default.
  - 2.1.4 verify if the implementation conforms to guidelines
  - 2.1.5 make sure you didn't forget to cover the implementation with tests
  - 2.1.6 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 2.1.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 3. docs

- [x] 3.1 Explain the safer Orchid RLS force default
  - 3.1.1 Update the RLS and migration-generation docs to state that omitted `force` defaults to `true` in Orchid, explain why this intentionally differs from PostgreSQL's owner-bypass default, and show the `force: false` opt-out paths.
  - 3.1.2 Update examples that currently show `tableRlsDefaults.force: false` as an ordinary default so they no longer conflict with the new behavior.

## 4. changeset

- [x] 4.1 Finalize the change
  - 4.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
