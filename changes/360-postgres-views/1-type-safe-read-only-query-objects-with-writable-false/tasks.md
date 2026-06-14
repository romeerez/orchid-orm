## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding

## 1. pqb

- [x] 1.1 Add query read-only capability metadata
  - 1.1.1 Add the type-level `readOnly` marker to the core query shape and route it through the `Db` generic so direct query-builder tables remain writable by default.
  - 1.1.2 Add a reusable mutable-query constraint for mutation APIs to share instead of duplicating literal property checks.
  - 1.1.3 verify if the implementation conforms to guidelines
  - 1.1.4 make sure you didn't forget to cover the implementation with tests
  - 1.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.2 Gate mutation APIs away from read-only queries
  - 1.2.1 Apply the shared mutable-query constraint to create, insert, create-from, update, delete, upsert, or-create, soft-delete hard delete, truncate, and mutation-only conflict/default helpers.
  - 1.2.2 Preserve all existing read-oriented query transformations and result-type behavior for writable and read-only queries.
  - 1.2.3 verify if the implementation conforms to guidelines
  - 1.2.4 make sure you didn't forget to cover the implementation with tests
  - 1.2.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.2.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. orm

- [x] 2.1 Map table `readOnly` declarations into query read-only capability
  - 2.1.1 Add the optional table-level `readOnly` property to ORM table input types and derive `true` only from the literal table value `true`.
  - 2.1.2 Pass the derived read-only capability flag through `TableToDb` into the new `Db` generic while preserving current behavior for tables that omit the property.
  - 2.1.3 verify if the implementation conforms to guidelines
  - 2.1.4 make sure you didn't forget to cover the implementation with tests
  - 2.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 2.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 3. docs

- [x] 3.1 Document table-level read-only queries
  - 3.1.1 Add concise user-facing documentation for `readonly readOnly = true`, including default behavior, read-only query availability, mutation type errors, no migration-generation impact, and the distinction from column `readOnly()`.

## 4. changeset

- [x] 4.1 Finalize the change.
  - 4.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
