---
description: Defining and querying PostgreSQL views with BaseTable.View, BaseTable.MaterializedView, $views, relations, grants, refreshes, and generated migrations.
---

# Views

Define PostgreSQL regular views with `BaseTable.View` and materialized views with `BaseTable.MaterializedView` when you want a view to be a first-class ORM object.
Views are configured next to tables, queried through `db.$views`, can participate in relations, and can be included in generated migrations.

```ts
import { orchidORM, setGrants } from 'orchid-orm';
import { BaseTable, sql } from './base-table';
import { UserTable } from './user.table';

export class MonthlySalesView extends BaseTable.View {
  schema = 'analytics';
  readonly name = 'monthly_sales';

  securityInvoker = true;
  checkOption = 'LOCAL' as const;

  columns = this.setColumns((t) => ({
    id: t.integer(),
    userId: t.integer(),
    total: t.decimal(),
  }));

  sql = sql`
    SELECT
      row_number() over () AS id,
      "userId",
      sum(total) AS total
    FROM sale
    GROUP BY "userId"
  `;

  relations = {
    user: this.belongsTo(() => UserTable, {
      columns: ['userId'],
      references: ['id'],
    }),
  };

  grants = setGrants([
    {
      to: 'reporting_user',
      privileges: ['SELECT'],
    },
  ]);
}
```

Add the view classes to the first `orchidORM` options argument:

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    views: {
      monthlySales: MonthlySalesView,
    },
  },
  {
    user: UserTable,
  },
);
```

Configured views are exposed under `$views` by the key from the `views` object:

```ts
const rows = await db.$views.monthlySales
  .select('userId', 'total')
  .where({ userId: 1 })
  .order({ total: 'DESC' });
```

For split ORM setup, pass both tables and views to `bundleOrchidORM`:

```ts
import { bundleOrchidORM } from 'orchid-orm';

export const orm = bundleOrchidORM({
  tables: {
    user: UserTable,
  },
  views: {
    monthlySales: MonthlySalesView,
  },
});
```

## read-only by default

First-class views are read-only by default. Read queries are available, but mutation methods are unavailable at the TypeScript level:

```ts
await db.$views.monthlySales.select('userId', 'total');

await db.$views.monthlySales.create({ userId: 1, total: '10' });
//                         ^ TypeScript error: views are read-only by default.
```

Set `readonly readOnly = false` only when you are sure PostgreSQL accepts writes for the view, for example for a simple updatable view or a view with suitable triggers.
Orchid does not validate view updatability at runtime; PostgreSQL remains responsible for accepting or rejecting the mutation.

```ts
export class ActiveUserView extends BaseTable.View {
  readonly name = 'active_user';
  readonly readOnly = false;
  readonly checkOption = 'CASCADED';

  columns = this.setColumns((t) => ({
    id: t.integer().primaryKey(),
    name: t.text(),
    active: t.boolean(),
  }));

  sql = sql`SELECT id, name, active FROM "user" WHERE active = true`;
}
```

## materialized views

Use `BaseTable.MaterializedView` for PostgreSQL materialized views.
They use the same `views` ORM option and the same `$views` namespace as regular views, but they are always read-only and store stale data until refreshed.

```ts
import { orchidORM, refreshMaterializedView } from 'orchid-orm';
import { BaseTable, sql } from './base-table';
import { UserTable } from './user.table';

export class MonthlySalesMaterializedView extends BaseTable.MaterializedView {
  schema = 'analytics';
  readonly name = 'monthly_sales';
  withData = false;

  columns = this.setColumns((t) => ({
    userId: t.integer(),
    month: t.date(),
    total: t.decimal(),
  }));

  sql = sql`
    SELECT
      "userId",
      date_trunc('month', "createdAt")::date AS month,
      sum(total) AS total
    FROM sale
    GROUP BY "userId", date_trunc('month', "createdAt")::date
  `;

  relations = {
    user: this.belongsTo(() => UserTable, {
      columns: ['userId'],
      references: ['id'],
    }),
  };
}

export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    views: {
      monthlySales: MonthlySalesMaterializedView,
    },
  },
  {
    user: UserTable,
  },
);

const rows = await db.$views.monthlySales.where({ userId: 1 });

await db.$views.monthlySales.create({ userId: 1 });
//                         ^ TypeScript error: materialized views are read-only.

await refreshMaterializedView(db.$views.monthlySales, {
  concurrently: true,
  withData: true,
});
```

`BaseTable.MaterializedView` supports the table-like view behavior that applies to read-only queryable relations: columns, schema, computed columns, scopes, soft delete, grants, and relations.
It does not support the regular view write opt-in, so declaring `readOnly = false` is not part of the materialized view API.

`withData` controls generated `CREATE MATERIALIZED VIEW` migrations:

- omit `withData` to let PostgreSQL use its default.
- set `withData = true` for `WITH DATA`.
- set `withData = false` for `WITH NO DATA`; PostgreSQL creates the materialized view without loading rows, and it cannot be scanned until refreshed with data.

Materialized views do not use regular-view options such as `recursive`, `checkOption`, `securityBarrier`, or `securityInvoker`.
They also do not expose table-only options such as `rls`, `autoForeignKeys`, or table primary-key requirements.

Use `refreshMaterializedView` from `orchid-orm` to refresh a configured materialized view at runtime.
The helper accepts only materialized view query objects, derives the schema-qualified view name from the query, runs `REFRESH MATERIALIZED VIEW`, and resolves when the refresh completes.

```ts
await refreshMaterializedView(db.$views.monthlySales);

await refreshMaterializedView(db.$views.monthlySales, {
  concurrently: true,
  withData: true,
});

await refreshMaterializedView(db.$views.monthlySales, {
  withData: false,
});
```

`concurrently: true` emits `CONCURRENTLY`.
`withData: true` emits `WITH DATA`, `withData: false` emits `WITH NO DATA`, and omitting `withData` omits the clause.
Orchid rejects `{ concurrently: true, withData: false }` before running SQL because PostgreSQL does not allow concurrent refresh with `WITH NO DATA`.
PostgreSQL still validates state-dependent refresh requirements, including the need for an already populated materialized view and a suitable unique index for concurrent refresh.

Create indexes for materialized views in migrations with the same index helpers used for tables.
For manual migration examples, see [createMaterializedView, dropMaterializedView, refreshMaterializedView](/guide/migration-writing#creatematerializedview-dropmaterializedview-refreshmaterializedview).

## relations

Views support the same relation declaration methods as tables: `belongsTo`, `hasOne`, `hasMany`, and `hasAndBelongsToMany`.
Relations can point from a view to a table, from a table to a view, or between views.

```ts
export class UserTable extends BaseTable {
  readonly table = 'user';

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
  }));

  relations = {
    monthlySales: this.hasMany(() => MonthlySalesView, {
      columns: ['id'],
      references: ['userId'],
    }),
  };
}

const users = await db.user.select('name', {
  monthlySales: (q) => q.monthlySales.select('total'),
});
```

Relation queries preserve the target view's read-only capability.
Nested mutations are unavailable for read-only view relations.

## view options

`BaseTable.View` supports persistent PostgreSQL `CREATE VIEW` options used by generated migrations.
See the PostgreSQL [`CREATE VIEW`](https://www.postgresql.org/docs/current/sql-createview.html) docs for full database semantics.

- `recursive`: creates a recursive view.
- `checkOption`: `'LOCAL'` or `'CASCADED'`; asks PostgreSQL to reject writes through the view when rows would not satisfy the view condition. `CASCADED` also checks dependent views.
- `securityBarrier`: enables PostgreSQL's security barrier behavior for views that are used as a security boundary.
- `securityInvoker`: when `true`, PostgreSQL checks underlying table privileges and row-level security policies as the user querying the view instead of the view owner. This is usually the important option for views over RLS-managed tables. Generated view migrations default it to `true`; set `securityInvoker = false` only when owner-checked behavior is intentional.

`BaseTable.View` does not expose table-only options such as `rls` or `autoForeignKeys`.
For manual migrations, `createView` also has migration-only options such as `createOrReplace`, `temporary`, `dropIfExists`, and `dropMode`; see [createView, dropView](/guide/migration-writing#createview-dropview).

## generated migrations

Views are managed by `db g` only when they are listed in the ORM `views` option.
If no ORM views are configured, regular database views and materialized views are not loaded or diffed during migration generation.

When views are configured, the migration generator loads both regular and materialized views.
For regular views, it uses the view class `schema`, `name`, `columns`, `sql`, grants, and supported view options to generate `createView` and `dropView` migrations.
For materialized views, it uses `schema`, `name`, `columns`, `sql`, grants, `withData`, dependencies, and indexes to generate `createMaterializedView`, `dropMaterializedView`, and related index migrations.

Set `generatorIgnore = true` on a view class when the view should stay queryable in code but its DDL is managed outside Orchid.
This works the same as [`generatorIgnore.views`](/guide/generate-migrations#generatorignore) in ORM config.
View grants still need [`generatorIgnore.grants`](/guide/generate-migrations#generatorignore).
There is no separate materialized-view ignore option.
