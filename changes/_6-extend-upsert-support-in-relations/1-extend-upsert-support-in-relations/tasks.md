## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- Place relation tests by the parent operation: `db.parent.create(...)` belongs in a `create` describe, and `db.parent.update(...)` belongs in an `update` describe. For nested `upsert` inside `db.parent.upsert(...)`, use an existing `upsert` block or add an `upsert` block nested in the test suite's main describe.

## 1. orm

- [x] 1.1 Add HABTM upsert to parent create, including multi-query nested create.
  - 1.1.1 scope: HABTM create input typing and ordinary/batched nested-create relation and join-table lifecycle.
  - 1.1.2 acceptance: a parent `.create` or `.createMany` accepts one HABTM upsert object or an array, updates or creates every related row, and creates the correct join row for each result and parent.
  - 1.1.3 This behavior is already implemented for `hasMany`: read `has-many.create.ts` and implement the CTE-backed path similarly, using CTEs and ignoring the multi-query part while doing that comparison.
  - 1.1.4 Add the HABTM multi-query nested-create path similarly to `hasMany`, and cover it with `useMultiQueryNestedCreate` in the HABTM create tests.
  - 1.1.5 Cover object and array input, matched and missing related rows, lazy create callbacks, ordinary create, batched create pairing, and the forced multi-query strategy.
  - 1.1.6 verify implementation against guidelines
  - 1.1.7 code must be covered by tests
  - 1.1.8 tests and types must pass: run `pnpm verify`
  - 1.1.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.2 Allow multiple HABTM upserts in a single-record parent update.
  - 1.2.1 scope: HABTM nested-update input typing and per-item related-row/join-table update lifecycle.
  - 1.2.2 acceptance: a single-record parent update accepts an HABTM upsert object or array and independently updates-or-creates and connects every item, while a batch parent update remains rejected.
  - 1.2.3 This behavior is already implemented for `hasMany`: read `has-many.update.ts` and implement the CTE-backed behavior similarly, using CTEs and ignoring the multi-query part.
  - 1.2.4 Preserve existing single-item semantics, unique `findBy` typing, callbacks, scoped relations, and batch-update errors.
  - 1.2.5 Cover two items with mixed found/missing results as well as the existing object form and batch-update rejection.
  - 1.2.6 verify implementation against guidelines
  - 1.2.7 code must be covered by tests
  - 1.2.8 tests and types must pass: run `pnpm verify`
  - 1.2.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.3 Add HABTM upsert to the create branch of a parent upsert.
  - 1.3.1 scope: HABTM parent-upsert create-branch typing and CTE-guarded related-row and join-table writes.
  - 1.3.2 acceptance: a parent upsert create branch accepts one HABTM upsert object or an array, creates the required relation/join rows only when the parent is inserted, and leaves them unchanged when the parent update branch wins.
  - 1.3.3 This behavior is already implemented for `hasMany`: read `has-many.create.ts` and implement the CTE-backed path similarly, using CTEs and ignoring the multi-query part.
  - 1.3.4 Guard both the child upsert update and insert paths with the parent create CTE, and preserve correct parent-to-join-row pairing.
  - 1.3.5 Cover object and array input, found and missing related rows, and both parent-upsert branches.
  - 1.3.6 verify implementation against guidelines
  - 1.3.7 code must be covered by tests
  - 1.3.8 tests and types must pass: run `pnpm verify`
  - 1.3.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.4 Add belongsTo upsert to parent create.
  - 1.4.1 scope: belongs-to create-data type and single-object CTE-backed nested-create lifecycle.
  - 1.4.2 acceptance: parent create accepts one belongs-to upsert object, updates an existing related row or creates and connects a missing one, and rejects an array at the TypeScript level.
  - 1.4.3 This behavior is already implemented for `hasMany`: read `has-many.create.ts` and implement the CTE-backed path similarly, using CTEs and ignoring the multi-query part.
  - 1.4.4 Preserve existing belongs-to foreign-key direction, requiredness, scoped relations, callback behavior, and read-only typing.
  - 1.4.5 Cover existing and missing related rows, lazy create callbacks, and array rejection.
  - 1.4.6 verify implementation against guidelines
  - 1.4.7 code must be covered by tests
  - 1.4.8 tests and types must pass: run `pnpm verify`
  - 1.4.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.5 Add belongsTo upsert to the create branch of a parent upsert.
  - 1.5.1 scope: belongs-to parent-upsert create-data type and CTE-guarded nested relation lifecycle.
  - 1.5.2 acceptance: a parent upsert create branch accepts one belongs-to upsert object and performs its related update-or-create only when the parent insert branch wins.
  - 1.5.3 This behavior is already implemented for `hasMany`: read `has-many.create.ts` and implement the CTE-backed path similarly, using CTEs and ignoring the multi-query part.
  - 1.5.4 Preserve existing belongs-to relation wiring and ensure the parent update branch produces no related write.
  - 1.5.5 Cover parent-upsert insert and update branches, existing and missing related rows, lazy create callbacks, and array rejection.
  - 1.5.6 verify implementation against guidelines
  - 1.5.7 code must be covered by tests
  - 1.5.8 tests and types must pass: run `pnpm verify`
  - 1.5.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.6 Add hasOne upsert to parent create.
  - 1.6.1 scope: has-one create-data type and single-object CTE-backed nested-create lifecycle.
  - 1.6.2 acceptance: parent create accepts one has-one upsert object, updates an existing related row or creates and connects a missing one, and rejects an array at the TypeScript level.
  - 1.6.3 This behavior is already implemented for `hasMany`: read `has-many.create.ts` and implement the CTE-backed path similarly, using CTEs and ignoring the multi-query part.
  - 1.6.4 Preserve existing has-one foreign-key replacement, nullable requiredness, scoped relations, callback behavior, and read-only typing.
  - 1.6.5 Cover existing and missing related rows, lazy create callbacks, and array rejection.
  - 1.6.6 verify implementation against guidelines
  - 1.6.7 code must be covered by tests
  - 1.6.8 tests and types must pass: run `pnpm verify`
  - 1.6.9 reconcile `spec.md` for every new user-visible requirement

- [x] 1.7 Add hasOne upsert to the create branch of a parent upsert.
  - 1.7.1 scope: has-one parent-upsert create-data type and CTE-guarded nested relation lifecycle.
  - 1.7.2 acceptance: a parent upsert create branch accepts one has-one upsert object and performs its related update-or-create only when the parent insert branch wins.
  - 1.7.3 This behavior is already implemented for `hasMany`: read `has-many.create.ts` and implement the CTE-backed path similarly, using CTEs and ignoring the multi-query part.
  - 1.7.4 Preserve existing has-one relation replacement and ensure the parent update branch produces no related write.
  - 1.7.5 Cover parent-upsert insert and update branches, existing and missing related rows, lazy create callbacks, and array rejection.
  - 1.7.6 verify implementation against guidelines
  - 1.7.7 code must be covered by tests
  - 1.7.8 tests and types must pass: run `pnpm verify`
  - 1.7.9 reconcile `spec.md` for every new user-visible requirement

## 2. docs

- [x] 2.1 Document the completed nested relation-upsert matrix in `docs/src/guide/relation-queries.md`.
  - 2.1.1 Add examples for HABTM upsert in parent create, HABTM array upsert in parent update, HABTM upsert in a parent-upsert create branch, and the new create/parent-upsert forms for belongs-to and has-one.
  - 2.1.2 Explain the collection-versus-to-one cardinality distinction and retain the unique `findBy`, lazy-create, read-only, and batch-parent-update limits.

## 3. changeset

- [x] 3.1 Update `.changeset/lemon-tomatoes-own.md` for the completed relation-upsert scope.
  - 3.1.1 Follow `.agents/skills/changeset/SKILL.md` to update the existing changeset without creating another changeset.
