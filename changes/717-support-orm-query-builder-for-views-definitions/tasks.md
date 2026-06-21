## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding

## 1. pqb

- [ ] 1.1 Expose a stable query-definition SQL shape for ORM consumers
  - 1.1.1 Ensure ORM code can type and recognize read query objects that can be compiled to SQL for view DDL without relying on an overly broad public type.
  - 1.1.2 Preserve the query's existing SQL text and bind values when it is converted for non-executing DDL use.
  - 1.1.3 verify if the implementation conforms to guidelines
  - 1.1.4 make sure you didn't forget to cover the implementation with tests
  - 1.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. orm

- [ ] 2.1 Add the regular view `query` definition property
  - 2.1.1 Add or rename the regular view definition contract so `BaseTable.View` stores definition input in `query`, accepting existing raw SQL values or a read query object produced by the ORM query builder.
  - 2.1.2 Keep raw SQL expression support and existing view runtime query behavior unchanged.
  - 2.1.3 verify if the implementation conforms to guidelines
  - 2.1.4 make sure you didn't forget to cover the implementation with tests
  - 2.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 2.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [ ] 2.2 Capture final view query after `init(db)`
  - 2.2.1 Make `query` assigned or replaced during a configured view's `init(db)` callback available to migration generation as the view's final definition source.
  - 2.2.2 Preserve existing `init` hook behavior for tables and views while updating only the view DDL metadata that depends on `query`.
  - 2.2.3 verify if the implementation conforms to guidelines
  - 2.2.4 make sure you didn't forget to cover the implementation with tests
  - 2.2.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 2.2.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [ ] 2.3 Normalize view query definitions for generated migrations
  - 2.3.1 Convert `query` values into the same migration AST SQL representation currently used by regular view migrations, preserving SQL text and bind values.
  - 2.3.2 Keep regular-view diffing and generated `createView` output behavior aligned for raw SQL expression and query-builder definitions.
  - 2.3.3 verify if the implementation conforms to guidelines
  - 2.3.4 make sure you didn't forget to cover the implementation with tests
  - 2.3.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 2.3.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 3. docs

- [ ] 3.1 Document query-built regular view definitions
  - 3.1.1 Update the view guide with the `query` property, the `init(db)` query-builder workflow, how it relates to raw SQL expressions, and note that generated migrations compile the query instead of executing it.

## 4. changeset

- [ ] 4.1 Finalize the change
  - 4.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
