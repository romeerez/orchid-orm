## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding

## 1. rake-db

- [x] 1.1 Support check-only column changes in the change-table DSL.
  - 1.1.1 Extend `t.change(...)` so `t.check(...)` arguments under a column key are converted into reversible column check changes with the same SQL behavior as the equivalent typed-column check change.
  - 1.1.2 Preserve existing table-check `t.add(t.check(...))` and `t.drop(t.check(...))` behavior, named check handling, `t.name(...)` column naming, and rollback reversal.
  - 1.1.3 verify if the implementation conforms to guidelines
  - 1.1.4 make sure you didn't forget to cover the implementation with tests
  - 1.1.5 make sure the package test and typecheck commands are passing (`pnpm rake-db check` and `pnpm rake-db types`; `rake-db` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. docs

- [x] 2.1 Document short check-only changes.
  - 2.1.1 Update the root migration writing docs to show `t.change(t.check(...), t.check(...))` as the concise way to change a column check constraint without changing the column type.
