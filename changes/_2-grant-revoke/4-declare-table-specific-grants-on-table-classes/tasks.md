## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding

## 1. pqb

- [x] 1.1 Add table-local grant metadata types
  - 1.1.1 Extend the public `Grant` namespace with a table-class grant shape that reuses existing role and table privilege types without exposing target keys or schema overrides.
  - 1.1.2 Preserve existing top-level grant metadata, generator-ignore, and internal grant shapes without adding SQL execution or ORM table-class knowledge to `pqb`.
  - 1.1.3 verify if the implementation conforms to guidelines
  - 1.1.4 make sure you didn't forget to cover the implementation with tests
  - 1.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. orm

- [x] 2.1 Add the standalone table grants API
  - 2.1.1 Add the exported standalone `setGrants` identity helper and table `grants` metadata type, without adding `setGrants` to the base table type or runtime class.
  - 2.1.2 Ensure table-local grants are preserved when ORM table classes are instantiated, cloned into db-bound tables, and exposed to migration generation without affecting query execution.
  - 2.1.3 verify if the implementation conforms to guidelines
  - 2.1.4 make sure you didn't forget to cover the implementation with tests
  - 2.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 2.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 2.2 Merge table grants into generated grant reconciliation
  - 2.2.1 Build a deterministic effective grant list from top-level grants plus normalized table-local grants after table schemas are resolved for generation.
  - 2.2.2 Ensure grant introspection is requested when either global grant metadata or table-local grant metadata exists, and keep the existing grant generator as the reconciliation owner.
  - 2.2.3 Preserve `defaultGrantedBy`, per-grant `grantedBy`, duplicate privilege merging, and grant-ignore behavior for table-local grants.
  - 2.2.4 verify if the implementation conforms to guidelines
  - 2.2.5 make sure you didn't forget to cover the implementation with tests
  - 2.2.6 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 2.2.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 2.3 Extend existing grant generator coverage
  - 2.3.1 Extend `packages/orm/src/migrations/generate/generators/grants.generator.test.ts` coverage so table-level grants declared on table classes are verified through the existing grant generator behavior.
  - 2.3.2 Include coverage for standalone `setGrants` declarations merging with top-level grant metadata rather than replacing it.
  - 2.3.3 verify if the implementation conforms to guidelines
  - 2.3.4 make sure you didn't forget to cover the implementation with tests
  - 2.3.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 2.3.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
