## Summary

Add `rake-db` migration support for PostgreSQL materialized views, including create, drop, refresh, generated migrations from pulled database structure, and indexes defined on materialized views.

```ts
import { change } from '../dbScript';

change(async (db) => {
  await db.createMaterializedView(
    'analytics.monthlySales',
    {
      columns: ['month', 'total'],
      withData: false,
    },
    `
      SELECT date_trunc('month', "createdAt") AS month, sum(total) AS total
      FROM "order"
      GROUP BY 1
    `,
  );

  await db.addIndex('analytics.monthlySales', ['month'], { unique: true });

  await db.refreshMaterializedView('analytics.monthlySales', {
    concurrently: true,
    withData: true,
  });
});
```

```ts
change(async (db) => {
  await db.dropMaterializedView(
    'analytics.monthlySales',
    {
      columns: ['month', 'total'],
      withData: false,
      dropIfExists: true,
      dropMode: 'CASCADE',
    },
    `SELECT date_trunc('month', "createdAt") AS month, sum(total) AS total FROM "order" GROUP BY 1`,
  );
});
```

## What Changes

- `rake-db` exposes `createMaterializedView`, `dropMaterializedView`, and `refreshMaterializedView` migration methods.
- Materialized-view migration options support explicit columns, create-time `WITH DATA` / `WITH NO DATA`, and drop-time `IF EXISTS` / drop mode.
- Pull and generated migrations include materialized views as distinct AST items and emit materialized-view migration calls instead of regular-view calls.
- Existing index introspection and generated index migrations include indexes whose target relation is a materialized view.
- The migration-writing docs explain materialized-view creation, dropping, refreshing, indexing, and PostgreSQL refresh constraints.

## Assumptions

- Materialized view pull/generation should create a distinct AST item instead of overloading the existing regular `view` item, because the SQL keywords, options, refresh behavior, and PostgreSQL constraints differ materially.
- `refreshMaterializedView` is a migration-time helper only in this idea; runtime ORM refresh ergonomics belong to later first-class materialized-view ORM work.

## Capabilities

- `materialized-view-ddl`: Adds a materialized-view migration AST and public migration methods for create, drop, pull, and generated migration output.
- `materialized-view-refresh`: Adds a public migration helper for `REFRESH MATERIALIZED VIEW` with PostgreSQL refresh options.

## Detailed Design

### Public Migration API

`Migration` gains materialized-view methods that mirror the existing regular-view ergonomics while using materialized-view-specific names and options:

```ts
interface MaterializedViewOptions {
  dropIfExists?: boolean;
  dropMode?: 'CASCADE' | 'RESTRICT';
  columns?: string[];
  withData?: boolean;
}

interface RefreshMaterializedViewOptions {
  concurrently?: boolean;
  withData?: boolean;
}

db.createMaterializedView(
  name: string,
  options: MaterializedViewOptions,
  sql: string | RawSqlBase,
): Promise<void>;

db.createMaterializedView(name: string, sql: string | RawSqlBase): Promise<void>;

db.dropMaterializedView(
  name: string,
  options: MaterializedViewOptions,
  sql: string | RawSqlBase,
): Promise<void>;

db.dropMaterializedView(name: string, sql: string | RawSqlBase): Promise<void>;

db.refreshMaterializedView(
  name: string,
  options?: RefreshMaterializedViewOptions,
): Promise<void>;
```

- `createMaterializedView` emits `CREATE MATERIALIZED VIEW <name> [ (columns) ] AS (<sql>)`.
- `withData: false` emits `WITH NO DATA`; `withData: true` emits `WITH DATA`; omitting `withData` omits the clause and lets PostgreSQL use its default.
- `dropMaterializedView` emits `DROP MATERIALIZED VIEW`, with `IF EXISTS` and drop mode only when the options include them.
- `dropMaterializedView` uses the supplied SQL and creation options only for rollback, matching the existing `dropView` contract.
- SQL definitions accept both strings and `RawSqlBase`, including SQL values, with the same generated SQL interpolation behavior as `createView`.
- Materialized-view methods must not expose regular-view options such as `temporary`, `recursive`, `createOrReplace`, `checkOption`, `securityBarrier`, or `securityInvoker`.

### Refresh Semantics

`refreshMaterializedView` emits `REFRESH MATERIALIZED VIEW <name>` with optional PostgreSQL clauses:

```ts
await db.refreshMaterializedView('analytics.monthlySales', {
  concurrently: true,
  withData: true,
});
```

- `concurrently: true` emits `CONCURRENTLY`.
- `withData: false` emits `WITH NO DATA`; `withData: true` emits `WITH DATA`; omitting `withData` omits the clause.
- `concurrently: true` with `withData: false` must be rejected by the migration helper before SQL execution because PostgreSQL forbids that combination and the option object makes the conflict explicit.
- Other PostgreSQL constraints remain database-enforced: concurrent refresh requires a suitable unique index, an already populated materialized view, and only one refresh may run at a time per materialized view.
- The helper is independent from generated migration diffs. Pull/generation should not emit refresh operations just because a materialized view is present or populated.

### AST and Generated Migrations

`RakeDbAst` gains a materialized-view item distinct from regular views:

```ts
interface MaterializedView {
  type: 'materializedView';
  action: 'create' | 'drop';
  schema?: string;
  name: string;
  shape: ColumnsShape;
  sql: RawSqlBase;
  options: MaterializedViewOptions;
  deps: { schemaName: string; name: string }[];
}
```

- Generated `action: 'create'` items emit `db.createMaterializedView`.
- Generated `action: 'drop'` items emit `db.dropMaterializedView` with the SQL definition and recreation-relevant options.
- Generated code must include `columns` when present on the AST.
- Generated code must include `withData` when present on the AST, including `false`.
- Generated code must not emit regular `createView` / `dropView` calls for materialized views.
- Dependency ordering treats materialized views as queryable relation objects with dependencies on referenced tables, views, materialized views, schemas, column types, collations, and indexes.
- The existing generated-migration summary should report created and dropped materialized views rather than ignoring them.

### Pull and Introspection

Pull/introspection loads non-temporary PostgreSQL materialized views separately from regular views.

- Introspection identifies materialized views with `pg_class.relkind = 'm'`.
- The structure data includes schema, name, column metadata, dependencies, reconstructed `SELECT` definition, whether PostgreSQL reports the materialized view as populated, and tablespace when available.
- The AST conversion records the SQL definition, columns shape, dependencies, and materialized-view options needed to recreate the object.
- `withData` should be represented only when the pulled state provides meaningful recreation intent. A populated materialized view may omit `withData` because PostgreSQL's create default is `WITH DATA`; an unpopulated materialized view should set `withData: false`.
- Existing regular-view introspection continues to include only `relkind = 'v'`.

### Indexes on Materialized Views

Materialized views use PostgreSQL's normal index machinery, so `rake-db` should keep index support in the existing index API and generated index AST.

- Users create materialized-view indexes with existing index migration methods such as `addIndex`.
- Index introspection and generated migrations must include indexes whose target relation is a materialized view.
- Materialized-view indexes participate in dependency ordering so they are created after the materialized view and dropped before it.
- No new materialized-view-specific index API is needed for this idea.

### Package Boundaries

- `rake-db` owns the migration methods, materialized-view AST, introspection, structure-to-AST conversion, generated migration code, dependency ordering, and generated migration summaries.
- `pqb`, `orm`, and `schema-configs` do not gain query, table, or validation APIs in this idea.
- First-class ORM materialized-view definitions, read-only query objects, runtime refresh helpers, and migration generation from ORM declarations are covered by other Postgres Views ideas.

### Error Handling and Limits

- PostgreSQL validates invalid materialized-view SQL, unsupported column lists, missing dependencies, duplicate object names, invalid drop modes, and concurrent-refresh prerequisites that depend on database state.
- The migration helper only rejects `concurrently: true` combined with `withData: false` because that invalid combination is fully known from the public options.
- Temporary materialized views are not supported because PostgreSQL does not provide `CREATE TEMP MATERIALIZED VIEW`.
- `CREATE OR REPLACE MATERIALIZED VIEW` is not supported because PostgreSQL does not support that syntax.
- Generated migrations do not try to preserve materialized-view contents; they recreate the object definition and indexes, not the stored rows.

### Documentation

Document materialized views next to regular view migration writing. The docs should show create/drop, `WITH NO DATA`, indexes, and refresh. They should call out that materialized views are read-only from direct DML, can be indexed, store potentially stale data, and require a suitable unique non-partial non-expression index for concurrent refresh.
