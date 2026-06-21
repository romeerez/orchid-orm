## Summary

Allow first-class ORM view definitions to use Orchid ORM query builder objects as the view definition source when they are assigned to `this.query` from a view class `init` callback where the DB-aware ORM instance is available. Raw SQL definitions continue to use the existing `sql` class property. Generated migrations compile the final definition source to SQL for `createView`.

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

  sql = BaseTable.sql`SELECT id, name FROM "user" WHERE active = true`;
}
```

## What Changes

- `BaseTable.View` keeps `sql` as the raw SQL view definition property.
- View class `init(db)` may assign or replace `this.query` using `db` table and view queries; this is the preferred workflow for view definitions that need ORM query access.
- Migration generation compiles query-built view definitions into the existing regular-view migration AST so generated `createView` and view comparison behavior stays unchanged.
- Runtime view querying through `db.$views` remains separate from the view definition query used by migrations.
- Raw SQL expressions continue to work as `sql = BaseTable.sql\`...\``.

## Assumptions

- Query-built view definitions are limited to read/select queries. Mutation queries, query execution promises, and arbitrary runtime-returned values are out of scope for view DDL.
- Query-built view definitions are captured for migration generation, not executed at application runtime.

## Capabilities

- `view-query-definition`: Allows a DB-aware ORM query assigned in `init(db)` to be stored as a regular view definition source and converted to migration SQL.

## Detailed Design

### Public API

`BaseTable.View` keeps `sql` as the source property for raw PostgreSQL view definitions. It also allows `this.query` to be assigned in `init(db)` to a read ORM query object that can produce a read SQL statement.

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

- Assigning `sql` directly as `BaseTable.sql`, raw SQL, or string keeps the existing raw definition workflow.
- Assigning `query` in `init(db)` is supported for `BaseTable.View` classes and may use configured table queries and already built view queries from the ORM instance.
- The assigned query must be a read/select query whose selected columns match the declared view columns by database column name or selected alias.
- Query-built definitions use the same type-safe query builder surface that users normally use for selects, including `select`, joins, `where`, `group`, `having`, CTEs, scopes, and relation-aware query composition when those features can render to a standalone `SELECT`.
- The public API does not add a separate method such as `setQuery`; query-builder definitions use `this.query` inside `init(db)` because the DB-aware ORM instance is only available there.

### `init` Lifecycle

The ORM already calls `init(db)` for configured views after DB-aware table and view queries exist. This feature makes `query` assigned during that callback part of the view metadata used by generated migrations.

- A view may declare an initial `sql` property and then assign `this.query` in `init(db)`; the query assigned after `init` is the value used for migration generation.
- Existing table and view hook behavior in `init` remains unchanged.
- `db.$views` query objects remain the runtime query surface for reading the view. A query assigned to `this.query` is metadata for DDL, not the query object exposed under `db.$views.<key>`.
- If a query-built definition references `db.$views`, users are responsible for making the underlying database dependency valid for PostgreSQL. Orchid should preserve the rendered SQL; it does not infer or reorder dependencies beyond the existing view migration behavior.

### Migration SQL Conversion

Migration generation must normalize the final view definition source into the existing regular-view AST `sql` shape used by `rake-db`. If `this.query` was assigned during `init(db)`, it is used; otherwise the view class `sql` property is used.

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
- If neither the view `sql` value nor an `init(db)`-assigned `query` value exists, generation may keep the current empty raw SQL fallback behavior unless implementation already has a stricter error path.

### Scope Limits

- This feature targets regular `BaseTable.View` definitions. Materialized views may reuse the same normalization path if it falls out naturally, but materialized-view API expansion is not required by this spec.
- Query-built definitions are not a replacement for arbitrary raw SQL. Users can assign `sql = BaseTable.sql\`...\`` for PostgreSQL syntax that the ORM query builder cannot express.
- The feature should not add runtime validation that selected query columns exactly match declared view columns; TypeScript and PostgreSQL remain the main feedback mechanisms.

### Documentation

The view docs should show the `init(db)` query-builder workflow next to the raw SQL expression workflow, call out that raw SQL uses `sql` while query-builder definitions use `this.query` inside `init(db)`, and explain that query-built definitions are compiled into migration SQL rather than executed.
