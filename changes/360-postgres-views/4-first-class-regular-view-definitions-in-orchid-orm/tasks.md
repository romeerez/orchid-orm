## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding

## 1. pqb

- [x] 1.1 Extend shared generator ignore typing for views
  - 1.1.1 Add a top-level `generatorIgnore.views` selector shape that supports exact string selectors and regular expressions while preserving existing ignore options.
  - 1.1.2 verify if the implementation conforms to guidelines
  - 1.1.3 make sure you didn't forget to cover the implementation with tests
  - 1.1.4 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.5 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. rake-db

- [x] 2.1 Make regular-view db-structure loading opt-in
  - 2.1.1 Add an introspection option for loading regular views and return no regular-view structure by default when the option is omitted.
  - 2.1.2 Preserve existing regular-view structure shape and materialized-view behavior when regular-view loading is enabled.
  - 2.1.3 verify if the implementation conforms to guidelines
  - 2.1.4 make sure you didn't forget to cover the implementation with tests
  - 2.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 2.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 3. orm

- [x] 3.1 Add first-class regular view definition types
  - 3.1.1 Expose `BaseTable.View` with table-like column, schema, computed, scope, relation, soft-delete, and grant APIs plus view-specific `name`, `sql`, option, read-only, and no-primary-key defaults.
  - 3.1.2 Keep table-only configuration out of the view contract, including table RLS and auto foreign key generation.
  - 3.1.3 verify if the implementation conforms to guidelines
  - 3.1.4 make sure you didn't forget to cover the implementation with tests
  - 3.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 3.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 3.2 Register views in ORM setup and expose `$views`
  - 3.2.1 Accept `views` in the first options argument for `orchidORM`, adapter-specific `orchidORM`, and `orchidORMWithAdapter`; rename `bundleOrchidORMTables` to `bundleOrchidORM` and make it accept one object with optional `tables` and optional `views`.
  - 3.2.2 Build DB-aware view queries under `db.$views`, map view `name` to query SQL relation name, apply schema handling, and default omitted `readOnly` to read-only query capability.
  - 3.2.3 Reject duplicate schema-qualified database names across configured tables and views.
  - 3.2.4 verify if the implementation conforms to guidelines
  - 3.2.5 make sure you didn't forget to cover the implementation with tests
  - 3.2.6 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 3.2.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 3.3 Resolve relations across table and view registries
  - 3.3.1 Update relation application so relation thunks can resolve related classes from both configured tables and configured views.
  - 3.3.2 Preserve read-only capability in relation queries and avoid generating auto foreign keys for view relations.
  - 3.3.3 verify if the implementation conforms to guidelines
  - 3.3.4 make sure you didn't forget to cover the implementation with tests
  - 3.3.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 3.3.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 3.4 Reconcile configured regular views in generated migrations
  - 3.4.1 Add configured view code items to migration generation with schema, name, shape, SQL, dependencies, grants, and supported regular-view options.
  - 3.4.2 Request regular-view introspection only when ORM views are configured, and otherwise preserve existing database views by not loading them.
  - 3.4.3 Apply `generatorIgnore.views` and `generatorIgnore.schemas` to view reconciliation, including views present only in code or only in the database.
  - 3.4.4 Generate regular-view migration options with `columns` derived from declared view columns and with only the supported `recursive`, `checkOption`, `securityBarrier`, and `securityInvoker` options.
  - 3.4.5 verify if the implementation conforms to guidelines
  - 3.4.6 make sure you didn't forget to cover the implementation with tests
  - 3.4.7 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 3.4.8 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 4. docs

- [x] 4.1 Document first-class regular views
  - 4.1.1 Add user-facing docs for `BaseTable.View`, `$views`, supported view options, default read-only behavior, write opt-in, relation support, grants, and migration-generator opt-in ownership.
- [x] 4.2 Document view ignore configuration
  - 4.2.1 Update migration generation docs with `generatorIgnore.views`, including string and regular-expression selectors and how it differs from grant-specific ignores.

## 5. changeset

- [x] 5.1 Finalize the change
  - 5.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
