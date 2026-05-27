## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding

## 1. rake-db

- [x] 1.1 Support foreign-key-only column changes in the change-table DSL.
  - 1.1.1 Extend `changeTable` so bare single-column `t.foreignKey(...)` arguments under a column key are converted into reversible column foreign-key changes with the same SQL behavior as the equivalent typed-column foreign-key change.
  - 1.1.2 Add zero-argument `t.noForeignKey()` as a `t.change(...)` argument form that represents the absence of a foreign key on that side of the change, with add/drop target inferred from the opposite `t.foreignKey(...)` side.
  - 1.1.3 Preserve existing typed-column foreign-key changes, composite/table-level foreign keys, named constraint handling, `t.name(...)` column naming, and rollback reversal.
  - 1.1.4 verify if the implementation conforms to guidelines
  - 1.1.5 make sure you didn't forget to cover the implementation with tests
  - 1.1.6 make sure the package test and typecheck commands are passing (`pnpm rake-db check` and `pnpm rake-db types`; `rake-db` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. docs

- [x] 2.1 Document short foreign-key-only changes.
  - 2.1.1 Update the root migration writing docs to show `t.change(t.foreignKey(...), t.foreignKey(...))` for replacing a column foreign key and no-argument `t.noForeignKey()` for adding or dropping a foreign key without changing the column type.
