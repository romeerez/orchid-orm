## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding

## 1. orm

- [x] 1.1 Infer omitted `belongsTo.required` from local column nullability.
  - 1.1.1 scope: `belongsTo` option typing and relation application in `packages/orm/src/relations` and `packages/orm/src/orm-table`
  - 1.1.2 acceptance: omitting `required` makes a `belongsTo` required when all local `columns` are non-nullable, optional when any local column is nullable, and still respects explicit `required: true` or `required: false`
  - 1.1.3 Add type-level effective requiredness for `belongsTo` options so selected relation results, `queryRelated`, nested create input, chained relations, and through relations observe the inferred default.
  - 1.1.4 Add runtime effective requiredness for relation application so non-nullable omitted-`required` `belongsTo` relations act exactly as if the user wrote `required: true`, including the same required relation query mode and returned-record behavior.
  - 1.1.5 Cover single-column non-nullable inference, single-column nullable inference, explicit override behavior, and composite-key behavior where all local columns versus some local columns are nullable.
  - 1.1.6 Verify generated or pulled `belongsTo` definitions that omit `required` benefit from inference without adding generated boilerplate.
  - 1.1.7 verify implementation against guidelines
  - 1.1.8 code must be covered by tests
  - 1.1.9 tests and types must pass for `orm`: `pnpm orm check` and `pnpm orm types`
  - 1.1.10 reconcile `spec.md` for every new user-visible requirement

## 2. docs

- [ ] 2.1 Document inferred `belongsTo` requiredness.
  - 2.1.1 Update the relations guide to explain that omitted `required` is inferred from local `columns` nullability for `belongsTo`.
  - 2.1.2 Show non-nullable and nullable local foreign-key examples, including composite-key behavior and explicit override guidance.

## 3. changeset

- [ ] 3.1 Finalize the change.
  - 3.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
