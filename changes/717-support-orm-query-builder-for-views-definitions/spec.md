## Summary

Allow first-class ORM view definitions to use a `query` property instead of `sql` for the definition source. The `query` property may hold either a raw SQL expression or an Orchid ORM query builder object assigned from a view class `init` callback where the DB-aware ORM instance is available. Generated migrations compile that definition source to SQL for `createView`.

```ts
import { orchidORM } from 'orchid-orm';
import { BaseTable } from './base-table';
import { SaleTable } from './sale.table';
import { UserTable } from './user.table';

export class MonthlySalesView extends BaseTable.View {
  readonly name = 'monthly_sales';

  columns = this.setColumns((t) => ({
    userId: t.integer(),
    total: t.decimal(),
  }));

  init(db: typeof appDb) {
    this.query = db.sale
      .select({
        userId: 'userId',
        total: (q) => q.sum('total'),
      })
      .group('userId');
  }
}

export const appDb = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    views: {
      monthlySales: MonthlySalesView,
    },
  },
  {
    sale: SaleTable,
    user: UserTable,
  },
);
```

```ts
export class ActiveUsersView extends BaseTable.View {
  readonly name = 'active_users';

  columns = this.setColumns((t) => ({
    id: t.integer(),
    name: t.text(),
  }));

  query = BaseTable.sql`SELECT id, name FROM "user" WHERE active = true`;
}
```

## What Changes

- `BaseTable.View` uses `query` as the view definition property, accepting either existing raw SQL forms or a read query built with Orchid's ORM query builder.
- View class `init(db)` may assign or replace `this.query` using `db` table and view queries; this is the preferred workflow for view definitions that need ORM query access.
- Migration generation compiles query-built view definitions into the existing regular-view migration AST so generated `createView` and view comparison behavior stays unchanged.
- Runtime view querying through `db.$views` remains separate from the view definition query used by migrations.
- Raw SQL expressions continue to work as `query = BaseTable.sql\`...\``.

## Assumptions

- Query-built view definitions are limited to read/select queries. Mutation queries, query execution promises, and arbitrary runtime-returned values are out of scope for view DDL.
- Query-built view definitions are captured for migration generation, not executed at application runtime.

## Capabilities

- `view-query-definition`: Allows a raw SQL expression or DB-aware ORM query to be stored as a regular view definition source and converted to migration SQL.

## Detailed Design

### Public API

`BaseTable.View` exposes `query` as the source property for the PostgreSQL view definition. It accepts the raw SQL forms previously used by `sql` and ORM query objects that can produce a read SQL statement.

```ts
class SomeView extends BaseTable.View {
  readonly name = 'some_view';

  columns = this.setColumns((t) => ({
    id: t.integer(),
  }));

  init(db: typeof appDb) {
    this.query = db.someTable.select('id').where({ active: true });
  }
}
```

- Assigning `query` directly as `BaseTable.sql`, raw SQL, or string keeps the existing raw definition workflow.
- Assigning `query` in `init(db)` is supported for `BaseTable.View` classes and may use configured table queries and already built view queries from the ORM instance.
- The assigned query must be a read/select query whose selected columns match the declared view columns by database column name or selected alias.
- Query-built definitions use the same type-safe query builder surface that users normally use for selects, including `select`, joins, `where`, `group`, `having`, CTEs, scopes, and relation-aware query composition when those features can render to a standalone `SELECT`.
- The public API does not add a separate method such as `setQuery`; the feature uses a property because view definitions already use a class property as the DDL source of truth.

### `init` Lifecycle

The ORM already calls `init(db)` for configured views after DB-aware table and view queries exist. This feature makes `query` assigned during that callback part of the view metadata used by generated migrations.

- A view may declare an initial `query` property and then replace it in `init(db)`; the final value after `init` is the value used for migration generation.
- Existing table and view hook behavior in `init` remains unchanged.
- `db.$views` query objects remain the runtime query surface for reading the view. A query assigned to `this.query` is metadata for DDL, not the query object exposed under `db.$views.<key>`.
- If a query-built definition references `db.$views`, users are responsible for making the underlying database dependency valid for PostgreSQL. Orchid should preserve the rendered SQL; it does not infer or reorder dependencies beyond the existing view migration behavior.

### Migration SQL Conversion

Migration generation must normalize the final view `query` value into the existing regular-view AST `sql` shape used by `rake-db`.

```ts
class ActiveUsersView extends BaseTable.View {
  readonly name = 'active_users';

  columns = this.setColumns((t) => ({
    id: t.integer(),
  }));

  init(db: typeof appDb) {
    this.query = db.user.select('id').where({ active: true });
  }
}
```

The generated migration should be equivalent to:

```ts
await db.createView('active_users', {
  columns: ['id'],
  sql: `SELECT "user"."id" FROM "user" WHERE "user"."active" = true`,
});
```

- Query conversion must preserve SQL text and bind values in the same representation already accepted by `rake-db` `createView`.
- Query conversion should not run the query against the database.
- Query conversion must use the query's SQL-generation behavior with the same schema, snake-case, column alias, and adapter-aware SQL rules that `toSQL` uses for normal reads.
- Existing view diffing and comparison should receive the normalized SQL and continue to decide whether a view changed.
- If the view `query` value is missing after `init`, generation may keep the current empty raw SQL fallback behavior unless implementation already has a stricter error path.

### Scope Limits

- This feature targets regular `BaseTable.View` definitions. Materialized views may reuse the same normalization path if it falls out naturally, but materialized-view API expansion is not required by this spec.
- Query-built definitions are not a replacement for arbitrary raw SQL. Users can assign `query = BaseTable.sql\`...\`` for PostgreSQL syntax that the ORM query builder cannot express.
- The feature should not add runtime validation that selected query columns exactly match declared view columns; TypeScript and PostgreSQL remain the main feedback mechanisms.

### Documentation

The view docs should show the `init(db)` workflow next to the raw SQL expression workflow, call out that `query` may hold either a query builder or raw SQL, and explain that query-built definitions are compiled into migration SQL rather than executed.
