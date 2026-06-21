## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding

## 1. pqb

- [x] 1.1 Carry definition-side generator ignore metadata on query internals.
  - 1.1.1 Add internal query metadata for table-like definitions that opt out of migration generation without changing query execution behavior.
  - 1.1.2 Preserve existing config-level `generatorIgnore` database options and avoid broadening `GeneratorIgnore` selector types for this feature.
  - 1.1.3 verify if the implementation conforms to guidelines
  - 1.1.4 make sure you didn't forget to cover the implementation with tests
  - 1.1.5 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. orm

- [x] 2.1 Add the table-like definition API and normalize it into query metadata.
  - 2.1.1 Add `generatorIgnore?: true` to ordinary table, regular view, and materialized view definition types.
  - 2.1.2 Copy literal `generatorIgnore = true` from table and view class instances into the query internal metadata used by migration generation.
  - 2.1.3 Keep ignored definitions queryable and preserve existing read-only, materialized-view, relation, schema, RLS, and grants metadata behavior.
  - 2.1.4 verify if the implementation conforms to guidelines
  - 2.1.5 make sure you didn't forget to cover the implementation with tests
  - 2.1.6 make sure the package test and typecheck commands are passing (`pnpm orm check` and `pnpm orm types`; `orm` is the folder name under `packages/`, not the `package.json` name)
  - 2.1.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

- [x] 2.2 Apply definition-side ignore in table migration generation.
  - 2.2.1 Treat ignored code table definitions as unmanaged for table create, change, schema-move, drop, and nested table reconciliation.
  - 2.2.2 Make definition-side table ignore idempotent with config-level `generatorIgnore.schemas` and `generatorIgnore.tables`.
  - 2.2.3 Preserve existing top-level table ignore behavior for RLS and grants rather than introducing new partial-management semantics.
  - 2.2.4 verify if the implementation conforms to guidelines
  - 2.2.5 make sure you didn't forget to cover the implementation with tests
  - 2.2.6 make sure the package test and typecheck commands are passing (`pnpm orm check` and `pnpm orm types`; `orm` is the folder name under `packages/`, not the `package.json` name)
  - 2.2.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

- [x] 2.3 Apply definition-side ignore in regular and materialized view generation.
  - 2.3.1 Treat ignored regular view definitions as unmanaged for create, change, recreate, and drop reconciliation.
  - 2.3.2 Treat ignored materialized view definitions as unmanaged for create, change, recreate, drop, and materialized-view-owned index reconciliation.
  - 2.3.3 Make definition-side view ignore idempotent with config-level `generatorIgnore.schemas` and `generatorIgnore.views`.
  - 2.3.4 Preserve existing grant behavior so view grants still require grant-specific ignore controls when they should be unmanaged.
  - 2.3.5 verify if the implementation conforms to guidelines
  - 2.3.6 make sure you didn't forget to cover the implementation with tests
  - 2.3.7 make sure the package test and typecheck commands are passing (`pnpm orm check` and `pnpm orm types`; `orm` is the folder name under `packages/`, not the `package.json` name)
  - 2.3.8 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 3. docs

- [x] 3.1 Document definition-side generator ignore.
  - 3.1.1 Update generated migration docs to show `generatorIgnore = true` on table and view classes as a local alternative to config-level `generatorIgnore.tables` and `generatorIgnore.views`.
  - 3.1.2 Update view docs to mention the option for both regular and materialized views while keeping config-level selectors and grant-specific ignore behavior clear.

## 4. changeset

- [x] 4.1 Finalize the change
  - 4.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
