## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding

## 1. pqb

- [x] 1.1 Add the materialized query capability
  - 1.1.1 Extend shared query and `Db` metadata so materialized query objects carry `__materialized: true | undefined` in the same style as `readOnly`.
  - 1.1.2 Preserve the marker through query construction, cloning, and read-oriented query transformations without changing normal table or regular-view behavior.
  - 1.1.3 verify if the implementation conforms to guidelines
  - 1.1.4 make sure you didn't forget to cover the implementation with tests
  - 1.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.2 Add the runtime materialized-view refresh helper
  - 1.2.1 Add `refreshMaterializedView` as a public extra query feature that accepts only materialized query objects and executes `REFRESH MATERIALIZED VIEW` using the query's schema-qualified relation name.
  - 1.2.2 Support `concurrently` and `withData` refresh options, including rejecting concurrent refresh with `WITH NO DATA` before SQL execution.
  - 1.2.3 verify if the implementation conforms to guidelines
  - 1.2.4 make sure you didn't forget to cover the implementation with tests
  - 1.2.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.2.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. rake-db

- [x] 2.1 Make `loadViews` cover materialized views
  - 2.1.1 Use the existing `loadViews` introspection option as the switch for both regular views and materialized views.
  - 2.1.2 Preserve materialized-view structure, AST conversion, generated migration output, and index handling when `loadViews` is enabled.
  - 2.1.3 verify if the implementation conforms to guidelines
  - 2.1.4 make sure you didn't forget to cover the implementation with tests
  - 2.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 2.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 3. orm

- [x] 3.1 Add first-class materialized view definition types
  - 3.1.1 Expose `BaseTable.MaterializedView` as a specialization of `BaseTable.View` with shared queryable view behavior, materialized metadata, `withData`, and no regular-view writable opt-in.
  - 3.1.2 Map materialized view classes into query objects with `readOnly: true` and `materialized: true` while keeping normal tables and regular views unchanged.
  - 3.1.3 verify if the implementation conforms to guidelines
  - 3.1.4 make sure you didn't forget to cover the implementation with tests
  - 3.1.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 3.1.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 3.2 Reuse ORM view registration for materialized views
  - 3.2.1 Accept materialized view classes in the existing `views` option and expose them through the existing `$views` namespace.
  - 3.2.2 Preserve relation resolution, duplicate database-name checks, grants, split ORM setup, and read-only relation behavior across tables, regular views, and materialized views.
  - 3.2.3 verify if the implementation conforms to guidelines
  - 3.2.4 make sure you didn't forget to cover the implementation with tests
  - 3.2.5 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 3.2.6 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 3.3 Generate materialized-view migrations from configured views
  - 3.3.1 Convert configured materialized view classes into desired materialized-view code items and `RakeDbAst.MaterializedView` entries with SQL, columns, dependencies, and `withData`.
  - 3.3.2 Reuse `generatorIgnore.views`, `generatorIgnore.schemas`, the existing view opt-in ownership model, and `loadViews` when reconciling regular and materialized views.
  - 3.3.3 Make generated migration output use materialized-view migration calls for materialized view classes and regular-view migration calls for regular view classes.
  - 3.3.4 verify if the implementation conforms to guidelines
  - 3.3.5 make sure you didn't forget to cover the implementation with tests
  - 3.3.6 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 3.3.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 4. docs

- [x] 4.1 Document first-class materialized views
  - 4.1.1 Add user-facing docs for `BaseTable.MaterializedView`, registration through `views`, querying through `$views`, default read-only behavior, `withData`, runtime refresh, generated migrations, indexes, refresh constraints, and `generatorIgnore.views`.

## 5. changeset

- [x] 5.1 Finalize the change
  - 5.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
