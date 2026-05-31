## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding

## 1. rake-db

- [x] 1.1 Remove the `noForeignKey` migration helper.
  - 1.1.1 Remove `t.noForeignKey()` from the change-table public type surface, runtime implementation, validation branches, and tests that only exist for that helper.
  - 1.1.2 Preserve `t.change(t.foreignKey(...), t.foreignKey(...))` as the supported foreign-key replacement form.
  - 1.1.3 verify if the implementation conforms to guidelines
  - 1.1.4 make sure you didn't forget to cover the implementation with tests
  - 1.1.5 make sure the package test and typecheck commands are passing (`pnpm rake-db check` and `pnpm rake-db types`; `rake-db` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

- [x] 1.2 Add standalone column helper inputs for `t.change(...)`.
  - 1.2.1 Extend the change-table DSL so column-keyed `t.change(...)` can consume standalone `primaryKey`, `index`, `unique`, and `exclude` helper values as metadata-only column changes.
  - 1.2.2 Keep standalone `check` and single-column `foreignKey` change support working under the same normalization path.
  - 1.2.3 Preserve table-level overloads for composite primary keys, indexes, unique indexes, excludes, checks, and foreign keys.
  - 1.2.4 verify if the implementation conforms to guidelines
  - 1.2.5 make sure you didn't forget to cover the implementation with tests
  - 1.2.6 make sure the package test and typecheck commands are passing (`pnpm rake-db check` and `pnpm rake-db types`; `rake-db` is the folder name under `packages/`, not the `package.json` name)
  - 1.2.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

- [x] 1.3 Support standalone column helpers in `t.add(...)` and `t.drop(...)`.
  - 1.3.1 Make column-keyed `t.add(...)` convert standalone `check`, `foreignKey`, `primaryKey`, `index`, `unique`, and `exclude` values into metadata-only add changes with rollback reversal.
  - 1.3.2 Make column-keyed `t.drop(...)` convert the same standalone helper values into metadata-only drop changes with rollback reversal.
  - 1.3.3 Ensure standalone helper add/drop does not add or drop the column itself and still respects `t.name(...)`, `snakeCase`, names, options, and `dropMode`.
  - 1.3.4 verify if the implementation conforms to guidelines
  - 1.3.5 make sure you didn't forget to cover the implementation with tests
  - 1.3.6 make sure the package test and typecheck commands are passing (`pnpm rake-db check` and `pnpm rake-db types`; `rake-db` is the folder name under `packages/`, not the `package.json` name)
  - 1.3.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. docs

- [x] 2.1 Document standalone change helpers and remove `noForeignKey`.
  - 2.1.1 Update root migration writing docs so column-keyed add, drop, and change examples use standalone helpers for primary keys, checks, foreign keys, indexes, unique indexes, and excludes.
  - 2.1.2 Remove `t.noForeignKey()` mentions and replace foreign-key add/drop examples with `t.add(t.foreignKey(...))` and `t.drop(t.foreignKey(...))`.
