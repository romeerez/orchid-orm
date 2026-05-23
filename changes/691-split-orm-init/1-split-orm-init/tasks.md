## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow `guidelines/code.md` for coding

## 1. orm

- [x] 1.1 Add the table-only bundle API.
  - 1.1.1 Add the public table-bundle type and `bundleOrchidORMTables` export so table classes can be turned into a table-only ORM object with no root `$` ORM methods.
  - 1.1.2 Preserve current table query-shaping behavior in the bundle, including relations, metadata, table options, and reusable `makeHelper` support, while making execution without DB configuration fail clearly at runtime.
  - 1.1.3 Keep any metadata needed for later DB binding internal and out of the bundle's public enumerable table keys.
  - 1.1.4 verify if the implementation conforms to guidelines
  - 1.1.5 make sure you didn't forget to cover the implementation with tests
  - 1.1.6 make sure the package test and typecheck commands are passing (`pnpm orm check` and `pnpm orm types`; `orm` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.2 Add root DB binding from a table bundle.
  - 1.2.1 Add `makeOrchidOrmDbWithAdapter(orm, options)` to bind a table bundle to explicit adapter or existing query-builder options and return the same DB-aware `OrchidORM` shape as the existing constructor.
  - 1.2.2 Ensure each DB binding creates an independent DB-aware instance without mutating the original table bundle, while preserving existing raw query, transaction, `$withOptions`, `$from`, relation, `init` hook, RLS, and close behavior.
  - 1.2.3 Refactor `orchidORMWithAdapter(options, tables)` to use `bundleOrchidORMTables` and `makeOrchidOrmDbWithAdapter` without changing its public behavior.
  - 1.2.4 verify if the implementation conforms to guidelines
  - 1.2.5 make sure you didn't forget to cover the implementation with tests
  - 1.2.6 make sure the package test and typecheck commands are passing (`pnpm orm check` and `pnpm orm types`; `orm` is the folder name under `packages/`, not the `package.json` name)
  - 1.2.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.3 Add driver-specific DB binding wrappers.
  - 1.3.1 Export `makeOrchidOrmDb` from both `orchid-orm/node-postgres` and `orchid-orm/postgres-js` with the same driver-specific option types and adapter construction semantics as their existing `orchidORM` wrappers.
  - 1.3.2 Refactor driver-specific `orchidORM(options, tables)` wrappers to call `bundleOrchidORMTables` and their local `makeOrchidOrmDb`, preserving one-step setup behavior and keeping ORM-only options out of driver adapter config.
  - 1.3.3 verify if the implementation conforms to guidelines
  - 1.3.4 make sure you didn't forget to cover the implementation with tests
  - 1.3.5 make sure the package test and typecheck commands are passing (`pnpm orm check` and `pnpm orm types`; `orm` is the folder name under `packages/`, not the `package.json` name)
  - 1.3.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.4 Narrow bundled tables to a helper-only temporary surface.
  - 1.4.1 Replace the public bundled table value type with a minimal temporary table interface that exposes only `makeHelper`, while keeping bundle metadata sufficient for later DB binding.
  - 1.4.2 Redeclare the temporary table `makeHelper` signature so the callback and returned helper are bounded to the corresponding full DB-aware table query type, with `Args` and `Result` generics but no generic full-table `this` parameter.
  - 1.4.3 Ensure bundled tables do not type-check or behave as executable/queryable structures before DB binding, while helpers created from them remain usable on the DB-aware tables returned by the make functions.
  - 1.4.4 verify if the implementation conforms to guidelines
  - 1.4.5 make sure you didn't forget to cover the implementation with tests
  - 1.4.6 make sure the package test and typecheck commands are passing (`pnpm orm check` and `pnpm orm types`; `orm` is the folder name under `packages/`, not the `package.json` name)
  - 1.4.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. docs

- [x] 2.1 Document split ORM initialization after code support is complete.
  - 2.1.1 Update the ORM setup and adapter customization docs to keep one-step `orchidORM` as the recommended default, then show `bundleOrchidORMTables`, root `makeOrchidOrmDbWithAdapter`, and driver-specific `makeOrchidOrmDb` as an advanced two-step setup for reusable helpers before DB configuration.
  - 2.1.2 Document that the table bundle has no `$` ORM methods and that executing bundled table queries before DB binding fails at runtime, while `makeHelper` and other query-shaping use cases can be defined from the bundle.
- [x] 2.2 Correct split setup docs for helper-only bundled tables.
  - 2.2.1 Update the split setup docs to say bundled table objects expose only `makeHelper`, are not queryable table objects, and require the DB-aware ORM returned by a make function for all query-building, SQL generation, relation, metadata, and execution APIs.
