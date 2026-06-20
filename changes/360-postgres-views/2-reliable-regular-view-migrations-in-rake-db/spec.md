## Summary

Make generated regular-view migrations in `rake-db` reliable by preserving the documented `createView`/`dropView` option shape and generating the correct action for created and dropped views.

```ts
change(async (db) => {
  await db.createView(
    'analytics.activeUsers',
    {
      recursive: true,
      columns: ['id', 'name'],
      checkOption: 'LOCAL',
      securityBarrier: true,
      securityInvoker: true,
    },
    `SELECT id, name FROM "user" WHERE active`,
  );
});
```

```ts
change(async (db) => {
  await db.dropView(
    'analytics.activeUsers',
    {
      columns: ['id', 'name'],
      checkOption: 'LOCAL',
      securityBarrier: true,
      securityInvoker: true,
    },
    `SELECT id, name FROM "user" WHERE active`,
  );
});
```

## What Changes

- Generated regular-view migrations emit `db.createView` for create-view AST items and `db.dropView` for drop-view AST items.
- Generated option code matches the documented `createView`/`dropView` shape, including top-level `checkOption`, `securityBarrier`, and `securityInvoker` options.
- Generated migration code preserves explicit view column lists when they are present in view AST options, and pulled recursive views include the needed column list.
- Existing manual `createView` and `dropView` public APIs stay compatible.

## Capabilities

This idea does not introduce a standalone new capability. It completes the existing regular-view migration generation surface so it round-trips through the already documented regular-view migration API.

## Detailed Design

### Generated Migration API Shape

View AST items must generate migration code through the existing public `db.createView` and `db.dropView` methods.

```ts
await db.createView(
  'schema.viewName',
  {
    recursive: true,
    columns: ['id', 'name'],
    checkOption: 'LOCAL',
    securityBarrier: true,
    securityInvoker: true,
  },
  `SELECT ...`,
);
```

- `action: 'create'` generates `db.createView`.
- `action: 'drop'` generates `db.dropView` with the same SQL definition and recreation-relevant options so migration rollback can recreate the view.
- `checkOption`, `securityBarrier`, and `securityInvoker` must always be emitted at the top level of the options object.
- No generated migration may emit a nested `with` object for regular-view options.
- `columns` must be emitted when `RakeDbAst.ViewOptions.columns` is present.
- `recursive` must keep its current top-level option position.
- `createOrReplace`, `temporary`, `dropIfExists`, and `dropMode` remain part of `ViewOptions`, but generated pull/diff output should only emit them when the AST explicitly contains them.
- SQL strings and `RawSqlBase` values keep the existing generated code behavior, including `db.sql(...).values(...)` for SQL with values.

### Pull and AST Round Trip

Introspected regular views already flow through `DbStructure.View`, `structureToAst`, `RakeDbAst.View`, and `astToMigration`. That flow should remain the basis for generated view migrations.

- Introspection continues to load non-temporary regular views only; materialized views are out of scope for this idea.
- `structureToAst` continues to normalize PostgreSQL `reloptions` into top-level view options using the existing camel-case option names.
- `structureToAst` must keep `check_option`, `security_barrier`, and `security_invoker` as top-level `checkOption`, `securityBarrier`, and `securityInvoker` options so downstream generated code can emit the documented option shape.
- Recursive pulled views must populate `options.columns` from the introspected view columns so generated recursive `createView` code is runnable and matches the documented API shape.
- Non-recursive pulled views may omit `options.columns` unless the AST already contains an explicit column list, because PostgreSQL does not preserve whether a non-recursive view originally used explicit column aliases versus aliases in the `SELECT` definition.
- View dependencies, column type dependencies, and collation dependencies continue to be handled by the existing generate-item dependency analysis.

### Package Boundaries

- `rake-db` owns regular-view AST shape, introspection-to-AST conversion, dependency ordering, and migration code generation.
- No downstream query API, table definition API, first-class view declaration API, or materialized-view API changes are part of this idea.

### Error Handling and Limits

- Generated code must not add runtime validations that duplicate TypeScript guarantees or PostgreSQL validation.
- PostgreSQL still rejects invalid view definitions, invalid `WITH CHECK OPTION` usage, invalid recursive-view syntax, and unsupported option combinations through normal migration execution errors.
- Temporary views remain excluded from persistent pull/generate flows.
- The generator should not infer whether a regular view is writable or expose application write APIs; those concerns belong to other ideas in the Postgres Views feature.
