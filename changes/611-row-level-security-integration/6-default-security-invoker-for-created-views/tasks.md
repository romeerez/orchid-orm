## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding

## 1. rake-db

- [x] 1.1 Default created views to security invoker
  - 1.1.1 Change manual view creation semantics so omitted `with.securityInvoker` creates views with security-invoker behavior, while explicit `securityInvoker: false` remains an opt-out.
  - 1.1.2 Preserve existing create-view options, rollback behavior, SQL parameter interpolation, and drop-side SQL semantics while applying the new create-side default.
  - 1.1.3 verify if the implementation conforms to guidelines
  - 1.1.4 make sure you didn't forget to cover the implementation with tests
  - 1.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. docs

- [x] 2.1 Document the security-invoker view default
  - 2.1.1 Update create-view user docs to state that `securityInvoker: true` is Orchid's default because it is safer for views over RLS-managed tables, and show `securityInvoker: false` as the explicit opt-out.
  - 2.1.2 Keep the RLS docs focused on the view security-invoker behavior in this change, without adding uniqueness-check or foreign-key guidance.

## 3. changeset

- [x] 3.1 Finalize the change
  - 3.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
