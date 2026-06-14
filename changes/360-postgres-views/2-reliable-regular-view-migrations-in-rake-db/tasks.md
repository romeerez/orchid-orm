## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding

## 1. rake-db

- [ ] 1.1 Generate documented regular-view migration calls
  - 1.1.1 Make generated view migrations select `createView` or `dropView` from the view AST action while preserving existing SQL string and SQL-values output behavior.
  - 1.1.2 Emit view options in the documented shape, including nested `with` options and explicit `columns` when present on the AST.
  - 1.1.3 verify if the implementation conforms to guidelines
  - 1.1.4 make sure you didn't forget to cover the implementation with tests
  - 1.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [ ] 1.2 Preserve pulled recursive view column lists
  - 1.2.1 Carry the introspected column names into `RakeDbAst.ViewOptions.columns` for recursive regular views so generated `createView` code is runnable.
  - 1.2.2 Preserve existing regular-view dependency ordering and option normalization while adding the recursive column-list behavior.
  - 1.2.3 verify if the implementation conforms to guidelines
  - 1.2.4 make sure you didn't forget to cover the implementation with tests
  - 1.2.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.2.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
