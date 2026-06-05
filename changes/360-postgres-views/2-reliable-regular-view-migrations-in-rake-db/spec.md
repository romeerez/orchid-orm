## Summary

Make generated regular-view migrations in `rake-db` reliable by preserving the documented `createView`/`dropView` option shape, generating the correct action for created and dropped views, and reporting view changes in generated migration summaries.

```ts
change(async (db) => {
  await db.createView(
    'reporting.activeUsers',
    {
      recursive: true,
      columns: ['id', 'name'],
      with: {
        checkOption: 'LOCAL',
        securityBarrier: true,
        securityInvoker: true,
      },
    },
    `SELECT id, name FROM "user" WHERE active`,
  );
});
```

```ts
change(async (db) => {
  await db.dropView(
    'reporting.activeUsers',
    {
      columns: ['id', 'name'],
      with: {
        checkOption: 'LOCAL',
        securityBarrier: true,
        securityInvoker: true,
      },
    },
    `SELECT id, name FROM "user" WHERE active`,
  );
});
```

## What Changes

- Generated regular-view migrations emit `db.createView` for create-view AST items and `db.dropView` for drop-view AST items.
- Generated option code matches the documented `createView`/`dropView` shape, including nested `with` options instead of top-level `checkOption`, `securityBarrier`, or `securityInvoker`.
- Generated migration code preserves explicit view column lists when they are present in view AST options, and pulled recursive views include the needed column list.
- Generated migration reports include regular view create/drop changes so users can see view changes in CLI output.
- Existing manual `createView` and `dropView` public APIs stay compatible.

## Capabilities

This idea does not introduce a standalone new capability. It completes the existing regular-view migration generation and reporting surfaces so they round-trip through the already documented regular-view migration API.

## Detailed Design

### Generated Migration API Shape

View AST items must generate migration code through the existing public `db.createView` and `db.dropView` methods.

```ts
await db.createView(
  'schema.viewName',
  {
    recursive: true,
    columns: ['id', 'name'],
    with: {
      checkOption: 'LOCAL',
      securityBarrier: true,
      securityInvoker: true,
    },
  },
  `SELECT ...`,
);
```

- `action: 'create'` generates `db.createView`.
- `action: 'drop'` generates `db.dropView` with the same SQL definition and recreation-relevant options so migration rollback can recreate the view.
- `checkOption`, `securityBarrier`, and `securityInvoker` must always be emitted under the documented `with` object.
- No generated migration may emit `checkOption`, `securityBarrier`, or `securityInvoker` at the top level of the options object.
- `columns` must be emitted when `RakeDbAst.ViewOptions.columns` is present.
- `recursive` must keep its current top-level option position.
- `createOrReplace`, `temporary`, `dropIfExists`, and `dropMode` remain part of `ViewOptions`, but generated pull/diff output should only emit them when the AST explicitly contains them.
- SQL strings and `RawSqlBase` values keep the existing generated code behavior, including `db.sql(...).values(...)` for SQL with values.

### Pull and AST Round Trip

Introspected regular views already flow through `DbStructure.View`, `structureToAst`, `RakeDbAst.View`, and `astToMigration`. That flow should remain the basis for generated view migrations.

- Introspection continues to load non-temporary regular views only; materialized views are out of scope for this idea.
- `structureToAst` continues to normalize PostgreSQL `reloptions` into `options.with` using the existing camel-case option names.
- `structureToAst` must keep `check_option`, `security_barrier`, and `security_invoker` under `options.with` so downstream generated code can emit the documented option shape.
- Recursive pulled views must populate `options.columns` from the introspected view columns so generated recursive `createView` code is runnable and matches the documented API shape.
- Non-recursive pulled views may omit `options.columns` unless the AST already contains an explicit column list, because PostgreSQL does not preserve whether a non-recursive view originally used explicit column aliases versus aliases in the `SELECT` definition.
- View dependencies, column type dependencies, and collation dependencies continue to be handled by the existing generate-item dependency analysis.

### Generated Migration Reports

Generated migration reporting must include regular view changes instead of silently skipping them.

- A create-view AST item reports a create-view line with the schema-qualified view name according to the current schema rules already used for other database objects.
- A drop-view AST item reports a drop-view line with the same naming rules.
- The report should stay concise and should not include SQL definitions or option objects.
- Including the number of view columns is acceptable when it follows the existing concise table-report style, but the minimum contract is that the action and view name are visible.
- Collations, rename-enum-values, and constraints may keep their current reporting behavior; this idea only changes view reporting.

### Package Boundaries

- `rake-db` owns regular-view AST shape, introspection-to-AST conversion, dependency ordering, and migration code generation.
- `orm` owns the human-readable generated migration report used by ORM migration generation.
- No `pqb` query API, ORM table definition API, first-class view declaration API, or materialized-view API changes are part of this idea.

### Error Handling and Limits

- Generated code must not add runtime validations that duplicate TypeScript guarantees or PostgreSQL validation.
- PostgreSQL still reports invalid view definitions, invalid `WITH CHECK OPTION` usage, invalid recursive-view syntax, and unsupported option combinations through normal migration execution errors.
- Temporary views remain excluded from persistent pull/generate flows.
- The generator should not infer whether a regular view is writable or expose ORM write APIs; those concerns belong to other ideas in the Postgres Views feature.

### Documentation

Docs should clarify that pulled/generated regular-view migrations use the same nested `with` option shape as manual `createView`/`dropView` migrations. The documentation should call out the generated migration behavior only where it helps users understand pull/generate output; it should not imply first-class ORM view declarations or materialized-view support for this idea.
