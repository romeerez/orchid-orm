## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding

## 1. pqb

- [x] 1.1 Add grant metadata types and shared options
  - 1.1.1 Add the public grant metadata type surface to shared database options, including target-specific privilege unions, statement-like grant declarations with non-empty role arrays, optional grantor metadata, and selector-based `generatorIgnore.grants`.
  - 1.1.2 Store normalized grant declarations and `defaultGrantedBy` on query internal metadata without adding SQL execution, database validation, introspection, or migration generation behavior.
  - 1.1.3 Preserve existing roles, default-privileges, RLS, extension, domain, and generator-ignore behavior while adding grant metadata and grant-ignore selectors.
  - 1.1.4 verify if the implementation conforms to guidelines
  - 1.1.5 make sure you didn't forget to cover the implementation with tests
  - 1.1.6 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. orm

- [x] 2.1 Preserve grant metadata through ORM setup
  - 2.1.1 Ensure `orchidORM` adapter/setup options accept `defaultGrantedBy` and `grants` through the existing shared options path for all supported adapters.
  - 2.1.2 Ensure ORM migration generation receives but does not act on grant metadata or `generatorIgnore.grants` until the later grant generator idea is implemented.
  - 2.1.3 Cover the ORM-facing setup behavior and the no-generated-SQL boundary where existing generator tests make that boundary visible.
  - 2.1.4 verify if the implementation conforms to guidelines
  - 2.1.5 make sure you didn't forget to cover the implementation with tests
  - 2.1.6 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 2.1.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
