## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding

## 1. pqb

- [x] 1.1 Enforce effective mutation filter safety.
  - 1.1.1 Make `update`, `updateOrThrow`, `delete`, and `hardDelete` require an effective user-supplied predicate or explicit `all()`, so empty object filters and filters reduced to only ignored `undefined` values do not authorize mutation.
  - 1.1.2 Preserve read-query behavior for empty filters and preserve safe no-op mutation behavior for helpers such as empty `whereIn`/`notIn`.
  - 1.1.3 Keep explicitly selected named scopes that add conditions usable for scoped mutations, while making soft-delete's implicit non-deleted scope insufficient by itself.
  - 1.1.4 verify if the implementation conforms to guidelines
  - 1.1.5 make sure you didn't forget to cover the implementation with tests
  - 1.1.6 make sure the package test and typecheck commands are passing (`pnpm pqb check` and `pnpm pqb types`; `pqb` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. docs

- [x] 2.1 Document empty mutation filter safety.
  - 2.1.1 Update the root docs for `where`, `update`, `delete`, and soft delete so users know undefined filters remain valid for reads, but empty effective filters cannot authorize mutating queries unless `all()` is used.
