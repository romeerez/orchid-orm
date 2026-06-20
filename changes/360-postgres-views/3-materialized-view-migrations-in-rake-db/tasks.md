## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding

## 1. rake-db

- [x] 1.1 Add materialized-view migration methods
  - 1.1.1 Add public migration methods and supporting AST/options that emit `CREATE MATERIALIZED VIEW`, `DROP MATERIALIZED VIEW`, and `REFRESH MATERIALIZED VIEW` with the contract from `spec.md`.
  - 1.1.2 Preserve existing regular-view behavior while sharing only the generic SQL-name, SQL-value, and rollback semantics that apply to both object kinds.
  - 1.1.3 Enforce the explicit refresh option conflict for concurrent refresh with `WITH NO DATA`.
  - 1.1.4 verify if the implementation conforms to guidelines
  - 1.1.5 make sure you didn't forget to cover the implementation with tests
  - 1.1.6 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.2 Pull materialized views into database structure
  - 1.2.1 Extend introspection to load non-temporary materialized views with columns, dependencies, definition SQL, populated state, and available storage metadata while leaving regular-view introspection scoped to regular views.
  - 1.2.2 Convert pulled materialized views into distinct materialized-view AST items with recreation options that preserve unpopulated views as `withData: false`.
  - 1.2.3 verify if the implementation conforms to guidelines
  - 1.2.4 make sure you didn't forget to cover the implementation with tests
  - 1.2.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.2.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.3 Generate materialized-view migration code
  - 1.3.1 Make AST-to-migration output use `createMaterializedView` and `dropMaterializedView` for materialized-view AST items, including columns, `withData`, raw SQL strings, and SQL values.
  - 1.3.2 Add materialized views to generate-item dependency analysis and generated migration summaries so created, dropped, and indexed materialized views appear in the right order and are visible to users.
  - 1.3.3 verify if the implementation conforms to guidelines
  - 1.3.4 make sure you didn't forget to cover the implementation with tests
  - 1.3.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.3.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.4 Include materialized-view indexes in generated migrations
  - 1.4.1 Ensure index introspection and generated index items include indexes whose target relation is a materialized view.
  - 1.4.2 Preserve normal index API behavior and dependency ordering instead of adding a materialized-view-specific index surface.
  - 1.4.3 verify if the implementation conforms to guidelines
  - 1.4.4 make sure you didn't forget to cover the implementation with tests
  - 1.4.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.4.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. docs

- [x] 2.1 Document materialized-view migrations
  - 2.1.1 Add migration-writing docs for creating, dropping, indexing, and refreshing materialized views, including `WITH NO DATA`, `CONCURRENTLY`, and PostgreSQL's concurrent-refresh constraints.

## 3. changeset

- [x] 3.1 Finalize the change
  - 3.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
